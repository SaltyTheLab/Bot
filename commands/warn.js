import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";


const logchannelid = '1392889476686020700';

export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('reason')
        .setRequired(true)
    );
export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const logchannel = interaction.guild.channels.cache.get(logchannelid);
    //setup variables for decaying warns
    let dmstatus = 'User was dmed.';
    //check for repeated offenses and update embeds accordingly

    //build embed response after command
    const commandembed = new EmbedBuilder()
        .setAuthor({
            name: target.tag + ` was issued a warning`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        })
        .setColor(0xffff00)

    const dmembed = new EmbedBuilder()
        .setAuthor({
            name: `${target.tag} was issued a warning`,
            iconURL: `${target.displayAvatarURL()}`
        })
        .setColor(0xffff00)
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you were given a warning in Salty's Cave.`)
        .setFields(
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setTimestamp()

    const logembed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({
            name: interaction.user.tag + ` warned a member`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(target.displayAvatarURL())
        .setFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: dmstatus })
        .setTimestamp()

    if (logchannel)
        try {
            await logchannel.send({ embeds: [logembed] });
        } catch {
            return await interaction.reply({ content: 'I can not find mute logs.', ephemeral: true });
        }

    logRecentCommand(`warn: ${target.tag} - ${reason}- issuer: ${interaction.user.tag}`);
    target.send({ embeds: [dmembed] })
    if (interaction.replied || !interaction.reply) {
        // message-based (AutoMod)
        await interaction.channel.send({ embeds: [commandembed] });
    } else {
        await interaction.reply({ embeds: [commandembed] });
    }
}