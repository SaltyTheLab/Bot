import { SlashCommandBuilder, InteractionContextType, StringSelectMenuOptionBuilder, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { applications } from "../BotListeners/Extravariables/mapsandsets.js";
const ages = [
    { label: '16 to 17', range: '16-17' },
    { label: '18 and over', range: '18+' }
]
export const data = new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to be on the mod team')
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const userId = interaction.user.id;
    const guild = interaction.guild;

    if (!applications.has(userId)) {
        applications.set(userId, {})
    }
    const application = applications.get(userId)


    application.guild = guild.id
    const ageoptions = ages.map(age => new StringSelectMenuOptionBuilder()
        .setLabel(age.label)
        .setValue(age.range))

    const ageselect = new StringSelectMenuBuilder()
        .setCustomId(`select_age_`)
        .setPlaceholder('Select your age range...')
        .addOptions(ageoptions)
        .setMaxValues(1);
    const row = new ActionRowBuilder().addComponents(ageselect)
    const dmchannel = await interaction.user.createDM()
    dmchannel.send({
        content: 'Specify your age range:',
        components: [row]
    })
    interaction.reply({
        content: `check your dms <@${userId}>!`,
        ephemeral: true
    })
}