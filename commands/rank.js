import { SlashCommandBuilder, AttachmentBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { getUser } from '../Database/databaseAndFunctions.js';
import { generateRankCard } from '../utilities/rankcardgenerator.js';
export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your current XP and level')
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check')
            .setRequired(false)
    );
export async function execute(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const { userData, rank } = await getUser(targetUser.id, interaction.guild.id);
    if (!userData || userData.xp === undefined || userData.level === undefined)
        return interaction.editReply({ content: 'User data not found or incomplete. They might need to gain some XP first!', flags: MessageFlags.Ephemeral });
    const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
    const image = await generateRankCard(userData, targetUser, xpNeeded, rank)
    interaction.editReply({
        files: [new AttachmentBuilder(image.file, image.name)]
    });

}