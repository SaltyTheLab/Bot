import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, InteractionContextType, MessageFlags } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';

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
        const row = new ActionRowBuilder()
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.addComponents(new ButtonBuilder({
                custom_id: `tictactoe-${index}`,
                label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index],
                style: gameBoard[index] === 'X' ? ButtonStyle.Primary :
                    gameBoard[index] === 'O' ? ButtonStyle.Danger :
                        ButtonStyle.Secondary,
                disabled: disabled || gameBoard[index] !== ' '
            }))
        }
        rows.push(row);
    }
    return rows;
}

function checkWinner(gameBoard, player) {
    const winningConditions = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ]
    return winningConditions.some(condition => {
        return condition.every(index => {
            return gameBoard[index] === player
        });
    });
}

function checkDraw(gameBoard) {
    return gameBoard.every(cell => cell !== ' ')
}

function getCPUMove(gameBoard) {
    const availableMoves = gameBoard
        .map((cell, index) => (cell === ' ' ? index : null))
        .filter(index => index !== null);
    if (availableMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableMoves.length);
        return availableMoves[randomIndex];
    }
    return -1;
}

export const data = new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play a game of TicTacToe')
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Play against another person')
            .addUserOption(option =>
                option
                    .setName('opponent')
                    .setDescription('The user you want to play against')
                    .setRequired(true)))
    .addSubcommand(subcommand => subcommand.setName('cpu').setDescription('Play against the cpu'))
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const player1 = interaction.user;
    let player2 = null;
    let isCPU = false;
    const gameBoard = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
    switch (interaction.options.getSubcommand()) {
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
            player2 = interaction.options.getUser('opponent');;
            if (player1.id === player2.id)
                return interaction.reply({ content: "You can't play against yourself.", flags: MessageFlags.Ephemeral })
            break;
    }
    let currentplayer = Math.random() < 0.5 ? player1 : player2;
    const players = new Map();
    players.set(player1.id, 'X');
    players.set(player2.id, 'O');
    const sentMessage = await interaction.reply({
        embeds: [generateEmbed(`It's ${currentplayer}'s turn to move `)],
        components: generateButtons(gameBoard),
        withResponse: true
    });
    const collector = interaction.channel.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: i => i.message.id === sentMessage.interaction.responseMessageId,
        time: 120000
    })
    async function handleMoveAndStateUpdate(moveIndex, playerMark, updateCallback) {
        gameBoard[moveIndex] = playerMark;
        if (checkWinner(gameBoard, playerMark) || checkDraw(gameBoard)) {
            updateCallback({
                components: generateButtons(gameBoard, true)
            });
            if (checkWinner(gameBoard, playerMark)) {
                collector.stop('win');
                if (!isCPU && currentplayer.id === player1.id) {
                    const { userData } = await getUser(currentplayer.id, interaction.guild.id)
                    userData.coins += 100;
                    saveUser(currentplayer.id, interaction.guild.id, { userData })
                }
                return true;
            }
            collector.stop('draw');
            return true;
        }
        currentplayer = (currentplayer.id === player1.id) ? player2 : player1;
        updateCallback({
            embeds: [generateEmbed(`It's ${currentplayer.toString()}'s turn to move.`)],
            components: generateButtons(gameBoard)
        });
        return false;
    }
    async function cpuMoveHandler() {
        const cpuMove = getCPUMove(gameBoard);
        if (cpuMove !== -1)
            return handleMoveAndStateUpdate(cpuMove, players.get(currentplayer.id), interaction.editReply.bind(interaction));
        return false
    }
    if (isCPU && currentplayer.id === player2.id)
        cpuMoveHandler();
    collector.on('collect', async i => {
        if (i.user.id !== player1.id && i.user.id !== player2.id)
            return i.reply({ content: 'You are not a participant in this game.', flags: MessageFlags.Ephemeral })
        if (i.user.id !== currentplayer.id)
            return i.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral })
        const move = parseInt(i.customId.split('-')[1]);
        const playerMark = players.get(currentplayer.id);
        if (gameBoard[move] !== ' ')
            return i.reply({ content: "That cell is already taken! Please wait for the buttons to update before making your next move.", flags: MessageFlags.Ephemeral });
        gameBoard[move] = playerMark;
        const gameOver = await handleMoveAndStateUpdate(move, playerMark, i.update.bind(i))
        if (!gameOver && isCPU) {
            await new Promise(r => setTimeout(r, 750));
            cpuMoveHandler();
        }
    });
    collector.on('end', async (collected, reason) => {
        let finalEmbed;
        switch (reason) {
            case 'time':
                finalEmbed = generateEmbed(`The game ended due to inactivity.`, 0xff0000)
                break;
            case 'win':
                finalEmbed = generateEmbed(`${currentplayer} wins!!`, 0xffd700)
                break;
            case 'draw':
                finalEmbed = generateEmbed(`It's a draw!`, 0x555555)
                break;
            default:
                return
        }
        interaction.editReply({
            embeds: [finalEmbed],
            components: generateButtons(gameBoard, true)
        })
    });
}
