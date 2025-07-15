// commands/clearwarns.js

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { clearWarns } from '../Logging/database.js';

export const data = new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clears all warnings for a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('User to clear warnings for')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');

    const success = await clearWarns(target.id);

    if (success) {
        await interaction.reply({
            content: `✅ Cleared all warnings for **${target.tag}**.`,
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: `⚠️ No warnings found for **${target.tag}**.`,
            ephemeral: true
        });
    }
}
