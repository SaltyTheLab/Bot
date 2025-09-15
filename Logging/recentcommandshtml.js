const commandHistory = document.getElementById('commandHistory');
const maxCommands = 50;
const searchInput = document.getElementById('searchInput');

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
        option.className = 'bg-gray-900 text-gray-100 justify-left max-w-half'
        commandHistory.appendChild(option);
    });

}


function adjustLayout(lineCount) {
    commandHistory.size = 20
    const fontSize = Math.max(0.8, 1.2 - lineCount * 0.02);
    commandHistory.style.fontSize = `${fontSize}`;
}
searchInput.addEventListener('input', (e) => {
    filterCommands(e.target.value);
});
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
// Initial load
window.addEventListener('DOMContentLoaded', fetchRecentCommands);

// Refresh only when search bar is empty
setInterval(() => {
    if (!searchInput.value.trim()) {
        fetchRecentCommands();
    }
}, 5000);
