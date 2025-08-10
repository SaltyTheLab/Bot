import Weights from './violationWeights.json' with {type: 'json'};
import { getActiveWarns } from '../Database/databasefunctions.js';

const violationWeights = new Map(Weights.violationWeights.map(w => [w.type.toLowerCase(), w.Weight]));
/**
 * Calculate current warnings for a user.
 * @param {string} userId - The target user's ID.
 * @param {Array<string|{type: string}>} newViolationType - Violations to simulate.
 * @returns {Promise<{ activeWarnings, currentWarnWeight }>}
 */
export default async function getWarnStats(userId, guildId, newViolationType = []) {
  //get previous active warnings
  const activeWarningsPromise = getActiveWarns(userId, guildId);
  // get weights of violations
  const currentWarnWeightPromise = Promise.resolve(
    Array.isArray(newViolationType)
      ? Math.ceil(newViolationType.reduce((acc, v) => {
        const type = (typeof v === 'string' ? v : v?.type)?.toLowerCase();
        const weight = violationWeights.get(type) ?? 1;
        return acc + weight;
      }, 0))
      : 0
  );
  //define output variables
  const [activeWarnings, currentWarnWeight] = await Promise.all([
    activeWarningsPromise,
    currentWarnWeightPromise
  ]);
  return { activeWarnings, currentWarnWeight }
}
