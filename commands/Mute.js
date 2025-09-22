import { PermissionFlagsBits, SlashCommandBuilder, InteractionContextType, EmbedBuilder } from 'discord.js';
import punishUser from '../moderation/punishUser.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason').setDescription('Reason for mute').setRequired(true)
    )
    .addIntegerOption(opt =>
        opt.setName('duration').setDescription('Mute duration').setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('unit')
            .setDescription('Duration unit')
            .setRequired(true)
            .addChoices(
                { name: 'Minute', value: 'min' },
                { name: 'Hour', value: 'hour' },
                { name: 'Day', value: 'day' }
            )
    );

export async function execute(interaction) {
    const target = await interaction.options.getMember('target');
    const reason = interaction.options.getString('reason');
    const duration = interaction.options.getInteger('duration');
    const unit = interaction.options.getString('unit');
    const staffcheck = target.permissions.has(PermissionFlagsBits.ModerateMembers)

    const MAX_TIMEOUT_MS = 2419200000;

    if (staffcheck) {
        interaction.reply({
            embeds: [new EmbedBuilder()
                .setAuthor({
                    name: target.user.tag + ' is staff, please handle this with an admin, co-owner, or owner.', iconURL: target.displayAvatarURL({ dynamic: true })
                })
                .setColor('#4b0808')]
            , ephemeral: true
        })
        return;
    }

    const multiplier = unitMap[unit];
    if (duration <= 0) {
        return interaction.reply({ content: '❌ Invalid duration or unit.', ephemeral: true });
    }

    let durationMs = duration * multiplier;
    durationMs = Math.min(durationMs, MAX_TIMEOUT_MS);

    if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now()) {
        return interaction.reply({ content: '⚠️ User is already muted.', ephemeral: true });
    }

    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target.id,
        moderatorUser: interaction.user,
        reason,
        channel: interaction.channel,
        isAutomated: false,
        duration: durationMs
    });
}
