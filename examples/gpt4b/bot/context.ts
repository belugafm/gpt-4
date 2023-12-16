import * as beluga from "../../../beluga"
import { MessageObjectT } from "../../../object"
import { skipUserIds } from "../config"

function getContextualMessagesFromTimeline(messages: MessageObjectT[]): MessageObjectT[] {
    let startIndex = 0
    for (const message of messages) {
        if (!skipUserIds.includes(message.user_id)) {
            break
        }
        startIndex++
    }
    const messagesFromHuman = messages.slice(startIndex)
    const maxTextLength = 500
    const maxMessageCount = 4 // 最大何個の投稿を含めるか
    const untilSeconds = 60 * 60 * 6 // 最大何秒前の投稿まで含めるか
    const ret: MessageObjectT[] = []
    let sumTextLength = 0
    let latestCreatedAt = 0
    for (const message of messagesFromHuman) {
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

export async function fetchContextualMessages(channelId: number): Promise<MessageObjectT[]> {
    const response = await beluga.sendGetRequest("timeline/channel", {
        channel_id: channelId,
    })
    const data = JSON.parse(response)
    // 中身は降順になっている
    return getContextualMessagesFromTimeline(data.messages)
}
