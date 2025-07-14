const commandHistory = document.getElementById('commandHistory');
const maxCommands = 5; // Show up to 5 recent commands

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
// Fetch and update every 5 seconds
setInterval(fetchRecentCommands, 5000);
window.addEventListener('DOMContentLoaded', fetchRecentCommands);

