import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { welcomeChannelId, generalChannelid, mutelogChannelid, banlogChannelid } from "./Extravariables/channelids.js";

// A Map to store the old invite counts
const invites = new Map();

/**
 * Initializes the invite cache for the guild.
 * @param {import("discord.js").Client} client The Discord client.
 */
export async function initializeInvites(client) {
    const guild = client.guilds.cache.first(); // Assumes a single-guild bot
    if (!guild) {
        console.error("Guild not found. Cannot initialize invites.");
        return;
    }
    try {
        const guildInvites = await guild.invites.fetch();
        guildInvites.forEach(invite => invites.set(invite.code, invite.uses));
        console.log("Invites cache initialized.");
    } catch (error) {
        console.error("Error fetching invites:", error);
    }
}

/**
 * Handles the guildMemberAdd event to log new members and their inviter.
 * @param {import("discord.js").GuildMember} member The new member.
 */
export async function guildMemberAdd(member) {
    // Get channel objects
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    const generalChannel = member.guild.channels.cache.get(generalChannelid);
    const mutechannel = member.guild.channels.cache.get(mutelogChannelid);
    const banlogChannel = member.guild.channels.cache.get(banlogChannelid);

    if (!welcomeChannel || !generalChannel || !mutechannel || !banlogChannel) {
        console.warn('⚠️ One or more log channels not found. Check channel IDs.');
        return;
    }

    // Define account creation date and two days in milliseconds
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

    // Check if account is less than two days old
    const accountAgeInMs = Date.now() - member.user.createdTimestamp;

    // Kick member if account is less than two days old
    if (accountAgeInMs < twoDaysInMs) {
        try {
            await member.kick('Account too new');
            const kickmessage = new EmbedBuilder()
                .setTitle('A member was auto-kicked')
                .addFields(
                    { name: '**User**', value: `<@${member}>`, inline: true },
                    { name: '**tag**', value: `\`${member.tag}\``, inline: true },
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
    const newInvites = await member.guild.invites.fetch();
    const oldInvites = invites;
    let inviter = null;
    let invite = null;

    try {
        invite = newInvites.find(i => oldInvites.has(i.code) && oldInvites.get(i.code) < i.uses);
        if (invite) {
            inviter = invite.inviter;
        }
    } catch (error) {
        console.error("Error finding inviter:", error);
    }
    // Update the invite cache with the new counts
    newInvites.forEach(invite => oldInvites.set(invite.code, invite.uses));
    // Build and send embeds
    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`${member} joined the Server!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`, inline: true }
        );
    // Add the inviter field to the welcome embed
    if (inviter) {
        welcomeEmbed.addFields({ name: 'Invited by', value: `<@${inviter.id}>` });
    }

    const generalEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`Welcome ${member} to the Cave!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`, inline: true }
        );

    // Create the ban button with the inviter's ID included
    const banButton = new ButtonBuilder()
        .setCustomId(`inviter_ban_delete_invite_${member.id}_${inviter ? inviter.id : 'no inviter'}_${invite ? invite.code : 'no invite code'}`)
        .setLabel('🔨 Ban User & Delete Invite')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false);

    const actionRow = new ActionRowBuilder()
        .addComponents(banButton);

    // Capture the message object here to use it in the timeout
    await generalChannel.send({ embeds: [generalEmbed] });
    const welcomeMessage = await welcomeChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });

    // Schedule the button to be disabled after 5 minutes
    const fiveMinutesInMs = 5 * 60 * 1000;
    setTimeout(async () => {
        try {
            const fetchedMessage = await welcomeChannel.messages.fetch(welcomeMessage.id);
            const updatedBanButton = new ButtonBuilder()
                .setCustomId(`inviter_ban_delete_invite_${member.id}_${inviter ? inviter.id : 'no inviter'}_${invite ? invite.code : 'no invite code'}`)
                .setLabel('🔨 Ban (Expired)')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true); // Disable the button

            const updatedActionRow = new ActionRowBuilder()
                .addComponents(updatedBanButton);

            await fetchedMessage.edit({ components: [updatedActionRow] });
            console.log(`Ban button for ${member.user.tag} disabled after 5 minutes.`);
        } catch (error) {
            console.error(`Failed to disable ban button for ${member.user.tag}:`, error);
        }
    }, fiveMinutesInMs);
}
