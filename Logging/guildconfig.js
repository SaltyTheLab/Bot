let allGuildConfigs = {};
// ui Elements
// eslint-disable-next-line no-unused-vars
const mainAppDiv = document.getElementById('mainApp');
const guildSelect = document.getElementById('guildSelect');
const guildIdInput = document.getElementById('guildIdInput');
const modChannelsSection = document.getElementById('modChannelsSection');
const publicChannelsSection = document.getElementById('publicChannelsSection');
const exclusionsSection = document.getElementById('exclusionsSection');
const uploadConfigBtn = document.getElementById('uploadConfigBtn');
const fileInput = document.getElementById('fileInput');
const addModChannelBtn = document.getElementById('addModChannelBtn');
const addPublicChannelBtn = document.getElementById('addPublicChannelBtn')
const addExclusionBtn = document.getElementById('addExclusionBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const deleteConfigBtn = document.getElementById('deleteConfigBtn');
const downloadConfigBtn = document.getElementById('downloadConfigBtn');
const jsonPreview = document.getElementById('jsonPreview');
const messageBox = document.getElementById('messageBox');

//Data Handling logic 

const updateGuildSelect = () => {
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
    const currentGuildId = guildSelect.value;
    guildIdInput.value = currentGuildId;
    if (currentGuildId && allGuildConfigs[currentGuildId]) {
        renderConfig(allGuildConfigs[currentGuildId]);
        deleteConfigBtn.classList.remove('hidden');
    } else {
        renderConfig({ modChannels: {}, publicChannels: {}, exclusions: {} })
        deleteConfigBtn.classList.add('hidden');
    }
};

const renderConfig = (config) => {
    clearSections();
    renderChannels(modChannelsSection, config.modChannels, 'mod');
    renderChannels(publicChannelsSection, config.publicChannels, 'public');
    renderChannels(exclusionsSection, config.exclusions, 'exclusion');
    updateJsonPreview();
}

const renderChannels = (container, channels, type) => {
    for (const key in channels) {
        if (Object.hasOwnProperty.call(channels, key)) {
            createChannelInput(container, key, channels[key], type)
        }
    }
}

const createChannelInput = (container, name = '', value = '', type) => {
    const div = document.createElement('div');
    div.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'gap-2');
    div.innerHTML = ` <input type="text" placeholder="Channel Name" value="${name}" class="w-full md:w-1/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-name="${type}">
        <input type="text" placeholder="Channel ID" value="${value}" class="w-full md:w-2/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-lg p-2" data-channel-id="${type}">
        <button class="remove-btn text-red-400 hover:text-red-500 transition-colors p-2 text-xl font-bold leading-none">&times;</button>
      `;
    div.querySelector('.remove-btn').onclick = () => {
        div.remove();
        updateJsonPreview();
    }
    container.appendChild(div);
}

const clearSections = () => {
    modChannelsSection.innerHTML = '';
    publicChannelsSection.innerHTML = '';
    exclusionsSection.innerHTML = '';
}

const getFormValues = () => {
    const guildId = guildIdInput.value.trim();
    const modChannels = getChannelsFromSection(modChannelsSection);
    const publicChannels = getChannelsFromSection(publicChannelsSection);
    const exclusions = getChannelsFromSection(exclusionsSection);
    return { guildId, config: { modChannels, publicChannels, exclusions } };
}

const getChannelsFromSection = (container) => {
    const channels = {};
    const inputs = container.querySelectorAll('[data-channel-name]');
    for (let i = 0; i < inputs.length; i++) {
        const nameInput = inputs[i];
        const idInput = container.querySelectorAll('[data-channel-id]')[i];
        const name = nameInput.value.trim();
        const id = idInput.value.trim();
        if (name && id) {
            channels[name] = id;
        }
    }
    return channels;
}

const updateJsonPreview = () => {
    const allData = { ...allGuildConfigs };
    const { guildId, config } = getFormValues();
    if (guildId) {
        allData[guildId] = config;
    }
    const fileContent = `${JSON.stringify(allData, null, 2)}`;
    jsonPreview.textContent = fileContent;
}

const showMessage = (message, colorClass) => {
    messageBox.textContent = message;
    messageBox.className = `text-center p-3 rounded-lg ${colorClass}`
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 5000)
}

//event listeners 
guildSelect.addEventListener('change', updateGuildUI);
guildIdInput.addEventListener('input', updateJsonPreview);

uploadConfigBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const fileContent = e.target.result;
            let uploadedMap = {};

            try {
                // First, try parsing as pure JSON
                uploadedMap = JSON.parse(fileContent);
            } catch {
                // If that fails, try parsing as a JavaScript module
                const mapRegex = /const\s+guildChannelMap\s*=\s*(\{[\s\S]*?\})/;
                const match = fileContent.match(mapRegex);

                if (match && match[1]) {
                    uploadedMap = new Function(`return ${match[1]}`)();
                } else {
                    throw new Error("Could not find a valid JSON object or 'guildChannelMap' object in file.");
                }
            }

            allGuildConfigs = uploadedMap;
            updateGuildSelect();
            showMessage('Configuration file loaded successfully!', 'bg-green-500');

        } catch (error) {
            showMessage(`Failed to parse file: ${error.message}`, 'bg-red-500');
            console.error("File parsing error:", error);
        }
    };
    reader.readAsText(file);
});

addModChannelBtn.addEventListener('click', () => createChannelInput(modChannelsSection, '', '', 'mod'));
addPublicChannelBtn.addEventListener('click', () => createChannelInput(publicChannelsSection, '', '', 'public'));
addExclusionBtn.addEventListener('click', () => createChannelInput(exclusionsSection, '', '', 'exculsion'));

document.getElementById('channelsContainer').addEventListener('input', updateJsonPreview);

saveConfigBtn.addEventListener('click', () => {
    const { guildId, config } = getFormValues();
    if (!guildId) {
        showMessage('Please enter a Guild ID to save to memory.', 'bg-red-500');
        return;
    }
    allGuildConfigs[guildId] = config;
    updateGuildSelect();
    showMessage('Configuration saved to memory!', 'bg-green-500')
});

deleteConfigBtn.addEventListener('click', async () => {
    const currentGuildId = guildSelect.value;
    if (!currentGuildId) {
        showMessage('No guild selected to clear.', 'bg-red-500');
        return;
    }
    const shouldDelete = await confirm(`Are you sure you want to clear the data for Guild ID: ${currentGuildId} from memory?`);
    if (!shouldDelete) {
        return;
    }

    delete allGuildConfigs[currentGuildId];
    guildSelect.value = "";
    updateGuildSelect();
    updateGuildUI();
    showMessage('Configuration cleared from memory!', 'gb-green-500');
});

downloadConfigBtn.addEventListener('click', () => {
    const { guildId, config } = getFormValues();
    if (guildId) {
        allGuildConfigs[guildId] = config;
    }

    const fileContent = `${JSON.stringify(allGuildConfigs, null, 2)}`;
    const blob = new Blob([fileContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.downlaod = 'channelconfiguration.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Custom confirm function to replace window.confirm
function confirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4";
        modal.innerHTML = `
          <div class="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md space-y-4 text-center">
            <p class="text-lg text-gray-200">${message}</p>
            <div class="flex justify-center gap-4">
              <button id="confirmYes" class="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
              <button id="confirmNo" class="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">No</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmYes').addEventListener('click', () => {
            modal.remove();
            resolve(true)
        });
        document.getElementById('confirmNo').addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
    });
}