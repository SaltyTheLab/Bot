import sharp from 'sharp';
import { userObject } from './types';
function formatXP(xp: number) {
    if (xp >= 10000) return `${Math.floor(xp / 1000)}k`;
    return xp.toString();
}
async function generateRankCard(userData: { coins: number, level: number, xp: number, totalmessages: number }, targetUser: userObject, xpNeeded: number, rank: number | null = null) {
    const avatarUrl = targetUser.avatar ? `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(targetUser.id) >> 22n) % 6n}.png`;
    const avatarResponse = await fetch(avatarUrl);
    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
    const avatarCircleMask = Buffer.from(`<svg><circle cx="50" cy="50" r="50" fill="white" /></svg>`);
    const processedAvatar = await sharp(avatarBuffer).resize(100, 100).composite([{ input: avatarCircleMask, blend: 'dest-in' }]).png().toBuffer();
    const xpPercent = xpNeeded ? userData.xp / xpNeeded : 0;
    const barWidth = 350;
    const fillWidth = Math.max(barWidth * xpPercent, 25);
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
            <text x="130" y="60" class="username">${targetUser.username.slice(0, 15)}${targetUser.username.length > 15 ? '...' : ''}</text>
            <text x="300" y="35" class="label" text-anchor="middle">LEVEL ${userData.level}</text>
            <text x="440" y="35" class="label" text-anchor="end">RANK #${rank}</text>
            <rect x="130" y="85" width="${barWidth}" height="20" rx="10" fill="#484b4e" />
            ${fillWidth > 0 ? `<rect x="130" y="85" width="${fillWidth}" height="20" rx="10" fill="#3ba55d" />` : ''}
            <text x="480" y="75" class="stats" text-anchor="end">${formatXP(userData.xp)} / ${formatXP(xpNeeded)} XP</text> 
            <text x="150" y="130" class="profile">Coins: ${userData.coins} | Messages: ${userData.totalmessages}</text>
        </svg>
    `);
    const finalImage = await sharp(svgLayer).composite([{ input: processedAvatar, top: 25, left: 20 }]).png().toBuffer();
    return new Blob([finalImage], { type: "image/png", });
};
export default generateRankCard;