// commands/rank.js
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUserAsync } from '../Logging/databasefunctions.js';
import Canvas from 'canvas';


export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your current XP and level')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check')
            .setRequired(false)
    );

function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (let side in defaultRadius) {
            radius[side] = radius[side] || 0;
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}
// Generate rank image
export async function generateRankCard(userData, targetUser, xpNeeded) {
    const canvas = Canvas.createCanvas(500, 100);
    const ctx = canvas.getContext('2d');

    const xpPercent = Math.min(userData.xp / xpNeeded, 1);

    // Background
    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
    ctx.fill();

    // === Avatar with thin green border ===
    const avatarSize = 64;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const borderColor = '#3ba55d';

    // Outer border
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.fill();
    ctx.closePath();
    ctx.clip();

    // Avatar inner circle
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();

    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
    const response = await fetch(avatarUrl);
    const buffer = await response.arrayBuffer();
    const avatar = await Canvas.loadImage(Buffer.from(buffer));

    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // === Text ===
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`LEVEL ${userData.level}`, 110, 30);

    ctx.textAlign = 'right';
    ctx.fillText(`RANK ${userData.level}`, canvas.width - 20, 30);

    ctx.textAlign = 'left';
    ctx.font = '16px sans-serif';
    const username = targetUser.username.length > 20 ? targetUser.username.slice(0, 18) + '…' : targetUser.username;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(username, 110, 52);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`${userData.xp} / ${xpNeeded}`, canvas.width - 20, 52);

    // === XP Progress Bar ===
    const barX = 110;
    const barY = 65;
    const barWidth = canvas.width - 130;
    const barHeight = 15;
    const radius = barHeight / 2;

    // Background
    ctx.fillStyle = '#40444b';
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // Fill
    ctx.fillStyle = '#3ba55d';
    roundRect(ctx, barX, barY, barWidth * xpPercent, barHeight, radius);
    ctx.fill();

    const bufferImage = canvas.toBuffer('image/png');
    return new AttachmentBuilder(bufferImage, { name: 'rank.png' });
}

export async function execute(interaction) {
    try {

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        const userId = targetUser.id;

        const userData = await getUserAsync(userId, guildId);
        const xpNeeded = Math.floor((userData.level - 1) ** 2 * 50);

        if (!userData) {
            return interaction.reply({ content: 'User data not found.', ephemeral: true });
        }

        const rankCard = await generateRankCard(userData, targetUser, xpNeeded);

        interaction.reply({
            files: [rankCard]
        });
    } catch (error) {
        console.error('Error in rank command:', error);
        await interaction.reply({ content: '⚠️ An error occurred while generating the rank card.', ephemeral: true });
    }
}