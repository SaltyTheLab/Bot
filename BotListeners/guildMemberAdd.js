import { EmbedBuilder } from "discord.js";
import { welcomeChannelId } from "./channelids.js";
export async function GuildMemberAdd(member) {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`Welcome ${member} to the server!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Discord Join Date:', value: `\`${member.joinedAt.toISOString()}\``, inline: true });

    await welcomeChannel.send({ embeds: [embed] });
};