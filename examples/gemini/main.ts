import dotenv from "dotenv"
dotenv.config({ path: "examples/gemini/.env" })

import { WebSocketClient } from "../../websocket"
import { sleep } from "./utils"
import { targetChannelIds, retryLimit, waitNewMessagesUntil } from "./config"
import * as beluga from "../../beluga"
import { postResponse } from "./respond"
import { VertexAI } from "@google-cloud/vertexai"

const lock: { [key: number]: boolean } = {}

async function checkAuth() {
    const vertexAI = new VertexAI({
        // @ts-ignore
        project: process.env.PROJECT_ID,
        // @ts-ignore
        location: process.env.LOCATION,
    })
    const generativeModel = vertexAI.preview.getGenerativeModel({
        model: "gemini-pro",
    })
    const chat = generativeModel.startChat({
        generation_config: {
            temperature: 0.5,
        },
    })
    const result = await chat.sendMessageStream("hoge")
    let responseText = ""
    for await (const item of result.stream) {
        responseText += item.candidates[0].content.parts[0].text
    }
    console.log("Response:")
    console.log(responseText)
}

async function main() {
    try {
        await checkAuth()
    } catch (error) {
        return
    }
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
                    await sleep(10 * (n + 2))
                }
            }
        } catch (error) {
            console.error(error)
            succeeded = false
        }
        if (succeeded == false) {
            try {
                await beluga.sendPostRequest("message/post", {
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
