import { ObjectId } from "mongodb";
import connectToMongoDB from "./database.js";

let db;
let usersCollection;
async function initializeDb() {
  db = await connectToMongoDB();
  usersCollection = db.collection('users');
};

initializeDb();



// ───── USER XP/LEVEL SYSTEM ─────
//fetch or create the user in the data base
export async function getUser(userId, guildId, modflag = false) {
  let userData = await usersCollection.findOne({ userId: userId, guildId: guildId })
  if (!userData && !modflag) {
    console.log(`[getUser] User ${userId} in guild ${guildId} not found. Attempting to insert new user.`);
    const newUser = {
      userId,
      xp: 0,
      level: 1,
      coins: 100,
      guildId,
      notes: [],
      punishments: []
    }
    try {
      await usersCollection.insertOne(newUser);
      userData = newUser;
      console.log(`[getUser] Successfully inserted and retrieved new user: ${userId} in guild ${guildId}`);
    } catch (error) {
      console.error(`❌ [getUser] Error inserting new user ${userId} in guild ${guildId}:`, error);
      return { userData: { userId, xp: 0, level: 1, coins: 100, guildId }, allUsers: [] };
    }
  };

  return userData ? userData : null;
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
  const update = { $set: { xp: userData.xp, level: userData.level, coins: userData.coins } };
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
//get mutes and warns that are only active 
export async function getActiveWarns(userId, guildId) {
  const userData = await usersCollection.findOne({ userId, guildId });
  if (!userData) return [];
  return userData.punishments.filter(p => p.active === 1).sort((a, b) => b.timestamp - a.timestamp);
}
export async function addPunishment(userId, moderatorId, reason, durationMs, warnType, weight, channel, guildId, messagelink) {
  const newPunishment = {
    _id: new ObjectId(), UserId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink
  }
  await usersCollection.updateOne(
    { userId, guildId },
    { $push: { punishments: newPunishment } }
  );
}

//───── Admin ─────
//clears out a users punishments
export async function clearmodlogs(userId, guildId) {
  const result = await usersCollection.updateOne(
    { userId, guildId },
    { $set: { punishments: [] } }
  );
  return result.modifiedCount > 0;
}
//clears all active warns for a user
export async function clearActiveWarns(userId, guildId) {
  const result = await usersCollection.updateMany(
    { userId, guildId, "punishments.active": 1 },
    { $set: { "punishments.$[elem].active": 0 } },
    { arrayFilters: [{ "elem.active": 1 }] }
  );
  return result.modifiedCount > 0;
}
export async function deletePunishment(userId, guildId, id) {
  await usersCollection.updateOne(
    { userId, guildId },
    { $pull: { "punishments": { _id: ObjectId.createFromHexString(id) } } }
  );
}