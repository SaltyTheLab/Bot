import { MongoClient, ObjectId } from 'mongodb';
import { Note, Punishment } from './types';
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
export async function getinvites(guildId: string) { const guildinvites = await invites.findOne({}); if (!guildinvites) return null; return guildinvites[guildId] }
export async function editinvites(guildId: string, data: object) { await invites.updateOne({}, { $set: { [guildId]: data } }, { upsert: true }) }
// --- embedIDs ---
export async function getembedIDs(guildId: string) { const guildembeds = await embedIDs.findOne({}); if (!guildembeds) return null; return guildembeds[guildId] }
export async function editembedIDs(guildId: string, data: object) { await embedIDs.updateOne({}, { $set: { [guildId]: data } }) }
// --- bans --- 
export async function remove(userId: string) { if (await bans.findOne({ userId })) { await bans.deleteOne({ userId }); return true; } else return false }
export async function addone(userId: string) { await bans.insertOne({ userId }) }
// --- apps --- 
export async function addToApp(userId: string, data: object) { await applications.findOneAndUpdate({ userId: userId }, { $set: { ...data } }); }
export async function removeApp(userId: string) { await applications.deleteOne({ userId: userId }) };
export async function findApp(userId: string) { return await applications.findOne({ userId: userId }) }
export async function addApp(data: object) { await applications.insertOne({ ...data }); }
export async function nukeApps() { await applications.deleteMany({}); }
// --- Counting ---
export async function increment(guildId: string, lastuser: string) { counting.findOneAndUpdate({ guildId }, { $inc: { count: 1 }, $set: { lastuser } }) }
export async function getstate(guildId: string) { return await counting.findOne({ guildId: guildId }, { projection: { lastuser: 1, count: 1 } }); }
export async function initialize(guildId: string) { await counting.updateOne({ guildId: guildId }, { $set: { count: 0, lastuser: null } }, { upsert: true }); }
// --- User Variable Tracking
export async function addTracker(userId: string, guildId: string) {
  await userTrackers.insertOne({ userId: userId, guildId: guildId, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [] })
}
export async function updateTracker(userId: string, guildId: string, mediathreshold: number, hasMedia: boolean, threshold: number, spamthreshold: number) {
  const result = await userTrackers.findOneAndUpdate({ userId: userId, guildId: guildId },
    [
      {
        $set: {
          total: {
            $cond: {
              if: { $gte: ["$total", threshold] },
              then: 1,
              else: { $add: ["$total", 1] }
            }
          },
          mediaCount: {
            $cond: {
              if: { $gte: ["$total", threshold] },
              then: hasMedia ? 1 : 0,
              else: { $add: ["$mediaCount", hasMedia ? 1 : 0] }
            }
          },
          timestamps: {
            $slice: [
              { $concatArrays: ["$timestamps", [Date.now().toString()]] },
              -15
            ]
          },
        }
      }
    ], { returnDocument: 'after' })
  let mediaviolation = false
  let generalSpam = false
  const spamarray = result?.timestamps.filter((stamp: string) => Date.now() - parseInt(stamp) < 1000 * 8) as string[]
  if (result?.mediaCount > mediathreshold && result?.total < threshold) {
    mediaviolation = true;
    await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $set: { mediaCount: 0 } })
  }
  if (spamarray?.length < spamthreshold) { generalSpam = true }
  console.log(generalSpam, mediaviolation)
  return { generalSpam: generalSpam, mediaviolation: mediaviolation }
}
export async function setMessage(userId: string, guildId: string, messageWords: string, threshold: number) {
  const result = await userTrackers.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { [`duplicateCounts.${messageWords}`]: 1 } }, { returnDocument: 'after', upsert: true })
  if (result?.duplicateCounts[messageWords] >= threshold) {
    await userTrackers.updateOne(
      { userId, guildId },
      { $set: { duplicateCounts: {} } }
    );
    return true;
  }
  else
    return false
}
// --- USER XP/LEVEL SYSTEM ---
export async function getUser(userId: string, guildId: string) {
  const userData = await usersCollection.findOne({ userId: userId, guildId: guildId }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1, joinedTime: 1 } });
  if (!userData) return;
  const rank = await usersCollection.countDocuments({ guildId: guildId, $or: [{ level: { $gt: userData.level } }, { level: userData.level, xp: { $gt: userData.xp } }] });
  return { userData: userData, rank: rank + 1 }
}
export async function insertUser(userId: string, guildId: string) {
  await usersCollection.insertOne({ _id: new ObjectId(), userId, guildId, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [] })
}
export async function incrementcoins(userId: string, guildId: string, coins: number, win: boolean) {
  await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { coins: win ? coins : -coins } });
}
export async function incrementUserProgress(userId: string, guildId: string, xpAmount: number = 20) {
  return await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { xp: xpAmount, totalmessages: 1 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, userId: 1 } });;
}
export async function performLevelUp(userId: string, guildId: string) {
  return await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $inc: { level: 1 }, $set: { xp: 0 } }, { returnDocument: 'after', projection: { level: 1 } })
}
export async function leaderboard(guildId: string) { return await usersCollection.find({ guildId: guildId }).limit(10).sort({ level: -1, xp: -1 }).toArray() }
// --- NOTES ---
export async function editNote(userId: string, guildId: string, moderatorId: string, note: string) {
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $push: { notes: { _id: new ObjectId(), moderatorId: moderatorId, note: note, timestamp: Date.now() } } });
}
export async function deleteNote(userId: string, guildId: string, id: ObjectId) { await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $pull: { notes: { _id: id } } }) }
export async function viewNotes(userId: string, guildId: string) {
  const userData = await usersCollection.findOne({ userId, guildId }, { projection: { notes: 1 } })
  if (!userData) return null;
  const notes = userData.notes.sort((a: Note, b: Note) => b.timestamp - a.timestamp);
  console.log(notes)
  return notes;
}
// --- Moderation ---
export async function getPunishments(userId: string | number, guildId: string, active = false) {
  const history = await usersCollection.findOne({ userId: userId, guildId: guildId }, { projection: { punishments: 1 } })
  if (!history) return null;
  return active ? history.punishments.filter((p: Punishment) => p.active === 1).sort((a: Punishment, b: Punishment) => b.timestamp - a.timestamp) : history.punishments.sort((a: Punishment, b: Punishment) => b.timestamp - a.timestamp)
}
export async function editPunishment(userId: string, guildId: string, moderatorId: string | null, reason: string | null, durationMs: number | null, warnType: string | null, weight: number | null, channel: string | null, messagelink: string | null) {
  const object = new ObjectId();
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $push: { punishments: { _id: object, userId: userId, moderatorId: moderatorId, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: weight, type: warnType, channel: channel, guildId: guildId, refrence: messagelink } } });
  return object;
}
export async function deletePunishment(userId: string, guildId: string, id: ObjectId) {
  await usersCollection.findOneAndUpdate({ userId: userId, guildId: guildId }, { $pull: { punishments: { _id: id } } })
}
export async function clearactive(userId: string, guildId: string, punishmentId: ObjectId) {
  await usersCollection.updateOne({ userId: userId, guildId: guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": punishmentId }] });
}
// --- ban appeals ---
export async function appealsinsert(userId: string, guildId: string, banreason: string, justification: string, extra: string,) {
  await appeals.insertOne({ _id: new ObjectId(), userId: userId, guildId: guildId, reason: banreason, justification: justification, extra: extra, pending: 1, denied: false })
}
export async function appealsget(userId: string, guildId: string | null = null) {
  if (guildId) return await appeals.findOne({ userId: userId, guildId: guildId }, { projection: { pending: 1, reason: 1, justification: 1, extra: 1 } })
  else return await usersCollection.find({ userId: userId }, { projection: { punishments: 1, guildId: 1 } }).toArray()
}
export async function appealupdate(userId: string, guildId: string, approved: boolean) {
  const filter = { userId: userId, guildId: guildId }
  if (approved) { await appeals.deleteOne(filter); return; }
  else { await appeals.findOneAndUpdate(filter, { $set: { denied: approved } }); usersCollection.deleteOne(filter); }
}
//--- blacklist functions ---
export async function getblacklist(userid: string, guildId: string) {
  const userData = await usersCollection.findOne({ userId: userid, guildId: guildId }, { projection: { blacklist: 1 } })
  return userData ? userData.blacklist : []
}
export async function editblacklist(userId: string, guildId: string, roleId: string, action: string) {
  const filter = { userId, guildId };
  let update: object;
  if (action == "push")
    update = { $set: { blacklist: roleId } }
  else update = { $pull: { blacklist: roleId } };
  await usersCollection.updateOne(filter, update);
}
