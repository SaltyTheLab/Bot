import { EmbedBuilder } from 'discord.js';
import forbiddenWordsData from './forbiddenwords.json' with { type: 'json' };

export async function botlisteners(client) {
    client.on('messageCreate', message => {
        const forbiddenWords = forbiddenWordsData.forbiddenWords;
        const command = client.commands.get('warn');
        const matched = forbiddenWords.find(word => message.content.toLowerCase().includes(word.toLowerCase()));
        //autofill the command options if forbbiden words are detected
        if (!matched)
            return null;
        else {
            message.delete();
            const fakeInteraction = {
                guild: message.guild,
                member: message.member,
                user: message.author,
                channel: message.channel,
                options: {
                    getUser: (key) => key === 'target' ? message.author : null,
                    getString: (key) => key === 'reason' ? `AutoMod: Forbidden word ${matched}` : null
                },
                replied: false,
                deferred: false,
                reply: async (response) => {
                    message.channel.send(response);
                },
                edittReply: async (response) => {
                    await message.channel.send(response);
                    fakeInteraction.replied = true;
                }
            };
            command.execute(fakeInteraction);
        }


        const content = message.content.toLowerCase();
        if (content === "cute") return message.reply("You're Cute");
        if (content === "adorable") return message.reply("You're Adorable");
        if (content === "dmme") {
            try {
                message.author.send("Hey! This is a DM from the bot.");
            } catch {
                message.reply("I couldn't DM you—maybe your settings block it.");
            }
            return;
        }
        if (content === "ping") return message.reply("pong!");
        ;
    });

    client.on('guildMemberAdd', async (member) => {
        const WelcomeEmbed = new EmbedBuilder()
            .setColor(0x00FF99)
            .setDescription(
                `Welcome ${member} to the server!`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Discord Join Date:', value: `\`${member.joinedAt}\``, inline: true }
            )
        const welcomechannelid = '1392972733704572959';
        const welcomeChannel = member.guild.channels.cache.get(welcomechannelid)
        if (welcomeChannel) {
            await welcomeChannel.send({ embeds: [WelcomeEmbed] })
        } else {
            console.warn('I can not find my welcome logs.')
        }
    });

    // Fix welcomeChannel reference in guildMemberRemove
    client.on('guildMemberRemove', async (member) => {
        const welcomechannelid = '1392972733704572959';
        const welcomeChannel = member.guild.channels.cache.get(welcomechannelid);
        const LeaveEmbed = new EmbedBuilder()
            .setColor(0xa90000)
            .setDescription(
                `${member} has left the cave.`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields({ name: 'Joined the cave on:', value: `${member.guild.joinedAt()}`, inline: true });
        if (welcomeChannel) {
            await welcomeChannel.send({ embeds: [LeaveEmbed] });
        } else {
            console.warn('I can not find my welcome logs.');
        }

    });

    client.on('messageUpdate', async (message, newMessage) => {
        if (message.author.bot || message.content == newMessage.content) return;
        const editschannelid = '1392990612990595233';
        const logchannel = newMessage.guild.channels.cache.get(editschannelid);
        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        const editembed = new EmbedBuilder()
            .setDescription(
                `<@${newMessage.author.id}> edited a message in <#${newMessage.channelId}>

            **Before:**
            ${message.content}  
            
            **After:**
            ${newMessage.content}   
             

            [Event Link](${messageLink})`
            )
            .setColor(0x309eff)
            .setThumbnail(newMessage.author.displayAvatarURL())
            .setFooter({ text: `ID: ${newMessage.id}` })
            .setTimestamp()
        if (logchannel)
            logchannel.send({ embeds: [editembed] })
    })

    client.on('messageDelete', async (message) => {
        const deleteschannelid = '1393011824114270238';
        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        const logchannel = message.guild.channels.cache.get(deleteschannelid);
        const hasAttachment = message.attachments.size > 0;
        // Determine title based on content and attachments
        let title = '';
        if (hasAttachment && !message.content) {
            title = `Image by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
        } else if (hasAttachment && message.content) {
            title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
        } else {
            title = `Message by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
        }
        if (message.partial || !message.author || message.author.bot) return;

        // Get all image attachment URLs
        let imageAttachments = [];
        if (hasAttachment) {
            imageAttachments = message.attachments.filter(att => att.contentType && att.contentType.startsWith('image/')).map(att => att.url);
        };

        // Create the main embed (with content and first image if present)
        const deletedembed = new EmbedBuilder()
            .setColor(0xf03030)
            .setDescription([
                title,
                message.content ? `\n${message.content}` : '_No content_',
                `[Event Link](${messageLink})`
            ].join('\n'))
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: `ID: ${message.id} ` })
            .setTimestamp();

        if (imageAttachments.length > 0) {
            deletedembed.setImage(imageAttachments[0]);
        };

        // Create additional embeds for other images (if any)
        const imageEmbeds = imageAttachments.slice(1, 9).map(url =>
            new EmbedBuilder()
                .setColor(0xf03030)
                .setDescription(
                    title,

                    `[Event link](${messageLink})`
                )
                .setImage(url)
                .setThumbnail(message.author.displayAvatarURL())
                .setFooter({ text: `ID: ${message.id}` })
                .setTimestamp()
        );

        if (logchannel)
            logchannel.send({ embeds: [deletedembed, ...imageEmbeds] });
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const namelogchannelid = '1393076616326021181'
        const namelogchannel = newMember.guild.channels.cache.get(namelogchannelid)
        const nicknameembed = new EmbedBuilder()
            .setThumbnail(newMember.displayAvatarURL())
            .setDescription(
                `<@${newMember.id}> **changed their nickname**

            **Before:**
            ${oldMember.nickname}

            **After:**
            ${newMember.nickname}`
            )
            .setTimestamp()
        if (oldMember.nickname == null)
            oldMember.nickname = oldMember.user.displayName;
        else if (newMember.nickname = null)
            newMember.nickname = newMember.user.displayName;
        else oldMember.nickname !== newMember.nickname;
        await namelogchannel.send({ embeds: [nicknameembed] });
    }
    );
}
