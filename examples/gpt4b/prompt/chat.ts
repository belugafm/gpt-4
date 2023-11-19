import { MessageObjectT } from "../../../object"
import { myName } from "../config"
import { getChatInstruction } from "../instructions"
import { ChatPromptT } from "../types"
import { getUserNameFromMessage, splitTextIntoStringsAndImages } from "../utils"
import { OpenAI } from "openai"

export function getChatPrompt(contextualMessages: MessageObjectT[]): ChatPromptT {
    const userNames = new Set([myName])
    contextualMessages.forEach((message) => {
        if (message.user) {
            userNames.add(getUserNameFromMessage(message))
        }
    })
    let chat: ChatPromptT = []
    chat.push({
        role: "system",
        content: getChatInstruction(contextualMessages),
    })
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of contextualMessages.slice().reverse()) {
        const userName = getUserNameFromMessage(message)
        if (message.text == null) {
            continue
        }
        const text = message.text
            ?.replace(/^\n+/, "")
            .replace(/\n+$/, "")
            .replace(/^\s+/, "")
            .replace(/\s+$/, "")
        if (userName == myName) {
            chat.push({
                role: "assistant",
                content: text,
            })
        } else {
            const parts = splitTextIntoStringsAndImages(text)
            const content: OpenAI.Chat.ChatCompletionContentPart[] = []
            for (const part of parts) {
                if (part["type"] == "text") {
                    const text = part["text"]
                    content.push({
                        type: "text",
                        text: `[name=${userName}, message_id=${message.id}]:${text}`,
                    })
                }
                if (part["type"] == "image_url") {
                    content.push({
                        type: "image_url",
                        image_url: part["image_url"],
                    })
                }
            }
            chat.push({
                role: "user",
                content: content,
            })
        }
    }
    return chat
}
