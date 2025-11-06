import { InteractionContextType, SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder()
    .setName('d100')
    .setDescription('Roll a D100')
    .setContexts(InteractionContextType.Guild)
export async function execute(interaction) {
    interaction.reply({ content: `you rolled a ${Math.ceil(Math.random() * 100)}` })
}