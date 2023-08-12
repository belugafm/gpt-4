import * as beluga from "./beluga"
import { getChatPrompt, getGoogleSearchPrompt, getSearchQueryAnsweringPrompt, getSummarizedTextPrompt } from "./prompt"
import { fetchSummarizedPageContent } from "./url_contents"
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
    const data = await fetchSummarizedPageContent(url)
    if (data == null) {
        throw new Error("data is null")
    }
    if (data["description"] == null && data["bodyText"] == null) {
        throw new Error("data is null")
    }
    const urlDescription = data["bodyText"] ? data["bodyText"] : data["description"]
    const answeringResult = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: getSearchQueryAnsweringPrompt(searchTerms, urlDescription),
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

async function fetchSummaryOfFirstUrlInText(text: string): Promise<string[] | null[]> {
    const urls = findUrls(text)
    if (urls) {
        const url = urls[0]
        const data = await fetchSummarizedPageContent(url)
        console.log(data)
        if (data) {
            if (data["bodyText"]) {
                return [url, data["bodyText"]]
            }
            return [url, data["description"]]
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

    const [url, urlSummarizedText] = await fetchSummaryOfFirstUrlInText(latestMessage.text)
    console.log(url, urlSummarizedText)
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
    } else if (functionName == "add_to_favorites") {
        const messageId = functionArguments["message_id"]
        const res = await beluga.sendPostRequest("favorites/create", {
            message_id: messageId,
        })
        console.log(res)
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
