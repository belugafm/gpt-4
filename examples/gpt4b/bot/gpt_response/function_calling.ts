import { ChatPromptT } from "../../types"
import { getChatCompletionResult } from "../openai"
import { OpenAI } from "openai"
import { functions } from "../function_calling/functions"

export async function getGptResponseWithoutCallingFunction(prompt: ChatPromptT): Promise<string> {
    const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: "gpt-4o",
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
