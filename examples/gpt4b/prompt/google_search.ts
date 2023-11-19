import { ChatPromptT } from "../types"
import { fetchGoogleSearchResults } from "../google_search"

export async function getGoogleSearchPrompt(searchTerms: string): Promise<ChatPromptT> {
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
    return [
        {
            role: "system",
            content: prompt,
        },
    ]
}
