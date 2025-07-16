// commands/rank.js
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUserAsync } from '../Logging/database.js';
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
    const canvas = Canvas.createCanvas(328, 104);
    const ctx = canvas.getContext('2d');

    const xpPercent = userData.xp / xpNeeded;

    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 20);
    ctx.fill();

    // Avatar with border
    const avatarSize = 64;
    const avatarX = 20;
    const avatarY = 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9955';
    ctx.fill();
    ctx.clip();

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });

    const response = await fetch(avatarUrl);
    const buffer = await response.arrayBuffer();
    const avatar = await Canvas.loadImage(Buffer.from(buffer));

    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Level text
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`Level ${userData.level}`, 100, 45);

    // XP Text
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`XP: ${userData.xp} / ${xpNeeded}`, 100, 65);

    // XP Progress bar
    const barX = 100;
    const barY = 75;
    const barWidth = 200;
    const barHeight = 10;

    ctx.fillStyle = '#444';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#3498db';
    ctx.fillRect(barX, barY, barWidth * Math.min(xpPercent, 1), barHeight);

    const bufferimage = canvas.toBuffer('image/png');

    return new AttachmentBuilder(bufferimage, { name: 'rank.png' });
}

export async function execute(interaction) {
    try {
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        const userId = targetUser.id;

        const userData = await getUserAsync(userId, guildId);
        const xpNeeded = Math.floor((level - 1) ** 2 * 50);

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