// commands/clearwarns.js

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { clearActiveWarns } from '../Database/databasefunctions.js';

export const data = new SlashCommandBuilder()
    .setName('clearactivewarns')
    .setDescription('Clears all warnings for a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('User to clear warnings for')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');

    const success = clearActiveWarns(target.id);

    if (success) {
        await interaction.reply({
            content: `✅ Cleared all Active warnings for **${target.tag}**.`,
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: `⚠️ No warnings found for **${target.tag}**.`,
            ephemeral: true
        });
    }
}
