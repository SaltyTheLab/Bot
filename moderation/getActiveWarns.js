import Weights from './violationWeights.json' with {type: 'json'};
import { getActiveWarns } from '../Database/databasefunctions.js';

const violationWeights = new Map(Weights.violationWeights.map(w => [w.type.toLowerCase(), w.Weight]));

export default async function getWarnStats(userId, guildId, newViolationType = []) {
  //get previous active warnings
  const activeWarningsPromise = await getActiveWarns(userId, guildId);
  // get weights of violations
  const currentWarnWeightPromise = Promise.resolve(
    Math.ceil(newViolationType.reduce((acc, v) => {
      const type = (typeof v === 'string' ? v : v.type)?.toLowerCase();
      const weight = violationWeights.get(type) ?? 1;
      return acc + weight;
    }, 0))
  );
  //define output variables
  const [activeWarnings, currentWarnWeight] = await Promise.all([
    activeWarningsPromise,
    currentWarnWeightPromise
  ]);
  return { activeWarnings, currentWarnWeight }
}
