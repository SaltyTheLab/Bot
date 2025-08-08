import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { viewNotes } from '../Database/databasefunctions.js';
import { buildNoteButtons, buildNoteEmbed } from '../utilities/buildmodlogembeds.js';
export const data = new SlashCommandBuilder()
    .setName('note_show')
    .setDescription('View the notes of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    );

export async function execute(interaction) {
    const id = interaction.options.getUser('target');
    const target = await interaction.client.users.fetch(id);
    const twoMinutesInMs = 2 * 60 * 1000;
    const guildId = interaction.guild.id;

    const allnotes = await viewNotes(target.id, guildId);

    if (!allnotes.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xa9a900)
                    .setDescription('No notes found for that user')
            ]
        });
    }

    let currentIndex = 0;
    const currentnote = allnotes[currentIndex]

    const replyMessage = await interaction.reply({
        embeds: [await buildNoteEmbed(interaction, currentIndex, currentnote, allnotes.length)],
        components: [await buildNoteButtons(target.id, currentIndex, currentnote, allnotes.length)]
    });

    setTimeout(async () => {
        try {
            if (replyMessage.embeds && replyMessage.embeds.length > 0) {
                await replyMessage.edit({ components: [await buildNoteButtons(target.id, currentIndex, currentnote, allnotes.length, true)] });
                console.log(`Note buttons for ${target.tag} were disabled automatically.`);
            }
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
            // This might happen if the message was deleted before the timeout
        }
    }, twoMinutesInMs)
}
