import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";
import invites from "./Extravariables/invites.js";

/**
 * Handles the guildMemberAdd event to log new members and their inviter.
 * @param {import("discord.js").GuildMember} member The new member.
 */
export async function guildMemberAdd(member) {
    const guildId = member.guild.id
    const modChannels = guildChannelMap[guildId].modChannels;
    const publicChannels = guildChannelMap[guildId].publicChannels;
    const [welcomeChannel, generalChannel, mutechannel] = [
        await member.guild.channels.fetch(modChannels.welcomeChannel),
        await member.guild.channels.fetch(publicChannels.generalChannel),
        await member.guild.channels.fetch(modChannels.mutelogChannel),
    ]


    // Define account creation date and two days in milliseconds
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

    // Check if account is less than two days old
    const accountAgeInMs = Date.now() - member.user.createdTimestamp;

    // Kick member if account is less than two days old
    if (accountAgeInMs < twoDaysInMs) {
        try {
            await member.kick({ reason: `Account under the age of 2 days` });
            const kickmessage = new EmbedBuilder()
                .setTitle('A member was auto-kicked')
                .addFields(
                    { name: '**User**', value: `${member}`, inline: true },
                    { name: '**tag**', value: `\`${member.user.tag}\``, inline: true },
                    { name: '**Reason**', value: "`Account under the age of 2 days`" },
                    { name: '**Account created:**', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
                );
            await mutechannel.send({ embeds: [kickmessage] });
            return; // Exit if member was kicked
        } catch (error) {
            console.error(`Failed to auto-kick member ${member.user.tag}:`, error);
        }
    }

    // Fetch invites and find the inviter if the member wasn't auto-kicked
    const oldInvites = new Map(invites)
    const newInvites = await member.guild.invites.fetch();

    let inviter = null;
    let invite = null;
    let isPersistentInvite = false;

    try {// search old invites first and comapre values of snapshot to new list
        invite = newInvites.find(i => {
            const key = `${guildId}-${i.code}`;
            return oldInvites.has(key) && oldInvites.get(key) < i.uses;
        });
        if (invite) {
            inviter = invite.inviter;
            isPersistentInvite = true;
            console.log(`Found persistent inviter: ${inviter ? inviter.tag : 'Unknown'} via ${invite.code}`);
        } else {
            // check for one time use invites and ones already deleted
            let usedInviteCode = Array.from(oldInvites.keys()).find(key => {
                const code = key.split('-')[1];
                return !newInvites.some(i => i.code === code);
            });
            if (usedInviteCode) {
                const allInvites = await member.guild.invites.fetch();
                invite = allInvites.find(i => i.code === usedInviteCode.split('-')[1]);
                if (invite) {
                    inviter = invite.inviter;
                    console.log(`Found one-time invite: ${invite.code} and inviter: ${inviter ? inviter.tag : 'Unknown'}`);
                }
            } else {
                console.log('No invite found.')
            }
        };
    } catch (error) {
        console.error("Error finding inviter:", error);
    }

    // update the shared invites map with the new invites and their current uses.
    newInvites.forEach(i => {
        const key = `${guildId}-${i.code}`;
        invites.set(key, i.uses);
    });

    // Build and send embeds
    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`${member} joined the Server!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}>`, inline: true }
        )
    // Add the inviter field to the welcome embed
    if (inviter) {
        console.log(`Inviter found for embed: ${inviter.tag}`);
        welcomeEmbed.setFooter({
            text: `Invited by: ${inviter.tag} | ${invite.code}`,
            iconURL: inviter.displayAvatarURL({ dynamic: true })
        });
    }
    welcomeEmbed.setTimestamp()
    const generalEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`Welcome ${member} to the Cave!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true }
        );

    // Create the ban button with the inviter's ID included
    const banButton = new ButtonBuilder()
        .setCustomId(isPersistentInvite ? `inviter_ban_delete_invite_${member.id}_${inviter.id}_${invite.code}` : `inviter_ban_delete_invite_${member.id}_no inviter_no invite code`)
        .setLabel(isPersistentInvite ? '🔨 Ban User & Delete Invite' : '🔨 Ban')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false);

    const actionRow = new ActionRowBuilder()
        .addComponents(banButton);

    await generalChannel.send({ embeds: [generalEmbed] });
    await welcomeChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });
}
