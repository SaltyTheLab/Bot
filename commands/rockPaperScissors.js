import { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionContextType } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';

export const data = new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock, paper, scissors')
    .setContexts([InteractionContextType.Guild])

export function execute(interaction) {
    interaction.reply({
        embeds: [new EmbedBuilder({
            title: '**Pick your option**',
            color: 0x00a900
        })],
        components: [new ActionRowBuilder({
            components: [new ButtonBuilder({
                custom_id: 'Rock',
                label: 'rock',
                style: ButtonStyle.Secondary
            }), new ButtonBuilder({
                custom_id: 'Paper',
                label: 'paper',
                style: ButtonStyle.Secondary
            }), new ButtonBuilder({
                custom_id: 'Scissors',
                label: 'scissors',
                style: ButtonStyle.Secondary
            })]
        })]
    });
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 15000,
        max: 1
    })
    collector.on('collect', async i => {
        const opponentchoices = ['Rock', 'Paper', 'Scissors']
        const userchoice = i.customId;
        const opponentchoice = opponentchoices[Math.floor(Math.random() * 3)];
        const beats = {
            Rock: 'Scissors',
            Paper: 'Rock',
            Scissors: 'Paper'
        }
        let result = '';
        if (beats[userchoice] === opponentchoice) {
            result = 'you win!!!';
            const { userData } = await getUser(interaction.user.id, interaction.guild.id)
            userData.coins += 20;
            saveUser(interaction.user.id, interaction.guild.id, { userData });
        }
        else if (beats[opponentchoice] === userchoice)
            result = 'Febot Wins!!!';
        else if (userchoice.toLowerCase() === opponentchoice.toLowerCase())
            result = "it's a tie!!";
        i.update({
            embeds: [new EmbedBuilder({
                title: result,
                description: `You chose **${userchoice}**.\nOpponent chose **${opponentchoice}**.`,
                color: 0xffa500
            })],
            components: []
        });
    })
}
