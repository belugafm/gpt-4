import { getGoogleSearchPrompt } from "../../prompt/google_search"
import { getChatCompletionResult } from "../openai"
import { findUrls } from "../../utils"
import { fetchSummarizedPageContent } from "../../url_contents"
import { getSearchQueryAnsweringPrompt } from "../../prompt/search_results"

export async function tryGetGptResponseForGoogleSearch(
    searchTerms: string
): Promise<[string, string]> {
    const [urlRecommendation] = await getChatCompletionResult({
        model: "gpt-3.5-turbo",
        messages: await getGoogleSearchPrompt(searchTerms),
        max_tokens: 2048,
        temperature: 0.0,
        frequency_penalty: 0.0,
    })
    if (urlRecommendation == null) {
        throw new Error("urlRecommendation is null")
    }
    const urls = findUrls(urlRecommendation)
    if (urls == null) {
        throw new Error("urls is null")
    }
    const url = urls[0]
    const data = await fetchSummarizedPageContent(url)
    if (data == null) {
        throw new Error("fetchSummarizedPageContent failed. `data` is null")
    }
    if (data["description"] == null && data["bodyText"] == null) {
        throw new Error("`data.description` is null")
    }
    const urlDescription = data["bodyText"] ? data["bodyText"] : data["description"]
    const [answerText] = await getChatCompletionResult({
        model: "gpt-3.5-turbo",
        messages: getSearchQueryAnsweringPrompt(searchTerms, urlDescription),
        max_tokens: 2048,
        temperature: 0.5,
        frequency_penalty: 0.5,
    })
    if (answerText == null) {
        throw new Error("`answerText` is null")
    }
    return [url, answerText]
}
