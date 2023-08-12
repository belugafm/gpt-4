import puppeteer from "puppeteer"
import { sleep } from "./utils"
import * as cheerio from "cheerio"

export async function fetchPageContent(url: string) {
    const retryCount = 3
    for (let index = 0; index < retryCount; index++) {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            })
            const page = await browser.newPage()
            await page.goto(url, { waitUntil: "domcontentloaded" })
            await sleep(5)
            const content = await page.content()
            await browser.close()

            // const response = await axios.get(url)
            const $ = cheerio.load(content)
            $("style").remove()
            $("script").remove()
            $("noscript").remove()
            $("ul").remove()
            $("nav").remove()
            $("header").remove()
            $("form").remove()
            $("footer").remove()
            $("iframe").remove()
            const title = $("title").text()
            const metaTags = $("meta")
            const meta: Record<string, string> = {}
            metaTags.each(function () {
                const name = $(this).attr("name")
                const content = $(this).attr("content")
                if (name && content) {
                    meta[name] = content
                }
            })
            let bodyText = $("body").text().replace(/\s+/g, " ").replace(/\n/g, "").replace(/"/g, "")
            console.log(bodyText)
            console.log("length", bodyText.length)
            return {
                bodyText,
                title,
                meta,
            }
        } catch (error) {
            console.error(`Error fetching content from ${url}: `, error)
            await sleep(3)
        }
    }
    return null
}
