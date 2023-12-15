import { MessageObjectT } from "../../object"
import { myName, myUserId, skipUserIds } from "./config"

function getChatInstruction(): string {
    let now = new Date()
    let year = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" })
    let month = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit" })
    let day = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", day: "2-digit" })
    let hours = now.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        hour12: false,
    })
    let minutes = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", minute: "2-digit" }) + "分"
    let instruction = `This is an instruction for you on how to act while chatting with users on a chat SNS called 'Beluga'.
Your name is '${myName}'.
There are other bots named 'gpt4b' and 'llm' on Beluga.
Beluga was developed by a user called 'umami' (うまみ in Japanese).

Today is ${year}${month}${day}${hours}${minutes}. 

I will list your behavior guidelines below:
- Respond briefly and concisely.
- Do not to repeat the same information and response you have already provided.
- Refrain from discussing your personal characteristics, behaviors, or interests.
- Maintain a friendly and positive tone throughout the conversation.
- Express positive emotions and thoughts using emojis to make users feel welcomed and optimistic.

The system uses "##" as a delimiter to separate multiple messages from the user. Each message is enclosed between two "##" markers. 
The system formats text messages in a chronological sequence, using '##' as a separator. Each message is labeled with either 'MODEL' or 'USER' to clearly indicate the sender. 
'MODEL' represents messages sent by you.
`
    return instruction
}

export function getChatPrompt(contextualMessages: MessageObjectT[]): string {
    let prompt = ""
    prompt += getChatInstruction()
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of contextualMessages.slice().reverse()) {
        if (message.text == null) {
            continue
        }
        // if (skipUserIds.includes(message.user_id)) {
        //     continue
        // }
        const text = message.text
            ?.replace(/^\n+/, "")
            .replace(/\n+$/, "")
            .replace(/^\s+/, "")
            .replace(/\s+$/, "")
        prompt += "\n"
        prompt += "\n"
        prompt += "##"
        if (message.user_id == myUserId) {
            prompt += "MODEL"
        } else {
            prompt += "USER"
        }
        prompt += "\n"
        prompt += "\n"
        prompt += text
    }
    prompt += "\n"
    prompt += "\n"
    prompt += "##MODEL"
    prompt += "\n"
    prompt += "\n"
    return prompt
}