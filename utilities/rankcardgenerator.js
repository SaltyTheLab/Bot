import { createCanvas, loadImage } from 'canvas';
let rankCardBaseCanvas = null;
function initializeRankCardBase() {
    const canvas = createCanvas(500, 150);
    const ctx = canvas.getContext('2d')
    // --- Background ---
    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
    ctx.fill();
    // --- Static Text Labels ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    // --- Avatar Border Outline (STATIC) ---
    const avatarSize = 100;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const borderColor = '#3ba55d';
    const borderWidth = 1.5;
    // Draw the green border outline *before* the avatar (which will be drawn later)
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + borderWidth, 0, Math.PI * 2);
    ctx.lineWidth = borderWidth * 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke(); // Draw the border outline
    // Store the base canvas
    rankCardBaseCanvas = canvas;
    console.log('Rank card base template generated and cached.');
}
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

function formatXP(xp) {
    if (xp >= 10000)
        return `${Math.floor(xp / 1000)}k`;
    return xp.toString();
}


async function generateRankCard(userData, targetUser, xpNeeded = null, rank = null) {
    const canvas = createCanvas(rankCardBaseCanvas.width, rankCardBaseCanvas.height);
    const ctx = canvas.getContext('2d');
    const baseCtx = rankCardBaseCanvas.getContext('2d');
    const baseImageData = baseCtx.getImageData(0, 0, rankCardBaseCanvas.width, rankCardBaseCanvas.height);
    ctx.putImageData(baseImageData, 0, 0);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ffffff';
    const xpPercent = Math.min(userData.xp / xpNeeded, 1);
    // === Avatar and Border ===
    const avatarSize = 100;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
    ctx.save(); // Save the context state BEFORE applying the avatar clip.
    // 2. Create the circular clipping path for the avatar.
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // 3. Draw the avatar image (it will automatically be clipped to the circle).
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize)
    // 4. Restore the context state. This removes the clipping path,
    ctx.restore();
    const maxUsernameWidth = 200; // Adjust as needed
    let usernameToDisplay = targetUser.username;
    const metrics = ctx.measureText(usernameToDisplay);
    if (metrics.width > maxUsernameWidth && xpNeeded !== null) {
        let truncated = false;
        while (ctx.measureText(usernameToDisplay + '…').width > maxUsernameWidth && usernameToDisplay.length > 0) {
            usernameToDisplay = usernameToDisplay.slice(0, -1);
            truncated = true;
        }
        if (truncated) {
            usernameToDisplay += '…';
        }
    }
    ctx.textAlign = 'left';
    ctx.fillText(usernameToDisplay, 130, canvas.height - 90);
    ctx.textAlign = 'right';
    // Level Rank, and Xp
    if (xpPercent !== null) {
        // === Text ===
        ctx.fillText(`Level ${userData.level}`, canvas.width - 220, 30);
        ctx.fillText(`RANK ${rank}`, canvas.width - 20, 30);
        // --- XP Progress Bar Background ---
        let barX = 130;
        let barY = canvas.height - 75;
        let barWidth = canvas.width - 150;
        let barHeight = 25;
        let radius = barHeight / 2;
        // Draw the background of the progress bar
        ctx.fillStyle = '#40444b';
        roundRect(ctx, barX, barY, barWidth, barHeight, radius);
        ctx.fill();
        ctx.fillStyle = '#cccccc';
        ctx.fillText(`${formatXP(userData.xp)} / ${formatXP(xpNeeded)}`, canvas.width - 20, canvas.height - 90);
        // === XP Progress Bar ===
        barWidth = canvas.width - 150;
        barHeight = 25;
        radius = barHeight / 2;
        // Fill of progress bar
        if (xpPercent > 0) {
            ctx.fillStyle = '#3ba55d';
            const fill = Math.max(barWidth * xpPercent, 25)
            roundRect(ctx, 130, canvas.height - 75, fill, barHeight, radius);
            ctx.fill();
        }
    } else {
        ctx.fillText(`Coins: ${userData.coins}\nTotalMessages: ${userData.totalmessages}`, canvas.width - 150, canvas.height - 50);
    }

    return { file: canvas.toBuffer('image/png'), name: 'rank.png' }
};
export { initializeRankCardBase, generateRankCard }
