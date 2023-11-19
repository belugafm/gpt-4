import { MessageObjectT } from "object"
import { myName, myUserId } from "./config"
import { OpenAI } from "openai"

export function sleep(sec: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, sec * 1000)
    })
}

export function getUserNameFromMessage(message: MessageObjectT): string {
    if (message.user_id == myUserId) {
        return myName
    }
    if (message.user == null) {
        return `${message.user_id}`
    }
    const { user } = message
    if (user.display_name && user.display_name.length > 0) {
        return user.display_name
    }
    return user.name
}

export function findUrls(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex)
}

export function replaceUnnecessaryStringFromText(text: string) {
    return text.replace(/^\[name=.+, message_id=.+\]:/, "")
}

export function splitTextIntoStringsAndImages(
    text: string
): OpenAI.Chat.ChatCompletionContentPart[] {
    const matchResults = [
        ...text.matchAll(/(https:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.webp)[^\s]*)/g),
    ]
    const prompt: OpenAI.Chat.ChatCompletionContentPart[] = []
    let cursor = 0
    for (const match of matchResults) {
        if (!match.index) {
            continue
        }
        if (cursor != match.index) {
            const substr = text.substring(cursor, match.index)
            cursor += match.index
            prompt.push({
                text: substr,
                type: "text",
            })
        }
        const imageUrl: string = match[0]
        prompt.push({
            type: "image_url",
            image_url: { url: imageUrl },
        })
        cursor += imageUrl.length
    }
    if (cursor < text.length) {
        const substr = text.substring(cursor, text.length)
        prompt.push({
            text: substr,
            type: "text",
        })
    }
    return prompt
}
