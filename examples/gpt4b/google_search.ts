import * as cheerio from "cheerio"
import puppeteer from "puppeteer"
import { sleep } from "./utils"

export async function fetchGoogleSearchResults(query: string): Promise<string> {
    let url_list = ""
    const url = "https://www.google.com/search?q=" + encodeURI(query)
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await sleep(2)
    const content = await page.content()
    await browser.close()

    // const response = await axios.get(url)
    const $ = cheerio.load(content)
    const links = $("a")
    links.each((k, link) => {
        if (url_list.length > 1500) {
            return
        }
        const url = link.attribs.href
        if (url == null) {
            return
        }
        if (url.indexOf(".pdf") != -1) {
            return
        }
        if (url.indexOf("http") != 0) {
            return
        }
        if (url.indexOf("google.com") >= 0) {
            return
        }
        const text = $(link).text()
        console.log(url, text)
        url_list += `url: ${url}\ntitle: ${text}\n##\n`
    })
    return url_list
}
