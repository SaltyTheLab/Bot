import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, GuildMember, AuditLogEvent } from "discord.js";
import punishUser from "../utilities/punishUser.js";
import { stringreactions } from "./Extravariables/reactionrolemap.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";
const maxTitleLength = 45;
const appealinvites = {
    '1231453115937587270': 'https://discord.gg/xpYnPrSXDG',
    '1342845801059192913': 'https://discord.gg/nWj5KvgUt9'
}
const userssubmitted = []

// Function to truncate a string with an ellipsis if it exceeds the max length
function truncate(str, maxLength) {
    if (str.length > maxLength) {
        return str.substring(0, maxLength - 3) + '...';
    }
    return str;
}
export async function interactionCreate(interaction) {
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
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ban_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const customIdParts = interaction.customId.split('_');
            // Correctly parse the user ID, invite code, and inviter ID from the modal's custom ID
            const userIdToBan = customIdParts[2];
            const inviterId = customIdParts[3];
            const inviteCode = customIdParts[4];
            const userToBan = await interaction.guild.members.fetch(userIdToBan).catch(() => null)
                ?? await interaction.client.users.fetch(userIdToBan);

            console.log(`Modal submitted for user ID: ${userIdToBan}, Inviter ID: ${inviterId} `);

            const reason = interaction.fields.getTextInputValue('banReasonInput');

            if (!userToBan) {
                const noUserEmbed = new EmbedBuilder()
                    .setColor(0xFF0000) // Red color for error
                    .setTitle('Ban Failed')
                    .setDescription('Could not find the user to ban. They might have left the server.')
                    .setTimestamp()
                    .setFooter({ text: `Action by: ${interaction.user.tag} `, iconURL: interaction.user.displayAvatarURL() });
                await interaction.editReply({ embeds: [noUserEmbed], ephemeral: false });
                return;
            }

            let banSuccess = false;

            let finalMessage = ``;

            // Ban the user who just joined
            try {
                await punishUser({
                    interaction: interaction,
                    guild: interaction.guild,
                    target: userIdToBan,
                    moderatorUser: interaction.user,
                    reason: `${reason} `,
                    channel: interaction.channel,
                    message: interaction.id,
                    isAutomated: false,
                    banflag: true,
                    buttonflag: true
                });
                banSuccess = true
                finalMessage = `Successfully banned ${userToBan instanceof GuildMember ? userToBan.user.tag : userToBan.tag}.`;
            } catch (error) {
                console.error(`Error banning user ${userToBan.user.tag}: `, error);
                return;
            }

            // Ban the inviter if one exists
            if (inviterId !== 'no inviter') {
                const inviterMember = await interaction.guild.members.fetch(inviterId).catch(() => null);
                try {
                    await punishUser({
                        interaction: interaction,
                        guild: interaction.guild,
                        target: inviterId,
                        moderatorUser: interaction.user,
                        reason: `${reason} `,
                        channel: interaction.channel,
                        isAutomated: false,
                        banflag: true,
                        buttonflag: true
                    });
                    finalMessage += `, inviter ${inviterMember.user.tag}.`;
                } catch (error) {
                    console.error(`Error banning inviter ${inviterMember.user.tag}: `, error);
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
                    console.error(`Error deleting invite ${inviteCode}: `, error);
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
        if (interaction.customId.startsWith('appealModal')) {

            const guildId = interaction.fields.getTextInputValue('guildId');
            const reason = interaction.fields.getTextInputValue('reason');
            const justification = interaction.fields.getTextInputValue('justification');
            const extra = interaction.fields.getTextInputValue('extra');
            if (userssubmitted.findIndex(entry => entry.user === interaction.user.id && entry.guildId) == true)
                interaction.reply('You have already submitted an appeal, please be patient')
            else {
                try {
                    const targetUserid = interaction.user.id
                    // Try to get the guild. This will fail if the bot is not a member.
                    const guild = await interaction.client.guilds.fetch(guildId);
                    const appealChannel = await guild.channels.fetch(guildChannelMap[guild.id].modChannels.appealChannel);
                    const modRole = guild.roles.cache.find(role =>
                        ((role.permissions.has('KickMembers') || role.permissions.has('BanMembers'))) &&
                        role.name.toLowerCase().includes('mod') && !role.managed
                    );
                    const adminRole = guild.roles.cache.find(role => role.permissions.has('Administrator'));

                    if (!appealChannel) {
                        return await interaction.reply({
                            content: 'The appeal channel for that guild could not be found. Please contact a moderator directly.',
                            ephemeral: true
                        });
                    }
                    const appealEmbed = new EmbedBuilder()
                        .setAuthor({
                            name: `${interaction.user.tag})`,
                            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                        })
                        .setColor(0x13cbd8)
                        .setTitle(`Ban appeal`)
                        .addFields(
                            { name: 'Why did you get banned?', value: `${reason}` },
                            { name: 'Why do you believe that your appeal should be accepted?', value: `${justification}` },
                            { name: 'Is there anything else you would like us to know?', value: `${extra}` }
                        )
                        .setFooter({ text: `User ID: ${targetUserid}` })
                        .setTimestamp()

                    const choices = [
                        new ButtonBuilder()
                            .setCustomId(`unban_approve_${reason}_${justification}_${extra}_${targetUserid}_${guildId}`)
                            .setLabel('Approve')
                            .setStyle(ButtonStyle.Success),

                        new ButtonBuilder()
                            .setCustomId(`unban_reject_${reason}_${justification}_${extra}_${targetUserid}__${guildId}`)
                            .setLabel('Reject')
                            .setStyle(ButtonStyle.Danger)
                    ]

                    const actionrow = new ActionRowBuilder()
                        .addComponents(choices)
                    const message = await appealChannel.send({
                        content: `<@&${modRole.id}> <@&${adminRole.id}>`,
                        embeds: [appealEmbed],
                        components: [actionrow]
                    })

                    message.startThread({ name: interaction.user.tag })
                    interaction.reply({ content: 'Your appeal has been submitted and our team will look into it.' })

                } catch (error) {
                    console.error(`Failed to handle ban appeal for guild ID ${guildId}:`, error);
                    // Inform the user that the appeal could not be delivered
                    await interaction.reply({ content: 'The appeal could not be submitted. This may be because the bot is not in that guild. Please contact a moderator for that guild directly.', ephemeral: true });
                }
            }
            userssubmitted.push({ user: interaction.user.id, guildId: guildId });
        }
    }
    if (interaction.isButton()) {
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
        else if (interaction.customId.startsWith('unban_')) {
            await interaction.deferReply();
            const customIdParts = interaction.customId.split('_')
            const action = customIdParts[1];
            const reason = customIdParts[2];
            const justification = customIdParts[3];
            const extra = customIdParts[4];
            const targetUser = await interaction.client.users.fetch(customIdParts[5])
            const appealEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setColor(0x13cbd8)
                .setTitle(`Ban appeal`)
                .addFields(
                    { name: 'Why did you get banned?', value: `${reason}` },
                    { name: 'Why do you believe that your appeal should be accepted?', value: `${justification}` },
                    { name: 'Is there anything else you would like us to know?', value: `${extra}` }
                )
                .setFooter({ text: `User ID: ${targetUser.id}` })
                .setTimestamp()
            const response = new EmbedBuilder()
                .setAuthor({
                    name: `${targetUser.tag}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                })
            if (action === 'reject') {
                response.setColor(0x890000)
                response.setTitle('Appeal Denied...')
                response.setDescription(`${targetUser} your ban appeal has unfortunantly been denied from ${interaction.guild.name}.`)
                appealEmbed.setColor(0x890000)
                appealEmbed.addFields({ name: 'Denied by:', value: `${interaction.user}`, inline: true })
            }
            else if (action === 'approve') {
                const guild = await interaction.client.guilds.fetch(customIdParts[6]);
                let fetchedlogs = await guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberBanAdd,
                    limit: 25
                })
                const banLog = fetchedlogs.entries.find(log => log.target.id === targetUser.id);
                if (!banLog) {
                    interaction.reply(`Could not find a recent ban entry for user ${targetUser}`);
                    return;
                }
                await guild.bans.remove(targetUser, `${reason}`)
                response.setColor(0x008900)
                response.setTitle('Appeal Accepted!')
                response.setDescription(`${targetUser} your ban appeal has been accepted, click below to rejoin the server!\n\n invite: ${appealinvites[guild.id]}`)
                targetUser.send({ embeds: [response] })
                appealEmbed.setColor(0x008900)
                appealEmbed.addFields({ name: 'Approved by:', value: `${interaction.user}`, inline: true })
            }
            const updatedbuttons = [
                new ButtonBuilder()
                    .setCustomId(`unban_approve_${reason}_${justification}_${extra}_${targetUser.id}_${interaction.guild.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`unban_reject_${reason}_${justification}_${extra}_${targetUser.id}__${interaction.guild.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            ]
            const actionrow = new ActionRowBuilder()
                .addComponents(updatedbuttons)
            targetUser.send({ embeds: [response] })
            await interaction.message.edit({
                embeds: [appealEmbed],
                components: [actionrow]
            })

            await interaction.deleteReply();
            const usertoremove = userssubmitted.findIndex(entry => entry.user === targetUser.id && entry.guildid === interaction.guild.id);
            if (usertoremove !== -1) {
                userssubmitted.splice(usertoremove, 1)
            }
        }
    }
    if (interaction.isStringSelectMenu()) {
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
