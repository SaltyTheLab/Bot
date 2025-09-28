import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { sendShutdownWebHook } from '../utilities/sendwebhook.js';

export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restarts the bot (admin only).')
    .setContexts([InteractionContextType.Guild])

export async function execute(interaction) {
    const owner = await interaction.guild.fetchOwner()

    if (interaction.user.id !== owner.user.id) {
        interaction.reply({
            content: `you are not authorized to use this command ${interaction.user}`,
            ephemeral: true
        })
        return;
    }
    await interaction.reply({ content: "Initiating controlled restart... Notifying users now." });
    await sendShutdownWebHook("RESTART")


    console.log(`[RESTART] Restart requested by ${interaction.user.tag}.`);
    interaction.client.destroy();
    process.exit(0);
}