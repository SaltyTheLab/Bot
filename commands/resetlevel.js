import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import logRecentCommand from '../Logging/recentcommands.js';

export const data = new SlashCommandBuilder()
    .setName('resetlevel')
    .setDescription('Reset a user\'s level and XP to 0')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to reset')
            .setRequired(true)
    )

export async function execute(interaction) {
    const guildId = interaction.guild.id
    const targetUser = interaction.options.getUser('user');
    const { userData } = getUser(targetUser.id, guildId)
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
