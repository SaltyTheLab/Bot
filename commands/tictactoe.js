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
export const data = new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play a game of TicTacToe')
    .addUserOption(opt =>
        opt.setName('opponent').setDescription('Choose your Opponent').setRequired(true)
    )
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const opponent = interaction.options.getUser('opponent')
    const player1 = interaction.user;
    const player2 = opponent;

    if (player1.id === player2.id) {
        return interaction.reply({
            content: "You can't play against yourself.",
            ephemeral: true
        })
    }

    let currentplayer = Math.random() < 0.5 ? player1 : player2;

    const gameBoard = [...board];
    const players = new Map();
    players.set(player1.id, 'X');
    players.set(player2.id, 'O');

    const sentMessage = await interaction.reply({
        embeds: [generateEmbed(`It's ${currentplayer}'s turn to move `)],
        components: generateButtons(gameBoard),
        fetchReply: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        filter: i => i.message.id === sentMessage.id,
        time: 120000
    })

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

        if (isNaN(move)) {
            console.error("Error: The parsed move value is NaN. Custom ID was:", i.customId);
            return i.reply({ content: "There was an issue processing your move. Please try again.", ephemeral: true });
        }

        const playerMark = players.get(currentplayer.id);

        if (gameBoard[move] !== ' ') {
            console.log(`Debug: User ${i.user.username} clicked button ${move}. The spot is already taken by ${gameBoard[move]}.`);
            return i.reply({ content: "That cell is already taken! Please wait for the buttons to update before making your next move.", ephemeral: true });
        }

        gameBoard[move] = playerMark;

        if (checkWinner(gameBoard, playerMark)) {
            collector.stop('win');
            await i.update({
                embeds: [generateEmbed(`${currentplayer} wins!!`, "Gold")],
                components: generateButtons(gameBoard, true)
            })
            const userData = await getUser(currentplayer.id, interaction.guild.id)
            userData.coins += 100;
            saveUser({ userData })
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
        await i.update({
            embeds: [generateEmbed(`It's ${currentplayer}'s turn to move.`)],
            components: generateButtons(gameBoard)
        })
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.editReply({
                embeds: [generateEmbed(`The game ended due to inactivity.`, "Red")],
                components: generateButtons(gameBoard, true)
            });
        }
    });
}