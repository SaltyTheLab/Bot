document.addEventListener('DOMContentLoaded', () => {
    let allGuildConfigs = {};
    // ui Elements
    const elements = {
        guildSelect: document.getElementById('guildSelect'),
        guildIdInput: document.getElementById('guildIdInput'),
        modChannelsSection: document.getElementById('modChannelsSection'),
        publicChannelsSection: document.getElementById('publicChannelsSection'),
        exclusionsSection: document.getElementById('exclusionsSection'),
        reactionSection: document.getElementById('reactionSection'),
        stringSection: document.getElementById('stringSection'),
        uploadConfigBtn: document.getElementById('uploadConfigBtn'),
        fileInput: document.getElementById('fileInput'),
        addModChannelBtn: document.getElementById('addModChannelBtn'),
        addPublicChannelBtn: document.getElementById('addPublicChannelBtn'),
        addExclusionBtn: document.getElementById('addExclusionBtn'),
        addReactionBtn: document.getElementById('addReactionBtn'),
        addStringBtn: document.getElementById('addStringBtn'),
        saveConfigBtn: document.getElementById('saveConfigBtn'),
        deleteConfigBtn: document.getElementById('deleteConfigBtn'),
        downloadConfigBtn: document.getElementById('downloadConfigBtn'),
        jsonPreview: document.getElementById('jsonPreview'),
        messageBox: document.getElementById('messageBox'),
        channelsContainer: document.getElementById('channelsContainer')
    }

    //Data Handling logic 

    const updateGuildSelect = () => {
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

    const updateGuildUI = () => {
        const { guildSelect, guildIdInput, deleteConfigBtn } = elements;
        const currentGuildId = guildSelect.value;
        guildIdInput.value = currentGuildId;
        const configToRender = currentGuildId && allGuildConfigs[currentGuildId] ?
            allGuildConfigs[currentGuildId] : { modChannels: {}, publicChannels: {}, exclusions: {}, reactions: {}, roles: {} }
        renderConfig(configToRender)
        deleteConfigBtn.classList.toggle('hidden', !currentGuildId)

    };


    const renderConfig = (config) => {
        clearSections();
        renderChannels(elements.modChannelsSection, config.modChannels, 'mod');
        renderChannels(elements.publicChannelsSection, config.publicChannels, 'public');
        renderChannels(elements.exclusionsSection, config.exclusions, 'exclusion');
        renderChannels(elements.reactionSection, config.reactions, 'reactions');
        renderChannels(elements.stringSection, config.roles, 'string')
        updateJsonPreview();
    }

    const clearSections = () => {
        elements.modChannelsSection.innerHTML = '';
        elements.publicChannelsSection.innerHTML = '';
        elements.exclusionsSection.innerHTML = '';
        elements.reactionSection.innerHTML = '';
        elements.stringSection.innerHTML = '';
    }

    const createChannelInput = (container, name = '', value = '', type) => {
        const div = document.createElement('div');
        div.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'gap-2');
        const isReaction = type === 'reaction';
        const isString = type === 'string';
        const input1Placeholder = isReaction ? 'Reaction' : isString ? 'String' : 'Channel Name'
        const input2Placeholder = isReaction || isString ? 'Role ID' : 'Channel ID'
        div.innerHTML = ` 
        <input type="text" placeholder="${input1Placeholder}" value="${name}" class="w-full md:w-1/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-name="${type}">
        <input type="text" placeholder="${input2Placeholder}" value="${value}" class="w-full md:w-2/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-id="${type}">
        <button class="remove-btn text-red-400 hover:text-red-500 transition-colors p-2 text-xl font-bold leading-none">&times;</button>
      `;
        div.querySelector('.remove-btn').onclick = () => {
            div.remove();
            updateJsonPreview();
        }
        container.appendChild(div);
    }

    const renderChannels = (container, channels, type) => {
        for (const key in channels) {
            if (Object.hasOwnProperty.call(channels, key)) {
                createChannelInput(container, key, channels[key], type)
            }
        }
    }

    const getFormValues = () => {
        const { guildIdInput, modChannelsSection, publicChannelsSection, exclusionsSection, reactionSection, stringSection } = elements;
        const guildId = guildIdInput.value.trim();
        const modChannels = getChannelsFromSection(modChannelsSection);
        const publicChannels = getChannelsFromSection(publicChannelsSection);
        const exclusions = getChannelsFromSection(exclusionsSection);
        const reactions = getChannelsFromSection(reactionSection);
        const strings = getChannelsFromSection(stringSection)
        return { guildId, config: { modChannels, publicChannels, exclusions, reactions, strings } };
    }

    const getChannelsFromSection = (container) => {
        const channels = {};
        const inputs = container.querySelectorAll('input[data-channel-name]');
        inputs.forEach(nameInput => {
            const idInput = nameInput.nextElementSibling;
            const name = nameInput.value.trim();
            let id = idInput.value.trim();

            if (id.includes(',')) {
                id = id.split(',').map(role => role.trim());
            }
            if (name && id) {
                channels[name] = id;
            }

        })
        return channels;
    };

    const updateJsonPreview = () => {
        const { jsonPreview } = elements;
        const allData = { ...allGuildConfigs }
        const { guildId, config } = getFormValues();
        if (guildId) {
            allData[guildId] = config;
        }
        jsonPreview.textContent = `${JSON.stringify(allData, null, 2)} `;
    };

    const showMessage = (message, colorClass) => {
        const { messageBox } = elements;
        messageBox.textContent = message;
        messageBox.className = `text -center p-3 rounded-lg ${colorClass} `
        messageBox.classList.remove('hidden');
        setTimeout(() => messageBox.classList.add('hidden'), 5000)
    };

    const handleFileChange = (event) => {
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
                showMessage(`Failed to parse file: ${error.message}`, 'bg-red-500');
                console.log(error)
            }
        }
        reader.readAsText(file);
    }

    const handleSaveConfig = () => {
        const { guildId, config } = getFormValues();
        if (!guildId) {
            showMessage('Please enter a Guild ID to save.', 'bg-red-500')
            return;
        }
        allGuildConfigs[guildId] = config;
        updateGuildSelect();
        showMessage('Configuration saved to memory!', 'bg-green-500');
    }

    const handleDeleteConfig = async () => {
        const { guildSelect } = elements;
        const currentGuildId = guildSelect.value;
        if (!currentGuildId) {
            showMessage('No guild selected to delete.', 'bg-red-500');
            return;
        }
        const shouldDelete = await confirm(`Are you sure you want to delete the data for Guild ID: ${currentGuildId} from memory?`)
        if (!shouldDelete) return;
        delete allGuildConfigs[currentGuildId];
        guildSelect.value = '';
        updateGuildSelect();
        showMessage('Configuration cleared from memory!', 'bg-green-500')
    }

    const handleDownloadConfig = () => {
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
        <div class="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md space-y-4 text-center" >
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
    elements.addModChannelBtn.addEventListener('click', () => createChannelInput(elements.modChannelsSection, '', '', 'mod'));
    elements.addPublicChannelBtn.addEventListener('click', () => createChannelInput(elements.publicChannelsSection, '', '', 'public'));
    elements.addExclusionBtn.addEventListener('click', () => createChannelInput(elements.exclusionsSection, '', '', 'exculsion'));
    elements.addReactionBtn.addEventListener('click', () => createChannelInput(elements.reactionSection, '', '', 'reaction'));
    elements.addStringBtn.addEventListener('click', () => createChannelInput(elements.stringSection, '', '', 'string'))
    elements.channelsContainer.addEventListener('input', updateJsonPreview)
    elements.saveConfigBtn.addEventListener('click', handleSaveConfig);
    elements.deleteConfigBtn.addEventListener('click', handleDeleteConfig);
    elements.downloadConfigBtn.addEventListener('click', handleDownloadConfig);

    updateGuildSelect();
})
