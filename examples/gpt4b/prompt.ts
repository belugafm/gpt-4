import { MessageObjectT } from "../../object"
import { myName } from "./config"
import { getChatInstruction } from "./instruction"
import { PromptT } from "./types"
import { getUserNameFromMessage, splitTextIntoStringsAndImages } from "./utils"
import { fetchGoogleSearchResults } from "./google_search"

export function getChatPrompt(contextualMessages: MessageObjectT[]): PromptT {
    console.group("getChatPrompt")
    const userNames = new Set([myName])
    contextualMessages.forEach((message) => {
        if (message.user) {
            userNames.add(getUserNameFromMessage(message))
        }
    })
    let chat = []
    chat.push({
        role: "system",
        content: getChatInstruction(contextualMessages),
    })
    // messagesは降順（最新の投稿が[0]に入っているので逆順で処理する
    for (const message of contextualMessages.slice().reverse()) {
        const userName = getUserNameFromMessage(message)
        if (message.text == null) {
            continue
        }
        const text = message.text?.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^\s+/, "").replace(/\s+$/, "")
        if (userName == myName) {
            chat.push({
                role: "assistant",
                content: text,
            })
        } else {
            const chunks = splitTextIntoStringsAndImages(text)
            const content = []
            for (const chunk of chunks) {
                if (chunk["type"] == "text") {
                    const text = chunk["text"]
                    content.push({
                        type: "text",
                        text: `[name=${userName}, message_id=${message.id}]:${text}`,
                    })
                }
                if (chunk["type"] == "image_url") {
                    const url = chunk["image_url"]
                    content.push({
                        type: "image_url",
                        image_url: url,
                    })
                }
            }
            console.log("content:")
            console.log(content)
            chat.push({
                role: "user",
                content: content,
            })
        }
    }
    console.log("chat:")
    console.log(chat)
    console.groupEnd()
    return chat
}

export function getPageSummarizationPrompt(title: string, description: string, bodyText: string): PromptT {
    const englishCharacterPattern = /[A-Za-z0-9\s!"#$%&'()’*+,\-.\/:;<=>?@[\\\]^_`{|}~]/g
    const matches = bodyText.match(englishCharacterPattern)
    const numEnglishChars = matches ? matches.length : 0
    const englishRatio = numEnglishChars / bodyText.length
    console.log("englishRatio", englishRatio)
    const maxLength = (englishRatio > 0.95 ? 5000 : 1000) - description.length - title.length
    if (bodyText.length > maxLength) {
        bodyText = bodyText.substring(0, maxLength)
    }
    let chat = []
    let instruction = `I would like your help to summarize the following webpage content into approximately 1000 words in Japanese.

- Title: '${title}'
- Description: '${description}'
- Body Text: '${bodyText}'

##

Please note that if the body text does not seem to relate to the description, you should ignore the body text and generate a summary based only on the title and description.
Do not mention that you ignored the body text.
Given this information, could you generate a concise summary of the main points and key details in Japanese?
`
    chat.push({
        role: "system",
        content: instruction,
    })
    return chat
}

export function getSearchQueryAnsweringPrompt(searchTerms: string, bodyText: string): PromptT {
    bodyText = bodyText.substring(0, 1000)
    let chat = []
    let instruction = `Search results for "${searchTerms}":
${bodyText}
##    
Could you generate a concise summary of the search results in Japanese?
`
    chat.push({
        role: "system",
        content: instruction,
    })
    return chat
}

export async function getGoogleSearchPrompt(searchTerms: string): Promise<PromptT> {
    const url_list = await fetchGoogleSearchResults(searchTerms)
    const words = searchTerms.trim().split(" ")
    let searchTermList = ""
    for (let i = 0; i < words.length; i++) {
        searchTermList += "- " + words[i] + "\n"
    }
    const prompt = `
The following is a list of URL and title pairs for web pages:
##
${url_list}
  
Given the search keywords '${searchTerms}' and the list of URL-title pairs representing search results, please find the URL that most closely matches the user's request based on the query string.
It's important to note that partial matches are not only acceptable but encouraged. It is not necessary to find a perfect match. Ignore some search terms if needed.
Exclude any information other than the URL in the response and output only one URL.
`
    console.log(prompt)
    let chat = [
        {
            role: "system",
            content: prompt,
        },
    ]
    return chat
}

export function getSummarizedTextPrompt(url: string, text: string) {
    return [
        {
            role: "system",
            content: `Here is the summarized content of '${url}':
${text}
`,
        },
    ]
}
