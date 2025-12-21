import { leaderboard } from '../Database/databaseAndFunctions.js';
export default {
    data: { name: 'leaderboard', description: `Show the top ten users`, contexts: 0 },
    async execute({ interaction, api }) {
        const board = await leaderboard(interaction.guild_id)
        const guild = await api.guilds.get(interaction.guild_id)
        const guildicon = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        await api.interactions.reply(interaction.id, interaction.token, {
            embeds: [{
                title: `Most active in ${guild.name}`,
                thumbnail: { url: guildicon },
                color: 0x0c23a3,
                description: `**__level LeaderBoard:__**\nRank \`1\`: <@${board[0].userId}> - level \`${board[0].level}\` with \`${board[0].xp}\` xp\nRank \`2\`: <@${board[1].userId}> - level \`${board[1].level}\` with \`${board[1].xp}\` xp\nRank \`3\`: <@${board[2].userId}> - level \`${board[2].level}\` with \`${board[2].xp}\` xp\nRank \`4\`: <@${board[3].userId}> - level \`${board[3].level}\` with \`${board[3].xp}\` xp\nRank \`5\`: <@${board[4].userId}> - level \`${board[4].level}\` with \`${board[4].xp}\` xp\nRank \`6\`: <@${board[5].userId}> - level \`${board[5].level}\` with \`${board[5].xp}\` xp\nRank \`7\`: <@${board[6].userId}> - level \`${board[6].level}\` with \`${board[6].xp}\` xp\nRank \`8\`: <@${board[7].userId}> - level \`${board[7].level}\` with \`${board[7].xp}\` xp\nRank \`9\`: <@${board[8].userId}> - level \`${board[8].level}\` with \`${board[8].xp}\` xp\nRank \`10\`: <@${board[9].userId}> - level \`${board[9].level}\` with \`${board[9].xp}\` xp`,
                timestamp: new Date().toISOString()
            }]
        })
    }
}

