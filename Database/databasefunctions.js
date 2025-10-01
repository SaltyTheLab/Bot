import { ObjectId } from "mongodb";
import connectToMongoDB from "./database.js";

let db;
let appeals;
let usersCollection;
async function initializeDb() {
  db = await connectToMongoDB();
  usersCollection = db.collection('users');
  appeals = db.collection('appeals');
};

initializeDb();

// ───── USER XP/LEVEL SYSTEM ─────
//fetch or create the user in the data base
export async function getUser(userId, guildId, modflag = false) {
  let userData = await usersCollection.findOne({ userId: userId, guildId: guildId });
  if (!userData && !modflag) {
    const newUser = {
      userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId, notes: [], punishments: [], blacklist: [], totalmessages: 0
    }
    try {
      await usersCollection.insertOne(newUser);
      userData = newUser;
      console.log(`[getUser] Successfully inserted and retrieved new user: ${userId} in guild ${guildId}`);
    } catch (error) {
      console.error(`❌ [getUser] Error inserting new user ${userId} in guild ${guildId}:`, error);
      return { userId, xp: 0, level: 1, coins: 100, guildId, notes: [], punishments: [], blacklist: [], totalmessages: 0 };
    }
  };
  return userData;
}

export async function getUserforappeal(userId) {
  let userData = await usersCollection.find({ userId: userId }, { projection: { userId: 1, punishments: 1, guildId: 1 } }).toArray()
  return userData
}

export async function getdeniedappeals(userId, guildId) {
  const appeal = await appeals.find({ userId: userId, guildId: guildId }, { projection: { denied: 1 } }).toArray()
  return appeal;
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
  const userData = await usersCollection.findOne({ userId: userId, guildId: guildId });
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
//get all warns and mutes for a specific user
export async function getPunishments(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId });
  return userData ? userData.punishments.sort((a, b) => b.timestamp - a.timestamp) : [];
}

export async function unwarn(userId, guildId) {
  const userdata = await usersCollection.findOne({ userId, guildId })
  const warns = userdata.punishments.filter(e => e.type == 'Warn')
  const recentwarn = warns[warns.length - 1]._id.toString()
  await usersCollection.updateOne({ userId: userId, guildId: guildId },
    { $pull: { "punishments": { _id: ObjectId.createFromHexString(recentwarn) } } }
  )
}

//get mutes and warns that are only active 
export async function getActiveWarns(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId });
  if (!userData) return [];
  return userData.punishments.filter(p => p.active === 1).sort((a, b) => b.timestamp - a.timestamp);
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
  const appeallist = await appeals.find({ userId: userId, guildId: guildId, pending: 1 },
    { projection: { reason: 1, justification: 1, extra: 1 } }).toArray()
  return appeallist;
}
export async function appealupdate(userId, guildId, approved) {
  const filter = { userId: userId, guildId: guildId }
  const update = { $set: { pending: 0 } }
  if (approved) {
    update.$set.approved = 1;
    update.$pull.userId.guildId;
  }
  else
    update.$set.denied = 1;
  await appeals.updateOne(filter, update)
}

//───── blacklist functions ─────
export async function getblacklist(userid, guildId) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId })
  return userData.blacklist
}

export async function addblacklist(userId, guildId, roleId) {
  const filter = { userId: userId, guildId: guildId };
  const update = { $push: { blacklist: roleId } };

  await usersCollection.updateOne(filter, update);
}

export async function removeblacklist(userId, guildId, roleId) {
  const filter = { userId: userId, guildId: guildId };
  const update = { $pull: { blacklist: roleId } }

  await usersCollection.updateOne(filter, update);
}

//───── Admin ─────
export async function clearmodlogs(userId, guildId) {
  const result = await usersCollection.updateOne(
    { userId, guildId },
    { $set: { punishments: [] } }
  );
  return result.modifiedCount > 0;
}
export async function deletePunishment(userId, guildId, id) {
  await usersCollection.updateOne(
    { userId, guildId },
    { $pull: { "punishments": { _id: ObjectId.createFromHexString(id) } } }
  );
}