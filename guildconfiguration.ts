// messageConfigs: Record<string, { channelid: string; embeds: Array<EmbedObject>; reactions?: Array<string>; components?: Array<ActionRow> }>,
export interface GuildData {
    [guildId: string]: {
        xp: ((level: number) => number),
    }
}
export const guildChannelMap: GuildData = {
    "1231453115937587270": {
        xp: (level: number) => Math.round(((level - 1) ** 1.5 * 260 + 40) / 20) * 20,
    },
    "1347217846991851541": {
        xp: (level: number) => Math.round(((level - 1) ** 1.5 * 260 + 40) / 20) * 20,
    },
    "1410055430889275515": {
        xp: (level: number) => level * 0,
    },
    "1480302545938153767": {
        xp: (level: number) => Math.round(((level - 1) ** 1.5 * 260 + 40) / 20) * 20,
    }
}
export default guildChannelMap
