import { ObjectId } from "mongodb";
export enum InteractionType { PING = 1, APPLICATION_COMMAND = 2, MESSAGE_COMPONENT = 3, APPLICATION_COMMAND_AUTOCOMPLETE = 4, MODAL_SUBMIT = 5 }
export enum ComponentType { ACTION_ROW = 1, BUTTON = 2, STRING_SELECT = 3, TEXT_INPUT = 4, USER_SELECT = 5, ROLE_SELECT = 6, MENTIONABLE_SELECT = 7, CHANNEL_SELECT = 8, SECTION = 9, TEXT_DISPLAY = 10, THUMBNAIL = 11, MEDIA_GALLERY = 12, FILE = 13, SEPARATOR = 14, CONTAINER = 17, LABEL = 18, FILE_UPLOAD = 19 }
export interface userObject {
    id: string,
    username: string,
    discriminator: string,
    global_name: string | null,
    avatar: string,
    bot?: boolean,
    system?: boolean,
    mfa_enabled: boolean,
    banner?: string | null,
    accent_color?: number | null,
    locale?: string,
    verified?: boolean,
    email?: string | null,
    flags?: number,
    premium_type?: number,
    public_flags?: number,
    avatar_decoration_data?: {
        asset: string,
        sku_id: string
    },
    collectibles?: { nameplate?: object },
    primary_guild?: {
        identity_guild_id: string | null,
        identity_enabled: boolean | null,
        tag: string | null,
        badge: string | null
    },
    communicationDisabledUntilTimestamp: number
}
export interface memberObject {
    user: userObject,
    nick?: string | null,
    avatar?: string | null,
    banner?: string | null,
    roles: string[],
    joined_at: string,
    premium_since?: string,
    deaf: boolean,
    mute: boolean,
    flags: number,
    pending?: boolean,
    permissions: string,
    communication_disabled_until?: string | null,
    avatar_decoration_data?: {
        asset: string,
        sku_id: string
    },
    guild_id: string
}
export interface roleObject {
    id: string,
    name: string,
    colors: {
        primary_color: number,
        secondary_color: number | null,
        tertiary_color: number | null
    },
    hoist: boolean,
    icon?: string | null,
    unicode_emoji?: string | null,
    position: number,
    permissions: bigint,
    managed: boolean,
    mentionable: boolean,
    tags?: {
        bot_id?: string,
        integration_id?: string,
        premium_subscriber?: null,
        subscription_listing_id?: string,
        available_for_purchase?: null,
        guild_connections?: null
    },
    flags: number
}
export interface selectOptions {
    label: string,
    value: string,
    description?: string,
    emoji?: { name: string },
    default?: boolean
}
export interface Note {
    _id: ObjectId,
    moderatorId: string,
    note: string,
    timestamp: number
}
export interface Punishment {
    _id: ObjectId | null,
    userId: string,
    moderatorId: string | null,
    reason: string | null,
    duration: number,
    timestamp: number,
    active: number,
    weight: number,
    type: string,
    channel: string,
    guildId: string,
    refrence: string | null
}
export interface guildEmbedIds { name: string, messageId: string }
export interface Button {
    type: ComponentType.BUTTON;
    custom_id?: string;
    style: number;
    label: string;
    emoji?: { id?: string; name: string; animated?: boolean };
    url?: string;
    disabled?: boolean;
}
export interface ActionRow { type: ComponentType, components: Array<Button> }
export interface channelObject {
    id: string,
    type: number,
    guild_id?: string,
    position?: number,
    permission_overwrites?: Array<{ id: string, type: number, allow: string, deny: string }>
    name?: string | null,
    topic?: string | null,
    nsfw?: boolean,
    last_message_id?: string | null,
    bitrate?: number,
    user_limit?: number,
    recipients?: userObject[],
    icon?: string | null,
    owner_id?: string,
    application_id?: string,
    managed?: boolean,
    parent_id?: string | null,
    last_pin_timestamp?: number,
    rtc_region?: string | null,
    video_quality_mode?: number,
    message_count?: number,
    member_count?: number,
    thread_metadata?: {
        archived: boolean,
        auto_archive_duration: number,
        locked: boolean,
        invitable?: boolean,
        create_timestamp?: number
    },
    member?: {
        id?: string,
        user_id?: string,
        join_timestamp: number,
        flags: number,
        member?: memberObject
    }
}
export interface reactionObject {
    count: number,
    count_details: object,
    me: boolean,
    me_burst: boolean,
    emoji: {
        id: string,
        name: string,
        roles?: Array<roleObject>,
        user?: userObject,
        require_colons: boolean,
        managed?: boolean,
        animated?: boolean,
        available?: boolean
    },
    burst_colors: Array<number>,
    guild_id: string,
    user_id: string,
    message_id: string
}
export interface messageObject {
    id: string,
    channel_id: string,
    author: userObject,
    content: string,
    timestamp: number,
    edited_timestamp: number | null,
    tts: boolean,
    member: memberObject,
    mention_everyone: boolean,
    mentions: Array<userObject>,
    mention_roles: Array<roleObject>,
    mention_channels: Array<channelObject>,
    attachments: Array<{
        id: string,
        filename: string,
        title?: string,
        description?: string,
        content_type?: string,
        size: number,
        url: string,
        proxy_url: string,
        height?: number | null,
        width?: number | null,
        ephemeral?: boolean,
        duration_secs?: number,
        waveform?: string,
        flags?: number
    }>,
    embeds: Array<EmbedObject>,
    reactions?: Array<{
        count: number,
        count_details: object,
        me: boolean,
        me_burst: boolean,
        emoji: {
            id: string,
            name: string,
            roles?: Array<roleObject>,
            user?: userObject,
            require_colons: boolean,
            managed?: boolean,
            animated?: boolean,
            available?: boolean
        },
        burst_colors: Array<number>,
        guild_id: string,
        user_id: string,
        message_id: string
    }>,
    nonce?: number | string,
    pinned: boolean,
    webhook_id?: string,
    type: number,
    activity?: {
        type: number,
        party_id?: string
    },
    application_id?: string,
    flags: number,
    message_refrence?: {
        type?: number,
        message_id?: string,
        channel_id?: string,
        guild_id?: string,
        fail_if_not_exists?: boolean
    },
    message_snapshots?: Array<messageObject>,
    interaction_metadata?: {
        id: string,
        type: InteractionType,
        user: userObject,
        authorizing_integration_owners: Record<string, string>,
        original_response_message_id?: string,
        target_user?: userObject,
        target_message_id?: string,
    },
    thread?: channelObject,
    components: Array<ActionRow>
    stickers_items?: Array<{
        id: string,
        pack_id?: string,
        name: string,
        description: string | null,
        tags: string,
        type: number,
        format_type: number,
        available?: boolean,
        guild_id?: string,
        user?: userObject,
        sort_value?: number
    }>,
    stickers?: Array<{
        id: string,
        pack_id?: string,
        name: string,
        description: string | null,
        tags: string,
        type: number,
        format_type: number,
        available?: boolean,
        guild_id?: string,
        user?: userObject,
        sort_value?: number
    }>,
    position?: number,
    resolved: {
        users?: Record<string, userObject>,
        members?: Record<string, memberObject>,
        roles?: Record<string, roleObject>,
        channels?: Record<string, channelObject>,
        messages?: Record<string, messageObject>,
        attachments?: Record<string, {
            id: string,
            filename: string,
            title?: string,
            description?: string,
            content_type?: string,
            size: number,
            url: string,
            proxy_url: string,
            height?: number | null,
            width?: number | null,
            ephemeral?: boolean,
            duration_secs?: number,
            waveform?: string,
            flags?: number
        }>
    },
    guild_id: string
}
export interface Invite {
    type: number;
    code: string;
    guild?: guildObject;
    channel: channelObject | null; // Can be null in certain contexts
    inviter?: userObject;
    target_type?: number;
    target_user?: userObject;
    approximate_presence_count?: number;
    approximate_member_count?: number;
    expires_at?: string | null; // Usually an ISO8601 string
    guild_scheduled_event?: {
        id: string;
        guild_id: string;
        channel_id: string | null;
        creator_id?: string | null;
        name: string;
        description?: string | null;
        scheduled_start_time: string; // ISO8601 string
        scheduled_end_time?: string | null; // Fixed naming (end_time vs start_end)
        privacy_level: number;
        status: number;
        entity_type: number; // This is usually an enum/number
        entity_metadata?: { location?: string }; // Metadata holds the location
        creator?: userObject;
        user_count?: number;
        image?: string | null;
        recurrence_rule?: {
            start: string;
            end: string | null;
            frequency: number;
            interval: number;
            by_weekday?: Array<number>;
            by_n_weekday?: Array<{ n: number; day: number }>;
            by_month?: Array<number>;
        };
    },
    flags?: number,
    roles?: Array<roleObject>,
    uses: number,
    max_users?: number,
    max_age?: number,
    temporary: boolean,
    created_at: number,
    guild_id: string
}
export interface guildObject {
    id: string,
    name: string,
    icon: string | null,
    icon_hash: string | null,
    splash: string | null,
    discovery_splash: string | null,
    owner?: boolean,
    owner_id: string,
    permissions?: string,
    region: string | null,
    afk_channel_id: string | null,
    afk_timeout: number,
    widget_enabled?: boolean,
    widget_channel_id?: string | null,
    verification_level: number,
    default_message_notifications: number,
    explicit_content_filter: number,
    roles: roleObject[]
    emojis: Array<{
        id: string,
        name: string,
        roles?: Array<roleObject>,
        user?: userObject,
        require_colons: boolean,
        managed?: boolean,
        animated?: boolean,
        available?: boolean
    }>,
    features: string[],
    mfa_level: number,
    application_id: string | null,
    system_channel_id: string | null,
    system_channel_flags: number,
    rules_channel_id: string | null,
    max_presences?: number | null,
    max_members?: number,
    vanity_url_code: string | null,
    description: string | null,
    banner: string | null,
    premium_tier: number,
    premium_subscription_count?: number,
    preferred_locale: Record<string, string>,
    public_updates_channel_id: string | null,
    max_video_channel_users?: number,
    approximate_member_count?: number,
    approximate_presence_count?: number,
    welcome_screen?: {
        description: string | null,
        welcome_channels: Array<{ channel_id: string, description: string, emoji_id: string | null, emoji_name: string | null }>
    },
    nsfw_level: number,
    stickers?: Array<{
        id: string,
        pack_id?: string,
        name: string,
        description: string | null,
        tags: string,
        type: number,
        format_type: number,
        available?: boolean,
        guild_id?: string,
        user?: userObject,
        sort_value?: number
    }>,
    premium_progress_bar_enabled: boolean,
    safety_alerts_channel_id: string | null,
    incidents_data: {
        invites_disabled_until: number | null,
        dms_disabled_until: number | null,
        dm_spam_detected_at?: number | null,
        raid_detected_at?: number | null
    }
}
export interface options {
    name: string,
    type?: number,
    description: string,
    required?: boolean,
    default_member_permissions?: string
    options?: Array<options>,
    contexts?: Array<number>,
    choices?: Array<{ name: string, value: string }>
}
export interface optionData { name: string, type: number, value: number | string, options: optionData[] }
export interface BaseInteraction<T> {
    id: string;
    type: InteractionType;
    data: T;
    application_id: string;
    token: string;
    version: number;
    guild_id: string;
    channel_id: string;
    member: memberObject;
    user: userObject;
    app_permissions: string;
    entitlements: Array<{ id: string, sku_id: string, application_id: string, user_id?: string, type: number }>;
    attachment_size_limit: number,
    message: messageObject
}
export interface AppCommandInteraction {
    type: InteractionType.APPLICATION_COMMAND
    id: string,
    name: string,
    options: Array<optionData>;
    resolved?: {
        users?: Record<string, userObject>,
        members?: Record<string, memberObject>,
        roles?: Record<string, roleObject>,
        channels?: Record<string, channelObject>,
        messages?: Record<string, messageObject>,
        attachments?: Record<string, {
            id: string,
            filename: string,
            title?: string,
            description?: string,
            content_type?: string,
            size: number,
            url: string,
            proxy_url: string,
            height?: number | null,
            width?: number | null,
            ephemeral?: boolean,
            duration_secs?: number,
            waveform?: string,
            flags?: number
        }>,
        options: Array<optionData>
        guild_id?: string,
        target_id?: string
    }
}
export interface MessageComponentInteraction {
    type: InteractionType.MESSAGE_COMPONENT
    options: Array<optionData>,
    custom_id: string,
    component_type: number,
    values: Array<string>,
    resolved?: {
        users?: Record<string, userObject>,
        members?: Record<string, memberObject>,
        roles?: Record<string, roleObject>,
        channels?: Record<string, channelObject>,
        messages?: Record<string, messageObject>,
        attachments?: Record<string, {
            id: string,
            filename: string,
            title?: string,
            description?: string,
            content_type?: string,
            size: number,
            url: string,
            proxy_url: string,
            height?: number | null,
            width?: number | null,
            ephemeral?: boolean,
            duration_secs?: number,
            waveform?: string,
            flags?: number
        }>
    }
}
export interface labelComponent { label: { type: ComponentType.LABEL, id?: number, label: string, description?: string, }, component: any }
export interface AttachmentObject {
    filename: string,
    title?: string,
    description?: string,
    content_type?: string,
    size: number,
    url: string,
    proxy_url: string,
    height?: number | null,
    width?: number | null,
    ephemeral?: boolean,
    duration_secs?: number,
    waveform?: string,
    flags?: number
}
export interface ModalComponentInteraction {
    type: InteractionType.MODAL_SUBMIT
    custom_id: string,
    values: Array<options>,
    components: Array<labelComponent>,
    resolved?: {
        users?: Record<string, userObject>,
        members?: Record<string, memberObject>,
        roles?: Record<string, roleObject>,
        channels?: Record<string, channelObject>,
        messages?: Record<string, messageObject>,
        attachments?: Record<string, AttachmentObject>
    }
}
export interface EmbedObject {
    title?: string,
    type?: string,
    author?: { name: string, icon_url?: string | null },
    thumbnail?: { url: string },
    description?: string,
    url?: string,
    color?: number,
    fields?: Array<{ name: string; value: string; inline?: boolean }>,
    footer?: { text: string },
    timestamp?: string,
    image?: { url: string, proxy_url?: string, height?: number, width?: number }
}
export interface AuditLogEntryObject {
    guild_id: string,
    target_id: string | null,
    user_id: string,
    id: string,
    action_type: number,
    message_id: string
    options: {
        auto_moderation_rule_name: string,
        auto_moderation_rule_trigger_type: string,
        channel_id: string,
    }
    reason?: string
}
export interface AuditLogObject { audit_log_entries: Array<AuditLogEntryObject> }
export interface Ready { v: 10, user: userObject, guilds: Array<guildObject>, session_id: string, resume_gateway_url: string, }
export interface Err { code: number, message: string, errors: unknown }