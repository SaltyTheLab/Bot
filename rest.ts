import { type APIMessage, type RESTError, type RESTRateLimit } from "discord-api-types/v10";
import { appendFile } from "node:fs/promises";
import { StatusCodes } from "http-status-codes"
let globalLockUntil = 0;
const buckets = new Map<string, { limit: number; remaining: number; resetAt: number; }>();
const routeToBucket = new Map<string, string>();
interface options { method: "GET" | "DELETE" | 'POST' | 'PUT' | 'PATCH'; endpoint: string; body?: object | APIMessage; reason?: string | null; headers?: Headers; }
/**
 * A custom REST handler designed to manage HTTP requests to the Discord API.
 * Handles dynamic route bucket mapping, client-side rate limiting (both local 
 * and global), and automated payload/header processing.
 * @param {options} options - The configuration object for the REST request.
 * @param {"GET" | "DELETE" | "POST" | "PUT" | "PATCH"} options.method - The HTTP method to use for the request.
 * @param {string} options.endpoint - The target URL path or full Discord CDN/API endpoint.
 * @param {object} [options.body] - Optional request payload. Can be a standard object (sent as JSON), `FormData`, or `URLSearchParams`.
 * @param {string | null} [options.reason] - Optional reason for the action; automatically encoded and attached as a Discord Audit Log header (`X-Audit-Log-Reason`).
 * @param {Headers} [options.headers] - Optional custom headers. Defaults to standard Bot Authorization and User-Agent headers.
 * @returns {Promise<any | boolean | Response>} A promise resolving to:
 * - Parsed JSON data for standard API responses.
 * - The raw `Response` object for binary/image media.
 * - `true` for successful `204 No Content` responses.
 * - `false` if the API encounters a non-rate-limit error.
 * @throws Will recursively retry the request internally if a `429 Too Many Requests` status code is encountered.
 */
export async function response({ method, endpoint, body, reason, headers }: options): Promise<any | boolean | Response> {
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
    try {
        res = await Bun.fetch(endpoint.startsWith('https://cdn.discordapp.com') ? endpoint : `https://discord.com/api/v10/${endpoint}`, options);
    } catch (err) {
        console.error(`[REST NETWORK ERROR] ${endpoint}: ${err}`);
        return false
    }
    const hash = res?.headers.get('X-RateLimit-Bucket');
    const limit = parseInt(res?.headers.get('X-RateLimit-Limit') || '0', 10);
    const remaining = parseInt(res?.headers.get('X-RateLimit-Remaining') || '0', 10);
    const resetAfter = parseFloat(res?.headers.get('X-RateLimit-Reset-After') || '0');
    if (hash) { routeToBucket.set(routeKey, hash); buckets.set(hash, { limit, remaining, resetAt: Date.now() + (resetAfter * 1000) }); }
    switch (res.status) {
        case StatusCodes.TOO_MANY_REQUESTS:
            res = await res.json() as RESTRateLimit;
            await appendFile("./log.log", `[REST Rate Limited] ${res.global ? 'GLOBAL' : 'LOCAL'} limit. Waiting ${res.retry_after}s\n`);
            if (res.global) globalLockUntil = Date.now() + (res.retry_after * 1000);
            await Bun.sleep(res.retry_after * 1000);
            return response({ method, endpoint, body, reason, headers });
        case StatusCodes.CREATED:
        case StatusCodes.OK:
            const contentType = res.headers.get('content-type');
            return contentType && contentType.includes('image') ? res : res.json();
        case StatusCodes.NO_CONTENT:
            return true
        default:
            res = await res.json() as RESTError;
            console.log(res)
            await appendFile("./log.log", `[REST ERROR] @ <t:${Math.floor(Date.now() / 1000)}>| ${JSON.stringify(res.message, null, 2)}\n\n cause: ${JSON.stringify(res.errors, null, 2)}\n`)
            return res
    }
}
