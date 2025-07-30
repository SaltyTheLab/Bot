import { getActiveWarns } from '../Database/databasefunctions.js';
import { violationWeights } from './violationWeights.js';

/**
 * Calculate current warnings for a user.
 * @param {string} userId - The target user's ID.
 * @param {Array<string|{type: string}>} newViolationType - Violations to simulate.
 * @returns {Promise<{ activeWarnings, currentWarnWeight }>}
 */
export async function getWarnStats(userId, newViolationType = []) {
  //get previous active warnings
  const activeWarningsPromise = getActiveWarns(userId);
// get weights of violations
  const currentWarnWeightPromise = Promise.resolve(
    Array.isArray(newViolationType)
      ? Math.ceil(newViolationType.reduce((acc, v) => {
          const type = typeof v === 'string' ? v : v?.type;
          const weight = violationWeights[type] || 1;
          return acc + weight;
        }, 0))
      : 0
  );
  
  //define output variables
  const [activeWarnings, currentWarnWeight] = await Promise.all([
    activeWarningsPromise,
    currentWarnWeightPromise
  ]);

  return {
    activeWarnings,
    currentWarnWeight
  };
}
