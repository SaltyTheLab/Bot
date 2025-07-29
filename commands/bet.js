import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('bet')
    .setDescription('bet coins')
    .addIntegerOption(opt =>
        opt.setName('amount').setDescription('how many coins').setRequired(true)
    )

export async function execute(interaction) {
    const { userData } = getUser(interaction.user.id);
    const user = await interaction.user;
    const coincount = interaction.options.getInteger('amount')
    const bet = Math.random()
    const win = Math.ceil(coincount * 1.5);
    let statement = ` ${user.tag} you bet ${coincount} and won ${win} coins!!`
    const result = new EmbedBuilder()
        .setColor(0x007a00)
        .setAuthor({
            name: statement,
            iconURL: user.displayAvatarURL({ dyanamic: true })
        })
    if (bet >= .5) {
        userData.points += win;

    } else {
        statement = ` ${user.tag} you bet ${coincount} and lost!`
        result.setColor(0x7a0000)
        result.setAuthor({
            name: statement,
            iconURL: user.displayAvatarURL({ dyanamic: true })
        })
        userData.points -= coincount;
    }
    saveUser(userData);
    interaction.reply(
        {
            embeds: [result]
        }
    )
}