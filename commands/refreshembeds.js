import { EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import embedsenders from "../embeds/embeds.js";
export const data = new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Refreshes the Posted embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
export async function execute(interaction) {
    await embedsenders(interaction.client.channels.cache)
    interaction.reply({ embeds: [new EmbedBuilder({ description: 'Embeds have been updated!' })] })
}