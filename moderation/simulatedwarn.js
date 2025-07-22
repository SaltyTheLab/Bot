import { getActiveWarns } from '../Database/databasefunctions.js';
import { violationWeights } from './violationWeights.js'; // Adjust path as needed

/**
 * Calculate current and future weighted warnings for a user.
 *
 * @param {string} userId - The target user's ID.
 * @param {string|null} newViolationType - Type of the new violation to simulate (optional).
 * @returns {Promise<{ activeWarnings, weightedWarns, futureWeightedWarns, currentWarnWeight }>}
 */
export async function getWarnStats(userId, newViolationType = []) {
    const activeWarnings = getActiveWarns(userId);

    // Sum weights of existing active warnings
    const weightedWarns = activeWarnings.reduce((acc, warn) => {
        const weight = violationWeights[warn.type] || 1;
        return Math.floor(acc + weight);
    }, 0);
    
    const currentWarnWeight = Array.isArray(newViolationType)
        ? newViolationType.reduce((acc, v) => {
            const type = typeof v === 'string' ? v : v?.type;
            const weight = violationWeights[type] || 1;
            return Math.floor(acc + weight);
        }, 0)
        : 0;

    const futureWeightedWarns = weightedWarns + currentWarnWeight;

    return {
        activeWarnings,
        weightedWarns,
        futureWeightedWarns,
        currentWarnWeight
    };
}
