import { ComponentType, InteractionType, type BaseInteraction, type AppCommandInteraction, type selectOptions, type userObject, type guildObject, type ActionRow, type EmbedObject, type channelObject, type messageObject, type guildEmbedIds, type memberObject, type Punishment, type ModalComponentInteraction, type labelComponent, type AttachmentObject, type roleObject, type MessageComponentInteraction, type Button } from "./types";
import { guildconfigs, usersCollection, logos } from "./Database";
import { get, put, pull, patch, post } from "./rest"
import { type Document, type WithId, ObjectId } from "mongodb";
import xpconfigs from "./guildconfiguration"
import { resolve } from "node:path";
import punishUser from "./punishUser";
import sharp from "sharp";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
cors();
sharp.cache(false);
const highermodcommands = ['ban', 'unwarn', 'unmute'];
const publicKey = await crypto.subtle.importKey('raw', Buffer.from('069a7f3ba017ead748bac35f05bb9444b7758f9d9638b0f76d03d515b2b8ec90', 'hex'), { name: 'Ed25519', namedCurve: 'Ed25519' }, false, ['verify'])

function getComparableEmbed(embedData: EmbedObject) {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    });
}
function formatXP(xp: number) {
    if (xp >= 10000) return `${Math.floor(xp / 1000)}k`;
    return xp.toString();
}
function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function generateButtons(gameBoard: string[], player1: string, player2: string, currentplayer: string, disabled: boolean = false) {
    const rows = [] as ActionRow[];
    const boardStr = gameBoard.join(',');
    for (let i = 0; i < 3; i++) {
        const row = { type: ComponentType.ACTION_ROW, components: [] } as ActionRow
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
async function buildLogEmbed(targetUser: string, log: WithId<Document>, idx: number, totalLogs: number) {
    const LOG_COLORS: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const user = await get(`users/${targetUser}`) as userObject;
    const moderator = await get(`users/${log.moderatorId}`) as userObject;
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
    const mins = Math.round(log.duration / 60000);
    const hours = Math.floor(mins / 60);
    return {
        color: LOG_COLORS[log.type],
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetUser}/${user.avatar}.png` },
        description: `**Member:** <@${log.userId}>\n\n**Reason:** \`${log.reason}\`\n\n**Punishments:** ${log.type == 'Ban' ? ` \`Ban\`` : ` \`${log.weight} warn \``}${log.duration ? (hours > 0 ? `\`,${hours} hour Mute\`` : `,\`${mins} minute Mute\``) : ''}\n\n**Warns at Log Time:** \`${log.warns}\`\n\n**Channel:** <#${log.channel}>\n\n[Event Link](${log.refrence})`,
        footer: { text: `Staff: ${moderator.username} | log ${idx + 1} of ${totalLogs} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${log.moderatorId}/${moderator.avatar}.png` }
    }
};
async function handleCommands(body: BaseInteraction<AppCommandInteraction>) {
    const { token, guild_id, user, member, data: { options, name, resolved }, member: Rawuser, channel_id, application_id } = body;
    const { modChannels, jrrole, staffroles } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, publicChannel: 1, staffroles: 1 } }) as Document;
    if (name == 'appeal') {
        const userdata = await usersCollection.find({ userId: Rawuser.user.id }).toArray() as WithId<Document>[]
        const seenGuilds = new Map<string, string>();
        for (const data of userdata) {
            if (data.punishments.length > 0)
                for (const punishment of data.punishments) {
                    if (punishment.type == "Ban") {
                        const guild = await get(`guilds/${punishment.guildId}`) as guildObject;
                        seenGuilds.set(punishment.guildId, guild.name)
                    }
                }
        };
        const options: Array<selectOptions> = Array.from(seenGuilds).map(([id, name]) => ({ label: name, value: id }));
        if (options.length == 0)
            return Response.json({ type: 4, data: { content: 'I couldn\'t find any entries', flags: 64 } })
        return Response.json({
            type: 9,
            data: {
                custom_id: 'appealModal',
                title: 'Ban Appeal Submission',
                components: [
                    { type: 18, label: "Guild", component: { type: 3, custom_id: 'guildId', max_values: 1, options: options, required: true } },
                    { type: 18, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
                    { type: 18, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
                    { type: 18, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } },
                    { type: 18, label: 'Ban appeal evidence can go here.', component: { type: 19, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
                ]
            }
        });
    }
    else if (name == 'games') {
        const subcommand = options[0].name;
        switch (subcommand) {
            case 'bet': {
                const coincount = options[0].options[0].value as number;
                const userId = member?.user?.id
                const { coins } = await usersCollection.findOne({ userId: userId, guildId: guild_id }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1, joinedTime: 1 } }) as Document;
                if (coincount > coins)
                    return Response.json({ type: 4, data: { content: `You cannot bet more than you have!`, flags: 64 } });
                const win = Math.random() >= 0.5;
                const amount = win ? Math.ceil(coincount * 1.5) : coincount;
                await usersCollection.findOneAndUpdate({ userId: userId, guildId: guild_id }, { $inc: { coins: win ? amount : -coincount } });
                return Response.json({
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
                const player2 = options[0].options[0].value as string
                const gameBoard = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
                if (player1 === player2) return Response.json({ type: 4, data: { content: "You can't play against yourself.", flags: 64 } })
                const currentplayer = Math.random() < 0.5 ? player1 : player2;
                return Response.json({
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
                const opponentchoices = ['rock', 'paper', 'scissors']
                const opponentchoice: string = opponentchoices[Math.floor(Math.random() * 3)];
                const beats: Record<string, string> = { Rock: 'scissors', paper: 'Rock', scissors: 'paper' };
                let result = '';
                if (beats[opponentchoice] === move) result = 'you win!!!'
                else result = 'Febot Wins!!!'
                if (opponentchoice == move)
                    result = "It's a tie!"
                if (result === 'you win!!!')
                    await usersCollection.findOneAndUpdate({ userId: Rawuser.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
                return Response.json({ type: 4, data: { embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opponentchoice}**.`, color: 0xffa500 }] } })
            }
            case 'logos': {
                const useravatar = `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
                const { logolist } = await logos.findOne({}) as Document;
                const logo = logolist[Math.floor(Math.random() * logolist.length)];
                const distractors = shuffle(logolist.filter((l: { brand: string, image: string }) => l.brand !== logo.brand)).slice(0, 3).map(l => l.brand);
                const options = shuffle([logo.brand, ...distractors]).map((option: string) => { return { type: 2, custom_id: `logos-${option}-${logo.brand}`, label: option, style: 1 }; });
                const formData = new FormData()
                const fileBuffer = await readFile(resolve(logo.image));
                const blob = new Blob([fileBuffer], { type: 'image/png' });
                formData.append('files[0]', blob, 'logo.png');
                formData.append('payload_json', JSON.stringify({
                    type: 4,
                    data: {
                        embeds: [{
                            author: { name: `Guess this logo ${member.user.username}`, icon_url: useravatar },
                            color: parseInt(`0x${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`, 16),
                            image: { url: `attachment://logo.png` }
                        }],
                        components: [{ type: 1, components: options }],
                    }
                }));
                return new Response(formData)
            }
            case 'highlow': {
                const startNumber = Math.ceil(Math.random() * 100);
                let secretTarget = Math.ceil(Math.random() * 100);
                while (secretTarget === startNumber)
                    secretTarget = Math.ceil(Math.random() * 100);
                return Response.json({
                    type: 4,
                    data: {
                        embeds: [{ color: 0x333300, title: "Higher or Lower", description: `I am thinking of a number.\n\nThe current value is ** ${startNumber} **\n\n Do you think my number is higher or lower ? ` }],
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
                                custom_id: `highlow-lower- ${startNumber}-${secretTarget}`
                            }]
                        }]
                    }
                })

            }
        }
    }
    else if (name == 'rank') {
        const targetUserId = options ? options[0].value as string : member.user.id;
        const { level, xp, coins, totalmessages, avatar } = await usersCollection.findOne({ userId: targetUserId, guildId: guild_id }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1, joinedTime: 1, avatar: 1 } }) as Document
        const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level } }, { level: level, xp: { $gt: xp } }] });
        const targetUser = resolved?.users?.[targetUserId] || member.user;
        const avatarResponse = await fetch(avatar ? `https://cdn.discordapp.com/avatars/${targetUserId}/${avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(targetUserId) >> 22n) % 6n}.png`);
        const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
        const processedAvatar = await sharp(avatarBuffer).resize(100, 100).composite([{ input: Buffer.from(`<svg><circle cx="50" cy="50" r="50" fill="white" /></svg>`), blend: 'dest-in' }]).png().toBuffer();
        const xpPercent = xp / xpconfigs[guild_id].xp(level);
        const svgLayer = Buffer.from(`
            <svg width="500" height="150" xmlns="http://www.w3.org/2000/svg">
            <style>
                .username { fill: white; font-size: 20px; font-family: Arial, sans-serif; font-weight: bold; }
                .stats { fill: #cccccc; font-size: 16px; font-family: Arial, sans-serif; }
                .label { fill: #ffffff; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold; }
                .profile { fill: #cccccc; font-size: 18px; font-family: Arial, sans-serif;}
            </style>
            <rect x="0" y="0" width="500" height="150" rx="16" fill="#2c2f33"/>
            <circle cx="70" cy="75" r="52" stroke="#3ba55d" stroke-width="3" fill="none" />
            <rect x="130" y="85" width="350" height="20" rx="10" fill="#484b4e"/>
            <text x="130" y="60" class="username">${targetUser.username.slice(0, 15)}${targetUser.username.length > 15 ? '...' : ''}</text>
            <text x="300" y="35" class="label" text-anchor="middle">Level ${level}</text>
            <text x="440" y="35" class="label" text-anchor="end">Rank #${rank + 1}</text>
            ${Math.max(350 * xpPercent, 25) > 0 ? `<rect x="130" y="85" width="${Math.max(350 * xpPercent, 25)}" height="20" rx="10" fill="#3ba55d" />` : ''}
            <text x="480" y="75" class="stats" text-anchor="end">${formatXP(xp)} / ${formatXP(xpconfigs[guild_id].xp(level))} xp</text> 
            <text x="150" y="130" class="profile">Coins: ${coins} | Messages: ${totalmessages}</text>
        </svg>
    `);
        const finalImage = await sharp(svgLayer).composite([{ input: processedAvatar, top: 25, left: 20 }]).png().toBuffer();
        const formData = new FormData();
        formData.append('files[0]', new Blob([finalImage], { type: "image/png", }), 'rankcard.png');
        formData.append('payload_json', JSON.stringify({ type: 4 }))
        return new Response(formData);
    }
    else if (name == 'blacklist') {
        const targetUser = options[0].options[0].value as string;
        const blacklist = await usersCollection.findOne({ userId: targetUser, guildId: guild_id }, { projection: { blacklist: 1 } }) as Document;
        const embed = { description: `< @${targetUser} > 's blacklist\n\nblacklist: ${blacklist.length > 0 ? blacklist.map((role: string) => `<@&${role}>`).join(', ') : 'empty'}` }
        const subcommand = options[0].name;
        switch (subcommand) {
            case 'add': {
                const role = options[0].options[1].value as string
                embed.description = `<@&${role}> was blacklisted from <@${targetUser}>`
                if (!blacklist.includes(role)) {
                    await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $set: { blacklist: role } })
                    await pull(`guilds/${guild_id}/members/${targetUser}/roles/${role}`);
                } else embed.description = `<@&${role}> is already blacklisted from <@${targetUser}>`
                break;
            }
            case 'remove':
                const role = options[0].options[1].value as string
                await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $pull: { blacklist: role } as any })
                embed.description = `<@&${role}> was removed from <@${targetUser}>'s blacklist`
                break;
        }
        return Response.json({ type: 4, data: { embeds: [embed] } });
    }
    else if (name == 'dnd') {
        let numbers: number[] = [];
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
        return Response.json({ type: 4, data: { content: `you rolled a ${numbers[Math.floor(Math.random() * numbers.length)]}` } })
    }
    else if (name == 'apply') {
        const { application } = await usersCollection.findOne({ userId: Rawuser.user.id, guildId: guild_id }, { projection: { application: 1 } }) as Document;
        if (application.Activity) {
            return Response.json({
                type: 4,
                data: { content: 'Already Completed. Click the button below to continue.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'skip Part 1', style: 1 }] }], flags: 64 }
            });
        } else {
            return Response.json({
                type: 9,
                data: {
                    title: 'Experience and Activity (1/3)',
                    custom_id: 'server',
                    components: [
                        {
                            type: 18, label: `What age range are you in?`, component: {
                                type: 3, custom_id: 'age', options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }], max_values: 1, required: true, max_length: 300
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
    else if (name == 'leaderboard') {
        const board = await usersCollection.find({ guildId: guild_id }).limit(10).sort({ level: -1, xp: -1 }).toArray()
        const guild = await get(`guilds/${guild_id}`) as guildObject;
        return Response.json({
            type: 4, data: {
                embeds: [{
                    title: `Most active in ${guild.name}`,
                    thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` },
                    color: 0x0c23a3,
                    description: `**__LeaderBoard:__**\n${board.map((user: WithId<Document>, index: number) => { return `Rank \`${index + 1}\`: <@${user.userId}> - level \`${user.level}\` with \`${user.xp}\` xp` }).join('\n')}`,
                    timestamp: new Date().toISOString()
                }],
            }
        })
    }
    else if (name == 'modlogs') {
        const targetUser = options[0].value as string
        const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
        const data = await usersCollection.findOne({ userId: targetUser, guildId: guild_id }, { projection: { punishments: 1 } });
        if (data?.punishments.length == 0) return Response.json({ type: 4, data: { embeds: [{ color: 0xf58931, description: `❌ No modlogs found for<@${targetUser}>.` }] } })
        const currentIndex = 0;
        const buttons = (disabled: boolean) => {
            return [
                { type: 2, custom_id: `modlog-prev-${targetUser}-${currentIndex}-${member.user.id}`, label: '⬅️ Back', style: 2, disabled: true },
                { type: 2, custom_id: `modlog-next-${targetUser}-${currentIndex}-${member.user.id}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= data?.punishments.length - 1 || disabled },
                ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${targetUser}-${currentIndex}-${member.user.id}-${data?.punishments[0]._id}`, label: 'Delete', style: 4, disabled: disabled }] : [])
            ]
        };
        setTimeout(async () => { await patch(`webhooks/${application_id}/${token}/messages/@original`, { components: [{ type: 1, components: buttons(true) }] }); }, 10 * 60 * 1000);
        return Response.json({
            type: 4, data: {
                embeds: [await buildLogEmbed(targetUser, data?.punishments[0], currentIndex, data?.punishments.length)],
                components: [{ type: 1, components: buttons(false) }]
            }
        })

    }
    else if (name == 'note') {
        const targetUser = options[0].options[0].value as string
        const embed = { color: 0x00a900, description: `❌ No notes found for <@${targetUser}>` }
        switch (options[0].name) {
            case 'add': {
                const note = options[0].options[1].value as string
                await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $push: { notes: { _id: new ObjectId(), moderatorId: member.user.id, note: note, timestamp: Date.now() } as any } });
                embed.color = 0x00a900;
                embed.description = `📝 note created for <@${targetUser}>\n\n\n > ${note}`;
                return Response.json({ type: 4, data: { embeds: [embed] } });
            }
            case 'show': {
                const [newData] = await usersCollection.aggregate([{ $match: { userId: targetUser, guildId: guild_id } }, { $unwind: "$notes" }, { $sort: { "notes.timestamp": -1 } }, { $facet: { "notes": [{ $skip: 0 }, { $limit: 1 }], "total": [{ $count: "count" }] } }]).toArray();
                const totalCount = newData.total[0]?.count
                if (newData.total.length < 1) return Response.json({ type: 4, data: { embeds: [embed] } });
                const currentIndex = 0;
                const mod = await get(`users/${newData.notes[0].notes.moderatorId}`) as userObject;
                const user = await get(`users/${targetUser}`) as userObject;
                const formattedDate = new Date(newData.notes[0].notes.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
                const buttons = (disabled: boolean) => {
                    return [
                        { type: 2, custom_id: `note-prev-${targetUser}-${0}-${member.user.id}`, label: '◀️ prev', style: 2, disabled: true },
                        { type: 2, custom_id: `note-next-${targetUser}-${0}-${member.user.id}`, label: '▶️ next', style: 2, disabled: currentIndex >= totalCount - 1 || disabled },
                        { type: 2, custom_id: `note-del-${targetUser}-${0}-${member.user.id}`, label: '🗑️ delete', style: 4, disabled: disabled }
                    ]
                }
                setTimeout(async () => {
                    await patch(`webhooks/${application_id}/${token}/messages/@original`, { components: [{ type: 1, components: buttons(true) }] })
                }, 10 * 60 * 1000)
                return Response.json({
                    type: 4,
                    data: {
                        embeds: [{
                            color: 0xdddddd,
                            thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                            description: `<@${user.id}> notes |  \`${currentIndex + 1} of ${totalCount}\`\n > ${newData.notes[0].notes.note}`,
                            footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
                        }],
                        components: [{ type: 1, components: buttons(false) }]
                    }
                });

            }
        }
    }
    else if (name == 'refresh') {
        (async () => {
            const { Data, messageConfigs } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Data: 1, messageConfigs: 1 } }) as Document;
            let data = messageConfigs;
            if (!messageConfigs) { appendFile('bot_error.log', `No config found for guild ID: ${guild_id} \n`); return; }
            for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
                const { channelid, embeds, components, reactions } = config;
                const existingdata = Data.find((m: any) => m.name === embedName) as guildEmbedIds;
                const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`) as messageObject;
                if (!message) {
                    const msg = await post(`channels/${channelid}/messages`, { embeds: embeds, components: components }) as messageObject;
                    data = Data.filter((message: any) => message.name !== embedName);
                    if (reactions) for (const reaction of reactions) {
                        await put(`channels/${channelid}/messages/${msg.id}/reactions/${encodeURI(reaction)}/@me`, null, null, null);
                        await Bun.sleep(750)
                    }
                    appendFile('bot_error.log', `📝 Sent '${embedName}'. Message ID: ${msg.id} \n`);
                    data.push({ name: embedName, messageId: msg.id });
                    await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Data: data } })
                    return
                } else {
                    const different = message.embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||')
                    if (different) {
                        await patch(`channels/${channelid}/messages/${existingdata.messageId}`, { embeds: embeds })
                        appendFile('bot_error.log', `✅ Message '${embedName}' updated.\n`);
                    }
                }
            }
            await patch(`webhooks/${application_id}/${token}/messages/@original`, { embeds: [{ description: 'Embeds updated!' }] });
        })();
        return Response.json({ type: 5 })

    }
    else if (name == 'applications') {
        switch (options[0].name) {
            case 'open':
                await patch(`channels/${channel_id}`, { permissionOverwrites: [{ id: guild_id, type: 0, allow: "2147848672", deny: "0" }] })
                break;
            case 'close':
                await patch(`channels/${channel_id}`, { permissionOverwrites: [{ id: guild_id, type: 0, allow: "0", deny: "2147848672" }] });
                await usersCollection.updateMany({ guildId: guild_id }, { $set: { application: {} } });
                break;
        }
        return Response.json({ type: 4, data: { content: options[0].name == 'open' ? 'Apps have now been opened!' : 'Apps have now been closed!' } })
    }
    else if (name == 'member') {
        const target = options[0].options[0].value as string
        const targetmember = await get(`guilds/${guild_id}/members/${target}`) as memberObject;
        const embed = { color: 0xb50000, description: `<@${target}> is not muted.` }
        const command = options[0]
        const { avatar } = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { avatar: 1 } }) as Document
        let banflag = false
        let kick = false
        let recentwarn = null;
        if (target === member.user.id) {
            embed.description = 'You cannot moderate yourself.'
            return Response.json({ type: 4, data: { embeds: [embed], flags: 64 } })
        }
        if (targetmember.roles.some((roleId: string) => staffroles.includes(roleId))) {
            embed.description = `${member.user} tried to moderate <@${target}>.`;
            await post(`channels/${modChannels.adminChannel}/messages`, { embeds: [embed] });
            embed.description = 'You cannot moderate other staff members.'
            return Response.json({ type: 4, data: { embeds: [embed], flags: 64 } })
        }
        if (member.roles.includes(jrrole) && highermodcommands.includes(command.name)) {
            embed.description = `Jr. mod ${member.user} tried to use a mod only command.`;
            await post(`channels/${modChannels.adminChannel}/messages`, { embeds: [embed] });
            embed.description = 'Jr mods do not have access to this command.';
            return Response.json({ type: 4, data: { embeds: [embed], flags: 64 } })
        }

        switch (command.name) {
            case 'mute': {
                const duration = command.options[2].value as number
                if (duration <= 0) { embed.description = '❌ Invalid duration'; return Response.json({ type: 4, data: { embeds: [embed] } }); }
                if (targetmember.user.communicationDisabledUntilTimestamp) { embed.description = '⚠️ User is already muted.'; return Response.json({ type: 4, data: { embeds: [embed] } }); }
                break;
            }
            case 'kick': kick = true;
                break;
            case 'ban': banflag = true;
                break;
            case 'unwarn': {
                const { punishments } = (await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 } }) as Document)
                recentwarn = punishments.filter((warn: Punishment) => warn.type == 'Warn').pop();
                if (!recentwarn) { embed.description = `no warns found for <@${target}>`; return Response.json({ type: 4, data: { embeds: [embed] } }); }
                await usersCollection.findOneAndUpdate({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: recentwarn._id } } as any })
                embed.color = 0x00a900; embed.description = `recent warn removed from <@${target}>`;
                return Response.json({ type: 4, data: { embeds: [embed] } });
            }
            case 'unmute':
                if (targetmember.communication_disabled_until) {
                    await patch(`guilds/${guild_id}/members/${target}`, { communicationDisabledUntilTimestamp: null })
                    embed.color = 0x00a900; embed.description = `<@${target}> was unmuted.`
                }
                return Response.json({ type: 4, data: { embeds: [embed] } });
        }
        if (targetmember.user.bot) return Response.json({ type: 4, data: { embeds: [{ description: `You cannot moderate bots.` }], flags: 64 } });
        (async () => {
            const reason = command.options[1].value as string
            punishUser(guild_id, target, avatar, member.user, reason, channel_id, false, body, 1, banflag, kick)
        })();
        return Response.json({ type: 5 })

    }
    else if (name == 'restart') {
        await writeFile('restart.signal', '')
        return Response.json({ type: 4, data: { embeds: [{ description: 'Restarting the bot...' }] } });
    }
}
async function handleModals(body: BaseInteraction<ModalComponentInteraction>) {
    const { guild_id, member: Rawuser, data: { custom_id, components, resolved } } = body;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    if (custom_id.startsWith('appeal')) {
        const [guildId, reason, justification, extra, image] = components;
        const { staffroles, modChannels } = await guildconfigs.findOne({ guildId: guildId.component.values[0] }, { projection: { staffroles: 1, modChannels: 1 } }) as Document
        const guildroles = await get(`guilds / ${guildId.component.values[0]} / roles`) as roleObject[];
        const attachments = resolved?.attachments as Record<string, AttachmentObject>
        if (!guildroles) return new Response("Error fetching roles");
        const attachmentid = image.component.values[0]
        const appealChannel = modChannels.appealChannel;
        const mainembed = {
            author: { name: `${Rawuser.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${Rawuser.user.id}/${Rawuser.user.avatar}.png` },
            color: 0x13cbd8,
            title: "Ban Appeal",
            fields: [
                { name: 'Why did you get banned?', value: reason.component.value },
                { name: 'Why should we accept your appeal?', value: justification.component.value },
                { name: 'Extra info', value: extra.component.value || "None" }
            ],
            footer: { text: `User ID: ${Rawuser.user.id}` },
            timestamp: new Date().toISOString(),
            image: attachments[attachmentid] ? { url: attachments[attachmentid].url } : {}
        }
        const appealMsg: messageObject = await post(`channels/${appealChannel}/messages`, {
            content: `<@&${staffroles[0]}> <@&${staffroles[1]}>`,
            embeds: [mainembed],
            components: [{
                type: 1,
                components: [
                    { type: 2, custom_id: `unban_approve_${Rawuser.user.id}`, label: 'Approve', style: 3 },
                    { type: 2, custom_id: `unban_reject_${Rawuser.user.id}`, label: 'Reject', style: 4 }
                ]
            }]
        }) as messageObject;
        const additionalimages = Object.values(attachments).map((image: AttachmentObject) => ({ url: `https://discord.com/channels/${appealChannel}/messages/${appealMsg.id}`, image: { url: image.url } }));
        await patch(`channels/${appealChannel}/messages/${appealMsg.id}`, {
            embeds: [mainembed, ...additionalimages],
            components: [{
                type: 1,
                components: [
                    { type: 2, custom_id: `unban_approve_${Rawuser.user.id}`, label: 'Approve', style: 3 },
                    { type: 2, custom_id: `unban_reject_${Rawuser.user.id}`, label: 'Reject', style: 4 }
                ]
            }]
        })
        await post(`channels/${appealChannel}/messages/${appealMsg.id}/threads`, { type: 11, name: `${Rawuser.user.username}` })
        await usersCollection.updateOne({ userId: Rawuser.user.id, guildId: guildId.component.values[0] }, { $set: { appeals: { _id: new ObjectId(), reason: reason.component.value, justification: justification.component.value, extra: extra.component.value } } })
        return Response.json({ type: 4, data: { content: 'Your appeal has been submitted!', flags: 64 } })
    }
    if (custom_id.startsWith('situations')) {
        const [dmmember, argument, ambiguous, staffbreakrule, illegal] = components;
        const { application } = await usersCollection.findOne({ userId: Rawuser.user.id, guildId: guild_id }, { projection: { application: 1 } }) as WithId<Document>;
        const { Agerange, Experience, History, Timezone, Stayed, Activity, Why, Trolldef, Raiddef, Staffissues, Memberreport } = application
        await post(`channels/${modChannels.applicationChannel}/messages`, {
            embeds: [{
                author: { name: `@${Rawuser.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${Rawuser.user.id}/${Rawuser.user.avatar}.png` },
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
        await usersCollection.findOneAndUpdate({ userId: Rawuser.user.id, guildId: guild_id }, { $set: { application: {} } })
        return Response.json({ type: 4, data: { content: 'your application was successfuly submitted!!' } })
    }
    if (custom_id.startsWith('Defs, reasons, and issues')) {
        const [why, trollDef, raidDef, staffIssues, memberReport] = components as labelComponent[]
        const inputs: Record<string, string> = { Why: why.component.value, Trolldef: trollDef.component.value, Raiddef: raidDef.component.value, Staffissues: staffIssues.component.value, Memberreport: memberReport.component.value };
        const updateFields: Record<string, string> = {};
        for (const key in inputs) {
            updateFields[`application.${key}`] = inputs[key];
        }
        await usersCollection.findOneAndUpdate({ userId: Rawuser.user.id, guildId: guild_id }, { $set: updateFields });
        return Response.json({
            type: 4,
            data: {
                content: 'Part 2 of your application has saved! Click below to continue to the next section.',
                components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'Next Section', style: 1 }] }],
                flags: 64
            }
        })
    }
    if (custom_id.startsWith('server')) {
        const [ageRange, experience, history, timezone, activity] = components
        const inputs: Record<string, string> = { userId: Rawuser.user.id, Agerange: ageRange.component.values[0], Experience: experience.component.value, History: history.component.value, Timezone: timezone.component.value, Activity: activity.component.value }
        const updateFields: Record<string, string> = {};
        for (const key in inputs) {
            updateFields[`application.${key}`] = inputs[key];
        }
        await usersCollection.updateOne({ userId: Rawuser.user.id, guildId: guild_id }, { $set: updateFields });
        return Response.json({
            type: 4,
            data: {
                content: 'Part 1 of your application has been saved! Click below to continue to the next section.',
                components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: 1 }] }],
                flags: 64
            }
        })
    }
}
async function handleComponents(body: BaseInteraction<MessageComponentInteraction>) {
    const { token, guild_id, user, member, data: { custom_id }, member: Rawuser, channel_id, application_id, message } = body;
    const { modChannels, appealInvite, jrrole, staffroles, publicChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, jrrole: 1, staffroles: 1, appealInvite: 1, publicChannels: 1 } }) as Document
    if (custom_id.startsWith('ban_')) {
        const [, targetId, inviteCode] = custom_id.split('_');
        if (member.roles.includes(jrrole)) { return Response.json({ type: 4, data: { content: 'jrs cannot use this button.', flags: 64 } }) }
        await punishUser(guild_id, targetId, Rawuser.user.avatar, Rawuser.user, 'troll', channel_id, false, body, 1, true, false);
        let finalMessage = `Banned <@${targetId}>`;
        if (inviteCode !== 'none') { await pull(`invites/${inviteCode}`); finalMessage += ' Associated Invite was deleted' }
        await patch(`channels/${channel_id}/messages/${message?.id}`, {
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
        return Response.json({ type: 4, data: { embeds: [{ description: finalMessage }], message_reference: { message_id: message.id } } })
    }
    else if (custom_id.startsWith('unban_')) {
        const [, action, userId] = custom_id.split('_')
        const { appeals, avatar } = await usersCollection.findOne({ userId: userId, guildId: guild_id }, { projection: { appeals: 1, avatar: 1 } }) as WithId<Document>;
        if (!appeals) return Response.json({ content: `I could not find any appeal entries`, flags: 64 })
        const { reason, justification, extra } = appeals;
        const targetUser = await get(`users/${userId}`) as userObject;
        if (!member.roles.includes(staffroles[0])) {
            await post(`channels/${modChannels.adminChannel}/messages`, { content: `Letting you know <@${member.user.id}> tried to jump the gun on an appeal.` })
            return Response.json({ content: `Please wait for an admin to make a decision. `, flags: 64 })
        }
        switch (action) {
            case 'reject':
                await usersCollection.deleteOne({ userId: userId, guildId: guild_id });
                break;
            case 'approve': {
                await pull(`guilds/${guild_id}/bans/${user.id}`,)
                await usersCollection.updateOne({ userId: userId, guildId: guild_id }, { appeals: {} });
                break;
            }
        }
        const dmchannel = await post(`users/@me/channels`, { recipient_id: userId }) as channelObject;
        await post(`channels/${dmchannel.id}/messages`, {
            embeds: [{
                color: action == 'reject' ? 0x890000 : 0x008900,
                description: action == 'reject' ? `<@${userId}> your ban appeal has been denied.` : `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealInvite}`
            }]
        });
        return Response.json({
            type: 7,
            data: {
                embeds: [{
                    color: action === 'reject' ? 0x890000 : 0x008900,
                    title: `Ban appeal`,
                    author: { name: `${targetUser.username}`, iconURL: `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}` },
                    fields: [
                        { name: 'Why did you get banned?', value: `${reason} ` },
                        { name: 'Why do you believe that your appeal should be accepted?', value: `${justification} ` },
                        { name: 'Is there anything else you would like us to know?', value: `${extra}` },
                        action === 'reject' ? { name: 'Denied by:', value: `<@${Rawuser.user.id}> `, inline: true } : { name: 'Approved by:', value: `<@${Rawuser.user.id}> `, inline: true }],
                    image: { url: message.attachments[0].proxy_url },
                    footer: { text: `User ID: ${userId}` },
                    timestamp: new Date().toISOString()
                }],
                components: [{
                    type: 1,
                    components: [
                        { type: 2, custom_id: `unban_approve_${userId}_${guild_id}`, label: 'Approve', style: 3, disabled: true },
                        { type: 2, custom_id: `unban_reject_${userId}_${guild_id}`, label: 'Reject', style: 4, disabled: true }]
                }]
            }
        })
    }
    else if (custom_id.startsWith('next_modal_three')) {
        return Response.json({
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
        const { application } = await usersCollection.findOne({ userId: Rawuser.user.id, guildId: guild_id }, { projection: { application: 1 } }) as Document;
        if (application.Memberreport) {
            return Response.json({
                type: 4,
                data: {
                    content: 'You have already filled out this part. Click the button below to continue to the next section.',
                    components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip Section', style: 1 }] }],
                    flags: 64
                }
            })
        } else {
            return Response.json({
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
    else if (custom_id.startsWith('note')) {
        const [, action, target, index, opener] = custom_id.split('-')
        if (Rawuser.user.id !== opener) return Response.json({ type: 4, data: { content: 'You did not initate this command', flags: 64 } })
        const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
        let currentIndex = parseInt(index)
        switch (action) {
            case 'del': {
                const currentDoc = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { notes: { $slice: [currentIndex, 1] } } }) as WithId<Document>
                if (currentDoc.notes[0].timestamp - Date.now() < 48 * 60 * 60 * 1000 || isAdmin) {
                    await usersCollection.findOneAndUpdate({ userId: target, guildId: guild_id }, { $pull: { notes: { _id: currentDoc?.notes[0]?._id } as any } });
                    currentIndex -= 1
                } else
                    return Response.json({ type: 7, data: { content: `${Rawuser}, please contact an admin as time has expired.`, flags: 64 } })
                break;
            }
            default: action == 'next' ? currentIndex += 1 : currentIndex -= 1
                break;
        }
        currentIndex = Math.max(0, currentIndex)
        const [newData] = await usersCollection.aggregate([
            { $match: { userId: target, guildId: guild_id } }, { $unwind: "$notes" }, { $sort: { "notes.timestamp": -1 } },
            { $facet: { "notes": [{ $skip: currentIndex }, { $limit: currentIndex + 1 }], "total": [{ $count: "count" }] } }
        ]).toArray();
        const totalCount = newData.total[0]?.count
        if (newData.total?.length === 0) return Response.json({ type: 7, data: { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] } })
        const mod = await get(`users/${newData.notes[0].notes.moderatorId}`) as userObject;
        const user = await get(`users/${target}`) as userObject;
        const formattedDate = new Date(newData.notes[0].notes.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
        return Response.json({
            type: 7,
            data: {
                embeds: [{
                    color: 0xdddddd,
                    thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                    description: `<@${user.id}> notes |  \`${currentIndex + 1} of ${totalCount}\`\n> ${newData.notes[0].notes.note}`,
                    footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
                }],
                components: [{
                    type: 1, components: [
                        { type: 2, custom_id: `note-prev-${target}-${currentIndex}-${opener}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                        { type: 2, custom_id: `note-next-${target}-${currentIndex}-${opener}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= totalCount - 1 },
                        { type: 2, custom_id: `note-del-${target}-${currentIndex}-${opener}`, label: 'Delete', style: 4, disabled: false }
                    ]
                }]
            }
        })
    }
    else if (custom_id.startsWith('modlog')) {
        const [, action, target, index, opener, id] = custom_id.split('-')
        const isAdmin = (BigInt(member.permissions) & 1n << 3n) !== 0n;
        if (member.user.id !== opener) return Response.json({ type: 4, data: { content: 'You did not initate this command', flags: 64 } })
        let currentIndex = parseInt(index);
        switch (action) {
            case 'del': {
                await usersCollection.findOneAndUpdate({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: ObjectId.createFromHexString(id) } } as any });
                currentIndex -= 1
                break;
            }
            default: action == 'next' ? currentIndex += 1 : currentIndex -= 1
                break;
        }
        currentIndex = Math.max(0, currentIndex);
        const data = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 }, sort: { "punishments.timestamps": -1 } });
        if (data?.punishments.length < 1) return Response.json({ type: 7, data: { embeds: [{ description: `All logs for <@${target}> deleted.` }], components: [] } })
        return Response.json({
            type: 7,
            data: {
                embeds: [await buildLogEmbed(target, data?.punishments[currentIndex], currentIndex, data?.punishments.length)],
                components: [{
                    type: 1, components: [
                        { type: 2, custom_id: `modlog-prev-${target}-${currentIndex}-${opener}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                        { type: 2, custom_id: `modlog-next-${target}-${currentIndex}-${opener}`, label: 'Next ➡️', style: 2, disabled: currentIndex == data?.punishments.length - 1 },
                        ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${target}-${currentIndex}-${opener}-${data?.punishments[0]._id}`, label: 'Delete', style: 4, disabled: false }] : [])
                    ]
                }]
            }
        })
    }
    else if (custom_id.startsWith('logos')) {
        const [, guess, logo] = custom_id.split('-')
        const updatedbuttons = message?.components[0].components.map((button: Button) => {
            const buttonbrand = button.custom_id?.split('-')[1];
            let style = 2;
            if (buttonbrand === logo) style = 3;
            else if (buttonbrand === guess && guess !== logo) style = 4
            return { type: 2, label: button.label, custom_id: button.custom_id, style: style, disabled: true }
        })
        if (guess === logo)
            await usersCollection.findOneAndUpdate({ userId: Rawuser.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
        return Response.json({ type: 7, data: { components: [{ type: 1, components: updatedbuttons }] } })
    }
    else if (custom_id.startsWith('tictactoe')) {
        const [, gameBoard, player1, player2, currentplayer, index] = custom_id.split('-');
        if (Rawuser.user.id !== currentplayer)
            return Response.json({ type: 4, data: { content: 'You are not in this game or It\'s not your turn.', flags: 64 } })
        const AfterBoard = gameBoard.split(',') as string[];
        const marker = (currentplayer === player1) ? 'X' : 'O';
        AfterBoard[parseInt(index)] = marker
        const tie = AfterBoard.every((cell: string) => cell !== ' ')
        const winningConditions = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        const win = winningConditions.some(condition => { return condition.every(index => { return AfterBoard[index] === marker }); })
        if (tie || win) {
            if (win)
                await usersCollection.findOneAndUpdate({ userId: currentplayer, guildId: guild_id }, { $inc: { coins: 100 } });
            setTimeout(async () => { await pull(`webhooks/${application_id}/${token}/messages/@original`) }, 10000)
            return Response.json({
                type: 7,
                data: {
                    embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }],
                    components: generateButtons(AfterBoard, player1, player2, currentplayer, true)
                }
            });
        }
        const newplayer = (currentplayer === player1) ? player2 : player1;
        return Response.json({
            type: 7,
            data: {
                embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: ` It's <@${newplayer}> turn!` }],
                components: generateButtons(AfterBoard, player1, player2, newplayer)
            }
        });
    }
    else if (custom_id.startsWith('highlow')) {
        const [, choice, startNum, secretNum] = custom_id.split('-');
        const start = parseInt(startNum);
        const secret = parseInt(secretNum);
        let won = false;
        if ((choice === 'higher' && secret > start) || (choice === 'lower' && secret < start)) {
            won = true;
            await usersCollection.findOneAndUpdate({ userId: Rawuser.user.id, guildId: guild_id }, { $inc: { coins: won ? 10 : -10 } });
        }
        return Response.json({
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
    else if (custom_id.startsWith('verify')) {
        const avatarURL: string = Rawuser.user.avatar ? `https://cdn.discordapp.com/avatars/${Rawuser.user.id}/${Rawuser.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(Rawuser.user.id) % 5}.png`;
        const createdTimestamp = ((BigInt(Rawuser.user.id) >> 22n) + 1420070400000n) / 1000n;
        await put(`guilds/${guild_id}/members/${member.user.id}/roles/1463354464747524136`, null, null, null)
        await post(`channels/${publicChannels.generalChannel}/messages`, {
            embeds: [{ description: ` Everyone, Welcome <@${Rawuser.user.id}> to the server !\n\n`, thumbnail: { url: avatarURL }, fields: [{ name: 'Discord Join Date:', value: `<t:${createdTimestamp}>`, inline: true }] }]
        })
        return Response.json({
            type: 4,
            data: {
                content: `Welcome to the cave <@${member.user.id}>!!`,
                flags: 64
            }
        })
    }
}
async function handleDiscordInteraction(req: Request) {
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('X-Signature-Timestamp');
    const rawBody = await req.text()
    const data = new TextEncoder().encode(timestamp + rawBody);
    const isValid = await crypto.subtle.verify('Ed25519', publicKey, Buffer.from(signature!, 'hex'), data);
    if (!isValid) return new Response('Unauthorized', { status: 401 });
    const body = JSON.parse(rawBody);
    switch (body.type) {
        case 1: return Response.json({ type: 1 }); // PING
        case InteractionType.APPLICATION_COMMAND: return await handleCommands(body);
        case InteractionType.MESSAGE_COMPONENT: return await handleComponents(body);
        case InteractionType.MODAL_SUBMIT: return await handleModals(body);
    }
};
async function authenticate(req: Request) {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");
    const code = url.searchParams.get("code")
    const discordresponse = await fetch(`https://discord.com/api/oauth2/token`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'client_id': `${process.env.CLIENT_ID}`,
                'client_secret': `${process.env.DISCORD_SECRET}`,
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': 'http://localhost:3000/public/twitchlinked.html'
            })
        }
    )
    const tokenData: any = await discordresponse.json();
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    const discordUserData: any = await userResponse.json();
    const discordrole = await fetch(`https://discord.com/api/v10/users/@me/applications/${process.env.CLIENT_ID}/role-connection`, {
        method: "PUT",
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_name: "Twitch", platform_username: username, metadata: { "twitch_linked": 1 } })
    });
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ "client_id": `${process.env.TWITCH_ID}`, "client_secret": `${process.env.TWITCH_SECRET}`, "grant_type": 'client_credentials' })
    });
    const data: any = await response.json();
    const twitchResponse: Response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: { 'Client-ID': process.env.TWITCH_ID, 'Authorization': `Bearer ${data.access_token}` }
    })
    const twitch: any = await twitchResponse.json();
    const found = twitch.data && twitch.data.length > 0;
    if (!found) {
        return new Response(JSON.stringify({ success: false, error: "Twitch channel not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
    await usersCollection.findOneAndUpdate({ userId: discordUserData.id, guildId: '1231453115937587270' }, { $set: { twitchId: twitch.data[0].id } })
    return new Response(JSON.stringify(found ? { success: true, displayName: twitch.data[0].display_name } : { success: false, error: "Server Error" }),
        {
            status: found ? 200 : 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            }
        });


}
const app = new Elysia()
    .use(cors())
    .use(staticPlugin({ assets: 'public', prefix: '/public' }))
    .post('/interactions', async ({ request }) => { return await handleDiscordInteraction(request); })
    .get('/api/auth/discord/redirect*', async ({ request }) => { return await authenticate(request); })
    .get('/public/twitchlinked.html', async ({ request }) => { return await authenticate(request) })
    .listen(3000)
