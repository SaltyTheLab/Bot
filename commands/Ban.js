import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";


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

    const result = await banUser({
        guild: interaction.guild,
        targetUser: target,
        moderatorUser: interaction.user,
        reason,
        channel: interaction.channel,
        isAutomated: false
    });

    logRecentCommand(`ban - ${target.tag} - ${reason} - issuer: ${interaction.user.tag}`);
    if (typeof result === 'string') {
        // If banUser returns a string, assume it's a message for user
        return interaction.reply({ content: result});
    }

    // fallback reply in case banUser returns undefined or null
    return interaction.reply({ embeds: [result] });

}