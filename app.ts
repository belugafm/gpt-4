import OAuth from "oauth"
import qs from "querystring"
import { Configuration, OpenAIApi } from "openai"
import { WebSocketClient } from "./websocket"
import { MessageObjectT } from "./object"

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""
const myUserId = 92
const myUserName = "gpt3"
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

function getLatestMessage(messages: MessageObjectT[]): MessageObjectT | null {
    for (const message of messages) {
        if (message.user_id == myUserId) {
            continue
        }
        if (message.thread_id) {
            continue
        }
        if (message.user?.bot) {
            continue
        }
        if (message.text == null) {
            continue
        }
        if (message.text.length > 100) {
            continue
        }
        return message
    }
    return null
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

const main = async () => {
    let sinceId = 0
    const ws = new WebSocketClient("wss://beluga.fm/ws/", async (channelId) => {
        if (channelId != targetChannelId) {
            return
        }
        try {
            const response = await get("timeline/channel", {
                channel_id: targetChannelId,
                since_id: sinceId,
            })
            const data = JSON.parse(response)
            const latestMessage = getLatestMessage(data.messages)
            if (latestMessage == null) {
                return
            }
            sinceId = latestMessage.id
            const prompt = `Your name is ${myUserName}. Respond to "${latestMessage.text}" in Japanese.`
            console.log(prompt)
            const answer = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                max_tokens: 200,
                temperature: 0.9,
            })
            if (answer.data.choices.length > 0) {
                const obj = answer.data.choices[0]
                if (obj.text) {
                    const text = obj.text
                        .replace(/^\n+/g, "")
                        .replace(/\n+$/g, "")
                        .replace(/^\s+/g, "")
                        .replace(/\s+$/g, "")
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
