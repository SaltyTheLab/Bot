import fs from 'fs/promises';
import path from 'path';


/**
 * Loads the applications data from the JSON file.
 * @returns {Promise<object>} The applications object.
 */
export async function loadApplications() {
    const applicationsFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'applications.json');
    try {
        const data = await fs.readFile(applicationsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist, return an empty object to start a new file
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error; // Re-throw other errors
    }
}

/**
 * Saves the applications object to the JSON file.
 * @param {object} applicationsObject The object to save.
 */
export async function saveApplications(applicationsObject) {
    const applicationsFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'applications.json');
    try {
        const data = JSON.stringify(applicationsObject, null, 2);
        await fs.writeFile(applicationsFilePath, data);
        console.log('Applications data saved.');
    } catch (error) {
        console.error('Failed to save applications data:', error);
    }
}

export async function addBan(userId) {
    let bans = [];
    const bansFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'commandsbans.json');
    try {
        // Read the file and parse the JSON content
        const data = await fs.readFile(bansFilePath, 'utf8');
        bans = JSON.parse(data);

        // Ensure the parsed data is an array
        if (!Array.isArray(bans)) {
            console.error('❌ The bans file is not a valid JSON array. Resetting file.');
            bans = [];
        }
    } catch (error) {
        // Handle cases where the file doesn't exist
        if (error.code === 'ENOENT') {
            console.log('⚠️ Bans file not found. Creating a new one.');
        } else {
            // Log other parsing or reading errors
            console.error('❌ Failed to read or parse the bans file:', error);
        }
    }

    // Add the user ID to the array if it's not already there
    if (!bans.includes(userId)) {
        bans.push(userId);
    }

    try {
        // Write the updated array back to the file
        await fs.writeFile(bansFilePath, JSON.stringify(bans, null, 2), 'utf8');
        console.log(`✅ User ${userId} has been successfully added to the command bans list.`);
    } catch (error) {
        console.error('❌ Failed to write to the bans file:', error);
    }
}

export async function loadbans() {
    const bansFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'commandsbans.json');
    const data = await fs.readFile(bansFilePath, 'utf8');
    let bans = JSON.parse(data);

    // Ensure the parsed data is an array
    if (!Array.isArray(bans)) {
        console.error('❌ The bans file is not a valid JSON array. Resetting file.');
        bans = [];
    }
    return bans;
}

export async function saveBans(bansArray) {
    const bansFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'commandsbans.json');
    try {
        await fs.writeFile(bansFilePath, JSON.stringify(bansArray, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ Failed to write to the bans file:', error);
    }
}

export async function load(filepath) {
    const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
    return data;
}

export async function save(filepath, data) {
    try {
        fs.writeFile(filepath, JSON.stringify(data))
    } catch (err) {
        console.error(`❌ Failed to write to ${filepath}:`, err);
    }
}