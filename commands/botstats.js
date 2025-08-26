import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('botstats')
    .setContexts([InteractionContextType.Guild])
    .setDescription('Get the bots stats in real time')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(interaction) {
    const guilds = interaction.client.guilds.cache.size;
    const channels = interaction.client.channels.cache.size;
    const users = interaction.client.users.cache.size;
    const guildMembers = interaction.guild.members.cache.size;
    const guildChannels = interaction.guild.channels.cache.size;
    const stats = new EmbedBuilder()
        .setTitle('current bot stats')
        .setDescription([
            `- Total Guilds: ${guilds}`,
            `- Total Channels: ${channels}`,
            `- Total Users: ${users}`,
            `- Members in this guild: ${guildMembers}`,
            `- Channels in this guild: ${guildChannels}`
        ].join('\n'))

    interaction.reply({ embeds: [stats] });
} 