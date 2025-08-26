import { PermissionFlagsBits, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import punishUser from '../utilities/punishUser.js';

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
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const duration = interaction.options.getInteger('duration');
    const unit = interaction.options.getString('unit');
    const issuer = interaction.user;
    const guild = interaction.guild;
    const channel = interaction.channel;

    const MAX_TIMEOUT_MS = 2419200000;

    const multiplier = unitMap[unit];
    if (!multiplier || duration <= 0) {
        return interaction.reply({ content: '❌ Invalid duration or unit.', ephemeral: true });
    }

    let durationMs = duration * multiplier;
    durationMs = Math.min(durationMs, MAX_TIMEOUT_MS);

    if (!target) {
        return interaction.reply({ content: '❌ User not found in the server.', ephemeral: true });
    }

    if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now()) {
        return interaction.reply({ content: '⚠️ User is already muted.', ephemeral: true });
    }

    await punishUser({
        interaction: interaction,
        guild: guild,
        target: target.id,
        moderatorUser: issuer,
        reason,
        channel: channel,
        isAutomated: false,
        duration: durationMs,
        unit: unit
    });
}
