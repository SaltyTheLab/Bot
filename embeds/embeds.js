import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Colors } from 'discord.js';
import { ruleschannelid, mentalhealthid, ticketappealsid, staffguidesid, getrolesid } from '../BotListeners/channelids.js';
import { loadMessageIDs, saveMessageIDs } from '../utilities/messageStorage.js';
import dotenv from 'dotenv';
dotenv.config();
export let rolemessageid = '';
export async function embedsenders(client) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(console.error);
    if (!guild) {
        console.error('Guild not found');
        return;
    }

    const messageIDs = loadMessageIDs();
    if (!messageIDs['rules']) {
        // === RULES EMBED ===
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

        const bottest = await guild.channels.fetch(ruleschannelid);
        const msg = await bottest.send({ embeds: [rules, roles] });


        console.log('📝 Saved Rules message ID:', msg.id);
        messageIDs['rules'] = msg.id;
        saveMessageIDs(messageIDs);
    } else {
        console.log('ℹ️ rules message already exists:', messageIDs['rules']);
    }
    if (!messageIDs['mental']) {
        // === MENTAL HEALTH EMBED ===
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

        const bottest = await guild.channels.fetch(mentalhealthid);
        const msg = await bottest.send({ embeds: [mentalhealth] });



        console.log('📝 Saved reaction role message ID:', msg.id);
        messageIDs['mental'] = msg.id;
        saveMessageIDs(messageIDs);
    }
    else {
        console.log('ℹ️ mental health message already exists:', messageIDs['mental']);
    }
    if (!messageIDs['appeal']) {
        // === APPEALS EMBED ===
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

        const bottest = await guild.channels.fetch(ticketappealsid);
        const msg = await bottest.send({
            embeds: [appealsembed],
            components: [row]
        });


        console.log('📝 Saved reaction role message ID:', msg.id);
        messageIDs['appeal'] = msg.id;
        saveMessageIDs(messageIDs);
    } else {
        console.log('ℹ️ Appeal message already exists:', messageIDs['appeal']);
    }

    if (!messageIDs['staffguide']) {
        // === STAFF GUIDE EMBED ===
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


        const bottest = await guild.channels.fetch(staffguidesid);
        const msg = await bottest.send({ embeds: [staffguides] });


        console.log('📝 Saved reaction role message ID:', msg.id);
        messageIDs['staffguide'] = msg.id;
        saveMessageIDs(messageIDs);
    } else {
        console.log('ℹ️ staff guidelines message already exists:', messageIDs['staffguide']);
    }

    // === REACTION ROLE EMBED ===

    const consoles = new EmbedBuilder()
        .setTitle('What do you play on?')
        .setDescription(['💻:<@&1235323729936908379>',
            '📦: <@&1235323730628968530>',
            '🚉: <@&1235323732273397893>',
            '🟥: <@&1235323733246476329>',
            '📱: <@&1235323733795799154>',
            '🎧: <@&1272280467940573296>'].join('\n'))
    const roles = await guild.channels.fetch(getrolesid);
    let msg = await roles.send({ embeds: [consoles] });
    const consoleemotes = ['💻', '📦', '🚉', '🟥', '📱', '🎧']
    for (const console of consoleemotes) {
        msg.react(console)
    }
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
    msg = await roles.send({ embeds: [color] })
    const colors = ['🔴', '🟣', '🟢', '🩷', '🟠', '🟡', '🔵']
    for (const color of colors) {
        msg.react(color)
    }
    const pronouns = new EmbedBuilder()
        .setTitle('Identity?')
        .setDescription([
            '🧡: <@&1235323773473783989>',
            '💛: <@&1235323773973168274>',
            '💜: <@&1235323774505582634>',
            '💚: <@&1235323775772528766>'
        ].join('\n'))
    msg = await roles.send({ embeds: [pronouns] })
    const nouns = ['🧡', '💛', '💜', '💚',]
    for (const pronoun of nouns) {
        msg.react(pronoun)
    }
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
    msg = await roles.send({ embeds: [continent] })
    const location = [
        '🇪🇺', '🦅', '🌄', '🐼', '🐨', '🦒'
    ];
    for (const continent of location) {
        try {
            await msg.react(continent);

        } catch (err) {
            console.error(`❌ Failed to react with ${emoji}:`, err);
        }
    }

    const twitch = new EmbedBuilder()
        .setTitle('Twitch Pings')
        .setDescription('React here to get notified of when <@857445139416088647> is live!')
    msg = await roles.send({ embeds: [twitch] })
    msg.react('▶️')

    const dividers = new EmbedBuilder()
        .setTitle('Divders')
        .setDescription(
            'React here to get the Divider roles for easy viewing'
        )
    msg = await roles.send({ embeds: [dividers] })
    msg.react('🚧')
}
