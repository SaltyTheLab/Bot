const commandHistory = document.getElementById('commandHistory');
const maxCommands = 50;

// Create and insert search input dynamically
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.id = 'searchInput';
searchInput.placeholder = 'Search commands...';
commandHistory.parentNode.insertBefore(searchInput, commandHistory);

let recentCommands = [];
let filteredCommands = [];

async function fetchRecentCommands() {
    try {
        const response = await fetch('Logging/recentCommandslog.json');
        if (!response.ok) throw new Error('Failed to fetch recent commands');

        const commands = await response.json();
        recentCommands = commands.slice(0, maxCommands);
        filteredCommands = recentCommands;
        updateCommandList();
        adjustLayout(filteredCommands.length);
    } catch (err) {
        console.error('Error fetching recent commands:', err);
    }
}

function updateCommandList() {
    commandHistory.innerHTML = '';
    filteredCommands.forEach(cmd => {
        const option = document.createElement('option');
        option.textContent = cmd;
        commandHistory.appendChild(option);
    });
}


function adjustLayout(lineCount) {
    commandHistory.size = Math.min(Math.max(lineCount, 5), 20);
    const fontSize = Math.max(0.8, 1.2 - lineCount * 0.02);
    commandHistory.style.fontSize = `${fontSize}em`;
}

function filterCommands(query) {
    if (!query) {
        filteredCommands = recentCommands;
    } else {
        const lowerQuery = query.toLowerCase();
        filteredCommands = recentCommands.filter(cmd => cmd.toLowerCase().includes(lowerQuery));
    }
    updateCommandList();
    adjustLayout(filteredCommands.length);
}

searchInput.addEventListener('input', (e) => {
    filterCommands(e.target.value);
});

// Initial load
window.addEventListener('DOMContentLoaded', fetchRecentCommands);

// Refresh only when search bar is empty
setInterval(() => {
    if (!searchInput.value.trim()) {
        fetchRecentCommands();
    }
}, 5000);
