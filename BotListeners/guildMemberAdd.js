import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { guildChannelMap, guildModChannelMap } from "./Extravariables/channelids.js";
import invites from "./Extravariables/invites.js";

/**
 * Handles the guildMemberAdd event to log new members and their inviter.
 * @param {import("discord.js").GuildMember} member The new member.
 */
export async function guildMemberAdd(member) {
    const guildId = member.guild.id
    const guildmodChannels = guildModChannelMap[guildId]
    const guildChannels = guildChannelMap[guildId];
    const Channels = guildChannels.channels
    const [welcomeChannel, generalChannel, mutechannel] = [
        await member.guild.channels.fetch(guildmodChannels.welcomeChannel),
        await member.guild.channels.fetch(Channels.generalChannel),
        await member.guild.channels.fetch(guildmodChannels.mutelogChannel),
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

    try {
        // Find the invite that was just used
        invite = newInvites.find(i => {
            const key = `${guildId}-${i.code}`;
            // Check if the invite exists in the old cache and its use count has increased
            return oldInvites.has(key) && oldInvites.get(key) < i.uses;
        });

        // If an inviter was not found, it might be a new invite.
        // We can now iterate through the new invites to add any that are not in our old cache.
        if (!invite) {
            if (!oldInvites.has(key) && i.uses === 1) {
                invite = i;
                console.log(`🎉 Found a new invite: ${invite.code}`);
                // Break the loop once found if necessary, or just rely on the first match
            }
        };

        if (invite) {
            inviter = invite.inviter;
            console.log(`✅ Inviter found! User: ${inviter.tag} | Invite Code: ${invite.code}`);
        } else {
            console.log('❌ No inviter found for this member.');
        }
    } catch (error) {
        console.error("Error finding inviter:", error);
    }

    // Now, update the shared invites map with the new invites and their current uses.
    newInvites.forEach(i => {
        const key = `${guildId}-${i.code}`;
        invites.set(key, i.uses);
    });


    // Debugging log for updated invite cache state
    console.log('--- Updated Invites Cache State ---');
    for (const [key, uses] of invites) {
        console.log(`${key}, Uses: ${uses}`);
    }
    console.log('-----------------------------------');

    // Build and send embeds
    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`${member} joined the Server!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}>`, inline: true }
        )
        .setTimestamp()
    // Add the inviter field to the welcome embed
    if (inviter) {
        console.log(`Inviter found for embed: ${inviter.tag}`);
        welcomeEmbed.setFooter({
            text: `Invited by ${inviter.tag} | ${invite.code}`,
            iconURL: inviter.displayAvatarURL({ dynamic: true })
        });
    }

    const generalEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`Welcome ${member} to the Cave!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true }
        );

    // Create the ban button with the inviter's ID included
    const banButton = new ButtonBuilder()
        .setCustomId(`inviter_ban_delete_invite_${member.id}_${inviter ? inviter.id : 'no inviter'}_${invite ? invite.code : 'no invite code'}`)
        .setLabel(inviter ? '🔨 Ban User & Delete Invite' : '🔨 Ban')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false);

    const actionRow = new ActionRowBuilder()
        .addComponents(banButton);

    // Capture the message object here to use it in the timeout
    await generalChannel.send({ embeds: [generalEmbed] });
    const welcomeMessage = await welcomeChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });
    console.log(`Welcome message sent with inviter data in embed: ${inviter ? 'Yes' : 'No'}`);

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
