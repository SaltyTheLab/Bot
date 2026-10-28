import { guildconfigs, usersCollection, oauthSessions, twitchconfig } from "./Database";
import { file, type BunRequest, serve } from 'bun'
import { syncEmbed } from "./syncEmbed";
import { type Document, ObjectId } from "mongodb";
import { SignJWT, jwtVerify } from 'jose'
import { StatusCodes } from "http-status-codes";
import { authProvider, syncTwitchConfigs } from './twitch'
import { type APIUser, type APIChannel, ChannelType, type APIRole, type APIAutoModerationRule, REST, Routes, OAuth2Routes, type RESTPostOAuth2AccessTokenResult, PermissionFlagsBits, DiscordAPIError, type APIGuild, type APIGuildMember } from "discord.js";
const rest = new REST().setToken(`${process.env.TOKEN}`)
const key = crypto.getRandomValues(new Uint8Array(32));
const corsHeaders = {
    "Access-Control-Allow-Origin": process.env.DISCORD_REDIRECT!, "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true"
};
async function getSession(req: BunRequest) {
    const token = req.cookies.get('session');
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] },)
        if (!payload.sub || !ObjectId.isValid(payload.sub)) return null;
        const session = await oauthSessions.findOne({ _id: new ObjectId(payload.sub), expiresAt: { $gt: new Date() } });
        return session ? { sessionId: session._id as ObjectId, user: session.user, guilds: session.guilds as { id: string; name: string; icon: string | null }[] } : null;
    } catch { return null; }
}
async function roleFromStaffroles(userId: string, guildId: string, staffroles: string[], ownerId: string): Promise<"owner" | "admin" | "mod" | null> {
    if (ownerId && userId === ownerId) return "owner"; // guild owner always has admin access, even before staffroles are configured
    if (staffroles.length < 2) return null;
    const [adminRoleId, modRoleId] = staffroles;
    const member = await rest.get(Routes.guildMember(guildId, userId)) as APIGuildMember
    if (member.roles.includes(adminRoleId!)) return "admin";
    if (member.roles.includes(modRoleId!)) return "mod";
    return null;
}
async function isTwitchGuildOwner(userId: string, guildId: string): Promise<boolean> {
    const config = await guildconfigs.findOne({ guildId }, { projection: { staffroles: 1, ownerId: 1 } });
    if (!config) return false;
    return await roleFromStaffroles(userId, guildId, config.staffroles as string[] ?? [], config.ownerId as string ?? '') === 'owner';
}
serve({
    port: 3000,
    websocket: { open() { }, message() { }, close() { } },
    routes: {
        "/": () => new Response(file('./.dist/index.html')),
        "/api/auth/twitch/login": async (req) => {
            const session = await getSession(req);
            if (!session) return new Response('Not logged in', { status: StatusCodes.UNAUTHORIZED });
            const guildId = new URL(req.url).searchParams.get('guildId')
            if (!guildId) return new Response('Guild is required', { status: StatusCodes.BAD_REQUEST });
            if (!await isTwitchGuildOwner(session.user.id, guildId)) return new Response('Only the configured guild owner can connect Twitch', { status: StatusCodes.FORBIDDEN });
            const state = `${guildId}.${crypto.randomUUID()}`;
            req.cookies.set('twitch_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/twitch/redirect', maxAge: 300 });
            const params = new URLSearchParams({
                client_id: process.env.TWITCH_ID!,
                redirect_uri: `${process.env.DISCORD_REDIRECT!}/api/auth/twitch/redirect`,
                response_type: 'code',
                scope: 'chat:read chat:edit',
                state,
            });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: `https://id.twitch.tv/oauth2/authorize?${params}` } });
        },
        "/api/auth/twitch/redirect": async (req) => {
            const session = await getSession(req);
            if (!session) return new Response('Not logged in', { status: StatusCodes.UNAUTHORIZED });
            const url = new URL(req.url);
            const state = url.searchParams.get('state');
            const code = url.searchParams.get('code');
            const expectedState = req.cookies.get('twitch_oauth_state');
            req.cookies.delete('twitch_oauth_state');
            if (state !== expectedState) return new Response('Invalid Twitch OAuth state', { status: StatusCodes.BAD_REQUEST });
            const guildId = state?.split('.')[0];
            if (!guildId) return new Response('Guild is required', { status: StatusCodes.BAD_REQUEST });
            if (!await isTwitchGuildOwner(session.user.id, guildId)) return new Response('Only the configured guild owner can connect Twitch', { status: StatusCodes.FORBIDDEN });
            const userId = await authProvider.addUserForCode(code!, ['chat:read', 'chat:edit']);
            const token = await authProvider.getAccessTokenForUser(userId);
            if (!token) return new Response('Twitch did not return an access token.', { status: StatusCodes.BAD_GATEWAY });
            await twitchconfig.updateOne({ guildId }, {
                $set: {
                    guildId,
                    twitchuserid: userId,
                    twitchaccess: token.accessToken,
                    twitchrefresh: token.refreshToken,
                    twitchexpires: token.expiresIn,
                    twitchobtained: token.obtainmentTimestamp,
                    twitchConfigUpdated: Date.now()
                },
            }, { upsert: true });
            void syncTwitchConfigs().catch((error: any) => console.error('[twitch] config sync after connect failed', error));
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: '/?twitch=connected' } });
        },
        "/api/auth/discord/login": (req) => {
            const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
            req.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300, });
            const params = new URLSearchParams({ client_id: process.env.CLIENT_ID!, redirect_uri: `${process.env.DISCORD_REDIRECT!}/api/auth/discord/redirect`, response_type: "code", scope: "identify guilds", state: state });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: `${OAuth2Routes.authorizationURL}?${params}` } });
        },
        "/api/auth/discord/redirect": async (req) => {
            const url = new URL(req.url);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state")
            const expected = req.cookies.get("oauth_state")
            if (state !== expected) return new Response("Invalid OAuth state", { status: StatusCodes.BAD_REQUEST })
            req.cookies.delete("oauth_state");
            const tokenRes = await rest.post(Routes.oauth2TokenExchange(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                passThroughBody: true,
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID!,
                    client_secret: process.env.DISCORD_SECRET!,
                    grant_type: "authorization_code",
                    code: code!,
                    redirect_uri: `${process.env.DISCORD_REDIRECT!}/api/auth/discord/redirect`,
                })
            }) as RESTPostOAuth2AccessTokenResult;
            const [discordGuilds, discordUser] = await Promise.all([
                rest.get(Routes.userGuilds(), { auth: false, headers: { Authorization: `Bearer ${tokenRes.access_token}` } }) as Promise<APIGuild[]>,
                rest.get(Routes.user(), { auth: false, headers: { Authorization: `Bearer ${tokenRes.access_token}` } }) as Promise<APIUser>
            ])
            if (!discordUser) return new Response(null, { status: StatusCodes.GATEWAY_TIMEOUT })
            const sessionId = new ObjectId();
            await oauthSessions.insertOne({ _id: sessionId, user: { id: discordUser.id, username: discordUser.username }, guilds: discordGuilds.map(({ id, name, icon }) => ({ id, name, icon })), expiresAt: new Date(Date.now() + 86400000) });
            req.cookies.set("session", await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(sessionId.toHexString()).setIssuedAt().setExpirationTime("24H").sign(key), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400, });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: "/", } });
        },
        "/api/embed": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            POST: async (req) => {
                try {
                    const session = await getSession(req);
                    if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                    let guildId: string;
                    let embedName: string;
                    let config: Parameters<typeof syncEmbed>[3];
                    let files: Parameters<typeof syncEmbed>[4] = [];
                    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
                        const formData = await req.formData();
                        guildId = String(formData.get('guildId') || '');
                        embedName = String(formData.get('embedName') || '');
                        config = JSON.parse(String(formData.get('config') || '{}'));
                        const uploads = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
                        files = await Promise.all(uploads.map(async (file, index) => ({
                            name: file.name,
                            data: Buffer.from(await file.arrayBuffer()),
                            key: `files[${index}]`,
                            contentType: file.type || undefined,
                        })));
                    } else {
                        const payload = await req.json();
                        guildId = payload.guildId;
                        embedName = payload.embedName;
                        config = payload.config;
                    }
                    if (!guildId || !embedName || !config) return Response.json({ error: 'Guild, embed name, and config are required' }, { status: StatusCodes.BAD_REQUEST, headers: corsHeaders });
                    const result = await syncEmbed(rest, guildId, embedName, config, files);
                    return new Response(JSON.stringify(result), { headers: corsHeaders });
                } catch (error) {
                    console.error('POST /api/embed failed:', error);
                    return new Response(JSON.stringify({ error: 'Failed to sync embed' }), { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: corsHeaders });
                }
            },
            PUT: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId, embedName, config } = await req.json();
                if (!guildId || !embedName || !config) {
                    return Response.json({ error: 'Guild, embed name, and config are required' }, { status: StatusCodes.BAD_REQUEST, headers: corsHeaders });
                }
                try {
                    const result = await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $set: { [`messageConfigs.${embedName}`]: config } });
                    if (!result) {
                        return Response.json({ error: 'Guild config not found' }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                    }
                    return Response.json({ ok: true }, { headers: corsHeaders });
                } catch {
                    return Response.json({ error: 'Failed to save embed' }, { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: corsHeaders });
                }
            },
        },
        "/api/embed/:guildId/:key": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            DELETE: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId, key } = req.params
                const doc = await guildconfigs.findOne({ guildId: guildId }, { projection: { [`messageConfigs.${key}`]: 1 } }) as any;
                const { channelid, messageId } = doc?.messageConfigs?.[key] || {};
                if (channelid && messageId)
                    try {
                        await rest.delete(Routes.channelMessage(channelid, messageId));
                        await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $unset: { [`messageConfigs.${key}`]: '' } })
                    }
                    catch (err: any) {
                        if (err satisfies DiscordAPIError) {
                            switch (err.code) {
                                case 50013:
                                    return Response.json(err.rawError.message, { status: StatusCodes.FORBIDDEN })
                                case 10008:
                                    return Response.json(err.rawError.message, { status: StatusCodes.NOT_FOUND })
                                case 50006:
                                    return Response.json(err.rawError.message, { status: StatusCodes.BAD_REQUEST })
                            }
                        }
                        else
                            console.error(err)
                        return Response.json(err, { status: StatusCodes.NOT_FOUND })
                    }
                return Response.json({ status: StatusCodes.OK })
            }
        },
        "/api/auth/me": {
            GET: async (req) => {
                const session = await getSession(req)
                const headers = { ...corsHeaders, "Cache-Control": "no-store" };
                if (!session) return Response.json({ loggedIn: false, twitchConnected: false }, { headers });
                try {
                    const guildId = new URL(req.url).searchParams.get('guildId');
                    const twitch = guildId ? await twitchconfig.findOne({ guildId }, { projection: { twitchaccess: 1 } }) as { twitchaccess?: string } | null : null;
                    const docs = await guildconfigs.find({ guildId: { $in: session.guilds.map(guild => guild.id) } }, { projection: { guildId: 1, name: 1, staffroles: 1, _id: 0, ownerId: 1 } }).toArray();
                    const staffGuilds = Object.fromEntries((await Promise.all(docs.map(async doc => {
                        const role = await roleFromStaffroles(session.user.id, doc.guildId, doc.staffroles as string[], doc.ownerId as string);
                        return role ? { guildId: doc.guildId as string, name: (doc.name as string) ?? session.guilds.find(guild => guild.id === doc.guildId)?.name ?? null, role } : null;
                    }))).filter((guild): guild is NonNullable<typeof guild> => guild !== null).map(({ guildId, ...info }) => [guildId, info]));
                    return Response.json({ user: session.user, guilds: session.guilds, staffGuilds, twitchConnected: Boolean(twitch?.twitchaccess) }, { headers });
                } catch {
                    return Response.json({ error: "Could not resolve user" }, { status: StatusCodes.NOT_FOUND, headers });
                }
            }
        },
        "/api/auth/twitch": {
            DELETE: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const guildId = new URL(req.url).searchParams.get('guildId');
                if (!guildId) return Response.json({ error: "Guild is required" }, { status: StatusCodes.BAD_REQUEST, headers: corsHeaders });
                if (!await isTwitchGuildOwner(session.user.id, guildId)) return Response.json({ error: "Only the configured guild owner can unlink Twitch" }, { status: StatusCodes.FORBIDDEN, headers: corsHeaders });
                const twitch = await twitchconfig.findOne({ guildId }, { projection: { twitchaccess: 1, twitchuserid: 1 } }) as { twitchaccess?: string, twitchuserid?: string } | null;
                if (twitch?.twitchaccess) {
                    if (twitch.twitchuserid) authProvider.removeUser(twitch.twitchuserid)
                    const revoke = await fetch('https://id.twitch.tv/oauth2/revoke', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ client_id: process.env.TWITCH_ID!, token: twitch.twitchaccess }),
                    });
                    if (!revoke.ok) return Response.json({ error: 'Twitch could not revoke the connection' }, { status: StatusCodes.BAD_GATEWAY, headers: corsHeaders });
                }
                await twitchconfig.updateOne({ guildId }, { $unset: { twitchuserid: '', twitchaccess: '', twitchrefresh: '', twitchexpires: '', twitchobtained: '', twitchConfigUpdated: '' } });
                void await syncTwitchConfigs().catch((error: any) => console.error('[twitch] config sync after unlink failed', error));
                return Response.json({ ok: true }, { headers: corsHeaders });
            }
        },
        "/api/auth/logout": {
            POST: async (req) => {
                const session = await getSession(req);
                if (session) await oauthSessions.deleteOne({ _id: session.sessionId });
                req.cookies.delete("session")
                return new Response(null, { status: StatusCodes.NO_CONTENT, headers: { ...corsHeaders, "Set-Cookie": "session=; Path=/; Max-Age=0" } });
            }
        },
        "/api/:guildId": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                if (!session.guilds.some(guild => guild.id === guildId)) return Response.json({ error: "You are not in this guild" }, { status: StatusCodes.FORBIDDEN, headers: corsHeaders });
                const doc = await guildconfigs.findOne({ guildId: guildId });
                if (!doc) return Response.json({ error: "Not found" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                const [guildRoles, guildChannels, rules, role] = await Promise.all([
                    rest.get(Routes.guildRoles(guildId)) as Promise<APIRole[]>,
                    rest.get(Routes.guildChannels(guildId)) as Promise<APIChannel[]>,
                    rest.get(Routes.guildAutoModerationRules(guildId)) as Promise<APIAutoModerationRule[]>,
                    roleFromStaffroles(session.user.id, guildId, doc.staffroles as string[], doc.ownerId as string) as Promise<string>
                ]);
                return Response.json({
                    ...doc,
                    _viewerRole: role,
                    guildRoles: guildRoles,
                    guildChannels: guildChannels.filter((c) => ChannelType.GuildText == c.type).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
                    staffRoles: guildRoles.filter((role: APIRole) => (BigInt(role.permissions) & (PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.Administrator)) !== 0n && !role.managed),
                    rules: (rules.map(r => ({ id: r.id, name: r.name })))
                }, { headers: corsHeaders });
            },
            PUT: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $set: { ...await req.json() } }) as Document;
                return Response.json({ ok: true }, { headers: corsHeaders });
            },
            DELETE: async (req) => {
                try {
                    const session = await getSession(req);
                    if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                    const { guildId } = req.params;
                    await guildconfigs.deleteOne({ guildId: guildId });
                    await usersCollection.deleteMany({ guildId: guildId });
                    return Response.json({ ok: true }, { headers: corsHeaders });
                } catch (err) {
                    console.log(err)
                }
            }
        },
    }
})
