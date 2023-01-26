import OAuth from "oauth"
import qs from "querystring"
import { Configuration, OpenAIApi } from "openai"
import { WebSocketClient } from "../websocket"
import { MessageObjectT } from "../object"

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""
const myUserId = 92
const myName = "gpt3"
const targetChannelId = 4

console.log(consumerKey)
console.log(consumerSecret)
console.log(accessToken)
console.log(accessTokenSecret)

const configuration = new Configuration({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

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
    const maxTextLength = 256
    const maxMessageCount = 5
    const ret = []
    let sumTextLength = 0
    for (const message of messages) {
        if (message.text == null) {
            continue
        }
        if (message.text.length > maxTextLength) {
            continue
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

function getUserName(message: MessageObjectT) {
    if (message.user_id == myUserId) {
        return myName
    }
    if (message.user == null) {
        return message.user_id
    }
    const { user } = message
    if (user.display_name && user.display_name.length > 0) {
        return user.display_name
    }
    return user.name
}

function getPrompt(messages: MessageObjectT[]): string {
    // messagesは降順（最新の投稿が[0]に入っているのでソートする
    let prompt = `Your name is ${myName}.\n`
    for (const message of messages.reverse()) {
        const userName = getUserName(message)
        const text = message.text?.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^\s+/, "").replace(/\s+$/, "")
        prompt += `${userName}:${text}\n`
    }
    prompt += `${myName}:`
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

async function main() {
    let lastMessageId = 0
    const ws = new WebSocketClient("wss://beluga.fm/ws/", async (channelId) => {
        if (channelId != targetChannelId) {
            return
        }
        try {
            const response = await get("timeline/channel", {
                channel_id: targetChannelId,
            })
            const data = JSON.parse(response)
            // 中身は降順になっている
            const contextMessages = getContextMessages(data.messages)
            if (contextMessages.length == 0) {
                return
            }
            if (contextMessages[0].id == lastMessageId) {
                // 既に処理中なのでスキップ
                return
            }
            if (contextMessages[0].user_id == myUserId) {
                // 自分の投稿には反応しない
                return
            }
            lastMessageId = contextMessages[0].id
            const prompt = getPrompt(contextMessages)
            console.log("Prompt:")
            console.log(prompt)
            const answer = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                max_tokens: 256,
                temperature: 0.9,
            })
            if (answer.data.choices.length > 0) {
                const obj = answer.data.choices[0]
                if (obj.text) {
                    const text = obj.text
                        .replace(/^\n+/, "")
                        .replace(/\n+$/, "")
                        .replace(/^\s+/, "")
                        .replace(/\s+$/, "")
                    console.log("Completion:")
                    console.log(text)
                    await post("message/post", {
                        channel_id: 4,
                        text: text,
                    })
                }
            }
        } catch (error) {
            console.error(error)
            try {
                const response = await post("message/post", {
                    channel_id: 4,
                    text: "エラー",
                })
                console.log(JSON.parse(response))
            } catch (error) {
                console.dir(error)
                console.error(error)
            }
        }
    })
    ws.connect()
    try {
        const response = await post("message/post", {
            channel_id: 4,
            text: "起動しました",
        })
        console.log(JSON.parse(response))
    } catch (error) {
        console.error(error)
    }
}
main()
