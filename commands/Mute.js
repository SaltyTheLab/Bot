import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logRecentCommand } from '../Logging/recentcommands.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { getWarns, addMute } from '../Logging/database.js';
export const data = new SlashCommandBuilder()

    .setName('mute')
    .setDescription('Mute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('Target user')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for mute')
            .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt.setName('duration')
            .setDescription('Mute duration')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('unit')
            .setDescription('Duration unit')
            .setRequired(true)
            .addChoices(
                { name: 'Minute', value: 'm' },
                { name: 'Hour', value: 'h' },
                { name: 'Day', value: 'd' }
            )

    );


export async function execute(interaction) {

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const duration = interaction.options.getInteger('duration');
    const unit = interaction.options.getString('unit');

    const MAX_TIMEOUT_MS = 2419200000;

    const unitMap = {
        m: 60000,
        h: 3600000,
        d: 86400000
    };

    let timeMs = duration * unitMap[unit];
    if (!timeMs || timeMs <= 0) {
        return interaction.editReply({ content: '❌ Invalid mute duration.' });
    }
    if (timeMs > MAX_TIMEOUT_MS)
        timeMs = MAX_TIMEOUT_MS;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        return interaction.editReply({ content: '❌ User not found in the server.' });
    }

    if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
        return interaction.editReply({ content: '⚠️ User is already muted.' });
    }
    addMute(target.id, interaction.user.id, reason, timeMs);
    const updatedWarnings = await getWarns(target.id);
    const nextpunishment = getNextPunishment(updatedWarnings.length)
    // Prepare embeds first
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you have been issued a \`${duration} ${unit} mute\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings:", value: `\`${updatedWarnings.length}\``, inline: false }
        )
        .setTimestamp();

    const commandEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({
            name: `${target.tag} was issued a ${duration}${unit} mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        });

    const logEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setThumbnail(target.displayAvatarURL())
        .setAuthor({
            name: `${interaction.user.tag} muted a member`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings:", value: `\`${updatedWarnings.length}\``, inline: false }
        )
        .setTimestamp();

    // DM the user
    let dmStatus = 'User was DMed.';
    try {
        await target.send({ embeds: [dmEmbed] });
    } catch {
        dmStatus = 'User could not be DMed.';
        logEmbed.setFooter({ text: dmStatus });
    }

    // Apply the mute
    try {
        await member.timeout(timeMs, reason);
    } catch (err) {
        console.error('Failed to apply timeout:', err);
        return interaction.editReply({ content: "❌ I couldn't apply the mute." });
    }

    // Send log
    const logChannel = interaction.guild.channels.cache.get(mutelogChannelid);
    if (logChannel) {
        try {
            await logChannel.send({ embeds: [logEmbed] });
        } catch (err) {
            console.warn('⚠️ Failed to send log message:', err);
        }
    }

    // Final response
    await interaction.editReply({ embeds: [commandEmbed] });
    logRecentCommand(`mute - ${target.tag} - ${duration}${unit} - ${reason} - issuer: ${interaction.user.tag}`);
}
