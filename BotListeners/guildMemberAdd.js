import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { load, save } from "../utilities/jsonloaders.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
const fifteenMinutesInMs = 15 * 60 * 1000
export async function guildMemberAdd(member) {
    const arrayToMap = (arr) => new Map(arr.map(item => [item.key, item.uses]));
    const mapToArray = (map) => Array.from(map.entries()).map(([key, uses]) => ({ key, uses }));
    const owner = await member.guild.fetchOwner();
    const user = member.user;
    const guild = member.guild
    const vanitycode = await member.guild.fetchVanityData();
    let invites = arrayToMap(await load("./BotListeners/Extravariables/invites.json"));
    const [welcomeChannel, generalChannel, mutechannel] = [
        await guild.channels.fetch(guildChannelMap[guild.id].modChannels.welcomeChannel),
        await guild.channels.fetch(guildChannelMap[guild.id].publicChannels.generalChannel),
        await guild.channels.fetch(guildChannelMap[guild.id].modChannels.mutelogChannel),
    ]

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`${member} joined the Server!`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}>`, inline: true })
        .setTimestamp()

    const newInvites = await member.guild.invites.fetch();
    let inviter = null;
    let invite = null;
    let isPersistentInvite = false;

    invite = newInvites.find(i => {
        const oldUses = invites.get(`${guild.id}-${i.code}`) || 0;
        return i.uses === oldUses + 1;
    });

    const actionRow = new ActionRowBuilder()
        .addComponents(new ButtonBuilder()
            .setCustomId(isPersistentInvite && inviter.id !== owner.user.id ? `inviter_ban_delete_invite_${member.id}_${inviter.id}_${invite.code}` : `inviter_ban_delete_invite_${member.id}_no inviter_no invite code`)
            .setLabel(isPersistentInvite && inviter.id !== owner.user.id ? '🔨 Ban User & Delete Invite' : '🔨 Ban')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(false)
        );

    if (invite) { inviter = invite.inviter; isPersistentInvite = true; }

    inviter ? welcomeEmbed.setFooter({ text: `Invited by: ${inviter.tag} | ${invite.code}`, iconURL: inviter.displayAvatarURL({ dynamic: true }) })
        : welcomeEmbed.setFooter({ text: vanitycode ? `user used the vanity url: ${vanitycode.code}` : '' })

    newInvites.forEach(i => { invites.set(`${guild.id}-${i.code}`, i.uses); });
    await save("./BotListeners/Extravariables/invites.json", mapToArray(invites))

    await generalChannel.send({
        embeds: [new EmbedBuilder()
            .setColor(0x00FF99)
            .setDescription(`Welcome ${member} to the Cave!`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields({ name: 'Discord Join Date:', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true })
        ]
    });

    const message = await welcomeChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const accountAgeInMs = Date.now() - user.createdTimestamp;

    if (accountAgeInMs < twoDaysInMs) {
        await member.kick({ reason: `Account under the age of 2 days` });
        const kickmessage = new EmbedBuilder()
            .setTitle('A member was auto-kicked')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription(`**User:**${member}\n**tag:**\`${user.tag}\`\n**Reason":**Account under the age of 2 days\n\n**Account created:**<t:${Math.floor(user.createdTimestamp / 1000)}:R>`)
        await mutechannel.send({ embeds: [kickmessage] });
        return;
    }

    const introductionembed = new EmbedBuilder()
        .setTitle(`Hi there! Welcome to ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 1024, extension: 'png' }))
        .setDescription(`Im febot, I am dming you since it will open a dm with me. Below is a shiny blue button labeled commands. /appeal is the only one you can use here.\n\n Be sure to get some roles in ${guild.name} role claim channel.\n\n`)

    if (!user.bot)
        try {
            const dmChannel = await user.createDM(); await dmChannel.send({ embeds: [introductionembed] })
        } catch (error) { console.log('Could not dm this user.', error) }

    setTimeout(async () => {
        const buttonComponent = message.components[0];
        if (buttonComponent && !buttonComponent.disabled) {
            const updatedBanButton = new ButtonBuilder()
                .setCustomId(buttonComponent.components[0].customId)
                .setLabel(buttonComponent.components[0].label === '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)'
                    : '🔨 Ban (Expired)')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            const updatedActionRow = new ActionRowBuilder().addComponents(updatedBanButton);
            await message.edit({ components: [updatedActionRow] });
        }
    }, fifteenMinutesInMs)
}