import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

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

    const unitMap = {
        m: 60000,
        minutes: 60000,
        h: 3600000,
        hours: 3600000,
        d: 86400000,
        days: 86400000
    };

    const timeMs = duration * unitMap[unit];

    if (!timeMs || timeMs <= 0) {
        return interaction.reply({ content: '❌ Invalid mute duration.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        return interaction.reply({ content: '❌ User not found in the server.', ephemeral: true });
    }

    if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
        return interaction.reply({ content: '⚠️ User is already muted.', ephemeral: true });
    }

    let dmStatus = 'User was DMed.';

    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you have been issued a \`${duration} ${unit}\` mute in Salty's Cave.`)
        .addFields({ name: 'Reason:', value: `\`${reason}\`` })
        .setTimestamp();

    try {
        await target.send({ embeds: [dmEmbed] });
    } catch {
        dmStatus = 'User could not be DMed.';
    }

    try {
        await member.timeout(timeMs, reason);
    } catch (err) {
        console.error('Failed to apply timeout:', err);
        return interaction.reply({ content: '⚠️ Failed to apply mute.', ephemeral: true });
    }

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
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: dmStatus })
        .setTimestamp();

    const logChannelId = '1392889476686020700';
    const logChannel = interaction.guild.channels.cache.get(logChannelId);

    if (!logChannel) {
        return interaction.reply({ content: '❌ Log channel not found.', ephemeral: true });
    }

    try {
        await logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
        console.warn('⚠️ Failed to send log message:', err);
        return interaction.reply({ content: '❌ Could not send to the log channel.', ephemeral: true });
    }

    // Final response
    try {
        if (typeof interaction.reply === 'function') {
            await interaction.reply({ embeds: [commandEmbed] });
        } else if (interaction.channel) {
            await interaction.channel.send({ embeds: [commandEmbed] });
        }
    } catch (err) {
        console.warn('⚠️ Failed to send confirmation:', err);
    }

    logRecentCommand(`mute - ${target.tag} - ${duration}${unit} - ${reason} - issuer: ${interaction.user.tag}`);
}
