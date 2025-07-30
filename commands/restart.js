import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { reloadCommands, reloadListeners } from '../utilities/botreloader.js'; // Assuming this is now botReloader.js
export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Dynamically reloads bot commands and listeners. (admin only).')
    .setDefaultMemberPermissions(0);

export async function execute(interaction) {

    await interaction.deferReply();

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
    
    //audit the registered commands for errors in console
    console.log('--- Loaded Commands Check ---');
    if (client.commands && client.commands.size > 0) {
        client.commands.forEach((cmd, name) => {
            console.log(`Command Loaded: ${name}`);
        });
    } else {
        console.log('No commands found in client.commands collection.');
    }
    console.log('--- END Loaded Commands Check ---');

    let replyContent;
    if (errorMessages.length === 0) {
        replyContent = new EmbedBuilder()
            .setTitle(`✅ Bot components reloaded successfully!`)
    } else {
        replyContent = new EmbedBuilder()
            .setTitle(`⚠️ Reload completed with some errors:\n- ${errorMessages.join('\n- ')}\n\nCheck console for details.`)
    }

    await interaction.editReply({ embeds: [replyContent] });
}

