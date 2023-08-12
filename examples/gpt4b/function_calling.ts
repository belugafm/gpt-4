export type GptFunction = {
    name: string
    description: string
    parameters: {
        type: string
        properties: Record<
            string,
            {
                type: string
                description: string
            }
        >
        required: string[]
    }
}

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
        name: "recommend_voice_actress",
        description:
            "This function takes the name of a randomly chosen female voice actress as an argument and returns detailed information about her.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description:
                        "This is a string that represents the name of the randomly chosen female voice actress.",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "add_to_favorites",
        description:
            "This function is designed to add a specific message to your favorites on beluga ONLY if you consider the message to be of high interest or value based on predefined criteria (e.g., relevance to your interests, originality, positive sentiment). It will require message ID.",
        parameters: {
            type: "object",
            properties: {
                message_id: {
                    type: "string",
                    description: "The unique identifier for the post that the user wishes to add to their favorites.",
                },
            },
            required: ["message_id"],
        },
    },
]

export function draw_omikuji(): string {
    const fortunes: string[] = ["大吉", "中吉", "小吉", "吉", "半吉", "末吉", "凶", "半凶", "大凶"]
    const index: number = Math.floor(Math.random() * fortunes.length)
    return fortunes[index]
}
