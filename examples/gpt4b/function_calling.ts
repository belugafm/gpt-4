import { OpenAI } from "openai"

export type GptFunction = OpenAI.Chat.ChatCompletionTool["function"]

export const functions: GptFunction[] = [
    {
        name: "search_google",
        description:
            "This function is designed to take a user's input string, perform a Google search using this string, and return a JSON object that contains both the URL that best matches the search query and the content of that URL.",
        parameters: {
            type: "object",
            properties: {
                search_query: {
                    type: "string",
                    description:
                        "This is the string input by the user that we want to search for on Google. This should be a string of text that represents the user's search query.",
                },
            },
            required: ["search_query"],
        },
    },
    {
        name: "get_instruction",
        description:
            "This function retrieves the instruction given to you. It can be invoked when a user asks about your character, behavior, or any directives you have been provided with.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "draw_omikuji",
        description:
            "This function simulates the act of drawing an omikuji, a traditional Japanese fortune-telling method. When called, it randomly selects a fortune from a predefined list and returns it.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "add_to_favorites",
        description:
            "This function is designed to add a specific message to your favorites on beluga. If you find the message interesting or humorous, please call this function.",
        parameters: {
            type: "object",
            properties: {
                message_id: {
                    type: "string",
                    description:
                        "The unique identifier for the message that you wish to add to your favorites.",
                },
            },
            required: ["message_id"],
        },
    },
]

export function drawOmikuji(): string {
    const fortunes: string[] = ["大吉", "中吉", "小吉", "吉", "半吉", "末吉", "凶", "半凶", "大凶"]
    const index: number = Math.floor(Math.random() * fortunes.length)
    return fortunes[index]
}
