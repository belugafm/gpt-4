import { MessageObjectT } from "../../../../object"
import { ChatPromptT } from "../../types"
import { OpenAI } from "openai"
import { getChatPrompt } from "../../prompt/chat"
import { getSummarizedTextPrompt } from "../../prompt/search_results"
import { getChatCompletionResult } from "../openai"
import { fetchSummaryOfFirstUrlInText } from "../../url_contents"
import { functions } from "../function_calling/functions"

function getBody(prompt: ChatPromptT): OpenAI.Chat.Completions.ChatCompletionCreateParams {
    const bodyForText: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: "gpt-4o-mini",
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
        messages: prompt,
        functions: functions,
        function_call: "auto",
    }
    const bodyForImage: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: "gpt-4o-mini",
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
        messages: prompt,
    }
    const role = prompt[prompt.length - 1]["role"]
    const content = prompt[prompt.length - 1]["content"]
    if (content == null) {
        return bodyForText
    }
    if (role != "user") {
        return bodyForText
    }
    if (typeof content == "string") {
        return bodyForText
    }
    for (const part of content) {
        if (part["type"] == "image_url") {
            return bodyForImage
        }
    }
    return bodyForText
}

export async function getInitialGptResponseForText(
    contextualMessages: MessageObjectT[]
): Promise<
    | [ChatPromptT, null, OpenAI.Chat.ChatCompletionMessage.FunctionCall]
    | [ChatPromptT, string, null]
    | [null, null, null]
> {
    if (contextualMessages.length == 0) {
        return [null, null, null]
    }
    const latestMessage = contextualMessages[0]
    if (latestMessage.text == null) {
        return [null, null, null]
    }

    const prompt = getChatPrompt(contextualMessages)
    const [url, urlSummarizedText] = await fetchSummaryOfFirstUrlInText(latestMessage.text)
    if (url != null && urlSummarizedText != null) {
        prompt.push(...getSummarizedTextPrompt(url, urlSummarizedText))
    }

    for (const m of prompt) {
        console.log(m)
    }

    const body = getBody(prompt)
    console.log("Model: ", body["model"])

    const [content, functionCall] = await getChatCompletionResult(body)
    if (content == null && functionCall == null) {
        return [null, null, null]
    }
    if (functionCall == null) {
        return [prompt, content, null]
    }
    return [prompt, content, functionCall]
}
