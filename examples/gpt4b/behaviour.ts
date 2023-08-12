import * as beluga from "./beluga"
import {
    getChatPrompt,
    getGoogleSearchPrompt,
    getPageSummarizationPrompt,
    getSearchQueryAnsweringPrompt,
    getSummarizedTextPrompt,
} from "./prompt"
import { fetchPageContent } from "./url_contents"
import { functions, draw_omikuji } from "./function_calling"
import { MessageObjectT } from "object"
import { findUrls, getContextualMessagesFromTimeline, getUserNameFromMessage } from "./utils"
import {
    ChatCompletionRequestMessageFunctionCall,
    ChatCompletionRequestMessageRoleEnum,
    Configuration,
    OpenAIApi,
} from "openai"
import { myName, myUserId } from "./config"
import { PromptT } from "./types"

const configuration = new Configuration({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

async function fetchContextualMessages(channelId: number): Promise<MessageObjectT[]> {
    const response = await beluga.sendGetRequest("timeline/channel", {
        channel_id: channelId,
    })
    const data = JSON.parse(response)
    // 中身は降順になっている
    return getContextualMessagesFromTimeline(data.messages)
}

function shouldRespondTo(contextualMessages: MessageObjectT[]) {
    if (contextualMessages.length == 0) {
        return false
    }
    if (contextualMessages[0].user_id == myUserId) {
        // 自分の投稿には反応しない
        return false
    }
    return true
}

export async function postResponseForGoogleSearch(channelId: number, searchTerms: string, prompt: PromptT) {
    console.log(searchTerms)
    const searchResults = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: await getGoogleSearchPrompt(searchTerms),
        max_tokens: 2048,
        temperature: 0.0,
        frequency_penalty: 0.0,
    })
    if (searchResults.data.choices[0].message == null) {
        throw new Error("message is null")
    }
    const urlRecommendation = searchResults.data.choices[0].message.content
    if (urlRecommendation == null) {
        throw new Error("urlRecommendation is null")
    }
    const urls = findUrls(urlRecommendation)
    console.log("urlRecommendation", urlRecommendation)
    console.log("urls", urls)
    if (urls == null) {
        throw new Error("urls is null")
    }
    const url = urls[0]
    const data = await fetchPageContent(url)
    if (data == null) {
        throw new Error("data is null")
    }
    const answeringResult = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: getSearchQueryAnsweringPrompt(searchTerms, data["bodyText"]),
        max_tokens: 2048,
        temperature: 0.5,
        frequency_penalty: 0.5,
    })
    if (answeringResult.data.choices[0].message == null) {
        throw new Error("message is null")
    }
    const answerText = answeringResult.data.choices[0].message.content
    console.log("answerText", answerText)
    prompt.push({
        role: ChatCompletionRequestMessageRoleEnum.Function,
        name: "search_google",
        content: `{url: '${url}', content: '${answerText}'}`,
    })
    console.log("prompt", prompt)

    const [content, _] = await getChatCompletionResult(prompt, false)
    if (content == null) {
        throw new Error("message is null")
    }
    let text = content.replace(new RegExp(`^\\[?${myName}\\]?:`, "g"), "").replace(/^\[?私\]?:(\s*)?/, "")
    console.log("text", text)
    await beluga.sendPostRequest("message/post", {
        channel_id: channelId,
        text: text,
    })
}

async function fetchUrlSummarizedText(text: string): Promise<string[] | null[]> {
    const urls = findUrls(text)
    if (urls) {
        const url = urls[0]
        const data = await fetchPageContent(url)
        if (data) {
            console.group("Page Content:")
            console.log(url)
            console.log(data["bodyText"])
            console.log(data["meta"])
            console.log(data["title"])
            console.groupEnd()
            const metaTitle = data["meta"]["title"]
            const metaDescription = data["meta"]["description"]
            const twitterTitle = data["meta"]["twitter:title"]
            const twitterDescription = data["meta"]["twitter:description"]

            const title = twitterTitle ? twitterTitle : metaTitle ? metaTitle : data["title"] ? data["title"] : ""
            const description = twitterDescription ? twitterDescription : metaDescription ? metaDescription : ""
            const prompt = getPageSummarizationPrompt(title, description, data["bodyText"])
            console.group("Prompt:")
            console.log(prompt)
            console.groupEnd()
            const answer = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: prompt,
                max_tokens: 2048,
                temperature: 0.5,
                frequency_penalty: 0.5,
            })
            const obj = answer.data.choices[0]
            if (obj.message && obj.message.content) {
                const urlSummarizedText = obj.message.content
                console.group("Summarized Text:")
                console.log(urlSummarizedText)
                console.groupEnd()
                return [url, urlSummarizedText]
            }
        }
    }
    return [null, null]
}

async function getChatCompletionResult(
    prompt: PromptT,
    call_function: boolean = true
): Promise<[null, ChatCompletionRequestMessageFunctionCall] | [string, null] | [null, null]> {
    const answer = await openai.createChatCompletion({
        model: "gpt-4-0613",
        messages: prompt,
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
        functions: functions,
        function_call: call_function ? "auto" : "none",
    })
    const obj = answer.data.choices[0]
    if (obj.message == null) {
        return [null, null]
    }
    if (obj.message.content == null && obj.message.function_call == null) {
        return [null, null]
    }
    if (obj.message.content != null && obj.message.function_call == null) {
        return [obj.message.content, null]
    }
    if (obj.message.content == null && obj.message.function_call != null) {
        return [null, obj.message.function_call]
    }
    return [null, null]
}

async function getInitialGptResponse(
    contextualMessages: MessageObjectT[]
): Promise<[PromptT, null, ChatCompletionRequestMessageFunctionCall] | [PromptT, string, null] | [null, null, null]> {
    const latestMessage = contextualMessages[0]
    if (latestMessage.text == null) {
        return [null, null, null]
    }
    const prompt = getChatPrompt(contextualMessages)

    const [url, urlSummarizedText] = await fetchUrlSummarizedText(latestMessage.text)
    const additionalPrompt = url && urlSummarizedText ? getSummarizedTextPrompt(url, urlSummarizedText) : []
    additionalPrompt.forEach((item) => {
        prompt.push(item)
    })

    console.group("Prompt:")
    console.log(prompt)
    console.groupEnd()

    const [content, function_call] = await getChatCompletionResult(prompt)
    if (content == null && function_call == null) {
        return [null, null, null]
    }
    if (function_call == null) {
        return [prompt, content, null]
    }
    return [prompt, content, function_call]
}

async function postResponseWithFunctionCallingResult(
    prompt: PromptT,
    channelId: number,
    responseFunctionCall: ChatCompletionRequestMessageFunctionCall
) {
    console.group("Function Calling:")
    console.log(responseFunctionCall)
    console.groupEnd()
    const functionName = responseFunctionCall["name"]
    if (responseFunctionCall["arguments"] == null) {
        return await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: 'エラー: responseFunctionCall["arguments"] == null',
        })
    }
    const functionArguments = JSON.parse(responseFunctionCall["arguments"])
    if (functionName == "draw_omikuji") {
        const result = draw_omikuji()
        prompt.push({
            role: ChatCompletionRequestMessageRoleEnum.Function,
            name: "draw_omikuji",
            content: result,
        })
        console.group("Prompt:")
        console.log(prompt)
        console.groupEnd()
        const [content, _] = await getChatCompletionResult(prompt, false)
        if (content == null) {
            return await beluga.sendPostRequest("message/post", {
                channel_id: channelId,
                text: "エラー: content == null",
            })
        }
        let text = content.replace(new RegExp(`^\\[?${myName}\\]?:`, "g"), "")
        console.group("Completion Result:")
        console.log(text)
        console.groupEnd()
        await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: text,
        })
    } else if (functionName == "search_google") {
        const searchTerms = functionArguments["search_query"]
        try {
            console.group("Google Search:")
            await postResponseForGoogleSearch(channelId, searchTerms, prompt)
            console.groupEnd()
        } catch (error) {
            console.log(error)
            await beluga.sendPostRequest("message/post", {
                channel_id: channelId,
                text: `エラー: ${error}`,
            })
            console.groupEnd()
        }
    } else if (functionName == "recommend_voice_actress") {
        const actressName = functionArguments["name"]
        prompt.push({
            role: ChatCompletionRequestMessageRoleEnum.Function,
            name: "recommend_voice_actress",
            content: actressName,
        })
        console.group("Function Calling:")
        console.log(prompt)
        console.groupEnd()
        const [content, _] = await getChatCompletionResult(prompt, false)
        if (content == null) {
            return await beluga.sendPostRequest("message/post", {
                channel_id: channelId,
                text: "エラー: content == null",
            })
        }
        let text = content.replace(new RegExp(`^\\[?${myName}\\]?:`, "g"), "").replace(/^\[?私\]?:(\s*)?/, "")
        console.group("Completion Result:")
        console.log(text)
        console.groupEnd()
        await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: text,
        })
    }
}

export async function postResponse(channelId: number) {
    if (beluga.getChannelData(channelId) == null) {
        await beluga.fetchChannelData(channelId)
    }
    const contextualMessages = await fetchContextualMessages(channelId)
    if (shouldRespondTo(contextualMessages) == false) {
        return
    }
    const [prompt, responseText, responseFunctionCall] = await getInitialGptResponse(contextualMessages)
    if (responseText == null && responseFunctionCall == null) {
        console.error("responseText == null && responseFunctionCall == null")
        return await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: "エラー: responseText == null",
        })
    }
    if (responseFunctionCall == null) {
        let text = responseText.replace(new RegExp(`^\\[?${myName}\\]?:`, "g"), "").replace(/^\[?私\]?:(\s*)?/, "")
        console.group("Completion Result:")
        console.log(text)
        console.groupEnd()
        await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: text,
        })
    } else {
        return await postResponseWithFunctionCallingResult(prompt, channelId, responseFunctionCall)
    }
}
