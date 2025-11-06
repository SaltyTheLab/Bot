import { InteractionContextType, SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder()
    .setName('d10')
    .setDescription('Roll a D10')
    .setContexts(InteractionContextType.Guild)
export async function execute(interaction) {
    interaction.reply({ content: `you rolled a ${Math.ceil(Math.random() * 10)}` })
}