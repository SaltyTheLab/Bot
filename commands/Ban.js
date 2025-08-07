import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import  banUser  from "../utilities/banUser.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('User to ban')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the ban')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    if (!target) {
        return interaction.reply({ content: '⚠️ User not found.', ephemeral: true });
    }

    if (target.bot)
        return interaction.reply({ content: 'You cannot ban a bot.', ephemeral: true });

    const result = await banUser({
        guild: interaction.guild,
        targetUserId: target,
        moderatorUser: interaction.user,
        reason,
        channel: interaction.channel,
        isAutomated: false
    });

    if (typeof result === 'string') {
        // If banUser returns a string, assume it's a message for user
        return interaction.reply({ content: result });
    }

    // fallback reply in case banUser returns undefined or null
    return interaction.reply({ embeds: [result] });

}