import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getRank, getUser } from '../Database/databasefunctions.js';
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
    if (typeof radius !== 'number') {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (let side in defaultRadius) {
            radius[side] = radius[side] || 0;
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}


export async function generateRankCard(userData, targetUser, xpNeeded, rank) {
    const canvas = Canvas.createCanvas(500, 100);
    const ctx = canvas.getContext('2d');

    const xpPercent = Math.min(userData.xp / xpNeeded, 1);

    // Background (Draw first, so everything else is on top)
    ctx.fillStyle = '#2c2f33';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
    ctx.fill();

    // === Avatar and Border ===
    const avatarSize = 64;
    const avatarX = 20;
    const avatarY = canvas.height / 2 - avatarSize / 2;
    const borderColor = '#3ba55d';
    const borderWidth = 2; // Thickness of the green border

    // Load the avatar image first
    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
    const avatar = await Canvas.loadImage(avatarUrl)
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
    // This allows us to restore it later, undoing the clip for other drawings.
    ctx.save();

    // 2. Create the circular clipping path for the avatar.
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip(); // Apply the clip. Any drawing now will be confined to this circle.

    // 3. Draw the avatar image (it will automatically be clipped to the circle).
    if (avatar) {
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    }

    // 4. Restore the context state. This removes the clipping path,
    //    so subsequent drawings (text, progress bar) are not clipped.
    ctx.restore();

    // 5. Draw the green border *on top* of the avatar.
    // This is a new path for the border.
    ctx.beginPath();
    // The border circle should be slightly larger than the avatar circle.
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + borderWidth, 0, Math.PI * 2);
    ctx.lineWidth = borderWidth * 2; // Make the line thickness
    ctx.strokeStyle = borderColor;
    ctx.stroke(); // Draw the border outline

    // === Text ===
    ctx.fillStyle = '#ffffff'; // Set color once for white text
    ctx.font = '20px sans-serif';
    ctx.fillText(`LEVEL ${userData.level}`, 110, 30);

    ctx.textAlign = 'right';
    ctx.fillText(`RANK ${rank}`, canvas.width - 20, 30);

    ctx.textAlign = 'left'; // Reset for username
    ctx.font = '16px sans-serif';

    // Username truncation logic (from previous suggestion)
    const maxUsernameWidth = 150; // Adjust as needed
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
    ctx.fillText(usernameToDisplay, 110, 52);

    ctx.textAlign = 'right'; // Reset for XP text
    ctx.fillStyle = '#cccccc'; // Lighter color for XP text
    ctx.fillText(`${userData.xp} / ${xpNeeded}`, canvas.width - 20, 52);

    // === XP Progress Bar ===
    const barX = 110;
    const barY = 65;
    const barWidth = canvas.width - 130;
    const barHeight = 15;
    const radius = barHeight / 2;

    // Background of progress bar
    ctx.fillStyle = '#40444b';
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // Fill of progress bar
    if (xpPercent > 0) {
        ctx.fillStyle = '#3ba55d';
        roundRect(ctx, barX, barY, barWidth * xpPercent, barHeight, radius);
        ctx.fill();
    }

    const bufferImage = canvas.toBuffer('image/png');
    return new AttachmentBuilder(bufferImage, { name: 'rank.png' });
}

export async function execute(interaction) {
    try {
        //delay the reply to give time 
        await interaction.deferReply();
        //get the interaction user
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guild.id
        // *** Directly use the result from your existing getUser ***
        const { userData } = getUser(userId, guildId);

        //abort if userdata doesn't exist or there are error in their data
        if (!userData || userData.xp === undefined || userData.level === undefined) {
            return interaction.editReply({ content: 'User data not found or incomplete. They might need to gain some XP first!', ephemeral: true });
        }

        //find user within all users for rank
        const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
        const rank = getRank(userId, guildId)
        const rankCard = await generateRankCard(userData, targetUser, xpNeeded, rank);

        await interaction.editReply({
            files: [rankCard]
        });
    } catch (error) {
        console.error('Error in rank command:', error);
        await interaction.editReply({ content: '⚠️ An error occurred while generating the rank card.', ephemeral: true });
    }
}