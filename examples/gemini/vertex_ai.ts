import { MessageObjectT } from "../../object"
import { getChatPrompt } from "./prompt"
import { VertexAI } from "@google-cloud/vertexai"

export async function getResponseForText(prompt: string): Promise<any> {
    console.log("Prompt:")
    console.log(prompt)

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
            temperature: 0.9,
        },
    })
    const result = await chat.sendMessageStream(prompt)
    let responseText = ""
    for await (const item of result.stream) {
        responseText += item.candidates[0].content.parts[0].text
    }
    console.log("Response:")
    console.log(responseText)
    responseText = responseText.replace(/^##[\s]+/, "")
    return responseText
}

export async function getResponseForMessages(contextualMessages: MessageObjectT[]): Promise<any> {
    if (contextualMessages.length == 0) {
        return null
    }
    const latestMessage = contextualMessages[0]
    if (latestMessage.text == null) {
        return null
    }

    const prompt = getChatPrompt(contextualMessages)
    return getResponseForText(prompt)
}
