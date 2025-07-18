// commands/resetlevel.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateUser } from '../Logging/databasefunctions.js';

export const data = new SlashCommandBuilder()
    .setName('resetlevel')
    .setDescription('Reset a user\'s level and XP to 0')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to reset')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // optional: restrict to mods/admins

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const userId = targetUser.id;

    // Reset XP and level to 0
    await updateUser(userId, guildId, 0, 1);

    await interaction.reply({
        content: `🔄 Reset **${targetUser.username}**'s XP to 0 and level to 1.`,
        ephemeral: true
    });
}
