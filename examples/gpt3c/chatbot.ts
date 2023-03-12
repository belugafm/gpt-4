import OAuth from "oauth"
import qs from "querystring"
import { Configuration, OpenAIApi } from "openai"
import { WebSocketClient } from "../../websocket"
import { ChannelObjectT, MessageObjectT } from "../../object"
import dotenv from "dotenv"

dotenv.config({ path: "examples/gpt3c/.env" })

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""
const myUserId = 105
const myName = "gpt3c"
const targetChannelIds = [10]
const retryLimit = 3
const waitNewMessagesUntil = 0
const lock: { [key: number]: boolean } = {}
const mapChannelIdToChannelObject: { [id: number]: ChannelObjectT } = {}

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
    const maxTextLength = 500
    const maxMessageCount = 5 // 最大何個の投稿を含めるか
    const untilSeconds = 3600 // 最大何秒前の投稿まで含めるか
    const ret = []
    let sumTextLength = 0
    let latestCreatedAt = 0
    for (const message of messages) {
        if (message.text == null) {
            continue
        }
        if (message.text.length > maxTextLength) {
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

function getPrompt(messages: MessageObjectT[], channel: ChannelObjectT): any {
    const userNames = new Set([myName])
    messages.forEach((message) => {
        if (message.user) {
            userNames.add(getUserName(message))
        }
    })
    const supportChannelUrl = "https://beluga.fm/channel/uTe7HA7Ms06x"
    let chat = []
    let instruction = `As part of our commitment to support our users, we want you to assist with responding users. 
Please provide a clear and concise response in Japanese to the user based only on information in our FAQ list. 
Please note that each question in the FAQ list starts with "Q:", followed by the actual question, and each answer starts with "A:", followed by the corresponding answer.

FAQ list:
Q: Do you have an iPhone app?
A: No. It is currently under development. Beluga can be used from a smartphone browser, but it is still under development, so some features may be missing.

Q: What is Beluga?
A: Beluga is a chat app that allows you to connect with people around the world in real time. Please first access main channel ${supportChannelUrl}.

Q: What is this place?
A: Beluga is a chat app that allows you to connect with people around the world in real time. Please first access main channel ${supportChannelUrl}.

Q: Where are other users?
A: They are in the main channel ${supportChannelUrl}.

Please note that 
- When responding, please do not include the "Q:" and "A:" in your response, but rather respond directly to the user.
- While you have been trained to provide helpful and accurate responses based on the information in our FAQ list, it may not always be able to answer every question. 
- If it is unable to provide a satisfactory response to the user's question, we recommend accessing ${supportChannelUrl} for additional assistance.
- If the user's question is not related to the above FAQ list, you will respond with "I'm sorry, I don't have information on that topic. Please access ${supportChannelUrl} for additional assistance." in Japanese.
`
    chat.push({
        role: "system",
        content: instruction,
    })
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of messages.reverse()) {
        const userName = getUserName(message)
        const text = message.text?.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^\s+/, "").replace(/\s+$/, "")
        if (userName == myName) {
            chat.push({
                role: "assistant",
                content: text,
            })
        } else {
            chat.push({
                role: "user",
                content: text,
            })
        }
    }
    return chat
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
    const channel = getChannelData(channelId)
    const prompt = getPrompt(contextMessages, channel)
    console.group("Prompt:")
    console.log(prompt)
    console.groupEnd()
    const answer = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: prompt,
        max_tokens: 512,
        temperature: 0.5,
        frequency_penalty: 0.5,
    })
    const obj = answer.data.choices[0]
    if (obj.message) {
        const userNames = new Set([myName])
        contextMessages.forEach((message) => {
            if (message.user) {
                userNames.add(getUserName(message))
            }
        })
        let text = obj.message.content.replace(/(https:\/\/beluga.fm\/[0-9a-zA-Z\-_@\/]+)/, " $1 ")
        for (const name of userNames) {
            text = text.replace(`[${name}]`, name)
        }
        console.group("Chat:")
        console.log(text)
        console.groupEnd()
        await post("message/post", {
            channel_id: channelId,
            text: text,
        })
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
