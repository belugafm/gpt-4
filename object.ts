export type MessageId = number
export type UserId = number
export type ChannelId = number
export type ChannelGroupId = number
export type FileId = number

export type UserObjectT = {
    id: UserId
    name: string
    display_name: string | null
    profile_image_url: string | null
    location: string | null
    url: string | null
    description: string | null
    created_at: Date
    message_count: number
    favorites_count: number
    favorited_count: number
    bot: boolean
    active: boolean
    dormant: boolean
    suspended: boolean
    muted: boolean
    blocked: boolean
    trust_level: number
    last_activity_date: Date | null
}

export type ChannelGroupObjectT = {
    id: ChannelGroupId
    name: string
    unique_name: string
    description: string | null
    image_url: string | null
    created_at: Date
    created_by: UserId
    level: number
    channels_count: number
    message_count: number
    creator: UserObjectT | null
    last_message_created_at: number | null
    last_message_id: MessageId | null
    parent_id: number | null
    parent: ChannelGroupObjectT | null
    minimum_trust_rank: string
}

export type ChannelReadStateObjectT = {
    id: number
    channel_id: number
    user_id: UserId
    last_message_id: MessageId | null
    last_message_created_at: number | null
    last_message: MessageObjectT | null
}

export type ChannelObjectT = {
    id: ChannelId
    name: string
    unique_name: string
    parent_channel_group_id: number
    parent_channel_group: ChannelGroupObjectT | null
    created_by: UserId
    created_at: Date
    message_count: number
    description: string
    status_string: string
    last_message_id: MessageId | null
    last_message_created_at: number | null
    last_message: MessageObjectT | null
    read_state: ChannelReadStateObjectT | null
    minimum_trust_rank: string
}

export const MessageEntityStyleFormat = {
    BOLD: 1,
    ITALIC: 1 << 1,
    STRIKETHROUGH: 1 << 2,
    UNDERLINE: 1 << 3,
    CODE: 1 << 4,
    SUBSCRIPT: 1 << 5,
    SUPERSCRIPT: 1 << 6,
} as const

export type MessageEntityStyleNode = {
    children: MessageEntityStyleNode[]
    type: string
    style: {
        format: number
        color: string | null
    } | null
    indices: number[]
    text?: string
    language?: string
}

export type MessageEntityFileNode = {
    file_id: FileId
    file: FileObjectT | null
    indices: [number, number]
}

export type MessageObjectT = {
    id: MessageId
    channel_id: ChannelId
    channel: ChannelObjectT | null
    user_id: UserId
    user: UserObjectT | null
    text: string | null
    created_at: Date
    favorite_count: number
    favorited: boolean
    like_count: number
    reply_count: number
    thread_id: MessageId | null
    last_reply_message_id: MessageId | null
    last_reply_message_created_at: Date | null
    deleted: boolean
    _internal_updated_at: number // for React
    entities: {
        channel_groups: {
            channel_group_id: ChannelGroupId
            channel_group: ChannelGroupObjectT | null
            indices: [number, number]
        }[]
        channels: {
            channel_id: ChannelId
            channel: ChannelObjectT | null
            indices: [number, number]
        }[]
        messages: {
            message_id: MessageId
            message: MessageObjectT | null
            indices: [number, number]
        }[]
        files: MessageEntityFileNode[]
        favorited_users: UserObjectT[]
        favorited_user_ids: UserId[] // 正規化用
        style: MessageEntityStyleNode[]
    }
}

export type FileObjectT = {
    id: FileId
    user_id: UserId
    group: string
    url: string
    type: string
    bytes: number
    original: boolean
    ref_count: number
    created_at: Date
    width: number | null
    height: number | null
    tag: string | null
}

export type ApplicationObjectT = {
    id: number
    user_id: UserId
    name: string
    callback_url: string
    description: string | null
}
