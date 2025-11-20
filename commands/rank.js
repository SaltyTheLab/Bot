import { SlashCommandBuilder, AttachmentBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { getUser } from '../Database/databasefunctions.js';
import Canvas from 'canvas';
let rankCardBaseCanvas = null;

export function initializeRankCardBase() {
    // 1. Create a canvas for the base template
    const canvas = Canvas.createCanvas(500, 150);
    const ctx = canvas.getContext('2d');

    // --- Background ---
    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
    ctx.fill();

    // --- Static Text Labels ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';

    ctx.textAlign = 'left';
    // Draw the static text label: "Total Messages: "
    ctx.fillText(`Total Messages: `, 130, canvas.height - 20)

    // --- XP Progress Bar Background ---
    const barX = 130;
    const barY = canvas.height - 75;
    const barWidth = canvas.width - 150;
    const barHeight = 25;
    const radius = barHeight / 2;

    // Draw the background of the progress bar
    ctx.fillStyle = '#40444b';
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

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

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your current XP and level')
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check')
            .setRequired(false)
    );

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
export async function generateRankCard(userData, targetUser, xpNeeded, rank) {

    if (!rankCardBaseCanvas) {
        initializeRankCardBase(); // If it's the first time, generate it now.
    }
    const canvas = Canvas.createCanvas(500, 150);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(rankCardBaseCanvas, 0, 0);
    const xpPercent = Math.min(userData.xp / xpNeeded, 1);
    // === Avatar and Border ===
    const avatarSize = 100;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const avatar = await Canvas.loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
    // 1. Save the context state BEFORE applying the avatar clip.
    ctx.save();

    // 2. Create the circular clipping path for the avatar.
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 3. Draw the avatar image (it will automatically be clipped to the circle).
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize)

    // 4. Restore the context state. This removes the clipping path,
    ctx.restore();

    // === Text ===
    ctx.fillStyle = '#ffffff'; // Set color once for white text
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Level ${userData.level}`, canvas.width - 220, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`RANK ${rank}`, canvas.width - 20, 30);

    // Username truncation logic (from previous suggestion)
    const maxUsernameWidth = 200; // Adjust as needed
    let usernameToDisplay = targetUser.username;
    const metrics = ctx.measureText(usernameToDisplay);
    if (metrics.width > maxUsernameWidth) {
        let truncated = false;
        while (ctx.measureText(usernameToDisplay + '…').width > maxUsernameWidth && usernameToDisplay.length > 0) {
            usernameToDisplay = usernameToDisplay.slice(0, -1);
            truncated = true;
        }
        if (truncated) {
            usernameToDisplay += '…';
        }
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(usernameToDisplay, 350, canvas.height - 90);
    // XP numbers
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`${formatXP(userData.xp)} / ${formatXP(xpNeeded)}`, canvas.width - 20, canvas.height - 90);
    ctx.textAlign = 'left';
    ctx.fillText(`Total Messages: ${userData.totalmessages}`, 130, canvas.height - 20)
    // === XP Progress Bar ===
    const barWidth = canvas.width - 150;
    const barHeight = 25;
    const radius = barHeight / 2;
    // Fill of progress bar
    if (xpPercent > 0) {
        ctx.fillStyle = '#3ba55d';
        const fill = Math.max(barWidth * xpPercent, 25)
        roundRect(ctx, 130, canvas.height - 75, fill, barHeight, radius);
        ctx.fill();
    }
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'rank.png' });
}

export async function execute(interaction) {
    try {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { userData, rank } = await getUser(targetUser.id, interaction.guild.id);
        if (!userData || userData.xp === undefined || userData.level === undefined)
            return interaction.editReply({ content: 'User data not found or incomplete. They might need to gain some XP first!', flags: MessageFlags.Ephemeral });
        const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
        await interaction.editReply({
            files: [await generateRankCard(userData, targetUser, xpNeeded, rank)]
        });
    } catch (error) {
        console.error('Error in rank command:', error);
        await interaction.editReply({ content: '⚠️ An error occurred while generating the rank card.', flags: MessageFlags.Ephemeral });
    }
}