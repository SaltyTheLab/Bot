import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.js";

async function MemberHandler(member, action) {
    const owner = await member.guild.fetchOwner();
    const user = member.user;
    const guild = member.guild;
    const [welcomeChannel, generalChannel, mutechannel] = [
        member.client.channels.cache.get(guildChannelMap[guild.id].modChannels.welcomeChannel),
        member.client.channels.cache.get(guildChannelMap[guild.id].publicChannels.generalChannel),
        member.client.channels.cache.get(guildChannelMap[guild.id].modChannels.mutelogChannel),
    ]
    const actionMap = {
        'add': async () => {
            const newInvites = await member.guild.invites.fetch();
            const filepath = "Extravariables/invites.json"
            const invitesCache = load(filepath) || {};
            const guildInvitesArray = invitesCache[guild.id] || [];
            const oldInvitesMap = new Map(guildInvitesArray.map(item => [item.code, item.uses]));
            let inviter, invite = null;
            let isPersistentInvite = false;
            invite = newInvites.find(i => {
                const oldUses = oldInvitesMap.get(i.code) || 0;
                return i.uses === oldUses + 1;
            });
            if (invite) {
                inviter = invite.inviter;
                isPersistentInvite = true;
                const updatedInvitesArray = guildInvitesArray.map(item => {
                    if (item.code === invite.code) {
                        return { code: invite.code, uses: invite.uses };
                    }
                    return item;
                });
                if (!updatedInvitesArray.find(item => item.code === invite.code)) {
                    updatedInvitesArray.push({ code: invite.code, uses: invite.uses });
                }
                invitesCache[guild.id] = updatedInvitesArray;
                save(filepath, invitesCache);
            } else {
                invitesCache[guild.id] = newInvites.map(i => ({ code: i.code, uses: i.uses }));
                save(filepath, invitesCache);
            }
            const welcomeEmbed = new EmbedBuilder({
                color: 0x00FF99,
                description: `${member} joined the Server!`,
                thumbnail: { url: user.displayAvatarURL() },
                fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}>`, inline: true }],
                timestamp: Date.now()
            })
            inviter ?
                welcomeEmbed.setFooter({ text: `Invited by: ${inviter.tag} | ${invite.code}`, iconURL: inviter.displayAvatarURL({ dynamic: true }) })
                : null

            const message = await welcomeChannel.send({
                embeds: [welcomeEmbed],
                components: [new ActionRowBuilder({
                    components: [new ButtonBuilder({
                        custom_id: isPersistentInvite && inviter.id !== owner.user.id ? `ban_${member.id}_${inviter.id}_${invite.code}` : `ban_${member.id}_no inviter_no invite code`,
                        label: isPersistentInvite && inviter.id !== owner.user.id ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
                        style: ButtonStyle.Danger,
                        disabled: false
                    })]
                })]
            });
            if (Date.now() - user.createdTimestamp < 2 * 24 * 60 * 60 * 1000) {
                member.kick({ reason: `Account under the age of 2 days` });
                mutechannel.send({
                    embeds: [new EmbedBuilder({
                        title: 'A member was auto-kicked',
                        thumbnail: { url: user.displayAvatarURL() },
                        description: `**User:**${member}\n**tag:**\`${user.tag}\`\n**Reason":**Account under the age of 2 days\n\n**Account created:**<t:${Math.floor(user.createdTimestamp / 1000)}:R>`
                    })
                    ]
                });
                return;
            }
            generalChannel.send({
                embeds: [new EmbedBuilder({
                    color: 0x00FF99,
                    description: `Welcome ${member} to ${guild.name}!`,
                    thumbnail: { url: user.displayAvatarURL() },
                    fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }]
                })
                ]
            });
            if (!user.bot) {
                await user.send({
                    embeds: [new EmbedBuilder({
                        title: `Hi there! Welcome to ${guild.name}`,
                        thumbnail: { url: guild.iconURL({ size: 1024, extension: 'png' }) },
                        description: `Im febot, I am dming you since it will open a dm with me. Below is a shiny blue button labeled commands. /appeal is the only one you can use here.\n\n Be sure to get some roles in ${guild.name} role claim channel.\n\n`
                    })]
                })
            }
            setTimeout(async () => {
                const buttonComponent = message.components[0];
                if (buttonComponent && !buttonComponent.disabled) {
                    message.edit({
                        components: [new ActionRowBuilder({
                            components: [new ButtonBuilder({
                                custom_id: buttonComponent.components[0].customId,
                                label: buttonComponent.components[0].label === '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)'
                                    : '🔨 Ban (Expired)',
                                style: ButtonStyle.Danger,
                                disabled: true
                            })]
                        })]
                    })
                }
            }, 15 * 60 * 1000)
        },
        'leave': async () => {
            welcomeChannel.send({
                embeds: [new EmbedBuilder({
                    thumbnail: { url: member.user.displayAvatarURL({ dynamic: true }) },
                    description: `<@${member.id}> left ${guild.name}.`,
                    fields: [{ name: `Joined ${guild.name}:`, value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true }]
                })]
            });
        }
    }
    actionMap[action]()
}

export function guildMemberAdd(member) {
    MemberHandler(member, 'add')
}
export function guildMemberRemove(member) {
    MemberHandler(member, 'leave')
}