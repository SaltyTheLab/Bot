import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};

async function MemberHandler(member, action) {
    const arrayToMap = (arr) => new Map(arr.map(item => [item.key, item.uses]));
    const mapToArray = (map) => Array.from(map.entries()).map(([key, uses]) => ({ key, uses }));
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
            const invites = arrayToMap(await load(filepath));
            let inviter, invite = null;
            let isPersistentInvite = false;
            invite = newInvites.find(i => {
                const oldUses = invites.get(`${guild.id}-${i.code}`) || 0;
                return i.uses === oldUses + 1;
            });
            if (invite) { inviter = invite.inviter; isPersistentInvite = true; }
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x00FF99)
                .setDescription(`${member} joined the Server!`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields({ name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}>`, inline: true })
                .setTimestamp()
            inviter ?
                welcomeEmbed.setFooter({ text: `Invited by: ${inviter.tag} | ${invite.code}`, iconURL: inviter.displayAvatarURL({ dynamic: true }) })
                : null

            newInvites.forEach(i => { invites.set(`${guild.id}-${i.code}`, i.uses); });
            await save(filepath, mapToArray(invites))
            const message = await welcomeChannel.send({
                embeds: [welcomeEmbed], components: [new ActionRowBuilder()
                    .addComponents(new ButtonBuilder()
                        .setCustomId(isPersistentInvite && inviter.id !== owner.user.id ? `ban_${member.id}_${inviter.id}_${invite.code}` : `ban_${member.id}_no inviter_no invite code`)
                        .setLabel(isPersistentInvite && inviter.id !== owner.user.id ? '🔨 Ban User & Delete Invite' : '🔨 Ban')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(false)
                    )]
            });
            if (Date.now() - user.createdTimestamp < 2 * 24 * 60 * 60 * 1000) {
                await member.kick({ reason: `Account under the age of 2 days` });
                await mutechannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('A member was auto-kicked')
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .setDescription(`**User:**${member}\n**tag:**\`${user.tag}\`\n**Reason":**Account under the age of 2 days\n\n**Account created:**<t:${Math.floor(user.createdTimestamp / 1000)}:R>`)]
                });
                return;
            }
            await generalChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF99)
                    .setDescription(`Welcome ${member} to ${guild.name}!`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .addFields({ name: 'Discord Join Date:', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true })
                ]
            });
            !user.bot ?
                await user.createDM().send({
                    embeds: [new EmbedBuilder()
                        .setTitle(`Hi there! Welcome to ${guild.name}`)
                        .setThumbnail(guild.iconURL({ size: 1024, extension: 'png' }))
                        .setDescription(`Im febot, I am dming you since it will open a dm with me. Below is a shiny blue button labeled commands. /appeal is the only one you can use here.\n\n Be sure to get some roles in ${guild.name} role claim channel.\n\n`)]
                }) : null

            setTimeout(async () => {
                const buttonComponent = message.components[0];
                if (buttonComponent && !buttonComponent.disabled) {
                    await message.edit({
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
                            .setCustomId(buttonComponent.components[0].customId)
                            .setLabel(buttonComponent.components[0].label === '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)'
                                : '🔨 Ban (Expired)')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true))]
                    });
                }
            }, 15 * 60 * 1000)
        },
        'leave': async () => {
            await welcomeChannel.send({
                embeds: [new EmbedBuilder()
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setDescription(`<@${member.id}> left ${guild.name}.`)
                    .addFields({
                        name: `Joined ${guild.name}:`, value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true,
                    })
                ]
            });
        }
    }
    await actionMap[action]()
}

export async function guildMemberAdd(member) {
    await MemberHandler(member, 'add')
}
export async function guildMemberRemove(member) {
    await MemberHandler(member, 'leave')
}