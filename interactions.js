import { get, pull, post, put, patch } from "./root.js";
import e from "express";
import nacl from 'tweetnacl';
import guildChannelMap from './guildconfiguration.json' with {type: 'json'}
import { findApp, editPunishment, getPunishments, incrementcoins, appealsinsert, removeApp, addToApp, appealsget, appealupdate, viewNotes, editNote, getUser, getblacklist, editblacklist, leaderboard, getembedIDs, editembedIDs, nukeApps } from "./Database/databaseAndFunctions.js";
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import logos from './Database/logos.json' with {type: 'json'}
import punishUser from "./punishUser.js";
import { generateRankCard, initializeRankCardBase } from "./rankcardgenerator.js";
const app = e();
initializeRankCardBase();
const xpNeeded = (level) => { Math.round(((level - 1) ** 1.5 * 52 + 40) / 20) * 20 }
app.use(e.json({ verify: (req, res, buf) => { req.rawBody = buf; } }))
async function buildLogEmbed(targetUser, log, idx, totalLogs) {
    const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const user = await get(`users/${targetUser}`);
    const moderator = await get(`users/${log.moderatorId}`);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
    const mins = Math.round(log.duration / 60000);
    const hours = Math.floor(mins / 60);
    return {
        color: LOG_COLORS[log.type],
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetUser}/${user.avatar}.png` },
        description: `**Member:**\n<@${log.userId}>\n\n**Type:**\n\`${log.type}\`\n\n**Punishments:**\n\`${log.weight} warn\`, ${log.duration ? (hours > 0 ? `\`${hours} hour Mute\`` : `\`${mins} minute Mute\``) : ''}\n\n**Reason:**\n\`${log.reason}\`\n\n**Warns at Log Time:**\n\`${log.weight}\`\n\n**Channel:**\n<#${log.channel}>\n\n[Event Link](${log.refrence})`,
        footer: { text: `Staff: ${moderator.username} | log ${idx + 1} of ${totalLogs} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${log.moderatorId}/${moderator.avatar}.png` }
    }
};
function generateButtons(gameBoard, player1, player2, currentplayer, disabled = false) {
    const rows = [];
    const boardStr = gameBoard.join(',');
    for (let i = 0; i < 3; i++) {
        const row = { type: 1, components: [] }
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.components.push({
                type: 2,
                custom_id: `tictactoe-${boardStr}-${player1}-${player2}-${currentplayer}-${index}`,
                label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2,
                disabled: gameBoard[index] !== ' ' || disabled
            })
        }
        rows.push(row);
    }
    return rows;
}
function getComparableEmbed(embedData) {
    if (!embedData) return null; const normalizeText = (text) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    const cleanmessage = {
        title: normalizeText(embedData.title), description: normalizeText(embedData.description), url: normalizeText(embedData.url),
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    }
    return JSON.stringify(cleanmessage);
}
app.post('/interactions', async (req, res) => {
    const signature = req.get('X-Signature-ed25519');
    const timestamp = req.get('X-Signature-Timestamp');
    const body = req.rawBody;
    const isVerified = nacl.sign.detached.verify(
        Buffer.concat([Buffer.from(timestamp), body]),
        Buffer.from(signature, 'hex'),
        Buffer.from('069a7f3ba017ead748bac35f05bb9444b7758f9d9638b0f76d03d515b2b8ec90', 'hex'));
    if (!isVerified) {
        return res.status(401).end('invalid request signature');
    }
    const { token, type, guild_id, user, member, member: Rawuser, data: { values, components }, channel_id, application_id, message } = req.body;
    if (type === 1) { return res.send({ type: 1 }); }
    if (type === 2) {
        const { data: { options, name } } = req.body
        if (name == 'appeal') {
            const userbans = await appealsget(user.id)
            const options = []
            for (const ban of userbans) {
                const banentry = ban.punishments.filter(p => p.type === 'Ban') ?? null
                const guild = await get(`guilds/${guild_id}`)
                if (banentry.length !== 0) {
                    options.push({ label: guild.name, value: guild.id, description: `Banned on: ${new Date(ban.punishments.timestamp).toLocaleDateString()}` });
                }
            }
            if (options.length == 0) return res.send({ type: 4, data: { content: 'I could not find any ban records.' } })
            return res.send({
                type: 9,
                data: {
                    custom_id: 'appealModal',
                    title: 'Ban Appeal Submission',
                    components: [
                        { type: 18, label: "Guild ID", component: { type: 3, custom_id: 'guildId', max_values: 1, options: options } },
                        { type: 18, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
                        { type: 18, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
                        { type: 18, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } }]
                }
            });
        }
        if (name == 'games') {
            const subcommand = options[0].name;
            switch (subcommand) {
                case 'bet': {
                    const coincount = options[0].options[0].value;
                    const userId = member?.user?.id
                    const { userData } = await getUser({ userId: userId, guildId: guild_id, modflag: true });
                    if (coincount > userData.coins)
                        return res.send({ type: 4, data: { content: `You cannot bet more than you have!`, flags: 64 } });
                    let win = Math.random() >= 0.5;
                    const amount = win ? Math.ceil(coincount * 1.5) : coincount;
                    await incrementcoins({ userId: userId, guildId: guild_id, coins: amount, win: win });
                    return res.send({
                        type: 4, data: {
                            embeds: [{
                                color: win ? 0x007a00 : 0x7a0000,
                                author: { name: `${user?.username || member.user.username} you bet ${coincount} and ${win ? 'won' : 'lost'}!`, icon_url: user?.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : "" }
                            }]
                        }
                    });
                }
                case 'tictactoe': {
                    const player1 = member.user.id;
                    const player2 = options[0].options[0].value
                    const gameBoard = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
                    if (player1 === player2)
                        return res.send({ type: 4, data: { content: "You can't play against yourself.", flags: 64 } })
                    let currentplayer = Math.random() < 0.5 ? player1 : player2;
                    return res.send({
                        type: 4,
                        data: {
                            content: `<@${player2}>, <@${player1}> wants to play tictactoe`,
                            embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${currentplayer}>'s turn to move.` }],
                            components: generateButtons(gameBoard, player1, player2, currentplayer)
                        }
                    });
                }
                case 'rps': {
                    const move = options[0].options[0].value;
                    const opponentchoices = ['Rock', 'Paper', 'Scissors']
                    const opponentchoice = opponentchoices[Math.floor(Math.random() * 3)];
                    const beats = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' }
                    let result = '';
                    beats[move] === opponentchoice ? result = 'you win!!!' : beats[opponentchoice] === move ? result = 'Febot Wins!!!' : result = "it's a tie!!"
                    if (result === 'you win!!!')
                        incrementcoins({ userId: Rawuser.user.id, guildId: guild_id, coins: 20, win: true })
                    return res.send({ type: 4, data: { embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opponentchoice}**.`, color: 0xffa500 }] } })
                }
                case 'logos': {
                    function shuffle(array) {
                        for (let i = array.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [array[i], array[j]] = [array[j], array[i]];
                        }
                        return array;
                    }
                    res.send({ type: 5 })
                    const useravatar = `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
                    const logo = logos[Math.floor(Math.random() * logos.length)];
                    console.log(logo)
                    const options = shuffle([logo, ...shuffle(logos.filter(l => l.brand !== logo.brand)).slice(0, 3)]);
                    const buttons = options.map(option => { return { type: 2, custom_id: `logos-${option.brand}-${logo.brand}`, label: option.brand, style: 1 }; });
                    const formData = new FormData()
                    formData.append('payload_json', JSON.stringify({
                        embeds: [{
                            author: { name: `Guess this logo ${member.user.username}`, icon_url: useravatar },
                            color: parseInt(`0x${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`, 16),
                            image: { url: `attachment://logo.png` }
                        }],
                        components: [{ type: 1, components: buttons }],
                    }));
                    const fileBuffer = readFileSync(resolve(logo.image));
                    const blob = new Blob([fileBuffer], { type: 'image/png' });
                    formData.append('files[0]', blob, 'logo.png');
                    await post(`webhooks/${application_id}/${token}`, formData)
                    break;
                }
                case 'highlow': {
                    const startNumber = Math.ceil(Math.random() * 100);
                    let secretTarget = Math.ceil(Math.random() * 100);
                    while (secretTarget === startNumber)
                        secretTarget = Math.ceil(Math.random() * 100);
                    return res.send({
                        type: 4,
                        data: {
                            embeds: [{ color: 0x333300, title: "Higher or Lower", description: `I am thinking of a number. \n\nThe current value is **${startNumber}**\n\n Do you think my number is higher or lower?` }],
                            components: [{
                                type: 1,
                                components: [{
                                    type: 2,
                                    label: "Higher",
                                    style: 1,
                                    custom_id: `highlow-higher-${startNumber}-${secretTarget}`
                                }, {
                                    type: 2,
                                    label: "Lower",
                                    style: 4,
                                    custom_id: `highlow-lower-${startNumber}-${secretTarget}`
                                }]
                            }]
                        }
                    })
                }
            }
        }
        if (name == 'user') {
            const { data: { resolved } } = req.body;
            res.send({ type: 5 })
            const subcommand = options[0].name;
            const targetUserId = options[0].options[0]?.value ?? member.user.id;
            const { userData, rank } = await getUser({ userId: targetUserId, guildId: guild_id, modflag: true });
            const targetUser = resolved?.users?.[targetUserId] || member.user;
            if (!userData) return await post(`webhooks/${application_id}/${token}`, { content: 'User data not found or incomplete.', flags: 64 })
            let image;
            switch (subcommand) {
                case 'rank': {

                    image = await generateRankCard({ userData: userData, targetUser: targetUser, xpNeeded: xpNeeded(userData.level), rank: rank })
                    break;
                }
                case 'profile': image = await generateRankCard({ userData: userData, targetUser: targetUser });
            }
            const formData = new FormData()
            const blob = new Blob([image.file], { type: 'image/png' })
            formData.append('files[0]', blob, image.name);
            formData.append('payload_json', JSON.stringify({ attachments: [{ id: 0, filename: image.name }] }));
            await post(`webhooks/${application_id}/${token}`, formData);
        }
        if (name == 'blacklist') {
            const targetUser = options[0].options[0].value
            const blacklist = await getblacklist(targetUser, guild_id)
            let role = null
            const embed = { description: `<@${targetUser}>'s blacklist\n\nblacklist: ${blacklist.length > 0 ? blacklist.map(role => `<@&${role}>`).join(',') : 'empty'}` }
            const subcommand = options[0].name;
            switch (subcommand) {
                case 'add':
                    role = options[0].options[1].value
                    embed.description = `<@&${role}> was blacklisted from <@${targetUser}>`
                    if (!blacklist.includes(role.id)) {
                        await editblacklist(targetUser, guild_id, role, 'push')
                        await pull(`guilds/${guild_id}/members/${targetUser}/roles/${role}`);
                    } else embed.description = `<@&${role}> is already blacklisted from <@${targetUser}>`
                    break;
                case 'remove':
                    role = options[0].options[1].value
                    editblacklist(targetUser, guild_id, role, 'pull')
                    embed.description = `<@&${role}> was removed from <@${targetUser}>'s blacklist`
                    break;
            }
            res.send({ type: 4, data: { embeds: [embed] } });
        }
        if (name == 'dnd') {
            let numbers;
            const subcommand = options[0].name;
            switch (subcommand) {
                case 'd4': numbers = [1, 2, 3, 4];
                    break;
                case 'd6': numbers = [1, 2, 3, 4, 5, 6];
                    break;
                case 'd8': numbers = [1, 2, 3, 4, 5, 6, 7, 8];
                    break;
                case 'd10': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                    break;
                case 'd12': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                    break;
                case 'd20': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
                    break;
                case 'd100': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 821, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
            }
            for (let i = numbers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
            }
            return res.send({ type: 4, data: { content: `you rolled a ${numbers[Math.floor(Math.random() * numbers.length)]}` } })
        }
        if (name == 'apply') {
            const application = await findApp({ userId: member.user.id })
            if (application && application.Activity) {
                return res.send({
                    type: 4,
                    data: { content: 'Already Completed. Click the button below to continue.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'skip Part 1', style: 1 }] }], flags: 64 }
                });
            } else {
                return res.send({
                    type: 9,
                    data: {
                        title: 'Experience and Activity (1/3)',
                        custom_id: 'server',
                        components: [
                            {
                                type: 18,
                                label: `What age range are you in?`,
                                component: {
                                    type: 3, custom_id: 'age',
                                    options: [{ label: '12 or under', value: '12 or under' },
                                    { label: '13 to 15', value: '13-15' },
                                    { label: '16 to 17', value: '16-17' },
                                    { label: '18 or over', value: '18 or over' }],
                                    max_values: 1, required: true, max_length: 300
                                }
                            },

                            { type: 18, label: 'Any prior mod experience?', component: { type: 4, custom_id: 'experience', required: true, style: 2, max_length: 300 } },
                            { type: 18, label: 'Have you been warned/muted?', component: { type: 4, custom_id: 'punishments', required: true, style: 1, max_length: 100 } },
                            { type: 18, label: 'Timezone?', component: { type: 4, custom_id: 'timezone', required: true, style: 1, placeholder: 'put current time if unsure', max_length: 8 } },
                            { type: 18, label: `How active are you in the server?`, component: { type: 4, custom_id: 'activity', style: 1, required: true, max_length: 150 } }
                        ]
                    }
                })
            }
        }
        if (name == 'appeal') {
            const userbans = await appealsget(user.id)
            const options = []
            for (const ban of userbans) {
                const banentry = ban.punishments.filter(p => p.type === 'Ban') ?? null
                const guild = await get(`guilds/${guild_id}`)
                if (banentry.length !== 0) {
                    options.push({ label: guild.name, value: guild.id, description: `Banned on: ${new Date(ban.punishments.timestamp).toLocaleDateString()}` });
                }
            }
            if (options.length == 0) return res.send({ type: 4, data: { content: 'I could not find any ban records.' } })
            return res.send({
                type: 9,
                data: {
                    custom_id: 'appealModal',
                    title: 'Ban Appeal Submission',
                    components: [
                        { type: 18, label: "Guild ID", component: { type: 3, custom_id: 'guildId', max_values: 1, options: options } },
                        { type: 18, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
                        { type: 18, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
                        { type: 18, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } }]
                }
            });
        }
        if (name == 'leaderboard') {
            const board = await leaderboard(guild_id)
            const guild = await get(`guilds/${guild_id}`)
            res.send({
                type: 4, data: {
                    embeds: [{
                        title: `Most active in ${guild.name}`,
                        thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` },
                        color: 0x0c23a3,
                        description: `**__LeaderBoard:__**\n${board.map((user, index) => { return `Rank \`${index + 1}\`: <@${user.userId}> - level \`${user.level}\` with \`${user.xp}\` xp` }).join('\n')}`,
                        timestamp: new Date().toISOString()
                    }],
                }
            })
        }
        if (name == 'modlogs') {
            const targetUser = options[0].value
            const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
            const embed = { color: 0xf58931, description: `❌ No modlogs found for<@${targetUser}>.` };
            let allLogs = await getPunishments(targetUser, guild_id);
            if (!allLogs.length)
                return res.send({ type: 4, data: { embeds: [embed] } })
            let currentIndex = 0;
            const buttons = (disabled) => {
                return [
                    { type: 2, custom_id: `modlog-prev-${targetUser}-${currentIndex}-${member.user.id}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 || disabled },
                    { type: 2, custom_id: `modlog-next-${targetUser}-${currentIndex}-${member.user.id}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 || disabled },
                    ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${targetUser}-${currentIndex}-${member.user.id}`, label: 'Delete', style: 4, disabled: disabled }] : [])
                ]
            };
            let currentLog = allLogs[currentIndex];
            res.send({
                type: 4, data: {
                    embeds: [await buildLogEmbed(targetUser, currentLog, currentIndex, allLogs.length)],
                    components: [{ type: 1, components: buttons(false) }]
                }
            })
            setTimeout(async () => {
                const message = await get(`webhooks/${process.env.CLIENT_ID}/${token}/messages/@original`);
                await patch(`channels/${channel_id}/messages/${message.id}`, { components: [{ type: 1, components: buttons(true) }] })
            }, 10 * 60 * 1000)
        }
        if (name == 'note') {
            const targetUser = options[0].options[0].value
            let note = null;
            const embed = { color: 0x00a900, description: `❌ No notes found for <@${targetUser}>` }
            switch (options[0].name) {
                case 'add':
                    note = options[0].options[1].value
                    await editNote({ userId: targetUser, moderatorId: member.user.id, note: note, guildId: guild_id })
                    embed.color = 0x00a900;
                    embed.description = `📝 note created for <@${targetUser}>\n\n\n > ${note}`;
                    return res.send({ type: 4, data: { embeds: [embed] } });
                case 'show': {
                    let allnotes = await viewNotes(targetUser, guild_id);
                    if (!allnotes.length)
                        return res.send({ type: 4, data: { embeds: [embed] } });
                    let currentIndex = 0;
                    let currentnote = allnotes[currentIndex]
                    const mod = await get(`users/${currentnote.moderatorId}`);
                    const user = await get(`users/${targetUser}`);
                    const formattedDate = new Date(currentnote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
                    const buttons = (disabled) => {
                        return [
                            { type: 2, custom_id: `note-prev-${targetUser}-${currentIndex}-${member.user.id}}`, label: '◀️ prev', style: 2, disabled: currentIndex === 0 || disabled },
                            { type: 2, custom_id: `note-next-${targetUser}-${currentIndex}-${member.user.id}}`, label: '▶️ next', style: 2, disabled: currentIndex >= allnotes.length - 1 || disabled },
                            { type: 2, custom_id: `note-del-${targetUser}-${currentIndex}-${member.user.id}}`, label: '🗑️ delete', style: 4, disabled: disabled }
                        ]
                    }
                    res.send({
                        type: 4,
                        data: {
                            embeds: [{
                                color: 0xdddddd,
                                thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                                description: `<@${user.id}> notes |  \`${currentIndex + 1} of ${allnotes.length}\`\n > ${currentnote.note}`,
                                footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
                            }],
                            components: [{ type: 1, components: buttons(false) }]
                        }
                    });
                    setTimeout(async () => {
                        const message = await get(`webhooks/${process.env.CLIENT_ID}/${token}/messages/@original`);
                        await patch(`channels/${channel_id}/messages/${message.id}`, { components: [{ type: 1, components: buttons(true) }] })
                    }, 15 * 1000)
                }
            }
        }
        if (name == 'refresh') {
            res.send({ type: 5 })
            let messageIDs = await getembedIDs({ guildId: guild_id })
            const messageconfigs = guildChannelMap[guild_id].messageConfigs ?? null
            if (!messageconfigs) { console.log(`No config found for guild ID: ${guild_id}`); return; }
            for (const [embedName, config] of Object.entries(messageconfigs)) {
                const { channelid, embeds, components, reactions } = config;
                const embed = embeds.map(e => { if (typeof e.color === 'string') e.color = parseInt(e.color.replace('#', ''), 16); return e; });
                try {
                    const existingdata = messageIDs.find(m => m.name === embedName)
                    const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`)
                    const different = message.embeds.map(embed => getComparableEmbed(embed)).join('|||') !== embed.map(embed => getComparableEmbed(embed)).join('|||')
                    if (different) {
                        await patch(`channels/${channelid}/messages/${existingdata.messageId}`, { embeds: embed })
                        console.log(`✅ Message '${embedName}' updated.`);
                    }
                } catch {
                    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                    const msg = await post(`channels/${channelid}/messages`, { embeds: embed, ...components })
                    messageIDs = messageIDs.filter((message) => message.name !== embedName);
                    if (reactions) for (const reaction of reactions) {
                        await put(`channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`);
                        await sleep(750)
                    }
                    console.log(`📝 Sent '${embedName}'. Message ID: `, msg.id);
                    await messageIDs.push({ name: embedName, messageId: msg.id })
                    await editembedIDs('./Extravariables/EmbedIDs.json', messageIDs);
                }
            }
            await patch(`webhooks/${application_id}/${token}/messages/@original`, { embeds: [{ description: 'Embeds updated!' }] });
        }
        if (name == 'applications') {
            let body = null;
            switch (options[0].name) {
                case 'open':
                    await patch(`channels/${channel_id}`, { permissionOverwrites: [{ id: guild_id, type: 0, allow: "2147848672", deny: "0" }] })
                    body = 'Apps have now been opened!'
                    break;
                case 'close':
                    await patch(`channels/${channel_id}`, { permissionOverwrites: [{ id: guild_id, type: 0, allow: "0", deny: "2147848672" }] });
                    await nukeApps();
                    body = 'Apps have now been closed!'
                    break;
            }
            return res.send({ type: 4, data: { content: body } })
        }
        if (name == 'member') {
            const target = options[0].options[0].value;
            const targetmember = await get(`guilds/${guild_id}/members/${target}`) ?? null
            const embed = { color: 0xb50000, description: `<@${target}> is not muted.` }
            const staffroles = ['1306337128426377296', '1235295120665088030', '1409208962091585607', '1388113570369372181']
            const juniorroles = ['1422366564031660176', '1402282104401821828']
            const adminChannel = guildChannelMap[guild_id].modChannels.adminChannel
            const roles = member.roles
            const highermodcommands = ['ban', 'unwarn', 'unmute'];
            const command = options[0]
            let banflag = false
            let kick = false
            let recentwarn = null;
            if (target === member.user.id) {
                embed.description = 'You cannot moderate yourself.'
                return res.send({ type: 4, data: { embeds: [embed], flags: 64 } })
            }
            if (targetmember && (targetmember.roles.some(roleId => staffroles.includes(roleId)) || roles.some(role => role.includes(juniorroles)) && highermodcommands.includes(command.name))) {
                if (targetmember.roles.some(roleId => staffroles.includes(roleId))) {
                    embed.description = `${member.user} tried to moderate <@${target}>.`;
                    await post(`channels/${adminChannel}/messages`, { embeds: [embed] });
                    embed.description = 'You cannot moderate other staff members.'
                }
                if (roles.some(role => role.includes(juniorroles)) && highermodcommands.includes(command.name)) {
                    embed.description = `Jr. mod ${member.user} tried to use a mod only command.`;
                    await post(`channels/${adminChannel}/messages`, { embeds: [embed] });
                    embed.description = 'Jr mods do not have access to this command.';
                }
                return res.send({ type: 4, data: { embeds: [embed], flags: 64 } })
            }
            switch (command.name) {
                case 'mute':
                    if (command.options[2].value <= 0) {
                        embed.description = '❌ Invalid duration'
                        return await res.post({ type: 4, data: { embeds: [embed] } });
                    }
                    if (targetmember.user.communicationDisabledUntilTimestamp) {
                        embed.description = '⚠️ User is already muted.'
                        return await res.post({ type: 4, data: { embeds: [embed] } });
                    }
                    break;
                case 'kick': kick = true;
                    break;
                case 'ban': banflag = true;
                    break;
                case 'unwarn': {
                    const punishments = await getPunishments(target, guild_id, true)
                    recentwarn = punishments.filter(warn => warn.type == 'Warn').pop();
                    if (!recentwarn) { embed.description = `no warns found for <@${target}>`; break; }
                    editPunishment({ userId: target.id, guildId: guild_id, id: recentwarn._id })
                    embed.color = 0x00a900; embed.description = `recent warn removed from <@${target}>`;
                    break;
                }
                case 'unmute':
                    if (target.communicationDisabledUntil) {
                        await patch(`guilds/${guild_id}/members/${target}`, { communicationDisabledUntilTimestamp: null })
                        embed.color = 0x00a900; embed.description = `<@${target}> was unmuted.`
                    }
                    break;
            }
            if (command.name == 'unmute' || command.name == 'unwarn')
                return res.send({ type: 4, data: { embeds: [embed] } });
            res.send({ type: 5 })
            punishUser({
                interaction: req.body, guildId: guild_id, target: target, moderatorUser: member.user, reason: command.options[1].value, channelId: channel_id, banflag: banflag, kick: kick
            })
        }
    }
    const { data: { custom_id } } = req.body;
    if (type === 5) {
        if (custom_id.startsWith('appeal')) {
            const [guildId, reason, justification, extra] = components;
            const guildroles = await get(`guilds/${guildId}/roles`);
            if (!guildroles) return res.status(500).send("Error fetching roles");
            const adminrole = guildroles.find(role => role.permissions == '8459633874173951' && role.hoist && !role.managed);
            const modrole = guildroles.find(role => role.permissions == '7882955489812486' && !role.managed);
            const appealChannel = guildChannelMap[guildId.component.values[0]].modChannels.appealChannel;
            const appealMsg = await post(`channels/${appealChannel}/messages`, {
                content: `<@&${adminrole.id}> <@&${modrole.id}>`,
                embeds: [{
                    author: { name: `${user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                    color: 0x13cbd8,
                    title: `Ban appeal`,
                    fields: [
                        { name: 'Why did you get banned?', value: `${reason.component.value}` },
                        { name: 'Why do you believe that your appeal should be accepted?', value: `${justification.component.value}` },
                        { name: 'Is there anything else you would like us to know?', value: `${extra.component.value}` }],
                    footer: { text: `User ID: ${user.id}` },
                    timestamp: new Date().toISOString()
                }],
                components: [{
                    type: 1,
                    components: [
                        { type: 2, custom_id: `unban_approve_${user.id}`, label: 'Approve', style: 3 },
                        { type: 2, custom_id: `unban_reject_${user.id}`, label: 'Reject', style: 4 }
                    ]
                }]
            })
            await post(`channels/${appealChannel}/messages/${appealMsg.id}/threads`, { type: 11, name: `${user.username}` })
            await appealsinsert(user.id, guildId, reason, justification, extra);
            return res.send({ type: 4, data: { content: 'Your appeal has been submitted!', flags: 64 } })
        }
        if (custom_id.startsWith('situations')) {
            const [dmmember, argument, ambiguous, staffbreakrule, illegal] = components;
            const { Agerange, Experience, History, Timezone, Stayed, Activity, Why, Trolldef, Raiddef, Staffissues, Memberreport } = await findApp({ userId: Rawuser.id })
            await post(`channels/${guildChannelMap[guild_id].modChannels.applicationChannel}/messages`, {
                embeds: [{
                    author: { name: `@${Rawuser.username}`, icon_url: `https://cdn.discordapp.com/avatars/${Rawuser.id}/${Rawuser.avatar}.png` },
                    color: 0x13b6df,
                    title: `Mod Application`,
                    fields: [
                        { name: 'Age Range:', value: `${Agerange}`, inline: false },
                        { name: 'Prior Experience:', value: `${Experience}`, inline: false },
                        { name: 'Have you been warned/muted/kicked/banned before?(be honest)', value: `${History}`, inline: false },
                        { name: 'Timezone:', value: `${Timezone}`, inline: false },
                        { name: `How long have you been a member in the server?`, value: `${Stayed}` },
                        { name: `How active are you in the server?`, value: `${Activity}`, inline: false },
                        { name: 'Why do you want to be a mod?:', value: `${Why}`, inline: false },
                        { name: 'What is your definition of a troll?', value: `${Trolldef}`, inline: false },
                        { name: 'What is your definition of a raid?', value: `${Raiddef}` },
                        { name: 'You disagree with a staff punishment. What would you do?', value: `${Staffissues}`, inline: false },
                        { name: 'How would you handle a member report?', value: `${Memberreport}`, inline: false },
                        { name: 'A member messages you about being harrassed. How would you handle the situation?', value: `${dmmember.component.value}`, inline: false },
                        { name: 'Users are arguing in general chat. explain your de-escalation steps.', value: `${argument.component.value}`, inline: false },
                        { name: 'A member DMs you about a rule-breaking DM. What is your course of action?', value: `${ambiguous.component.value}`, inline: false },
                        { name: 'A moderator is breaking a rule. What is your course of action?', value: `${staffbreakrule.component.value}`, inline: false },
                        { name: 'A user share illegal content. What are the steps you take?', value: `${illegal.component.value}`, inline: false }]
                }],
                timestamp: new Date().toISOString()
            })
            res.send({ type: 4, data: { content: 'your application was successfuly submitted!!' } })
            await removeApp({ userId: Rawuser.id })
        }
        if (custom_id.startsWith('Defs, reasons, and issues')) {
            const application = await findApp({ userId: Rawuser.id })
            if (application.Memberreport) {
                res.send({
                    type: 4,
                    data: {
                        content: 'You have already filled out this section. Click below to continue to the next section.',
                        components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip section', style: 1 }] }],
                        flags: 64
                    }
                })
                return;
            } else {
                const [why, trollDef, raidDef, staffIssues, memberReport] = components;
                const inputs = {
                    Why: why.component.value,
                    Trolldef: trollDef.component.value,
                    Raiddef: raidDef.component.value,
                    Staffissues: staffIssues.component.value,
                    Memberreport: memberReport.component.value
                }
                addToApp({ userId: Rawuser.id, data: inputs })
                res.send({
                    type: 4,
                    data: {
                        content: 'Part 2 of your application has saved! Click below to continue to the next section.',
                        components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'Next Section', style: 1 }] }],
                        flags: 64
                    }
                })
            }
        }
        if (custom_id.startsWith('server')) {
            const [ageRange, experience, history, timezone, activity] = components
            const inputs = {
                Agerange: ageRange.component.values[0],
                Experience: experience.component.value,
                History: history.component.value,
                Timezone: timezone.component.value,
                Activity: activity.component.value
            }
            await addToApp({ userId: Rawuser.id, data: inputs })
            res.send({
                type: 4,
                data: {
                    content: 'Part 1 of your application has been saved! Click below to continue to the next section.',
                    components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: 1 }] }],
                    flags: 64
                }
            })
        }
    }
    if (type === 3) {
        if (custom_id.startsWith('ban_')) {
            const [, targetId, inviteCode] = custom_id.split('_');
            const permissions = BigInt(member.permissions);
            if (!(permissions & 0x4n)) {
                return res.send({ type: 4, data: { content: 'jrs cannot use this button.', flags: 64 } })
            }
            await punishUser({ guildId: guild_id, target: targetId, moderatorUser: Rawuser, reason: 'troll', interaction: req.body, channelId: channel_id, banflag: true, messageid: message.id, silent: true });
            let finalMessage = `Banned <@${targetId}>`;
            if (inviteCode !== 'none') {
                await pull(`invites/${inviteCode}`)
                finalMessage += ' Associated Invite was deleted'
            }
            await patch(`channels/${channel_id}/messages/${message.id}`, {
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        custom_id: 'expired',
                        label: inviteCode !== 'none' ? '🔨 Banned & Invite Deleted!' : '🔨 Banned!',
                        style: 4,
                        disabled: true
                    }]
                }]
            })
            res.send({ type: 4, data: { embeds: [{ description: finalMessage }], message_reference: { message_id: message.id } } })
        }
        else if (custom_id.startsWith('unban_')) {
            const [, action, userId] = custom_id.split('_')
            const { reason, justification, extra } = await appealsget(userId, guild_id)
            const targetUser = await get(`users/${userId}`)
            const Adminchannelid = guildChannelMap[guild_id].modChannels.adminChannel;
            if ((BigInt(member.permissions) & 0x8n) == 0x0n) {
                res.send({ content: `Please wait for an admin to make a decision. `, flags: 64 })
                await post(`channels/${Adminchannelid}/messages`, { content: `Letting you know <@${user.id}> tried to jump the gun on an appeal.` })
                return;
            }
            const ext = targetUser.avatar.startsWith('a_') ? 'gif' : 'png'
            const appealEmbed = {
                color: 0x13cbd8,
                title: `Ban appeal`,
                author: { name: `${targetUser.username}`, iconURL: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.${ext}` },
                fields: [
                    { name: 'Why did you get banned?', value: `${reason} ` },
                    { name: 'Why do you believe that your appeal should be accepted?', value: `${justification} ` },
                    { name: 'Is there anything else you would like us to know?', value: `${extra}` }
                ],
                footer: { text: `User ID: ${targetUser.id}` },
                timestamp: new Date().toISOString()
            }
            const response = { author: { name: `${targetUser.username} `, iconURL: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.${ext}` }, color: null, title: null, description: null }
            let outcome = null
            switch (action) {
                case 'reject':
                    response.color = 0x890000; response.title = 'Appeal Denied...';
                    response.description = `<@${userId}> your ban appeal has been denied.`;
                    appealEmbed.color = 0x890000; appealEmbed.fields.push({ name: 'Denied by:', value: `<@${Rawuser.id}> `, inline: true });
                    break;
                case 'approve': {
                    const appealinvites = { '1231453115937587270': 'https://discord.gg/xpYnPrSXDG', '1342845801059192913': 'https://discord.gg/nWj5KvgUt9' }
                    try { await get(`guilds/${guild_id}/bans/${Rawuser.id}`) }
                    catch {
                        return await res.send({ type: 7, data: { content: `No recent ban for ${targetUser} found` } });
                    }
                    await pull(`guilds/${guild_id}/bans/${user.id}`,)
                    response.color = 0x008900; response.title = 'Appeal Accepted!';
                    response.description = `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealinvites[guild_id]}`;
                    appealEmbed.color = 0x008900; appealEmbed.fields.push({ name: 'Approved by:', value: `<@${Rawuser.id}> `, inline: true });
                    outcome = true
                    break;
                }
            }
            res.send({
                type: 7,
                data: {
                    embeds: [appealEmbed],
                    components: [{
                        type: 1,
                        components: [
                            { type: 2, custom_id: `unban_approve_${targetUser.id}_${guild_id}`, label: 'Approve', style: 3, disabled: true },
                            { type: 2, custom_id: `unban_reject_${targetUser.id}_${guild_id}`, label: 'Reject', style: 4, disabled: true }]
                    }]
                }
            })
            await appealupdate(targetUser.id, guild_id, outcome)
            const dmchannel = await post(`users/@me/channels`, { recipient_id: targetUser.id });
            await post(`channels/${dmchannel.id}/messages`, { embeds: [response] });
        }
        else if (custom_id.startsWith('next_modal_three')) {
            res.send({
                type: 9,
                data: {
                    custom_id: 'situations', title: 'Situations (3/3)',
                    components: [
                        { type: 18, label: 'A member messages you about being harrassed', component: { type: 4, custom_id: 'dmmember', required: true, style: 2, max_length: 350 } },
                        { type: 18, label: 'Users are arguing in general chat', component: { type: 4, custom_id: 'arguments', style: 2, required: true, max_length: 350 } },
                        { type: 18, label: 'A member DMs you about a rule-breaking DM', component: { type: 4, custom_id: 'rulebreakdm', required: true, style: 2, max_length: 350 } },
                        { type: 18, label: 'Staff is failing to follow the rules', component: { type: 4, custom_id: 'staffrulebreak', required: true, style: 2, max_length: 350 } },
                        { type: 18, label: 'A user shares illegal content', component: { type: 4, custom_id: 'illegal', required: true, style: 2, max_length: 350 } }]
                }
            })
        }
        else if (custom_id.startsWith('next_modal_two')) {
            const application = await findApp({ userId: Rawuser.id })
            if (application && application.Memberreport) {
                res.send({
                    type: 4,
                    data: {
                        content: 'You have already filled out this part. Click the button below to continue to the next section.',
                        components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip Section', style: 1 }] }],
                        flags: 64
                    }
                })
            } else {
                res.send({
                    type: 9,
                    data: {
                        custom_id: 'Defs, reasons, and issues',
                        title: 'Definitions, Why mod, and Staff issues (2/3)',
                        components: [
                            { type: 18, label: 'Why should you be on the team?', component: { type: 4, custom_id: 'why', required: true, style: 2, max_length: 500 } },
                            { type: 18, label: 'What is your definition of a troll?', component: { type: 4, custom_id: 'trolldef', required: true, style: 1, max_length: 65 } },
                            { type: 18, label: 'What is your definition of a raid?', component: { type: 4, custom_id: 'raiddef', required: true, style: 1, max_length: 65 } },
                            { type: 18, label: 'You disagree with an action from staff', component: { type: 4, custom_id: 'staffissues', required: true, style: 2, max_length: 300 } },
                            { type: 18, label: 'How would you handle a member report?', component: { type: 4, custom_id: 'memberreport', required: true, style: 2, max_length: 300 } }
                        ]
                    }
                })
            }
        }
        else if (custom_id.startsWith('role_select')) {
            const reactions = guildChannelMap[guild_id].roles
            let currentRoles = [...member.roles]
            let added = []
            let removed = []
            for (const [key, roleID] of Object.entries(reactions)) {
                if (values.includes(key) && !currentRoles.includes(roleID)) {
                    currentRoles.push(roleID);
                    added.push(roleID);
                }
                else if (!values.includes(key) && currentRoles.includes(roleID)) {
                    currentRoles = currentRoles.filter(id => id !== roleID);
                    removed.push(roleID);
                }
            }
            added = added.map(role => { return `<@&${role}>` })
            removed = removed.map(role => { return `<@&${role}>` })
            await res.send({ type: 4, data: { content: `Added roles: ${added.join(',')} removed roles: ${removed.join(',')}`, flags: 64 } })
        }
        else if (custom_id.startsWith('note')) {
            const [, action, target, index, opener] = custom_id.split('-')
            let allnotes = await viewNotes(target, guild_id)
            if (Rawuser.id !== opener)
                return await res.send({ type: 4, data: { content: 'You did not initate this command', flags: 64 } })
            const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
            let currentIndex = index
            let currentNote = allnotes[currentIndex]
            switch (action) {
                case 'del': {
                    if (currentNote.timestamp - Date.now() < 48 * 60 * 60 * 1000 || isAdmin) {
                        editNote({ userId: target, guildId: guild_id, id: currentNote._id })
                        allnotes = await viewNotes(target, guild_id);
                        if (allnotes.length === 0) return
                        await res.send({ type: 7, data: { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] } })
                        currentIndex = currentIndex - 1
                    } else
                        await res.send({ type: 7, data: { content: `${user}, please contact an admin as time has expired.`, flags: 64 } })
                    break;
                }
                default: currentIndex = action == 'next' ? currentIndex + 1 : currentIndex - 1
                    break;
            }
            currentNote = allnotes[currentIndex]
            const mod = await get(`users/${currentNote.moderatorId}`);
            const user = await get(`users/${target}`);
            const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
            await res.send({
                type: 7,
                data: {
                    embeds: [{
                        color: 0xdddddd,
                        thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                        description: `<@${user.id}> notes |  \`${index + 1} of ${allnotes.length}\`\n> ${currentNote.note}`,
                        footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
                    }],
                    components: [{
                        type: 1, components: [
                            { type: 2, custom_id: `note-prev-${target}-${currentIndex}-${opener}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                            { type: 2, custom_id: `note-next-${target}-${currentIndex}-${opener}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allnotes.length - 1 },
                            { type: 2, custom_id: `note-del-${target}-${currentIndex}-${opener}`, label: 'Delete', style: 4, disabled: false }
                        ]
                    }]
                }
            })
        }
        else if (custom_id.startsWith('modlog')) {
            const [, action, target, index, opener] = custom_id.split('-')
            const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
            if (member.user.id !== opener)
                return res.send({ type: 4, data: { content: 'You did not initate this command', flags: 64 } })
            let currentIndex = parseInt(index);
            let allLogs = await getPunishments(target, guild_id);
            let currentLog = allLogs[index]
            switch (action) {
                case 'del':
                    await editPunishment({ userId: target, guildId: guild_id, id: currentLog._id })
                    allLogs = await getPunishments(target, guild_id);
                    if (allLogs.length < 1)
                        return await res.send({ type: 7, data: { embeds: [{ description: `All logs for <@${target}> deleted.` }], components: [] } })
                    currentIndex -= 1
                    if (currentIndex < 0) currentIndex = 0
                    break;
                default: currentIndex = action == 'next' ? currentIndex + 1 : currentIndex - 1
                    break;
            }
            currentLog = allLogs[currentIndex];
            await res.send({
                type: 7,
                data: {
                    embeds: [await buildLogEmbed(target, currentLog, currentIndex, allLogs.length)],
                    components: [{
                        type: 1, components: [
                            { type: 2, custom_id: `modlog-prev-${target}-${currentIndex}-${opener}-${Date.now()}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                            { type: 2, custom_id: `modlog-next-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
                            ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Delete', style: 4, disabled: false }] : [])
                        ]
                    }]
                }
            })
        }
        else if (custom_id.startsWith('logos')) {
            const [, guess, logo] = custom_id.split('-')
            const updatedbuttons = message.components[0].components.map(button => {
                const buttonbrand = button.custom_id.split('-')[1];
                let style = 2;
                if (buttonbrand === logo) style = 3;
                else if (buttonbrand === guess && guess !== logo) style = 4
                return { type: 2, label: button.label, custom_id: button.custom_id, style: style, disabled: true }
            })
            res.send({ type: 7, data: { components: [{ type: 1, components: updatedbuttons }] } })
            if (guess === logo)
                await incrementcoins({ userId: Rawuser.user.id, guildId: guild_id, coins: 20, win: true })
        }
        else if (custom_id.startsWith('tictactoe')) {
            let [, gameBoard, player1, player2, currentplayer, index] = custom_id.split('-');
            if (Rawuser.user.id !== currentplayer)
                return res.send({
                    type: 4, data: { content: 'You are not in this game or It\'s not your turn.', flags: 64 }
                })
            gameBoard = gameBoard.split(',');
            const marker = (currentplayer === player1) ? 'X' : 'O';
            gameBoard[index] = marker
            const tie = gameBoard.every(cell => cell !== ' ')
            const winningConditions = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            const win = winningConditions.some(condition => { return condition.every(index => { return gameBoard[index] === marker }); })
            if (tie || win) {
                if (win)
                    await incrementcoins({ userId: currentplayer.id, guildId: guild_id, coins: 100, win: true })
                res.send({
                    type: 7,
                    data: {
                        embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }],
                        components: generateButtons(gameBoard, player1, player2, currentplayer, true)
                    }
                });
            }
            currentplayer = (currentplayer === player1) ? player2 : player1;
            return res.send({
                type: 7,
                data: {
                    embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: ` It's <@${currentplayer}> turn!` }],
                    components: generateButtons(gameBoard, player1, player2, currentplayer)
                }
            });
        }
        else if (custom_id.startsWith('highlow')) {
            const [, choice, startNum, secretNum] = custom_id.split('-');
            const start = parseInt(startNum);
            const secret = parseInt(secretNum);
            let won = false;
            if (choice === 'higher' && secret > start || choice === 'lower' && secret < start) won = true;
            if (won) {
                await incrementcoins({ userId: Rawuser.id, guildId: guild_id, coins: 10, win: won })
            }
            return res.send({
                type: 7,
                data: {
                    embeds: [{
                        title: won ? "You Won! 🎉" : "You Lost! 💀",
                        color: won ? 0xc79c0f : 0x870000,
                        description: `The number was **${secret}**.\n(Your guess was ${choice} than ${start})`
                    }],
                    components: []
                }
            })
        }
    }
});
app.listen(3000, () => console.log('Listening for interactions on port 3000'))