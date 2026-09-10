const userCache = new Map();
let currentConfig = null;// the config currently loaded/rendered
let currentGuildId = '';
let currentUser = null;            // { userId, username } | null
let currentRole = null;// 'admin' | 'mod' | null
let messageConfigsDraft = {};// working copy of ALL embeds; only the selected one is shown in the form at a time
let activeEmbedKey = '';
let guildRoles = new Map();// guildId -> 'admin' | 'mod'
let currentAutomodRules = [];
let currentGuildRoles = [];
let currentGuildChannels = [];
const guilds = new Map()
const elements = {
        guildSelect: document.getElementById('guildSelect'),
        loginBtn: document.getElementById('loginBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        authStatus: document.getElementById('authStatus'),
        modChannelsSection: document.getElementById('modChannelsSection'),
        publicChannelsSection: document.getElementById('publicChannelsSection'),
        GeneralChannelsSection: document.getElementById('GeneralChannelsSection'),
        reactionsSection: document.getElementById('reactionSection'),
        Responses: document.getElementById('stringSection'),
        adminRoleInput: document.getElementById('adminRoleInput'),
        modRoleInput: document.getElementById('modRoleInput'),
        jrRoleInput: document.getElementById('jrRoleInput'),
        automodSection: document.getElementById('AutomodSection'),
        addPublicChannelBtn: document.getElementById('addPublicChannelBtn'),
        EmbedSection: document.getElementById('embedContentSection'),
        addMediaBtn: document.getElementById('addMediaBtn'),
        addReactionBtn: document.getElementById('addReactionBtn'),
        addStringBtn: document.getElementById('addStringBtn'),
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        addGuildBtn: document.getElementById('createGuildBtn'),
        deleteConfigBtn: document.getElementById('deleteConfigBtn'),
        exportConfigBtn: document.getElementById('downloadConfigBtn'),
        messageBox: document.getElementById('messageBox'),
        reasonsWeightsSection: document.getElementById('reasonsWeightsSection'),
        addReasonWeightBtn: document.getElementById('addReasonWeightBtn'),
    messageReasonsWeightsSection: document.getElementById('messageReasonsWeightsSection'),
    addMessageReasonButtons: document.getElementById('addMessageReasonButtons'),
        addServerBtn: document.getElementById('addToServerBtn'),
        orText: document.getElementById('orText'),
    buttonColumnText: document.getElementById('buttoncolumnMessage'),
    channelsContainer: document.getElementById('channelsContainer')
    };
const rolePickers = {
    admin: makeRolePicker(elements.adminRoleInput),
    mod: makeRolePicker(elements.modRoleInput),
    jr: makeRolePicker(elements.jrRoleInput),
};
const PERMISSIONS = { Administrator: 1n << 3n, ModerateMembers: 1n << 40n, };
function hasPermission(permissions, flag) {
    const bits = BigInt(permissions);
    return (bits & flag) === flag || (bits & PERMISSIONS.Administrator) === PERMISSIONS.Administrator;
}
function setDisabledState(el, isDisabled) {
    el.disabled = isDisabled;
    el.classList.toggle('cursor-not-allowed', isDisabled);
    el.classList.toggle('opacity-50', isDisabled);
}
function buildChannelOptionsHtml(selectedId) {
    const grouped = new Map();
    const uncategorized = [];

    currentGuildChannels.forEach(ch => {
        if (!ch.categoryName) { uncategorized.push(ch); return; }
        if (!grouped.has(ch.categoryName)) grouped.set(ch.categoryName, []);
        grouped.get(ch.categoryName).push(ch);
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
function renderAuthUI() {
    const { loginBtn, logoutBtn, authStatus } = elements;
    if (currentUser) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        authStatus.textContent = `Logged in as ${currentUser.username}`;
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        authStatus.textContent = 'Not logged in';
    }
}
function addReactionRow(list, reaction = { emoji: '', roleId: '' }) {
    if (list.children.length >= 20) {
        showMessage('Discord messages can only track up to 20 distinct reactions.', 'bg-yellow-500');
        return;
    }
    const optionsHtml = currentGuildRoles
        .map(role => `<option value="${role.id}" style="color:${roleColorHex(role.color)}" ${role.id === reaction.roleId ? 'selected' : ''}>@${role.name}</option>`)
        .join('');
    const row = document.createElement('div');
    row.classList.add('row', 'gap-2');
    row.innerHTML = `
        <input type="text" placeholder="Emoji" value="${reaction.emoji || ''}" class="field-name" data-reaction-emoji style="max-width:90px">
        <select class="field" data-reaction-role>
            <option value="">-- Select a role --</option>
            ${optionsHtml}
        </select>
        <button type="button" class="remove-btn self-start" data-remove-reaction-row>&times;</button>`;
    row.querySelector('[data-remove-reaction-row]').addEventListener('click', () => row.remove());
    list.appendChild(row);
}
async function refreshAuthStatus() {
    const response = await fetch(`/api/auth/me`, { credentials: 'include' });
    const res = await response.json();
    currentUser = res.loggedIn ? { userId: res.userId, username: null } : null;
    const userRes = res.userId ? await fetch(`/api/discord/users/${res.userId}`, { method: "GET", credentials: 'include' }) : null
    const user = userRes ? await userRes.json() : null
    if (currentUser) currentUser.username = user.username
    renderAuthUI();
    return currentUser;
}
// --- API helpers ---------------------------------------------------------

function authHeaders(extra = {}) {
        return { ...extra };
}
async function apiSaveGuild(guildId, config) {
    const res = await fetch(`/api/guilds/${encodeURIComponent(guildId)}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Failed to save guild ${guildId} (${res.status})`);
        }
        return res.json();
}
async function apiDeleteGuild(guildId) {
    const res = await fetch(`/api/guilds/${encodeURIComponent(guildId)}`, {
            method: 'DELETE',
            headers: authHeaders(),
            credentials: 'include',
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Failed to delete guild ${guildId} (${res.status})`);
        }
        return res.json();
}
async function apiDeleteEmbed() {
    const res = await fetch(`/api/deleteembed/${currentGuildId}/${encodeURIComponent(activeEmbedKey)}`, {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
    })
    return { status: 200 }
}
function roleColorHex(colorInt) {
    if (!colorInt) return '#b9bbbe';
    return `#${colorInt.toString(16).padStart(6, '0')}`;
}

// Wraps a hidden <input id="..."> with a Discord-style colored dropdown button/menu.
// Overrides .value on the input so all your existing loadSelectedGuild/getFormValues
// code (which just reads/writes .value) keeps working with zero changes elsewhere.
function makeRolePicker(hiddenInput) {
    const wrapper = hiddenInput.closest('[data-role-picker]');
    const button = wrapper.querySelector('.role-picker-btn');
    const label = wrapper.querySelector('.role-picker-label');
    const menu = wrapper.querySelector('.role-picker-menu');

    let backingValue = hiddenInput.value || '';
    let roleLookup = new Map(); // roleId -> { name, color }

    function renderLabel() {
        const role = roleLookup.get(backingValue);
        label.textContent = role ? `@${role.name}` : '-- Select a role --';
        label.style.color = role ? roleColorHex(role.color) : '';
    }

    Object.defineProperty(hiddenInput, 'value', {
        get() { return backingValue; },
        set(v) { backingValue = v || ''; renderLabel(); },
        configurable: true,
    });

    function closeMenu() { menu.classList.add('hidden'); }
    function openMenu() {
        document.querySelectorAll('.role-picker-menu').forEach(m => m.classList.add('hidden'));
        menu.classList.remove('hidden');
    }

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.contains('hidden') ? openMenu() : closeMenu();
    });
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) closeMenu();
    });

    function setRoles(roles) {
        roleLookup = new Map(roles.map(r => [r.id, r]));
        menu.innerHTML = '';

        const blank = document.createElement('div');
        blank.className = 'px-3 py-2 cursor-pointer hover:bg-gray-700 text-gray-400';
        blank.textContent = '-- Select a role --';
        blank.addEventListener('click', () => { hiddenInput.value = ''; closeMenu(); });
        menu.appendChild(blank);

        roles.forEach(role => {
            const item = document.createElement('div');
            item.className = 'px-3 py-2 cursor-pointer hover:bg-gray-700';
            item.textContent = `@${role.name}`;
            item.style.color = roleColorHex(role.color);
            item.addEventListener('click', () => { hiddenInput.value = role.id; closeMenu(); });
            menu.appendChild(item);
        });

        renderLabel(); // in case the currently-set value's role just became known
    }

    return { setRoles };
}
// --- Embed Generator ---------------------------------------------------------
// Required (at least one): title, description, author name. Everything else is optional
// and hidden behind a toggle button until the user asks for it, so the form isn't
// overwhelming for a simple "just post some text" embed.

const OPTIONAL_EMBED_FIELDS = [
        {
            key: 'color', label: 'Color', render: (embed) => `
            <span class="field-label">Color (hex, e.g. #5865F2)</span>
            <input type="text" class="field" data-embed-field="color" value="${embed.color || ''}" placeholder="#5865F2">`,
        },
        {
            key: 'url', label: 'URL', render: (embed) => `
            <span class="field-label">Title Link URL</span>
            <input type="text" class="field" data-embed-field="url" value="${embed.url || ''}" placeholder="https://...">`,
        },
        {
            key: 'image', label: 'Image', render: (embed) => `
            <span class="field-label">Image URL</span>
            <input type="text" class="field" data-embed-field="image" value="${embed.image?.url || ''}" placeholder="https://...">`,
        },
        {
            key: 'thumbnail', label: 'Thumbnail', render: (embed) => `
            <span class="field-label">Thumbnail URL</span>
            <input type="text" class="field" data-embed-field="thumbnail" value="${embed.thumbnail?.url || ''}" placeholder="https://...">`,
        },
        {
            key: 'footer', label: 'Footer', render: (embed) => `
            <span class="field-label">Footer Text</span>
            <input type="text" class="field" data-embed-field="footerText" value="${embed.footer?.text || ''}">
            <div></div>
            <span class="field-label">Icon URL</span>
            <input type="text" class="field" data-embed-field="footerIcon" value="${embed.footer?.icon_url || ''}" placeholder="https://...">`,
        },
        {
            key: 'timestamp', label: 'Timestamp', render: (embed) => `
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
            <span class="flex items-center gap-2 text-gray-300 text-sm mb-1">
                <input type="checkbox" data-embed-field="single">
                Single select (picking one removes the others)
            </span>
            <div data-reactions-list class="space-y-2"></div>
            <button type="button" class="add-btn" data-add-reaction>Add Reaction</button>`,
    }
];

function blankEmbed() {
        return { title: '', description: '', author: { name: '' } };
}

// --- Components V2 Builder ---------------------------------------------------
// Discord component type ids (matches discord.js's ComponentType enum).
const V2_TYPE = { Section: 9, TextDisplay: 10, Thumbnail: 11, MediaGallery: 12, Separator: 14, Container: 17 };

// Each entry describes one node kind: its Discord type id, what it's allowed to
// contain (drives which "+ Add" buttons show up inside it), and its own editable
// fields. This is the "typing" the tree editor is built around — adding a new
// component kind later means adding one entry here plus its render/serialize
// handling below, not touching the tree-walking logic itself.
const V2_NODE_KINDS = {
    container: {
        label: 'Container', discordType: V2_TYPE.Container,
        canContain: ['textDisplay', 'separator', 'mediaGallery', 'section'],
        fields: [{ key: 'accent_color', label: 'Accent Color (hex)', input: 'text', placeholder: '#5865F2' }],
    },
    section: {
        label: 'Section', discordType: V2_TYPE.Section,
        canContain: ['textDisplay'], maxChildren: 3, hasThumbnailAccessory: true,
        fields: [],
    },
    textDisplay: {
        label: 'Text', discordType: V2_TYPE.TextDisplay,
        canContain: [],
        fields: [{ key: 'content', label: 'Content (markdown)', input: 'textarea', placeholder: 'Type text...' }],
    },
    separator: {
        label: 'Separator', discordType: V2_TYPE.Separator,
        canContain: [],
        fields: [
            { key: 'divider', label: 'Show divider line', input: 'checkbox' },
            { key: 'spacing', label: 'Spacing', input: 'select', options: [{ value: '1', label: 'Small' }, { value: '2', label: 'Large' }] },
        ],
    },
    mediaGallery: {
        label: 'Media Gallery', discordType: V2_TYPE.MediaGallery,
        canContain: [], hasItemsList: true,
        fields: [],
    },
};
const V2_ROOT_KINDS = ['container', 'textDisplay', 'separator', 'mediaGallery', 'section'];

function hexColorToInt(hex) {
    const n = parseInt(String(hex || '').trim().replace(/^#/, ''), 16);
    return Number.isNaN(n) ? undefined : n;
}
function intColorToHex(n) {
    return typeof n === 'number' ? '#' + n.toString(16).padStart(6, '0') : '';
}
function createV2Node(kind) {
    return { id: crypto.randomUUID(), kind, fields: {}, children: [], accessory: null, items: [] };
}
function v2NodeToApi(node) {
    const def = V2_NODE_KINDS[node.kind];
    const api = { type: def.discordType };
    for (const f of def.fields) {
        const val = node.fields[f.key];
        if (f.input === 'checkbox') { if (val) api[f.key] = true; continue; }
        if (val === undefined || val === '') continue;
        if (f.key === 'accent_color') { const c = hexColorToInt(val); if (c !== undefined) api.accent_color = c; }
        else if (f.key === 'spacing') api.spacing = parseInt(val, 10);
        else api[f.key] = val;
    }
    if (def.hasItemsList) {
        api.items = (node.items || []).filter(u => u.trim()).map(u => ({ media: { url: u.trim() } }));
    }
    if (def.canContain.length) {
        api.components = (node.children || []).map(v2NodeToApi);
    }
    if (def.hasThumbnailAccessory && node.accessory?.url?.trim()) {
        api.accessory = { type: V2_TYPE.Thumbnail, media: { url: node.accessory.url.trim() } };
    }
    return api;
}
function v2ApiToNode(api) {
    const kind = Object.keys(V2_NODE_KINDS).find(k => V2_NODE_KINDS[k].discordType === api.type);
    if (!kind) return null; // unknown/unsupported component type (e.g. ActionRow) — dropped rather than guessed at
    const def = V2_NODE_KINDS[kind];
    const node = createV2Node(kind);
    for (const f of def.fields) {
        if (f.key === 'accent_color') node.fields.accent_color = intColorToHex(api.accent_color);
        else if (f.input === 'checkbox') node.fields[f.key] = !!api[f.key];
        else if (api[f.key] !== undefined) node.fields[f.key] = String(api[f.key]);
    }
    if (def.hasItemsList) node.items = (api.items || []).map(it => it.media?.url || '');
    if (def.canContain.length && Array.isArray(api.components)) {
        node.children = api.components.map(v2ApiToNode).filter(Boolean);
    }
    if (def.hasThumbnailAccessory && api.accessory?.media?.url) node.accessory = { url: api.accessory.media.url };
    return node;
}

function renderV2Builder(formContainer, entry) {
    const tree = (entry.components || []).map(v2ApiToNode);
    const commit = () => {
        messageConfigsDraft[activeEmbedKey] = { ...messageConfigsDraft[activeEmbedKey], components: tree.map(v2NodeToApi) };
    };

    formContainer.innerHTML = `
        <div class="flex flex-col gap-2">
            <span class="field-label text-red-400">Channel ID</span>
            <input type="text" class="field" data-embed-field="channelid" value="${entry.channelid || ''}">
            <p class="text-sm text-yellow-400">Format can't be changed after creation — switching to Standard means deleting this entry and sending a new one.</p>
            <div id="v2TreeRoot" class="space-y-3 mt-2"></div>
            <div id="v2RootAddButtons" class="flex gap-2 flex-wrap"></div>
        </div>
    `;
    formContainer.querySelector('[data-embed-field="channelid"]').addEventListener('input', (e) => {
        messageConfigsDraft[activeEmbedKey] = { ...messageConfigsDraft[activeEmbedKey], channelid: e.target.value.trim() };
    });

    const treeRoot = formContainer.querySelector('#v2TreeRoot');
    const rootAddButtons = formContainer.querySelector('#v2RootAddButtons');

    function rerender() {
        treeRoot.innerHTML = '';
        tree.forEach((node, idx) => treeRoot.appendChild(renderNode(node, tree, idx)));
        rootAddButtons.innerHTML = V2_ROOT_KINDS.map(k => `<button type="button" class="add-btn" data-add-root="${k}">+ ${V2_NODE_KINDS[k].label}</button>`).join('');
        rootAddButtons.querySelectorAll('[data-add-root]').forEach(btn => {
            btn.addEventListener('click', () => {
                tree.push(createV2Node(btn.dataset.addRoot));
                commit(); rerender();
            });
        });
    }

    // Renders one node (its own fields + accessory/items + nested children), and returns the wrapping element.
    function renderNode(node, parentArray, index) {
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
        removeBtn.addEventListener('click', () => { parentArray.splice(index, 1); commit(); rerender(); });
        header.appendChild(removeBtn);
        wrap.appendChild(header);

        def.fields.forEach(f => {
            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'flex flex-col';
            if (f.input === 'textarea') {
                fieldWrap.innerHTML = `<span class="field-label">${f.label}</span><textarea class="field">${node.fields[f.key] || ''}</textarea>`;
                const el = fieldWrap.querySelector('textarea');
                el.addEventListener('input', () => { node.fields[f.key] = el.value; commit(); });
            } else if (f.input === 'checkbox') {
                fieldWrap.innerHTML = `<span class="flex items-center gap-2 text-gray-300"><input type="checkbox" ${node.fields[f.key] ? 'checked' : ''}>${f.label}</span>`;
                const el = fieldWrap.querySelector('input');
                el.addEventListener('change', () => { node.fields[f.key] = el.checked; commit(); });
            } else if (f.input === 'select') {
                const optionsHtml = f.options.map(o => `<option value="${o.value}" ${node.fields[f.key] === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
                fieldWrap.innerHTML = `<span class="field-label">${f.label}</span><select class="field">${optionsHtml}</select>`;
                const el = fieldWrap.querySelector('select');
                el.addEventListener('change', () => { node.fields[f.key] = el.value; commit(); });
            } else {
                fieldWrap.innerHTML = `<span class="field-label">${f.label}</span><input type="text" class="field" placeholder="${f.placeholder || ''}" value="${node.fields[f.key] || ''}">`;
                const el = fieldWrap.querySelector('input');
                el.addEventListener('input', () => { node.fields[f.key] = el.value; commit(); });
            }
            wrap.appendChild(fieldWrap);
        });

        if (def.hasItemsList) {
            const listWrap = document.createElement('div');
            listWrap.className = 'space-y-1';
            (node.items || []).forEach((url, i) => {
                const row = document.createElement('div');
                row.className = 'row gap-2';
                row.innerHTML = `<input type="text" class="field" placeholder="https://..." value="${url}"><button type="button" class="remove-btn self-start">&times;</button>`;
                row.querySelector('input').addEventListener('input', (e) => { node.items[i] = e.target.value; commit(); });
                row.querySelector('button').addEventListener('click', () => { node.items.splice(i, 1); commit(); rerender(); });
                listWrap.appendChild(row);
            });
            wrap.appendChild(listWrap);
            const addImgBtn = document.createElement('button');
            addImgBtn.type = 'button';
            addImgBtn.className = 'add-btn';
            addImgBtn.textContent = '+ Add Image URL';
            addImgBtn.addEventListener('click', () => { node.items.push(''); commit(); rerender(); });
            wrap.appendChild(addImgBtn);
        }

        if (def.hasThumbnailAccessory) {
            if (node.accessory) {
                const accWrap = document.createElement('div');
                accWrap.className = 'flex flex-col border-t border-gray-700 pt-2';
                accWrap.innerHTML = `<span class="field-label">Thumbnail URL</span><input type="text" class="field" value="${node.accessory.url || ''}" placeholder="https://...">`;
                accWrap.querySelector('input').addEventListener('input', (e) => { node.accessory.url = e.target.value; commit(); });
                const removeAcc = document.createElement('button');
                removeAcc.type = 'button';
                removeAcc.className = 'remove-btn mt-1';
                removeAcc.textContent = 'Remove Thumbnail';
                removeAcc.addEventListener('click', () => { node.accessory = null; commit(); rerender(); });
                accWrap.appendChild(removeAcc);
                wrap.appendChild(accWrap);
            } else {
                const addAcc = document.createElement('button');
                addAcc.type = 'button';
                addAcc.className = 'add-btn';
                addAcc.textContent = '+ Thumbnail';
                addAcc.addEventListener('click', () => { node.accessory = { url: '' }; commit(); rerender(); });
                wrap.appendChild(addAcc);
            }
        }

        if (def.canContain.length) {
            const childrenWrap = document.createElement('div');
            childrenWrap.className = 'pl-4 border-l border-gray-600 space-y-2';
            node.children.forEach((child, i) => childrenWrap.appendChild(renderNode(child, node.children, i)));
            wrap.appendChild(childrenWrap);

            const atLimit = def.maxChildren && node.children.length >= def.maxChildren;
            if (!atLimit) {
                const addChildButtons = document.createElement('div');
                addChildButtons.className = 'flex gap-2 flex-wrap';
                def.canContain.forEach(k => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'add-btn';
                    btn.textContent = `+ ${V2_NODE_KINDS[k].label}`;
                    btn.addEventListener('click', () => { node.children.push(createV2Node(k)); commit(); rerender(); });
                    addChildButtons.appendChild(btn);
                });
                wrap.appendChild(addChildButtons);
            }
        }

        return wrap;
    }

    rerender();
    commit();
}
function addEmbedFieldRow(list, field = { name: '', value: '', inline: false }) {
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
        row.querySelector('[data-remove-field-row]').addEventListener('click', () => row.remove());
        list.appendChild(row);
}
function syncActiveEmbedFromForm(formContainer) {
        if (!activeEmbedKey) return;

        const get = (name) => formContainer.querySelector(`[data-embed-field="${name}"]`);
        const embed = {};

        const title = get('title')?.value.trim();
        const description = get('description')?.value.trim();
        const authorName = get('authorName')?.value.trim();
        if (title) embed.title = title;
        if (description) embed.description = description;
        if (authorName) embed.author = { name: authorName };

        const color = get('color')?.value.trim();
        if (color) embed.color = color;

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
            const fields = [...fieldsList.querySelectorAll('.row')]
                .map(row => ({
                    name: row.querySelector('[data-field-name]').value.trim(),
                    value: row.querySelector('[data-field-value]').value.trim(),
                    inline: row.querySelector('[data-field-inline]').checked,
                }))
                .filter(f => f.name || f.value);
            if (fields.length) embed.fields = fields;
        }

    const reactionsList = formContainer.querySelector('[data-reactions-list]');
    let reactionsPatch = {};
    if (reactionsList) {
        const reactions = [...reactionsList.querySelectorAll('.row')]
            .map(row => ({
                emoji: row.querySelector('[data-reaction-emoji]').value.trim(),
                roleId: row.querySelector('[data-reaction-role]').value,
            }))
            .filter(r => r.emoji && r.roleId);
        reactionsPatch = { reactions, single: !!get('single')?.checked };
    }

        const channelid = formContainer.querySelector('[data-embed-field="channelid"]')?.value.trim() || '';
        const existing = messageConfigsDraft[activeEmbedKey] || {};
    messageConfigsDraft[activeEmbedKey] = { ...existing, channelid, embeds: [embed], ...reactionsPatch };
}
function validateEmbedsDraft() {
        for (const [key, entry] of Object.entries(messageConfigsDraft)) {
            if (!entry.channelid?.trim()) {
                return `Embed "${key}": Channel ID is required.`;
            }
            if (entry.format === 'v2') {
                if (!entry.components?.length) return `Embed "${key}": add at least one component before saving.`;
                continue;
            }
            const embed = entry.embeds?.[0] || {};
            const hasTitle = !!embed.title?.trim();
            const hasDescription = !!embed.description?.trim();
            const hasAuthor = !!embed.author?.name?.trim();
            if (!hasTitle && !hasDescription && !hasAuthor) {
                return `Embed "${key}": at least one of Title, Description, or Author Name is required.`;
            }
            if (entry.reactions?.length) {
                const seenEmojis = new Set();
                for (const r of entry.reactions) {
                    if (!r.emoji || !r.roleId) {
                        return `Embed "${key}": every reaction row needs both an emoji and a role.`;
                    }
                    if (seenEmojis.has(r.emoji)) {
                        return `Embed "${key}": duplicate emoji "${r.emoji}" in reactions.`;
                    }
                    seenEmojis.add(r.emoji);
                }
            }
        }
        return null;
}
const MESSAGE_REASON_CATEGORIES = [
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
function getMessageReasonsWeightsValues(container) {
    const result = {};
    container.querySelectorAll('[data-mrw-key]').forEach(row => {
        const key = row.dataset.mrwKey;
        const reason = row.querySelector('[data-mrw-reason]').value.trim();
        const weight = Number(row.querySelector('[data-mrw-weight]').value);
        if (key && reason && !Number.isNaN(weight)) result[key] = { reason, weight };
    });
    return result;
}
function getSectionValues(container, type) {
        const values = {};
        const divs = container.querySelectorAll('div');

        divs.forEach(div => {
            let name, id;
            switch (type) {
                case 'automod': {
                    const nameSpan = div.querySelector('span[data-automod-name]');
                    const valueInput = div.querySelector('input[data-automod-value]');
                    if (nameSpan && valueInput) {
                        name = nameSpan.dataset.automodName.trim();
                        id = valueInput.value.trim();
                        if (name && id) {
                            let parsedValue = id;
                            if (id === 'true') parsedValue = true;
                            else if (id === 'false') parsedValue = false;
                            else if (!isNaN(Number(id))) parsedValue = Number(id);
                            values[name] = parsedValue;
                        }
                    }
                    break;
                }
                case 'mod': {
                    const nameSpanMod = div.querySelector('span[data-channel-name]');
                    const idSelectMod = div.querySelector('select[data-channel-id]');
                    if (nameSpanMod && idSelectMod) {
                        name = nameSpanMod.dataset.channelName.trim();
                        id = idSelectMod.value.trim();
                        if (name && id) values[name] = id;
                    }
                    break;
                }
                case 'reaction': {
                    const nameInput = div.querySelector('input[data-channel-name]');
                    const idSelect = div.querySelector('select[data-channel-id]');
                    if (nameInput && idSelect) {
                        name = nameInput.value.trim();
                        const selected = Array.from(idSelect.selectedOptions).map(opt => opt.value);
                        if (name) values[name] = selected.length > 1 ? selected : (selected[0] || '');
                    }
                    break;
                }
                default: { // 'public', 'media', 'role'
                    const nameInput = div.querySelector('input[data-channel-name]');
                    const idField = div.querySelector('[data-channel-id]'); // select for 'public', input otherwise
                    if (nameInput && idField) {
                        name = nameInput.value.trim();
                        id = idField.value.trim();
                        if (name) values[name] = id;
                    }
                    break;
                }
            }
        });

        return values;
}
function createChannelInput(container, name = '', value = '', type) {
        const div = document.createElement('div');
        div.classList.add('row');

        const isReaction = type === 'reaction';
        const isResponse = type === 'response';
        const namePlaceholder = isReaction ? 'Reaction' : isResponse ? 'Trigger' : 'Channel Name';

    if (isReaction) {
        const selectedIds = Array.isArray(value) ? value : (value ? value.split(',').map(v => v.trim()) : []);
        const optionsHtml = currentGuildRoles
            .map(role => `<option value="${role.id}" style="color:${roleColorHex(role.color)}" ${selectedIds.includes(role.id) ? 'selected' : ''}>@${role.name}</option>`)
            .join('');

        div.innerHTML = `
        <input type="text" placeholder="${namePlaceholder}" value="${name}" class="channel-row" data-channel-name="${type}">
        <select class="field" data-channel-id="${type}" multiple size="4">${optionsHtml}</select>
        <button class="remove-btn self-start">&times;</button>`;
    } else {
        const idPlaceholder = isResponse ? 'Response text' : 'Channel ID';
        const idField = type === 'public'
            ? `<select class="field" data-channel-id="${type}">${buildChannelOptionsHtml(value)}</select>`
            : `<input type="text" placeholder="${idPlaceholder}" value="${value}" class="field" data-channel-id="${type}">`;
        div.innerHTML = `
                    <input type="text" placeholder="${namePlaceholder}" value="${name}" class="channel-row" data-channel-name="${type}">
                    ${idField}
                        <button class="remove-btn">&times;</button>`;
    }

        div.querySelector('.remove-btn').onclick = () => div.remove();
        container.appendChild(div);
}
function createReasonWeightInput(container, ruleOptions, key = '', reason = '', weight = 1) {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.dataset.rwKey = key;

        const usedIds = new Set(
            [...container.querySelectorAll('[data-rw-key]')].map(el => el.dataset.rwKey)
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

        div.querySelector('select').addEventListener('change', (e) => { div.dataset.rwKey = e.target.value; });
        div.querySelector('.remove-btn').onclick = () => div.remove();
        container.appendChild(div);
}
// General Channels is a flat array of channel IDs in Mongo (no key:value pairs).
function renderArraySection(container, items) {
        container.innerHTML = '';
    (items || []).forEach(value => createArrayInput(container, value));
}
function createArrayInput(container, value = '') {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.innerHTML = `
    <select class="field" data-array-value="channel">${buildChannelOptionsHtml(value)}</select>
    <button class="remove-btn">&times;</button>`;
        div.querySelector('.remove-btn').onclick = () => div.remove();
        container.appendChild(div);
}
function getArraySectionValues(container) {
        const values = [];
    container.querySelectorAll('[data-array-value]').forEach(el => {
        const v = el.value.trim();
            if (v) values.push(v);
        });
        return values;
}
function getReasonsAndWeightsValues(container) {
        const result = {};
        container.querySelectorAll('[data-rw-ruleid]').forEach(select => {
            const row = select.closest('div');
            const ruleId = select.value;
            const reason = row.querySelector('[data-rw-reason]').value.trim();
            const weight = Number(row.querySelector('[data-rw-weight]').value);
            if (ruleId && reason && !Number.isNaN(weight)) result[ruleId] = { reason, weight };
        });
        return result;
}
function confirmModal(message) {
    return new Promise((resolve) => {
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
        document.getElementById('confirmYes').addEventListener('click', () => { modal.remove(); resolve(true); });
        document.getElementById('confirmNo').addEventListener('click', () => { modal.remove(); resolve(false); });
    });
}
// --- Actions -----------------------------------------------------------------
async function handleSaveConfig() {
        if (!currentGuildId) { showMessage('Select a guild to save.', 'bg-red-500'); return; }
    if (currentRole !== 'admin' && currentRole !== 'owner') { showMessage('Admin role/owner required to save.', 'bg-red-500'); return; }
        if (!elements.adminRoleInput.value.trim() || !elements.modRoleInput.value.trim()) {
            showMessage('Admin Role ID and Mod Role ID are both required (Staff Roles tab).', 'bg-red-500');
            return;
        }

        const embedError = validateEmbedsDraft();
        if (embedError) { showMessage(embedError, 'bg-red-500'); return; }

        const config = getFormValues();
        try {
            await apiSaveGuild(currentGuildId, config);
            showMessage('Saved to database!', 'bg-green-500');
            await loadSelectedGuild();
        } catch (error) {
            showMessage(`Save failed: ${error.message}`, 'bg-red-500');
        }
}
async function handleDeleteConfig() {
        if (!currentGuildId) { showMessage('No guild selected to delete.', 'bg-red-500'); return; }
        if (currentRole !== 'admin' && currentRole !== 'owner') { showMessage('Admin/owner role required to delete.', 'bg-red-500'); return; }

        const shouldDelete = await confirmModal(`Are you sure you want to permanently delete the config for Guild ID: ${currentGuildId} from the database?`);
        if (!shouldDelete) return;

        try {
            await apiDeleteGuild(currentGuildId);
            showMessage('Configuration deleted from database.', 'bg-green-500');
            elements.guildSelect.value = '';
            await refreshGuildSelect();
        } catch (error) {
            showMessage(`Delete failed: ${error.message}`, 'bg-red-500');
        }
}
// Downloads whatever is currently on screen as a local JSON backup (not an API call).
function handleExportConfig() {
        const config = getFormValues();
        const fileContent = JSON.stringify({ [currentGuildId || 'new-guild']: config }, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentGuildId || 'new-guild'}-backup.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    return { modChannels, publicChannels, generalchannels, reactions, automodsettings: { ...automodThresholds, messagereasonsandweights, automodreasonsandweights, }, responses, staffroles, messageConfigs: messageConfigsDraft };
}
function showMessage(message, colorClass) {
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
function applyRolePermissions() {
    const { saveConfigBtn, deleteConfigBtn } = elements;
    const canEdit = currentRole === 'admin' || currentRole === 'owner';
    setDisabledState(saveConfigBtn, !canEdit);
    saveConfigBtn.title = canEdit ? '' : 'Admin role required';
    setDisabledState(deleteConfigBtn, !canEdit);
    deleteConfigBtn.title = canEdit ? '' : 'Admin role required';
}
// --- Guild list / selection ------------------------------------------------

async function refreshGuildSelect() {
    const { guildSelect, addServerBtn, deleteConfigBtn } = elements;
    const selectedValue = guildSelect.value;
    guildSelect.innerHTML = '<option value="">-- Select a Guild --</option>';
    if (!currentUser) {
        addServerBtn.classList.remove('hidden');
        deleteConfigBtn.classList.add('hidden');
        return;
    }
    try {
        const resGuilds = await fetch(`/api/guilds`, { headers: authHeaders(), credentials: 'include' });
        if (!resGuilds.ok) throw new Error(`Failed to list guilds (${resGuilds.status})`);
        const guilds = await resGuilds.json(); // [{ guildId, name, role }]
        guildRoles = new Map(guilds.map(g => [g.guildId, g.role]));
        guilds
            .sort((a, b) => a.guildId.localeCompare(b.guildId))
            .forEach(g => {
                const option = document.createElement('option');
                option.value = g.guildId;
                option.textContent = `${g.name || g.guildId} (${g.role})`;
                guildSelect.appendChild(option);
            });

        guildSelect.value = guilds.some(g => g.guildId === selectedValue) ? selectedValue : '';
        if (guilds.length === 0) showMessage('No guilds found where you hold the admin or mod role.', 'bg-yellow-500');
        addServerBtn.classList.remove('hidden');
    } catch (error) {
        showMessage(`Could not reach the config API: ${error.message}`, 'bg-red-500');
    }
    await loadSelectedGuild();
}
function setGuildRoles(guildRoles) {
    currentGuildRoles = (guildRoles || []).slice().sort((a, b) => b.position - a.position);
    const staffEligible = currentGuildRoles.filter(role => hasPermission(role.permissions, PERMISSIONS.ModerateMembers));
    rolePickers.admin.setRoles(staffEligible);
    rolePickers.mod.setRoles(staffEligible);
    rolePickers.jr.setRoles(staffEligible);
}
async function loadSelectedGuild() {
    const { guildSelect, deleteConfigBtn, addServerBtn, orText, saveConfigBtn, exportConfigBtn, buttonColumnText, channelsContainer, adminRoleInput, modRoleInput, jrRoleInput, publicChannelsSection, GeneralChannelsSection, reactionsSection, Responses, automodSection, reasonsWeightsSection, messageReasonsWeightsSection, addMessageReasonButtons, modChannelsSection } = elements;

    currentGuildId = guildSelect.value;
    deleteConfigBtn.classList.toggle('hidden', !currentGuildId);
    saveConfigBtn.classList.toggle('hidden', !currentGuildId);
    exportConfigBtn.classList.toggle('hidden', !currentGuildId);
    addServerBtn.classList.toggle('hidden', currentGuildId)
    orText.classList.toggle('hidden', currentGuildId)
    channelsContainer.classList.toggle('hidden', !currentGuildId)
    if (!currentGuildId) {
        currentConfig = currentRole = currentGuildChannels = currentGuildRoles = null;
        currentAutomodRules = [];
        buttonColumnText.textContent = 'Please select a guild or invite the bot';
        return;
    } else {
            addServerBtn.classList.add('hidden');
            orText.classList.add('hidden');
            saveConfigBtn.classList.remove('hidden');
            deleteConfigBtn.classList.remove('hidden');
            exportConfigBtn.classList.remove('hidden');
            buttonColumnText.textContent = '';
        try {
            // Always fetch fresh — a stale in-memory cache here previously meant
            // out-of-band DB edits (e.g. via Compass) wouldn't show up until a hard reload.
            const res = await fetch(`/api/guilds/${encodeURIComponent(currentGuildId)}`, { headers: authHeaders(), credentials: 'include', cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load guild ${currentGuildId} (${res.status})`);
            const doc = await res.json();
            guilds.set(currentGuildId, doc)
            currentConfig = doc;

            currentAutomodRules = currentConfig.rules
            currentRole = currentConfig._viewerRole || guildRoles.get(currentGuildId) || null;
            currentGuildChannels = currentConfig.guildChannels || [];
            setGuildRoles(currentConfig.guildRoles)
            renderConfig(currentConfig);
            const [adminRole = '', modRole = '', jrRole = ''] = currentConfig.staffroles || [];
            adminRoleInput.value = adminRole;
            modRoleInput.value = modRole;
            jrRoleInput.value = jrRole;
        } catch (error) {
            showMessage(`Failed to load config: ${error.message}`, 'bg-red-500');
        }
    }
    applyRolePermissions();
}
// --- Config rendering ------------------------------------------------------

function renderConfig(config) {
    const sections = [
        { key: 'modChannels', elementKey: 'modChannelsSection', type: 'mod' },
        { key: 'publicChannels', elementKey: 'publicChannelsSection', type: 'public' },
        { key: 'reactions', elementKey: 'reactionsSection', type: 'reaction' },
        { key: 'responses', elementKey: 'Responses', type: 'response' },
    ];
    for (const { key, elementKey, type } of sections) {
        renderSection(elements[elementKey], config[key] || {}, type);
    }

    // automodsettings is now consolidated: flat thresholds + two nested reason/weight maps.
    const { messagereasonsandweights, automodreasonsandweights, ...automodThresholds } = config.automodsettings || {};
    renderSection(elements.automodSection, automodThresholds, 'automod');
    renderMessageReasonsWeightsSection(elements.messageReasonsWeightsSection, elements.addMessageReasonButtons, messagereasonsandweights || {});
    renderReasonsAndWeightsSection(elements.reasonsWeightsSection, automodreasonsandweights, currentAutomodRules);
    renderArraySection(elements.GeneralChannelsSection, config.generalchannels || []);
    renderEmbedSection(elements.EmbedSection, config.messageConfigs || {});
}
function renderSection(container, data, type) {
    container.innerHTML = '';
    for (const key in data) {
        if (!Object.hasOwnProperty.call(data, key)) continue;

        if (type === 'mod') {
            const div = document.createElement('div');
            div.classList.add('row', 'relative');
            div.innerHTML = `
                    <span class="field-label" data-channel-name="${key}">${key}</span>
                    <select class="field" data-channel-id="${key}">${buildChannelOptionsHtml(data[key])}</select>
                `;
            div.querySelector('span').dataset.channelName = key;
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
            createChannelInput(container, key, data[key], type);
        }
    }
}
function renderReasonsAndWeightsSection(container, reasonsandweights, ruleOptions) {
    container.innerHTML = '';
    Object.entries(reasonsandweights || {}).forEach(([key, obj]) =>
        createReasonWeightInput(container, ruleOptions, key, obj.reason, obj.weight)
    );
}
function renderMessageReasonsWeightsSection(container, buttonsContainer, data) {
    container.innerHTML = '';
    const active = new Set(Object.keys(data || {}));

    function addRow(key, reason = '', weight = 1) {
        const cat = MESSAGE_REASON_CATEGORIES.find(c => c.key === key);
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'gap-2');
        div.dataset.mrwKey = key;
        div.innerHTML = `
            <span class="field-label" style="min-width:200px">${cat ? cat.label : key}</span>
            <input type="text" placeholder="Reason" value="${reason}" class="field" data-mrw-reason>
            <input type="number" step="1" placeholder="Weight" value="${weight}" class="field" data-mrw-weight>
            <button class="remove-btn">&times;</button>`;
        div.querySelector('.remove-btn').onclick = () => {
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
        buttonsContainer.querySelectorAll('[data-add-message-reason]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.addMessageReason;
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
function renderEmbedSection(container, messageConfigs) {
    messageConfigsDraft = structuredClone(messageConfigs || {});
    const keys = Object.keys(messageConfigsDraft);
    activeEmbedKey = keys.includes(activeEmbedKey) ? activeEmbedKey : (keys[0] || '');

    container.innerHTML = `
       <div class="flex flex-wrap items-center gap-2">
        <select id="embedSelect" class="field"></select>
        <button type="button" id="deleteEmbedBtn" class="remove-btn" style="max-width:200px">Delete</button>
        <span id="orSeparator" class="text-gray-300 font-semibold shrink-0">- or -</span>
        <button type="button" id="createEmbedBtn" class="add-btn" style="max-width:200px">+ New Embed</button>
        <button type="button" id="pushEmbedBtn" class="action-btn bg-purple-500 hover:bg-purple-600" style="max-width:220px">Push to Discord</button>
    </div>
    <p class="text-sm text-gray-400 mt-2">At least one of Title, Description, or Author Name is required.</p>
    <p class="text-xs text-yellow-400 mt-1 hidden" id="pushEmbedHint">Pushes the current form contents to Discord. This does not save your changes to the database — hit Save separately to persist them.</p>
    <div id="embedFormFields" class="space-y-4 mt-2"></div>
    `;

    const select = container.querySelector('#embedSelect');
    const deleteBtn = container.querySelector('#deleteEmbedBtn');
    const orSeparator = container.querySelector('#orSeparator');
    const createBtn = container.querySelector('#createEmbedBtn');
    const pushBtn = container.querySelector('#pushEmbedBtn');
    const pushHint = container.querySelector('#pushEmbedHint');
    const hasEmbeds = keys.length > 0;

    setDisabledState(select, !hasEmbeds);
    select.classList.toggle('hidden', !hasEmbeds);
    setDisabledState(deleteBtn, !hasEmbeds);
    setDisabledState(pushBtn, !hasEmbeds);
    deleteBtn.classList.toggle('hidden', !hasEmbeds);
    orSeparator.classList.toggle('hidden', !hasEmbeds);
    pushBtn.classList.toggle('hidden', !hasEmbeds);
    select.innerHTML = hasEmbeds
        ? keys.map(k => `<option value="${k}" ${k === activeEmbedKey ? 'selected' : ''}>${k}</option>`).join('')
        : '<option value="">-- No embeds yet, create one --</option>';

    select.addEventListener('change', () => {
        activeEmbedKey = select.value;
        renderEmbedForm();
    });
    pushBtn.addEventListener('click', async () => {
        if (!activeEmbedKey || !currentGuildId) return;
        const config = messageConfigsDraft[activeEmbedKey];
        if (!config?.channelid) { showMessage('Set a Channel ID before pushing.', 'bg-yellow-500'); return; }

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
            const result = await apiSendEmbed(currentGuildId, activeEmbedKey, config);
            showMessage(result.status === 'sent' ? 'Sent new message to Discord!' : 'Updated existing Discord message.', 'bg-green-500');
        } catch (error) {
            showMessage(`Push failed: ${error.message}`, 'bg-red-500');
        } finally {
            setDisabledState(pushBtn, false);
            pushHint.classList.add('hidden');
        }
    });
    createBtn.addEventListener('click', () => {
        let nameInput = container.querySelector('#newEmbedNameInput');

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

        const format = container.querySelector('#newEmbedFormatSelect')?.value === 'v2' ? 'v2' : 'v1';

        messageConfigsDraft[name] = format === 'v2'
            ? { channelid: '', format: 'v2', components: [] }
            : { channelid: '', format: 'v1', embeds: [blankEmbed()] };
        activeEmbedKey = name;
        v1info.classList.toggle('hidden', format === 'v2')
        renderEmbedSection(container, messageConfigsDraft);
    });

    deleteBtn.addEventListener('click', async () => {
        if (!activeEmbedKey) return;
        else if (messageConfigsDraft[activeEmbedKey].channelid = '') {
            showMessage('Message not deleted, channelid is blank', 'bg-yellow-500')
        } else {
            await apiDeleteEmbed(activeEmbedKey)
        }
        delete messageConfigsDraft[activeEmbedKey];
        activeEmbedKey = '';
        renderEmbedSection(container, messageConfigsDraft);
    });

    renderEmbedForm();

    function renderEmbedForm() {
        const formContainer = container.querySelector('#embedFormFields');
        if (!activeEmbedKey || !messageConfigsDraft[activeEmbedKey]) {
            formContainer.innerHTML = '';
            return;
        }

        const entry = messageConfigsDraft[activeEmbedKey];

        // v2 entries get the component tree builder; v1 keeps the classic embed form below.
        if (entry.format === 'v2') {
            renderV2Builder(formContainer, entry);
            return;
        }

        const embed = entry.embeds?.[0] || blankEmbed();
        const visibleOptional = new Set(
            OPTIONAL_EMBED_FIELDS.filter(f => {
                if (f.key === 'fields') return (embed.fields?.length || 0) > 0;
                if (f.key === 'reactions') return (entry.reactions?.length || 0) > 0;
                if (f.key === 'footer') return !!(embed.footer?.text || embed.footer?.icon_url);
                if (f.key === 'image') return !!embed.image?.url;
                if (f.key === 'thumbnail') return !!embed.thumbnail?.url;
                return !!embed[f.key];
            }).map(f => f.key)
        );

        formContainer.innerHTML = `
                <div class="flex flex-col">
                    <div id="optionalFieldButtons" class="flex gap-2 flex-wrap"></div>
                    <span class="field-label text-red-400">Channel ID</span>
                    <input type="text" class="field" data-embed-field="channelid" value="${entry.channelid || ''}">
                    <span class="field-label">Title</span>
                    <input type="text" class="field" data-embed-field="title" value="${embed.title || ''}">
                    <span class="field-label">Description</span>
                    <textarea class="field" data-embed-field="description">${embed.description || ''}</textarea>
                    <span class="field-label">Author Name</span>
                    <input type="text" class="field" data-embed-field="authorName" value="${embed.author?.name || ''}">
                    <div id="optionalFieldGroups" class="space-y-3"></div>
                </div>
            `;

        const buttonsEl = formContainer.querySelector('#optionalFieldButtons');
        const groupsEl = formContainer.querySelector('#optionalFieldGroups');

        const drawButtons = () => {
            buttonsEl.innerHTML = OPTIONAL_EMBED_FIELDS
                .filter(f => !visibleOptional.has(f.key))
                .map(f => `<button type="button" class="add-btn" data-show-optional="${f.key}">+ ${f.label}</button>`)
                .join('');

            buttonsEl.querySelectorAll('[data-show-optional]').forEach(btn => {
                btn.addEventListener('click', () => {
                    visibleOptional.add(btn.dataset.showOptional);
                    drawButtons();
                    drawGroups();
                });
            });
        };

        const drawGroups = () => {
            groupsEl.innerHTML = '';
            OPTIONAL_EMBED_FIELDS.filter(f => visibleOptional.has(f.key)).forEach(f => {
                const wrap = document.createElement('div');
                wrap.className = 'flex flex-col';
                wrap.dataset.optionalGroup = f.key;
                wrap.innerHTML = `
                        ${f.render(embed)}
                        <button type="button" class="remove-btn" data-hide-optional="${f.key}">Remove</button>  
                        `;
                groupsEl.appendChild(wrap);

                wrap.querySelector('[data-hide-optional]').addEventListener('click', () => {
                    visibleOptional.delete(f.key);
                    drawButtons();
                    drawGroups();
                });

                if (f.key === 'fields') {
                    const list = wrap.querySelector('[data-embed-fields-list]');
                    (embed.fields || []).forEach(field => addEmbedFieldRow(list, field));
                    wrap.querySelector('[data-add-embed-field]').disabled = list.children.length >= 25;
                    wrap.querySelector('[data-add-embed-field]').classList.toggle('hidden', list.children.length >= 25);
                    wrap.querySelector('[data-add-embed-field]').addEventListener('click', () => {
                        addEmbedFieldRow(list)

                    });
                }

                if (f.key === 'reactions') {
                    const list = wrap.querySelector('[data-reactions-list]');
                    const singleCheckbox = wrap.querySelector('[data-embed-field="single"]');
                    if (singleCheckbox) singleCheckbox.checked = !!entry.single;
                    (entry.reactions || []).forEach(r => addReactionRow(list, r));
                    wrap.querySelector('[data-add-reaction]').addEventListener('click', () => {
                        addReactionRow(list);
                    });
                }

                wrap.addEventListener('input', () => syncActiveEmbedFromForm(formContainer));
                wrap.addEventListener('change', () => syncActiveEmbedFromForm(formContainer));
            });
        };

        drawButtons();
        drawGroups();
        formContainer.addEventListener('input', () => syncActiveEmbedFromForm(formContainer));
    }
}

async function apiSendEmbed(guildId, embedName, config) {
    const res = await fetch(`/api/sendembed/${encodeURIComponent(embedName)}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ guildId, embedName, config }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to push embed (${res.status})`);
    }
    return res.json();
}
// --- Tabs ------------------------------------------------------------------
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn:not(.subtab-btn)');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabBar = document.getElementById('tabBar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('tab-btn-active'));
            tabContents.forEach(content => content.classList.add('hidden'));

            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
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

    document.getElementById('modChannelsTab').click();
}

function initSubtabs() {
    const subtabs = document.querySelectorAll('.subtab-btn');
    const subtabContents = document.querySelectorAll('.subtab-content');

    subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            subtabs.forEach(item => item.classList.remove('tab-btn-active'));
            subtabContents.forEach(content => content.classList.add('hidden'));

            const targetId = tab.getAttribute('data-subtarget');
            document.getElementById(targetId).classList.remove('hidden');
            tab.classList.add('tab-btn-active');
        });
    });
}
// --- Wiring --------------------------------------------------------------------
elements.guildSelect.addEventListener('change', async () => { await loadSelectedGuild() });
elements.loginBtn.addEventListener('click', () => { window.location.href = `/api/auth/discord/login`; });
elements.logoutBtn.addEventListener('click', async () => {
    await fetch(`/api/auth/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    currentRole = null;
    currentConfig = null;
    currentGuildId = null;
    renderAuthUI();
    await refreshGuildSelect();
    await loadSelectedGuild();
    applyRolePermissions();
});
elements.addPublicChannelBtn.addEventListener('click', () => createChannelInput(elements.publicChannelsSection, '', '', 'public'));
elements.addMediaBtn.addEventListener('click', () => createArrayInput(elements.GeneralChannelsSection, ''));
elements.addReactionBtn.addEventListener('click', () => createChannelInput(elements.reactionsSection, '', '', 'reaction'));
elements.addStringBtn.addEventListener('click', () => createChannelInput(elements.Responses, '', '', 'response'));
elements.addReasonWeightBtn.addEventListener('click', () => createReasonWeightInput(elements.reasonsWeightsSection, currentAutomodRules, '', '', 1));
elements.saveConfigBtn.addEventListener('click', handleSaveConfig);
elements.deleteConfigBtn.addEventListener('click', handleDeleteConfig);
elements.exportConfigBtn.addEventListener('click', handleExportConfig);
elements.addServerBtn.addEventListener('click', () => { window.open('https://discord.com/oauth2/authorize?client_id=1420927654701301951&permissions=1202859404454&redirect_uri=https%3A%2F%2Fpostnecrotic-carli-superindustriously.ngrok-free.dev%2Fapi%2Fauth%2Fdiscord%2Fbot-redirect&integration_type=0&scope=bot+applications.commands', '_blank', 'noopener,noreferrer'); });
initTabs();
initSubtabs();
refreshAuthStatus().then(refreshGuildSelect);