// commands/resetlevel.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getUser, saveUser } from '../Database/databaseFunctions.js';
import logRecentCommand from '../Logging/recentCommands.js';

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
    const { userData } = getUser(targetUser.id)
    // Reset XP and level to 0
    userData.level = 1;
    userData.xp = 0;
    saveUser(userData);

    await interaction.reply({
        content: `🔄 Reset **${targetUser.username}**'s XP to 0 and level to 1.`,
        ephemeral: true
    });
    logRecentCommand(`${targetUser.tag} level reset by Admin: ${interaction.user.tag}`);
}
