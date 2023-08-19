import OAuth from "oauth"
import qs from "querystring"
import { WebSocketClient } from "../../websocket"
import { ChannelObjectT, MessageObjectT } from "../../object"
import dotenv from "dotenv"
import axios from "axios"

dotenv.config({ path: "examples/japanese-large-lm-3.6b-instruction-sft/.env" })

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""
const myUserId = 106
const skipUserId = 92
const myName = "llm"
const targetChannelIds = [4]
const retryLimit = 3
const waitNewMessagesUntil = 0
const lock: { [key: number]: boolean } = {}
const mapChannelIdToChannelObject: { [id: number]: ChannelObjectT } = {}
const baseRespondProb = 0.1

console.log(consumerKey)
console.log(consumerSecret)
console.log(accessToken)
console.log(accessTokenSecret)

const llm_endpoint = "http://localhost:8888/chat_completion"

const oauth = new OAuth.OAuth(
    "https://beluga.fm/api/oauth/request_token",
    "https://beluga.fm/api/oauth/access_token",
    consumerKey,
    consumerSecret,
    "1.0",
    null,
    "HMAC-SHA1"
)

function getContextMessages(messages: MessageObjectT[]): MessageObjectT[] {
    const maxTextLength = 1000
    const maxMessageCount = 1 // 最大何個の投稿を含めるか
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

function getUserName(message: MessageObjectT): string {
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

function getPrompt(messages: MessageObjectT[]): string {
    const userNames = new Set([myName])
    messages.forEach((message) => {
        if (message.user) {
            userNames.add(getUserName(message))
        }
    })
    let prompt = `### System:
Your name is ${myName}.
Please answer the following user's question in Japanese.

### User:
`
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of messages.reverse()) {
        const userName = getUserName(message)
        let text = message.text
        if (text == null) {
            continue
        }
        text = text
            .replace(/^\n+/, "")
            .replace(/\n+$/, "")
            .replace(/^\s+/, "")
            .replace(/\s+$/, "")
            .replace(`@${myName}`, "")
            .trim()
        if (userName == myName) {
            prompt += `${text}\n`
        } else {
            prompt += `${text}\n`
        }
    }
    prompt += `
### Assistant:
`
    return prompt
}

function post(methodUrl: string, body: any): Promise<any> {
    for (const key of Object.keys(body)) {
        if (body[key] == null) {
            delete body[key]
        }
    }
    const endpointUrl = `https://beluga.fm/api/v1/${methodUrl}`
    return new Promise((resolve, reject) => {
        // @ts-ignore
        oauth.post(endpointUrl, accessToken, accessTokenSecret, body, function (error, data, res) {
            if (error) {
                reject(error)
            } else {
                resolve(data)
            }
        })
    })
}
function get(methodUrl: string, query: any): Promise<any> {
    for (const key of Object.keys(query)) {
        if (query[key] == null) {
            delete query[key]
        }
    }
    const endpointBaseUrl = `https://beluga.fm/api/v1/${methodUrl}`
    const endpointUrl = new URL(endpointBaseUrl)
    endpointUrl.search = qs.stringify(query)
    return new Promise((resolve, reject) => {
        oauth.get(endpointUrl.toString(), accessToken, accessTokenSecret, function (error, data, res) {
            if (error) {
                reject(error)
            } else {
                resolve(data)
            }
        })
    })
}

function getChannelData(channelId: number): ChannelObjectT {
    return mapChannelIdToChannelObject[channelId]
}

async function fetchChannelData(channelId: number) {
    const response = await get("channel/show", {
        id: channelId,
    })
    const data = JSON.parse(response)
    if (data.ok == false) {
        throw new Error("Channel not found")
    }
    const { channel } = data
    mapChannelIdToChannelObject[channelId] = channel
}

function sleep(sec: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, sec * 1000)
    })
}

async function fetchContextMessages(channelId: number): Promise<MessageObjectT[]> {
    const response = await get("timeline/channel", {
        channel_id: channelId,
    })
    const data = JSON.parse(response)
    // 中身は降順になっている
    return getContextMessages(data.messages)
}

function shouldRespondTo(contextMessages: MessageObjectT[]) {
    if (contextMessages.length == 0) {
        return false
    }
    if (contextMessages[0].user_id == myUserId) {
        // 自分の投稿には反応しない
        return false
    }
    return true
}

async function postResponse(channelId: number) {
    if (getChannelData(channelId) == null) {
        await fetchChannelData(channelId)
    }
    const contextMessages = await fetchContextMessages(channelId)
    if (shouldRespondTo(contextMessages) == false) {
        return
    }
    if (contextMessages.length == 0) {
        return
    }
    const latestMessageText = contextMessages[0].text
    let respondProb = baseRespondProb
    if (latestMessageText?.indexOf(`@${myName}`) != -1) {
        respondProb = 1.0
    }
    if (Math.random() > respondProb) {
        return
    }
    const prompt = getPrompt(contextMessages)
    console.group("Prompt:")
    console.log(prompt)
    console.groupEnd()

    try {
        const data = { prompt }
        const response = await axios.post(llm_endpoint, data)
        console.log("Response:", response.data)
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const generatedText = response.data[0].generated_text.replace(prompt, "").trim()
            console.log("Generated Text:", generatedText)
            await post("message/post", {
                channel_id: channelId,
                text: generatedText,
            })
        } else {
            console.log("Unexpected response format")
        }
    } catch (error) {
        console.error("Error posting to endpoint:", error)
    }
}

async function main() {
    const ws = new WebSocketClient("wss://beluga.fm/ws/", async (channelId) => {
        if (!targetChannelIds.includes(channelId)) {
            return
        }
        if (lock[channelId]) {
            return
        }
        lock[channelId] = true
        let succeeded = false
        try {
            await sleep(waitNewMessagesUntil)
            for (let n = 0; n <= retryLimit; n++) {
                try {
                    await postResponse(channelId)
                    succeeded = true
                    break
                } catch (error) {
                    console.error(error)
                    succeeded = false
                    await sleep(10)
                }
            }
        } catch (error) {
            console.error(error)
            succeeded = false
        }
        if (succeeded == false) {
            try {
                await post("message/post", {
                    channel_id: channelId,
                    text: "エラー",
                })
            } catch (error) {
                console.error(error)
            }
        }

        lock[channelId] = false
    })
    ws.connect()
}

main()
