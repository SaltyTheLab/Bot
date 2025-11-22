import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, AuditLogEvent, PermissionFlagsBits, MessageFlags, LabelBuilder } from "discord.js";
import punishUser from "../moderation/punishUser.js";
import { appealsinsert, appealsget, appealupdate } from "../Database/databasefunctions.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.js";

const filepath = "Extravariables/applications.json"
export async function interactionCreate(interaction) {
    if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;
        let command = interaction.client.commands.get(commandName) ?? interaction.client.commands.get(`${interaction.guild.id}:${commandName}`)
        if (!command) {
            console.warn(`[WARN] Command '${commandName}' not found in map.`);
            if (!interaction.deferred && !interaction.replied) {
                interaction.reply({ content: 'Sorry, that command is not currently available.', flags: MessageFlags.Ephemeral });
            }
            return;
        }
        try {
            command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error executing command ${commandName}: `, error);
            if (interaction.replied || interaction.deferred)
                interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            else
                interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('appeal')) {
            const guildId = interaction.fields.getTextInputValue('guildId');
            const reason = interaction.fields.getTextInputValue('reason');
            const justification = interaction.fields.getTextInputValue('justification');
            const extra = interaction.fields.getTextInputValue('extra');
            const targetUserid = interaction.user.id
            const guild = interaction.client.guilds.cache.get(guildId);
            const appealChannel = interaction.client.channels.get(guildChannelMap[guild.id].modChannels.appealChannel);
            const modRole = guild.roles.cache.find(role => role.permissions.has('BanMembers') && !role.managed);
            const adminRole = guild.roles.cache.find(role => role.permissions.has('Administrator') && role.name.toLowerCase().includes('admin'));
            if (!appealChannel) {
                return interaction.reply({
                    content: 'The appeal channel for that guild could not be found. Please contact a moderator directly.',
                    flags: MessageFlags.Ephemeral
                });
            }
            const message = await appealChannel.send({
                content: `<@&${modRole.id}> <@&${adminRole.id}>`,
                embeds: [new EmbedBuilder({
                    author: { name: `${interaction.user.tag})`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                    color: 0x13cbd8,
                    title: `Ban appeal`,
                    fields: [
                        { name: 'Why did you get banned?', value: `${reason}` },
                        { name: 'Why do you believe that your appeal should be accepted?', value: `${justification}` },
                        { name: 'Is there anything else you would like us to know?', value: `${extra}` }],
                    footer: { text: `User ID: ${targetUserid}` },
                    timestamp: Date.now()
                })],
                components: [new ActionRowBuilder({
                    components: [
                        new ButtonBuilder({ custom_id: `unban_approve_${targetUserid}_${guildId}`, label: 'Approve', style: ButtonStyle.Success }),
                        new ButtonBuilder({ custom_id: `unban_reject_${targetUserid}_${guildId}`, label: 'Reject', style: ButtonStyle.Danger })
                    ]
                })]
            })
            message.startThread({ name: interaction.user.tag })
            interaction.reply({ content: 'Your appeal has been submitted and our team will look into it.' })
            appealsinsert(interaction.user.id, guildId, reason, justification, extra);
        }
        if (interaction.customId.startsWith('situations')) {
            const applications = load(filepath);
            const application = applications[interaction.user.id]
            const guild = interaction.guild
            application.dmmember = interaction.fields.getTextInputValue('dmmember')
            application.argument = interaction.fields.getTextInputValue('arguments')
            application.ambiguous = interaction.fields.getTextInputValue('rulebreakdm')
            application.staffbreakrule = interaction.fields.getTextInputValue('staffrulebreak')
            application.illegal = interaction.fields.getTextInputValue('illegal')
            const applicationChannelid = guildChannelMap[guild.id].modChannels.applicationChannel
            const applicationChannel = interaction.client.channels.cache.get(applicationChannelid)
            applicationChannel.send({
                embeds: [new EmbedBuilder({
                    author: { name: `@${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                    color: 0x13b6df,
                    title: `Mod Application for ${guild.name}`,
                    fields: [
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
                        { name: 'A user share illegal content. What are the steps you take?', value: `${application.illegal}`, inline: false }]
                })]
            })
            interaction.reply({
                content: 'your application was successfuly submitted!!'
            })
            delete applications[interaction.user.id];
            save(filepath, applications)
        }
        if (interaction.customId.startsWith('Defs, reasons, and issues')) {
            const applications = load(filepath)
            const application = applications[interaction.user.id]
            if (application.Memberreport) {
                await interaction.reply({
                    content: 'You have already filled out this section. Click the button below to continue to the next section.',
                    components: [new ActionRowBuilder({
                        components: [new ButtonBuilder({ custom_id: 'next_modal_three', label: 'skip section', style: ButtonStyle.Primary })]
                    })],
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
                await interaction.reply({
                    content: 'Part 2 of your application has been submitted! Click the button below to continue to the next section.',
                    components: new ActionRowBuilder({
                        components: new ButtonBuilder({ custom_id: 'next_modal_three', label: 'Continue Application', style: ButtonStyle.Primary })
                    }),
                    flags: MessageFlags.Ephemeral
                });

            }
        }
        if (interaction.customId.startsWith('server')) {
            const applications = load(filepath)
            const application = applications[interaction.user.id]
            console.log(interaction.fields.fields)
            application.Agerange = interaction.fields.getStringSelectValues('age');
            application.Experience = interaction.fields.getTextInputValue('experience')
            application.History = interaction.fields.getTextInputValue('punishments')
            application.Timezone = interaction.fields.getTextInputValue('timezone')
            application.Activity = interaction.fields.getTextInputValue('activity')
            await save(filepath, applications)
            interaction.reply({
                content: 'Part 1 of your application has been submitted! Click the button below to continue to the next section.',
                components: new ActionRowBuilder({
                    components: [new ButtonBuilder({ custom_id: 'next_modal_two', label: 'Continue Application', style: ButtonStyle.Primary })]
                }),
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

            if (!interaction.member.permissions.has('BAN_MEMBERS')) {
                await interaction.reply({ content: 'You do not have permission to ban members.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (Date.now() - interaction.message.createdTimestamp > 15 * 60 * 1000) {
                await interaction.reply({ content: 'This ban button has expired (15 mins have already passed since they joined).', flags: MessageFlags.Ephemeral });
                const banbuttonLabel = interaction.message.components[0].components[0].label;
                if (banbuttonLabel == '🔨 Ban User & Delete Invite' || banbuttonLabel === '🔨 Ban') {
                    await interaction.message.edit({
                        components: [new ActionRowBuilder({
                            components: new ButtonBuilder({ custom_id: interaction.customId, label: banbuttonLabel == '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)' : '🔨 Ban (Expired)', style: ButtonStyle.Danger, disabled: true })
                        })]
                    })
                }
                return;
            }
            const messageid = interaction.message.id;
            let finalMessage = ``;
            punishUser({ interaction: interaction, guild: interaction.guild, target: memberToBan, moderatorUser: interaction.user, reason: 'troll', channel: interaction.channel, banflag: true, messageid: messageid });
            finalMessage = `Banned ${memberToBan}`;

            if (inviterId !== 'no inviter') {
                punishUser({ interaction: interaction, guild: interaction.guild, target: inviterId, moderatorUser: interaction.user, reason: 'troll', channel: interaction.channel, banflag: true, messageid: messageid });
                finalMessage += `, inviter <@${inviterId}>.`;
            }

            if (inviteCode !== 'no invite code') {
                const invite = await interaction.guild.invites.fetch(inviteCode);
                if (invite) {
                    let invitesCache = load("Extravariables/invites.json");
                    if (invitesCache && invitesCache[interaction.guild.id]) {
                        invitesCache[interaction.guild.id] = invitesCache[interaction.guild.id].filter(inv => inv.code !== invite.code);
                        save("Extravariables/invites.json", invitesCache);
                    }
                    invite.delete();
                    finalMessage += ' Associated Invite was deleted'
                }
            }
            interaction.reply({ embeds: [new EmbedBuilder({ description: finalMessage })] });
            const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
            originalMessage.edit({
                components: [new ActionRowBuilder({
                    components: new ButtonBuilder({ custom_id: interaction.customId, label: inviterId !== 'no inviter' ? '🔨 Banned User and Inviter!' : '🔨 Banned!', style: ButtonStyle.Danger, disabled: true })
                })]
            });
        }
        if (interaction.customId.startsWith('unban_')) {
            await interaction.deferReply();
            const customIdParts = interaction.customId.split('_')
            const targetUser = await interaction.client.users.fetch(customIdParts[2])
            const guild = interaction.client.guilds.cache.get(customIdParts[3]);
            const appeals = await appealsget(targetUser.id, guild.id)
            let outcome = false
            const Adminchannel = interaction.client.channels.cache.get(guildChannelMap[guild.id].modChannels.AdminChannel);
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                interaction.reply({ content: `Please wait for an admin to make a decision. `, flags: MessageFlags.Ephemeral })
                Adminchannel.send({ content: `Letting you know ${interaction.user} tried to jump the gun on an appeal.` })
                return;
            }
            const appealEmbed = new EmbedBuilder({
                color: 0x13cbd8,
                title: `Ban appeal`,
                author: { name: `${targetUser.tag} `, iconURL: targetUser.displayAvatarURL({ dynamic: true }) },
                fields: [
                    { name: 'Why did you get banned?', value: `${appeals[0].reason} ` },
                    { name: 'Why do you believe that your appeal should be accepted?', value: `${appeals[0].justification} ` },
                    { name: 'Is there anything else you would like us to know?', value: `${appeals[0].extra}` }
                ],
                footer: { text: `User ID: ${targetUser.id}` },
                timestamp: Date.now()
            })
            const response = new EmbedBuilder({ author: { name: `${targetUser.tag} `, iconURL: targetUser.displayAvatarURL({ dynamic: true }) } })
            switch (customIdParts[1]) {
                case 'reject':
                    response
                        .setColor(0x890000)
                        .setTitle('Appeal Denied...')
                        .setDescription(`${targetUser} your ban appeal has unfortunantly been denied from ${interaction.guild.name}.`)
                    appealEmbed
                        .setColor(0x890000)
                        .addFields({ name: 'Denied by:', value: `${interaction.user} `, inline: true })
                    break;
                case 'approve': {
                    const appealinvites = { '1231453115937587270': 'https://discord.gg/xpYnPrSXDG', '1342845801059192913': 'https://discord.gg/nWj5KvgUt9' }
                    const fetchedlogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 25 })
                    if (!fetchedlogs.entries.find(log => log.target.id === targetUser.id)) {
                        interaction.editReply(`Could not find a recent ban entry for user ${targetUser}`);
                        return;
                    }
                    await guild.bans.remove(targetUser, `Ban Command: ${appeals[0].reason}`)
                    response
                        .setColor(0x008900)
                        .setTitle('Appeal Accepted!')
                        .setDescription(`${targetUser} your ban appeal has been accepted, click below to rejoin the server!\n\n invite: ${appealinvites[guild.id]} `)
                    appealEmbed
                        .setColor(0x008900)
                        .addFields({ name: 'Approved by:', value: `${interaction.user} `, inline: true })
                    outcome = true
                    break;
                }
            }
            await interaction.message.edit({
                embeds: [appealEmbed],
                components: [new ActionRowBuilder({
                    components: [
                        new ButtonBuilder({ custom_id: `unban_approve_${targetUser.id}_${interaction.guild.id}`, label: 'Approve', style: ButtonStyle.Success, disabled: true }),
                        new ButtonBuilder({ custom_id: `unban_reject_${targetUser.id}_${interaction.guild.id}`, label: 'Reject', style: ButtonStyle.Danger, disabled: true })
                    ]
                })]
            })
            await appealupdate(targetUser.id, guild.id, outcome)
            targetUser.send({ embeds: [response] })
            interaction.deleteReply();
        }
        if (interaction.customId.startsWith('next_modal_three')) {

            const dmmember = new LabelBuilder({
                label: 'A member messages you about being harrassed',
                component: new TextInputBuilder({
                    custom_id: 'dmmember', placeholder: 'How would you handle the situation?', required: true, style: TextInputStyle.Paragraph, max_length: 350
                })
            })
            const argument = new LabelBuilder({
                label: 'Users are arguing in general chat',
                component: new TextInputBuilder({ custom_id: 'arguments', placeholder: 'explain your de-escalation steps', style: TextInputStyle.Paragraph, required: true, max_length: 350 })
            })
            const ambiguous = new LabelBuilder({
                label: 'A member DMs you about a rule-breaking DM',
                component: new TextInputBuilder({ custom_id: 'rulebreakdm', placeholder: 'What is your course of action?', required: true, style: TextInputStyle.Paragraph, max_length: 350 })
            })
            const staffbreakrule = new LabelBuilder({
                label: 'Staff is failing to follow the rules',
                component: new TextInputBuilder({ custom_id: 'staffrulebreak', placeholder: 'What is your course of action', required: true, style: TextInputStyle.Paragraph, max_length: 350 })
            })
            const illegalcontent = new LabelBuilder({
                label: 'A user shares illegal content',
                component: new TextInputBuilder({
                    custom_id: 'illegal', placeholder: 'What are the steps you take?', required: true, style: TextInputStyle.Paragraph, max_length: 350
                })
            })
            interaction.showModal(new ModalBuilder({
                custom_id: 'situations',
                title: 'Situations (3/3)',
                components: [dmmember, argument, ambiguous, staffbreakrule, illegalcontent]
            }))
        }
        if (interaction.customId.startsWith('next_modal_two')) {
            const applications = load(filepath);
            const application = applications[interaction.user.id]
            if (application.Memberreport) {
                await interaction.reply({
                    content: 'You have already filled out this part. Click the button below to continue to the next section.',
                    components: [new ActionRowBuilder({
                        components: [new ButtonBuilder({ custom_id: 'next_modal_three', label: 'skip part 2', style: ButtonStyle.Primary })]
                    })],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                const questionOne = new LabelBuilder({
                    label: 'Why pick you & Tell us about yourself',
                    component: new TextInputBuilder({ custom_id: 'why', required: true, style: TextInputStyle.Paragraph, max_length: 500 })
                })
                const questionTwo = new LabelBuilder({
                    label: 'What is your definition of a troll?',
                    component: new TextInputBuilder({ custom_id: 'trolldef', required: true, style: TextInputStyle.Short, max_length: 65 })
                })
                const questionThree = new LabelBuilder({
                    label: 'What is your definition of a raid?',
                    component: new TextInputBuilder({ custom_id: 'raiddef', required: true, style: TextInputStyle.Short, max_length: 65 })
                })
                const questionFour = new LabelBuilder({
                    label: 'You disagree with a staff punishment...',
                    component: new TextInputBuilder({ custom_id: 'staffissues', placeholder: 'What would you do?', required: true, style: TextInputStyle.Paragraph, max_length: 300 })
                })
                const questionFive = new LabelBuilder({
                    label: 'How would you handle a member report?',
                    component: new TextInputBuilder({ custom_id: 'memberreport', placeholder: 'Describe the steps you would take to investigate and resolve it', required: true, style: TextInputStyle.Paragraph, max_length: 300 })
                })
                interaction.showModal(new ModalBuilder({
                    components: [questionOne, questionTwo, questionThree, questionFour, questionFive],
                    custom_id: 'Defs, reasons, and issues',
                    title: 'Definitions, Why mod, and Staff issues (2/3)'
                }));
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
                if (interaction.values.includes(roleValue)) {
                    if (!member.roles.cache.has(roleID)) {
                        await member.roles.add(roleID);
                        rolesAdded.push(`<@&${roleID}> `);
                    }
                } else {
                    if (member.roles.cache.has(roleID)) {
                        await member.roles.remove(roleID);
                        rolesRemoved.push(`<@&${roleID}> `);
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
            interaction.editReply({ content: replyContent, flags: MessageFlags.Ephemeral });
        }
        if (interaction.customId.startsWith('guild_appeal')) {
            const appealslist = await appealsget(interaction.user.id, interaction.values[0])
            const deniedappeals = appealslist.filter(appeal => appeal.denied === 1)
            if (deniedappeals.length > 0) {
                interaction.reply(`Your previous appeal has been denied.I'm sorry.`)
                return;
            }
            if (appealslist.length > 0) {
                interaction.reply(`You have already submitted an appeal, please be patient`)
                return;
            }

            const guildid = new LabelBuilder({
                label: "Guild ID",
                component: new TextInputBuilder({ custom_id: 'guildId', style: TextInputStyle.Short, value: interaction.values[0], required: true })
            })
            const reason = new LabelBuilder({
                label: "Why were you banned?",
                component: new TextInputBuilder({ custom_id: 'reason', style: TextInputStyle.Paragraph, required: true, placeholder: 'Put your ban reason here' })
            })
            const justification = new LabelBuilder({
                label: "Why should accept your ban appeal?",
                component: new TextInputBuilder({ custom_id: 'justification', style: TextInputStyle.Paragraph, required: true, placeholder: 'Put your explaination here' })
            })
            const extra = new LabelBuilder({
                label: 'Anything else we need to know?',
                component: new TextInputBuilder({
                    custom_id: 'extra', style: TextInputStyle.Paragraph, required: false, placeholder: 'Put anything else here'
                })
            })
            interaction.showModal(new ModalBuilder({
                custom_id: 'appealModal',
                title: 'Ban Appeal Submission',
                components: [guildid, reason, justification, extra]
            }));
        }
    }
}