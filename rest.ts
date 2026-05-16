import { appendFile } from 'fs/promises';
import type { Err } from './types';
let globalLockUntil = 0;
interface BucketState { limit: number; remaining: number; resetAt: number; }
const buckets = new Map<string, BucketState>();
const routeToBucket = new Map<string, string>();
async function get(endpoint: string) { return await response('GET', endpoint, null, null, null); }
async function pull(endpoint: string) { return await response('DELETE', endpoint, null, null, null); }
async function post(endpoint: string, body: object, headers: Headers | null = null) { return await response('POST', endpoint, body, null, headers); }
async function put(endpoint: string, body: object | null = null, reason: string | null = null, headers: null | Headers = null) { return await response('PUT', endpoint, body, reason, headers); }
async function patch(endpoint: string, body: object, reason: string | null = null) { return await response('PATCH', endpoint, body, reason, null); }
async function response(method: string, endpoint: string, body: object | null = null, reason: string | null = null, headers: null | Headers) {
    const routeKey = endpoint.replace(/(channels|guilds|webhooks)\/(\d+|[0-9]+)/g, '$1/$2').replace(/\d{17,19}/g, (match, offset) => { return offset < 10 ? match : ':id'; }).replace(/\/reactions\/[^/]+/, '/reactions/:emoji');
    const bucketHash = routeToBucket.get(routeKey);
    const bucket = bucketHash ? buckets.get(bucketHash) : null;
    if (bucket && bucket.remaining === 0) {
        if (bucket.resetAt - Date.now() > 0) await Bun.sleep(bucket.resetAt - Date.now());
    }
    const now = Date.now();
    if (now < globalLockUntil) await Bun.sleep(globalLockUntil - now);
    const urlheaders: Headers = headers ?? new Headers({ 'Authorization': `Bot ${process.env.TOKEN}`, 'User-Agent': 'Discord Bot (https://github.com/SaltyTheLab/Bot, 1.0.0)' });
    const options: RequestInit = { method, headers: urlheaders }
    if (reason) urlheaders.set('X-Audit-Log-Reason', encodeURIComponent(reason));
    if (body) {
        if (body instanceof FormData || body instanceof URLSearchParams) options.body = body
        else { urlheaders.set('Content-Type', 'application/json'); options.body = JSON.stringify(body); }
    }
    const res: Response = await Bun.fetch(endpoint.startsWith('https://cdn.discordapp.com') ? endpoint : `https://discord.com/api/v10/${endpoint}`, options);
    const hash = res.headers.get('X-RateLimit-Bucket');
    const limit = parseInt(res.headers.get('X-RateLimit-Limit') || '0');
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
    const resetAfter = parseFloat(res.headers.get('X-RateLimit-Reset-After') || '0');
    if (hash) {
        routeToBucket.set(routeKey, hash);
        buckets.set(hash, { limit, remaining, resetAt: Date.now() + (resetAfter * 1000) });
    }
    if (res.status === 429) {
        const data: any = await res.json();
        const retryAfter = parseFloat(res.headers.get('Retry-After') || data.retry_after || '1');
        const isGlobal = res.headers.get('X-RateLimit-Global') === 'true';
        await appendFile('bot_error.log', `[429] ${isGlobal ? 'GLOBAL' : 'LOCAL'} limit. Waiting ${retryAfter}s\n`);
        if (isGlobal) globalLockUntil = Date.now() + (retryAfter * 1000);
        await Bun.sleep(retryAfter * 1000);
        await response(method, endpoint, body, reason, headers);
    }
    if (res.ok) {
        if (res.status === 204) return true;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('image')) { return res; }
        return await res.json();
    }
    const err = await res.json().catch(() => ({})) as Err;
    appendFile('bot_error.log', `[REST ERROR] @ ${Date.now} | Status: ${res.status} | ${err.message} | ${JSON.stringify(err.errors, null, 2)}\n`);
    return false;
}

export { get, pull, post, put, patch }