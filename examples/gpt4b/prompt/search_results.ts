import { ChatPromptT } from "../types"

export function getSearchQueryAnsweringPrompt(searchTerms: string, bodyText: string): ChatPromptT {
    bodyText = bodyText.substring(0, 1000)
    const instruction = `Search results for "${searchTerms}":
${bodyText}
##    
Could you generate a concise summary of the search results in Japanese?
`
    return [
        {
            role: "system",
            content: instruction,
        },
    ]
}

export function getSummarizedTextPrompt(url: string, text: string): ChatPromptT {
    return [
        {
            role: "system",
            content: `Here is the summarized content of '${url}':
${text}
`,
        },
    ]
}
