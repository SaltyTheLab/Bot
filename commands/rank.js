import { SlashCommandBuilder, AttachmentBuilder, InteractionContextType } from 'discord.js';
import { getUser } from '../Database/databasefunctions.js';
import Canvas from 'canvas';

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
}
export async function generateRankCard(userData, targetUser, xpNeeded, rank) {
    const canvas = Canvas.createCanvas(500, 150);
    const ctx = canvas.getContext('2d');
    const xpPercent = Math.min(userData.xp / xpNeeded, 1);

    // Background (Draw first, so everything else is on top)
    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
    ctx.fill();

    // === Avatar and Border ===
    const avatarSize = 100;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const borderColor = '#3ba55d';
    const borderWidth = 1.5; // Thickness of the green border

    const avatar = await Canvas.loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
        .catch(err => {
            console.error(`Failed to load avatar for ${targetUser.tag}:`, err);
            // Fallback: draw a solid circle if avatar fails to load
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#7289DA'; // Discord blue as fallback
            ctx.fill();
            return null;
        });

    // 1. Save the context state BEFORE applying the avatar clip.
    ctx.save();

    // 2. Create the circular clipping path for the avatar.
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 3. Draw the avatar image (it will automatically be clipped to the circle).
    avatar ? ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize) : null

    // 4. Restore the context state. This removes the clipping path,
    ctx.restore();

    // 5. Draw the green border *on top* of the avatar.
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + borderWidth, 0, Math.PI * 2);
    ctx.lineWidth = borderWidth * 2; // Make the line thickness
    ctx.strokeStyle = borderColor;
    ctx.stroke(); // Draw the border outline

    // === Text ===
    ctx.fillStyle = '#ffffff'; // Set color once for white text
    ctx.font = '20px sans-serif';
    ctx.fillText(`Level ${userData.level}`, canvas.width - 220, 30);

    ctx.textAlign = 'right';
    ctx.fillText(`RANK ${rank}`, canvas.width - 20, 30);

    ctx.textAlign = 'left'; // Reset for username

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
    ctx.fillText(usernameToDisplay, 150, canvas.height - 90);

    ctx.textAlign = 'right'; // Reset for XP text
    ctx.fillStyle = '#cccccc'; // Lighter color for XP text
    let formattedxp = null;
    let formattedneeded = null;
    if (userData.xp > 10000)
        formattedxp = formatXP(userData.xp)
    if (xpNeeded > 10000)
        formattedneeded = formatXP(xpNeeded)
    ctx.fillText(`${formattedxp ?? userData.xp} / ${formattedneeded ?? xpNeeded}`, canvas.width - 20, canvas.height - 90);

    ctx.textAlign = 'left';
    ctx.fillText(`Total Messages: ${userData.totalmessages}`, 130, canvas.height - 20)
    // === XP Progress Bar ===
    const barX = 130;
    const barY = canvas.height - 75;
    const barWidth = canvas.width - 150;
    const barHeight = 25;
    const radius = barHeight / 2;

    // Background of progress bar
    ctx.fillStyle = '#40444b';
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // Fill of progress bar
    if (xpPercent > 0) {
        ctx.fillStyle = '#3ba55d';
        const filledWidith = Math.max(barWidth * xpPercent, 25)
        roundRect(ctx, barX, barY, filledWidith, barHeight, radius);
        ctx.fill();
    }

    const bufferImage = canvas.toBuffer('image/png');
    return new AttachmentBuilder(bufferImage, { name: 'rank.png' });
}

export async function execute(interaction) {
    try {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { userData, rank } = await getUser(targetUser.id, interaction.guild.id);
        if (!userData || userData.xp === undefined || userData.level === undefined)
            return interaction.editReply({ content: 'User data not found or incomplete. They might need to gain some XP first!', ephemeral: true });
        const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
        const rankCard = await generateRankCard(userData, targetUser, xpNeeded, rank);
        await interaction.editReply({
            files: [rankCard]
        });
    } catch (error) {
        console.error('Error in rank command:', error);
        await interaction.editReply({ content: '⚠️ An error occurred while generating the rank card.', ephemeral: true });
    }
}