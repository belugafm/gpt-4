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

export function getContextualMessagesFromTimeline(messages: MessageObjectT[]): MessageObjectT[] {
    const maxTextLength = 300
    const maxMessageCount = 4 // 最大何個の投稿を含めるか
    const untilSeconds = 3600 // 最大何秒前の投稿まで含めるか
    const ret = []
    let sumTextLength = 0
    let latestCreatedAt = 0
    for (const message of messages) {
        if (message.text == null) {
            continue
        }
        if (ret.length == 0) {
            latestCreatedAt = new Date(message.created_at).getTime()
        } else {
            if (latestCreatedAt - new Date(message.created_at).getTime() > untilSeconds * 1000) {
                break
            }
        }
        ret.push(message)
        sumTextLength += message.text.length
        if (sumTextLength >= maxTextLength) {
            break
        }
        if (ret.length >= maxMessageCount) {
            break
        }
    }
    return ret
}

export function findUrls(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex)
}

export function replaceUnnecessaryStringFromText(text: string) {
    return text.replace(/^\[name=.+, message_id=.+\]:/, "")
}

export function splitTextIntoStringsAndImages(text: string) {
    console.group("splitTextIntoStringsAndImages")
    const matchResults = [...text.matchAll(/(https:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.webp)[^\s]*)/g)]
    const prompt: OpenAI.Chat.ChatCompletionContentPart[] = []
    let cursor = 0
    for (const match of matchResults) {
        if (cursor != match.index) {
            const substr = text.substring(cursor, match.index)
            cursor += match.index
            console.log("substr:", substr)
            prompt.push({
                text: substr,
                type: "text",
            })
        }
        const imageUrl: string = match[0]
        console.log("image_url:", imageUrl)
        prompt.push({
            type: "image_url",
            image_url: imageUrl,
        })
        cursor += imageUrl.length
    }
    if (cursor < text.length) {
        const substr = text.substring(cursor, text.length)
        console.log("substr:", substr)
        prompt.push({
            text: substr,
            type: "text",
        })
    }
    console.groupEnd()
    return prompt
}
