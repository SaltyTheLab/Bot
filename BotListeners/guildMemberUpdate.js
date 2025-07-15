import { EmbedBuilder } from "discord.js";
import { nameLogChannelId } from "./channelids.js";
export async function GuildMemberUpdate(oldMember, newMember) {
    if (oldMember.nickname === newMember.nickname) return;

    const logChannel = newMember.guild.channels.cache.get(nameLogChannelId);
    if (!logChannel) {
        console.warn('⚠️ Name log channel not found.');
        return;
    }

    const oldNick = oldMember.nickname ?? oldMember.user.username;
    const newNick = newMember.nickname ?? newMember.user.username;

    const embed = new EmbedBuilder()
        .setThumbnail(newMember.user.displayAvatarURL())
        .setDescription(
            `<@${newMember.id}> **changed their nickname**\n\n` +
            `**Before:**\n${oldNick}\n\n` +
            `**After:**\n${newNick}`
        )
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
}