import { OpenAI } from "openai"

const openai = new OpenAI({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
})

// {
//   model: "gpt-4-vision-preview",
//   messages: prompt,
//   max_tokens: 512,
//   temperature: 0.5,
//   frequency_penalty: 0.5,
//   // functions: functions,
//   // function_call: call_function ? "auto" : "none",
// }

export async function getChatCompletionResult(
    body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    call_function: boolean = true
): Promise<[null, OpenAI.Chat.ChatCompletionMessage.FunctionCall] | [string, null] | [null, null]> {
    // @ts-ignore
    const answer: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(body)
    const obj = answer.choices[0]
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
