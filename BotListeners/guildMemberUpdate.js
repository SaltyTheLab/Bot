import { EmbedBuilder } from "discord.js";
import { guildModChannelMap } from "./Extravariables/channelconfiguration.js";
export async function guildMemberUpdate(oldMember, newMember) {
    const guildId = oldMember.guild.id;
    const guildChannels = guildModChannelMap[guildId]
    //abort if user is the same nickname
    if (oldMember.nickname === newMember.nickname) return;

    //get namelogchannel
    const logChannel = await oldMember.guild.channels.fetch(guildChannels.namelogChannel);
    if (!logChannel) {
        console.warn('⚠️ Name log channel not found.');
        return;
    }

    //variables to make it easier to read
    const oldNick = oldMember.nickname ?? oldMember.user.username;
    const newNick = newMember.nickname ?? newMember.user.username;

    //make embed
    const embed = new EmbedBuilder()
        .setThumbnail(newMember.user.displayAvatarURL())
        .setDescription(
            `<@${newMember.id}> **changed their nickname**\n\n` +
            `**Before:**\n${oldNick}\n\n` +
            `**After:**\n${newNick}`
        )
        .setTimestamp();

    //send embed
    await logChannel.send({ embeds: [embed] });
}