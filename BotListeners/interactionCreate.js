import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, GuildMember } from "discord.js";
import punishUser from "../utilities/punishUser.js";
import { stringreactions } from "./Extravariables/reactionrolemap.js";
const maxTitleLength = 45;

// Function to truncate a string with an ellipsis if it exceeds the max length
function truncate(str, maxLength) {
    if (str.length > maxLength) {
        return str.substring(0, maxLength - 3) + '...';
    }
    return str;
}
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
    else if (interaction.isButton()) {
        // --- BAN BUTTON LOGIC ---

        if (interaction.customId.startsWith('inviter_ban_delete_invite_')) {
            //split the customId into an array
            const customIdParts = interaction.customId.split('_');
            const memberToBan = await interaction.guild.members.fetch(customIdParts[4]).catch(() => null)
                ?? await interaction.client.users.fetch(customIdParts[4]).catch(() => null);
            const inviterId = customIdParts[5];
            const inviteCode = customIdParts[6];

            const fiffteenMinutesInMs = 15 * 60 * 1000;
            const messageAge = Date.now() - interaction.message.createdTimestamp

            //check permissions for banning, is a valid user and is bannable
            if (!interaction.member.permissions.has('BAN_MEMBERS')) {
                await interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
                return;
            }

            if (messageAge > fiffteenMinutesInMs) {
                await interaction.reply({ content: 'This ban button has expired (15 mins have already passed since they joined).', ephemeral: true });

                const originalMessage = interaction.message;
                const banbuttonLabel = originalMessage.components[0].components[0].label;
                if (banbuttonLabel == '🔨 Ban User & Delete Invite' || banbuttonLabel === '🔨 Ban') {
                    const updatedBanButton = new ButtonBuilder()
                        .setCustomId(interaction.customId)
                        .setLabel(banbuttonLabel == '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)' : '🔨 Ban (Expired)')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true);

                    const updatedActionRow = new ActionRowBuilder()
                        .addComponents(updatedBanButton);

                    await originalMessage.edit({ components: [updatedActionRow] });
                    return;
                }
            }

            let inviter = null;
            if (inviterId != 'no inviter') {
                inviter = await interaction.guild.members.fetch(inviterId).catch(() => null)
            }

            let memberTag = memberToBan instanceof GuildMember ? memberToBan.user.tag : memberToBan.tag;
            let inviterTag = inviterId && inviterId !== 'no inviter' ? inviter.user.tag : '';

            // Calculate available space for inviter tag
            const baseTitle = `Ban User: ${truncate(memberTag, maxTitleLength)}`;
            let modalTitle = baseTitle;

            if (inviterTag) {
                // Check if adding the inviter tag will exceed the limit
                const inviterPart = ` (Invited by ${truncate(inviterTag, maxTitleLength - baseTitle.length)})`;
                if (baseTitle.length + inviterPart.length <= maxTitleLength) {
                    modalTitle += inviterPart;
                }
            }
            //create the modal 
            const modal = new ModalBuilder()
                .setCustomId(`ban_modal_${memberToBan.id}_${inviterId}_${inviteCode}`)
                .setTitle(modalTitle);
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
            await interaction.showModal(modal);
        }
    }
    else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ban_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const customIdParts = interaction.customId.split('_');
            // Correctly parse the user ID, invite code, and inviter ID from the modal's custom ID
            const userIdToBan = customIdParts[2];
            const inviterId = customIdParts[3];
            const inviteCode = customIdParts[4];
            const userToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null)
                ?? await interaction.client.users.fetch(userIdToBan);

            console.log(`Modal submitted for user ID: ${userIdToBan}, Inviter ID: ${inviterId}`);

            const reason = interaction.fields.getTextInputValue('banReasonInput');

            if (!userToBan) {
                const noUserEmbed = new EmbedBuilder()
                    .setColor(0xFF0000) // Red color for error
                    .setTitle('Ban Failed')
                    .setDescription('Could not find the user to ban. They might have left the server.')
                    .setTimestamp()
                    .setFooter({ text: `Action by: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
                await interaction.editReply({ embeds: [noUserEmbed], ephemeral: false });
                return;
            }

            let banSuccess = false;

            let finalMessage = ``;

            // Ban the user who just joined
            try {
                await punishUser({
                    guild: interaction.guild,
                    target: userIdToBan,
                    moderatorUser: interaction.user,
                    reason: `${reason}`,
                    channel: interaction.channel,
                    isAutomated: false,
                    banflag: true,
                    buttonflag: true
                });
                banSuccess = true
                finalMessage = `Successfully banned ${userToBan instanceof GuildMember ? userToBan.user.tag : userToBan.tag}. `;
            } catch (error) {
                console.error(`Error banning user ${userToBan.user.tag}:`, error);
                return;
            }

            // Ban the inviter if one exists
            if (inviterId !== 'no inviter') {
                const inviterMember = await interaction.guild.members.fetch(inviterId).catch(() => null);
                try {
                    await punishUser({
                        guild: interaction.guild,
                        target: inviterId,
                        moderatorUser: interaction.user,
                        reason: `${reason}`,
                        channel: interaction.channel,
                        isAutomated: false,
                        banflag: true,
                        buttonflag: true
                    });
                    finalMessage += `, inviter ${inviterMember.user.tag}.`;
                } catch (error) {
                    console.error(`Error banning inviter ${inviterMember.user.tag}:`, error);
                }
            }
            //delete the invite if successful and invitecode exists
            if (banSuccess && inviteCode !== 'no invite code') {
                try {
                    const invite = await interaction.guild.invites.fetch(inviteCode);
                    if (invite) {
                        await invite.delete();

                    }

                } catch (error) {
                    console.error(`Error deleting invite ${inviteCode}:`, error);
                }
                finalMessage += ' Associated Invite was deleted'
            }
            else {
                finalMessage += ' No associated invite to delete.'
            }

            const finalreply = new EmbedBuilder()
                .setDescription(finalMessage);


            await interaction.editReply({ embeds: [finalreply] });

            const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
            const updatedBanButton = new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel(inviterId !== 'no inviter' ? '🔨 Banned User and Inviter!' : '🔨 Banned!')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true);

            const updatedActionRow = new ActionRowBuilder()
                .addComponents(updatedBanButton);

            await originalMessage.edit({ components: [updatedActionRow] });
        }
    }
    else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'stream_role_select' || interaction.customId === 'Game_role_Select') {
            await interaction.deferReply({ ephemeral: true })
            const member = interaction.member;
            const guildid = interaction.guild.id;
            const reactions = stringreactions[guildid].roles
            const rolesAdded = [];
            const rolesRemoved = [];

            const allPossibleSelectValues = Object.keys(stringreactions[guildid].roles).filter(() => {
                return true;
            });

            for (const roleValue of allPossibleSelectValues) {
                const roleID = reactions[roleValue];

                if (!roleID) {
                    console.warn(`⚠️ No role mapped for select menu value: ${roleValue}. Skipping.`);
                    continue;
                }

                // If the role is selected in the current interaction
                if (interaction.values.includes(roleValue)) {
                    // Add role if member doesn't have it
                    if (!member.roles.cache.has(roleID)) {
                        try {
                            await member.roles.add(roleID);
                            rolesAdded.push(`<@&${roleID}>`);
                        } catch (err) {
                            console.error(`❌ Failed to add role ${roleID} to ${member.user.tag}:`, err);
                        }
                    }
                } else {
                    // Remove role if member has it but it's NOT selected in the current interaction
                    if (member.roles.cache.has(roleID)) {
                        try {
                            await member.roles.remove(roleID);
                            rolesRemoved.push(`<@&${roleID}>`);
                        } catch (err) {
                            console.error(`❌ Failed to remove role ${roleID} from ${member.user.tag}:`, err);
                        }
                    }
                }
            }
            let replyContent = '';
            if (rolesAdded.length > 0) {
                replyContent += `Added: ${rolesAdded.join(', ')}\n`;
            }
            if (rolesRemoved.length > 0) {
                replyContent += `Removed: ${rolesRemoved.join(', ')}\n`;
            }
            if (!replyContent) {
                replyContent = 'No role changes were made.';
            }

            await interaction.editReply({ content: replyContent, ephemeral: true });
            console.log(`✅ Roles updated for ${member.user.tag} via select menu. Added: [${rolesAdded.join(', ')}], Removed: [${rolesRemoved.join(', ')}]`);
        }
    }
}
