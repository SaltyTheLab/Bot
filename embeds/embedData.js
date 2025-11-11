import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js'
export const guildEmbedConfig = {
    "1231453115937587270": {
        "rules": {
            embeds: {
                title: '**__Rules__**',
                description:
                    ['__ ** General Server Rules ** __',
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
                        '**12)** Selfies or other images that contain your full likeness will not be allowed, even in <#1302818403408674828>',
                        '**13)** Disregarding of these server rules will result in moderation actions, the severity of which will depend on the nature and frequency of the infraction, and may include a permanent server ban.'].join('\n\n'),
                fields: [
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
                            'To prevent spam and abuse, new members are required to reach level 3 via <@1420927654701301951> to gain permissions for features such as posting GIFs and joining voice channels.'
                        , inline: false
                    },
                    {
                        name: '**__Roles__**',
                        value: 'Feel free to grab some roles in <#1235323618582466621> channel.'
                    }
                ]
            }
        },
        "mental": {
            embeds: {
                title: 'Mental Health',
                description: ['At some point in your life, you will have to seek help with mental health and that is OK. What is NOT OK is having several days where you feel like you are going to do something drastic or harm yourself.',
                    'This is not a sign of weakness but please be aware that resources are available to you. If you know you or someone is struggling with this, it is imperative that you give them this as soon as possible as early intervention, support or proactive measures can and will save someone\'s life even when they push back hard on you.',
                    'This cave is a strong supporter of mental health and is designed to be a safe space for everyone, which I believe in us to make that happen. We want to encourage others even when they are down. A simple talk may be all someone needs from a stranger or a close friend. These people are good but does not replace a doctor or licensed professional who will listen you with an open mind.',
                    'If you personally have reached this point, please reach out to the listed numbers below for Immediate emergencies.'
                ].join('\n\n'),
                footer: { text: 'Please use these at your best discretion and stay safe out there!' },
                fields: [{
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

                }
                ]
            }
        },
        "scams": {
            embeds: {
                title: 'Common Scams',
                color: 0xc27013,
                description: [
                    'There are a few common scams to look out for and be weary of. Most of these will give you a seeming too good to be true or impossible deadline. They will promise that you can pay in installments as you get paid. These are the well known ones:',
                    '1. The artist scam:\n These are the easiest to spot with a user dming you "hey i like your pfp" or "Is that your OC, it looks really good and I have an Idea for your sona". These guys are usually bots or actual people trying to steal your hard earned money.',
                    '2. The VrChat Avatar scam:\n These start out with a user claiming to play vrchat then try to ask how long you have been playing for. Once they have talked to you enough they will most likely ask if you have a public or private avatar, your answer will not matter and they\'ll try to rope you into looking at their work. The alternative version of this scam is someone acting as a satisfied customer from a modeler. These guys will also try to show you their work.',
                    '3. The Game Tester scam:\n These start out as a user claiming to make a game and ask you to test it for them, the file they send you is certain to be malicous and will certainly be damaging to your computer or are data miners that scan and send your info back to the scammer to be sold off or used later. Block and report these accounts ASAP',
                    '4. The Nitro Scam:\n This is a classic one, always verify that the nitro you recieved is legit, most fake gifts will use bot embed buttons for you to click on a link, offical discord nitro gifts have a very different look to them, so if you recieve a nitro gift and the accept button isn\'t green but gray, then it is not real',
                    '5. The Steam account Scam:\n This usually starts with a "I accidentally reported your account to steam instead of another person" These ones will try to steal your steam account credentials. If there is a problem with your account steam would contact you via an offical email and not discord',
                    'How can I protect myself?\n Always enable 2fa on your account, this is a small additional security measure but it ensures someone else cannot access your account without a short number that is sent to your phone'
                ].join('\n\n')
            }
        },
        "staffguide": {
            embeds: {
                title: 'Staff Guidelines',
                description: ['All moderation commands are to be executed within <#1307212814036893716> channel, utilizing <@1420927654701301951>\n',
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
            }
        },
        "getstream": {
            embeds: {
                title: 'Twitch Pings',
                description: 'React here to get notified of when <@857445139416088647> is live!'
            },
            reactions: ['▶️'],
        },
        "getdividers": {
            embeds: {
                title: 'Divders',
                description: 'React here to get the Divider roles for easy viewing',
            },
            reactions: ['🚧'],
        },
        "getpronouns": {
            embeds: {
                title: 'Identity?',
                description: [
                    '🧡: <@&1235323773473783989>',
                    '💛: <@&1235323773973168274>',
                    '💜: <@&1235323774505582634>',
                    '💚: <@&1235323775772528766>'
                ].join('\n')
            },
            reactions: ['🧡', '💛', '💜', '💚']
        },
        "getconsole": {
            embeds: {
                title: 'What do you play on?',
                description: ['💻:<@&1235323729936908379>',
                    '📦: <@&1235323730628968530>',
                    '🚉: <@&1235323732273397893>',
                    '🟥: <@&1235323733246476329>',
                    '📱: <@&1235323733795799154>',
                    '🎧: <@&1272280467940573296>'].join('\n')
            },
            reactions: ['💻', '📦', '🚉', '🟥', '📱', '🎧']
        },
        "getlocation": {
            embeds: {
                title: 'Where you on the earth?',
                description: [
                    ' 🇪🇺: <@&1235335164436025415>',
                    '🦅: <@&1235335164758855781>',
                    '🌄: <@&1235335165631397909>',
                    '🐼: <@&1235335166772117694>',
                    '🐨: <@&1235335167560912927>',
                    '🦒: <@&1235335168458231951>'
                ].join('\n')
            },
            reactions: ['🇪🇺', '🦅', '🌄', '🐼', '🐨', '🦒']
        },
        "getcolor": {
            embeds: {
                title: 'Get Your Colors here!',
                description: [
                    '🔴: <@&1235323620163846294>',
                    '🟣: <@&1235323621015158827>',
                    '🟢: <@&1235323622546083991>',
                    '🩷: <@&1235323622969835611>',
                    '🟠: <@&1235323624055902289>',
                    '🟡: <@&1235323625037500466>',
                    '🔵: <@&1235323625452601437>',
                    '🔷: <@&1418796891138687107>'
                ].join('\n')
            },
            reactions: ['🔴', '🟣', '🟢', '🩷', '🟠', '🟡', '🔵', '🔷']
        }
    },
    "1347217846991851541": {
        "rules": {
            embeds: {
                description: ['__ ** General Server Rules ** __',
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
                ].join('\n\n'),
                fields: [{
                    name: '**__Roles__** ', value: [
                        '1) Please take roles that retain to you. If you don\'t like a game or don\'t play it, then don\'t take it, because you\'re not here to spy on people and you\'re not here to shit on other games.',
                        '2) Please take roles for your games. If you have content to share then please do!!!!!',
                        '3) If you take a role to another creator or to certain things, you will be pinged and notified. Remember, if you want the notification but don\'t care for the ping, server setting notifications for you.'
                    ].join('\n\n'), inline: false
                }]
            },
            reactions: null
        },
        "Getcontent": {
            embeds: {
                title: 'Want some content updates????',
                description: 'React to this message to get your roles!',
                color: 0x9900ff
            },
            components: [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
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
            )]

        },
        "Getgames": {
            embeds: {
                title: 'Games',
                description: 'Pick the games you play. Don\'t pick games if you don\'t play them.'
            },
            components: [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
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
            )]
        },
        "Getcolor": {
            embeds: {
                title: 'Pick your color',
                description: ['It\'s a small but fun way to express yourself and stand out from the crowd.',
                    'Just click on any of the colors below and make it your own. And remember, you can always change your color whenever you feel like it!',
                    'Thank you for being a part of our friendly community.',
                    '🔴: <@&1347447588919443557>',
                    '🟣: <@&1347447590928519199>',
                    '🟢: <@&1347447605847920640>',
                    '🔵: <@&1347447594690805933>',
                    '🟤: <@&1347447591901859882>'
                ].join('\n')
            },
            reactions: ['🔴', '🟣', '🟢', '🔵', '🟤']
        }
    },
    "1342845801059192913": {
        "rules": {
            embeds: {
                color: 0x086ca5,
                title: 'Welcome to Bark!!',
                description: [
                    'This server has a few easy rules to follow, and by doing so you will like this community created by <@1226077693548953630>.',
                    'Here are the rules you need to follow:',
                    '1)  <#1388115293338996737> channel is only available to users with the <@&1388111992287400089> role. Getting this role requires you to be verified. Being caught lying about your age is punishable by __**ban**__, no exceptions. Having minors being able to access this section causes serious issues so once caught you cannot get the role back even if you prove your 18+ now',
                    '2) "do unto you as you do unto others" otherwise known as respect others and you will recieve respect in return. <@&1409208962091585607> will not always be available to de escalate things so, please, if you have issues and a mod is not around ping <@&1402282104401821828> and they can help as well. And always try to ping the role instead of a individual user as they specificlly may not see your message',
                    '3) Please keep drama, personal "beef", and arguements in dms or elsewhere as this kills the flow of chat.',
                    '4) <@1226077693548953630>, <@&1408636330124251157>, <@&1388113570369372181>, <@&1409208962091585607>, and <@&1402282104401821828> have final say on a topic. Please listen to them and do not start arguments like "it was just a joke". That excuse will not fly here since you are talking to strangers or people you barely know. What might be funny to you and someone else may be hurting a bystander watching chat.',
                    '5) Sensitive topics like "offing yourself" is strictly forbbiden here, we take this topic very seriously. No ifs, ands, or buts about it.',
                    '6) Do not block or mute staff, we need to be able to see everyone\'s activity. You will be banned on the spot.'
                ].join('\n\n'),
                fields: [{
                    name: 'AutoMod:', value: [
                        'AutoMod(<@1420927654701301951>) Functions:',
                        '* Caps(minimun ten length)',
                        '* everyone ping',
                        '* bad words',
                        '* Discord Invites',
                        '* General Spam',
                        '* Duplicate messeages',
                        '* media\n',
                        'Warnings:\n',
                        'for each warn you get from automod or manual, this becomes an Active Warn meaning tha After 24 hours, the warn that was issued will expire. These will compound when you get multiple in a day\n',
                        'Media:\n',
                        'For every 20 messages you send or are inactive(no messages sent) for an hour, your media count will be reset. Do not take advantage of the reset hence why it is so long'
                    ].join('\n')
                },
                { name: 'Circumventing automod filter:', value: 'Trying to use placeholders or different letters to circumvent the automods filter will lead to a warn or mute' }]
            }
        },
        "getroles": {
            embeds: {
                description: [
                    `Get your age role here. Lying about your age is punishable up to a ban depending on severity:\n`,
                    '🔞: <@&1388113103081705502>',
                    '👨: <@&1388111992287400089>'
                ].join('\n'),
            },
            reactions: ['🔞', '👨']
        },
        "dirty": {
            embeds: {
                color: 0xf700ff,
                title: 'Rules of the 18+ catagorey',
                description: [
                    'All sever rules apply here but there are a few supplemental rules here:\n',
                    '1) all NSFW Art must go into the <#1388116277670842478> channel.',
                    '2) There is a dedicated nsfw vc channel called dirty talk for the appropriate conversations',
                    '3) No IRL pics in nsfw! We are adults here and expect common sense here. This will lead to a swift ban.\n',
                    'react with 🍆 to get access to <#1388116277670842478> and the dirty vc here!'
                ].join('\n'),
            },
            reactions: ['🍆']
        },
        "staffguide": {
            embeds: {
                title: '__**Staff Guidelines**__',
                description: [
                    'Welcome to the staff team of Bark!',
                    'Below are some guidelines to help you familiarize yourself with the commands of <@1420927654701301951>',
                    '[click here](https://discord.com/channels/1342845801059192913/1423832190919114826/1423834091102666924)\nTHE ROLES\nINFORMATION\nPROCEDURE\nHUMAN ERROR\n',
                    '[click here](https://discord.com/channels/1342845801059192913/1423834519345299568/1423834854906265791)\nBOT COMMANDS\nBAN APPEALS\nTICKETS\nFEBOT IS DOWN'
                ].join('\n')
            }
        }
    }
}
