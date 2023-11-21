import { MessageObjectT } from "object"
import { myName, myUserId } from "./config"
import { OpenAI } from "openai"
import axios from "axios"
import fs from "fs"
import tmp from "tmp"
import * as beluga from "./beluga"
import FormData from "form-data"

export function createTmpFilename() {
    return tmp.tmpNameSync()
}

export async function tryDownloadImage(url: string, filepath: string) {
    const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
    })
    const writer = fs.createWriteStream(filepath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve)
        writer.on("error", reject)
    })
}

export async function tryUploadGeneratedImage(origImageUrl: string) {
    const tmpPath = createTmpFilename()
    await tryDownloadImage(origImageUrl, tmpPath)

    const buffer = fs.readFileSync(tmpPath)
    const file = fs.createReadStream(tmpPath)
    const formData = new FormData()
    formData.append("file", file)
    const res = await beluga.postFormData("upload/media", { file: buffer }, formData)

    fs.unlinkSync(tmpPath)

    if (res.data.ok) {
        for (const file of res.data.files) {
            if (file.original) {
                return file.url
            }
        }
    }
    throw new Error("アップロードに失敗しました")
}

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
    const content: OpenAI.Chat.ChatCompletionContentPart[] = []
    let cursor = 0
    for (const match of matchResults) {
        if (match.index == null) {
            continue
        }
        if (cursor > 0 && cursor != match.index) {
            const substr = text.substring(cursor, match.index)
            cursor += match.index
            content.push({
                text: substr,
                type: "text",
            })
        }
        const imageUrl: string = match[0]
        content.push({
            type: "image_url",
            image_url: { url: imageUrl },
        })
        cursor += imageUrl.length
    }
    if (cursor < text.length) {
        const substr = text.substring(cursor, text.length)
        content.push({
            text: substr,
            type: "text",
        })
    }
    return content
}
