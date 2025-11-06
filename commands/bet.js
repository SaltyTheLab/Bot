import { EmbedBuilder, SlashCommandBuilder, InteractionContextType, MessageFlags } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('bet')
    .setDescription('bet coins')
    .setContexts([InteractionContextType.Guild])
    .addIntegerOption(opt =>
        opt.setName('amount').setDescription('how many coins').setRequired(true)
    )

export async function execute(interaction) {
    const user = interaction.user;
    const userData = await getUser(user.id, interaction.guild.id);
    const coincount = interaction.options.getInteger('amount')
    if (coincount > userData.coins) {
        interaction.reply({ content: `you cannot bet more than you have ${user}`, flags: MessageFlags.Ephemeral })
        return;
    }
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
        userData.coins += win;
    } else {
        statement = ` ${user.tag} you bet ${coincount} and lost!`
        result.setColor(0x7a0000)
        result.setAuthor({
            name: statement,
            iconURL: user.displayAvatarURL({ dyanamic: true })
        })
        userData.coins -= coincount;
        if (userData.coins < 0)
            userData.coins = 0
    }
    await saveUser(user.id, interaction.guild.id, { userData });
    interaction.reply(
        {
            embeds: [result]
        }
    )
}