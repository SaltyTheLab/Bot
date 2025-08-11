import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { deleteNote, viewNotes } from '../Database/databasefunctions.js';
import { buildNoteButtons, buildNoteEmbed } from '../utilities/buildmodlogembeds.js';
export const data = new SlashCommandBuilder()
    .setName('note_show')
    .setDescription('View the notes of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    );

export async function execute(interaction) {
    const userid = interaction.options.getUser('target');
    const target = await interaction.client.users.fetch(userid);
    const moderatorUser = interaction.user;
    const fiveMinutesInMs = 5 * 60 * 1000;
    const guildId = interaction.guild.id;
    let allnotes = await viewNotes(target.id, guildId);

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
    let currentnote = allnotes[currentIndex]

    const replyMessage = await interaction.reply({
        embeds: [await buildNoteEmbed(interaction, currentIndex, currentnote, allnotes.length)],
        components: [await buildNoteButtons(currentIndex, allnotes, currentnote.id)]
    });


    const collector = replyMessage.createMessageComponentCollector({
        filter: i => i.user.id === moderatorUser.id,
        time: fiveMinutesInMs
    })

    collector.on('collect', async i => {
        const customIdParts = i.customId.split('_');
        const action = customIdParts[1];
        const noteIdToDelete = customIdParts[2];
        await i.deferUpdate();
        switch (action) {
            case 'prev':
            case 'next':
                currentIndex = action == 'next' ? Math.min(allnotes.length - 1, currentIndex + 1)
                    : Math.max(0, currentIndex - 1)
                break;
            case 'del':
                try {
                    deleteNote(noteIdToDelete);
                    allnotes = await viewNotes(target.id, interaction.guild.id);
                    console.log(allnotes.length);

                    if (allnotes.length === 0) {
                        await interaction.editReply({
                            content: `All notes for ${target.tag} have been deleted`,
                            embeds: [],
                            components: []
                        });
                        return;
                    }
                    currentIndex = Math.min(currentIndex, allnotes.length - 1)
                } catch (error) {
                    console.error(`Error deleting log ${noteIdToDelete}:`, error);
                    await i.followUp({ content: `Failed to delete note: ${error.message}`, ephemeral: true });
                }
                break;
        }
        currentnote = allnotes[currentIndex]
        await i.editReply({
            embeds: [await buildNoteEmbed(interaction, currentIndex, currentnote, allnotes.length)],
            components: [await buildNoteButtons(currentIndex, allnotes, currentnote.id,)]
        });
    });
    collector.on('end', async () => {
        try {
            const finalButtons = await buildNoteButtons(currentIndex, allnotes, currentnote.id, true);
            await replyMessage.edit({ components: [finalButtons] });
            console.log(`Modlog buttons for ${target.tag} were disabled automatically.`);
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
        }
    });
}
