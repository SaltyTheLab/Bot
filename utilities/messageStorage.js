// utilities/messageStorage.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../embeds/EmbedIDs.json');

/**
 * Loads the raw array data from EmbedIDs.json.
 * This function is now solely responsible for loading the array as is.
 * @returns {Array<{name: string, messageId: string, channelid: string}>} An array of embed configurations.
 */
export function loadMessageIDs() {
    if (fs.existsSync(filePath)) {
        try {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const parsedData = JSON.parse(rawData);

            if (!Array.isArray(parsedData)) {
                // If the file content is not an array (e.g., empty object,
                // or malformed JSON),
                console.warn(`[WARN] EmbedIDs.json content is not a valid array. Found type: ${typeof parsedData}. Returning empty array.`);
                return [];
            } else
                return parsedData; // Return the raw array directly as parsed
        } catch (error) {
            // Catch JSON parsing errors or file read errors
            console.error(`[ERROR] Failed to parse EmbedIDs.json or read file: ${error.message}. Returning empty array.`);
            return [];
        }
    }
    // If the file does not exist, return an empty array.
    return [];
}

/**
 * Saves an array of embed data back into the EmbedIDs.json file.
 * This function now expects and saves a raw array.
 * @param {Array<{name: string, messageId: string, channelid: string}>} configArray The array of embed configurations to save.
 */
export function saveMessageIDs(configArray) {
    if (!Array.isArray(configArray)) {
        console.error("[ERROR] Attempted to save non-array data to EmbedIDs.json. Skipping save.");
        return;
    }
    fs.writeFileSync(filePath, JSON.stringify(configArray, null, 4), 'utf-8');
    console.log(`[INFO] Saved ${configArray.length} embed entries to EmbedIDs.json.`);
}