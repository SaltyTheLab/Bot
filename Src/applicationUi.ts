import { ButtonStyle, ComponentType, type ModalBuilder } from "discord.js";

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