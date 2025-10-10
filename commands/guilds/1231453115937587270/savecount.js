import { InteractionContextType, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUser, saveUser } from '../../../Database/databasefunctions.js';

export const data = new SlashCommandBuilder()
    .setName('savecount')
    .setDescription('Save the count incase you miss it')
    .setContexts([InteractionContextType.Guild])

export async function execute(interaction) {
    const countingState = interaction.client.countingState;
    const userData = await getUser(interaction.user.id, interaction.guild.id);
    const guildId = interaction.guild.id;
    if (userData.coins < 10) {
        interaction.reply({
            embeds: [new EmbedBuilder()
                .setDescription(interaction.user.tag + ", you do not have enough coins.")
            ]
        })
        return;
    }
    userData.coins -= 10;
    await saveUser({ userData })
    countingState.addkey(interaction.user.id, guildId)
    interaction.reply({
        embeds: [new EmbedBuilder()
            .setDescription(interaction.user.tag + `, you now have ${countingState[guildId].length} keys to save the count.`)
        ]
    })
}