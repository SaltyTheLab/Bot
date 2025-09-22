import fs from 'fs/promises';
import path from 'path';

const applicationsFilePath = path.join(process.cwd(), 'BotListeners', 'Extravariables', 'applications.json');

/**
 * Loads the applications data from the JSON file.
 * @returns {Promise<object>} The applications object.
 */
export async function loadApplications() {
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
    try {
        const data = JSON.stringify(applicationsObject, null, 2);
        await fs.writeFile(applicationsFilePath, data);
        console.log('Applications data saved.');
    } catch (error) {
        console.error('Failed to save applications data:', error);
    }
}