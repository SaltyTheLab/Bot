import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logRecentCommand } from '../Logging/recentcommands.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';


export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('Target user to warn')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the warning')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const nextpunishment = interaction.nextPunishment;
    const activewarnings = interaction.activeWarnings;
    if (!target) {
        return interaction.reply({ content: '⚠️ Could not find the user.', ephemeral: true });
    }

    let dmStatus = 'User was DMed.';

    // Embed sent to the warned user via DM
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${target.tag} was issued a warning`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you were given a warning in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${activewarnings}\``, inline: false }
        )
        .setTimestamp();

    try {
        await target.send({ embeds: [dmEmbed] });
    } catch {
        dmStatus = '⚠️ Could not DM the user.';
    }

    // Embed for the user who issued the command
    const commandEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${target.tag} was issued a warning`, iconURL: target.displayAvatarURL({ dynamic: true }) });

    // Embed for logging
    const logEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${interaction.user.tag} warned a member`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${activewarnings}\``, inline: false }
        )
        .setFooter({ text: dmStatus })
        .setTimestamp();

    // Log to moderation channel
    const logChannel = interaction.guild.channels.cache.get(mutelogChannelid);
    if (logChannel) {
        try {
            await logChannel.send({ embeds: [logEmbed] });
        } catch (err) {
            console.warn('⚠️ Failed to send log message:', err);
            return interaction.reply({ content: '⚠️ Failed to send to log channel.', ephemeral: true });
        }
    } else {
        console.warn('⚠️ Log channel not found.');
    }

    // Command response
    try {
        if (typeof interaction.reply === 'function') {
            await interaction.reply({ embeds: [commandEmbed] });
        } else if (interaction.channel) {
            await interaction.channel.send({ embeds: [commandEmbed] });
        }
    } catch (err) {
        console.warn('⚠️ Failed to send reply:', err);
    }

    // Logging locally
    logRecentCommand(`warn - ${target.tag} - ${reason} - issuer: ${interaction.user.tag}`);
}
