import { EmbedBuilder } from "discord.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
const filepath = "Extravariables/invites.json"
const invitesCache = await load(filepath);
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
            let guildInvitesArray = invitesCache[guild.id];
            const oldInvitesMap = new Map(guildInvitesArray.map(item => [item.code, item.uses]));
            let inviter, invite, isPersistentInvite = null;
            invite = newInvites.find(i => { const oldUses = oldInvitesMap.get(i.code); return i.uses === oldUses + 1; });
            if (invite) { inviter = invite.inviter; isPersistentInvite = true; }
            guildInvitesArray = newInvites.map(item => { return { code: item.code, uses: item.uses } });
            await save(filepath, invitesCache);
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
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        custom_id: isPersistentInvite && inviter.id !== owner.user.id ? `ban_${member.id}_${inviter.id}_${invite.code}` : `ban_${member.id}_no inviter_no invite code`,
                        label: isPersistentInvite && inviter.id !== owner.user.id ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
                        style: 4,
                        disabled: false
                    }]
                }]
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
                const buttonComponent = message.components[0].components[0];
                if (buttonComponent && !buttonComponent.disabled) {
                    message.edit({
                        components: [{
                            type: 1, components: [{ type: 2, custom_id: buttonComponent.customId, label: buttonComponent.label === '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)' : '🔨 Ban (Expired)', style: 4, disabled: true }]
                        }]
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
export async function guildMemberAdd(member) {
    MemberHandler(member, 'add')
}
export async function guildMemberRemove(member) {
    MemberHandler(member, 'leave')
}
export async function guildMemberUpdate(oldMember, newMember) {
    if (oldMember.nickname === newMember.nickname) return;
    const logChannel = oldMember.client.channels.cache.get(guildChannelMap[oldMember.guild.id].modChannels.namelogChannel);
    if (!logChannel) { console.warn('⚠️ Name log channel not found.'); return; }
    const oldNick = oldMember.nickname ?? oldMember.user.username;
    const newNick = newMember.nickname ?? newMember.user.username;
    await logChannel.send({
        embeds: [new EmbedBuilder({
            thumbnail: { url: newMember.user.displayAvatarURL() },
            color: 0x4e85b6,
            description: `<@${newMember.id}> **changed their nickname**\n\n` +
                `**Before:**\n${oldNick}\n\n` +
                `**After:**\n${newNick}`,
            timestamp: Date.now()
        })]
    });
}