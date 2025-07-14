const commandHistory = document.getElementById('commandHistory');
let recentCommands = [];
const maxCommands = 50; // define limit if not already

async function fetchRecentCommands() {
    try {
        const response = await fetch('Logging/recentCommandslog.json');
        if (!response.ok) throw new Error('Failed to fetch recent commands');

        const commands = await response.json();
        recentCommands = commands.slice(0, maxCommands); // trim if too long
        updateCommandList();
        adjustLayout(recentCommands.length);
    } catch (err) {
        console.error('Error fetching recent commands:', err);
    }
}

function updateCommandList() {
    commandHistory.innerHTML = '';
    recentCommands.forEach(cmd => {
        const option = document.createElement('option');
        option.textContent = cmd;
        commandHistory.appendChild(option);
    });
}

function addCommand(command) {
    recentCommands.unshift(command);
    if (recentCommands.length > maxCommands) recentCommands.pop();
    updateCommandList();
    adjustLayout(recentCommands.length);
}

function adjustLayout(lineCount) {
    // Adjust height
    commandHistory.size = Math.min(Math.max(lineCount, 5), 20); // min 5, max 20

    // Adjust font size (optional)
    const fontSize = Math.max(0.8, 1.2 - lineCount * 0.02); // scale with line count
    commandHistory.style.fontSize = `${fontSize}em`;
}

// Initial load and periodic refresh
window.addEventListener('DOMContentLoaded', fetchRecentCommands);
setInterval(fetchRecentCommands, 5000);
