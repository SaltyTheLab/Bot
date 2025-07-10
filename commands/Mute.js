import { Integration, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

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
    if (!timeMs || timeMs <= 0) {
        return interaction.reply({ content: 'Invalid duration.', ephemeral: true });
    }
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'user not found.', ephemeral: true });
    await member.timeout(timeMs, reason).catch(() => interaction.reply({ content: 'failed to mute user.', ephemeral: true }));

    return interaction.reply(`<@${target.id}> was issued a ${duration} ${unit} mute.`);
}

