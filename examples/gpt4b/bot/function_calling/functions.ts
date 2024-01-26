import { OpenAI } from "openai"

export type GptFunction = OpenAI.Chat.ChatCompletionTool["function"]

export const functions: GptFunction[] = [
    {
        name: "search_google",
        description:
            "This function is designed to take a user's input string, perform a Google search using this string, and return a JSON object that contains both the URL that best matches the search query and the content of that URL. However, try to answer as much as possible within the range of your own knowledge, and avoid calling this function as much as possible.",
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
    {
        name: "call_dalle3_api",
        description:
            "This function is used to invoke the DALLE3 API for the purpose of image generation. It accepts an instruction text provided by the user, which is then sent to DALLE3 to create and return an image based on these instructions. Please call this function upon receiving a request from the user.",
        parameters: {
            type: "object",
            properties: {
                instruction_text: {
                    type: "string",
                    description:
                        "The instruction text to be sent to DALLE3. This text should contain a description of the image that the user wants to generate in English.",
                },
            },
            required: ["instruction_text"],
        },
    },
]
