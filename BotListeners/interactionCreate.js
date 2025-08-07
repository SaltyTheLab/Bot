import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } from "discord.js";
import banUser from "../utilities/banUser.js";
import { getPunishments, deleteMute, deleteWarn, viewNotes, deleteNote } from "../Database/databasefunctions.js";
import logRecentCommand from "../Logging/recentcommands.js";
import { buildButtons, buildLogEmbed, buildNoteEmbed, buildNoteButtons } from "../utilities/buildmodlogembeds.js";

export async function interactionCreate(interaction) {
    // Check if the interaction is a chat input command
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error executing command ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
    // --- BUTTON INTERACTION HANDLER ---
    if (interaction.isButton()) {
        // --- BAN BUTTON LOGIC ---
        if (interaction.customId.startsWith('banuser_') || interaction.customId.startsWith('inviter_ban_delete_invite_')) {
            //split the customId into an array
            const customIdParts = interaction.customId.split('_');
            // Define variables for user ID, invite code, and inviter ID
            let userIdToBan;
            let inviteCode = null;
            let inviterId = null;

            // Use a conditional block to correctly parse the custom ID based on its prefix
            if (interaction.customId.startsWith('banuser_')) {
                userIdToBan = customIdParts[1];
            } else if (interaction.customId.startsWith('inviter_ban_delete_invite_')) {
                userIdToBan = customIdParts[4];
                inviterId = customIdParts[5];
                inviteCode = customIdParts[6];

            }

            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);
            let inviter = inviterId !== 'no inviter' ? interaction.guild.members.fetch(inviterId) : null;

            const fiveMinutesInMs = 5 * 60 * 1000;

            //check permissions for banning, is a valid user and is bannable
            if (!interaction.member.permissions.has('BAN_MEMBERS')) {
                await interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
                return;
            }

            if (!memberToBan) {
                await interaction.reply({ content: 'Could not find the user to ban.', ephemeral: true });
                return;
            }

            if (!memberToBan.bannable) {
                await interaction.reply({ content: 'I cannot ban this user (they may have a higher role or I lack the permissions).', ephemeral: true });
                return;
            }

            // The ban button should only expire if the member is still in the guild.
            // If the member has left (memberToBan is null), the button is still valid.
            if (memberToBan && Date.now() - memberToBan.joinedAt.getTime() > fiveMinutesInMs) {
                await interaction.reply({ content: 'This ban button has expired (5 mins have already passed since they joined).', ephemeral: true });

                const originalMessage = interaction.message;
                const updatedBanButton = new ButtonBuilder()
                    .setCustomId(interaction.customId)
                    .setLabel('🔨 Ban (Expired)')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true);

                const updatedActionRow = new ActionRowBuilder()
                    .addComponents(updatedBanButton);

                await originalMessage.edit({ components: [updatedActionRow] });
                return;
            }

            //create the modal 
            const modal = new ModalBuilder()
                .setCustomId(`ban_modal_${userIdToBan}_${inviteCode}_${inviterId}`)
                .setTitle(`Ban User: ${memberToBan ? memberToBan.user.tag : 'User has left the server'}${inviterId && inviterId !== 'no inviter' ? ` (Invited by ${inviter.tag})` : ''}`);
            const singlemodal = new ModalBuilder()
                .setCustomId(`ban_${userIdToBan}`)
                .setTitle(`Ban User: ${memberToBan ? memberToBan.user.tag : 'User has left the server'}`);
            //create the Text input box 
            const reasonInput = new TextInputBuilder()
                .setCustomId('banReasonInput')
                .setLabel('Reason for ban')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter a detailed reason for the ban.')
                .setRequired(true);

            //add the modal, text input box, and create the embed
            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);
            if (inviterId !== null)
                await interaction.showModal(modal);
            else
                await interaction.showModal(singlemodal)
        }

        else if (interaction.customId.startsWith('modlog_')) {
            //defer the update to extend wait time
            await interaction.deferUpdate();

            // define constants and split the customid into an array for
            // later use
            const customIdParts = interaction.customId.split('_');
            const action = customIdParts[1];
            const targetUserId = customIdParts[2];
            const targetUser = await interaction.client.users.fetch(targetUserId);
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            let allLogs = await getPunishments(targetUserId);

            //button switch to navigate and delete the users punishments
            switch (action) {
                case 'prev':
                case 'next': {

                    const currentIndex = parseInt(customIdParts[3]);
                    const newIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;
                    const currentLog = allLogs[newIndex];

                    await interaction.editReply({
                        embeds: [await buildLogEmbed(interaction, currentLog, newIndex, allLogs.length, targetUser)],
                        components: [await buildButtons(newIndex, allLogs.length, targetUserId, isAdmin, currentLog.id, currentLog.type)]
                    });
                    break;
                }

                case 'del': {
                    const logId = customIdParts[3];
                    const logType = customIdParts[4];
                    let currentIndex = parseInt(customIdParts[5]);
                    let currentLog = allLogs[currentIndex];

                    try {
                        const deleteFn = logType === 'Warn' ? deleteWarn : deleteMute;
                        deleteFn(logId);
                        logRecentCommand(`${logType} log deleted for User ID: ${targetUserId} | Admin: ${interaction.user.tag} | Log ID: ${logId}`);

                        allLogs = await getPunishments(targetUserId);


                        if (allLogs.length === 0) {
                            await interaction.editReply({
                                content: `All modlogs for <@${targetUserId}> have been deleted.`,
                                embeds: [],
                                components: []
                            });
                            return;
                        }

                        currentIndex = Math.min(currentIndex, allLogs.length - 1);
                        const newCurrentLog = allLogs[currentIndex]

                        await interaction.editReply({
                            embeds: [await buildLogEmbed(interaction, newCurrentLog, currentIndex, allLogs.length)],
                            components: [await buildButtons(currentIndex, allLogs.length, targetUserId, isAdmin, currentLog.id, currentLog.type)]
                        });

                    } catch (error) {
                        console.error(`Error deleting log ${logId}:`, error);
                        await interaction.followUp({ content: `Failed to delete log: ${error.message}`, ephemeral: true });
                    }
                    break;

                }
            }
        }

        else if (interaction.customId.startsWith("note_")) {

            await interaction.deferUpdate();
            const customIdParts = interaction.customId.split('_');
            const action = customIdParts[1];
            const target = await interaction.client.users.fetch(customIdParts[2]);
            let index = parseInt(customIdParts[3]);
            let allNotes = await viewNotes(target.id)

            switch (action) {
                case "prev":
                case "next": {
                    let newIndex = action === "next" ? index + 1 : index - 1;
                    const currentNote = allNotes[newIndex]
                    await interaction.editReply({
                        embeds: [await buildNoteEmbed(interaction, newIndex, currentNote, allNotes.length)],
                        components: [await buildNoteButtons(target.id, newIndex, currentNote, allNotes.length)]
                    })
                    break;
                }
                case "delete": {
                    const noteid = parseInt(customIdParts[4]);
                    try {
                        deleteNote(noteid);
                        allNotes = await viewNotes(target.id);
                        if (allNotes.length === 0) {
                            await interaction.editReply({
                                content: `All notes for ${target} have been deleted`,
                                embeds: [],
                                components: []
                            })
                            return;
                        }

                        index = Math.min(index - 1, allNotes.length - 1);
                        let note = allNotes[index]
                        await interaction.editReply({
                            embeds: [await buildNoteEmbed(interaction, index, note, allNotes.length)],
                            componenets: [await buildNoteButtons(target.id, index, note, allNotes)]
                        });

                    } catch (error) {
                        console.error(`Error deleting log ${noteid}:`, error);
                        await interaction.followUp({ content: `Failed to delete note: ${error.message}`, ephemeral: true });
                    }
                    break;
                }
            }

        }
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ban_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const customIdParts = interaction.customId.split('_');

            // Correctly parse the user ID, invite code, and inviter ID from the modal's custom ID
            const userIdToBan = customIdParts[2];
            const inviteCode = customIdParts[3];
            const inviterId = customIdParts[4];


            console.log(`Modal submitted for user ID: ${userIdToBan}, Inviter ID: ${inviterId}`);

            const reason = interaction.fields.getTextInputValue('banReasonInput');
            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);
            let inviter = inviterId !== 'no inviter' ? interaction.guild.members.fetch(inviterId) : null;

            if (!memberToBan) {
                await interaction.editReply({ content: 'Could not find the user to ban.', ephemeral: true });
                return;
            }

            let banSuccess = false;
            let inviteDeleted = false;
            let inviterBanSuccess = false;

            let finalMessage = ``;

            // Ban the user who just joined
            try {
                await banUser({
                    guild: interaction.guild,
                    targetUserId: userIdToBan,
                    moderatorUser: interaction.user,
                    reason: reason,
                    channel: interaction.channel.id,
                    isAutomated: false
                });
                banSuccess = true;
                finalMessage = `Successfully banned ${memberToBan.user.tag}. `;
            } catch (error) {
                console.error(`Error banning user ${memberToBan.user.tag}:`, error);
                finalMessage = 'There was an error trying to ban this user.';
            }

            // Ban the inviter if one exists
            if (inviterId && inviterId !== 'no inviter') {
                try {
                    await banUser({
                        guild: interaction.guild,
                        targetUserId: inviterId,
                        moderatorUser: interaction.user,
                        reason: `${reason}`,
                        channel: interaction.channel,
                        isAutomated: false
                    });
                    inviterBanSuccess = true;
                    finalMessage += `, inviter ${inviter.user.tag}.`;
                } catch (error) {
                    console.error(`Error banning inviter ${inviter.user.tag}:`, error);
                    finalMessage += `There was an error trying to ban the inviter <@${inviter.user.tag}>.`;
                }
            }
            //delete the invite if successful and invitecode exists
            if (banSuccess && inviteCode !== 'no_invite_code') {
                try {
                    const invite = await interaction.guild.invites.fetch(inviteCode);
                    if (invite) {
                        await invite.delete();
                        inviteDeleted = true;
                    }
                } catch (error) {
                    console.error(`Error deleting invite ${inviteCode}:`, error);
                }
            }

            if (banSuccess && inviteDeleted && inviterBanSuccess) {
                finalMessage += ' and associated invite was also deleted.';
            } else if (banSuccess && !inviteDeleted) {
                finalMessage += 'Could not delete the associated invite.';
            }

            await interaction.editReply({ content: finalMessage, ephemeral: false });

            const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
            const updatedBanButton = new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('🔨 Banned!')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true);

            const updatedActionRow = new ActionRowBuilder()
                .addComponents(updatedBanButton);

            await originalMessage.edit({ components: [updatedActionRow] });
        }
    }
};

