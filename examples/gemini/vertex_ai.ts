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
            top_p: 1.0,
        },
    })
    const result = await chat.sendMessage(prompt)
    let responseText = result.response.candidates[0].content.parts[0].text
    if (responseText == null) {
        return null
    }
    // for await (const item of result.response) {
    //     responseText += item.candidates[0].content.parts[0].text
    // }
    console.log("Response:")
    console.log(responseText)
    responseText = responseText
        .trim()
        .replace(/^##.+?/, "")
        .replace(/[\s]+##$/, "")
    const parts = responseText.split("##")
    return parts[0]
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
