import { EmbedBuilder } from "discord.js";
import { welcomeChannelId, generalChannelid, mutelogChannelid } from "./Extravariables/channelids.js";
export async function guildMemberAdd(member) {
    //get channel objects
    const [welcomeChannel, generalChannel, mutechannel] = [
        member.guild.channels.cache.get(welcomeChannelId),
        member.guild.channels.cache.get(generalChannelid),
        member.guild.channels.cache.get(mutelogChannelid)
    ]

    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }
    //define account creation date and two days
    const accountCreationDate = member.user.createdAt;
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

    //check if account is 2 days old, if so kick
    //convert date from Ms to actual days
    const date = Math.floor(member.user.createdTimestamp / 1000);
    const accountAgeInMs = date;

    //kick member if less then two days old
    if (accountAgeInMs < twoDaysInMs) {

        await member.kick('Account too new')
        const kickmessage = new EmbedBuilder()
            .setTitle('A member was auto-kicked')
            .setfields(
                { name: `\`**User**:`, value: `<@${member.id}>\``, inline: true },
                { name: `**Tag**:`, value: `\`${member.tag}\``, inline: true },
                { name: '**Reason**:', value: `\`Account under the age of 2d\``, inline: false },
                { name: '**Account created:', value: `<t:${accountCreationDate}:R>` }
            )
        await mutechannel.send({ embeds: [kickmessage] });
    }
    //build and send embeds
    const embed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`${member} joined the Server!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Discord Join Date:', value: `\`<t:${accountCreationDate}:R>\``, inline: true });

    const genembed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(`Welcome ${member} to the Cave!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Discord Join Date:', value: `\`<t:${accountCreationDate}:R>\``, inline: true });
    await welcomeChannel.send({ embeds: [embed] });
    await generalChannel.send({ embeds: [genembed] })
};