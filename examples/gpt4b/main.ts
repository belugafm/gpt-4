import dotenv from "dotenv"
dotenv.config({ path: "examples/gpt4b/.env" })

import { WebSocketClient } from "../../websocket"
import { sleep } from "./utils"
import { targetChannelIds, retryLimit, waitNewMessagesUntil } from "./config"
import * as beluga from "../../beluga"
import { postResponse } from "./bot/respond"

const lock: { [key: number]: boolean } = {}

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
