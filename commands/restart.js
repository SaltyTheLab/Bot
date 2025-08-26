import { SlashCommandBuilder, EmbedBuilder, InteractionContextType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restarts the bot (admin only).')
    .setDefaultMemberPermissions(0)
    .setContexts([InteractionContextType.Guild])

export async function execute(interaction) {
    await interaction.deferReply();

    const restartEmbed = new EmbedBuilder()
        .setTitle('🔄 Restarting Bot...')
        .setDescription('The bot will be back online in a moment.')
        .setColor('#FFD700');

    await interaction.editReply({ embeds: [restartEmbed] });

    // Log the restart request to the console for debugging
    console.log(`[RESTART] Restart requested by ${interaction.user.tag}.`);

    // Exit the process with a success code. A process manager will
    // detect this exit and automatically restart the bot.
    process.exit(0);
}