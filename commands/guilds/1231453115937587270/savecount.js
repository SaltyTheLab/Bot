import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUser, saveUser } from '../../../Database/databasefunctions.js';
import guildchannelmap from '../../../Botlisteners/Extravariables/guildconfiguration.json' with {type: 'json'}

export const data = new SlashCommandBuilder()
    .setName('savecount')
    .setDescription('Save the count incase you miss it')

export async function execute(interaction) {
    const countsaver = guildchannelmap[interaction.guild.id].countsaver
    const userData = await getUser(interaction.user.id, interaction.guild.id);
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
    countsaver.push(`${interaction.user.tag}`)
    interaction.reply({
        embeds: [new EmbedBuilder()
            .setDescription(interaction.user.tag + `, you now have ${countsaver.length} keys to save the count.`)
        ]
    })
}