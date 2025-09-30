document.addEventListener('DOMContentLoaded', () => {
    let allGuildConfigs = {};
    // ui Elements
    const elements = {
        guildSelect: document.getElementById('guildSelect'),
        guildIdInput: document.getElementById('guildIdInput'),
        modChannelsSection: document.getElementById('modChannelsSection'),
        publicChannelsSection: document.getElementById('publicChannelsSection'),
        exclusionsSection: document.getElementById('exclusionsSection'),
        reactionsSection: document.getElementById('reactionSection'),
        rolesSection: document.getElementById('stringSection'),
        automodSection: document.getElementById('AutomodSection'),
        uploadConfigBtn: document.getElementById('uploadConfigBtn'),
        fileInput: document.getElementById('fileInput'),
        addPublicChannelBtn: document.getElementById('addPublicChannelBtn'),
        addExclusionBtn: document.getElementById('addExclusionBtn'),
        addReactionBtn: document.getElementById('addReactionBtn'),
        addStringBtn: document.getElementById('addStringBtn'),
        addAutoModBtn: document.getElementById('addAutomodBtn'),
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        deleteConfigBtn: document.getElementById('deleteConfigBtn'),
        downloadConfigBtn: document.getElementById('downloadConfigBtn'),
        jsonPreview: document.getElementById('jsonPreview'),
        messageBox: document.getElementById('messageBox'),
        channelsContainer: document.getElementById('channelsContainer')
    }

    function updateGuildSelect() {
        const { guildSelect } = elements;
        const selectedValue = guildSelect.value;
        guildSelect.innerHTML = '<option value="">-- Add New Guild --</option>';
        const guildIds = Object.keys(allGuildConfigs).sort();
        guildIds.forEach(guildId => {
            const option = document.createElement('option');
            option.value = guildId;
            option.textContent = guildId;
            guildSelect.appendChild(option);
        });
        guildSelect.value = selectedValue || (guildIds.length > 0 ? guildIds[0] : "");
        updateGuildUI();
    };

    function updateGuildUI() {
        const { guildSelect, guildIdInput, deleteConfigBtn } = elements;
        const currentGuildId = guildSelect.value;
        guildIdInput.value = currentGuildId;

        let configToRender;

        if (allGuildConfigs[currentGuildId]) {
            configToRender = allGuildConfigs[currentGuildId]
            console.log(`Loading pre-existing config for guild: ${currentGuildId}`, configToRender);
        }
        else {
            configToRender = {
                modChannels: {
                    mutelogChannel: "channel Id here",
                    deletedlogChannel: "channel Id here",
                    welcomeChannel: "channel Id here",
                    updatedlogChannel: "channel Id here",
                    namelogChannel: "channel Id here",
                    banlogChannel: "channel Id here",
                    appealChannel: "channel Id here",
                    applicationChannel: "channel Id here",
                    adminChannel: "channel Id here"
                },
                publicChannels: {},
                exclusions: {},
                reactions: {},
                roles: {},
                automodsettings: {
                    spamwindow: 4000,
                    spamthreshold: 5,
                    Duplicatespamthreshold: 3,
                    capsratio: 0.7,
                    mediathreshold: 5,
                    capscheckminlength: 20,
                    messagethreshold: 15
                }
            }
            console.log(`No config found, loading default for guild: ${currentGuildId}`);
        }
        renderConfig(configToRender)
        deleteConfigBtn.classList.toggle('hidden', !currentGuildId)
    }

    function renderConfig(config) {
        const sections = {
            modChannels: 'mod',
            publicChannels: 'public',
            exclusions: 'exclusions',
            reactions: 'reaction',
            roles: 'roles',
            automodsettings: 'automod'
        };
        for (const key in sections) {
            if (Object.hasOwnProperty.call(config, key)) {
                const containerId = key === 'automodsettings' ? 'automodSection' : `${key}Section`;
                renderSection(elements[containerId], config[key], sections[key])
            }
        }
        updateJsonPreview();
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
                        id = valueInput.value.trim(); // Using id for value for consistency
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
                    const idInputMod = div.querySelector('input[data-channel-id]');
                    if (nameSpanMod && idInputMod) {
                        name = nameSpanMod.dataset.channelName.trim();
                        id = idInputMod.value.trim();
                        if (name && id) {
                            values[name] = id;
                        }
                    }
                    break;
                }
                case 'reaction': {
                    const nameInput = div.querySelector('input[data-channel-name]');
                    const idInput = div.querySelector('input[data-channel-id]');
                    if (nameInput && idInput) {
                        name = nameInput.value.trim();
                        id = idInput.value.trim();
                        if (name) {
                            if (id.includes(',')) {
                                id = id.split(',').map(item => item.trim());
                            }
                            values[name] = id;
                        }
                    }
                    break;
                }
                default: { // 'public', 'exclusion', 'role'
                    const nameInput = div.querySelector('input[data-channel-name]');
                    const idInput = div.querySelector('input[data-channel-id]');
                    if (nameInput && idInput) {
                        name = nameInput.value.trim();
                        id = idInput.value.trim();
                        if (name) {
                            values[name] = id;
                        }
                    }
                    break;
                }
            }
        })
        return values;
    };

    function renderSection(container, data, type) {
        container.innerHTML = ''; // Clear the container first
        for (const key in data) {
            if (Object.hasOwnProperty.call(data, key)) {
                const div = document.createElement('div');
                div.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'gap-2', 'relative');
                switch (type) {
                    case 'automod': {
                        div.innerHTML = `
                                <span class="w-full md:w-1/3 bg-gray-700 text-gray-200 rounded-lg p-2 font-bold text-xl" data-automod-name="${key}">
                                    ${key}
                                </span>
                                <input type="text" placeholder="Value" value="${data[key]}" class="w-full md:w-2/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-automod-value>
                            `;
                        break;
                    }
                    case 'mod': {
                        div.innerHTML = `
                                <span class="w-full md:w-1/3 bg-gray-700 text-gray-200 rounded-lg p-2 font-bold text-xl" data-channel-name="${key}">
                                    ${key}
                                </span>
                                <input type="text" placeholder="Channel ID" value="${data[key]}" class="w-full md:w-2/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-id="${type}">
                            `;
                        break;
                    }
                    default: {
                        const namePlaceholder = (type === 'reaction' || type === 'role') ? 'Name' : 'Channel Name';
                        const idPlaceholder = (type === 'reaction' || type === 'role') ? 'IDs (comma-separated)' : 'Channel ID';
                        const value = Array.isArray(data[key]) ? data[key].join(', ') : data[key];

                        div.innerHTML = `
                                <input type="text" placeholder="${namePlaceholder}" value="${key}" class="w-1/2 md:w-1/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-name="${type}">
                                <input type="text" placeholder="${idPlaceholder}" value="${value}" class="w-5/8 md:w-3/4 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-id="${type}">
                                <button class="remove-btn bg-gray-500  rounded-xl text-red-400 font-bold hover:text-red-500 transition-colors p-2 text-x1 leading-none absolute right-0 top-1/3 -translate-y-1/2">&times;</button>
                            `;
                        div.querySelector('.remove-btn').onclick = () => {
                            div.remove();
                            updateJsonPreview();
                        };
                    }
                }
                div.addEventListener('input', updateJsonPreview);
                container.appendChild(div);
            }
        }
    }

    function createChannelInput(container, name = '', value = '', type) {
        const div = document.createElement('div');
        div.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'gap-2');
        const isReaction = type === 'reaction';
        const isString = type === 'string';
        const namePlaceholder = isReaction ? 'Reaction' : isString ? 'String' : 'Channel Name'
        const idPlaceholder = isReaction || isString ? 'Role ID' : 'Channel ID'
        div.innerHTML = ` 
         <input type="text" placeholder="${namePlaceholder}" value="${name}" class="w-1/2 md:w-1/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-name="${type}">
        <input type="text" placeholder="${idPlaceholder}" value="${value}" class="w-5/8 md:w-3/4 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-id="${type}">
        <button class="remove-btn bg-gray-500  rounded-xl text-red-400 font-bold hover:text-red-500 transition-colors p-2 text-x1 leading-none absolute right-0 top-1/3 -translate-y-1/2">&times;</button>
      `;
        div.querySelector('.remove-btn').onclick = () => {
            div.remove();
            updateJsonPreview();
        };

        container.appendChild(div);
    }

    function getFormValues() {
        const { guildIdInput, modChannelsSection, publicChannelsSection, exclusionsSection, reactionsSection, rolesSection, automodSection } = elements;
        const guildId = guildIdInput.value.trim();
        const modChannels = getSectionValues(modChannelsSection, 'mod');
        const publicChannels = getSectionValues(publicChannelsSection, 'public');
        const exclusions = getSectionValues(exclusionsSection, 'exclusion');
        const reactions = getSectionValues(reactionsSection, 'reaction');
        const strings = getSectionValues(rolesSection, 'role');
        const automodsettings = getSectionValues(automodSection, 'automod');
        return { guildId, config: { modChannels, publicChannels, exclusions, reactions, strings, automodsettings } };
    }

    function updateJsonPreview() {
        const { jsonPreview } = elements;
        const { guildId, config } = getFormValues();
        let previewData = {};
        if (guildId) {
            previewData[guildId] = config;
        } else {
            previewData = { 'placeholder-guild': config };
        }
        jsonPreview.textContent = `${JSON.stringify(previewData, null, 2)} `;
    };

    function showMessage(message, colorClass) {
        const { messageBox } = elements;
        messageBox.textContent = message;
        messageBox.className = `text - center p - 3 rounded - lg ${colorClass} `
        messageBox.classList.remove('hidden');
        setTimeout(() => messageBox.classList.add('hidden'), 5000)
    };

    function handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const uploadedData = JSON.parse(e.target.result);
                allGuildConfigs = uploadedData;
                updateGuildSelect();
                showMessage('Configuration file loaded successfully!', 'bg-green-500');
            } catch (error) {
                showMessage(`Failed to parse file: ${error.message} `, 'bg-red-500');
                console.log(error)
            }
        }
        reader.readAsText(file);
        elements.fileInput.value = '';
    }

    function handleSaveConfig() {
        const { guildId, config } = getFormValues();
        if (!guildId) {
            showMessage('Please enter a Guild ID to save.', 'bg-red-500');
            return;
        }
        if (Object.keys(config.modChannels).length === 0) {
            config.modChannels = {
                mutelogChannel: "channel Id here",
                deletedlogChannel: "channel Id here",
                welcomeChannel: "channel Id here",
                updatedlogChannel: "channel Id here",
                namelogChannel: "channel Id here",
                banlogChannel: "channel Id here",
                appealChannel: "channel Id here",
                applicationChannel: "channel Id here",
                adminChannel: "channel Id here"
            }
        }

        allGuildConfigs[guildId] = config;
        updateGuildSelect();
        showMessage('Configuration saved to memory!', 'bg-green-500');
    }

    async function handleDeleteConfig() {
        const { guildSelect } = elements;
        const currentGuildId = guildSelect.value;
        if (!currentGuildId) {
            showMessage('No guild selected to delete.', 'bg-red-500');
            return;
        }
        const shouldDelete = await confirm(`Are you sure you want to delete the data for Guild ID: ${currentGuildId} from memory ? `)
        if (!shouldDelete) return;
        delete allGuildConfigs[currentGuildId];
        guildSelect.value = '';
        updateGuildSelect();
        showMessage('Configuration cleared from memory!', 'bg-green-500')
    }

    function handleDownloadConfig() {
        const { guildId, config } = getFormValues();
        if (guildId) {
            allGuildConfigs[guildId] = config;
        }
        const fileContent = JSON.stringify(allGuildConfigs, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'guildconfiguration.json'
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a)
        URL.revokeObjectURL(url);
    }

    function confirm(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = "fixed inset-0 bg-black flex items-center justify-center z-50 p-4";
            modal.innerHTML = `
            < div class="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md space-y-4 text-center" >
            <p class="text-lg text-gray-200">${message}</p>
            <div class="flex justify-center gap-4">
              <button id="confirmYes" class="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
              <button id="confirmNo" class="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">No</button>
            </div>
        </div >
            `;
            document.body.appendChild(modal);
            document.getElementById('confirmYes').addEventListener('click', () => { modal.remove(); resolve(true) });
            document.getElementById('confirmNo').addEventListener('click', () => { modal.remove(); resolve(false); });
        });
    }

    //event listeners
    elements.guildSelect.addEventListener('change', updateGuildUI);
    elements.guildIdInput.addEventListener('input', updateJsonPreview);
    elements.uploadConfigBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileChange);
    elements.addPublicChannelBtn.addEventListener('click', () => createChannelInput(elements.publicChannelsSection, '', '', 'public'));
    elements.addExclusionBtn.addEventListener('click', () => createChannelInput(elements.exclusionsSection, '', '', 'exculsion'));
    elements.addReactionBtn.addEventListener('click', () => createChannelInput(elements.reactionsSection, '', '', 'reaction'));
    elements.addStringBtn.addEventListener('click', () => createChannelInput(elements.rolesSection, '', '', 'string'));
    elements.channelsContainer.addEventListener('input', updateJsonPreview)
    elements.saveConfigBtn.addEventListener('click', handleSaveConfig);
    elements.deleteConfigBtn.addEventListener('click', handleDeleteConfig);
    elements.downloadConfigBtn.addEventListener('click', handleDownloadConfig);

    updateGuildSelect();
})
