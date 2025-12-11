import { SlashCommandBuilder, EmbedBuilder, InteractionContextType } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
import { resolve } from 'node:path'
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
function generateEmbed(description, color = 0x0000ff) {
    return new EmbedBuilder({
        color: color,
        title: 'TicTacToe',
        description: description
    })
}

function generateButtons(gameBoard, disabled = false) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = { type: 1, components: [] }
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.components.push({
                type: 2, custom_id: `${index}`, label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2, disabled: disabled || gameBoard[index] !== ' '
            })
        }
        rows.push(row);
    }
    return rows;
}
export const data = new SlashCommandBuilder()
    .setName('games')
    .setDescription('Play a game')
    .addSubcommandGroup(group =>
        group.setName('tictactoe').setDescription('Play tictactoe')
            .addSubcommand(subcommand => subcommand.setName('cpu').setDescription('Play against the cpu'))
            .addSubcommand(subcommand => subcommand.setName('user').setDescription('Play against another person')
                .addUserOption(option => option.setName('opponent').setDescription('The user you want to play against').setRequired(true))))
    .addSubcommand(subcommand => subcommand.setName('rps').setDescription('Play Rock, Paper, Scissors'))
    .addSubcommand(subcommand => subcommand.setName('logos').setDescription('Play the Logo Game'))
    .addSubcommand(subcommand => subcommand.setName('bet').setDescription('bet coins')
        .addIntegerOption(opt => opt.setName('amount').setDescription('how many coins').setRequired(true)))
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    let collector;
    const { userData } = await getUser({ userId: interaction.user.id, guildId: interaction.guild.id, modflag: true });
    if (interaction.options.getSubcommandGroup() == 'tictactoe') {
        const player1 = interaction.user;
        let player2 = null;
        let isCPU = false;
        const gameBoard = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
        switch (interaction.options.getSubcommand(true)) {
            case 'cpu':
                player2 = {
                    id: 'CPU',
                    username: 'Computer',
                    toString: () => 'The **Computer**',
                    displayAvatarURL: () => 'https://i.imgur.com/8Xo9Q9Q.png'
                };
                isCPU = true
                break;
            case 'user':
                player2 = interaction.options.getUser('opponent');
                if (player1.id === player2.id) return interaction.reply({ content: "You can't play against yourself.", flags: 64 })
                break;
        }
        let currentplayer = Math.random() < 0.5 ? player1 : player2;
        const players = new Map();
        players.set(player1.id, 'X');
        players.set(player2.id, 'O');
        const sentMessage = await interaction.reply({ embeds: [generateEmbed(`It's ${currentplayer}'s turn to move`)], components: generateButtons(gameBoard), withResponse: true });
        collector = sentMessage.resource.message.createMessageComponentCollector({
            ComponentType: 2,
            filter: i => i.message.id === sentMessage.interaction.responseMessageId,
            time: 120000
        })
        async function handleMoveAndStateUpdate(moveIndex, playerMark, updateCallback) {
            gameBoard[moveIndex] = playerMark;
            let win, draw = null
            const winningConditions = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            if (winningConditions.some(condition => { return condition.every(index => { return gameBoard[index] === playerMark }); })) {
                updateCallback({ embeds: [generateEmbed(`${currentplayer} wins!!`, 0xffd700)], components: generateButtons(gameBoard, true) });
                if (!isCPU) {
                    const { userData } = await getUser({ userId: currentplayer.id, guildId: interaction.guild.id, modflag: true })
                    userData.coins += 100;
                    saveUser({ userId: currentplayer.id, guildId: interaction.guild.id, userData: userData })
                }
                win = true;
                return true;
            }
            if (gameBoard.every(cell => cell !== ' ')) {
                updateCallback({ embeds: [generateEmbed(`It's a draw!`, 0x555555)], components: generateButtons(gameBoard, true) });
                draw = true;
                return true;
            }
            if (!win && !draw) currentplayer = (currentplayer.id === player1.id) ? player2 : player1;
            await updateCallback({ embeds: [generateEmbed(`It's ${currentplayer.toString()}'s turn to move.`)], components: generateButtons(gameBoard) });
            return false;
        }
        if (isCPU && currentplayer.id === player2.id) {
            const availableMoves = gameBoard.map((cell, index) => (cell === ' ' ? index : null)).filter(index => index !== null);
            const move = availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : -1;
            if (move !== -1) handleMoveAndStateUpdate(move, players.get(currentplayer.id), interaction.editReply.bind(interaction));
        }
        collector.on('collect', async i => {
            if (i.user.id !== player1.id && i.user.id !== player2.id) return i.reply({ content: 'You are not a participant in this game.', flags: 64 })
            if (i.user.id !== currentplayer.id) return i.reply({ content: 'It\'s not your turn!', flags: 64 })
            const move = parseInt(i.customId);
            const playerMark = players.get(currentplayer.id);
            if (gameBoard[move] !== ' ') return i.reply({ content: "That cell is already taken!", flags: 64 });
            gameBoard[move] = playerMark;
            const gameOver = await handleMoveAndStateUpdate(move, playerMark, i.update.bind(i))
            if (!gameOver && isCPU) {
                await new Promise(r => setTimeout(r, 750));
                const availableMoves = gameBoard.map((cell, index) => (cell === ' ' ? index : null)).filter(index => index !== null);
                const move = availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : -1;
                if (move !== -1) await handleMoveAndStateUpdate(move, players.get(currentplayer.id), interaction.editReply.bind(interaction));
            }
            else collector.stop('end')
        });
    }
    else {
        switch (interaction.options.getSubcommand()) {
            case 'rps': {
                const initialmessage = await interaction.reply({
                    embeds: [new EmbedBuilder({ title: '**Pick your option**', color: 0x00a900 })],
                    components: [{
                        type: 1,
                        components: [
                            { type: 2, custom_id: 'Rock', label: 'rock', style: 2 },
                            { type: 2, custom_id: 'Paper', label: 'paper', style: 2 },
                            { type: 2, custom_id: 'Scissors', label: 'scissors', style: 2 }]
                    }],
                    withResponse: true
                });
                collector = initialmessage.resource.message.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    time: 15000,
                    max: 1
                })
                collector.on('collect', async i => {
                    const opponentchoices = ['Rock', 'Paper', 'Scissors']
                    const userchoice = i.customId;
                    const opponentchoice = opponentchoices[Math.floor(Math.random() * 3)];
                    const beats = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' }
                    let result = '';
                    beats[userchoice] === opponentchoice ? result = 'you win!!!'
                        : beats[opponentchoice] === userchoice ? result = 'Febot Wins!!!'
                            : result = "it's a tie!!"
                    if (result === 'you win!!!') {
                        const { userData } = await getUser({ userId: interaction.user.id, guildId: interaction.guild.id, modflag: true })
                        userData.coins += 20;
                        saveUser({ userId: interaction.user.id, guildId: interaction.guild.id, userData: userData });
                    }
                    i.update({
                        embeds: [new EmbedBuilder({
                            title: result,
                            description: `You chose **${userchoice}**.\nOpponent chose **${opponentchoice}**.`,
                            color: 0xffa500
                        })],
                        components: []
                    });
                })
                break;
            }
            case 'logos': {
                const logo = logos[Math.floor(Math.random() * logos.length)];
                const options = shuffle([logo, ...shuffle(logos.filter(l => l.brand !== logo.brand)).slice(0, 3)]);
                let buttons = options.map(option => { return { type: 2, custom_id: option.brand, label: option.brand, style: 1 }; });
                const initialmessage = await interaction.reply({
                    embeds: [new EmbedBuilder({
                        author: { name: `Guess this logo ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }), },
                        color: () => { const randomHex = Math.floor(Math.random() * 16777215); return parseInt(`0x${randomHex.toString(16).padStart(6, '0')}`, 16); },
                        image: { url: 'attachment://logo.png' }
                    })],
                    files: [{ attachment: resolve(`./${logo.image}`), name: 'logo.png' }],
                    components: [{ type: 1, components: buttons }],
                    withResponse: true
                });
                collector = initialmessage.resource.message.createMessageComponentCollector(
                    { componentType: 2, filter: i => i.message.id === initialmessage.interaction.responseMessageId, time: 15000 });
                const message = initialmessage.resource.message
                collector.on('collect', async i => {
                    buttons = options.map(o => {
                        return {
                            type: 2, custom_id: o.brand, label: o.brand,
                            style: o.brand === logo.brand ? 3 : i.customId === o.brand ? 4 : 2,
                            disabled: true
                        }
                    });
                    if (i.customId === logo.brand) {
                        const { userData } = await getUser({ userId: interaction.user.id, guildId: interaction.guild.id, modflag: true });
                        userData.coins += 20;
                        saveUser({ userId: interaction.user.id, guildId: interaction.guild.id, userData: userData });
                    }
                    i.update({ components: [{ type: 1, components: buttons }] });
                    collector.stop();
                });
                collector.on('end', async (collected, reason) => {
                    if (collected.size === 0 && reason == 'time') {
                        buttons = options.map(option => { return { type: 2, custom_id: option.brand, label: option.brand, style: 1, disabled: true } })
                        message.edit({ components: [{ type: 1, components: buttons }] })
                    }
                })
                break;
            }
            case 'bet': {
                const coincount = interaction.options.getInteger('amount')
                if (coincount > userData.coins) {
                    interaction.reply({ content: `you cannot bet more than you have ${interaction.user}`, flags: 64 })
                    return;
                }
                let statement = ` ${interaction.user.tag} you bet ${coincount} and won!!`
                const result = new EmbedBuilder({ color: 0x007a00, author: { name: statement, iconURL: interaction.user.displayAvatarURL({ dyanamic: true }) }, })
                if (Math.random() >= .5) userData.coins += Math.ceil(coincount * 1.5);
                else {
                    statement = ` ${interaction.user.tag} you bet ${coincount} and lost!`
                    result.setColor(0x7a0000)
                    result.setAuthor({ name: statement, iconURL: interaction.user.displayAvatarURL({ dyanamic: true }) })
                    userData.coins -= coincount;
                    userData.coins < 0 ? userData.coins = 0 : null
                }
                saveUser({ userId: interaction.user.tag, guildId: interaction.guild.id, userData: userData });
                interaction.reply({ embeds: [result] })
            }
        }
    }
}