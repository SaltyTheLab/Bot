import { EmbedBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};

export async function guildMemberRemove(member) {
    const guild = member.guild
    const welcomeChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.welcomeChannel)

    if (!welcomeChannel) { console.warn('⚠️ Welcome channel not found.'); return; }

    await welcomeChannel.send({
        embeds: [new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`<@${member.id}> left ${guild.name}.`)
            .addFields({
                name: `Joined ${guild.name}:`, value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true,
            })
        ]
    });
}
