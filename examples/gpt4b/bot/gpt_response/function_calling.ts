import { ChatPromptT } from "../../types"
import { getChatCompletionResult } from "../openai"
import { OpenAI } from "openai"
import { getFunctionCallingResult } from "../function_calling/results"
import { functions } from "../function_calling/functions"

export async function getGptResponseWithFunctionCallingResult(
    prompt: ChatPromptT,
    responseFunctionCall: OpenAI.Chat.ChatCompletionMessage.FunctionCall
): Promise<string> {
    const additionalPrompt = await getFunctionCallingResult(responseFunctionCall)
    prompt.push(...additionalPrompt)

    const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: "gpt-4-1106-preview",
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
        messages: prompt,
        functions: functions,
        function_call: "none",
    }
    const [content] = await getChatCompletionResult(body)
    if (content == null) {
        throw new Error("Failed to get chat completion results")
    }
    return content
}
