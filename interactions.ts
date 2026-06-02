import { guildconfigs, usersCollection, logos } from "./Database";
import { get, put, pull, patch, post } from "./rest"
import { type Document, type WithId, ObjectId } from "mongodb";
import { APIApplicationCommandInteraction, InteractionType, ComponentType, APIEmbed, APIMessageComponent } from 'discord-api-types/v10'
import punishUser from "./punishUser";
import { Resvg } from "@resvg/resvg-js";
import { APIGuild, APIGuildMember, APIMessageComponentInteraction, APIModalSubmitInteraction, APIUser, InteractionResponseType, APIApplicationCommandInteractionDataSubcommandOption, APIActionRowComponent, APIComponentInMessageActionRow, APIButtonComponent } from "discord-api-types/payloads";
const highermodcommands = ['ban', 'unwarn', 'unmute'];
const publicKey = await crypto.subtle.importKey('raw', Buffer.from('069a7f3ba017ead748bac35f05bb9444b7758f9d9638b0f76d03d515b2b8ec90', 'hex'), { name: 'Ed25519', namedCurve: 'Ed25519' }, false, ['verify'])
function getComparableEmbed(embedData: APIEmbed) {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    } as APIEmbed);
}
function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function generateButtons(gameBoard: string[], player1: string, player2: string, currentplayer: string, disabled: boolean = false) {
    const rows = [] as APIMessageComponent[];
    const boardStr = gameBoard.join(',');
    for (let i = 0; i < 3; i++) {
        const row = { type: ComponentType.ActionRow, components: [] } as APIActionRowComponent<APIComponentInMessageActionRow>
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.components.push({
                type: 2,
                custom_id: `tictactoe-${boardStr}-${player1}-${player2}-${currentplayer}-${index}`,
                label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2,
                disabled: gameBoard[index] !== ' ' || disabled
            } as APIButtonComponent)
        }
        rows.push(row);
    }
    return rows;
}
async function buildLogEmbed(targetUser: string, log: WithId<Document>, idx: number, totalLogs: number) {
    const LOG_COLORS: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const user = await get(`users/${targetUser}`) as APIUser;
    const moderator = await get(`users/${log.moderatorId}`) as APIUser;
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
async function handleCommands(body: APIApplicationCommandInteraction) {
    const { token, id, guild_id, member, channel, application_id, data } = body as any;
    const { modChannels, jrrole, staffroles } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, publicChannel: 1, staffroles: 1 } }) as Document;
    const response: { type: InteractionResponseType.ChannelMessageWithSource | InteractionResponseType.Modal | InteractionResponseType.DeferredChannelMessageWithSource, data: any } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} }
    switch (data.name) {
        case 'appeal': {
            const userdata = await usersCollection.find({ userId: member?.user.id }).toArray();
            const seenGuilds = new Map<string, string>();
            for (const data of userdata) {
                for (const p of data.punishments || []) {
                    if (p.type === "Ban" && !seenGuilds.has(p.guildId)) {
                        const g = await get(`guilds/${p.guildId}`) as any;
                        seenGuilds.set(p.guildId, g.name);
                    }
                }
            };
            const opts = Array.from(seenGuilds).map(([id, gName]) => ({ label: gName, value: id }));
            if (!opts.length) {

                response.data = { content: "I couldn't find any entries", flags: 64 }
                return Response.json(response)
            }
            response.type = InteractionResponseType.Modal
            response.data = {
                custom_id: 'appealModal', title: 'Ban Appeal Submission',
                components: [
                    { type: ComponentType.Label, label: "Guild", component: { type: ComponentType.StringSelect, custom_id: 'guildId', max_values: 1, options: opts, required: true } },
                    { type: ComponentType.Label, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
                    { type: ComponentType.Label, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
                    { type: ComponentType.Label, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } },
                    { type: ComponentType.Label, label: 'Ban appeal evidence can go here.', component: { type: 19, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
                ]
            }
            break;
        }
        case 'games': {
            const subcommand: APIApplicationCommandInteractionDataSubcommandOption = data.options[0];
            switch (subcommand.name) {
                case 'bet': {
                    const coincount = subcommand.options![0].value as number;
                    const { coins } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { coins: 1 } }) as any;
                    if (coincount > coins) return Response.json({ type: 4, data: { content: `You cannot bet more than you have!`, flags: 64 } });
                    const win = Math.random() >= 0.5;
                    await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: win ? Math.ceil(coincount * 1.5) : -coincount } });

                    response.data = {
                        embeds: [{
                            color: win ? 0x007a00 : 0x7a0000,
                            author: { name: `${member?.user.username || member?.user.username} you bet ${coincount} and ${win ? 'won' : 'lost'}!`, icon_url: member?.user.avatar ? `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` : "" }
                        }]
                    }
                    break;
                }
                case 'tictactoe': {
                    const player2 = subcommand.options![0].value as string;
                    if (member?.user.id === player2) return Response.json({ type: 4, data: { content: "You can't play against yourself.", flags: 64 } });
                    const current = Math.random() < 0.5 ? member!.user.id : player2;

                    response.data = {
                        content: `<@${player2}>, <@${member?.user.id}> wants to play tictactoe`,
                        embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${current}>'s turn to move.` }],
                        components: generateButtons(Array(9).fill(' '), member!.user.id, player2, current!)
                    }
                    break;
                }
                case 'rps': {
                    const move = subcommand.options![0].value as string;
                    const oppChoices = ['rock', 'paper', 'scissors'];
                    const opp = oppChoices[Math.floor(Math.random() * 3)];
                    const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
                    const result = opp === move.toLowerCase() ? "It's a tie!" : beats[opp] === move.toLowerCase() ? 'you win!!!' : 'Febot Wins!!!';
                    if (result === 'you win!!!') await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });

                    response.data = { embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opp}**.`, color: 0xffa500 }] }
                    break;
                }
                case 'logos': {
                    const { logolist } = await logos.findOne({}) as any;
                    const logo = logolist[Math.floor(Math.random() * logolist.length)];
                    const distractors = shuffle(logolist.filter((l: any) => l.brand !== logo.brand)).slice(0, 3).map((l: any) => l.brand);
                    const comps = shuffle([logo.brand, ...distractors]).map((opt: string) => ({ type: 2, custom_id: `logos-${opt}-${logo.brand}`, label: opt, style: 1 }));
                    const form = new FormData();
                    form.append('files[0]', new Blob([await Bun.file(logo.image).arrayBuffer()]), 'logo.png');
                    form.append('payload_json', JSON.stringify({
                        type: 4, data: {
                            embeds: [{ author: { name: `Guess this logo ${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` }, color: Math.floor(Math.random() * 16777215), image: { url: `attachment://logo.png` } }],
                            components: [{ type: 1, components: comps }]
                        }
                    }));
                    return new Response(form);
                }
                case 'highlow': {
                    const start = Math.ceil(Math.random() * 100);
                    let secret = Math.ceil(Math.random() * 100);
                    while (secret === start) secret = Math.ceil(Math.random() * 100);

                    response.data = {
                        embeds: [{ color: 0x333300, title: "Higher or Lower", description: `I am thinking of a number.\n\nThe current value is ** ${start} **\n\n Do you think my number is higher or lower ? ` }],
                        components: [{
                            type: 1, components: [
                                { type: 2, label: "Higher", style: 1, custom_id: `highlow-higher-${start}-${secret}` },
                                { type: 2, label: "Lower", style: 4, custom_id: `highlow-lower-${start}-${secret}` }
                            ]
                        }]
                    }
                }
            }
            break;
        }
        case 'rank': {
            const targetUserId = data.options ? data.options[0].value : member.user.id!
            const profile = await usersCollection.findOne({ userId: targetUserId, guildId: guild_id }) as any;
            const { exponent, baseMultiplier, roundToNearest, flatOffset } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { exponent: 1, baseMultiplier: 1, roundToNearest: 1, flatOffset: 1 } }) as any;
            const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: profile.level } }, { level: profile.level, xp: { $gt: profile.xp } }] });
            const avRes = await fetch(profile.avatar ? `https://cdn.discordapp.com/avatars/${targetUserId}/${profile.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(targetUserId) >> 22n) % 6n}.png`);
            const avBuf = Buffer.from(await avRes.arrayBuffer()).toString("base64");
            const reqXp = Math.round(((profile.level < 100 ? profile.level : 100) ** exponent * baseMultiplier + flatOffset) / roundToNearest);
            const resvg = new Resvg(`<svg width="500" height="150" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="av"><circle cx="70" cy="75" r="50" /></clipPath></defs><rect width="500" height="150" rx="16" fill="#2c2f33"/><image href="data:image/png;base64,${avBuf}" x="20" y="25" width="100" height="100" clip-path="url(#av)"/><circle cx="70" cy="75" r="52" stroke="#3ba55d" stroke-width="3" fill="none" /><text x="130" y="60" fill="white" font-size="20" font-family="Arial" font-weight="bold">${profile.nick.slice(0, 15)}${profile.nick.length > 15 ? "..." : ""}</text><text x="300" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="middle">Level ${profile.level}</text><text x="440" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="end"> Rank #${rank + 1}</text><rect x="130" y="85" width="350" height="20" rx="10" fill="#484b4e"/><rect x="130" y="85" width="${Math.min(Math.max(350 * (profile.xp / reqXp), 25), 350)}" height="20" rx="10" fill="#3ba55d"/><text x="480" y="75" fill="#ccc" font-size="16" font-family="Arial" text-anchor="end">${profile.xp} / ${reqXp} xp</text><text x="150" y="130" fill="#ccc" font-size="18" font-family="Arial">Coins: ${profile.coins} | Messages: ${profile.totalmessages}</text></svg>`, { fitTo: { mode: "width", value: 500 }, font: { loadSystemFonts: true } }).render();
            const form = new FormData();
            form.append('files[0]', new Blob([resvg.asPng() as any], { type: "image/png" }), 'rankcard.png');
            form.append('payload_json', JSON.stringify({ type: InteractionResponseType.ChannelMessageWithSource }));
            return new Response(form)
        }
        case 'blacklist': {
            const subcommand: APIApplicationCommandInteractionDataSubcommandOption = data.options[0];
            const targetUser = subcommand.options![0].value as string;
            const sub = subcommand.name;
            const { blacklist } = await usersCollection.findOne({ userId: targetUser, guildId: guild_id }, { projection: { blacklist: 1 } }) as any;
            const embed: APIEmbed = { description: `<@${targetUser}>'s blacklist\n\nblacklist: ${blacklist?.length ? blacklist.map((r: string) => `<@&${r}>`).join(', ') : 'empty'}` };
            if (sub === 'add' || sub === 'remove') {
                const role = subcommand.options ? subcommand.options[1].value as string : null;
                if (sub === 'add') {
                    if (!blacklist.includes(role)) {
                        await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $push: { blacklist: role } as any });
                        await pull(`guilds/${guild_id}/members/${targetUser}/roles/${role}`);
                        embed.description = `<@&${role}> was blacklisted from <@${targetUser}>`;
                    } else embed.description = `<@&${role}> is already blacklisted from <@${targetUser}>`;
                }
                else {
                    await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $pull: { blacklist: role } as any });
                    embed.description = `<@&${role}> was removed from <@${targetUser}>'s blacklist`;
                }
            }

            response.data = { embeds: [embed] }
            break;
        }
        case 'dnd': {
            const sides = parseInt(data.options[0].name.slice(1));
            const rolled = Math.floor(Math.random() * sides) + 1;

            response.data = { content: `you rolled a ${rolled}` }
            break;
        }
        case 'apply': {
            const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
            if (application?.Activity) {

                response.data = { content: 'Already Completed. Click the button below to continue.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'skip Part 1', style: 1 }] }], flags: 64 }
                break;
            }
            response.type = InteractionResponseType.Modal
            response.data = {
                title: 'Experience and Activity (1/3)', custom_id: 'server',
                components: [
                    { type: 18, label: `What age range are you in?`, component: { type: 3, custom_id: 'age', options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }], max_values: 1, required: true } },
                    { type: 18, label: 'Any prior mod experience?', component: { type: 4, custom_id: 'experience', required: true, style: 2, max_length: 300 } },
                    { type: 18, label: 'Have you been warned/muted?', component: { type: 4, custom_id: 'punishments', required: true, style: 1, max_length: 100 } },
                    { type: 18, label: 'Timezone?', component: { type: 4, custom_id: 'timezone', required: true, style: 1, placeholder: 'put current time if unsure', max_length: 8 } },
                    { type: 18, label: `How active are you in the server?`, component: { type: 4, custom_id: 'activity', style: 1, required: true, max_length: 150 } }
                ]
            }
            break;
        }
        case 'leaderboard': {
            const board = await usersCollection.find({ guildId: guild_id }).limit(10).sort({ level: -1, xp: -1 }).toArray();
            const guild = await get(`guilds/${guild_id}`) as APIGuild;

            response.data = {
                embeds: [{
                    title: `Most active in ${guild.name}`, thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` }, color: 0x0c23a3,
                    description: `**__LeaderBoard:__**\n${board.map((u: any, idx) => `Rank \`${idx + 1}\`: <@${u.userId}> - level \`${u.level}\` with \`${u.xp}\` xp`).join('\n')}`,
                    timestamp: new Date().toISOString()
                }]
            }
            break;
        }
        case 'modlogs': {
            const targetUser = data.options[0].value as string;
            const isAdmin = (BigInt(member!.permissions) & 8n) !== 0n;
            const entries = await usersCollection.findOne({ userId: targetUser, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
            if (!entries?.punishments?.length) {

                response.data = { embeds: [{ color: 0xf58931, description: `❌ No modlogs found for <@${targetUser}>.` }] }
                break;
            }
            const btn = (disabled: boolean) => [
                { type: 2, custom_id: `modlog-prev-${targetUser}-0-${member?.user.id}`, label: '⬅️ Back', style: 2, disabled: true },
                { type: 2, custom_id: `modlog-next-${targetUser}-0-${member?.user.id}`, label: 'Next ➡️', style: 2, disabled: entries.punishments.length <= 1 || disabled },
                ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${targetUser}-0-${member?.user.id}-${entries.punishments[0]._id}`, label: 'Delete', style: 4, disabled }] : [])
            ];
            setTimeout(() => { patch(`webhooks/${id}/${token}/messages/@original`, { components: [{ type: 1, components: btn(true) }] }).catch(() => null); }, 600000);

            response.data = {
                embeds: [await buildLogEmbed(targetUser, entries.punishments[0], 0, entries.punishments.length)],
                components: [{ type: 1, components: btn(false) }]
            }
            break;
        }
        case 'note': {
            const targetUser = data.options[0].options[0].value as string;
            const u = await get(`users/${targetUser}`) as APIUser;
            const sub = data.options[0].name;
            const embed: APIEmbed = { color: 0x00a900, description: `❌ No notes found for <@${targetUser}>`, thumbnail: { url: `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` } };
            if (sub === 'add') {
                const note = data.options[0].options[1].value as string;
                await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $push: { notes: { _id: new ObjectId(), moderatorId: member?.user.id, note, timestamp: Date.now() } } as any });
                embed.description = `📝 note created for <@${targetUser}>\n\n\n > ${note}`;

                response.data = { embeds: [embed] }
                break;
            } else {
                const [newData] = await usersCollection.aggregate([{ $match: { userId: targetUser, guildId: guild_id } }, { $unwind: "$notes" }, { $sort: { "notes.timestamp": -1 } }, { $facet: { "notes": [{ $skip: 0 }, { $limit: 1 }], "total": [{ $count: "count" }] } }]).toArray();
                if (!newData?.total?.length) {

                    response.data = { embeds: [embed] }
                    break;
                }
                const count = newData.total[0].count;
                const firstNote = newData.notes[0].notes;
                const mod = await get(`users/${firstNote.moderatorId}`) as any;
                const dateStr = new Date(firstNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
                const btn = (disabled: boolean) => [
                    { type: 2, custom_id: `note-prev-${targetUser}-0-${member?.user.id}`, label: '◀️ prev', style: 2, disabled: true },
                    { type: 2, custom_id: `note-next-${targetUser}-0-${member?.user.id}`, label: '▶️ next', style: 2, disabled: count <= 1 || disabled },
                    { type: 2, custom_id: `note-del-${targetUser}-0-${member?.user.id}-${firstNote._id}`, label: '🗑️ delete', style: 4, disabled }
                ];
                setTimeout(() => { patch(`webhooks/${application_id}/${token}/messages/@original`, { components: [{ type: 1, components: btn(true) }] }).catch(() => null); }, 600000);

                response.data = {
                    embeds: [{ color: 0xdddddd, thumbnail: { url: `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` }, description: `<@${u.id}> notes | \`${1} of ${count}\`\n > ${firstNote.note}`, footer: { text: `${mod.username} | ${dateStr}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` } }],
                    components: [{ type: 1, components: btn(false) }]
                }
                break;
            }
        }
        case 'refresh': {
            (async () => {
                const { Data, messageConfigs } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Data: 1, messageConfigs: 1 } }) as any;
                if (!messageConfigs) return;
                let currentData = Data || [];
                for (const [embedName, config] of Object.entries(messageConfigs)) {
                    const { channelid, embeds, components, reactions } = config as any;
                    const existing = currentData.find((m: any) => m.name === embedName);
                    const msg = existing ? await get(`channels/${channelid}/messages/${existing.messageId}`).catch(() => null) as any : null;
                    if (!msg) {
                        const newMsg = await post(`channels/${channelid}/messages`, { embeds, components }) as any;
                        currentData = currentData.filter((m: any) => m.name !== embedName);
                        if (reactions) for (const r of reactions) { await put(`channels/${channelid}/messages/${newMsg.id}/reactions/${encodeURI(r)}/@me`, null); await Bun.sleep(750); }
                        currentData.push({ name: embedName, messageId: newMsg.id });
                        await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Data: currentData } });
                    } else {
                        const diff = msg.embeds.map((e: any) => getComparableEmbed(e)).join('|||') !== embeds.map((e: any) => getComparableEmbed(e)).join('|||');
                        if (diff) await patch(`channels/${channelid}/messages/${existing.messageId}`, { embeds });
                    }
                }
                await patch(`webhooks/${application_id}/${token}/messages/@original`, { embeds: [{ description: 'Embeds updated!' }] });
            })();
            response.type = InteractionResponseType.DeferredChannelMessageWithSource
            break;
        }
        case 'applications': {
            const isOpening = data.options[0].name === 'open';
            await patch(`channels/${channel.id}`, { permissionOverwrites: [{ id: guild_id, type: 0, allow: isOpening ? "2147848672" : "0", deny: isOpening ? "0" : "2147848672" }] });
            if (!isOpening) await usersCollection.updateMany({ guildId: guild_id }, { $set: { application: {} } });
            response.data = { content: isOpening ? 'Apps have now been opened!' : 'Apps have now been closed!' }
            break;
        }
        case 'member': {
            const subcommand: APIApplicationCommandInteractionDataSubcommandOption = data.options[0];
            const target = subcommand.options![0].value as string;
            const cmd: string = data.options[0].name;
            const targetmember = await get(`guilds/${guild_id}/members/${target}`) as APIGuildMember;
            if (target === member?.user.id) return Response.json({ type: 4, data: { embeds: [{ description: 'You cannot moderate yourself.' }], flags: 64 } });
            if (targetmember.roles.some((r: string) => staffroles.includes(r))) {
                await post(`channels/${modChannels.adminChannel}/messages`, { embeds: [{ description: `${member?.user} tried to moderate <@${target}>.` }] });
                response.data = { embeds: [{ description: 'You cannot moderate other staff members.' }], flags: 64 }
                break;
            }
            if (member?.roles.includes(jrrole) && highermodcommands.includes(cmd)) {
                await post(`channels/${modChannels.adminChannel}/messages`, { embeds: [{ description: `Jr. mod ${member?.user} tried to use a mod only command.` }] });
                response.data = { embeds: [{ description: 'Jr mods do not have access to this command.' }], flags: 64 }
                break;
            }
            switch (cmd) {
                case 'mute': {
                    if ((data.options[0].options[2].value as number) <= 0) {
                        response.data = { embeds: [{ description: '❌ Invalid duration' }] };
                        break;
                    }
                    if (targetmember.communication_disabled_until) {
                        response.data = { embeds: [{ description: '⚠️ User is already muted.' }] }
                        break;
                    }
                    break;
                }
                case 'unwarn': {
                    const { punishments } = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
                    const lastWarn = punishments?.filter((w: any) => w.type === 'Warn').pop();
                    if (!lastWarn) { response.data = { embeds: [{ description: `no warns found for <@${target}>` }] }; break; }
                    await usersCollection.findOneAndUpdate({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: lastWarn._id } as any } });
                    response.data = { embeds: [{ color: 0x00a900, description: `recent warn removed from <@${target}>` }] }
                    break;
                }
                case 'unmute': {
                    if (targetmember.communication_disabled_until) {
                        await patch(`guilds/${guild_id}/members/${target}`, { communicationDisabledUntilTimestamp: null });
                        response.data = { embeds: [{ color: 0x00a900, description: `<@${target}> was unmuted.` }] }
                    } else if (targetmember.user.bot)
                        response.data = { embeds: [{ description: `You cannot moderate bots.` }], flags: 64 };
                    break;
                }
            }
            await punishUser({ guildId: guild_id, target: target, moderatorUser: member.user, reason: String(data.options[0].options[1].value), channelId: channel.id, currentWarnWeight: 1, interaction: body, banflag: cmd === 'ban', kick: cmd === 'kick' })
            response.type = InteractionResponseType.DeferredChannelMessageWithSource
            break;
        }
        case 'link': {
            const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ "client_id": `${Bun.env.TWITCH_ID}`, "client_secret": `${Bun.env.TWITCH_SECRET}`, "grant_type": 'client_credentials' }) });
            const tToken = await tokenRes.json() as any;
            const twRes = await fetch(`https://api.twitch.tv/helix/users?login=${data.options[0].value}`, { headers: { 'Client-ID': Bun.env.TWITCH_ID!, 'Authorization': `Bearer ${tToken.access_token}` } });
            const twitch = await twRes.json() as any;
            if (!twitch.data?.length) {
                response.data = { embeds: [{ description: `Twitch channel not found. ` }] }
                break;
            }
            await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: '1231453115937587270' }, { $set: { twitchId: twitch.data[0].id } });
            response.data = { embeds: [{ description: `Rank now linked with ${twitch.data[0].display_name} channel. ` }] }
            break;
        }
    }
    return Response.json(response)
}
async function handleModals(body: APIModalSubmitInteraction) {
    const { guild_id, member, data: { custom_id, components, resolved } } = body;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const updates: Record<string, any> = {};
    const response: { type: InteractionResponseType.ChannelMessageWithSource, data: any } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} }
    if (custom_id.startsWith('appeal')) {
        const [gId, reason, justification, extra, img] = components as any;
        const targetGuild = gId.component.values[0];
        const gConf = await guildconfigs.findOne({ guildId: targetGuild }, { projection: { staffroles: 1, modChannels: 1 } }) as any;
        const attachments = resolved?.attachments || {};
        const attId = img.component.values[0];
        const mainembed = {
            author: { name: `${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` },
            color: 0x13cbd8, title: "Ban Appeal",
            fields: [{ name: 'Why did you get banned?', value: reason.component.value }, { name: 'Why should we accept your appeal?', value: justification.component.value }, { name: 'Extra info', value: extra.component.value || "None" }],
            footer: { text: `User ID: ${member?.user.id}` }, timestamp: new Date().toISOString(),
            image: attachments[attId] ? { url: attachments[attId].url } : {}
        };
        const actionRow = [{ type: 1, components: [{ type: 2, custom_id: `unban_approve_${member?.user.id}`, label: 'Approve', style: 3 }, { type: 2, custom_id: `unban_reject_${member?.user.id}`, label: 'Reject', style: 4 }] }];
        const appealMsg = await post(`channels/${gConf.modChannels.appealChannel}/messages`, { content: `<@&${gConf.staffroles[0]}> <@&${gConf.staffroles[1]}>`, embeds: [mainembed], components: actionRow }) as any;
        const extraImgs = Object.values(attachments).map((i: any) => ({ url: `https://discord.com/channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}`, image: { url: i.url } }));

        await patch(`channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}`, { embeds: [mainembed, ...extraImgs], components: actionRow });
        await post(`channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}/threads`, { type: 11, name: `${member?.user.username}` });
        await usersCollection.updateOne({ userId: member?.user.id, guildId: targetGuild }, { $set: { appeals: { _id: new ObjectId(), reason: reason.component.value, justification: justification.component.value, extra: extra.component.value } } });
        response.data = { content: 'Your appeal has been submitted!', flags: 64 }
    }
    else if (custom_id.startsWith('situations')) {
        const [dm, arg, amb, staff, ill] = components as any;
        const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }) as any;
        await post(`channels/${modChannels.applicationChannel}/messages`, {
            embeds: [{
                author: { name: `@${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` },
                color: 0x13b6df, title: `Mod Application`,
                fields: [
                    { name: 'Age Range:', value: `${application.Agerange}` }, { name: 'Prior Experience:', value: `${application.Experience}` }, { name: 'History:', value: `${application.History}` }, { name: 'Timezone:', value: `${application.Timezone}` }, { name: `Server Activity:`, value: `${application.Activity}` }, { name: 'Why mod?:', value: `${application.why}` }, { name: 'Troll definition:', value: `${application.Trolldef}` }, { name: 'Raid definition:', value: `${application.Raiddef}` }, { name: 'Staff issues action:', value: `${application.Staffissues}` }, { name: 'Member report action:', value: `${application.Memberreport}` },
                    { name: 'Harassment via DM response:', value: dm.component.value }, { name: 'General chat argument step:', value: arg.component.value }, { name: 'Rulebreaking DM response:', value: amb.component.value }, { name: 'Mod breaking rules step:', value: staff.component.value }, { name: 'Illegal content step:', value: ill.component.value }
                ]
            }], timestamp: new Date().toISOString()
        });
        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $set: { application: {} } });
        response.data = { content: 'your application was successfuly submitted!!' }
    }
    else if (custom_id.startsWith('Defs, reasons')) {
        components.forEach((row: any) => {
            const { component } = row
            if (!row.component) return; // Guard clause safety check
            switch (component.custom_id) {
                case 'why':
                    updates['application.why'] = component.value;
                    break;
                case 'trolldef':
                    updates['application.Trolldef'] = component.value;
                    break;
                case 'raiddef':
                    updates['application.Raiddef'] = component.value;
                    break;
                case 'staffissues':
                    updates['application.Staffissues'] = component.value;
                    break;
                case 'memberreport':
                    updates['application.Memberreport'] = component.value;
                    break;
            }
        })

        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $set: updates });
        response.data = { content: 'Part 2 saved!', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'Next Section', style: 1 }] }], flags: 64 }
    }
    else if (custom_id.startsWith('server')) {
        components.forEach((row: any) => {
            const { component } = row
            if (!row.component) return; // Guard clause safety check
            if (component.type = ComponentType.StringSelect)
                updates['application.Agerange'] = component.values?.[0];
            if (component.type == ComponentType.TextInput)
                switch (component.custom_id) {
                    case 'experience':
                        updates['application.Experience'] = row.component.value;
                        break;
                    case 'punishments':
                        updates['application.History'] = row.component.value;
                        break;
                    case 'timezone':
                        updates['application.Timezone'] = row.component.value;
                        break;
                    case 'activity':
                        updates['application.Activity'] = row.component.value;
                        break;
                }
        })
        await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $set: updates });
        response.data = { content: 'Part 1 saved!', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: 1 }] }], flags: 64 }
    }
    return Response.json(response)
}
async function handleComponents(body: APIMessageComponentInteraction) {
    const response: { type: InteractionResponseType, data: any } = { type: InteractionResponseType.Pong, data: {} }
    const { token, guild_id, member, data: { custom_id }, channel, application_id, message } = body as any;
    const { modChannels, appealInvite, jrrole, staffroles, publicChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, jrrole: 1, staffroles: 1, appealInvite: 1, publicChannels: 1 } }) as Document
    const isAdmin = (BigInt(member?.permissions || 0n) & 8n) !== 0n;
    if (custom_id.startsWith('ban_')) {
        const [, targetId, inviteCode] = custom_id.split('_');
        if (member?.roles.includes(jrrole)) return Response.json({ type: 4, data: { content: 'jrs cannot use this button.', flags: 64 } });
        await punishUser({ guildId: guild_id, target: targetId, moderatorUser: member.user, reason: "troll", channelId: channel.id, interaction: body, currentWarnWeight: 1, banflag: true })
        if (inviteCode !== 'none') await pull(`invites/${inviteCode}`);
        await patch(`channels/${channel.id}/messages/${message.id}`, { components: [{ type: 1, components: [{ type: 2, custom_id: 'expired', label: inviteCode !== 'none' ? '🔨 Banned & Invite Deleted!' : '🔨 Banned!', style: 4, disabled: true }] }] });

        response.data = { embeds: [{ description: `Banned <@${targetId}>${inviteCode !== 'none' ? ' Associated Invite was deleted' : ''}` }], message_reference: { message_id: message.id } }
    }
    else if (custom_id.startsWith('unban_')) {
        const [, action, userId] = custom_id.split('_');
        const { appeals, avatar } = await usersCollection.findOne({ userId: userId, guildId: guild_id }) as any;
        if (!appeals) return Response.json({ content: `I could not find any appeal entries`, flags: 64 });
        if (!member?.roles.includes(staffroles[0])) {
            await post(`channels/${modChannels.adminChannel}/messages`, { content: `Letting you know <@${member?.user.id}> tried to jump the gun on an appeal.` });
            response.data = { content: `Please wait for an admin to make a decision. `, flags: 64 }
            return Response.json(response)
        }
        if (action === 'reject') await usersCollection.deleteOne({ userId: userId, guildId: guild_id });
        else { await pull(`guilds/${guild_id}/bans/${member.user.id}`); await usersCollection.updateOne({ userId: userId, guildId: guild_id }, { appeals: {} }); }
        const dm = await post(`users/@me/channels`, { recipient_id: userId }) as any;
        await post(`channels/${dm.id}/messages`, { embeds: [{ color: action == 'reject' ? 0x890000 : 0x008900, description: action == 'reject' ? `<@${userId}> your ban appeal has been denied.` : `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealInvite}` }] });
        response.type = InteractionResponseType.UpdateMessage
        response.data = {
            embeds: [{
                color: action === 'reject' ? 0x890000 : 0x008900, title: `Ban appeal`, author: { name: ((await get(`users/${userId}`)) as any).username, iconURL: `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar?.startsWith('a_') ? 'gif' : 'png'}` },
                fields: [{ name: 'Why did you get banned?', value: appeals.reason }, { name: 'Why accept appeal?', value: appeals.justification }, { name: 'Extra info', value: appeals.extra }, { name: action === 'reject' ? 'Denied by:' : 'Approved by:', value: `<@${member.user.id}> `, inline: true }],
                image: { url: message.attachments[0].proxy_url }, footer: { text: `User ID: ${userId}` }, timestamp: new Date().toISOString()
            }],
            components: [{ type: 1, components: [{ type: 2, custom_id: `unban_approve_${userId}_${guild_id}`, label: 'Approve', style: 3, disabled: true }, { type: 2, custom_id: `unban_reject_${userId}_${guild_id}`, label: 'Reject', style: 4, disabled: true }] }]
        }
    }
    else if (custom_id.startsWith('next_modal_three')) {
        response.type = InteractionResponseType.Modal,
            response.data = {
                custom_id: 'situations', title: 'Situations (3/3)',
                components: [
                    { type: ComponentType.Label, label: 'A member messages you about being harrassed', component: { type: 4, custom_id: 'dmmember', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'Users are arguing in general chat', component: { type: 4, custom_id: 'arguments', style: 2, required: true, max_length: 350 } },
                    { type: ComponentType.Label, label: 'A member DMs you about a rule-breaking DM', component: { type: 4, custom_id: 'rulebreakdm', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'Staff is failing to follow the rules', component: { type: 4, custom_id: 'staffrulebreak', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'A user shares illegal content', component: { type: 4, custom_id: 'illegal', required: true, style: 2, max_length: 350 } }
                ]
            }
    }
    else if (custom_id.startsWith('next_modal_two')) {
        const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
        if (application?.Memberreport) {
            response.type = InteractionResponseType.ChannelMessageWithSource
            response.data = { content: 'Already filled out.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip Section', style: 1 }] }], flags: 64 }
            return Response.json(response)
        } else {
            response.type = InteractionResponseType.Modal
            response.data = {
                custom_id: 'Defs, reasons, and issues', title: 'Definitions, Why mod, and Staff issues (2/3)',
                components: [
                    { type: ComponentType.Label, label: 'Why should you be on the team?', component: { type: 4, custom_id: 'why', required: true, style: 2, max_length: 500 } },
                    { type: ComponentType.Label, label: 'What is your definition of a troll?', component: { type: 4, custom_id: 'trolldef', required: true, style: 1, max_length: 65 } },
                    { type: ComponentType.Label, label: 'What is your definition of a raid?', component: { type: 4, custom_id: 'raiddef', required: true, style: 1, max_length: 65 } },
                    { type: ComponentType.Label, label: 'You disagree with an action from staff', component: { type: 4, custom_id: 'staffissues', required: true, style: 2, max_length: 300 } },
                    { type: ComponentType.Label, label: 'How would you handle a member report?', component: { type: 4, custom_id: 'memberreport', required: true, style: 2, max_length: 300 } }
                ]
            }
        }
    }
    if (custom_id.startsWith('note-') || custom_id.startsWith('modlog-')) {
        const isNote = custom_id.startsWith('note-');
        const [, action, target, index, opener, noteOrLogId] = custom_id.split('-');
        if (member?.user.id !== opener) return Response.json({ type: 4, data: { content: 'You did not initiate this command', flags: 64 } });
        let idx = parseInt(index);
        if (action === 'del') {
            const targetId = ObjectId.createFromHexString(noteOrLogId);
            if (isNote) {
                const doc = await usersCollection.findOne({ userId: target, guildId: guild_id, "notes._id": targetId }, { projection: { "notes.$": 1 } }) as any;
                if (doc?.notes?.[0] && (Date.now() - doc.notes[0].timestamp < 172800000 || isAdmin)) {
                    await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $pull: { notes: { _id: targetId } } as any });
                    idx = Math.max(0, idx - 1);
                } else {
                    response.type = InteractionResponseType.UpdateMessage
                    response.data = { content: `Contact an admin, deletion time expired.`, flags: 64 }
                    return Response.json(response)
                }
            } else {
                await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: targetId } as any } });
                idx = Math.max(0, idx - 1);
            }
        } else
            idx = Math.max(0, action === 'next' ? idx + 1 : idx - 1);
        if (isNote) {
            // Uniformly matching Newest First sort order matching initial command rendering
            const [newData] = await usersCollection.aggregate([{ $match: { userId: target, guildId: guild_id } }, { $unwind: "$notes" }, { $sort: { "notes.timestamp": -1 } }, { $facet: { "notes": [{ $skip: idx }, { $limit: 1 }], "total": [{ $count: "count" }] } }]).toArray();
            if (!newData?.total?.length) {
                response.type = InteractionResponseType.UpdateMessage
                response.data = { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] }
                return Response.json(response);
            }

            const count = newData.total[0].count;
            const activeNote = newData.notes[0].notes;
            const [m, u] = await Promise.all([get(`users/${activeNote.moderatorId}`), get(`users/${target}`)]) as [any, any];
            response.type = InteractionResponseType.UpdateMessage
            response.data = {
                embeds: [{ color: 0xdddddd, thumbnail: { url: `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` }, description: `<@${u.id}> notes | \`${idx + 1} of ${count}\`\n> ${activeNote.note}`, footer: { text: `${m.username} | ${new Date(activeNote.timestamp).toLocaleString('en-US')}`, icon_url: `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png` } }],
                components: [{
                    type: ComponentType.ActionRow, components: [
                        { type: ComponentType.Button, custom_id: `note-prev-${target}-${idx}-${opener}`, label: '⬅️ Back', style: 2, disabled: idx === 0 },
                        { type: ComponentType.Button, custom_id: `note-next-${target}-${idx}-${opener}`, label: 'Next ➡️', style: 2, disabled: idx >= count - 1 },
                        { type: ComponentType.Button, custom_id: `note-del-${target}-${idx}-${opener}-${activeNote._id}`, label: 'Delete', style: 4 }
                    ]
                }]
            }
        } else {
            const data = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
            if (!data?.punishments?.length) {
                response.type = InteractionResponseType.UpdateMessage
                response.data = { embeds: [{ description: `All logs deleted.` }], components: [] }
                return Response.json(response)
            }
            const activeLog = data.punishments[Math.min(idx, data.punishments.length - 1)];
            response.type = InteractionResponseType.UpdateMessage
            response.data = {
                embeds: [await buildLogEmbed(target, activeLog, idx, data.punishments.length)],
                components: [{
                    type: 1, components: [
                        { type: 2, custom_id: `modlog-prev-${target}-${idx}-${opener}`, label: '⬅️ Back', style: 2, disabled: idx === 0 },
                        { type: 2, custom_id: `modlog-next-${target}-${idx}-${opener}`, label: 'Next ➡️', style: 2, disabled: idx >= data.punishments.length - 1 },
                        ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${target}-${idx}-${opener}-${activeLog._id}`, label: 'Delete', style: 4 }] : [])
                    ]
                }]
            }
        }
    }
    else if (custom_id.startsWith('logos')) {
        const [, guess, logo] = custom_id.split('-');
        const updated = message.components![0].components.map((b: any) => {
            const brand = b.custom_id?.split('-')[1];
            return { type: ComponentType.Button, label: b.label, custom_id: b.custom_id, style: brand === logo ? 3 : brand === guess ? 4 : 2, disabled: true };
        });
        if (guess === logo) await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
        response.type = InteractionResponseType.UpdateMessage
        response.data = { components: [{ type: 1, components: updated }] }
    }
    else if (custom_id.startsWith('tictactoe')) {
        const [, boardStr, player1, player2, currentplayer, index] = custom_id.split('-');
        if (member?.user.id !== currentplayer) return Response.json({ type: 4, data: { content: "It's not your turn.", flags: 64 } });
        const board = boardStr.split(',');
        const marker = currentplayer === player1 ? 'X' : 'O';
        board[parseInt(index)] = marker;
        const win = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].some((c: any) => c.every((i: number) => board[i] === marker));
        const tie = !win && board.every((c: string) => c !== ' ');
        if (win || tie) {
            if (win) await usersCollection.findOneAndUpdate({ userId: currentplayer, guildId: guild_id }, { $inc: { coins: 100 } });
            setTimeout(() => { pull(`webhooks/${application_id}/${token}/messages/@original`).catch(() => null); }, 10000);
            response.type = InteractionResponseType.UpdateMessage
            response.data = { embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }], components: generateButtons(board, player1, player2, currentplayer, true) }
            return Response.json(response);
        }
        const nextPl = currentplayer === player1 ? player2 : player1;
        response.type = InteractionResponseType.UpdateMessage
        response.data = { embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${nextPl}> turn!` }], components: generateButtons(board, player1, player2, nextPl) }
    }
    else if (custom_id.startsWith('highlow')) {
        const [, choice, startNum, secretNum] = custom_id.split('-');
        const start = parseInt(startNum), secret = parseInt(secretNum);
        const won = (choice === 'higher' && secret > start) || (choice === 'lower' && secret < start);
        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: won ? 10 : -10 } });
        response.type = InteractionResponseType.UpdateMessage
        response.data = { embeds: [{ title: won ? "You Won! 🎉" : "You Lost! 💀", color: won ? 0xc79c0f : 0x870000, description: `The number was **${secret}**.\n(Guess was ${choice} than ${start})` }], components: [] }
    }
    else if (custom_id.startsWith('verify')) {
        const av = member?.user.avatar ? `https://cdn.discordapp.com/avatars/${member?.user.id}/${member!.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(member!.user.id) % 5}.png`;
        await put(`guilds/${guild_id}/members/${member?.user.id}/roles/1463354464747524136`, null);
        await post(`channels/${publicChannels.generalChannel}/messages`, { embeds: [{ description: `Everyone, Welcome <@${member?.user.id}> to the server !\n\n`, thumbnail: { url: av }, fields: [{ name: 'Discord Join Date:', value: `<t:${((BigInt(member!.user.id) >> 22n) + 1420070400000n) / 1000n}>`, inline: true }] }] });
        response.type = InteractionResponseType.ChannelMessageWithSource
        response.data = { content: `Welcome to the cave <@${member?.user.id}>!!`, flags: 64 }
    }
    return Response.json(response)
}
Bun.serve({
    port: 3000,
    websocket: { open() { }, message() { }, close(ws, code, reason) { console.log(`Closed: ${code} | ${reason}`); } },
    routes: {
        "/interactions": async (req) => {
            const rawBody = await req.text();
            const data = new TextEncoder().encode(req.headers.get('X-Signature-Timestamp') + rawBody);
            if (!(await crypto.subtle.verify('Ed25519', publicKey, Buffer.from(req.headers.get('x-signature-ed25519')!, 'hex'), data))) return new Response('Unauthorized', { status: 401 });
            const body = JSON.parse(rawBody);
            switch (body.type) {
                case InteractionType.Ping: return Response.json({ type: InteractionResponseType.Pong });
                case InteractionType.ApplicationCommand: return await handleCommands(body);
                case InteractionType.MessageComponent: return await handleComponents(body);
                case InteractionType.ModalSubmit: return await handleModals(body);
            }
        }
    }
})