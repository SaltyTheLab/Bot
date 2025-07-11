import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";

let warncounter = 0;

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
    const logchannelid = '1392889476686020700';
    const target = interaction.options.getUser('target')
    const reason = interaction.options.getString('reason')
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
            content: 'you do not have permission to use this command.', ephemeral: true
        });
    }
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

    let dmstatus = 'User was dmed.';
    try {
        await target.send({ embeds: [dmembed] });
    }
    catch {
        dmstatus = 'User was not dmed.'
    }
    const logchannel = interaction.guild.channels.cache.get(logchannelid);
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
            return interaction.reply({ content: 'I can not find mute logs.', ephemeral: true });
        }
    warncounter++;
    logRecentCommand(`warn #${warncounter} : ${target.tag} - ${reason}- issuer: ${interaction.user.tag}`);
    return interaction.reply({ embeds: [commandembed] })
}