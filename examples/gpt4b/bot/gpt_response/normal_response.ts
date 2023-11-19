import { MessageObjectT } from "object"
import { ChatPromptT } from "../../types"
import { OpenAI } from "openai"
import { getChatPrompt } from "../../prompt/chat"
import { getSummarizedTextPrompt } from "../../prompt/search_results"
import { getChatCompletionResult } from "../openai"
import { fetchSummaryOfFirstUrlInText } from "../../url_contents"

export async function getInitialGptResponse(
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
    console.log(prompt)

    const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: "gpt-4-vision-preview",
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
        messages: prompt,
    }

    const [content, functionCall] = await getChatCompletionResult(body)
    if (content == null && functionCall == null) {
        return [null, null, null]
    }
    if (functionCall == null) {
        return [prompt, content, null]
    }
    return [prompt, content, functionCall]
}
