import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import guildChannelMap from '../BotListeners/Extravariables/channelids.js';
import { saveMessageIDs, loadMessageIDs } from '../utilities/messageStorage.js';


const guildEmbedConfig = {
    "1231453115937587270": [ // Salty's Guild ID
        "rules", "mental", "appeal", "staffguide", "consoles",
        "colors", "pronouns", "continent", "stream", "dividers"
    ],
    "1347217846991851541": [ // Evo's Guild ID
        "EvoRules", "EvoContent",
        "EvoGames", "Evocolors"
    ]
    // Add more guild configurations here
};

export async function embedsenders(guildId, client) {
    if (!guildId) {
        console.log(`Error: guild not found for ${guildId}`);
        return;
    }
    const guild = client.guilds.cache.get(guildId);
    console.log(`Successfully retrieved guild: ${guildId}`);
    const guildChannels = guildChannelMap[guildId];
    if (!guildChannels) {
        console.error(`❌ No channel mapping found for guild ID: ${guildId}. Please check guildChannelMap.`);
        return;
    }
    // 1. Load the existing message IDs from the file
    // This will be the array that we modify in memory
    const messageIDs = loadMessageIDs(); // Call the function to load the array

    // Define your embed sending functions as an OBJECT
    const embedSendersMap = {
        "rules": sendRulesEmbed,
        "mental": sendMentalHealthEmbed,
        "appeal": sendAppealEmbed,
        "staffguide": sendStaffGuideEmbed,
        "consoles": sendConsoleRoleEmbed,
        "colors": sendColorsRoleEmbed,
        "pronouns": sendPronounsRoleEmbed,
        "continent": sendContinentRoleEmbed,
        "stream": sendStreamRoleEmbed,
        "dividers": sendDividersRoleEmbed,
        "EvoRules": EvosendRulesEmbed,
        "EvoContent": EvosendContentRoleEmbed,
        "EvoGames": EvosendGameRoleEmbed,
        "Evocolors": EvosendColorsRoleEmbed
    };

    const guildSpecificEmbedNames = guildEmbedConfig[guildId];
    if (!guildSpecificEmbedNames) {
        console.warn(`No embed configuration found for guild ID: ${guildId}. Skipping embeds for this guild.`);
        return;
    }

    const embedTasks = [];
    // Iterate directly over the object's entries
    for (const embedName of guildSpecificEmbedNames) {
        const senderFunc = embedSendersMap[embedName];
        if (!senderFunc) {
            console.error(`❌ No sender function found for embed name: '${embedName}' in embedSendersMap. Check guildEmbedConfig.`);
            continue; // Skip if a function isn't defined for the specified name
        }

        // Find the entry in the *current in-memory messageIDs array*
        console.log(`Checking embed for name: '${embedName}'`);

        const existingEmbedInfo = messageIDs.find(item => item.name === embedName);

        // Condition to send a new embed:
        // 1. If no entry exists for this embedName in the loaded data, OR
        // 2. If an entry exists, but it's missing either messageId or channelid
        if (!existingEmbedInfo || !existingEmbedInfo.messageId || !existingEmbedInfo.channelid) {
            console.log(`Attempting to send new embed for: '${embedName}' (ID missing or incomplete).`);
            // Pass guild, the *modifiable messageIDs array*, and the current embedName
            embedTasks.push(senderFunc(guild, messageIDs, embedName, guildChannels));
        } else {
            // Log with both IDs for clarity
            console.log(`Message '${embedName}' already exists: Message ID: ${existingEmbedInfo.messageId}, Channel ID: ${existingEmbedInfo.channelid}. Skipping creation.`);
            // Optional: Add logic here to UPDATE existing embeds if their content changes.
        }
    }

    await Promise.all(embedTasks);
    if (embedTasks.length > 0) {
        saveMessageIDs(messageIDs);
        console.log('Embed sending process completed (new embeds created/IDs saved to file).');
    } else
        console.log('All Embeds already exist.');
}
async function sendRulesEmbed(guild, messageIDs, key, guildChannels) {
    const rules = new EmbedBuilder()
        .setTitle('**__Rules__**')
        .setAuthor({
            name: 'Salty\'s Cave',
            iconURL: guild.iconURL({ size: 1024, extension: 'png' }) || undefined
        })
        .setDescription(['__ ** General Server Rules ** __',
            '**1)**  Explicit or Pornographic material(nsfw vids, gifs, etc.) is strictly forbidden.The only exception applies for content specifically permitted within <#1257424392586002613> . All other channels are intended for general discussion, and content within them must not cause discomfort to other members.',
            '**2)**  While light swearing and friendly banter are permitted, content that cause discomfort or offense to other members is prohibited.',
            '**3)**  Moderators and administrators reserve the final say on all discussions.Any directive from moderation, including a request to cease a topic, must be followed immediately.',
            '**4)**  Invitations to external discord servers are permitted only with prior approval from a moderator or Administrator',
            '**5)**  The use of stickers and emotes is generally permitted, however those containing Explicit or Not Safe For Work(NSFW) content are prohibited.Refer to Rule 1 for further clarification regarding NSFW content.',
            '**6)**  Civil discussion on controversial topics is permitted, however illegal activites, current political events, and content promoting violence are strictly prohibited.',
            '**7)**  The sharing of personal identifiable information(3.g.age, full names, addresses, or specific city locations) is strictly prohibited within the server.This measure is in place to ensure the safety and privacy of all members.',
            '**8)**  Misuse or abuse of the ticket system will result to being blacklisted from its use.Appeals for such blacklisting are limited to a single attempt.',
            '**9)** General chat channels are designated for English language discussions.For discussions in other languages, please utilize <#1235314089182625793> channel.',
            '**10)** Alternate accounts(alts) are only permitted if your primary account has been compromised(e.g.hacked, stolen) and verifiable proof is provided.Otherwise, the creation or use of alternate accounts is prohibited, as it may be interpreted as an attempt to evade bans or other disciplinary actions.',
            '**11)** Members are advised to check channel pins for supplementary rules and guidelines specific to each channel, which clarify appropriate and inappropriate content.',
            '**12)** Any disregard for these server rules will result in moderation actions, the severity of which will depend on the nature and frequency of the infraction, and may include a permanent server ban.'].join('\n\n'))
        .addFields(
            {
                name: '**__NSFW Rules__** ', value: ['12. All art should be posted in <#1257424392586002613>.',
                    '13. Please post any VRChat NSFW pictures in <#1257407956408995890>.'].join('\n'), inline: false
            },
            {
                name: '**__RolePlay__**:performing_arts: ', value: [
                    '14.  Keep general roleplay actions concise. Longer actions and detailed descriptions have their own dedicated channel.',
                    '15. Erotic Roleplay is not permitted in general or roleplay channels. For related content see <#1237286045263990825>.',
                    '16.  For Roleplays involving weapons, please use <#1257099297053343878>.'
                ].join('\n')
            },
            {
                name: '**__Voice channels__**:speaking_head: ', value: [
                    '17.  Keep your microphone at a reasonable volume.',
                    '18.  Sound Boards are disabled',
                    '19. if using a camera, please ensure content remains Safe For Work (SFW). This means avoiding nudity or excessivley revealing attire beyond typical arms, face, and leg exposure.',
                    '20.  if you are consuming adult substances (e.g., alcohol, smoking, vaping), please ensure it does not impair your behavior or disrupt others. Excessive intoxication may result in removal from the voice channel.',
                    '21. Repeatedly joining and leaving a voice channel is discouraged as it can be disruptive to ongoing conversations or active streams.'
                ].join('\n\n'), inline: false
            },
            {
                name: '**__Profile Content:__** ', value: [
                    'Profile pictures (PFPs) and banners must be cropped to exclude explicit NSGW content, particularly for the safety of minor users.',
                    'Bios containing racial slurs or hate speech are strictly prohibited. Such content will result in a prompt request to change your bio, or immediate removal from the server.'
                ].join('\n\n'), inline: false
            },
            {
                name: '**__Leveling System:__**', value:
                    'To prevent spam and abuse, new members are required to reach level 3 via <@1392656116428701726> to gain permissions for features such as posting GIFs and joining voice channels.'
                , inline: false
            }

        )
    const roles = new EmbedBuilder()
        .setTitle('Roles')
        .setDescription('Feel free to grab some roles in <#1235323618582466621> channel.');

    const targetChannelId = guildChannels.rules;
    if (!targetChannelId) {
        console.error(`❌ No rules channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [rules, roles] });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendMentalHealthEmbed(guild, messageIDs, key, guildChannels) {
    const mentalhealth = new EmbedBuilder()
        .setTitle('Mental Health')
        .setAuthor({
            name: 'Salty\'s Cave',
            iconURL: guild.iconURL({ size: 1024, extension: 'png' }) || undefined
        })
        .setThumbnail('https://cdn.discordapp.com/attachments/1334669143504326677/1390140478082519152/SaltyWolfHug.png?ex=68672cb5&is=6865db35&hm=59e9740b98736a7013878079dca702c2291a5f054785836dc6041819f9e4dcbf&')
        .setDescription(['At some point in your life, you will have to seek help with mental health and that is OK. What is NOT OK is having several days where you feel like you are going to do something drastic or harm yourself.',
            'This is not a sign of weakness but please be aware that resources are available to you. If you know you or someone is struggling with this, it is imperative that you give them this as soon as possible as early intervention, support or proactive measures can and will save someone\'s life even when they push back hard on you.',
            'This cave is a strong supporter of mental health and is designed to be a safe space for everyone, which I believe in us to make that happen. We want to encourage others even when they are down. A simple talk may be all someone needs from a stranger or a close friend. These people are good but does not replace a doctor or licensed professional who will listen you with an open mind.',
            'If you personally have reached this point, please reach out to the listed numbers below for Immediate emergencies.'
        ].join('\n\n'))
        .setFooter({ text: 'Please use these at your best discretion and stay safe out there!' })
        .setFields(
            {
                name: 'Suicide Crisis Hotlines - Emergency Numbers', value: [
                    `**USA**\n`,
                    `\nSUICIDE AND CRISIS LIFELINE: 988 (toll-free)`,
                    '\nEMERGENCY: 911',
                    '\nCRISIS SMS CONTACT: "HOME" to 741-741\n',

                    '\n**UK/IRELAND**\n',
                    '\nEMERGENCY: 999 (or) 112',
                    '\nSMS CONTACT: "SHOUT" to 85258 (free)',
                    '\nSAMARITANS: 116-123 (free)\n',

                    '\n**GERMANY**\n',
                    '\nEMERGENCY: 112',
                    '\nTELEFONSEELSORGE: 0800 111 0 111 (free)\n',

                    '\n**NETHERLANDS**\n',
                    '\nEMERGENCY: 112',
                    '\n133 ONLINE HOTLINE: 113 (regular fees) / 0800 0113 (free)\n',

                    '\n**RUSSIA**\n',
                    '\nEMERGENCY: 112',
                    '\nSUICIDE HELPLINE: (495) 625 3101',
                    '\nSAMARITANS (Cherepovets) 09:00-21:00: 007 (8202) 577-577\n',

                    '\n**FRANCE**\n',
                    '\nEMERGENCY: 112',
                    '\nNATIONAL SUICIDE PREVENTION HOTLINE: 3114 (free)\n',
                    '\nSOS AMITÉ: 09 72 39 40 50 (free)\n',

                    '\n**AUSTRALIA**\n',
                    '\nEMERGENCY: 000',
                    '\nKIDS HELPLINE (age 5-25): 1800 55 1800',
                    '\nLIFELINE CRISIS SUPPORT AND SUICIDE PREVENTION: 13 11 14\n',

                    '\n**CANADA**\n',
                    '\nEMERGENCY: 911',
                    '\nTALK SUICIDE CANADA: 1-833-456-4566 (or) 45644',
                    '\nTRANS LIFELINE: 1-877-330-6366\n',

                    '\n[For additional Hotlines, links, and resources click here](https://en.wikipedia.org/wiki/List_of_suicide_crisis_lines)'
                ].join('')
            },
            {
                name: 'Useful Links', value:
                    [
                        'Samaritans(Universal):',
                        '[Samaritans](https://www.samaritans.org/)',

                        'Trevor Project (for LGBTQ+):',
                        '[Trevor](https://www.thetrevorproject.org/)',

                        '113Online (Netherlands):',
                        '[113Online](https://www.113.nl/)',
                    ].join('\n'),

            })

    const targetChannelId = guildChannels.mental;
    if (!targetChannelId) {
        console.error(`❌ No mental health channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [mentalhealth] });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendAppealEmbed(guild, messageIDs, key, guildChannels) {
    const appealsembed = new EmbedBuilder()
        .setTitle('Ticket Appeal Form')
        .setDescription([
            'You have been blacklisted from the Ticket system in my server, click above to access the form to appeal.',
            '**__If you are caught again, you will lose these privileges permanently.__**',
            '# click the button below to fill out the appeal form'
        ].join('\n'))
        .setFooter({ text: 'Salty\'s Cave Moderation' })
        .setColor(0xFF5555);

    const appealbutton = new ButtonBuilder()
        .setLabel('Appeal Now')
        .setStyle(ButtonStyle.Link)
        .setURL('https://dyno.gg/form/d564422f');

    const row = new ActionRowBuilder().addComponents(appealbutton);

    const targetChannelId = guildChannels.appeal;
    if (!targetChannelId) {
        console.error(`❌ No appeal channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({
        name: "appeal",
        embeds: [appealsembed],
        components: [row]
    });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });
}

async function sendStaffGuideEmbed(guild, messageIDs, key, guildChannels) {
    const staffguides = new EmbedBuilder()
        .setTitle('Staff Guidelines')
        .setAuthor({
            name: 'Salty\'s Cave',
            iconURL: guild.iconURL({ size: 1024, extension: 'png' }) || undefined
        })
        .setDescription(['All moderation commands are to be executed within <#1307212814036893716> channel, utilizing <@1392656116428701726>\n',

            '\nScreenshots from<#1311483105206472745> and <#1262885297914515627> require prior approval from an Administrator or a higher-ranking staff member before being shared. When capturing such screenshots, ensure that only the information directly relevant to the user\'s request is included.\n',

            '\n__The following links provide direct navigation to specific sections of these guidelines__\n',

            '[Core Guidelines](https://discord.com/channels/1231453115937587270/1391582104952770570)',
            'STAFF ROLES AND RESPONSIBILITES',
            'OPERATIONAL PROCEDURES',
            'ERROR CORRECTION PROTOCOL\n',

            '\n[Ticket System Overview](https://discord.com/channels/1231453115937587270/1391586898392387706)',
            'APPEAL PROCESS GUIDELINES',
            'HANDING INDIVIDUAL TICKETS\n',

            '\n[Identifying and Addressing Malicious Users](https://discord.com/channels/1231453115937587270/1391591076413964370)',
            'RAID RESPONSE AND BAN PROTOCOLS',
            'SCAM PREVENTION AND RESPONSE',
            'RESPONDING TO COMPROMISED ACCOUNTS)\n'].join('\n')
        )
        .setFields({
            name: 'Staff Frequently Asked Questions (FAQ)', value: [
                '[click here for common questions or tips on navigating](https://discord.com/channels/1231453115937587270/1391575774770893031)',
                ' Contains answers to common questions and guidance for navigating these guidelines.'
            ].join('\n')
        }
        )

    const targetChannelId = guildChannels.staffguide;
    if (!targetChannelId) {
        console.error(`❌ No staff guide channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [staffguides] });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendConsoleRoleEmbed(guild, messageIDs, key, guildChannels) {
    const consoles = new EmbedBuilder()
        .setTitle('What do you play on?')
        .setDescription(['💻:<@&1235323729936908379>',
            '📦: <@&1235323730628968530>',
            '🚉: <@&1235323732273397893>',
            '🟥: <@&1235323733246476329>',
            '📱: <@&1235323733795799154>',
            '🎧: <@&1272280467940573296>'].join('\n'))
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [consoles] });
    const consoleemotes = ['💻', '📦', '🚉', '🟥', '📱', '🎧']
    for (const console of consoleemotes) {
        msg.react(console)
    }

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);


    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });
}

async function sendColorsRoleEmbed(guild, messageIDs, key, guildChannels) {
    const color = new EmbedBuilder()
        .setTitle('Get Your Colors here!')
        .setDescription([
            '🔴: <@&1235323620163846294>',
            '🟣: <@&1235323621015158827>',
            '🟢: <@&1235323622546083991>',
            '🩷: <@&1235323622969835611>',
            '🟠: <@&1235323624055902289>',
            '🟡: <@&1235323625037500466>',
            '🔵: <@&1235323625452601437>'
        ].join('\n'))
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [color] });
    const colors = ['🔴', '🟣', '🟢', '🩷', '🟠', '🟡', '🔵']
    for (const color of colors) {
        msg.react(color)
    }

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendPronounsRoleEmbed(guild, messageIDs, key, guildChannels) {
    const pronouns = new EmbedBuilder()
        .setTitle('Identity?')
        .setDescription([
            '🧡: <@&1235323773473783989>',
            '💛: <@&1235323773973168274>',
            '💜: <@&1235323774505582634>',
            '💚: <@&1235323775772528766>'
        ].join('\n'))
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [pronouns] });
    const nouns = ['🧡', '💛', '💜', '💚',]
    for (const pronoun of nouns) {
        msg.react(pronoun)
    }

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendContinentRoleEmbed(guild, messageIDs, key, guildChannels) {
    const continent = new EmbedBuilder()
        .setTitle('Where you on the earth?')
        .setDescription([
            ' 🇪🇺: <@&1235335164436025415>',
            '🦅: <@&1235335164758855781>',
            '🌄: <@&1235335165631397909>',
            '🐼: <@&1235335166772117694>',
            '🐨: <@&1235335167560912927>',
            '🦒: <@&1235335168458231951>'
        ].join('\n'))
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [continent] });

    const location = [
        '🇪🇺', '🦅', '🌄', '🐼', '🐨', '🦒'
    ];
    for (const continent of location) {
        try {
            await msg.react(continent);

        } catch (err) {
            console.error(`❌ Failed to react with ${continent}:`, err);
        }
    }

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);
    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function sendStreamRoleEmbed(guild, messageIDs, key, guildChannels) {
    const twitch = new EmbedBuilder()
        .setTitle('Twitch Pings')
        .setDescription('React here to get notified of when <@857445139416088647> is live!')
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [twitch] });
    msg.react('▶️')

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });
}

async function sendDividersRoleEmbed(guild, messageIDs, key, guildChannels) {
    const dividers = new EmbedBuilder()
        .setTitle('Divders')
        .setDescription(
            'React here to get the Divider roles for easy viewing'
        )
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [dividers] });
    msg.react('🚧')

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });
}

async function EvosendColorsRoleEmbed(guild, messageIDs, key, guildChannels) {
    const Evocolor = new EmbedBuilder()
        .setTitle('Pick your color')
        .setDescription(['It\'s a small but fun way to express yourself and stand out from the crowd.',
            'Just click on any of the colors below and make it your own. And remember, you can always change your color whenever you feel like it!',
            'Thank you for being a part of our friendly community.',
            '🔴: <@&1347447588919443557>',
            '🟣: <@&1347447590928519199>',
            '🟢: <@&1347447605847920640>',
            '🔵: <@&1347447594690805933>',
            '🟤: <@&1347447591901859882>'
        ].join('\n'))
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [Evocolor] });
    const colors = ['🔴', '🟣', '🟢', '🔵', '🟤']
    for (const color of colors) {
        msg.react(color)
    }

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function EvosendContentRoleEmbed(guild, messageIDs, key, guildChannels) {
    const content = new EmbedBuilder()
        .setTitle('Want some content updates????')
        .setDescription('React to this message to get your roles!')
        .setColor(0x9900ff)
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('stream_role_select')
        .setPlaceholder('Select some content')
        .setMinValues(0)
        .setMaxValues(8)
        .addOptions(
            {
                label: ' Evo\'s twitch',
                description: 'Get notifications for Twitch Streams.',
                value: 'role_twitch_updates',
                emoji: '📺'
            },
            {
                label: 'Evo\'s Youtube Content',
                description: 'Get notifications when Evo uploads',
                value: 'role_youtube_updates',
                emoji: '▶️'
            },
            {
                label: 'Hulk\'s Twitch',
                description: 'Get notifications for when Hulk is live',
                value: 'role_hulk_updates',
                emoji: '⏯️'
            },

            {
                label: 'Twitch Viewer',
                description: 'Show you watch people on twitch',
                value: 'role_twitch_viewer',
                emoji: '🎮'
            },
            {
                label: 'Twitch Streamer',
                description: 'For people who stream on twitch',
                value: 'role_twitch',
                emoji: '⏸️'
            },
            {
                label: 'Artist',
                description: 'For users who are artists',
                value: 'role_artist',
                emoji: '🖌️'
            },
            {
                label: 'D&D DM',
                description: 'For Dungeon Masters',
                value: 'role_D&D_Master',
                emoji: '📚'
            },
            {
                label: 'Game Night/Movie Night Host (VR)',
                description: 'For people who want to host game/movie nights',
                value: 'role_game_movie_night',
                emoji: '🕹️'
            }
        )
    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu)

    const msg = await channel.send({
        embeds: [content],
        components: [actionRow]
    });
    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });
}

async function EvosendGameRoleEmbed(guild, messageIDs, key, guildChannels) {
    const gameRole = new EmbedBuilder()
        .setTitle('Games')
        .setDescription('Pick the games you play. Don\'t pick games if you don\'t play them.')
    const targetChannelId = guildChannels.getroles;
    if (!targetChannelId) {
        console.error(`❌ No getroles channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const gameMenu = new StringSelectMenuBuilder()
        .setCustomId('Game_role_Select')
        .setPlaceholder('Select your games')
        .setMinValues(0)
        .setMaxValues(17)
        .addOptions(
            {
                label: 'Path of Exile',
                description: 'get this role if you play the game',
                value: 'role_game_Exile',

            },
            {
                label: 'Monster Hunter',
                description: 'get this role if you play the game',
                value: 'role_game_Hunter',

            },
            {
                label: 'Call Of Duty',
                description: 'get this role if you play the game',
                value: 'role_game_Duty',

            },
            {
                label: 'Fortnight',
                description: 'get this role if you play the game',
                value: 'role_game_Fortnight',

            },
            {
                label: 'Apex Legends ',
                description: 'get this role if you play the game',
                value: 'role_game_Lengends',

            },
            {
                label: 'Gand Theft Auto',
                description: 'get this role if you play the game',
                value: 'role_game_Auto',

            },
            {
                label: 'Red Dead Redemption',
                description: 'get this role if you play the game',
                value: 'role_game_Redemption',

            },
            {
                label: 'Marvel Rivals',
                description: 'get this role if you play the game',
                value: 'role_game_Rivals',

            },
            {
                label: 'Fallout',
                description: 'get this role if you play the game',
                value: 'role_game_Fallout',

            },
            {
                label: 'The Elder Scrolls',
                description: 'get this role if you play the game',
                value: 'role_game_Scrolls',

            },
            {
                label: 'Once Human',
                description: 'get this role if you play the game',
                value: 'role_game_Human',

            },
            {
                label: 'Destiny',
                description: 'get this role if you play the game',
                value: 'role_game_Destiny',

            },
            {
                label: 'Dayz',
                description: 'get this role if you play the game',
                value: 'role_game_Dayz',

            },
            {
                label: '7 Days To Die',
                description: 'get this role if you play the game',
                value: 'role_game_7Days',

            },
            {
                label: 'Dragon Ball',
                description: 'get this role if you play the game',
                value: 'role_game_Dragon',

            },
            {
                label: 'Dungeons and Dragons',
                description: 'get this role if you play the game',
                value: 'role_game_D&D',

            },
            {
                label: 'Borderlands',
                description: 'get this role if you play the game',
                value: 'role_game_Borderlands',

            }
        )
    const actionRow = new ActionRowBuilder()
        .addComponents(gameMenu)

    const msg = await channel.send({
        embeds: [gameRole],
        components: [actionRow]
    });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}

async function EvosendRulesEmbed(guild, messageIDs, key, guildChannels) {
    const rules = new EmbedBuilder()
        .setAuthor({
            name: 'EvoNightWolf\'s Server',
            iconURL: guild.iconURL({ size: 1024, extension: 'png' }) || undefined
        })
        .setDescription(['__ ** General Server Rules ** __',

            '1) Be respectful to everyone. Please don\'t antagonize anyone, definitely don\'t bully someone. ',

            '2) If someone is harassing you or bullying you, block them and open a ticket and let us know. Have proof or we will do nothing. I don\'t care too much for he said, she said. If you don\'t block someone, then you\'re basically asking to get mad or sad or annoyed.',

            '3) If you get reported for bullying or harassment, you will be disciplined as per the disciplinary actions stated here.',

            ' * Strike 1. You will be muted for 24 hours',
            ' * Strike 2. You will be muted for the week and lose permanent permissions in the server.',
            ' * Strike 3. Like baseball, you\'ll be OUT!!! I will have you banned and any hint of secondary account will be immediately ban. Using secondary accounts will be 1 way for us to ignore your ban appeal.',

            'You can always appeal a ban. Notes and warnings will be a 3 month thing. If you do nothing annoying for 3 months, your warnings will reset but it will still be there and we may just take action either way.',

            '4) Do NOT bag on games, players, or other content creators. This is a place to hang out and have fun and play games. We don\'t need to be putting down games that others like, or other creators. Complaining about something is one thing, but going around calling a game trash, that\'s a you problem and will not be tolerated. Don\'t like someone or a game? Play something else.',

            '5) __ABSOLUTELY NEVER EVER-- ping everyone or any roll. It is disabled but even trying is just childish. Don\'t do it.',

            '6) Do not ping people unless it is a legitimate reason. If you ping someone for anything in particular, keep it to the appropriate channel. If you\'re asked to stop by that person, then stop. If it\'s done again and you get reported, then we will write it down and it\'ll be noted.',

            '7) Please understand that if you\'re uncomfortable, you can message the mods through a ticket. If you have an issue with a mod, message me directly.',

            '8) Info you have to know. I am a furry, there\'s more to it than what you think you know so grow up and maybe ask me about it. You may see content about it, you may see other furries. If you say you\'re a furry and you go and harass others, then you will be banned and reported to discord for hate because bullying isn\'t tolerated. If you don\'t like me for being a furry, server, and at the bottom is leave server.',

            'I do accept messages but not friend requests. But if you\'re messaging me with something I don\'t like, then I will ignore you. ALSO REMEMBER!!!!!! I am a truck driver and work a lot, so if I don\'t reply right away, I am either working, sleeping, or playing a game. I\'m not going to check messages mid game. Come on.',
        ].join('\n\n'))
        .addFields(
            {
                name: '**__Roles__** ', value: ['1) Please take roles that retain to you. If you don\'t like a game or don\'t play it, then don\'t take it, because you\'re not here to spy on people and you\'re not here to shit on other games.',

                    '2) Please take roles for your games. If you have content to share then please do!!!!!',

                    '3) If you take a role to another creator or to certain things, you will be pinged and notified. Remember, if you want the notification but don\'t care for the ping, server setting notifications for you.'].join('\n\n'), inline: false
            }
        )

    const targetChannelId = guildChannels.rules;
    if (!targetChannelId) {
        console.error(`❌ No rules channel ID found for guild ${guild.id}.`);
        return;
    }
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) {
        console.error(`Channel ${targetChannelId} for '${key}' embed is not text-based.`);
        return;
    }
    const msg = await channel.send({ embeds: [rules] });

    console.log(`📝 Sent '${key}' embed. Message ID:`, msg.id);

    // Add a new entry to the array if it didn't exist
    messageIDs.push({
        name: key,
        messageId: msg.id,
        channelid: channel.id
    });

}