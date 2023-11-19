import * as beluga from "./beluga"
import { findUrls } from "./utils"

export async function fetchSummarizedPageContent(url: string) {
    const res = JSON.parse(
        await beluga.sendGetRequest("/summarize_url_content", {
            url,
        })
    )
    console.log("res", res)
    if (res["ok"] == false) {
        return null
    }
    return {
        bodyText: res["bodyText"],
        description: res["description"],
        title: res["title"],
    }
}

export async function fetchSummaryOfFirstUrlInText(text: string): Promise<string[] | null[]> {
    const urls = findUrls(text)
    if (urls) {
        const url = urls[0]
        if (url.match(/(\.png|\.jpg|\.jpeg|\.webp)/)) {
            return [null, null]
        }
        const data = await fetchSummarizedPageContent(url)
        if (data) {
            if (data["bodyText"]) {
                return [url, data["bodyText"]]
            }
            return [url, data["description"]]
        }
    }
    return [null, null]
}
