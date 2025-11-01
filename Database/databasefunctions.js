import { ObjectId } from "mongodb";
import db from "./database.js";

const appeals = db.collection('appeals');
const usersCollection = db.collection('users');

// ───── USER XP/LEVEL SYSTEM ─────
//fetch or create the user in the data base
export async function getUser(userId, guildId, modflag = false) {
  let userData = await usersCollection.findOne({ userId: userId, guildId: guildId });
  if (!userData && !modflag) {
    const newUser = { userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId, notes: [], punishments: [], blacklist: [], totalmessages: 0 }
    await usersCollection.insertOne(newUser);
    userData = newUser;
  };
  return userData;
}

export async function getRank(userId, guildId) {
  const User = await usersCollection.findOne({ userId: userId, guildId: guildId });
  if (!User)
    return null;
  const rank = await usersCollection.countDocuments({
    guildId: guildId,
    $or: [
      { level: { $gt: User.level } },
      { level: User.level, xp: { $gt: User.xp } }
    ]
  });
  return rank + 1;
}
export async function leaderboard(guildId) {
  return await usersCollection.find({ guildId: guildId }).limit(10).sort({ level: -1, xp: -1 }).toArray()
}

// update user stats
export async function saveUser({ userData }) {
  const filter = { userId: userData.userId, guildId: userData.guildId };
  const update = { $set: { xp: userData.xp, level: userData.level, coins: userData.coins, totalmessages: userData.totalmessages } };
  const options = { upsert: true };
  await usersCollection.updateOne(filter, update, options)
}
// ───── NOTES ─────
//add a note to the notes table
export async function addNote({ userId, moderatorId, note, guildId }) {
  const newNote = {
    _id: new ObjectId(), userId: userId, moderatorId: moderatorId, note: note, timestamp: Date.now(), guildId: guildId
  };
  await usersCollection.updateOne(
    { userId, guildId },
    { $push: { notes: newNote } }
  );
}
//view the notes of a user
export async function viewNotes(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId }, { notes: 1 })
  return userData ? userData.notes.sort((a, b) => b.timestamp - a.timestamp) : [];
}
//remove a note from a user
export async function deleteNote(userId, guildId, id) {
  await usersCollection.updateOne(
    { userId: userId, guildId: guildId },
    { $pull: { notes: { _id: ObjectId.createFromHexString(id) } } }
  )
}

// --- Moderation ---
export async function getPunishments(userId, guildId, active = false) {
  const userData = await usersCollection.findOne({ userId, guildId }, { punishments: 1 })
  return active ?
    userData.punishments.sort((a, b) => b.timestamp - a.timestamp).filter(p => p.active === 1)
    : userData.punishments.sort((a, b) => b.timestamp - a.timestamp);
}
export async function unwarn(userId, guildId) {
  const userdata = await usersCollection.findOne({ userId: userId, guildId: guildId }, { punishments: 1 })
  const warns = userdata.filter(e => e.type == 'Warn' && e.active == 1)
  const recentwarn = warns[warns.length - 1]._id.toString()
  await usersCollection.updateOne({ userId: userId, guildId: guildId },
    { $pull: { punishments: { _id: ObjectId.createFromHexString(recentwarn) } } },
  )
}

export async function addPunishment(userId, moderatorId, reason, durationMs, warnType, weight, channel, guildId, messagelink) {
  const newPunishment = {
    _id: new ObjectId(), userId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink
  }
  await usersCollection.updateOne(
    { userId: userId, guildId: guildId },
    { $push: { punishments: newPunishment } }
  );
}
// ───── ban appeals ─────
export async function appealsinsert(userId, guildId, banreason, justification, extra) {
  const newAppeal = { _id: new ObjectId(), userId: userId, guildId: guildId, reason: banreason, justification: justification, extra: extra, pending: 1, approved: 0, denied: 0 }
  await appeals.insertOne(newAppeal)
}
export async function appealsget(userId, guildId) {
  const appeallist = await appeals.findOne({ userId: userId, guildId: guildId },
    { projection: { pending: 1, reason: 1, justification: 1, extra: 1 } }).toArray()
  return appeallist;
}
export async function appealupdate(userId, guildId, approved) {
  const filter = { userId: userId, guildId: guildId }
  const update = { $set: { pending: 0 } }
  if (approved) { await appeals.deleteOne(filter); return; }
  else { update.$set.denied = 1; await appeals.updateOne(filter, update); return; }
}
export async function getUserForAppeal(userId) {
  const data = await usersCollection.find({ userId: userId }, { projection: { punishments: 1, guildId: 1 } }).toArray()
  return data.punishments.filter(p => p.type === 'Ban')
}

//───── blacklist functions ─────
export async function getblacklist(userid, guildId) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId })
  return userData.blacklist
}

export async function editblacklist(userId, guildId, roleId, action = 'pull') {
  const filter = { userId: userId, guildId: guildId };
  const update = action == 'push' ? { $push: { blacklist: roleId } }
    : { $pull: { blacklist: roleId } };
  await usersCollection.updateOne(filter, update);
}
//───── Admin ─────
export async function deletePunishment(userId, guildId, id) {
  await usersCollection.updateOne(
    { userId, guildId },
    { $pull: { "punishments": { _id: ObjectId.createFromHexString(id) } } }
  );
}