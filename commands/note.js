import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { deleteNote, viewNotes, addNote, getUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('note')
    .setDescription('add/show a users notes')
    .addSubcommand(command =>
        command.setName('show').setDescription('Display a users notes').addUserOption(opt =>
            opt.setName('target').setDescription('target user').setRequired(true)))
    .addSubcommand(command =>
        command.setName('add').setDescription('Add note to a user').addUserOption(opt =>
            opt.setName('target').setDescription('add a note to a user').setRequired(true))
            .addStringOption(opt =>
                opt.setName('note').setDescription('note to add').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])

async function buildNoteEmbed(interaction, index, currentNote, length) {
    const [target, mod] = await Promise.all(
        [interaction.client.users.fetch(currentNote.userId),
        interaction.client.users.fetch(currentNote.moderatorId)
        ]);
    const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    return new EmbedBuilder()
        .setColor(0xdddddd)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setDescription([
            `${target} notes |  \`${index + 1} of ${length}\``,
            `> ${currentNote.note}`
        ].join('\n'))
        .setFooter({
            text: `${mod.tag} | ${formattedDate}`,
            iconURL: mod.displayAvatarURL({ dynamic: true })
        });
};
async function buildNoteButtons(index, allnotes, id, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note-prev`)
            .setLabel('◀️ prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0 || disabled),

        new ButtonBuilder()
            .setCustomId(`note-next`)
            .setLabel('▶️ next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index >= allnotes.length - 1 || disabled),

        new ButtonBuilder()
            .setCustomId(`note-del-${id}`)
            .setLabel('🗑️ delete')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
};
export async function execute(interaction) {
    const command = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target')
    const note = interaction.options.getString('note')
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    const guildId = interaction.guild.id

    switch (command) {
        case 'add': {
            try {
                addNote({ userId: targetUser.id, moderatorId: interaction.user.id, note: note, guildId: guildId })
            } catch (err) {
                console.warn(`is not in the user database.`, err)
                interaction.reply({ content: `${targetUser.tag} is not in the User Database` })
            }
            const commandembed = new EmbedBuilder()
                .setColor(0x00a900)
                .setDescription([
                    `📝 note created for <@${targetUser.id}>\n`,
                    ` > ${note}`
                ].join('\n\n'))

            interaction.reply({
                embeds: [commandembed]
            })
            break;
        }
        case 'show': {
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
                components: [await buildNoteButtons(currentIndex, allnotes, currentnote._id)]
            });


            const collector = replyMessage.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: fiveMinutesInMs
            })

            collector.on('collect', async i => {
                const customIdParts = i.customId.split('-');
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
                            const twoDays = 48 * 60 * 60 * 1000
                            if (currentnote.timestamp - Date.now() < twoDays || isAdmin) {
                                await deleteNote(targetUser.id, interaction.guild.id, noteIdToDelete);
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
                            } else
                                interaction.reply({
                                    content: `${interaction.user}, please contact an admin to delete this note as two days have passed.`,
                                    flags: MessageFlags.Ephemeral
                                })

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
                    components: [await buildNoteButtons(currentIndex, allnotes, currentnote._id,)]
                });
            });
            collector.on('end', async () => {
                const finalButtons = await buildNoteButtons(currentIndex, allnotes, currentnote._id, true);
                try {
                    if (replyMessage.embeds > 0 && replyMessage.components[0]) {
                        await replyMessage.edit({ components: [finalButtons] });
                    }
                } catch (error) {
                    console.error('Failed to disable buttons automatically:', error);
                }
            });
        }
    }
}