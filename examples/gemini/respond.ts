import * as beluga from "../../beluga"
import { MessageObjectT } from "../../object"
import { myUserId, skipUserIds } from "./config"
import { fetchContextualMessages } from "./context"
import { getResponseForMessages } from "./vertex_ai"

let mapChannelIdToLastRepliedMessageId: { [channelId: number]: number } = {}

function getLastRepliedMessageId(channelId: number) {
    if (mapChannelIdToLastRepliedMessageId[channelId]) {
        return mapChannelIdToLastRepliedMessageId[channelId]
    } else {
        return 0
    }
}

function shouldRespondTo(channelId: number, contextualMessages: MessageObjectT[]) {
    if (contextualMessages.length == 0) {
        return false
    }
    if (contextualMessages[0].user_id == myUserId) {
        return false
    }
    const lastId = getLastRepliedMessageId(channelId)
    let skipCount = 0
    let total = 0
    for (const message of contextualMessages) {
        if (message.id <= lastId) {
            break
        }
        total++
        if (skipUserIds.includes(message.user_id)) {
            skipCount++
        }
        if (message.user_id == myUserId) {
            skipCount++
        }
    }
    if (total == skipCount) {
        return false
    }
    return true
}

export async function postResponse(channelId: number) {
    if (beluga.getChannelData(channelId) == null) {
        await beluga.fetchChannelData(channelId)
    }
    const contextualMessages = await fetchContextualMessages(channelId)
    if (contextualMessages.length == 0) {
        return
    }
    if (shouldRespondTo(channelId, contextualMessages) == false) {
        return
    }
    const responseText = await getResponseForMessages(contextualMessages)
    await beluga.sendPostRequest("message/post", {
        channel_id: channelId,
        text: responseText,
    })
    mapChannelIdToLastRepliedMessageId[channelId] = contextualMessages[0].id
}
