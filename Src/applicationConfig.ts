import { ButtonStyle, ComponentType, ModalBuilder, TextInputStyle } from "discord.js";

export const PART_CONFIG: Record<number, { modal: ModalBuilder, fields: string[] }> = {
    1: {
        modal: new ModalBuilder({
            title: 'Experience & Activity',
            customId: 'apply-modal-1',
            components: [
                {
                    type: ComponentType.Label, label: 'What age range are you in?', component: { custom_id: 'age', type: ComponentType.StringSelect, options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }] }
                },
                {
                    type: ComponentType.Label, label: 'Any prior mod experience?', component: { custom_id: 'experience', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 300 }
                },
                {
                    type: ComponentType.Label, label: 'Have you been warned/muted?', component: {
                        custom_id: 'punishments', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 100
                    }
                },
                {
                    type: ComponentType.Label, label: 'Timezone?', component: {
                        custom_id: 'timezone', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 8
                    }
                },
                {
                    type: ComponentType.Label, label: 'How active are you in the server?', component: {
                        custom_id: 'activity', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 150
                    }
                }],

        }),
        fields: ['Agerange', 'Experience', 'History', 'Timezone', 'Activity']
    },
    2: {
        modal: new ModalBuilder({
            title: 'Definitions, Why mod, and Staff issues',
            customId: 'apply-modal-2',
            components: [
                {
                    type: ComponentType.Label,
                    label: 'Why should you be on the team?',
                    component: {
                        custom_id: 'why',
                        type: ComponentType.TextInput,
                        style: TextInputStyle.Paragraph,
                        max_length: 500
                    }
                },
                {
                    type: ComponentType.Label, label: 'What is your definition of a troll?', component: {
                        type: ComponentType.TextInput,
                        custom_id: 'trolldef',
                        style: TextInputStyle.Short,
                        max_length: 65
                    }
                },
                {
                    type: ComponentType.Label, label: 'What is your definition of a raid?', component: {
                        type: ComponentType.TextInput,
                        custom_id: 'raiddef',
                        style: TextInputStyle.Short,
                        max_length: 65
                    }
                },
                {
                    type: ComponentType.Label, label: 'You disagree with an action from staff', component: {
                        type: ComponentType.TextInput,
                        style: TextInputStyle.Paragraph,
                        max_length: 300,
                        custom_id: 'staffissues'
                    }
                },
                {
                    type: ComponentType.Label, label: 'How would you handle a member report?', component: {
                        custom_id: 'memberreport', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 300
                    }
                }]
        }),
        fields: ['why', 'Trolldef', 'Raiddef', 'Staffissues', 'Memberreport']
    },
    3: {
        modal: new ModalBuilder({
            title: 'Situations',
            customId: 'apply-modal-3',
            components: [{
                type: ComponentType.Label, label: 'A member messages you about being harassed', component: {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350,
                    custom_id: 'dmmember'
                }
            },
            {
                type: ComponentType.Label, label: 'Users are arguing in general chat', component: {
                    custom_id: 'arguments',
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350
                }
            }, {
                type: ComponentType.Label, label: 'A member DMs you about a rule-breaking DM', component: {
                    type: ComponentType.TextInput,
                    custom_id: 'rulebreakdm',
                    style: TextInputStyle.Paragraph,
                    max_length: 350
                }
            },
            {
                type: ComponentType.Label, label: 'Staff is failing to follow the rules', component: {
                    custom_id: 'staffrulebreak', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 350
                }
            },
            {
                type: ComponentType.Label, label: 'A user shares illegal content', component: {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350,
                    custom_id: 'illegal',
                }
            }]

        }),
        fields: ['dmmember', 'arguments', 'rulebreakdm', 'staffrulebreak', 'illegal']
    },
};

export function buildApplicationHub(application: any | {}, partConfig: Record<number, { modal: ModalBuilder, fields: string[] }>) {
    const sections = [1, 2, 3].map(part => {
        const done = partConfig[part]!.fields.every(f => application?.[f] !== undefined && application?.[f] !== '');
        return {
            type: ComponentType.Section,
            components: [{ type: ComponentType.TextDisplay, content: `${done ? '✅' : '⬜'} **Part ${part}: ${partConfig[part]!.modal.data.title}**` }],
            accessory: { type: ComponentType.Button, disabled: done, style: done ? ButtonStyle.Secondary : ButtonStyle.Primary, label: done ? 'Done' : 'Fill out', custom_id: `apply-part-${part}` },
        };
    });
    const allDone = [1, 2, 3].every(p => partConfig[p]!.fields.every(f => application?.[f] !== undefined && application?.[f] !== ''));
    return [{
        type: ComponentType.Container,
        accent_color: allDone ? 0x2ecc71 : 0x5865F2,
        components: [
            { type: ComponentType.TextDisplay, content: '## Moderator Application\nFill out each section below, in any order. You can reopen and edit a section any time before submitting.' },
            ...sections,
            { type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: 3, label: 'Submit Application', custom_id: 'apply-submit', disabled: !allDone }] },
        ],
    }];
}