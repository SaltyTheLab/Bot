import { SlashCommandBuilder, InteractionContextType, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, LabelBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, StringSelectMenuBuilder } from "discord.js";
import { save, load } from "../utilities/fileeditors.js";
const filepath = "Extravariables/applications.json"
export const data = new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to be on the mod team')
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const guild = interaction.guild
    const userId = interaction.user.id
    const applications = load(filepath)
    if (applications[interaction.user.id] && applications[interaction.user.id].Activity) {
        interaction.reply({
            content: 'You have already filled out the first part. Click the button below to continue to the next section.',
            components: [new ActionRowBuilder({
                components: [new ButtonBuilder({ custom_id: 'next_modal_two', label: 'skip Part 1', style: ButtonStyle.Primary })]
            })],
            flags: MessageFlags.Ephemeral
        })
        return;
    } else {
        applications[userId] = {}
        applications[userId].Agerange = null
        save(filepath, applications);
        const questionOne = new LabelBuilder({
            label: `What age range are you in?`,
            component: new StringSelectMenuBuilder({
                max_values: 1, require: true, custom_id: 'age',
                options: [
                    { label: '12 or under', value: '12 or under' },
                    { label: '13 to 15', value: '13-15' },
                    { label: '16 to 17', value: '16-17' },
                    { label: '18 or over', value: '18 or over' }
                ]
            })
        })
        const questionTwo = new LabelBuilder({
            label: 'Please put down any prior mod experience',
            component: new TextInputBuilder({ custom_id: 'experience', placeholder: 'Put your experience here or N/A', required: true, style: TextInputStyle.Paragraph, max_length: 300 })
        })
        const questionThree = new LabelBuilder({
            label: 'Have you been warned/muted/kicked/banned?',
            component: new TextInputBuilder({ custom_id: 'punishments', placeholder: 'be honest and you do not need too much detail', required: true, style: TextInputStyle.Short, max_length: 100 })
        })
        const questionFour = new LabelBuilder({
            label: 'What is your timezone?',
            component: new TextInputBuilder({ custom_id: 'timezone', required: true, style: TextInputStyle.Short, placeholder: 'If unknown, put your current time', max_length: 8 })
        })
        const questionFive = new LabelBuilder({
            label: `How active are you in ${guild.name}`,
            component: new TextInputBuilder({ custom_id: 'activity', style: TextInputStyle.Short, required: true, max_length: 150 })
        })
        interaction.showModal(new ModalBuilder({
            title: 'Experience and Activity (1/3)',
            custom_id: 'server',
            components: [questionOne, questionTwo, questionThree, questionFour, questionFive]
        }))
    }
}