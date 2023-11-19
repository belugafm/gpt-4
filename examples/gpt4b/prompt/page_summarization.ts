import { ChatPromptT } from "../types"

export function getPageSummarizationPrompt(
    title: string,
    description: string,
    bodyText: string
): ChatPromptT {
    const englishCharacterPattern = /[A-Za-z0-9\s!"#$%&'()’*+,\-.\/:;<=>?@[\\\]^_`{|}~]/g
    const matches = bodyText.match(englishCharacterPattern)
    const numEnglishChars = matches ? matches.length : 0
    const englishRatio = numEnglishChars / bodyText.length
    const maxLength = (englishRatio > 0.95 ? 5000 : 1000) - description.length - title.length
    if (bodyText.length > maxLength) {
        bodyText = bodyText.substring(0, maxLength)
    }
    const instruction = `I would like your help to summarize the following webpage content into approximately 1000 words in Japanese.

- Title: '${title}'
- Description: '${description}'
- Body Text: '${bodyText}'

##

Please note that if the body text does not seem to relate to the description, you should ignore the body text and generate a summary based only on the title and description.
Do not mention that you ignored the body text.
Given this information, could you generate a concise summary of the main points and key details in Japanese?
`
    return [
        {
            role: "system",
            content: instruction,
        },
    ]
}
