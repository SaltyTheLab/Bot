import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";
import { clearmodlogs } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('clearmoderationforuser')
    .setDescription('clears the modlog database for a user (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
        opt.setName('target').setDescription(' Target User to clear modlogs')
            .setRequired(true)
    )

export async function execute(interaction) {
    const user = interaction.options.getUser('target')

    clearmodlogs(user.id);
    const reset = new EmbedBuilder()
        .setDescription(
            `moderation tables for ${user} have been cleared`
        )
        .setColor(0xff0000)
    await interaction.reply({
        embeds: [reset]
    })
    logRecentCommand(`clearmodlogs - ${user.tag}  Admin: ${interaction.user.tag}`);
}
