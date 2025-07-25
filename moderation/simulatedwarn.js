import { getActiveWarns } from '../Database/databasefunctions.js';
import { violationWeights } from './violationWeights.js';

/**
 * Calculate current and future weighted warnings for a user.
 * @param {string} userId - The target user's ID.
 * @param {Array<string|{type: string}>} newViolationType - Violations to simulate.
 * @returns {Promise<{ activeWarnings, currentWarnWeight }>}
 */
export async function getWarnStats(userId, newViolationType = []) {
  const activeWarningsPromise = getActiveWarns(userId);

  const currentWarnWeightPromise = Promise.resolve(
    Array.isArray(newViolationType)
      ? newViolationType.reduce((acc, v) => {
          const type = typeof v === 'string' ? v : v?.type;
          const weight = violationWeights[type] || 1;
          return Math.ceil(acc + weight);
        }, 0)
      : 0
  );

  const [activeWarnings, currentWarnWeight] = await Promise.all([
    activeWarningsPromise,
    currentWarnWeightPromise
  ]);

  return {
    activeWarnings,
    currentWarnWeight
  };
}
