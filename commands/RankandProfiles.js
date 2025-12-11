import { SlashCommandBuilder, AttachmentBuilder, InteractionContextType } from 'discord.js';
import { getUser } from '../Database/databaseAndFunctions.js';
import { generateRankCard } from '../utilities/rankcardgenerator.js';
export const data = new SlashCommandBuilder()
    .setName('user')
    .setDescription('check your Rank or Profile')
    .addSubcommand(command => command.setName('rank').setDescription('See your xp and Level')
        .addUserOption(opt => opt.setName('member').setDescription('The user you want to view the rank of').setRequired(false)))
    .addSubcommand(command => command.setName('profile').setDescription('See your coin count and totalmessages')
        .addUserOption(opt => opt.setName('member').setDescription('The user you want to view the profile of').setRequired(false)))
    .setContexts([InteractionContextType.Guild])
export async function execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const { userData, rank } = await getUser({ userId: targetUser.id, guildId: interaction.guild.id, modflag: true });
    if (!userData) return interaction.editReply({ content: 'User data not found or incomplete.', flags: 64 });
    let image;
    switch (interaction.options.getSubcommand()) {
        case 'rank': {
            const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
            image = await generateRankCard({ userData: userData, targetUser: targetUser, xpNeeded: xpNeeded, rank: rank })
            break;
        }
        case 'profile':
            image = await generateRankCard({ userData: userData, targetUser: targetUser });
    }
    return interaction.editReply({ files: [new AttachmentBuilder(image.file, image.name)] })
}