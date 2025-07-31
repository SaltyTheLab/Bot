import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } from "discord.js";
// The 'client' object is accessible via 'interaction.client' within this event handler.

// --- IMPORTS FROM MODLOGS ---
// These are now needed to handle the modlogs button interactions
import { deleteMute, deleteWarn, getPunishments } from '../Database/databasefunctions.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

// --- HELPER FUNCTIONS FROM MODLOGS ---
const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    default: 0x888888
};

function calculateWarnCounts(logs) {
    let warnCount = 0;
    const sortedForCalculation = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    return sortedForCalculation.map(log => {
        if (log.type === 'Warn' && log.active) {
            warnCount++;
        }
        return { ...log, warnCountAtThisTime: warnCount };
    });
}

const buildLogEmbed = async (log, idx, totalLogs, targetUser, moderatorUser) => {
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
        { name: 'Warns at Log Time', value: `\`${log.warnCountAtThisTime}\``, inline: false },
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
            text: `Staff: ${moderatorUser.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
            iconURL: moderatorUser.displayAvatarURL({ dynamic: true })
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
            const customIdParts = interaction.customId.split('_');
            const userIdToBan = customIdParts[customIdParts.length > 2 ? 2 : 1];
            const inviteCode = customIdParts[customIdParts.length > 4 ? 4 : null];
            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);
            const fiveMinutesInMs = 5 * 60 * 1000;
            const joinedTimestamp = memberToBan ? memberToBan.joinedAt.getTime() : 0;


            if (Date.now() - joinedTimestamp > fiveMinutesInMs) {
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

            const inviterId = customIdParts.length > 3 ? customIdParts[3] : null;

            const modal = new ModalBuilder()
                .setCustomId(`ban_modal_${userIdToBan}_${inviteCode}`)
                .setTitle(`Ban User: ${memberToBan.user.tag}${inviterId && inviterId !== 'no_inviter' ? ` (Invited by ${inviterId})` : ''}`);

            const reasonInput = new TextInputBuilder()
                .setCustomId('banReasonInput')
                .setLabel('Reason for ban')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter a detailed reason for the ban.')
                .setRequired(false);

            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        }

        // --- MODLOGS BUTTON LOGIC ---
        else if (interaction.customId.startsWith('modlog_')) {
            await interaction.deferUpdate();

            const customIdParts = interaction.customId.split('_');
            const action = customIdParts[1];
            const moderatorMember = interaction.member;
            const isAdmin = moderatorMember.permissions.has(PermissionsBitField.Flags.Administrator);
            const timestamp = parseInt(customIdParts[customIdParts.legnth - 1]);
            const tenMinutesInMs = 10 * 60 * 1000;

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


            switch (action) {
                case 'prev':
                case 'next': {
                    const targetUserId = customIdParts[2];
                    const currentIndex = parseInt(customIdParts[3]);
                    const newIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;

                    const allLogs = await getPunishments(targetUserId);
                    const logsWithCounts = calculateWarnCounts(allLogs);
                    const totalLogs = logsWithCounts.length;

                    const targetUser = await interaction.client.users.fetch(targetUserId);
                    const currentLog = logsWithCounts[newIndex];


                    await interaction.editReply({
                        embeds: [await buildLogEmbed(currentLog, newIndex, totalLogs, targetUser, moderatorMember)],
                        components: [buildButtons(newIndex, totalLogs, targetUserId, isAdmin, currentLog.id, currentLog.type, timestamp)]
                    });
                    break;
                }

                case 'del': {

                    const logId = customIdParts[2];
                    const logType = customIdParts[3];
                    const targetUserId = customIdParts[4];
                    let currentIndex = parseInt(customIdParts[5]);

                    try {
                        const deleteFn = logType === 'Warn' ? deleteWarn : deleteMute;
                        deleteFn(logId);
                        logRecentCommand(`${logType} log deleted for User ID: ${targetUserId} | Admin: ${interaction.user.tag} | Log ID: ${logId}`);

                        let allLogs = await getPunishments(targetUserId);
                        const logsWithCounts = calculateWarnCounts(allLogs);

                        if (logsWithCounts.length === 0) {
                            await interaction.editReply({
                                content: `All modlogs for <@${targetUserId}> have been deleted.`,
                                embeds: [],
                                components: []
                            });
                            return;
                        }

                        if (currentIndex >= logsWithCounts.length) {
                            currentIndex = logsWithCounts.length - 1;
                        }

                        const targetUser = await interaction.client.users.fetch(targetUserId);
                        const currentLog = logsWithCounts[currentIndex];
                        const logIsDeletable = isAdmin && currentLog.active;

                        await interaction.editReply({
                            embeds: [await buildLogEmbed(currentLog, currentIndex, logsWithCounts.length, targetUser, moderatorMember)],
                            components: [buildButtons(currentIndex, logsWithCounts.length, targetUserId, logIsDeletable, currentLog.id, currentLog.type, timestamp)]
                        });

                    } catch (error) {
                        console.error(`Error deleting log ${logId}:`, error);
                        await interaction.followUp({ content: `Failed to delete log: ${error.message}`, ephemeral: true });
                    }
                    break;

                }
            }
        }
    }

    // --- MODAL SUBMISSION HANDLER ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ban_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const customIdParts = interaction.customId.split('_');
            const userIdToBan = customIdParts[1];
            const inviteCode = customIdParts[2];
            const reason = interaction.fields.getTextInputValue('banReasonInput') || 'No reason provided.';
            const memberToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null);

            if (!memberToBan) {
                await interaction.editReply({ content: 'Could not find the user to ban.', ephemeral: true });
                return;
            }

            let banSuccess = false;
            let inviteDeleted = false;
            
            let finalMessage = `Successfully banned ${memberToBan.user.tag} for: "${reason}".`;

            try {
                await memberToBan.ban({ reason: reason });
                banSuccess = true;
            } catch (error) {
                console.error(`Error banning user ${memberToBan.user.tag}:`, error);
                finalMessage = 'There was an error trying to ban this user.';
            }

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

            if (banSuccess && inviteDeleted) {
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
