import OAuth from "oauth"
import qs from "querystring"
import dotenv from "dotenv"
import { ChannelObjectT } from "object"
dotenv.config({ path: "examples/gpt4b/.env" })

const consumerKey = process.env.CONSUMER_KEY || ""
const consumerSecret = process.env.CONSUMER_SECRET || ""
const accessToken = process.env.ACCESS_TOKEN || ""
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""

console.log(consumerKey)
console.log(consumerSecret)
console.log(accessToken)
console.log(accessTokenSecret)

const mapChannelIdToChannelObject: { [id: number]: ChannelObjectT } = {}

const oauth = new OAuth.OAuth(
    "https://beluga.fm/api/oauth/request_token",
    "https://beluga.fm/api/oauth/access_token",
    consumerKey,
    consumerSecret,
    "1.0",
    null,
    "HMAC-SHA1"
)

export function sendPostRequest(methodUrl: string, body: any): Promise<any> {
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
export function sendGetRequest(methodUrl: string, query: any): Promise<any> {
    for (const key of Object.keys(query)) {
        if (query[key] == null) {
            delete query[key]
        }
    }
    const endpointBaseUrl = `https://beluga.fm/api/v1/${methodUrl}`
    const endpointUrl = new URL(endpointBaseUrl)
    endpointUrl.search = qs.stringify(query)
    return new Promise((resolve, reject) => {
        oauth.get(
            endpointUrl.toString(),
            accessToken,
            accessTokenSecret,
            function (error, data, res) {
                if (error) {
                    reject(error)
                } else {
                    resolve(data)
                }
            }
        )
    })
}

export async function fetchChannelData(channelId: number) {
    const response = await sendGetRequest("channel/show", {
        id: channelId,
    })
    const data = JSON.parse(response)
    if (data.ok == false) {
        throw new Error("Channel not found")
    }
    const { channel } = data
    mapChannelIdToChannelObject[channelId] = channel
}

export function getChannelData(channelId: number): ChannelObjectT {
    return mapChannelIdToChannelObject[channelId]
}
