import { PermissionFlagsBits, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import punishUser from '../utilities/punishUser.js';
import { getActiveWarns } from '../Database/databasefunctions.js';
import getNextPunishment from '../moderation/punishments.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
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
    const target = await interaction.options.get('target');
    const reason = interaction.options.getString('reason');
    const issuer = interaction.user;
    const channel = interaction.channel;
    let duration;
    let unit = 'min';
    let durationMs;
    let effectiveDurationMs = 0;
    const MAX_TIMEOUT_MS = 2419200000;

    if (!target) {
        return interaction.reply({ content: '⚠️ Could not find the user.', ephemeral: true });
    }

    if (target.bot) {
        return interaction.reply({ content: '⚠️ You cannot warn bots.', ephemeral: true });
    }

    if (target.id === issuer.id) {
        return interaction.reply({ content: '⚠️ You cannot warn yourself.', ephemeral: true });
    }

    const warns = await getActiveWarns(target.id, interaction.guild.id)
    if (warns.length >= 2) {
        ({ duration, unit } = getNextPunishment(warns.length))
        const multiplier = unitMap[unit];
        durationMs = duration * multiplier;
        effectiveDurationMs = Math.min(durationMs, MAX_TIMEOUT_MS);
    }
    //run through relevent helper command function
    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target.value,
        moderatorUser: issuer,
        reason: reason,
        channel: channel,
        isAutomated: false,
        currentWarnWeight: 1,
        duration: effectiveDurationMs,
        unit: unit,
        banflag: false,
        buttonflag: false

    });
}