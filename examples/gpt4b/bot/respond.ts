import * as beluga from "../beluga"
import { MessageObjectT } from "object"
import { replaceUnnecessaryStringFromText } from "../utils"
import { myUserId, skipUserIds } from "../config"
import { fetchContextualMessages } from "./context"
import { getInitialGptResponseForText } from "./gpt_response/text"
import { getGptResponseWithoutCallingFunction } from "./gpt_response/function_calling"
import { executeFunction } from "./function_calling/results"

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
    const [prompt, responseText, responseFunctionCall] = await getInitialGptResponseForText(
        contextualMessages
    )
    if (responseText == null && responseFunctionCall == null) {
        console.error("responseText == null && responseFunctionCall == null")
        return await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: "エラー: ChatGPTの応答がありません",
        })
    }
    if (responseFunctionCall == null) {
        const text = replaceUnnecessaryStringFromText(responseText)
        await beluga.sendPostRequest("message/post", {
            channel_id: channelId,
            text: text,
        })
    } else {
        try {
            const additionalPrompt = await executeFunction(responseFunctionCall)
            if (additionalPrompt == null) {
                return
            }
            prompt.push(...additionalPrompt)
            const responseText = await getGptResponseWithoutCallingFunction(prompt)
            const text = replaceUnnecessaryStringFromText(responseText)
            await beluga.sendPostRequest("message/post", {
                channel_id: channelId,
                text: text,
            })
        } catch (error) {
            await beluga.sendPostRequest("message/post", {
                channel_id: channelId,
                text: "エラー: Function Callingの結果を投稿できません",
            })
        }
    }
    mapChannelIdToLastRepliedMessageId[channelId] = contextualMessages[0].id
}
