import { OpenAI } from "openai"

export type ChatPromptT = (
    | OpenAI.Chat.ChatCompletionUserMessageParam
    | OpenAI.Chat.ChatCompletionSystemMessageParam
    | OpenAI.Chat.ChatCompletionAssistantMessageParam
    | OpenAI.Chat.ChatCompletionFunctionMessageParam
)[]
