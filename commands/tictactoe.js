import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, InteractionContextType } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";
const board = Array(9).fill(' ');

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

function generateEmbed(description, color = 'Green') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle('TicTacToe')
        .setDescription(description)
}

function generateButtons(gameBoard, disabled = false) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder()
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tictactoe-${index}`)
                    .setLabel(gameBoard[index] === ' ' ? '\u200b' : gameBoard[index])
                    .setStyle(
                        gameBoard[index] === 'X' ? ButtonStyle.Primary :
                            gameBoard[index] === 'O' ? ButtonStyle.Danger :
                                ButtonStyle.Secondary
                    )
                    .setDisabled(disabled || gameBoard[index] !== ' ')
            )
        }
        rows.push(row);
    }
    return rows;
}

function checkWinner(gameBoard, player) {
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
    // 1. Find all available (empty) moves
    const availableMoves = gameBoard
        .map((cell, index) => (cell === ' ' ? index : null))
        .filter(index => index !== null);

    // 2. Pick a random index from the available moves array
    if (availableMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableMoves.length);
        return availableMoves[randomIndex];
    }

    return -1; // Should not happen in a non-drawn game
}

export const data = new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play a game of TicTacToe')
    .addSubcommand(subcommand =>
        subcommand.setName('user').setDescription('Play against another person').addUserOption(option =>
            option.setName('opponent').setDescription('The user you want to play against').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
        subcommand.setName('cpu').setDescription('Play against the cpu')
    )
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const player1 = interaction.user;
    let player2;
    let isCPU = false;

    if (subcommand === 'cpu') {
        player2 = {
            id: 'CPU',
            username: 'Computer',
            toString: () => 'The **Computer**',
            displayAvatarURL: () => 'https://i.imgur.com/8Xo9Q9Q.png'
        };
        isCPU = true
    } else if (subcommand === 'user') {
        player2 = interaction.options.getUser('opponent');;
        if (player1.id === player2.id) {
            return interaction.reply({
                content: "You can't play against yourself.",
                ephemeral: true
            })
        }
    }

    let currentplayer = Math.random() < 0.5 ? player1 : player2;

    const gameBoard = [...board];
    const players = new Map();
    players.set(player1.id, 'X');
    players.set(player2.id, 'O');
    const player2Mark = 'O'

    const sentMessage = await interaction.reply({
        embeds: [generateEmbed(`It's ${currentplayer}'s turn to move `)],
        components: generateButtons(gameBoard),
        withResponse: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: i => i.message.id === sentMessage.resource.message.id,
        time: 120000
    })

    async function cpuMoveHandler() {
        const cpuMove = getCPUMove(gameBoard);

        if (cpuMove !== -1) {
            gameBoard[cpuMove] = player2Mark;
            if (checkWinner(gameBoard, player2Mark)) {
                return interaction.editReply({
                    embeds: [generateEmbed(`${player2.toString()} wins!!`, "Gold")],
                    components: generateButtons(gameBoard, true)
                });
            }


            if (checkDraw(gameBoard)) {
                collector.stop('draw');
                return interaction.editReply({
                    embeds: [generateEmbed(`It's a Draw!`, "Grey")],
                    components: generateButtons(gameBoard, true)
                });
            }

            currentplayer = player1;
            await interaction.editReply({
                embeds: [generateEmbed(`It's ${currentplayer.toString()}'s turn to move.`)],
                components: generateButtons(gameBoard)
            });
        }
    }

    if (isCPU && currentplayer.id === player2.id) {
        await cpuMoveHandler();
    }

    collector.on('collect', async i => {
        if (i.user.id !== player1.id && i.user.id !== player2.id) {
            return i.reply({ content: 'You are not a participant in this game.', ephemeral: true })
        }

        if (i.user.id !== currentplayer.id) {
            return i.reply({
                content: 'It\'s not your turn!', ephemeral: true
            })
        }

        const move = parseInt(i.customId.split('-')[1]);
        const playerMark = players.get(currentplayer.id);

        if (isNaN(move) || gameBoard[move] !== ' ') {
            // Defer the update to prevent 'Interaction Failed' while waiting for the CPU
            await i.deferUpdate();
            return;
        }

        if (gameBoard[move] !== ' ')
            return i.reply({ content: "That cell is already taken! Please wait for the buttons to update before making your next move.", ephemeral: true });
        gameBoard[move] = playerMark;

        if (checkWinner(gameBoard, playerMark)) {
            collector.stop('win');
            await i.update({
                embeds: [generateEmbed(`${currentplayer} wins!!`, "Gold")],
                components: generateButtons(gameBoard, true)
            })
            const userData = await getUser(currentplayer.id, interaction.guild.id)
            userData.coins += 100;
            saveUser(currentplayer.id, interaction.guild.id, { userData })
            return;
        }

        if (checkDraw(gameBoard)) {
            collector.stop('draw');
            await i.update({
                embeds: [generateEmbed(`It's a Draw!`, "Grey")],
                components: generateButtons(gameBoard, true)
            })
            return;
        }

        currentplayer = (currentplayer.id === player1.id) ? player2 : player1;
        if (isCPU) {
            await i.update({
                embeds: [generateEmbed(`It's ${currentplayer.toString()}'s turn to move.`)],
                components: generateButtons(gameBoard)
            })
            setTimeout(() => cpuMoveHandler(), 750);
        } else
            await i.update({
                embeds: [generateEmbed(`It's ${currentplayer}'s turn to move.`)],
                components: generateButtons(gameBoard)
            })
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time')
            interaction.editReply({
                embeds: [generateEmbed(`The game ended due to inactivity.`, "Red")],
                components: generateButtons(gameBoard, true)
            });
    });
}