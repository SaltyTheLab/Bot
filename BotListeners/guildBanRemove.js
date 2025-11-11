import { EmbedBuilder } from "discord.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
import { getPunishments } from "../Database/databasefunctions.js";

export async function guildBanRemove(ban) {
    const user = ban.user
    const guild = ban.guild
    const banlogChannel = ban.client.channels.cache.get(guildChannelMap[guild.id].modChannels.banlogChannel);
    const punishments = await getPunishments(user.id, guild.id);
    const bans = punishments.filter(punishment => punishment.type === 'Ban');

    if (!banlogChannel) {
        console.warn('⚠️ Ban log channel not found for unban.');
        return;
    }
    const embed = new EmbedBuilder()
        .setColor(0x309eff)
        .setTitle('A member was unbanned')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setDescription([
            `**User**: ${user}`,
            `**Tag**: \`${user.tag}\``,
            `**Id**: \`${user.id}\`\n`,
            `**Reason**: \`${bans.length > 0 ? `Ban Command: ${bans[0].reason}` : 'No reasons provided'}\``
        ].join('\n'))
        .setTimestamp()

    await banlogChannel.send({ embeds: [embed] });
}