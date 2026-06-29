import { type RESTError, type RESTRateLimit } from "discord-api-types/v10";
import { StatusCodes } from "http-status-codes"
let globalLockUntil = 0;
const buckets = new Map<string, { limit: number; remaining: number; resetAt: number; }>();
const routeToBucket = new Map<string, string>();
interface runresponse { method: "GET" | "DELETE" | 'POST' | 'PUT' | 'PATCH'; endpoint: string; body?: object; reason?: string | null; headers?: Headers; }
export async function response({ method, endpoint, body, reason, headers }: runresponse): Promise<any> {
    let res: null | Response | RESTRateLimit | RESTError = null;
    const routeKey = endpoint
        .replace(/(channels|guilds|webhooks)\/(\d+)/g, '$1/$2')
        .replace(/\d{17,19}/g, (match, offset) => (offset < 10 ? match : ':id'))
        .replace(/\/reactions\/[^/]+/, '/reactions/:emoji');
    const route = routeToBucket.get(routeKey)
    const bucket = route ? buckets.get(route) : null;
    if (bucket) {
        if (Date.now() > bucket.resetAt) bucket.remaining = bucket.limit;
        if (bucket.remaining <= 0) { const timeToWait = bucket.resetAt - Date.now(); if (timeToWait > 0) await Bun.sleep(timeToWait); }
        bucket.remaining--;
    }
    if (Date.now() < globalLockUntil) await Bun.sleep(globalLockUntil - Date.now());
    const urlHeaders: Headers = headers ?? new Headers({ 'Authorization': `Bot ${process.env.TOKEN}`, 'User-Agent': 'Discord Bot (https://github.com/SaltyTheLab/Bot, 1.0.0)' });
    if (reason) urlHeaders.set('X-Audit-Log-Reason', encodeURIComponent(reason));
    const options: RequestInit = { method, headers: urlHeaders };
    if (body) {
        if (body instanceof FormData || body instanceof URLSearchParams) options.body = body;
        else { urlHeaders.set('Content-Type', 'application/json'); options.body = JSON.stringify(body); }
    }
    res = await Bun.fetch(endpoint.startsWith('https://cdn.discordapp.com') ? endpoint : `https://discord.com/api/v10/${endpoint}`, options);
    const hash = res?.headers.get('X-RateLimit-Bucket');
    const limit = parseInt(res?.headers.get('X-RateLimit-Limit') || '0', 10);
    const remaining = parseInt(res?.headers.get('X-RateLimit-Remaining') || '0', 10);
    const resetAfter = parseFloat(res?.headers.get('X-RateLimit-Reset-After') || '0');
    if (hash) { routeToBucket.set(routeKey, hash); buckets.set(hash, { limit, remaining, resetAt: Date.now() + (resetAfter * 1000) }); }
    switch (res.status) {
        case StatusCodes.TOO_MANY_REQUESTS:
            res = await res.json() as RESTRateLimit;
            console.log(`[REST Rate Limited] ${res.global ? 'GLOBAL' : 'LOCAL'} limit. Waiting ${res.retry_after}s\n`);
            if (res.global) globalLockUntil = Date.now() + (res.retry_after * 1000);
            await Bun.sleep(res.retry_after * 1000);
            return response({ method, endpoint, body, reason, headers });
        case StatusCodes.CREATED:
        case StatusCodes.OK:
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('image')) return res;
            return res.json();
        case StatusCodes.NO_CONTENT:
            return true
        default:
            res = await res.json() as RESTError;
            console.error(`[REST ERROR] @ <t:${Math.floor(Date.now() / 1000)}>| ${JSON.stringify(res.message, null, 2)}\n\n cause: ${JSON.stringify(res.errors, null, 2)}`)
            return false
    }
}
