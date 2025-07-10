import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('Reason for action')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt.setName('duration')
            .setDescription('How long to mute')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('unit')
            .setDescription('Duration units')
            .setRequired(true)
            .addChoices(
                { name: 'Minutes', value: 'm' },
                { name: 'Hours', value: 'h' },
                { name: 'Days', value: 'd' }
            )
    );
export async function execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true
        })
    }
    const target = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const unit = interaction.options.getString('unit');
    const reason = interaction.options.getString('reason');
    const unitMap = {
        m: 60000,    // minutes
        h: 3600000,  // hours
        d: 86400000  // days
    };
    const timeMs = duration * unitMap[unit];
    const commandembed = new EmbedBuilder() //embed for later use in logging channels
        .setAuthor({
            name: interaction.user.tag + ' muted a member',
            iconURL: interaction.user.displayAvatarURL()
        })
        .setColor(0xFFa500) //orange
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${target.id}>`, inline: true },
            { name: 'Duration', value: `\`${duration} ${unit}\``, inline: true },
            { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason', value: `\`${reason}\``, inline: false }
        )
        .setTimestamp();
    const dmembed = new EmbedBuilder() //embed for user dm
        .setAuthor({
            name: target.tag,
            icon: target.displayAvatarURL()
        })
        .setColor(0xFFa500) //orange
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you have been issued a ` + `\`${duration} ${unit} mute\`` + ` in Salty's Cave.`)
        .addFields(
            { name: 'Reason', value: `\`${reason}\``, inline: false },
        )
        .setTimestamp();
    const logembed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setAuthor({
            name: interaction.user.tag + `muted a member`,
            icon: interaction.user.displayAvatarURL()
        })
        .setFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason', value: `\`${reason}\``, inline: false }
        )

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!timeMs || timeMs <= 0) {
        return interaction.reply({ content: 'Invalid duration.', ephemeral: true });
    }

    if (!member) return interaction.reply({ content: 'user not found.', ephemeral: true });
    await target.send({ embeds: [dmembed] }).catch(() => {
        console.warn('Unable to DM ${target.tag}');
    })


    try {
        await member.timeout(timeMs, reason);
    } catch (error) {
        console.error('Mute failed:', error);
        await interaction.followUp({ content: '⚠️ Failed to apply mute.', ephemeral: true });
    }

    return interaction.reply({ embeds: [commandembed] });
}

