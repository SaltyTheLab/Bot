import { EmbedBuilder } from "discord.js";
import { welcomeChannelId } from "./channelids.js";
export async function GuildMemberRemove(member) {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0xa90000)
        .setDescription(`${member} has left the cave.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Joined the cave on:', value: member.joinedAt ? member.joinedAt.toISOString() : 'Unknown', inline: true });

    await welcomeChannel.send({ embeds: [embed] });
};