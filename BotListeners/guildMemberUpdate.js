import { EmbedBuilder } from "discord.js";
import guildChannelMap from "../Extravariables/guildconfiguration.js";
export async function guildMemberUpdate(oldMember, newMember) {
    if (oldMember.nickname === newMember.nickname) return;
    const logChannel = oldMember.client.channels.cache.get(guildChannelMap[oldMember.guild.id].modChannels.namelogChannel);
    if (!logChannel) { console.warn('⚠️ Name log channel not found.'); return; }
    const oldNick = oldMember.nickname ?? oldMember.user.username;
    const newNick = newMember.nickname ?? newMember.user.username;
    await logChannel.send({
        embeds: [new EmbedBuilder({
            thumbnail: { url: newMember.author.displayAvatarURL() },
            color: 0x4e85b6,
            description: `<@${newMember.id}> **changed their nickname**\n\n` +
                `**Before:**\n${oldNick}\n\n` +
                `**After:**\n${newNick}`,
            timestamp: Date.now()
        })]
    });
}