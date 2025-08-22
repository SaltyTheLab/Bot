import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { deleteNote, getUser, viewNotes } from '../Database/databasefunctions.js';
import { buildNoteButtons, buildNoteEmbed } from '../utilities/buildmodlogembeds.js';
export const data = new SlashCommandBuilder()
    .setName('note_show')
    .setDescription('View the notes of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    );

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const moderatorUser = interaction.user;
    const fiveMinutesInMs = 5 * 60 * 1000;
    const usercheck = getUser(targetUser.id, interaction.guild.id, true)
    let allnotes = await viewNotes(targetUser.id, interaction.guild.id);

    if (!usercheck)
        return interaction.reply({ content: `❌ ${targetUser.tag} does not exist in the User Database.` })
    else if (!allnotes.length) {
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

    let replyMessage = await interaction.reply({
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
                    allnotes = await viewNotes(targetUser.id, interaction.guild.id);

                    if (allnotes.length === 0) {
                        replyMessage = await replyMessage.edit({
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`All notes for ${targetUser} have been deleted`)
                            ],
                            components: []
                        });
                        collector.stop();
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
        replyMessage = await replyMessage.edit({
            embeds: [await buildNoteEmbed(interaction, currentIndex, currentnote, allnotes.length)],
            components: [await buildNoteButtons(currentIndex, allnotes, currentnote.id,)]
        });
    });
    collector.on('end', async () => {
        const finalButtons = await buildNoteButtons(currentIndex, allnotes, currentnote.id, true);
        try {
            if (replyMessage.embeds.length > 0 && replyMessage.components[0]) {
                await replyMessage.edit({ components: [finalButtons] });
                console.log(`Note buttons for ${targetUser.tag} were disabled automatically.`);
            }
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
        }
    });
}
