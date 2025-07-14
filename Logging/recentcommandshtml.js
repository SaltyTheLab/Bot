const commandHistory = document.getElementById('commandHistory');
let recentCommands = [];
async function fetchRecentCommands() {
    try {
        const response = await fetch('Logging/recentCommandslog.json');
        if (!response.ok) throw new Error('Failed to fetch recent commands');
        const recentCommands = await response.json();
        updateCommandHistory(recentCommands);
    } catch (err) {
        console.error('Error fetching recent commands:', err);
    }
}

function updateCommandHistory(commands) {
    const commandHistory = document.getElementById('commandHistory');
    commandHistory.innerHTML = '';
    commands.forEach(cmd => {
        const option = document.createElement('option');
        option.text = cmd;
        commandHistory.add(option);
    });
}

function addCommand(command) {
    // Add new command to the beginning of the array
    recentCommands.unshift(command);

    // Limit array length
    if (recentCommands.length > maxCommands) {
        recentCommands.pop();
    }

    // Clear current listbox items
    commandHistory.innerHTML = "";

    // Add updated commands to the listbox
    recentCommands.forEach(cmd => {
        const option = document.createElement('option');
        option.text = cmd;
        commandHistory.add(option);
    });
}
function adjustLayoutByLines(jsonString) {
    const data = document.getElementById("commandHistory").textContent;
    const selectElement = document.getElementById('commandHistory');
    const dynamicSize = data.height || 5; 
    selectElement.size = dynamicSize;

    const lineCount = data.lineCount; // e.g., 7
    const fontSize = Math.max(1, 5 - lineCount * 0.2); // tweak scale as needed

    selectElement.textContent = `Line count: ${lineCount}`;
    selectElement.style.fontSize = `${fontSize}em`;
}


fetch('Logging/recentCommandslog.json')
    .then(response => response.text())
    .then(text => {
        const lineCount = text.split('\n').length;
        adjustLayoutByLines(lineCount);
    });

// Fetch and update every 5 seconds
window.addEventListener('DOMContentLoaded', fetchRecentCommands);
setInterval(fetchRecentCommands, 5000);


