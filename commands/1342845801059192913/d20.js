import { InteractionContextType, SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder()
    .setName('d20')
    .setDescription('Roll a D20')
    .setContexts(InteractionContextType.Guild)

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
export async function execute(interaction) {
    if (interaction.user.id === "1226077693548953630")
        return interaction.reply({ content: `you rolled a 1` })
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const shuffled = shuffle(numbers);
    console.log(shuffled)
    return interaction.reply({ content: `you rolled a ${shuffled[Math.floor(Math.random() * 20)]}` })
}