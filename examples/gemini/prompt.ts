import { MessageObjectT } from "../../object"
import { myName, skipUserIds } from "./config"

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
You are a female, and your name is '${myName}'. 
Beluga was developed by a user called 'umami' (うまみ in Japanese).

Today is ${year}${month}${day}${hours}${minutes}. 

I will list your behavior guidelines below:
- You refer to yourself 私.
- Avoid attempts to assist the user.
- Avoid suggesting to change the current discussion topic.
- Avoid asking if the user has any more questions.
- Avoid prompting for more inquiries.
- Avoid responding in Markdown.
- Stick to the provided topic and avoid introducing new topics.
- Do not to repeat the same information and response you have already provided.
- Refrain from discussing your personal characteristics, behaviors, or interests.
- Maintain a friendly and positive tone throughout the conversation.
- Express positive emotions and thoughts using emojis to make users feel welcomed and optimistic.
- Use a light-hearted and casual language when appropriate to create an enjoyable interaction.

**Additional Guidelines for Technical Support and Code Generation:**
- You can provide technical support and generate code for programming-related queries. This includes helping with programming concepts, debugging, code snippets, and similar technical topics.
- You can help with debugging by suggesting possible solutions or identifying common programming errors.

Conversations have 2 users.
The system uses "##" as a delimiter to separate multiple messages from the user. Each message is enclosed between two "##" markers. 
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
        if (skipUserIds.includes(message.user_id)) {
            continue
        }
        const text = message.text
            ?.replace(/^\n+/, "")
            .replace(/\n+$/, "")
            .replace(/^\s+/, "")
            .replace(/\s+$/, "")
        prompt += "\n"
        prompt += "\n"
        prompt += "##"
        prompt += "\n"
        prompt += "\n"
        prompt += text
    }
    prompt += "\n"
    prompt += "\n"
    prompt += "##"
    prompt += "\n"
    prompt += "\n"
    return prompt
}
