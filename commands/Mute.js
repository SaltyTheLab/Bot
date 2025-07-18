import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logRecentCommand } from '../Logging/recentcommands.js';
import { muteUser } from '../utilities/muteUser.js';
import { getWarns } from '../Logging/database.js';
import { THRESHOLD } from '../moderation/constants.js'; // Or wherever your THRESHOLD is




const unitMap = { min: 60000, hour: 3600000, day: 86400000 };

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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


    const MAX_TIMEOUT_MS = 2419200000;
    const durationStr = `${duration} ${unit}`;

    const allWarnings = await getWarns(target.id);
    const now = Date.now();
    const activeWarnings = allWarnings.filter(warn => now - warn.timestamp < THRESHOLD);

    const multiplier = unitMap[unit];
    if (!multiplier || duration <= 0) {
        return interaction.reply({ content: '❌ Invalid duration or unit.', ephemeral: true });
    }

    let durationMs = duration * multiplier;
    durationMs = Math.min(durationMs, MAX_TIMEOUT_MS);

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        return interaction.reply({ content: '❌ User not found in the server.', ephemeral: true });
    }

    if (member.communicationDisabledUntilTimestamp > Date.now()) {
        return interaction.reply({ content: '⚠️ User is already muted.', ephemeral: true });
    }

    logRecentCommand(`mute - ${target.tag} - ${durationStr} - ${reason} - issuer: ${interaction.user.tag}`);
    //run through relevent helper command function
    const output = await muteUser({
        guild,
        targetUser: member.id,
        moderatorUser: issuer,
        reason,
        duration: duration,
        unit,
        channel: interaction.channel,
        isAutomated: false
    });

    if (typeof output == String) {
        return interaction.reply({ content: output});
    }

    return interaction.reply({ embeds: [output] });



}