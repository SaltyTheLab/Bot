import { SlashCommandBuilder } from 'discord.js';
import { reloadCommands, reloadListeners } from '../utilities/botreloader.js'; // Assuming this is now botReloader.js
export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Dynamically reloads bot commands and listeners. (admin only).')
    .setDefaultMemberPermissions(0);

export async function execute(interaction) {

    if (!interaction.member.permissions.has('Administrator')) {
        console.log("DEBUG (Reload Command): User is not admin. Attempting to reply with permission error."); // <-- Add this
        return interaction.reply({ content: 'You must be an administrator to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const client = interaction.client;
    let successMessages = [];
    let errorMessages = [];

    // --- Reload Commands ---
    try {
        reloadCommands(client);
        successMessages.push('Commands reloaded.');
    } catch (err) {
        console.error('❌ Error during command reload:', err);
        errorMessages.push(`Commands: ${err.message}`);
    }

    // --- Reload Listeners ---
    try {
        await reloadListeners(client);
        successMessages.push('Listeners reloaded.');
    } catch (err) {
        console.error('❌ Error during listener reload:', err);
        errorMessages.push(`Listeners: ${err.message}`);
    }


    let replyContent;
    if (errorMessages.length === 0) {
        replyContent = `✅ Bot components reloaded successfully!\n\n${successMessages.join('\n')}`;
    } else {
        replyContent = `⚠️ Reload completed with some errors:\n- ${errorMessages.join('\n- ')}\n\nCheck console for details.`;
    }

    await interaction.editReply({ content: replyContent, ephemeral: true });

}

