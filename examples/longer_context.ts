import OAuth from "oauth"
import qs from "querystring"
import { Configuration, OpenAIApi } from "openai"
import { WebSocketClient } from "../websocket"
import { ChannelObjectT, MessageObjectT } from "../object"

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""
const myUserId = 92
const myName = "gpt3"
const targetChannelIds = [4]

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

const map_id_to_channel: { [id: number]: ChannelObjectT } = {}

function getContextMessages(messages: MessageObjectT[]): MessageObjectT[] {
    const maxTextLength = 250
    const maxMessageCount = 7 // 最大何個の投稿を含めるか
    const untilSeconds = 120 // 最大何秒前の投稿まで含めるか
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

function getPrompt(messages: MessageObjectT[], channel: ChannelObjectT): string {
    const userNames = new Set([myName])
    messages.forEach((message) => {
        if (message.user) {
            userNames.add(getUserName(message))
        }
    })

    let prompt = `Please respond to the conversation given after '--'.
Make sure your response is in one sentence.
Use feminine and polite language, and words like 'ですわ', 'ますわ', 'ませんわ', 'ましたわ', 'でしたわ', 'でしょうね' when appropriate.
The conversation is between ${userNames.size} users, with each line formatted as '[UserName]:Statement' and your user name is '${myName}'.
When you refer to yourself in your response, use 私.

--
`
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of messages.reverse()) {
        const userName = getUserName(message)
        const text = message.text?.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^\s+/, "").replace(/\s+$/, "")
        prompt += `[${userName}]:${text}\n`
    }
    prompt += `[${myName}]:`
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
        if (!targetChannelIds.includes(channelId)) {
            return
        }
        if (map_id_to_channel[channelId] == null) {
            try {
                const response = await get("channel/show", {
                    id: channelId,
                })
                const data = JSON.parse(response)
                if (data.ok == false) {
                    throw new Error("Channel not found")
                }
                const { channel } = data
                map_id_to_channel[channelId] = channel
            } catch (error) {
                console.error(error)
            }
        }
        try {
            const response = await get("timeline/channel", {
                channel_id: channelId,
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
            const channel = map_id_to_channel[channelId]
            if (channel == null) {
                return
            }
            lastMessageId = contextMessages[0].id
            const prompt = getPrompt(contextMessages, channel)
            console.group("Prompt:")
            console.log(prompt)
            console.groupEnd()
            const answer = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                max_tokens: 256,
                temperature: 0.5,
            })
            if (answer.data.choices.length > 0) {
                const obj = answer.data.choices[0]
                if (obj.text) {
                    const text = obj.text
                        .replace(/^\n+/, "")
                        .replace(/\n+$/, "")
                        .replace(/^\s+/, "")
                        .replace(/\s+$/, "")
                    console.group("Completion:")
                    console.log(text)
                    console.groupEnd()
                    await post("message/post", {
                        channel_id: channelId,
                        text: text,
                    })
                }
            }
        } catch (error) {
            console.error(error)
            try {
                await post("message/post", {
                    channel_id: 4,
                    text: "エラー",
                })
            } catch (error) {
                console.dir(error)
                console.error(error)
            }
        }
    })
    ws.connect()
    try {
        for (const channelId of targetChannelIds) {
            await post("message/post", {
                channel_id: channelId,
                text: "起動しました",
            })
        }
    } catch (error) {
        console.error(error)
    }
}

const signals = [
    "SIGHUP",
    "SIGINT",
    "SIGQUIT",
    "SIGILL",
    "SIGTRAP",
    "SIGABRT",
    "SIGBUS",
    "SIGFPE",
    "SIGUSR1",
    "SIGSEGV",
    "SIGUSR2",
    "SIGTERM",
]
signals.forEach(function (sig) {
    process.on(sig, function () {
        terminator(sig)
        console.log("signal: " + sig)
    })
})

function terminator(sig: string) {
    if (typeof sig === "string") {
        post("message/post", {
            channel_id: 4,
            text: "停止しました",
        }).then(() => {
            process.exit(1)
        })
    }
}

main()
