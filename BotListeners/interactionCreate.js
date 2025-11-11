import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, AuditLogEvent, PermissionFlagsBits, MessageFlags } from "discord.js";
import punishUser from "../moderation/punishUser.js";
import { appealsinsert, appealsget, appealupdate } from "../Database/databasefunctions.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
const appealinvites = {
    '1231453115937587270': 'https://discord.gg/xpYnPrSXDG',
    '1342845801059192913': 'https://discord.gg/nWj5KvgUt9'
}
const filepath = "Extravariables/applications.json"
let applications = await load(filepath)

export async function interactionCreate(interaction) {

    if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;
        let command = interaction.client.commands.get(commandName) ?? interaction.client.commands.get(`${interaction.guild.id}:${commandName}`)
        if (!command) {
            console.warn(`[WARN] Command '${commandName}' not found in map.`);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Sorry, that command is not currently available.', flags: MessageFlags.Ephemeral });
            }
            return;
        }
        try {
            command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error executing command ${commandName}: `, error);
            if (interaction.replied || interaction.deferred)
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            else
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('appeal')) {
            const guildId = interaction.fields.getTextInputValue('guildId');
            const reason = interaction.fields.getTextInputValue('reason');
            const justification = interaction.fields.getTextInputValue('justification');
            const extra = interaction.fields.getTextInputValue('extra');
            try {
                const targetUserid = interaction.user.id
                // Try to get the guild. This will fail if the bot is not a member.
                const guild = interaction.client.guilds.cache.get(guildId);
                const appealChannel = interaction.client.channels.get(guildChannelMap[guild.id].modChannels.appealChannel);
                const modRole = guild.roles.cache.find(role =>
                    ((role.permissions.has('KickMembers') || role.permissions.has('BanMembers'))) &&
                    role.name.toLowerCase().includes('mod') && !role.managed
                );
                const adminRole = guild.roles.cache.find(role => role.permissions.has('Administrator') && role.name.toLowerCase().includes('admin'));

                if (!appealChannel) {
                    return await interaction.reply({
                        content: 'The appeal channel for that guild could not be found. Please contact a moderator directly.',
                        flags: MessageFlags.Ephemeral
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
                        .setCustomId(`unban_approve_${targetUserid}_${guildId}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId(`unban_reject_${targetUserid}_${guildId}`)
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
                await interaction.reply({ content: 'The appeal could not be submitted. This may be because the bot is not in that guild. Please contact a moderator for that guild directly.', flags: MessageFlags.Ephemeral });
            }
            appealsinsert(interaction.user.id, guildId, reason, justification, extra);
        }
        if (interaction.customId.startsWith('situations')) {
            applications = await load(filepath);
            const application = applications[interaction.user.id]
            application.dmmember = interaction.fields.getTextInputValue('dmmember')
            application.argument = interaction.fields.getTextInputValue('arguments')
            application.ambiguous = interaction.fields.getTextInputValue('rulebreakdm')
            application.staffbreakrule = interaction.fields.getTextInputValue('staffrulebreak')
            application.illegal = interaction.fields.getTextInputValue('illegal')
            const applicationChannelid = guildChannelMap[application.guild].modChannels.applicationChannel
            const applicationChannel = await interaction.client.channels.fetch(applicationChannelid)
            const guild = await interaction.client.guilds.cache.get(application.guild)
            const applicationembed = new EmbedBuilder()
                .setAuthor({
                    name: `@${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setColor(0x13b6df)
                .setTitle(`Mod Application for ${guild.name}`)
                .addFields(
                    { name: 'Age Range:', value: `${application.Agerange}`, inline: false },
                    { name: 'Prior Experience:', value: `${application.Experience}`, inline: false },
                    { name: 'Have you been warned/muted/kicked/banned before?(be honest)', value: `${application.History}`, inline: false },
                    { name: 'Timezone:', value: `${application.Timezone}`, inline: false },
                    { name: `How long have you been a member in ${guild.name}?`, value: `${application.Stayed}` },
                    { name: `How active are you in ${guild.name}?`, value: `${application.Activity}`, inline: false },
                    { name: 'Why do you want to be a mod?:', value: `${application.Why}`, inline: false },
                    { name: 'What is your definition of a troll?', value: `${application.Trolldef}`, inline: false },
                    { name: 'What is your definition of a raid?', value: `${application.Raiddef}` },
                    { name: 'You disagree with a staff punishment. What would you do?', value: `${application.Staffissues}`, inline: false },
                    { name: 'How would you handle a member report?', value: `${application.Memberreport}`, inline: false },
                    { name: 'A member messages you about being harrassed. How would you handle the situation?', value: `${application.dmmember}`, inline: false },
                    { name: 'Users are arguing in general chat. explain your de-escalation steps.', value: `${application.argument}`, inline: false },
                    { name: 'A member DMs you about a rule-breaking DM. What is your course of action?', value: `${application.ambiguous}`, inline: false },
                    { name: 'A moderator is breaking a rule. What is your course of action?', value: `${application.staffbreakrule}`, inline: false },
                    { name: 'A user share illegal content. What are the steps you take?', value: `${application.illegal}`, inline: false }
                )

            applicationChannel.send({
                embeds: [applicationembed]
            })
            interaction.reply({
                content: 'your application was successfuly submitted!!'
            })
            delete applications[interaction.user.id];
            save(filepath, applications)
        }
        if (interaction.customId.startsWith('Defs, reasons, and issues')) {
            applications = await load(filepath)
            const application = applications[interaction.user.id]
            if (application.Memberreport) {
                const nextButton = new ButtonBuilder()
                    .setCustomId('next_modal_three')
                    .setLabel('skip section')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder()
                    .addComponents(nextButton);

                await interaction.reply({
                    content: 'You have already filled out this section. Click the button below to continue to the next section.',
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
                return;
            } else {
                application.Why = interaction.fields.getTextInputValue('why')
                application.Trolldef = interaction.fields.getTextInputValue('trolldef')
                application.Raiddef = interaction.fields.getTextInputValue('raiddef')
                application.Staffissues = interaction.fields.getTextInputValue('staffissues')
                application.Memberreport = interaction.fields.getTextInputValue('memberreport')
                await save(filepath, applications);
                const nextButton = new ButtonBuilder()
                    .setCustomId('next_modal_three')
                    .setLabel('Continue Application')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder()
                    .addComponents(nextButton);

                await interaction.reply({
                    content: 'Part 2 of your application has been submitted! Click the button below to continue to the next section.',
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });

            }
        }
        if (interaction.customId.startsWith('server')) {
            applications = await load(filepath)
            const application = applications[interaction.user.id]
            application.Experience = interaction.fields.getTextInputValue('experience')
            application.History = interaction.fields.getTextInputValue('punishments')
            application.Timezone = interaction.fields.getTextInputValue('timezone')
            application.Stayed = interaction.fields.getTextInputValue('length')
            application.Activity = interaction.fields.getTextInputValue('activity')
            await save(filepath, applications)
            const nextButton = new ButtonBuilder()
                .setCustomId('next_modal_two')
                .setLabel('Continue Application')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
                .addComponents(nextButton);
            interaction.reply({
                content: 'Part 1 of your application has been submitted! Click the button below to continue to the next section.',
                components: [row],
                flags: MessageFlags.Ephemeral
            })
        }
    }
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ban_')) {
            const customIdParts = interaction.customId.split('_');
            const memberToBan = await interaction.guild.members.fetch(customIdParts[1]).catch(() => null) ?? await interaction.client.users.fetch(customIdParts[1]).catch(() => null);
            const inviterId = customIdParts[2];
            const inviteCode = customIdParts[3];
            const fiffteenMinutesInMs = 15 * 60 * 1000;
            const messageAge = Date.now() - interaction.message.createdTimestamp

            if (!interaction.member.permissions.has('BAN_MEMBERS')) {
                await interaction.reply({ content: 'You do not have permission to ban members.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (messageAge > fiffteenMinutesInMs) {
                await interaction.reply({ content: 'This ban button has expired (15 mins have already passed since they joined).', flags: MessageFlags.Ephemeral });

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
            const messageid = interaction.message.id;
            let finalMessage = ``;

            await punishUser({ interaction: interaction, guild: interaction.guild, target: memberToBan, moderatorUser: interaction.user, reason: 'troll', channel: interaction.channel, banflag: true, messageid: messageid });
            finalMessage = `Banned <@${memberToBan}>`;

            if (inviterId !== 'no inviter') {
                await punishUser({ interaction: interaction, guild: interaction.guild, target: inviterId, moderatorUser: interaction.user, reason: 'troll', channel: interaction.channel, banflag: true, messageid: messageid });
                finalMessage += `, inviter <@${inviterId}>.`;
            }

            if (inviteCode !== 'no invite code') {
                const invite = await interaction.guild.invites.fetch(inviteCode);
                if (invite) {
                    let invites = await load("Extravariables/invites.json")
                    invites = invites.filter(inv => inv.key !== `${invite.guild.id}-${invite.code}`)
                    await save("Extravariables/invites.json", invites)
                    await invite.delete()
                }
                finalMessage += ' Associated Invite was deleted'
            }

            const finalreply = new EmbedBuilder()
                .setDescription(finalMessage);

            await interaction.reply({ embeds: [finalreply] });

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
        if (interaction.customId.startsWith('unban_')) {
            await interaction.deferReply();
            const customIdParts = interaction.customId.split('_')
            const action = customIdParts[1];
            const targetUser = await interaction.client.users.fetch(customIdParts[2])
            const guild = interaction.client.guilds.cache.get(customIdParts[3]);
            const appeals = await appealsget(targetUser.id, guild.id)
            let outcome = false
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator)
            const Adminchannel = guildChannelMap[guild.id].modChannels.AdminChannel
            if (!isAdmin) {
                interaction.reply({ content: `Please wait for an admin to make a decision. `, flags: MessageFlags.Ephemeral })
                Adminchannel.send({ content: `Letting you know ${interaction.user} tried to jump the gun on an appeal.` })
                return;
            }
            const appealEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `${targetUser.tag} `,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                })
                .setColor(0x13cbd8)
                .setTitle(`Ban appeal`)
                .addFields(
                    { name: 'Why did you get banned?', value: `${appeals[0].reason} ` },
                    { name: 'Why do you believe that your appeal should be accepted?', value: `${appeals[0].justification} ` },
                    { name: 'Is there anything else you would like us to know?', value: `${appeals[0].extra}` })
                .setFooter({ text: `User ID: ${targetUser.id} ` })
                .setTimestamp()
            const response = new EmbedBuilder()
                .setAuthor({
                    name: `${targetUser.tag} `,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                })

            switch (action) {
                case 'reject':
                    response.setColor(0x890000)
                    response.setTitle('Appeal Denied...')
                    response.setDescription(`${targetUser} your ban appeal has unfortunantly been denied from ${interaction.guild.name}.`)
                    appealEmbed.setColor(0x890000)
                    appealEmbed.addFields(
                        { name: 'Denied by:', value: `${interaction.user} `, inline: true })
                    break;
                case 'approve': {
                    const fetchedlogs = await guild.fetchAuditLogs({
                        type: AuditLogEvent.MemberBanAdd,
                        limit: 25
                    })
                    const banLog = fetchedlogs.entries.find(log => log.target.id === targetUser.id);
                    if (!banLog) {
                        interaction.editReply(`Could not find a recent ban entry for user ${targetUser}`);
                        return;
                    }
                    await guild.bans.remove(targetUser, `Ban Command: ${appeals[0].reason}`)
                    response.setColor(0x008900)
                    response.setTitle('Appeal Accepted!')
                    response.setDescription(`${targetUser} your ban appeal has been accepted, click below to rejoin the server!\n\n invite: ${appealinvites[guild.id]} `)
                    targetUser.send({ embeds: [response] })
                    appealEmbed.setColor(0x008900)
                    appealEmbed.addFields(
                        { name: 'Approved by:', value: `${interaction.user} `, inline: true })
                    outcome = true
                    break;
                }
            }
            const updatedbuttons = [
                new ButtonBuilder()
                    .setCustomId(`unban_approve_${targetUser.id}_${interaction.guild.id} `)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`unban_reject_${targetUser.id}__${interaction.guild.id} `)
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
            await appealupdate(targetUser.id, guild.id, outcome)
            await interaction.deleteReply();
        }
        if (interaction.customId.startsWith('next_modal_three')) {
            const situationmodal = new ModalBuilder()
                .setCustomId('situations')
                .setTitle('Situations (3/3)')

            const dmmember = new TextInputBuilder()
                .setCustomId('dmmember')
                .setLabel('A member messages you about being harrassed')
                .setPlaceholder('How would you handle the situation?')
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(350)

            const argument = new TextInputBuilder()
                .setCustomId('arguments')
                .setLabel('Users are arguing in general chat')
                .setPlaceholder('explain your de-escalation steps')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(350)

            const ambiguous = new TextInputBuilder()
                .setCustomId('rulebreakdm')
                .setLabel('A member DMs you about a rule-breaking DM')
                .setPlaceholder('What is your course of action?')
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(350)

            const staffbreakrule = new TextInputBuilder()
                .setCustomId('staffrulebreak')
                .setLabel('Staff is failing to follow the rules')
                .setPlaceholder('What is your course of action')
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(350)

            const illegalcontent = new TextInputBuilder()
                .setCustomId('illegal')
                .setLabel('A user shares illegal content')
                .setPlaceholder('What are the steps you take?')
                .setRequired(true)
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(350)

            const questionOne = new ActionRowBuilder().addComponents(dmmember)
            const questionTwo = new ActionRowBuilder().addComponents(argument)
            const questionThree = new ActionRowBuilder().addComponents(ambiguous)
            const questionFour = new ActionRowBuilder().addComponents(staffbreakrule)
            const questionFive = new ActionRowBuilder().addComponents(illegalcontent)

            situationmodal.addComponents(questionOne, questionTwo, questionThree, questionFour, questionFive)

            interaction.showModal(situationmodal)
        }
        if (interaction.customId.startsWith('next_modal_two')) {
            applications = await load(filepath);
            const application = applications[interaction.user.id]

            if (application.Memberreport) {
                const nextButton = new ButtonBuilder()
                    .setCustomId('next_modal_three')
                    .setLabel('skip part 2')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder()
                    .addComponents(nextButton);

                await interaction.reply({
                    content: 'You have already filled out this part. Click the button below to continue to the next section.',
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                const questionsTwo = new ModalBuilder()
                    .setCustomId('Defs, reasons, and issues')
                    .setTitle('Definitions, Why mod, and Staff issues (2/3)')


                const questionOne = new TextInputBuilder()
                    .setCustomId('why')
                    .setLabel('Why pick you & Tell us about yourself')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(500)

                const questionTwo = new TextInputBuilder()
                    .setCustomId('trolldef')
                    .setLabel('What is your definition of a troll?')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(65)

                const questionThree = new TextInputBuilder()
                    .setCustomId('raiddef')
                    .setLabel('What is your definition of a raid?')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(65)

                const questionFour = new TextInputBuilder()
                    .setCustomId('staffissues')
                    .setLabel('You disagree with a staff punishment...')
                    .setPlaceholder('What would you do?')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(300)

                const questionFive = new TextInputBuilder()
                    .setCustomId('memberreport')
                    .setLabel('How would you handle a member report?')
                    .setPlaceholder('Describe the steps you would take to investigate and resolve it')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(300)

                const firstActionRow = new ActionRowBuilder().addComponents(questionOne);
                const secondActionRow = new ActionRowBuilder().addComponents(questionTwo);
                const thirdActionRow = new ActionRowBuilder().addComponents(questionThree);
                const fourthActionRow = new ActionRowBuilder().addComponents(questionFour);
                const fifthActionRow = new ActionRowBuilder().addComponents(questionFive);
                questionsTwo.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
                interaction.showModal(questionsTwo);
            }
        }
    }
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'stream_role_select' || interaction.customId === 'Game_role_Select') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral })
            const member = interaction.member;
            const guildid = interaction.guild.id;
            const reactions = guildChannelMap[guildid].roles
            const rolesAdded = [];
            const rolesRemoved = [];

            const allPossibleSelectValues = Object.keys(reactions).filter(() => {
                return true;
            });

            for (const roleValue of allPossibleSelectValues) {
                const roleID = reactions[roleValue];

                if (!roleID) {
                    console.warn(`⚠️ No role mapped for select menu value: ${roleValue}.Skipping.`);
                    continue;
                }

                // If the role is selected in the current interaction
                if (interaction.values.includes(roleValue)) {
                    // Add role if member doesn't have it
                    if (!member.roles.cache.has(roleID)) {
                        try {
                            await member.roles.add(roleID);
                            rolesAdded.push(`<@&${roleID}> `);
                        } catch (err) {
                            console.error(`❌ Failed to add role ${roleID} to ${member.user.tag}: `, err);
                        }
                    }
                } else {
                    // Remove role if member has it but it's NOT selected in the current interaction
                    if (member.roles.cache.has(roleID)) {
                        try {
                            await member.roles.remove(roleID);
                            rolesRemoved.push(`<@&${roleID}> `);
                        } catch (err) {
                            console.error(`❌ Failed to remove role ${roleID} from ${member.user.tag}: `, err);
                        }
                    }
                }
            }
            let replyContent = '';
            if (rolesAdded.length > 0) {
                replyContent += `Added: ${rolesAdded.join(', ')} \n`;
            }
            if (rolesRemoved.length > 0) {
                replyContent += `Removed: ${rolesRemoved.join(', ')} \n`;
            }
            if (!replyContent) {
                replyContent = 'No role changes were made.';
            }

            await interaction.editReply({ content: replyContent, flags: MessageFlags.Ephemeral });
            console.log(`✅ Roles updated for ${member.user.tag} via select menu.Added: [${rolesAdded.join(', ')}], Removed: [${rolesRemoved.join(', ')}]`);
        }
        if (interaction.customId.startsWith('guild_appeal')) {
            const guildId = interaction.values[0];
            const appealslist = await appealsget(interaction.user.id, guildId)
            const deniedappeals = appealslist.filter(appeal => appeal.denied === 1)
            if (deniedappeals.length > 0) {
                interaction.reply(`Your previous appeal has been denied.I'm sorry.`)
                return;
            }
            else if (appealslist && appealslist.length > 0) {
                interaction.reply(`You have already submitted an appeal, please be patient`)
                return;
            }
            const modal = new ModalBuilder()
                .setCustomId('appealModal')
                .setTitle('Ban Appeal Submission');

            const guildid = new TextInputBuilder()
                .setCustomId('guildId')
                .setLabel("Guild ID")
                .setStyle(TextInputStyle.Short)
                .setValue(guildId) // Prefill with the provided ID
                .setRequired(true)

            const reason = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel("Why were you banned?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Put your ban reason here')

            const justification = new TextInputBuilder()
                .setCustomId('justification')
                .setLabel("Why should accept your ban appeal?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Put your explaination here')

            const extra = new TextInputBuilder()
                .setCustomId('extra')
                .setLabel('Anything else we need to know?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Put anything else here')

            const firstActionRow = new ActionRowBuilder().addComponents(guildid);
            const secondActionRow = new ActionRowBuilder().addComponents(reason);
            const thirdActionRow = new ActionRowBuilder().addComponents(justification);
            const fourthActionRow = new ActionRowBuilder().addComponents(extra);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

            await interaction.showModal(modal);
        }
        if (interaction.customId.startsWith('select_age')) {
            applications = await load(filepath);
            const application = applications[interaction.user.id]
            if (application.Activity) {
                const nextButton = new ButtonBuilder()
                    .setCustomId('next_modal_two')
                    .setLabel('skip Part 1')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder()
                    .addComponents(nextButton);
                interaction.reply({
                    content: 'You have already filled out the first part. Click the button below to continue to the next section.',
                    components: [row],
                    flags: MessageFlags.Ephemeral
                })
                return;
            } else {
                application.Agerange = interaction.values[0];

                await save(filepath, applications);
                const guild = interaction.client.guilds.cache.get(application.guild)
                const questionModalOne = new ModalBuilder()
                    .setCustomId('server')
                    .setTitle('Experience and Activity (1/3)')

                const questionOne = new TextInputBuilder()
                    .setCustomId('experience')
                    .setLabel('Please put down any prior mod experience')
                    .setPlaceholder('Put your experience here or N/A')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(300)

                const questionTwo = new TextInputBuilder()
                    .setCustomId('punishments')
                    .setLabel('Have you been warned/muted/kicked/banned?')
                    .setPlaceholder('be honest and you do not need too much detail')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)

                const questionThree = new TextInputBuilder()
                    .setCustomId('timezone')
                    .setLabel('What is your timezone?')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('If unknown, put your current time')
                    .setMaxLength(8)

                const questionFour = new TextInputBuilder()
                    .setCustomId('length')
                    .setLabel(`Time you been a member in ${guild.name}?`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(25)

                const questionFive = new TextInputBuilder()
                    .setCustomId('activity')
                    .setLabel(`How active are you in ${guild.name}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(150)


                const firstActionRow = new ActionRowBuilder().addComponents(questionOne)
                const secondActionRow = new ActionRowBuilder().addComponents(questionTwo)
                const thirdActionRow = new ActionRowBuilder().addComponents(questionThree)
                const fourthActionRow = new ActionRowBuilder().addComponents(questionFour)
                const fifthActionRow = new ActionRowBuilder().addComponents(questionFive)

                questionModalOne.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow)
                interaction.showModal(questionModalOne)
            }
        }
    }
}