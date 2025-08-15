import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import punishUser from '../utilities/punishUser.js';
import { getActiveWarns } from '../Database/databasefunctions.js';
import getNextPunishment from '../moderation/punishments.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
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
    const issuer = interaction.user;
    const channel = interaction.channel;
    let duration;
    let unit;
    let durationMs;
    let effectiveDurationMs
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
    const output = await punishUser({
        guild: interaction.guild,
        target: target.id,
        moderatorUser: issuer,
        reason: reason,
        channel: channel,
        isAutomated: false,
        duration: effectiveDurationMs,
        unit: unit
    });

    if (typeof output === 'string') {
        return interaction.reply({ content: output });
    } else
        return interaction.reply({ embeds: [output] });

}