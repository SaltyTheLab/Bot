import { SlashCommandBuilder, InteractionContextType, StringSelectMenuOptionBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } from "discord.js";
import { save, load } from "../utilities/fileeditors.js";

export const data = new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to be on the mod team')
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const ages = [
        { label: '12 or under', range: '12 or under' },
        { label: '13 to 15', range: '13-15' },
        { label: '16 to 17', range: '16-17' },
        { label: '18 or over', range: '18 or over' }
    ]
    const filepath = "Extravariables/applications.json"
    const userId = interaction.user.id;
    const guild = interaction.guild.id;
    let applications = await load(filepath);
    if ((!Object.hasOwn(applications, userId))) {
        applications[userId] = {}
        applications[userId].guild = guild.id
        applications[userId].Agerange = null
        save(filepath, applications)
        applications = await load(filepath);
    }
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
        flags: MessageFlags.Ephemeral
    })
}