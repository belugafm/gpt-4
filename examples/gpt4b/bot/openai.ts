import { OpenAI } from "openai"

const openai = new OpenAI({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
})

export async function getImageGenerationResult(prompt: string): Promise<string | null> {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        quality: "hd",
        size: "1024x1024",
    })
    const imageUrl = response.data[0].url
    if (imageUrl == null) {
        return null
    } else {
        return imageUrl
    }
}

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
