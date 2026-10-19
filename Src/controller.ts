import type { APIEmbed, APIEmbedField, APIRole, APIRoleColors, APIUser, ComponentType as DiscordComponentType } from 'discord-api-types/v10';

// Only a handful of ids are needed at runtime. Importing the real enum would bundle all of
// discord-api-types (~200 KB) into the browser script. `satisfies` makes tsc verify every
// number below is a genuine ComponentType value, so this can't silently drift.
const ComponentType = {
    Button: 2, Section: 9, TextDisplay: 10, Thumbnail: 11, MediaGallery: 12, File: 13, Separator: 14, Container: 17,
} as const satisfies Record<string, DiscordComponentType>;

// --- Types -------------------------------------------------------------------
type Role = 'owner' | 'admin' | 'mod';
type SectionType = 'mod' | 'public' | 'reaction' | 'response' | 'automod';
type V2Kind = 'button' | 'container' | 'section' | 'textDisplay' | 'thumbnail' | 'mediaGallery' | 'file' | 'separator';

interface GuildSummary { guildId: string; name: string | null; role: Role }
interface GuildChannel { id: string; name: string; type: number; position?: number; parent_id?: string | null; categoryName?: string }
interface AutomodRule { id: string; name: string }
interface ReasonWeight { reason: string; weight: number }
interface ReactionRole { emoji: string; roleId: string }
interface V2ApiComponent {
    type: number;
    id?: number;
    accent_color?: number;
    spacing?: number;
    style?: number;
    label?: string;
    custom_id?: string;
    url?: string;
    sku_id?: string;
    disabled?: boolean;
    placeholder?: string;
    min_values?: number;
    max_values?: number;
    channel_types?: number[];
    default_values?: { type: string; id: string }[];
    description?: string;
    spoiler?: boolean;
    divider?: boolean;
    content?: string;
    components?: V2ApiComponent[];
    options?: { label: string; value: string; description?: string; default?: boolean; emoji?: { id?: string; name?: string } }[];
    items?: { media?: { url?: string }; description?: string; spoiler?: boolean }[];
    media?: { url?: string };
    file?: { url?: string };
    accessory?: V2ApiComponent;
    [key: string]: unknown;
}
interface MessageConfig {
    channelid?: string;
    format: 'v1' | 'v2';
    embeds?: APIEmbed[];
    components?: V2ApiComponent[];
    reactions?: ReactionRole[];
    messageId?: string; // written by syncEmbed on the server
}
type AutomodSettings = {
    messagereasonsandweights?: Record<string, ReasonWeight>;
    automodreasonsandweights?: Record<string, ReasonWeight>;
} & Record<string, unknown>; // the rest are flat thresholds
interface GuildConfigDoc {
    guildId: string;
    name?: string | null;
    ownerId?: string;
    staffroles?: string[];
    modChannels?: Record<string, string>;
    publicChannels?: Record<string, string>;
    generalchannels?: string[];
    reactions?: Record<string, string | string[]>;
    guildRoles?: APIRole[]
    responses?: Record<string, string>;
    automodsettings?: AutomodSettings;
    messageConfigs?: Record<string, MessageConfig>;
    // added by GET /api/guilds/:guildId
    _viewerRole: Role;
    guildChannels: GuildChannel[];
    rules: AutomodRule[];
    staffRoles: APIRole[]
}
// --- State -------------------------------------------------------------------
let messageConfigsDraft: Record<string, MessageConfig> = {};
const v2FileUploads = new Map<string, File>();
let activeEmbedKey = '';
let currentAutomodRules: AutomodRule[] = [];
let currentGuildRoles: APIRole[] = []
let currentGuildChannels: GuildChannel[] = [];
let staffRoles: APIRole[] = []

function queueEmbedUpload(file: File): File {
    const extension = file.name.match(/\.[a-z0-9]{1,10}$/i)?.[0] || '';
    const upload = new File([file], `embed-${crypto.randomUUID()}${extension}`, { type: file.type });
    v2FileUploads.set(`${activeEmbedKey}\0${upload.name}`, upload);
    return upload;
}
function queueImageUpload(file: File): File | null {
    if (!file.type.startsWith('image/')) {
        showMessage('Choose an image file.', 'bg-yellow-500');
        return null;
    }
    return queueEmbedUpload(file);
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`#${id} not found in index.html`);
    return node as T;
}
function initializeRolePickers() {
    const template = el<HTMLTemplateElement>('rolePickerTemplate');
    document.querySelectorAll<HTMLElement>('[data-role-picker-input]').forEach(target => {
        const picker = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
        picker.querySelector('input')!.id = target.dataset.rolePickerInput!;
        target.replaceWith(picker);
    });
}
initializeRolePickers();
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const elements = {
    guildSelect: el<HTMLSelectElement>('guildSelect'),
    loginBtn: el<HTMLButtonElement>('loginBtn'),
    logoutBtn: el<HTMLButtonElement>('logoutBtn'),
    authStatus: el('authStatus'),
    modChannelsSection: el('modChannelsSection'),
    publicChannelsSection: el('publicChannelsSection'),
    GeneralChannelsSection: el('GeneralChannelsSection'),
    reactionsSection: el('reactionSection'),
    Responses: el('stringSection'),
    adminRoleInput: el<HTMLInputElement>('adminRoleInput'),
    modRoleInput: el<HTMLInputElement>('modRoleInput'),
    jrRoleInput: el<HTMLInputElement>('jrRoleInput'),
    automodSection: el('AutomodSection'),
    addPublicChannelBtn: el('addPublicChannelBtn'),
    EmbedSection: el('embedContentSection'),
    addMediaBtn: el<HTMLButtonElement>('addMediaBtn'),
    addReactionBtn: el<HTMLButtonElement>('addReactionBtn'),
    addStringBtn: el<HTMLButtonElement>('addStringBtn'),
    saveConfigBtn: el<HTMLButtonElement>('saveConfigBtn'),
    deleteConfigBtn: el<HTMLButtonElement>('deleteConfigBtn'),
    messageBox: el('messageBox'),
    reasonsWeightsSection: el('reasonsWeightsSection'),
    addReasonWeightBtn: el<HTMLButtonElement>('addReasonWeightBtn'),
    messageReasonsWeightsSection: el('messageReasonsWeightsSection'),
    addMessageReasonButtons: el('addMessageReasonButtons'),
    addServerBtn: el<HTMLButtonElement>('addToServerBtn'),
    orText: el('orText'),
    buttonColumnText: el('buttoncolumnMessage'),
    channelsContainer: el('channelsContainer'),
    guilds: el('guilds')
};
const rolePickers = {
    admin: makeRolePicker(elements.adminRoleInput),
    mod: makeRolePicker(elements.modRoleInput),
    jr: makeRolePicker(elements.jrRoleInput),
};


function setDisabledState(el: HTMLButtonElement | HTMLSelectElement, isDisabled: boolean) {
    el.disabled = isDisabled;
    el.classList.toggle('cursor-not-allowed', isDisabled);
    el.classList.toggle('opacity-50', isDisabled);
}
function buildChannelOptionsHtml(selectedId: string) {
    const grouped = new Map<string, GuildChannel[]>();
    const uncategorized: GuildChannel[] = [];

    currentGuildChannels.forEach(ch => {
        if (!ch.categoryName) { uncategorized.push(ch); return; }
        if (!grouped.has(ch.categoryName)) grouped.set(ch.categoryName, []);
        grouped.get(ch.categoryName)!.push(ch);
    });

    let html = '<option value="">-- Select a channel --</option>';
    uncategorized.forEach(ch => {
        html += `<option value="${ch.id}" ${ch.id === selectedId ? 'selected' : ''}>#${ch.name}</option>`;
    });
    for (const [categoryName, channels] of grouped) {
        html += `<optgroup label="${categoryName}">`;
        channels.forEach(ch => {
            html += `<option value="${ch.id}" ${ch.id === selectedId ? 'selected' : ''}>#${ch.name}</option>`;
        });
        html += '</optgroup>';
    }
    return html;
}
function buildEmbedChannelOptionsHtml(selectedId: string) {
    const options = buildChannelOptionsHtml(selectedId);
    if (!selectedId || currentGuildChannels.some(channel => channel.id === selectedId)) return options;
    const escapedId = selectedId.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    return options.replace('</option>', `</option><option value="${escapedId}" selected>Unavailable channel (${escapedId})</option>`);
}
// --- API helpers ---------------------------------------------------------
function roleColorHex(colorInt: APIRoleColors) {
    if (!colorInt) return '#b9bbbe';
    return `#${colorInt.primary_color.toString(16).padStart(6, '0')}`;
}

// Wraps a hidden <input id="..."> with a Discord-style colored dropdown button/menu.
// Overrides .value on the input so all your existing loadSelectedGuild/getFormValues
// code (which just reads/writes .value) keeps working with zero changes elsewhere.
function makeRolePicker(hiddenInput: HTMLInputElement) {
    const wrapper = hiddenInput.closest<HTMLElement>('[data-role-picker]')!;
    const button = wrapper.querySelector<HTMLElement>('.role-picker-btn')!;
    const label = wrapper.querySelector<HTMLElement>('.role-picker-label')!;
    const menu = wrapper.querySelector<HTMLElement>('.role-picker-menu')!;

    let backingValue = hiddenInput.value || '';
    let roleLookup = new Map<string, APIRole>(); // roleId -> role

    Object.defineProperty(hiddenInput, 'value', {
        get() { return backingValue; },
        set(v: string) {
            backingValue = v || '';
            const role = roleLookup.get(backingValue);
            label.textContent = role ? `@${role.name}` : '-- Select a role --';
            label.style.color = role ? roleColorHex(role.colors) : '';
        },
        configurable: true,
    });

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.classList.contains('hidden')) {
            document.querySelectorAll('.role-picker-menu').forEach(m => m.classList.add('hidden'));
            menu.classList.remove('hidden');
        } else menu.classList.add('hidden');;
    });
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target as Node)) menu.classList.add('hidden');;
    });

    function setRoles(roles: APIRole[]) {
        roleLookup = new Map(roles.map(r => [r.id, r]));
        menu.innerHTML = '';
        const blank = document.createElement('div');
        blank.className = 'px-3 py-2 cursor-pointer hover:bg-gray-700 text-gray-400';
        blank.textContent = '-- Select a role --';
        blank.addEventListener('click', () => { hiddenInput.value = ''; menu.classList.add('hidden'); });
        menu.appendChild(blank);

        roles.forEach(role => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 cursor-pointer hover:bg-gray-700';
            item.textContent = `@${role.name}`;
            item.style.color = roleColorHex(role.colors);
            item.addEventListener('click', () => { hiddenInput.value = role.id; menu.classList.add('hidden'); });
            menu.appendChild(item);
        });

        const role = roleLookup.get(backingValue);
        label.textContent = role ? `@${role.name}` : '-- Select a role --';
        label.style.color = role ? roleColorHex(role.colors) : ''; // in case the currently-set value's role just became known
    }

    return { setRoles };
}
// --- Embed Generator ---------------------------------------------------------
// Required (at least one): title, description, author name. Everything else is optional
// and hidden behind a toggle button until the user asks for it, so the form isn't
// overwhelming for a simple "just post some text" embed.

type OptionalEmbedKey = 'color' | 'url' | 'image' | 'thumbnail' | 'footer' | 'timestamp' | 'fields' | 'reactions';
const OPTIONAL_EMBED_FIELDS: { key: OptionalEmbedKey; label: string; render: (embed: APIEmbed) => string }[] = [
        {
            key: 'color', label: 'Color', render: (embed: APIEmbed) => `
            <span class="field-label">Color (hex, e.g. #5865F2)</span>
            <input type="text" class="field" data-embed-field="color" value="${intColorToHex(embed.color)}" placeholder="#5865F2">`,
        },
        {
            key: 'url', label: 'URL', render: (embed: APIEmbed) => `
            <span class="field-label">Title Link URL</span>
            <input type="text" class="field" data-embed-field="url" value="${embed.url || ''}" placeholder="https://...">`,
        },
        {
            key: 'image', label: 'Image', render: (embed: APIEmbed) => `
            <span class="field-label">Image URL</span>
            <input type="text" class="field" data-embed-field="image" value="${embed.image?.url || ''}" placeholder="https://...">
            <input type="file" class="field" accept="image/*" data-embed-image-upload="image">`,
        },
        {
            key: 'thumbnail', label: 'Thumbnail', render: (embed: APIEmbed) => `
            <span class="field-label">Thumbnail URL</span>
            <input type="text" class="field" data-embed-field="thumbnail" value="${embed.thumbnail?.url || ''}" placeholder="https://...">
            <input type="file" class="field" accept="image/*" data-embed-image-upload="thumbnail">`,
        },
        {
            key: 'footer', label: 'Footer', render: (embed: APIEmbed) => `
            <span class="field-label">Footer Text</span>
            <input type="text" class="field" data-embed-field="footerText" value="${embed.footer?.text || ''}">
            <div></div>
            <span class="field-label">Icon URL</span>
            <input type="text" class="field" data-embed-field="footerIcon" value="${embed.footer?.icon_url || ''}" placeholder="https://...">`,
        },
        {
            key: 'timestamp', label: 'Timestamp', render: (embed: APIEmbed) => `
            <span class="flex items-center gap-2 text-gray-300">
                <input type="checkbox" data-embed-field="timestamp" ${embed.timestamp ? 'checked' : ''}>
                Stamp with the time this embed is saved
            </span>`,
        },
        {
            key: 'fields', label: 'Fields', render: () => `
            <span class="field-label">Fields</span>
            <div data-embed-fields-list class="space-y-2"></div>
            <button type="button" class="add-btn" data-add-embed-field>Add Field</button>`,
        },
    {
        key: 'reactions', label: 'Reaction Roles', render: () => `
            <span class="field-label">Reaction Roles</span>
            <div data-reactions-list class="space-y-2"></div>
            <button type="button" class="add-btn" data-add-reaction>Add Reaction</button>`,
    }
];
function blankEmbed(): APIEmbed { return { title: '', description: '', author: { name: '' } }; }

// --- Components V2 Builder ---------------------------------------------------

// Each entry describes one node kind: its Discord type id, what it's allowed to
// contain (drives which "+ Add" buttons show up inside it), and its own editable
// fields. This is the "typing" the tree editor is built around — adding a new
// component kind later means adding one entry here plus its render/serialize
// handling below, not touching the tree-walking logic itself.
interface V2FieldDef { key: string; label: string; input: 'text' | 'textarea' | 'number' | 'checkbox' | 'select'; placeholder?: string; options?: { value: string; label: string }[] }
interface V2NodeDef { label: string; type: number; canContain: V2Kind[]; fields: V2FieldDef[]; maxChildren?: number; list?: 'media'; hasAccessory?: boolean }
interface V2MediaItem { url: string; description: string; spoiler: boolean }
interface V2Node {
    id: string; apiId?: number; kind: V2Kind; fields: Record<string, string | boolean>;
    children: V2Node[]; accessory: V2Node | null; items: V2MediaItem[]; extra: Record<string, unknown>;
}
const V2_NODE_KINDS: Record<V2Kind, V2NodeDef> = {
    button: {
        label: 'Button', type: ComponentType.Button, canContain: [], fields: [
            { key: 'label', label: 'Label', input: 'text' }, { key: 'url', label: 'Link URL', input: 'text' },
            { key: 'emoji_name', label: 'Emoji', input: 'text' }, { key: 'emoji_id', label: 'Custom Emoji ID', input: 'text' },
        ]
    },
    container: { label: 'Container', type: ComponentType.Container, canContain: ['file', 'mediaGallery', 'section', 'separator', 'textDisplay'], maxChildren: 10, fields: [{ key: 'accent_color', label: 'Accent Color (hex)', input: 'text' }, { key: 'spoiler', label: 'Spoiler', input: 'checkbox' }] },
    section: { label: 'Section', type: ComponentType.Section, canContain: ['textDisplay'], maxChildren: 3, fields: [], hasAccessory: true },
    textDisplay: { label: 'Text', type: ComponentType.TextDisplay, canContain: [], fields: [{ key: 'content', label: 'Content (markdown)', input: 'textarea' }] },
    thumbnail: { label: 'Thumbnail', type: ComponentType.Thumbnail, canContain: [], fields: [{ key: 'media_url', label: 'Thumbnail URL', input: 'text' }, { key: 'description', label: 'Alt text', input: 'text' }, { key: 'spoiler', label: 'Spoiler', input: 'checkbox' }] },
    mediaGallery: { label: 'Media Gallery', type: ComponentType.MediaGallery, canContain: [], fields: [], list: 'media' },
    file: { label: 'File', type: ComponentType.File, canContain: [], fields: [] },
    separator: { label: 'Separator', type: ComponentType.Separator, canContain: [], fields: [{ key: 'divider', label: 'Show divider line', input: 'checkbox' }, { key: 'spacing', label: 'Spacing', input: 'select', options: [{ value: '1', label: 'Small' }, { value: '2', label: 'Large' }] }] },
};
const V2_ROOT_KINDS: V2Kind[] = ['container', 'file', 'mediaGallery', 'section', 'separator', 'textDisplay'];
const V2_COMPONENT_PROPERTIES = new Set(['type', 'id', 'components', 'accessory', 'items', 'options', 'emoji', 'media', 'file', 'name', 'size', 'accent_color', 'spacing', 'style', 'label', 'custom_id', 'url', 'sku_id', 'disabled', 'placeholder', 'min_values', 'max_values', 'channel_types', 'default_values', 'description', 'spoiler', 'divider', 'content']);

function hexColorToInt(hex: string) {
    const n = parseInt(String(hex || '').trim().replace(/^#/, ''), 16);
    return Number.isNaN(n) ? undefined : n;
}
function intColorToHex(n?: number | null) {
    return typeof n === 'number' ? '#' + n.toString(16).padStart(6, '0') : '';
}
function createV2Node(kind: V2Kind): V2Node {
    const fields: Record<string, string | boolean> = {};
    if (kind === 'separator') Object.assign(fields, { divider: true, spacing: '1' });
    if (kind === 'container' || kind === 'thumbnail' || kind === 'file') fields.spoiler = false;
    return { id: crypto.randomUUID(), kind, fields, children: [], accessory: null, items: [], extra: {} };
}
function v2NodeToApi(node: V2Node): V2ApiComponent {
    const def = V2_NODE_KINDS[node.kind];
    const api: V2ApiComponent = { ...node.extra, type: def.type };
    if (node.apiId !== undefined) api.id = node.apiId;
    if (node.kind === 'file' && node.fields.file_url) api.file = { url: String(node.fields.file_url).trim() };
    if (node.kind === 'button') api.style = 5;
    for (const fieldDef of def.fields) {
        const value = node.fields[fieldDef.key];
        if (fieldDef.input === 'checkbox') { api[fieldDef.key] = !!value; continue; }
        if (value === undefined || value === '') continue;
        if (fieldDef.key === 'accent_color') { const color = hexColorToInt(String(value)); if (color !== undefined) api.accent_color = color; }
        else if (fieldDef.key === 'media_url') api.media = { url: String(value).trim() };
        else if (fieldDef.key === 'file_url') api.file = { url: String(value).trim() };
        else if (fieldDef.key === 'spacing') api.spacing = Number(value);
        else api[fieldDef.key] = value;
    }
    if (node.kind === 'button' && (node.fields.emoji_name || node.fields.emoji_id)) api.emoji = { name: node.fields.emoji_name || undefined, id: node.fields.emoji_id || undefined };
    if (def.list === 'media') api.items = node.items.map(item => ({ media: { url: item.url.trim() }, ...(item.description ? { description: item.description } : {}), ...(item.spoiler ? { spoiler: true } : {}) }));
    if (def.canContain.length) {
        api.components = node.children.map(v2NodeToApi);
    }
    if (def.hasAccessory && node.accessory) api.accessory = v2NodeToApi(node.accessory);
    return api;
}
function v2ApiToNode(api: V2ApiComponent): V2Node | null {
    const kind = (Object.keys(V2_NODE_KINDS) as V2Kind[]).find(k => V2_NODE_KINDS[k].type === api.type);
    if (!kind) return null; // Unsupported or removed component types are not reconstructed.
    const def = V2_NODE_KINDS[kind];
    const node = createV2Node(kind);
    node.apiId = api.id;
    node.extra = Object.fromEntries(Object.entries(api).filter(([key]) => !V2_COMPONENT_PROPERTIES.has(key)));
    if (kind === 'file') node.fields.file_url = String(api.file?.url || '');
    for (const fieldDef of def.fields) {
        if (fieldDef.key === 'accent_color') node.fields.accent_color = intColorToHex(api.accent_color);
        else if (fieldDef.key === 'media_url') node.fields.media_url = String(api.media?.url || '');
        else if (fieldDef.key === 'file_url') node.fields.file_url = String(api.file?.url || '');
        else if (fieldDef.key === 'emoji_name') node.fields.emoji_name = String((api.emoji as any)?.name || '');
        else if (fieldDef.key === 'emoji_id') node.fields.emoji_id = String((api.emoji as any)?.id || '');
        else if (fieldDef.input === 'checkbox') node.fields[fieldDef.key] = api[fieldDef.key] === undefined ? fieldDef.key === 'divider' : !!api[fieldDef.key];
        else if (api[fieldDef.key] !== undefined) node.fields[fieldDef.key] = String(api[fieldDef.key]);
    }
    if (def.list === 'media') node.items = (api.items || []).map(item => ({ url: String(item.media?.url || ''), description: String(item.description || ''), spoiler: !!item.spoiler }));
    if (def.canContain.length && Array.isArray(api.components)) {
        node.children = api.components.map(v2ApiToNode).filter((n): n is V2Node => n !== null);
    }
    if (def.hasAccessory && api.accessory) node.accessory = v2ApiToNode(api.accessory);
    return node;
}
function validateV2Components(components: V2ApiComponent[]) {
    if (!components.length) return 'Add at least one component.';
    let componentCount = 0;
    const validateButton = (button: V2ApiComponent) => {
        const style = Number(button.style);
        if (style !== 5) return 'Only link buttons are supported here.';
        if (!button.url) return 'Link buttons need a URL.';
        if (!button.label?.trim() && !button.emoji) return 'Buttons need a label or emoji.';
        if ((button.label?.length || 0) > 80) return 'Button labels are limited to 80 characters.';
        return null;
    };
    const inspect = (component: V2ApiComponent, parentType: number | null): string | null => {
        componentCount++;
        if (componentCount > 40) return 'Components V2 messages allow at most 40 components.';

        const allowedTypes: number[] = parentType === null
            ? V2_ROOT_KINDS.map(rootKind => V2_NODE_KINDS[rootKind].type)
            : parentType === ComponentType.Container
                ? V2_NODE_KINDS.container.canContain.map(childKind => V2_NODE_KINDS[childKind].type)
                : parentType === ComponentType.Section ? [ComponentType.TextDisplay] : [];
        if (!allowedTypes.includes(component.type)) return 'A component is in a position Discord does not allow.';

        if (component.type === ComponentType.Button) {
            const error = validateButton(component);
            if (error) return error;
        }
        if (component.type === ComponentType.TextDisplay) {
            const content = String(component.content || '');
            if (!content.trim()) return 'Text components need non-empty content.';
            if (content.length > 4000) return 'Text components cannot exceed 4,000 characters.';
        } else if (component.type === ComponentType.Section) {
            if (!Array.isArray(component.components) || component.components.length < 1 || component.components.length > 3) {
                return 'Sections need 1 to 3 text components.';
            }
            const accessory = component.accessory;
            if (accessory?.type === ComponentType.Thumbnail && !accessory.media?.url) return 'Section thumbnail accessories need an image URL.';
            if (![ComponentType.Thumbnail, ComponentType.Button].includes(accessory?.type as any)) return 'Sections need a thumbnail or button accessory.';
            if (accessory?.type === ComponentType.Button) {
                const error = validateButton(accessory);
                if (error) return error;
                componentCount++;
            }
            for (const child of component.components) {
                const error = inspect(child, ComponentType.Section);
                if (error) return error;
            }
        } else if (component.type === ComponentType.Container) {
            if (!Array.isArray(component.components) || component.components.length === 0 || component.components.length > 10) return 'Containers need 1 to 10 child components.';
            for (const child of component.components) {
                const error = inspect(child, ComponentType.Container);
                if (error) return error;
            }
        } else if (component.type === ComponentType.MediaGallery) {
            if (!Array.isArray(component.items) || component.items.length < 1 || component.items.length > 10) {
                return 'Media galleries need 1 to 10 images.';
            }
            if (component.items.some(item => !item.media?.url?.trim())) return 'Every gallery item needs an image URL.';
        } else if (component.type === ComponentType.File && !component.file?.url?.startsWith('attachment://')) return 'File components need an uploaded attachment.';
        return null;
    };
    for (const component of components) {
        const error = inspect(component, null);
        if (error) return error;
    }
    return null;
}
function collectAttachmentNames(config: MessageConfig): string[] {
    const fileNames = new Set<string>();
    const visit = (value: unknown) => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        const record = value as Record<string, unknown>;
        if (typeof record.url === 'string' && record.url.startsWith('attachment://')) {
            fileNames.add(record.url.slice('attachment://'.length));
        }
        Object.values(record).forEach(visit);
    };
    visit(config.embeds || []);
    visit(config.components || []);
    return [...fileNames];
}
function addEmbedFieldRow(list: HTMLElement, field: APIEmbedField = { name: '', value: '', inline: false }) {
    if (list.children.length >= 25) {
        showMessage('Discord embeds allow a maximum of 25 fields.', 'bg-yellow-500');
        return;
    }
    const row = document.createElement('div');
    row.classList.add('row', 'gap-2');
    row.innerHTML = `
        <input type="text" placeholder="Field Name" value="${field.name || ''}" class="field-name" data-field-name>
        <textarea placeholder="Field Value" class="field-value" data-field-value>${field.value || ''}</textarea>
        <span class="flex items-center gap-1 text-gray-300 text-sm self-start"><input type="checkbox" data-field-inline ${field.inline ? 'checked' : ''}>Inline</span>
        <button type="button" class="remove-btn self-start" data-remove-field-row>&times;</button>`;
    row.querySelector('[data-remove-field-row]')!.addEventListener('click', () => row.remove());
    list.appendChild(row);
}
function syncActiveEmbedFromForm(formContainer: HTMLFormElement) {
    if (!activeEmbedKey) return;

    const get = (name: string) => formContainer.querySelector<HTMLInputElement>(`[data-embed-field="${name}"]`);
    const embed: APIEmbed = {};

    const title = get('title')?.value.trim();
    const description = get('description')?.value.trim();
    const authorName = get('authorName')?.value.trim();
    if (title) embed.title = title;
    if (description) embed.description = description;
    if (authorName) embed.author = { name: authorName };

    const color = hexColorToInt(get('color')?.value ?? '');
    if (color !== undefined) embed.color = color; // Discord wants an int, not "#5865F2"

    const url = get('url')?.value.trim();
    if (url) embed.url = url;

    const image = get('image')?.value.trim();
    if (image) embed.image = { url: image };

    const thumbnail = get('thumbnail')?.value.trim();
    if (thumbnail) embed.thumbnail = { url: thumbnail };

    const footerText = get('footerText')?.value.trim();
    const footerIcon = get('footerIcon')?.value.trim();
    if (footerText || footerIcon) embed.footer = { text: footerText || '', icon_url: footerIcon || undefined };

    const timestampChecked = get('timestamp')?.checked;
    if (timestampChecked) embed.timestamp = new Date().toISOString();

    const fieldsList = formContainer.querySelector('[data-embed-fields-list]');
    if (fieldsList) {
        const fields = [...fieldsList.querySelectorAll<HTMLElement>('.row')]
            .map(row => ({
                name: row.querySelector<HTMLInputElement>('[data-field-name]')!.value.trim(),
                value: row.querySelector<HTMLTextAreaElement>('[data-field-value]')!.value.trim(),
                inline: row.querySelector<HTMLInputElement>('[data-field-inline]')!.checked,
            }))
            .filter(f => f.name || f.value);
        if (fields.length) embed.fields = fields;
    }

    const reactionsList = formContainer.querySelector('[data-reactions-list]');
    let reactionsPatch: { reactions?: ReactionRole[]; } = {};
    if (reactionsList) {
        const reactions = [...reactionsList.querySelectorAll<HTMLElement>('.row')]
            .map(row => ({
                emoji: row.querySelector<HTMLInputElement>('[data-reaction-emoji]')!.value.trim(),
                roleId: row.querySelector<HTMLSelectElement>('[data-reaction-role]')!.value,
            }))
            .filter(r => r.emoji && r.roleId);
        reactionsPatch = { reactions };
    }

    const channelid = formContainer.querySelector<HTMLSelectElement>('[data-embed-field="channelid"]')?.value.trim() || '';
    const existing: MessageConfig = messageConfigsDraft[activeEmbedKey] || { channelid: '', format: 'v1' };
    messageConfigsDraft[activeEmbedKey] = { ...existing, channelid, embeds: [embed], ...reactionsPatch, format: 'v1' };
}
function rerender(formContainer: HTMLElement) {
    formContainer.querySelector('#v2TreeRoot')!.innerHTML = '';
    const tree = (messageConfigsDraft[activeEmbedKey]!.components || []).map(v2ApiToNode).filter((n): n is V2Node => n !== null);
    const commit = (nextTree: V2Node[]) => {
        messageConfigsDraft[activeEmbedKey] = { ...messageConfigsDraft[activeEmbedKey], components: nextTree.map(v2NodeToApi), format: 'v2' };
    };
    tree.forEach((node, index) => formContainer.querySelector('#v2TreeRoot')!.appendChild(renderNode(node, tree, index, tree, commit, formContainer)));
    const rootButtons = formContainer.querySelector('#v2RootAddButtons')!;
    rootButtons.innerHTML = '';
    V2_ROOT_KINDS.forEach(kind => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'add-btn';
        button.textContent = `+ ${V2_NODE_KINDS[kind].label}`;
        button.addEventListener('click', () => { tree.push(createV2Node(kind)); commit(tree); rerender(formContainer); });
        rootButtons.appendChild(button);
    });
}
function renderNode(node: V2Node, parentArray: V2Node[], index: number, rootTree: V2Node[], commit: (tree: V2Node[]) => void, formContainer: HTMLElement): HTMLElement {
    const def = V2_NODE_KINDS[node.kind];
    const wrap = document.createElement('div');
    wrap.className = 'border border-gray-600 rounded-lg p-3 space-y-2 bg-gray-800';
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `<span class="font-semibold text-blue-300">${def.label}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => { parentArray.splice(index, 1); commit(rootTree); rerender(formContainer); });
    header.appendChild(removeBtn);
    wrap.appendChild(header);

    const renderFields = (targetNode: V2Node, target: HTMLElement) => V2_NODE_KINDS[targetNode.kind].fields.forEach(fieldDef => {
        const fieldWrap = document.createElement('div');
        fieldWrap.className = 'flex flex-col';
        const updateField = (value: string | boolean) => { targetNode.fields[fieldDef.key] = value; commit(rootTree); };
        if (fieldDef.input === 'checkbox') {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 text-gray-300';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!targetNode.fields[fieldDef.key];
            checkbox.addEventListener('change', () => updateField(checkbox.checked));
            label.append(checkbox, document.createTextNode(fieldDef.label));
            fieldWrap.appendChild(label);
        } else {
            const label = document.createElement('span');
            label.className = 'field-label';
            label.textContent = fieldDef.label;
            fieldWrap.appendChild(label);
            const control = fieldDef.input === 'textarea' ? document.createElement('textarea') : document.createElement(fieldDef.input === 'select' ? 'select' : 'input');
            control.className = 'field';
            if (control instanceof HTMLInputElement) {
                control.type = fieldDef.input === 'number' ? 'number' : 'text';
                control.placeholder = fieldDef.placeholder || '';
            }
            if (control instanceof HTMLSelectElement) {
                (fieldDef.options || []).forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option.value;
                    optionEl.textContent = option.label;
                    control.appendChild(optionEl);
                });
            }
            control.value = String(targetNode.fields[fieldDef.key] ?? '');
            control.addEventListener(fieldDef.input === 'select' ? 'change' : 'input', () => updateField(control.value));
            fieldWrap.appendChild(control);
            if (fieldDef.key === 'media_url') {
                const imageInput = document.createElement('input');
                imageInput.type = 'file';
                imageInput.accept = 'image/*';
                imageInput.className = 'field';
                imageInput.addEventListener('change', () => {
                    const selected = imageInput.files?.[0];
                    if (!selected) return;
                    const upload = queueImageUpload(selected);
                    if (!upload) return;
                    updateField(`attachment://${upload.name}`);
                    control.value = `attachment://${upload.name}`;
                });
                fieldWrap.appendChild(imageInput);
            }
        }
        target.appendChild(fieldWrap);
    });
    renderFields(node, wrap);

    if (node.kind === 'file') {
        const uploadWrap = document.createElement('div');
        uploadWrap.className = 'flex flex-col gap-1';
        const label = document.createElement('span');
        label.className = 'field-label';
        label.textContent = 'Upload file';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'field';
        const selectedName = document.createElement('span');
        selectedName.className = 'text-sm text-gray-400';
        selectedName.textContent = String(node.fields.file_url || '').replace(/^attachment:\/\//, '');
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const upload = queueEmbedUpload(file);
            node.fields.file_url = `attachment://${upload.name}`;
            selectedName.textContent = upload.name;
            commit(rootTree);
        });
        uploadWrap.append(label, fileInput, selectedName);
        wrap.appendChild(uploadWrap);
    }

    if (def.list === 'media') {
        const listWrap = document.createElement('div');
        listWrap.className = 'space-y-1';
        node.items.forEach((entry, entryIndex) => {
            const row = document.createElement('div');
            row.className = 'row gap-2';
            ['url', 'description'].forEach(key => {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'field';
                input.placeholder = key === 'url' ? 'https://...' : key;
                input.value = String((entry as any)[key] || '');
                input.addEventListener('input', () => { (entry as any)[key] = input.value; commit(rootTree); });
                row.appendChild(input);
                if (key === 'url') {
                    const imageInput = document.createElement('input');
                    imageInput.type = 'file';
                    imageInput.accept = 'image/*';
                    imageInput.className = 'field';
                    imageInput.addEventListener('change', () => {
                        const selected = imageInput.files?.[0];
                        if (!selected) return;
                        const upload = queueImageUpload(selected);
                        if (!upload) return;
                        entry.url = `attachment://${upload.name}`;
                        input.value = entry.url;
                        commit(rootTree);
                    });
                    row.appendChild(imageInput);
                }
            });
            const spoilerLabel = document.createElement('label');
            spoilerLabel.className = 'flex items-center gap-1 text-gray-300';
            const spoiler = document.createElement('input');
            spoiler.type = 'checkbox';
            spoiler.checked = entry.spoiler;
            spoiler.addEventListener('change', () => { entry.spoiler = spoiler.checked; commit(rootTree); });
            spoilerLabel.append(spoiler, document.createTextNode('Spoiler'));
            row.appendChild(spoilerLabel);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove-btn self-start';
            remove.textContent = '×';
            remove.addEventListener('click', () => {
                node.items.splice(entryIndex, 1);
                commit(rootTree); rerender(formContainer);
            });
            row.appendChild(remove);
            listWrap.appendChild(row);
        });
        wrap.appendChild(listWrap);
        const addEntry = document.createElement('button');
        addEntry.type = 'button';
        addEntry.className = 'add-btn';
        addEntry.textContent = '+ Add Media';
        addEntry.addEventListener('click', () => {
            node.items.push({ url: '', description: '', spoiler: false });
            commit(rootTree); rerender(formContainer);
        });
        wrap.appendChild(addEntry);
    }

    if (def.hasAccessory) {
        const accessoryType = document.createElement('select');
        accessoryType.className = 'field';
        accessoryType.innerHTML = '<option value="">-- Select accessory --</option><option value="thumbnail">Thumbnail</option><option value="button">Button</option>';
        accessoryType.value = node.accessory?.kind || '';
        accessoryType.addEventListener('change', () => {
            node.accessory = accessoryType.value ? createV2Node(accessoryType.value as V2Kind) : null;
            commit(rootTree); rerender(formContainer);
        });
        wrap.appendChild(accessoryType);
        if (node.accessory) {
            const accWrap = document.createElement('div');
            accWrap.className = 'flex flex-col border-t border-gray-700 pt-2';
            renderFields(node.accessory, accWrap);
            wrap.appendChild(accWrap);
        }
    }

    if (def.canContain.length) {
        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'pl-4 border-l border-gray-600 space-y-2';
        node.children.forEach((child, i) => childrenWrap.appendChild(renderNode(child, node.children, i, rootTree, commit, formContainer)));
        wrap.appendChild(childrenWrap);

        const atLimit = !!def.maxChildren && node.children.length >= def.maxChildren;
        if (!atLimit) {
            const addChildButtons = document.createElement('div');
            addChildButtons.className = 'flex gap-2 flex-wrap';
            def.canContain.forEach(k => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'add-btn';
                btn.textContent = `+ ${V2_NODE_KINDS[k].label}`;
                btn.addEventListener('click', () => { node.children.push(createV2Node(k)); commit(rootTree); rerender(formContainer); });
                addChildButtons.appendChild(btn);
            });
            wrap.appendChild(addChildButtons);
        }
    }

    return wrap;
}
function renderEmbedForm(container: HTMLElement) {
    const formContainer = container.querySelector('#embedFormFields') as HTMLFormElement;
    if (!activeEmbedKey || !messageConfigsDraft[activeEmbedKey]) {
        formContainer.innerHTML = '';
        return;
    }
    if (messageConfigsDraft[activeEmbedKey]!.format === 'v2') {
        // v2ApiToNode returns null for component types the builder can't edit; drop them instead of crashing the render
        const tree = (messageConfigsDraft[activeEmbedKey]!.components || []).map(v2ApiToNode).filter((n): n is V2Node => n !== null);
        formContainer.innerHTML = `
        <div class="flex flex-col gap-2">
            <span class="field-label text-red-400">Channel ID</span>
            <select class="field" data-embed-field="channelid">${buildEmbedChannelOptionsHtml(messageConfigsDraft[activeEmbedKey]!.channelid || '')}</select>
            <p class="text-sm text-yellow-400">Format can't be changed after creation — switching to Standard means deleting this entry and sending a new one.</p>
            <div id="v2TreeRoot" class="space-y-3 mt-2"></div>
            <div id="v2RootAddButtons" class="flex gap-2 flex-wrap"></div>
        </div>
    `;
        formContainer.querySelector('[data-embed-field="channelid"]')!.addEventListener('change', (e) => {
            messageConfigsDraft[activeEmbedKey] = { ...messageConfigsDraft[activeEmbedKey], channelid: (e.target as HTMLSelectElement).value.trim(), format: 'v2' };
        });
        rerender(container);
        messageConfigsDraft[activeEmbedKey] = { ...messageConfigsDraft[activeEmbedKey], components: tree.map(v2NodeToApi), format: "v2" };
            return;
    }
    const activeConfig = messageConfigsDraft[activeEmbedKey]!;
    messageConfigsDraft[activeEmbedKey] = { ...activeConfig, components: [] };
    const embed = messageConfigsDraft[activeEmbedKey]!.embeds?.[0] || blankEmbed();
    const visibleOptional = new Set<OptionalEmbedKey>(
        OPTIONAL_EMBED_FIELDS.filter(f => {
            if (f.key === 'fields') return (embed.fields?.length || 0) > 0;
            if (f.key === 'reactions') return (messageConfigsDraft[activeEmbedKey]!.reactions?.length || 0) > 0;
            if (f.key === 'footer') return !!(embed.footer?.text || embed.footer?.icon_url);
            if (f.key === 'image') return !!embed.image?.url;
            if (f.key === 'thumbnail') return !!embed.thumbnail?.url;
            return !!embed[f.key as keyof APIEmbed];
        }).map(f => f.key)
    );

    formContainer.innerHTML = `
                <div class="flex flex-col">
                    <div id="optionalFieldButtons" class="flex gap-2 flex-wrap"></div>
                    <span class="field-label text-red-400">Channel</span>
                    <select class="field" data-embed-field="channelid">${buildEmbedChannelOptionsHtml(messageConfigsDraft[activeEmbedKey]!.channelid || '')}</select>
                    <span class="field-label">Title</span>
                    <input type="text" class="field" data-embed-field="title" value="${embed.title || ''}">
                    <span class="field-label">Description</span>
                    <textarea class="field" data-embed-field="description">${embed.description || ''}</textarea>
                    <span class="field-label">Author Name</span>
                    <input type="text" class="field" data-embed-field="authorName" value="${embed.author?.name || ''}">
                    <div id="optionalFieldGroups" class="space-y-3"></div>
                </div>
            `;
    const drawButtons = (buttonsContainer: HTMLElement) => {
        buttonsContainer.innerHTML = OPTIONAL_EMBED_FIELDS
            .filter(f => !visibleOptional.has(f.key))
            .map(f => `<button type="button" class="add-btn" data-show-optional="${f.key}">+ ${f.label}</button>`)
            .join('');

        buttonsContainer.querySelectorAll<HTMLElement>('[data-show-optional]').forEach(btn => {
            btn.addEventListener('click', () => {
                visibleOptional.add(btn.dataset.showOptional as OptionalEmbedKey);
                drawButtons(buttonsContainer);
                drawGroups(groupsEl);
            });
        });
    };
    const buttonsEl = formContainer.querySelector('#optionalFieldButtons') as HTMLElement;
    const groupsEl = formContainer.querySelector('#optionalFieldGroups') as HTMLElement;
    const drawGroups = (groupsContainer: HTMLElement) => {
        groupsContainer.innerHTML = '';
        OPTIONAL_EMBED_FIELDS.filter(f => visibleOptional.has(f.key)).forEach(f => {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col';
            wrap.dataset.optionalGroup = f.key;
            wrap.innerHTML = `${f.render(embed)}<button type="button" class="remove-btn" data-hide-optional="${f.key}">Remove</button>`;
            groupsContainer.appendChild(wrap);
            wrap.querySelector('[data-hide-optional]')!.addEventListener('click', () => {
                visibleOptional.delete(f.key);
                drawButtons(buttonsEl);
                drawGroups(groupsEl);
            });

            if (f.key === 'fields') {
                const list = wrap.querySelector<HTMLElement>('[data-embed-fields-list]')!;
                (embed.fields || []).forEach(field => addEmbedFieldRow(list, field));
                const addFieldBtn = wrap.querySelector<HTMLButtonElement>('[data-add-embed-field]')!;
                addFieldBtn.disabled = list.children.length >= 25;
                addFieldBtn.classList.toggle('hidden', list.children.length >= 25);
                addFieldBtn.addEventListener('click', () => { addEmbedFieldRow(list) });
            }

            if (f.key === 'reactions') {
                const list = wrap.querySelector<HTMLElement>('[data-reactions-list]')!;
                (messageConfigsDraft[activeEmbedKey]!.reactions || []).forEach(r => {
                    if (list.children.length >= 20) {
                        showMessage('Discord messages can only track up to 20 distinct reactions.', 'bg-yellow-500');
                        return;
                    }
                    const optionsHtml = currentGuildRoles!
                        .map(role => `<option value="${role.id}" style="color:${roleColorHex(role.colors)}" ${role.id === r.roleId ? 'selected' : ''}>@${role.name}</option>`).join('');
                    const row = document.createElement('div');
                    row.classList.add('row', 'gap-2');
                    row.innerHTML = `
                             <input type="text" placeholder="Emoji" value="${r.emoji || ''}" class="field-name" data-reaction-emoji style="max-width:90px">
                            <select class="field" data-reaction-role>
                            <option value="">-- Select a role --</option>${optionsHtml}
                            </select>
                            <button type="button" class="remove-btn self-start" data-remove-reaction-row>&times;</button>`;
                    row.querySelector('[data-remove-reaction-row]')!.addEventListener('click', () => row.remove());
                    list.appendChild(row);
                });
                wrap.querySelector('[data-add-reaction]')!.addEventListener('click', () => {
                    if (list.children.length >= 20) {
                        showMessage('Discord messages can only track up to 20 distinct reactions.', 'bg-yellow-500');
                        return;
                    }
                    const optionsHtml = currentGuildRoles!
                        .map(role => `<option value="${role.id}" style="color:${roleColorHex(role.colors)}">@${role.name}</option>`).join('');
                    const row = document.createElement('div');
                    row.classList.add('row', 'gap-2');
                    row.innerHTML = `
                                <input type="text" placeholder="Emoji" value="" class="field-name" data-reaction-emoji style="max-width:90px">
                                <select class="field" data-reaction-role>
                                <option value="">-- Select a role --</option>
                                ${optionsHtml}
                                </select>
                                <button type="button" class="remove-btn self-start" data-remove-reaction-row>&times;</button>`;
                    row.querySelector('[data-remove-reaction-row]')!.addEventListener('click', () => row.remove());
                    list.appendChild(row);
                });
            }

            if (f.key === 'image' || f.key === 'thumbnail') {
                const imageInput = wrap.querySelector<HTMLInputElement>(`[data-embed-image-upload="${f.key}"]`)!;
                imageInput.addEventListener('change', () => {
                    const selected = imageInput.files?.[0];
                    if (!selected) return;
                    const upload = queueImageUpload(selected);
                    if (!upload) return;
                    const urlInput = wrap.querySelector<HTMLInputElement>(`[data-embed-field="${f.key}"]`)!;
                    urlInput.value = `attachment://${upload.name}`;
                    syncActiveEmbedFromForm(formContainer);
                });
            }

        });
    };
    drawButtons(buttonsEl);
    drawGroups(groupsEl);
    formContainer.addEventListener('input', () => syncActiveEmbedFromForm(formContainer));
    formContainer.addEventListener('change', () => syncActiveEmbedFromForm(formContainer));
}
const MESSAGE_REASON_CATEGORIES: {key: string, label: string}[] = [
    { key: 'hasInvite', label: 'Discord Invite Link' },
    { key: 'everyonePing', label: '@everyone / @here Ping' },
    { key: 'generalspam', label: 'General Spam' },
    { key: 'duplicateSpam', label: 'Duplicate Message Spam' },
    { key: 'mediaViolation', label: 'Media Violation' },
    { key: 'ForbiddenWords', label: 'Forbidden Words' },
    { key: 'BannedWords', label: 'Banned Words' },
    { key: 'capSpam', label: 'Excessive Caps' },
    { key: 'maskedLinks', label: 'Masked Links' },
];
function getMessageReasonsWeightsValues(container: HTMLElement) {
    const result: Record<string, ReasonWeight> = {};
    container.querySelectorAll<HTMLElement>('[data-mrw-key]').forEach(row => {
        const key = row.dataset.mrwKey;
        const reason = row.querySelector<HTMLInputElement>('[data-mrw-reason]')!.value.trim();
        const weight = Number(row.querySelector<HTMLInputElement>('[data-mrw-weight]')!.value);
        if (key && reason && !Number.isNaN(weight)) result[key] = { reason, weight };
    });
    return result;
}
type SectionValue = string | number | boolean | string[];
function getSectionValues(container: HTMLElement, type: SectionType) {
    const values: Record<string, SectionValue> = {};
    const nameSelector = type === 'automod' ? '[data-automod-name]' : '[data-channel-name]';
    const valueSelector = type === 'automod' ? '[data-automod-value]' : '[data-channel-id]';

    container.querySelectorAll('div').forEach(div => {
        const nameElement = div.querySelector<HTMLElement>(nameSelector);
        const valueElement = div.querySelector<HTMLInputElement | HTMLSelectElement>(valueSelector);
        const name = nameElement instanceof HTMLInputElement
            ? nameElement.value.trim()
            : nameElement?.dataset[type === 'automod' ? 'automodName' : 'channelName']?.trim();
        if (!name || !valueElement) return;

        if (type === 'reaction' && valueElement instanceof HTMLSelectElement) {
            const selected = Array.from(valueElement.selectedOptions, option => option.value);
            values[name] = selected.length > 1 ? selected : selected[0] || '';
        } else if (type === 'automod') {
            const raw = valueElement.value.trim();
            values[name] = raw === 'true' ? true
                : raw === 'false' ? false
                    : raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
        } else {
            values[name] = valueElement.value.trim();
        }
    });
    return values;
}
function createChannelInput(container: HTMLElement, name = '', value: string | string[] = '', type: SectionType) {
        const div = document.createElement('div');
        div.classList.add('row');

        const scalarValue = Array.isArray(value) ? value.join(',') : value;
        const isReaction = type === 'reaction';
        const isResponse = type === 'response';
        const namePlaceholder = isReaction ? 'Reaction' : isResponse ? 'Trigger' : 'Channel Name';

    if (isReaction) {
        const selectedIds = Array.isArray(value) ? value : (value ? value.split(',').map(v => v.trim()) : []);
        const optionsHtml = currentGuildRoles
            .map(role => `<option value="${role.id}" style="color:${roleColorHex(role.colors)}" ${selectedIds.includes(role.id) ? 'selected' : ''}>@${role.name}</option>`).join('');

        div.innerHTML = `
        <input type="text" placeholder="${namePlaceholder}" value="${name}" class="channel-row" data-channel-name="${type}">
        <select class="field" data-channel-id="${type}" multiple size="4">${optionsHtml}</select>
        <button class="remove-btn self-start">&times;</button>`;
    } else {
        const idPlaceholder = isResponse ? 'Response text' : 'Channel ID';
        const idField = type === 'public'
            ? `<select class="field" data-channel-id="${type}">${buildChannelOptionsHtml(scalarValue)}</select>`
            : `<input type="text" placeholder="${idPlaceholder}" value="${scalarValue}" class="field" data-channel-id="${type}">`;
        div.innerHTML = `
                    <input type="text" placeholder="${namePlaceholder}" value="${name}" class="channel-row" data-channel-name="${type}">
                    ${idField}
                        <button class="remove-btn">&times;</button>`;
    }

        div.querySelector<HTMLElement>('.remove-btn')!.onclick = () => div.remove();
        container.appendChild(div);
}
function createReasonWeightInput(container: HTMLElement, ruleOptions: AutomodRule[], key = '', reason = '', weight = 1) {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.dataset.rwKey = key;

        const usedIds = new Set(
            [...container.querySelectorAll<HTMLElement>('[data-rw-key]')].map(node => node.dataset.rwKey)
        );
        const optionsHtml = ruleOptions
            .filter(r => r.id === key || !usedIds.has(r.id))
            .map(r => `<option value="${r.id}" ${r.id === key ? 'selected' : ''}>${r.name}</option>`)
            .join('');

        div.innerHTML = `
        <select class="field" data-rw-ruleid>
            <option value="">-- Select Rule --</option>
            ${optionsHtml}
        </select>
        <input type="text" placeholder="Reason" value="${reason}" class="field" data-rw-reason>
        <input type="number" step="1" placeholder="Weight" value="${weight}" class="field" data-rw-weight>
        <button class="remove-btn">&times;</button>`;

        div.querySelector('select')!.addEventListener('change', (e) => { div.dataset.rwKey = (e.target as HTMLSelectElement).value; });
        div.querySelector<HTMLElement>('.remove-btn')!.onclick = () => div.remove();
        container.appendChild(div);
}
// General Channels is a flat array of channel IDs in Mongo (no key:value pairs).
function renderArraySection(container: HTMLElement, items: string[]) {
        container.innerHTML = '';
    (items || []).forEach((value: string) => createArrayInput(container, value));
}
function createArrayInput(container: HTMLElement, value: string = '') {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.innerHTML = `
    <select class="field" data-array-value="channel">${buildChannelOptionsHtml(value)}</select>
    <button class="remove-btn">&times;</button>`;
        div.querySelector<HTMLElement>('.remove-btn')!.onclick = () => div.remove();
        container.appendChild(div);
}
function getArraySectionValues(container: HTMLElement) {
        const values: string[] = [];
    container.querySelectorAll<HTMLSelectElement>('[data-array-value]').forEach(node => {
        const v = node.value.trim();
            if (v) values.push(v);
        });
        return values;
}
function getReasonsAndWeightsValues(container: HTMLElement) {
        const result: Record<string,{reason: string, weight: number}> = {};
        container.querySelectorAll<HTMLSelectElement>('[data-rw-ruleid]').forEach(select => {
            const row = select.closest('div')!;
            const ruleId = select.value;
            const reason = row.querySelector<HTMLInputElement>('[data-rw-reason]')!.value.trim();
            const weight = Number(row.querySelector<HTMLInputElement>('[data-rw-weight]')!.value);
            if (ruleId && reason && !Number.isNaN(weight)) result[ruleId] = { reason, weight };
        });
        return result;
}
function confirmModal(message: string) {
    return new Promise<boolean>((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md space-y-4 text-center">
                <p class="text-lg text-gray-200">${message}</p>
                <div class="flex justify-center gap-4">
                    <button id="confirmYes" class="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
                    <button id="confirmNo" class="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">No</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('confirmYes')!.addEventListener('click', () => { modal.remove(); resolve(true); });
        document.getElementById('confirmNo')!.addEventListener('click', () => { modal.remove(); resolve(false); });
    });
}
function getFormValues() {
    const { modChannelsSection, publicChannelsSection, GeneralChannelsSection, reactionsSection, automodSection, Responses, adminRoleInput, modRoleInput, jrRoleInput, reasonsWeightsSection, messageReasonsWeightsSection, } = elements;

    const modChannels = getSectionValues(modChannelsSection, 'mod');
    const publicChannels = getSectionValues(publicChannelsSection, 'public');
    const generalchannels = getArraySectionValues(GeneralChannelsSection);
    const reactions = getSectionValues(reactionsSection, 'reaction');
    const automodThresholds = getSectionValues(automodSection, 'automod');
    const messagereasonsandweights = getMessageReasonsWeightsValues(messageReasonsWeightsSection);
    const automodreasonsandweights = getReasonsAndWeightsValues(reasonsWeightsSection);
    const responses = getSectionValues(Responses, 'response');
    const staffroles = [adminRoleInput.value.trim(), modRoleInput.value.trim(), jrRoleInput.value.trim()];

    const config = { modChannels, publicChannels, generalchannels, reactions, automodsettings: { ...automodThresholds, messagereasonsandweights, automodreasonsandweights, }, responses, staffroles };
    return config;
}
function showMessage(message: string, colorClass: string) {
    const { messageBox } = elements;
    messageBox.textContent = message;
    messageBox.className = `text-center p-3 rounded-lg hidden opacity-transition duration-150 ${colorClass}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('opacity-0');
        messageBox.addEventListener('transitionend', () => {
            messageBox.classList.add('hidden');
        }, { once: true });
    }, 5000);
}
// --- Guild list / selection ------------------------------------------------

async function refreshGuildSelect() {
    const { guildSelect, addServerBtn, deleteConfigBtn, loginBtn, authStatus, logoutBtn, guilds } = elements;
    guildSelect.innerHTML = '<option value="">-- Select a Guild --</option>';
    const response = await fetch(`/api/auth/me`, { credentials: 'include' });
    const res: { user: APIUser } = await response.json();
    if (res.user) {
        guilds.classList.remove('hidden')
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        authStatus.textContent = `Logged in as ${res.user.username}`;
    } else {
        guilds.classList.add('hidden')
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        addServerBtn.classList.remove('hidden');
        deleteConfigBtn.classList.add('hidden');
        authStatus.textContent = 'Not logged in';
        return;
    }
    try {
        const resGuilds = await fetch(`/api/guilds`, { credentials: 'include' });
        if (!resGuilds.ok) throw new Error(`Failed to list guilds (${resGuilds.status})`);
        if (resGuilds.status === 401) {
            elements.loginBtn.classList.remove('hidden');
            elements.logoutBtn.classList.add('hidden');
            elements.authStatus.textContent = 'Not logged in'; return;
        }
        const summaries: GuildSummary[] = await resGuilds.json();
        if (summaries.length === 0) {
            showMessage('No guilds found where you hold a staff role.', 'bg-yellow-500');
            await loadSelectedGuild(null);
            return;
        }
        summaries.sort((a, b) => a.guildId.localeCompare(b.guildId))
            .forEach(g => {
                const option = document.createElement('option');
                option.value = g.guildId;
                option.textContent = `${g.name} (${g.role})`;
                guildSelect.appendChild(option);
            });
        addServerBtn.classList.remove('hidden');
        guildSelect.value = summaries.some(g => g.guildId === guildSelect.value) ? guildSelect.value : summaries[0]!.guildId;;
    } catch (error) {
        showMessage(`Could not reach the config API: ${errMsg(error)}`, 'bg-red-500');
        return;
    }
    await loadSelectedGuild(guildSelect.value || null);
}
function setGuildRoles(roles: APIRole[]) {
    rolePickers.admin.setRoles(roles);
    rolePickers.mod.setRoles(roles);
    rolePickers.jr.setRoles(roles);
}
async function loadSelectedGuild(guildId: string | null = null) {
    const { deleteConfigBtn, addServerBtn, orText, saveConfigBtn, buttonColumnText, channelsContainer, adminRoleInput, modRoleInput, jrRoleInput } = elements;
    deleteConfigBtn.classList.toggle('hidden', !guildId);
    saveConfigBtn.classList.toggle('hidden', !guildId);
    addServerBtn.classList.toggle('hidden', !guildId)
    orText.classList.toggle('hidden', !guildId)
    if (!guildId) {
        currentGuildChannels = [];
        currentGuildRoles = [];
        currentAutomodRules = [];
        addServerBtn.classList.remove('hidden');
        orText.classList.remove('hidden');
        buttonColumnText.textContent = 'Please select a guild or invite the bot';
        channelsContainer.classList.add('hidden')
        return;
    } else {
        addServerBtn.classList.add('hidden');
        orText.classList.add('hidden');
        channelsContainer.classList.remove('hidden')
        saveConfigBtn.classList.remove('hidden');
        deleteConfigBtn.classList.remove('hidden');
        buttonColumnText.textContent = '';
        try {
            const res = await fetch(`/api/guilds/${encodeURIComponent(guildId)}`, { method: 'GET', credentials: 'include', cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load guild ${guildId} (${res.status})`);
            const doc: GuildConfigDoc = await res.json();
            currentAutomodRules = doc.rules
            currentGuildChannels = doc.guildChannels || [];
            staffRoles = doc.staffRoles
            currentGuildRoles = doc.guildRoles!
            const canEdit = doc._viewerRole === 'admin' || doc._viewerRole === 'owner';
            setDisabledState(saveConfigBtn, !canEdit);
            saveConfigBtn.title = canEdit ? '' : 'Admin role required';
            setDisabledState(deleteConfigBtn, !canEdit);
            deleteConfigBtn.title = canEdit ? '' : 'Admin role required';
            setGuildRoles(staffRoles)
            renderConfig(doc);
            adminRoleInput.value = doc.staffroles![0] ?? '';
            modRoleInput.value = doc.staffroles![1] ?? '';
            jrRoleInput.value = doc.staffroles![2] ?? '';
        } catch (error) {
            showMessage(`Failed to load config: ${errMsg(error)}`, 'bg-red-500');
        }
    }

}
// --- Config rendering ------------------------------------------------------

function renderConfig(config: GuildConfigDoc) {
    const sections: Array<{ key: 'modChannels' | 'publicChannels' | 'reactions' | 'responses', elementKey: keyof typeof elements, type: SectionType }> = [
        { key: 'modChannels', elementKey: 'modChannelsSection', type: 'mod' },
        { key: 'publicChannels', elementKey: 'publicChannelsSection', type: 'public' },
        { key: 'reactions', elementKey: 'reactionsSection', type: 'reaction' },
        { key: 'responses', elementKey: 'Responses', type: 'response' },
    ];
    sections.forEach(({ key, elementKey, type }) => {
        renderSection(elements[elementKey], config[key] || {}, type);
    })
    // automodsettings is now consolidated: flat thresholds + two nested reason/weight maps.
    const { messagereasonsandweights, automodreasonsandweights, ...automodThresholds } = config.automodsettings ?? ({} as AutomodSettings);
    renderSection(elements.automodSection, automodThresholds, 'automod');
    renderMessageReasonsWeightsSection(elements.messageReasonsWeightsSection, elements.addMessageReasonButtons, messagereasonsandweights || {});
    renderReasonsAndWeightsSection(elements.reasonsWeightsSection, automodreasonsandweights, currentAutomodRules);
    renderArraySection(elements.GeneralChannelsSection, config.generalchannels || []);
    renderEmbedSection(elements.EmbedSection, config.messageConfigs || {});
}
function renderSection(container: HTMLElement, data: Record<string, unknown>, type: SectionType) {
    container.innerHTML = '';
    for (const key in data) {
        if (!Object.hasOwnProperty.call(data, key)) continue;

        if (type === 'mod') {
            const div = document.createElement('div');
            div.classList.add('row', 'relative');
            div.innerHTML = `
                    <span class="field-label" data-channel-name="${key}">${key}</span>
                    <select class="field" data-channel-id="${key}">${buildChannelOptionsHtml(data[key] as string)}</select>
                `;
            div.querySelector('span')!.dataset.channelName = key;
            container.appendChild(div);
        } else if (type === 'automod') {
            const div = document.createElement('div');
            div.classList.add('row', 'relative');
            div.innerHTML = `
                    <span class="field-label" data-automod-name="${key}">${key}</span>
                    <input type="text" value="${data[key]}" class="field" data-automod-value="">
                `;
            container.appendChild(div);
        } else {
            createChannelInput(container, key, data[key] as string | string[], type);
        }
    }
}
function renderReasonsAndWeightsSection(container: HTMLElement, reasonsandweights: Record<string, ReasonWeight> | undefined, ruleOptions: AutomodRule[]) {
    container.innerHTML = '';
    Object.entries(reasonsandweights || {}).forEach(([key, obj]) =>
        createReasonWeightInput(container, ruleOptions, key, obj.reason, obj.weight)
    );
}
function renderMessageReasonsWeightsSection(container: HTMLElement, buttonsContainer: HTMLElement, data: Record<string, ReasonWeight>) {
    container.innerHTML = '';
    const active = new Set(Object.keys(data || {}));

    function addRow(key: string, reason = '', weight = 1) {
        const cat = MESSAGE_REASON_CATEGORIES.find(c => c.key === key);
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.dataset.mrwKey = key;
        div.innerHTML = `
            <span class="field-label" style="min-width:200px">${cat ? cat.label : key}</span>
            <input type="text" placeholder="Reason" value="${reason}" class="field" data-mrw-reason>
            <input type="number" step="1" placeholder="Weight" value="${weight}" class="field" data-mrw-weight>
            <button class="remove-btn">&times;</button>`;
        div.querySelector<HTMLElement>('.remove-btn')!.onclick = () => {
            div.remove();
            active.delete(key);
            drawButtons();
        };
        container.appendChild(div);
    }

    function drawButtons() {
        buttonsContainer.innerHTML = MESSAGE_REASON_CATEGORIES
            .filter(c => !active.has(c.key))
            .map(c => `<button type="button" class="add-btn" data-add-message-reason="${c.key}">+ ${c.label}</button>`)
            .join('');
        buttonsContainer.querySelectorAll<HTMLElement>('[data-add-message-reason]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.addMessageReason!;
                active.add(key);
                addRow(key);
                drawButtons();
            });
        });
    }

    MESSAGE_REASON_CATEGORIES.forEach(c => {
        if (active.has(c.key)) addRow(c.key, data[c.key]?.reason || '', data[c.key]?.weight ?? 1);
    });
    drawButtons();
}
function renderEmbedSection(container: HTMLElement, messageConfigs: Record<string, MessageConfig>) {
    messageConfigsDraft = structuredClone(messageConfigs || {});
    const keys = Object.keys(messageConfigsDraft);
    activeEmbedKey = keys.includes(activeEmbedKey) ? activeEmbedKey : (keys[0] || '');

    container.innerHTML = `
       <div class="flex flex-wrap items-center gap-2">
        <select id="embedSelect" class="field"></select>
        <button type="button" id="deleteEmbedBtn" class="remove-btn" style="max-width:200px">Delete</button>
        <span id="orSeparator" class="text-gray-300 font-semibold shrink-0">- or -</span>
        <button type="button" id="createEmbedBtn" class="add-btn" style="max-width:200px">+ New Embed</button>
        <button type="button" id="saveEmbedBtn" class="action-btn bg-green-500 hover:bg-green-600" style="max-width:200px">Save Embed</button>
        <button type="button" id="pushEmbedBtn" class="action-btn bg-purple-500 hover:bg-purple-600" style="max-width:220px">Push to Discord</button>
    </div>
    <p id="v1info" class="text-sm text-gray-400 mt-2">At least one of Title, Description, or Author Name is required.</p>
    <p class="text-xs text-yellow-400 mt-1 hidden" id="pushEmbedHint">Push saves this embed's current form contents, then sends or updates its Discord message. Use Save separately to persist other configuration changes.</p>
    <div id="embedFormFields" class="space-y-4 mt-2"></div>
    `;
    const v1info = container.querySelector('#v1info')!;
    const select = container.querySelector<HTMLSelectElement>('#embedSelect')!;
    const deleteBtn = container.querySelector('#deleteEmbedBtn')as HTMLButtonElement ;
    const orSeparator = container.querySelector('#orSeparator')!;
    const createBtn = container.querySelector('#createEmbedBtn')as HTMLButtonElement;
    const saveEmbedBtn = container.querySelector('#saveEmbedBtn') as HTMLButtonElement;
    const pushBtn = container.querySelector('#pushEmbedBtn')as HTMLButtonElement;
    const pushHint = container.querySelector('#pushEmbedHint')!;
    const hasEmbeds = keys.length > 0;
    const isV1 = !!activeEmbedKey && messageConfigsDraft[activeEmbedKey]?.format !== 'v2';
    v1info.classList.toggle('hidden', !isV1);
    setDisabledState(select, !hasEmbeds);
    select.classList.toggle('hidden', !hasEmbeds);
    setDisabledState(deleteBtn, !hasEmbeds);
    setDisabledState(saveEmbedBtn, !hasEmbeds);
    setDisabledState(pushBtn, !hasEmbeds);
    deleteBtn.classList.toggle('hidden', !hasEmbeds);
    saveEmbedBtn.classList.toggle('hidden', !hasEmbeds);
    orSeparator.classList.toggle('hidden', !hasEmbeds);
    pushBtn.classList.toggle('hidden', !hasEmbeds);
    select.innerHTML = hasEmbeds
        ? keys.map(k => `<option value="${k}" ${k === activeEmbedKey ? 'selected' : ''}>${k}</option>`).join('')
        : '<option value="">-- No embeds yet, create one --</option>';

    select.addEventListener('change', () => {
        activeEmbedKey = select.value;
        renderEmbedForm(container);
    });
    saveEmbedBtn.addEventListener('click', async () => {
        if (!activeEmbedKey) return;
        setDisabledState(saveEmbedBtn, true);
        try {
            const res = await fetch('/api/embed', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ guildId: elements.guildSelect.value, embedName: activeEmbedKey, config: messageConfigsDraft[activeEmbedKey] }),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || `Failed to save embed (${res.status})`);
            showMessage(`Saved embed "${activeEmbedKey}" to database.`, 'bg-green-500');
        } catch (error) {
            showMessage(`Save failed: ${errMsg(error)}`, 'bg-red-500');
        } finally {
            setDisabledState(saveEmbedBtn, false);
        }
    });
    pushBtn.addEventListener('click', async () => {
        if (!activeEmbedKey) return;
        const config = messageConfigsDraft[activeEmbedKey];
        if (!config?.channelid) { showMessage('Set a Channel before pushing.', 'bg-yellow-500'); return; }

        const componentError = config.format === 'v2' ? validateV2Components(config.components || []) : null;
        if (componentError) { showMessage(componentError, 'bg-yellow-500'); return; }
        const fileNames = collectAttachmentNames(config);
        if (fileNames.length > 10) { showMessage('Discord messages can include at most 10 uploaded files.', 'bg-yellow-500'); return; }
        if (!config.messageId) {
            const missingUpload = fileNames.find(name => !v2FileUploads.has(`${activeEmbedKey}\0${name}`));
            if (missingUpload) { showMessage(`Select the file for "${missingUpload}" before creating this message.`, 'bg-yellow-500'); return; }
        }
        const hasContent = config.format === 'v2'
            ? !!config.components?.length
            : !!(config.embeds?.[0]?.title?.trim() || config.embeds?.[0]?.description?.trim() || config.embeds?.[0]?.author?.name?.trim());
        if (!hasContent) {
            showMessage(config.format === 'v2' ? 'You need to add some components first' : 'Add a Title, Description, or Author Name before pushing.', 'bg-yellow-500');
            return;
        }

        setDisabledState(pushBtn, true);
        pushHint.classList.remove('hidden');
        try {
            const formData = new FormData();
            formData.append('guildId', elements.guildSelect.value);
            formData.append('embedName', activeEmbedKey);
            formData.append('config', JSON.stringify(config));
            const sentFiles: string[] = [];
            fileNames.forEach(name => {
                const file = v2FileUploads.get(`${activeEmbedKey}\0${name}`);
                if (file) { formData.append('files', file, file.name); sentFiles.push(name); }
            });
            const res = await fetch(`/api/embed`, { method: 'POST', credentials: 'include', body: formData, });
            const responseText = await res.text();
            let result: { messageId?: string; error?: string };
            try {
                result = responseText ? JSON.parse(responseText) : {};
            } catch {
                throw new Error(`Push API returned invalid JSON: ${responseText.slice(0, 160) || '(empty response)'}`);
            }
            if (!res.ok) throw new Error(result.error || `Failed to push embed (${res.status})`);
            if (!result.messageId) throw new Error(result.error || 'Push API did not return a Discord message ID.');
            config.messageId = result.messageId;
            messageConfigsDraft[activeEmbedKey] = config;
            sentFiles.forEach(name => v2FileUploads.delete(`${activeEmbedKey}\0${name}`));
            showMessage('Updated Discord message.', 'bg-green-500');
        } catch (error: any) {
            showMessage(`Push failed: ${error.message}`, 'bg-red-500');
        } finally {
            setDisabledState(pushBtn, false);
            pushHint.classList.add('hidden');
        }
    });
    createBtn.addEventListener('click', () => {
        let nameInput = container.querySelector('#newEmbedNameInput') as HTMLInputElement;

        // First click: reveal the name input, format switch, and warning; switch the button into "confirm" mode.
        if (!nameInput) {
            nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.id = 'newEmbedNameInput';
            nameInput.className = 'field';
            nameInput.placeholder = 'new-embed-key';
            nameInput.style.maxWidth = '200px';
            createBtn.insertAdjacentElement('beforebegin', nameInput);

            const formatSelect = document.createElement('select');
            formatSelect.id = 'newEmbedFormatSelect';
            formatSelect.className = 'field';
            formatSelect.style.maxWidth = '160px';
            formatSelect.innerHTML = `
                <option value="v1">Standard Embed</option>
                <option value="v2">Components V2</option>
            `;
            nameInput.insertAdjacentElement('afterend', formatSelect);

            const warning = document.createElement('p');
            warning.id = 'newEmbedFormatWarning';
            warning.className = 'text-sm text-yellow-400 w-full mt-1';
            warning.textContent = "Format can't be changed after creation. Switching a message between Standard and Components V2 later means deleting the existing message on Discord and sending a new one — the bot can't convert it in place.";
            warning.style.order = '99'
            formatSelect.insertAdjacentElement('afterend', warning);
            nameInput.focus();
            createBtn.textContent = 'Confirm';
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); createBtn.click(); }
            });
            return;
        }

        // Second click (or Enter): actually create the embed.
        const name = nameInput.value.trim();
        if (!name) { showMessage('Enter a key name for the new embed.', 'bg-yellow-500'); return; }
        if (messageConfigsDraft[name]) { showMessage(`"${name}" already exists.`, 'bg-yellow-500'); return; }

        const format = container.querySelector('#newEmbedFormatSelect') as HTMLSelectElement
        messageConfigsDraft[name] = format.value === 'v2'
            ? { channelid: '', format: 'v2', components: [] }
            : { channelid: '', format: 'v1', embeds: [blankEmbed()] };
        activeEmbedKey = name;
        renderEmbedSection(container, messageConfigsDraft);
    });

    deleteBtn.addEventListener('click', async () => {
        if (!activeEmbedKey) return;
        const key = activeEmbedKey;
        setDisabledState(deleteBtn, true);
        try {
            const res = await fetch(`/api/embed/${encodeURIComponent(elements.guildSelect.value ?? '')}/${encodeURIComponent(activeEmbedKey)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Failed to delete embed "${key}" (${res.status})`);
            }
            delete messageConfigsDraft[key];
            activeEmbedKey = '';
            renderEmbedSection(container, messageConfigsDraft);
            showMessage('Embed deleted.', 'bg-green-500');
        } catch (error) {
            showMessage(`Delete failed: ${errMsg(error)}`, 'bg-red-500');
        } finally {
            setDisabledState(deleteBtn, false);
        }
    });

    renderEmbedForm(container);


}
// --- Tabs ------------------------------------------------------------------
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn:not(.subtab-btn)');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabBar = document.getElementById('tabBar')!;
    const hamburgerBtn = document.getElementById('hamburgerBtn')!;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('tab-btn-active'));
            tabContents.forEach(content => content.classList.add('hidden'));

            const targetId = tab.getAttribute('data-target')!;
            document.getElementById(targetId)!.classList.remove('hidden');
            tab.classList.add('tab-btn-active');

            // Close the mobile dropdown after picking a tab. No-op on desktop —
            // the CSS media query keeps #tabBar visible regardless of this class.
            tabBar.classList.remove('mobile-open');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
        });
    });

    hamburgerBtn.addEventListener('click', () => {
        const isOpen = tabBar.classList.toggle('mobile-open');
        hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.getElementById('modChannelsTab')!.click();
}

function initSubtabs() {
    const subtabs = document.querySelectorAll('.subtab-btn');
    const subtabContents = document.querySelectorAll('.subtab-content');

    subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            subtabs.forEach(item => item.classList.remove('tab-btn-active'));
            subtabContents.forEach(content => content.classList.add('hidden'));

            const targetId = tab.getAttribute('data-subtarget');
            document.getElementById(targetId!)!.classList.remove('hidden');
            tab.classList.add('tab-btn-active');
        });
    });
}
// --- Wiring --------------------------------------------------------------------
elements.guildSelect!.addEventListener('change', async () => { await loadSelectedGuild(elements.guildSelect.value) });
elements.loginBtn!.addEventListener('click', () => { window.location.href = `/api/auth/discord/login`; });
elements.logoutBtn!.addEventListener('click', async () => {
    await fetch(`/api/auth/logout`, { method: 'POST', credentials: 'include' });
    const { loginBtn, logoutBtn, authStatus, saveConfigBtn, channelsContainer } = elements;
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    saveConfigBtn.classList.add('hidden');
    channelsContainer.classList.add('hidden')
    authStatus.textContent = 'Not logged in';
    elements.guildSelect!.value = '';
    elements.guilds.classList.add('hidden')
    await refreshGuildSelect();
});
elements.addPublicChannelBtn.addEventListener('click', () => createChannelInput(elements.publicChannelsSection, '', '', 'public'));
elements.addMediaBtn.addEventListener('click', () => createArrayInput(elements.GeneralChannelsSection, ''));
elements.addReactionBtn.addEventListener('click', () => createChannelInput(elements.reactionsSection, '', '', 'reaction'));
elements.addStringBtn.addEventListener('click', () => createChannelInput(elements.Responses, '', '', 'response'));
elements.addReasonWeightBtn.addEventListener('click', () => createReasonWeightInput(elements.reasonsWeightsSection, currentAutomodRules, '', '', 1));
elements.saveConfigBtn.addEventListener('click', async () => {
    if (!elements.adminRoleInput!.value.trim() || !elements.modRoleInput!.value.trim()) {
        showMessage('Admin and Mod Role IDs are both required (Staff Roles tab).', 'bg-red-500');
        return;
    }
    const config = getFormValues();
    try {
        const res = await fetch(`/api/guilds/${encodeURIComponent(elements.guildSelect.value)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Failed to save guild ${elements.guildSelect.value} (${res.status})`);
        }
        showMessage('Saved to database!', 'bg-green-500');
    }
    catch (error) { showMessage(`Save failed: ${errMsg(error)}`, 'bg-red-500'); }
});
elements.deleteConfigBtn.addEventListener('click', async () => {
    const shouldDelete = await confirmModal(`Are you sure you want to permanently delete the config for Guild ID: ${elements.guildSelect.value} from the database?`);
    if (!shouldDelete) return;
    const res = await fetch(`/api/guilds/${encodeURIComponent(elements.guildSelect.value)}`, { method: 'DELETE', credentials: 'include', });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to delete guild ${elements.guildSelect.value} (${res.status})`);
    }
    showMessage('Configuration deleted from database.', 'bg-green-500');
    elements.guildSelect!.value = '';
    await refreshGuildSelect();
});

elements.addServerBtn.addEventListener('click', () => { window.open('https://discord.com/oauth2/authorize?client_id=1420927654701301951&permissions=1202859404454&integration_type=0&scope=bot+applications.commands', '_blank', 'noopener,noreferrer'); });
initTabs();
initSubtabs();
await refreshGuildSelect();
