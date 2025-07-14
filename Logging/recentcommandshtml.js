const commandHistory = document.getElementById('commandHistory');
let recentCommands = [];
window.addEventListener('DOMContentLoaded', adjustLayoutByLines);
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
    const box = document.getElementById("jsonBox");
    if (!box) return;

    try {
        const prettyJson = JSON.stringify(JSON.parse(jsonString), null, 2); // Ensure formatting
        const lineCount = prettyJson.split("\n").length;

        const lineHeight = 18; // px, tweak this to match your CSS
        const padding = 20;    // extra room for breathing
        box.style.height = `${lineCount * lineHeight + padding}px`;

        box.textContent = prettyJson;
    } catch (err) {
        console.error("Invalid JSON provided to adjustLayoutByLines:", err);
    }
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


