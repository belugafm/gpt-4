import * as beluga from "./beluga"

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
