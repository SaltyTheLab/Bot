import { MongoClient, ObjectId } from 'mongodb';
const client = new MongoClient("mongodb://localhost:27017");
await client.connect().catch(error => { console.error("Failed to connect to MongoDB:", error); process.exit(1); });
export default client.db("Database");

const appeals = client.db("Database").collection('appeals');
const usersCollection = client.db("Database").collection('users');

// --- USER XP/LEVEL SYSTEM ---
export async function getUser(userId, guildId, modflag = false) {
  let userData = await usersCollection.findOne({ userId: userId, guildId: guildId }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1 } });
  if (!userData && !modflag) {
    const newUser = { userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId, notes: [], punishments: [], blacklist: [], totalmessages: 0 }
    await usersCollection.insertOne(newUser);
    userData = newUser;
  };
  const rank = await usersCollection.countDocuments({
    guildId: guildId,
    $or: [
      { level: { $gt: userData.level } },
      { level: userData.level, xp: { $gt: userData.xp } }
    ]
  });
  return { userData: userData, rank: rank + 1 }
}
export async function leaderboard(guildId) {
  return await usersCollection.find({ guildId: guildId }).limit(10).sort({ level: -1, xp: -1 }).toArray()
}
export async function saveUser(userId, guildId, { userData }) {
  const filter = { userId: userId, guildId: guildId };
  const update = { $set: { ...userData } };
  const options = { upsert: true };
  await usersCollection.updateOne(filter, update, options)
}
// --- NOTES ---
export async function editNote({ userId, moderatorId = null, note = null, guildId, id = null }) {
  let result;
  if (id)
    result = { $pull: { notes: { _id: id } } }
  else
    result = { $push: { notes: { _id: new ObjectId(), moderatorId: moderatorId, note: note, timestamp: Date.now() } } }
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, result);
}
export async function viewNotes(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId }, { projection: { notes: 1 } })
  return userData ? userData.notes.sort((a, b) => b.timestamp - a.timestamp) : [];
}
// --- Moderation ---
export async function getPunishments(userId, guildId, active = false) {
  const history = await usersCollection.findOne({ userId, guildId }, { projection: { punishments: 1 } })
  if (!history)
    return [];
  return active ?
    history.punishments.filter(p => p.active === 1)
    : history.punishments
}
export async function editPunishment({ userId, guildId, moderatorId = null, reason = null, durationMs = null, warnType = null, weight = null, channel = null, messagelink = null, id = null }) {
  let result;
  if (id)
    result = { $pull: { "punishments": { _id: id } } }
  else
    result = { $push: { punishments: { _id: new ObjectId(), userId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink } } }
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, result);
}
// --- ban appeals ---
export async function appealsinsert(userId, guildId, banreason, justification, extra) {
  const newAppeal = { _id: new ObjectId(), userId: userId, guildId: guildId, reason: banreason, justification: justification, extra: extra, pending: 1, approved: 0, denied: 0 }
  await appeals.insertOne(newAppeal)
}
export async function appealsget(userId, guildId = null) {
  if (guildId)
    return await appeals.findOne({ userId: userId, guildId: guildId }, { projection: { pending: 1, reason: 1, justification: 1, extra: 1 } })
  else
    return await usersCollection.find({ userId: userId }, { projection: { punishments: 1, guildId: 1 } }).toArray()
}
export async function appealupdate(userId, guildId, approved) {
  const filter = { userId: userId, guildId: guildId }
  const update = { $set: { pending: 0 } }
  if (approved) { await appeals.deleteOne(filter); return; }
  else {
    update.$set.denied = 1;
    await appeals.updateOne(filter, update);
    usersCollection.deleteOne(filter);
  }
}
//--- blacklist functions ---
export async function getblacklist(userid, guildId) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId }, { projection: { blacklist: 1 } })
  return userData ? userData.blacklist : []
}
export async function editblacklist(userId, guildId, roleId, action = 'pull') {
  const filter = { userId: userId, guildId: guildId };
  const update = action == 'push' ? { $push: { blacklist: roleId } }
    : { $pull: { blacklist: roleId } };
  await usersCollection.updateOne(filter, update);
}