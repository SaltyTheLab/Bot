import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, InteractionContextType, ComponentType } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
import { resolve } from 'node:path';
import logos from "../Database/logos.json" with {type: 'json'};

function getRandomColor() {
    const randomHex = Math.floor(Math.random() * 16777215)
    return parseInt(`0x${randomHex.toString(16).padStart(6, '0')}`, 16)
}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
export const data = new SlashCommandBuilder()
    .setName('logos')
    .setContexts([InteractionContextType.Guild])
    .setDescription('Guess the logo');
export async function execute(interaction) {
    const logo = logos[Math.floor(Math.random() * logos.length)];
    const options = shuffle([logo, ...shuffle(logos.filter(l => l.brand !== logo.brand)).slice(0, 3)]);
    let buttons = options.map(option => {
        return new ButtonBuilder({
            custom_id: option.brand,
            label: option.brand,
            style: ButtonStyle.Primary
        });
    });
    const initialmessage = await interaction.reply({
        embeds: [new EmbedBuilder({
            author: { name: `Guess this logo ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }), },
            color: getRandomColor(),
            image: { url: 'attachment://logo.png' }
        })],
        files: [
            { attachment: resolve(`./${logo.image}`), name: 'logo.png' }
        ],
        components: [new ActionRowBuilder({
            components: buttons
        })],
        withResponse: true
    });
    const collector = initialmessage.resource.message.createMessageComponentCollector(
        {
            componentType: ComponentType.Button,
            filter: i => i.message.id === initialmessage.interaction.responseMessageId,
            time: 15000
        }
    );
    const message = initialmessage.resource.message
    collector.on('collect', async i => {
        buttons = options.map(option => {
            return new ButtonBuilder({
                custom_id: `disabled_${option.brand}`,
                label: option.brand,
                style: option.brand === logo.brand ? ButtonStyle.Success
                    : i.customId === option.brand ? ButtonStyle.Danger
                        : ButtonStyle.Secondary,
                disabled: true
            })
        });

        if (i.customId === logo.brand) {
            const { userData } = await getUser(interaction.user.id, interaction.guild.id);
            userData.coins += 20;
            saveUser(interaction.user.id, interaction.guild.id, { userData });
        }
        i.update({
            components: [new ActionRowBuilder({
                components: buttons
            })]
        });
        collector.stop();
    });
    collector.on('end', async (collected, reason) => {
        if (collected.size === 0 && reason == 'time') {
            buttons = options.map(option => {
                return new ButtonBuilder({ custom_id: `disabled_${option.brand}`, label: option.brand, style: ButtonStyle.Primary, disabled: true })
            })
            message.edit({
                components: [new ActionRowBuilder({
                    components: buttons
                })]
            })
        }
    })
}
