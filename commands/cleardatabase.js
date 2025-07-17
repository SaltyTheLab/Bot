import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { resetModerationTables } from "../utilities/cleardatabase.js";

export const data = new SlashCommandBuilder()
    .setName('clearmoderationdatabase')
    .setDescription('clears the modlog database (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(interaction) {
    const reset = new EmbedBuilder()
        .setTitle(
            ' moderation tables have been cleared'
        )
        .setColor(0xff0000)
    resetModerationTables();

    interaction.reply({
        embeds: [reset]
    })
}
