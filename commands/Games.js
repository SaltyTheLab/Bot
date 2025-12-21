import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import logos from "../Database/logos.json" with {type: 'json'};
//logo game functions
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
//tictactoe functions
function generateButtons(gameBoard, player1, player2, currentplayer) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = { type: 1, components: [] }
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.components.push({
                type: 2, custom_id: `tictactoe-${gameBoard}-${player1}-${player2}-${currentplayer}-${index}`, label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2
            })
        }
        rows.push(row);
    }
    return rows;
}
export default {
    data: {
        name: 'games',
        description: 'Play a game',
        options: [
            { name: 'tictactoe', description: 'Play Tictactoe', options: [{ name: 'opponent', description: 'Your Opponent', required: true, type: 6 }] },
            { name: 'rps', description: 'Play Rock, Paper, Scissors', type: 1 },
            { name: 'logos', description: 'Play the Logo Game', type: 1 },
            { name: 'bet', description: 'bet coins', options: [{ name: 'amount', description: 'The amount', required: true, type: 4 }] }
        ],
        contexts: 0
    },
    async execute({ interaction, api }) {
        const subcommand = interaction.data.options[0];
        const user = interaction.member.user;
        const useravatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        switch (subcommand.name) {
            case 'tictactoe': {
                const player1 = interaction.member.user.id;
                const player2 = interaction.data.options[0].options[0].value
                const gameBoard = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
                // if (player1.id === player2.id) return await api.interactions.reply(interaction.id, interaction.token, { content: "You can't play against yourself.", flags: 64 })
                let currentplayer = Math.random() < 0.5 ? player1 : player2;
                const players = new Map();
                players.set(player1, 'X');
                players.set(player2, 'O');
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `<@${player2}>, <@${player1}> wants to play tictactoe`,
                    embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${currentplayer}>'s turn to move.` }],
                    components: generateButtons(gameBoard, player1, player2, currentplayer),
                    withResponse: true
                });
                break;
            }
            case 'rps':
                await api.interactions.reply(interaction.id, interaction.token, {
                    embeds: [{ title: '**Pick your option**', color: 0x00a900 }],
                    components: [{
                        type: 1,
                        components: [
                            { type: 2, custom_id: 'rps-Rock', label: 'rock', style: 2 },
                            { type: 2, custom_id: 'rps-Paper', label: 'paper', style: 2 },
                            { type: 2, custom_id: 'rps-Scissors', label: 'scissors', style: 2 }]
                    }]
                })
                break;
            case 'logos': {
                const logo = logos[Math.floor(Math.random() * logos.length)];
                const options = shuffle([logo, ...shuffle(logos.filter(l => l.brand !== logo.brand)).slice(0, 3)]);
                const buttons = options.map(option => { return { type: 2, custom_id: `logos-${option.brand}-${logo.brand}`, label: option.brand, style: 1 }; });
                await api.interactions.reply(interaction.id, interaction.token, {
                    embeds: [{
                        author: { name: `Guess this logo ${interaction.member.user.username}`, icon_url: useravatar },
                        color: parseInt(`0x${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`, 16),
                        image: { url: `attachment://logo.png` }
                    }],
                    files: [{ data: readFileSync(resolve(logo.image)), name: 'logo.png' }],
                    components: [{ type: 1, components: buttons }],
                });
                break;
            }
            case 'bet': {
                const coincount = interaction.data.options[0].options[0].value
                const { userData } = await getUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, modflag: true });
                if (coincount > userData.coins) { await api.interaction.reply(interaction.id, interaction.token, { content: `you cannot bet more than you have ${interaction.user}`, flags: 64 }); return; }
                const result = { color: 0x007a00, author: { name: `${interaction.user.tag} you bet ${coincount} and won!!`, icon_url: useravatar } }
                if (Math.random() >= .5) userData.coins += Math.ceil(coincount * 1.5);
                else {
                    result.color = 0x7a0000
                    result.author = { name: `${interaction.user.tag} you bet ${coincount} and lost!`, icon_url: useravatar }
                    userData.coins -= coincount;
                    userData.coins < 0 ? userData.coins = 0 : null
                }
                saveUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, userData: userData });
                await api.interactions.reply(interaction.id, interaction.token, { embeds: [result] })
            }
        }
    }
}
