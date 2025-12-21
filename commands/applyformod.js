import { save, load } from "../utilities/fileeditors.js";
const filepath = "Extravariables/applications.json"
export default {
    data: { name: 'apply', description: 'Apply to be on the mod team', default_member_permission: 1 << 3, },
    async execute({ interaction, api }) {
        const applications = await load(filepath)
        if (applications[interaction.member.user.id] && applications[interaction.member.user.id].Activity) {
            await api.interactions.reply(interaction.id, interaction.token, {
                content: 'You have already filled out the first part. Click the button below to continue to the next section.',
                components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'skip Part 1', style: 1 }] }],
                flags: 64
            })
            return;
        } else {
            applications[interaction.member.user.id] = {}
            applications[interaction.member.user.id].Agerange = null
            save(filepath, applications);
            await api.interactions.createModal(interaction.id, interaction.token, {
                title: 'Experience and Activity (1/3)',
                custom_id: 'server',
                components: [
                    {
                        type: 18, label: `What age range are you in?`, component: {
                            type: 3, custom_id: 'age',
                            options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }],
                            max_values: 1, required: true, style: 2, max_length: 300
                        }
                    },
                    { type: 18, label: 'Any prior mod experience?', component: { type: 4, custom_id: 'experience', required: true, style: 2, max_length: 300 } },
                    { type: 18, label: 'Have you been warned/muted?', component: { type: 4, custom_id: 'punishments', required: true, style: 1, max_length: 100 } },
                    { type: 18, label: 'Timezone?', component: { type: 4, custom_id: 'timezone', required: true, style: 1, placeholder: 'put current time if unsure', max_length: 8 } },
                    { type: 18, label: `How active are you in ${interaction.guild.name}`, component: { type: 4, custom_id: 'activity', style: 1, required: true, max_length: 150 } }
                ]
            })
        }
    }
}
