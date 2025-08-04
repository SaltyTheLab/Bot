import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } from "discord.js";
import banUser from "../utilities/banUser.js";
import { getPunishments, deleteMute, deleteWarn } from "../Database/databaseFunctions.js";
import logRecentCommand from "../Logging/recentCommands.js";

const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    default: 0x888888
};

const buildLogEmbed = async (interaction, log, idx, totalLogs, targetUser) => {
    const moderator = await interaction.client.users.fetch(log.moderatorId);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    const fields = [
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Type', value: `\`${log.type}\``, inline: true },
        { name: 'Channel', value: `<#${log.channel}>`, inline: false },
        { name: 'Reason', value: `\`${log.reason || 'No reason provided'}\``, inline: false },
        { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: false },
    ];

    if (log.type === 'Mute') {
        fields.push({ name: 'Duration', value: `\`${Math.round(log.duration / 60000)} minutes\``, inline: true });
    }
    fields.push({ name: 'Log Status', value: log.active ? '✅ Active' : '❌ Inactive/cleared', inline: true });

    return new EmbedBuilder()
        .setColor(LOG_COLORS[log.type] ?? LOG_COLORS.default)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(fields)
        .setFooter({
            text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
            iconURL: moderator.displayAvatarURL({ dynamic: true })
        });
};
const buildButtons = (idx, totalLogs, targetUserId, isDeletable, logId, logType, timestamp, disabled = false) => {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`modlog_prev_${targetUserId}_${idx}_${timestamp}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === 0 || disabled),
        new ButtonBuilder()
            .setCustomId(`modlog_next_${targetUserId}_${idx}_${timestamp}`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx >= totalLogs - 1 || disabled)
    ];

    if (isDeletable) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`modlog_del_${logId}_${logType}_${targetUserId}_${idx}_${timestamp}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
        );
    }

    return new ActionRowBuilder().addComponents(buttons);
};

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
                // Format: banuser_USERID
                userIdToBan = customIdParts[1];
            } else if (interaction.customId.startsWith('inviter_ban_delete_invite_')) {
                // Format: inviter_ban_delete_invite_MEMBERID_INVITERID_INVITECODE
                // The correct indices are 4 for MEMBERID, 5 for INVITERID, and 6 for INVITECODE
                userIdToBan = customIdParts[4];
                console.log(userIdToBan);
                inviterId = customIdParts[5];
                inviteCode = customIdParts[6];
            }

            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);
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
                .setTitle(`Ban User: ${memberToBan ? memberToBan.user.tag : 'User has left the server'}${inviterId && inviterId !== 'no_inviter' ? ` (Invited by ${inviterId})` : ''}`);

            //create the Text input box 
            const reasonInput = new TextInputBuilder()
                .setCustomId('banReasonInput')
                .setLabel('Reason for ban')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter a detailed reason for the ban.')
                .setRequired(false);

            //add the modal, text input box, and create the embed
            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);
            await interaction.showModal(modal);
        }

        else if (interaction.customId.startsWith('modlog_')) {
            //defer the message to extend wait time
            await interaction.deferUpdate();

            // define constants and split the customid into an array for
            // later use
            const customIdParts = interaction.customId.split('_');
            const action = customIdParts[1];
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const timestamp = parseInt(customIdParts[customIdParts.length - 1]);
            const targetUserId = customIdParts[2];
            let allLogs = await getPunishments(targetUserId);
            const tenMinutesInMs = 10 * 60 * 1000;

            //disable the buttons under the embed after ten minutes
            if (Date.now() - timestamp > tenMinutesInMs) {
                const disabledButtons = buildButtons(
                    parseInt(customIdParts[3]),
                    0,
                    targetUserId,
                    false,
                    null,
                    null,
                    timestamp,
                    true
                );
                await interaction.editReply({
                    components: [disabledButtons]
                })
                return;
            }

            //button switch to navigate and delete the users punishments
            switch (action) {
                case 'prev':
                case 'next': {

                    const currentIndex = parseInt(customIdParts[3]);
                    const newIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;
                    const targetUser = await interaction.client.users.fetch(targetUserId);
                    const currentLog = allLogs[newIndex];

                    await interaction.editReply({
                        embeds: [await buildLogEmbed(interaction, currentLog, newIndex, allLogs.length, targetUser)],
                        components: [buildButtons(newIndex, allLogs.length, targetUserId, isAdmin, currentLog.id, currentLog.type, timestamp)]
                    });
                    break;
                }

                case 'del': {

                    const logId = customIdParts[2];
                    const logType = customIdParts[3];
                    const targetUserId = customIdParts[4];
                    const targetUser = await interaction.client.users.fetch(targetUserId);
                    let currentIndex = parseInt(customIdParts[5]);
                    const currentLog = allLogs[currentIndex];

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

                        if (currentIndex >= allLogs.length) {
                            currentIndex = allLogs.length - 1;
                        }

                        await interaction.editReply({
                            embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length, targetUser)],
                            components: [buildButtons(currentIndex, allLogs.length, targetUserId, isAdmin, currentLog.id, currentLog.type, timestamp)]
                        });

                    } catch (error) {
                        console.error(`Error deleting log ${logId}:`, error);
                        await interaction.followUp({ content: `Failed to delete log: ${error.message}`, ephemeral: true });
                    }
                    break;

                }
            }
        }
    };

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ban_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const customIdParts = interaction.customId.split('_');

            // Correctly parse the user ID, invite code, and inviter ID from the modal's custom ID
            const userIdToBan = customIdParts[2];
            const inviteCode = customIdParts[3];
            const inviterId = customIdParts[4];

            console.log(`Modal submitted for user ID: ${userIdToBan}, Inviter ID: ${inviterId}`);

            const reason = interaction.fields.getTextInputValue('banReasonInput') || 'No reason provided.';
            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);

            if (!memberToBan) {
                await interaction.editReply({ content: 'Could not find the user to ban.', ephemeral: true });
                return;
            }

            let banSuccess = false;
            let inviteDeleted = false;
            let inviterBanSuccess = false;

            let finalMessage = `Successfully banned ${memberToBan.user.tag} for: "${reason}".`;

            // Ban the user who just joined
            try {
                await banUser({
                    guild: interaction.guild,
                    targetUserId: userIdToBan,
                    moderatorUser: interaction.user,
                    reason: reason,
                    channel: interaction.channel,
                    isAutomated: false
                });
                banSuccess = true;
                finalMessage += `Successfully banned ${memberToBan.user.tag} for: "${reason}".`;
            } catch (error) {
                console.error(`Error banning user ${memberToBan.user.tag}:`, error);
                finalMessage += 'There was an error trying to ban this user.';
            }

            // Ban the inviter if one exists
            if (inviterId && inviterId !== 'no_inviter') {
                try {
                    await banUser({
                        guild: interaction.guild,
                        targetUserId: inviterId,
                        moderatorUser: interaction.user,
                        reason: `Invited a troll: "${reason}"`,
                        channel: interaction.channel,
                        isAutomated: false
                    });
                    inviterBanSuccess = true;
                    finalMessage += `\nSuccessfully banned inviter <@${inviterId}>.`;
                } catch (error) {
                    console.error(`Error banning inviter ${inviterId}:`, error);
                    finalMessage += `\nThere was an error trying to ban the inviter <@${inviterId}>.`;
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
                finalMessage += '\nAssociated invite was also deleted.';
            } else if (banSuccess && !inviteDeleted) {
                finalMessage += '\nCould not delete the associated invite.';
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
}
