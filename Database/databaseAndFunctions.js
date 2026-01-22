import { MongoClient, ObjectId } from 'mongodb';
const client = new MongoClient("mongodb://localhost:27017");
await client.connect().catch(error => { console.error("Failed to connect to MongoDB:", error); process.exit(1); });
export default client.db("Database");
const appeals = client.db("Database").collection('appeals');
const usersCollection = client.db("Database").collection('users');
const counting = client.db("Database").collection('counting state')
const bans = client.db("Database").collection("bans");
const invites = client.db("Database").collection("invites")
const embedIDs = client.db("Database").collection("embedIDs")
const applications = client.db("Database").collection("applications");
const userTrackers = client.db("Database").collection("Usertrackers")
//--- invites ---
export async function getinvites({ guildId }) { const guildinvites = await invites.findOne({}); return guildinvites[guildId] }
export async function editinvites({ guildId, data }) { await invites.updateOne({}, { $set: { [guildId]: data } }, { upsert: true }) }
// --- embedIDs ---
export async function getembedIDs({ guildId }) { const guildembeds = await embedIDs.findOne({}); return guildembeds[guildId] }
export async function editembedIDs({ guildId, data }) { await embedIDs.updateOne({}, { $set: { [guildId]: data } }) }
// --- bans --- 
export async function remove(userid) { await bans.findOneAndDelete({ userId: userid },); }
export async function addone(userid) { await bans.insertOne({ userid: userid }) }
// --- apps --- 
export async function addToApp({ userId, data }) { await applications.findOneAndUpdate({ userId: userId }, { $set: { ...data } }, { upsert: true }); }
export async function removeApp({ userId }) { await applications.deleteOne({ userId: userId }) };
export async function findApp({ userId }) {
  const app = await applications.findOne({ userId: userId })
  if (app) return app
  else return await applications.insertOne({ userId: userId })
}
export async function nukeApps() { await applications.deleteMany({}); }
// --- Counting ---
export async function increment(guildId, lastUser) { counting.findOneAndUpdate({ guildId: guildId }, { $inc: { count: 1 }, $set: { lastuser: lastUser } }) }
export async function getstate(guildId) { return await counting.findOne({ guildId: guildId }, { projection: { lastuser: 1, count: 1 } }); }
export async function initialize(guildId) {
  const state = await counting.findOne({ guildId: guildId });
  if (state) await counting.updateOne({ guildId: guildId }, { $set: { count: 0, lastuser: null } });
  else await counting.insertOne({ guildId: guildId, count: 0, lastuser: null })
}
// --- User Variable Tracking
export async function addTracker(userId, guildId) {
  const tracker = await userTrackers.findOne({ userId: userId, guildId: guildId }, { projection: { total: 1, mediaCount: 1, duplicateCounts: 1, timestamps: 1 } })
  if (tracker)
    return tracker
  else {
    return await userTrackers.findOne({ userId: userId, guildId: guildId }, { projection: { total: 1, mediaCount: 1, duplicateCounts: 1, timestamps: 1 } })
  }
}
export async function updateTracker(userId, guildId, total, timestamps, mediaCount, duplicateCounts) {
  await userTrackers.updateOne({ userId: userId, guildId: guildId }, { $set: { total: total, mediaCount: mediaCount, duplicateCounts: duplicateCounts, timestamps: timestamps } })
}
// --- USER XP/LEVEL SYSTEM ---
export async function getUser({ userId, guildId, modflag = false }) {
  let userData = await usersCollection.findOne({ userId: userId, guildId: guildId }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1 } });
  if (!userData && !modflag) {
    const newUser = { userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId, notes: [], punishments: [], blacklist: [], totalmessages: 0, joinedTime: Date.now() }
    await usersCollection.insertOne(newUser);
    userData = newUser;
  };
  const rank = await usersCollection.countDocuments({
    guildId: guildId, $or: [{ level: { $gt: userData.level } }, { level: userData.level, xp: { $gt: userData.xp } }]
  });
  return { userData: userData, rank: rank + 1 }
}
export async function incrementcoins({ userId, guildId, coins, win }) {
  await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { coins: win ? coins : -coins } });
}
export async function incrementUserProgress({ userId, guildId, xpAmount = 20 }) {
  return await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { xp: xpAmount, totalmessages: 1 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, userId: 1 } });;
}
export async function performLevelUp(userId, guildId) {
  const result = await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { level: 1 }, $set: { xp: 0 } }, { returnDocument: 'after', projection: { level: 1 } })
  console.log(result)
  return result
}
export async function leaderboard(guildId) { return await usersCollection.find({ guildId: guildId }).limit(10).sort({ level: -1, xp: -1 }).toArray() }
export async function saveUser({ userId, guildId, userData = null, twitchId = null }) {
  const filter = { userId: userId, guildId: guildId };
  const update = userData ? { $set: { coins: userData.coins, xp: userData.xp, level: userData.level, totalmessages: userData.totalmessages } } : { $set: { twitchId: twitchId } };
  await usersCollection.updateOne(filter, update)
}
// --- NOTES ---
export async function editNote({ userId, guildId, moderatorId = null, note = null, id = null }) {
  let result;
  if (id) result = { $pull: { notes: { _id: id } } }
  else result = { $push: { notes: { _id: new ObjectId(), moderatorId: moderatorId, note: note, timestamp: Date.now() } } }
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, result);
}
export async function viewNotes(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId }, { projection: { notes: 1 } })
  return userData.notes.sort((a, b) => b.timestamp - a.timestamp);
}
// --- Moderation ---
export async function getPunishments(userId, guildId, active = false) {
  const history = await usersCollection.findOne({ userId: userId, guildId: guildId }, { projection: { punishments: 1 } })
  return active ? history.punishments.filter(p => p.active === 1).sort((a, b) => b.timestamp - a.timestamp) : history.punishments.sort((a, b) => b.timestamp - a.timestamp)
}
export async function editPunishment({ userId, guildId, moderatorId = null, reason = null, durationMs = null, warnType = null, weight = null, channel = null, messagelink = null, id = null }) {
  let result;
  const object = new ObjectId();
  if (id) result = { $pull: { "punishments": { _id: id } } }
  else
    result = { $push: { punishments: { _id: object, userId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink } } }
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, result);
  if (!id)
    return object;
}
export async function clearactive(userId, guildId, punishmentId) {
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": punishmentId }] });
}
// --- ban appeals ---
export async function appealsinsert(userId, guildId, banreason, justification, extra) {
  await appeals.insertOne({ _id: new ObjectId(), userId: userId, guildId: guildId, reason: banreason, justification: justification, extra: extra, pending: 1, approved: 0, denied: 0 })
}
export async function appealsget(userId, guildId = null) {
  if (guildId) return await appeals.findOne({ userId: userId, guildId: guildId }, { projection: { pending: 1, reason: 1, justification: 1, extra: 1 } })
  else return await usersCollection.find({ userId: userId }, { projection: { punishments: 1, guildId: 1 } }).toArray()
}
export async function appealupdate(userId, guildId, approved) {
  const filter = { userId: userId, guildId: guildId }
  const update = { $set: { pending: 0 } }
  if (approved) { await appeals.deleteOne(filter); return; }
  else { update.$set.denied = 1; await appeals.findOneAndUpdate(filter, update); usersCollection.deleteOne(filter); }
}
//--- blacklist functions ---
export async function getblacklist(userid, guildId) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId }, { projection: { blacklist: 1 } })
  return userData ? userData.blacklist : []
}
export async function editblacklist(userId, guildId, roleId, action = 'pull') {
  const filter = { userId: userId, guildId: guildId };
  const update = action == 'push' ? { $push: { blacklist: roleId } } : { $pull: { blacklist: roleId } };
  await usersCollection.updateOne(filter, update);
}
