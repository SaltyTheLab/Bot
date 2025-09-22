import { SlashCommandBuilder, EmbedBuilder, InteractionContextType } from "discord.js";
import { getUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Show your current coin count')
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const userData = await getUser(interaction.user.id, interaction.guild.id)
    interaction.reply({
        embeds: [new EmbedBuilder()
            .setDescription(`${interaction.user.tag}, your balance is ${userData.coins} `)
        ]
    })
}