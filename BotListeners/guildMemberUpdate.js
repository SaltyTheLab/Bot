import { EmbedBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
export async function guildMemberUpdate(oldMember, newMember) {
    const guild = oldMember.guild;
    //abort if user is the same nickname
    if (oldMember.nickname === newMember.nickname) return;

    //get namelogchannel
    const logChannel = await guild.channels.fetch(guildChannelMap[guild.id].modChannels.namelogChannel);
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
        .setColor(0x4e85b6)
        .setDescription(
            `<@${newMember.id}> **changed their nickname**\n\n` +
            `**Before:**\n${oldNick}\n\n` +
            `**After:**\n${newNick}`
        )
        .setTimestamp();

    //send embed
    await logChannel.send({ embeds: [embed] });
}