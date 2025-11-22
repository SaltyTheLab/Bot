import { ObjectId } from "mongodb";
import db from "./database.js";

const appeals = db.collection('appeals');
const usersCollection = db.collection('users');

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
export async function editNote({ userId: userId, moderatorId = null, note = null, guildId: guildId, id = null }) {
  const newNote = {
    _id: new ObjectId(), userId: userId, moderatorId: moderatorId, note: note, timestamp: Date.now(), guildId: guildId
  };
  const filter = { userId: userId, guildId: guildId }
  const result = !id ? { $push: { notes: newNote } } : { $pull: { notes: { _id: ObjectId.createFromHexString(id) } } }
  await usersCollection.updateOne(filter, result);
}
export async function viewNotes(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId }, { projection: { notes: 1 } })
  return userData ? userData.notes.sort((a, b) => b.timestamp - a.timestamp) : [];
}
// --- Moderation ---
export async function getPunishments(userId, guildId, active = false, pull = false) {
  const history = await usersCollection.findOne({ userId, guildId }, { projection: { punishments: 1 } })
  if (!history)
    return [];
  if (pull && active) {
    const warns = history.punishments.length > 0 ? history.punishments.filter(w => w.type === 'Warn') : []
    const recentwarn = warns.length < 1 ? warns[warns.length - 1] : null
    if (!recentwarn)
      return 0;
    await usersCollection.updateOne({ userId: userId, guildId: guildId },
      { $pull: { punishments: { _id: recentwarn._id } } },
    )
    return 1;
  } else {
    return active ?
      history.punishments.sort((a, b) => b.timestamp - a.timestamp).filter(p => p.active === 1)
      : history.punishments.sort((a, b) => b.timestamp - a.timestamp)
  }
}
export async function editPunishment({ userId, moderatorId, reason = null, durationMs = null, warnType = null, weight = null, channel = null, guildId = null, messagelink = null, id = null }) {
  const newPunishment = {
    _id: new ObjectId(), userId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink
  }
  const result = !id ? { $push: { punishments: newPunishment } } :
    { $pull: { "punishments": { _id: ObjectId.createFromHexString(id) } } }
  const filter = { userId: userId, guildId: guildId }

  await usersCollection.updateOne(filter, result);
}
// --- ban appeals ---
export async function appealsinsert(userId, guildId, banreason, justification, extra) {
  const newAppeal = { _id: new ObjectId(), userId: userId, guildId: guildId, reason: banreason, justification: justification, extra: extra, pending: 1, approved: 0, denied: 0 }
  await appeals.insertOne(newAppeal)
}
export async function appealsget(userId, guildId = null) {
  if (guildId)
    return await appeals.findOne({ userId: userId, guildId: guildId }, { projection: { pending: 1, reason: 1, justification: 1, extra: 1 } }).toArray();
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
    usersCollection.deleteOne({ filter });
    return;
  }
}
//--- blacklist functions ---
export async function getblacklist(userid, guildId) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId }, { projection: { blacklist: 1 } })
  return userData.blacklist ? userData.blacklist : []
}
export async function editblacklist(userId, guildId, roleId, action = 'pull') {
  const filter = { userId: userId, guildId: guildId };
  const update = action == 'push' ? { $push: { blacklist: roleId } }
    : { $pull: { blacklist: roleId } };
  await usersCollection.updateOne(filter, update);
}