import { WebSocketClient } from "../../websocket"
import { sleep } from "./utils"
import { targetChannelIds, retryLimit, waitNewMessagesUntil } from "./config"
import * as beluga from "./beluga"
import { postResponse } from "./behaviour"

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
    try {
        for (const channelId of targetChannelIds) {
            await beluga.sendPostRequest("message/post", {
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
        beluga
            .sendPostRequest("message/post", {
                channel_id: targetChannelIds[0],
                text: "停止しました",
            })
            .then(() => {
                process.exit(1)
            })
    }
}

main()
