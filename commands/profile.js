import { SlashCommandBuilder, AttachmentBuilder, InteractionContextType, MessageFlags } from "discord.js";
import { getUser } from "../Database/databaseAndFunctions.js";
import { generateRankCard } from "../utilities/rankcardgenerator.js";

export const data = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your balance and total messages')
    .setContexts(InteractionContextType.Guild)
    .addUserOption(opt => opt.setName('target').setDescription('User you want to view the profile of').setRequired(false))

export async function execute(interaction) {
    const user = interaction.options.getUser('target') || interaction.user
    const { userData } = await getUser(user.id, interaction.guild.id, true)
    if (!userData) {
        return interaction.reply({
            content: 'You do not have an entry yet, be active in the server in order to create an entry',
            flags: MessageFlags.Ephemeral
        })
    }
    const image = await generateRankCard(userData, user);
    return interaction.reply({ files: [new AttachmentBuilder(image.file, image.name)] })
}