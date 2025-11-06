import { EmbedBuilder, InteractionContextType, SlashCommandBuilder, } from "discord.js";
import { leaderboard } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName(`leaderboard`)
    .setDescription(`Show the top ten users`)
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const board = await leaderboard(interaction.guild.id)
    const embed = new EmbedBuilder()
        .setTitle(`Most active in ${interaction.guild.name}`)
        .setThumbnail(interaction.guild.iconURL({ size: 1024, extension: 'png' }))
        .setColor(0x0c23a3)
        .setDescription(
            `**__level LeaderBoard:__**\nRank \`1\`: <@${board[0].userId}> - level \`${board[0].level}\` with \`${board[0].xp}\` xp\nRank \`2\`: <@${board[1].userId}> - level \`${board[1].level}\` with \`${board[1].xp}\` xp\nRank \`3\`: <@${board[2].userId}> - level \`${board[2].level}\` with \`${board[2].xp}\` xp\nRank \`4\`: <@${board[3].userId}> - level \`${board[3].level}\` with \`${board[3].xp}\` xp\nRank \`5\`: <@${board[4].userId}> - level \`${board[4].level}\` with \`${board[4].xp}\` xp\nRank \`6\`: <@${board[5].userId}> - level \`${board[5].level}\` with \`${board[5].xp}\` xp\nRank \`7\`: <@${board[6].userId}> - level \`${board[6].level}\` with \`${board[6].xp}\` xp\nRank \`8\`: <@${board[7].userId}> - level \`${board[7].level}\` with \`${board[7].xp}\` xp\nRank \`9\`: <@${board[8].userId}> - level \`${board[8].level}\` with \`${board[8].xp}\` xp\nRank \`10\`: <@${board[9].userId}> - level \`${board[9].level}\` with \`${board[9].xp}\` xp`
        )
        .setTimestamp()

    interaction.reply({ embeds: [embed] })
}