import db from './database.js';

// ───── USER XP/LEVEL SYSTEM ─────
//fetch or create the user in the data base
export function getUser(userId, guildId) {
  let userData = db.prepare(`
    SELECT * FROM users WHERE userId = ? AND guildId = ?
  `).get(userId, guildId);

  if (!userData) {
    console.log(`[getUser] User ${userId} in guild ${guildId} not found. Attempting to insert new user.`);
    try {
      db.prepare(`
                INSERT INTO users (userId, xp, level, coins, guildId)
                VALUES (?, ?, ?, ?, ?)
            `).run(userId, 0, 1, 100, guildId);

      // After inserting, fetch the newly created user data to ensure it's available
      userData = db.prepare(`
                SELECT * FROM users WHERE userId = ? AND guildId = ?
            `).get(userId, guildId);

      console.log(`[getUser] Successfully inserted and retrieved new user: ${userId} in guild ${guildId}`);
    } catch (error) {
      console.error(`❌ [getUser] Error inserting new user ${userId} in guild ${guildId}:`, error);
      return { userData: { userId, xp: 0, level: 1, coins: 100, guildId }, allUsers: [] };
    }
  };

  return { userData };
}

export function getRank(userId, guildId) {
  const User = db.prepare(`
    SELECT level, xp FROM users WHERE userId = ?  AND guildId = ?
    ORDER BY level DESC, xp DESC`).get(userId, guildId);
  if (!User)
    return null;

  const rank = db.prepare(`SELECT COUNT(*) + 1 AS rank
     FROM users 
     WHERE guildId = ? AND (
    level > ? OR (level = ? AND xp > ?))`).get(guildId, User.level, User.level, User.xp)
  return rank.rank
}

// update user stats
export function saveUser({ userId, xp, level, coins, guildId }) {
  db.prepare(`
    INSERT INTO users (userId, xp, level, coins, guildId)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId, guildId) DO UPDATE SET xp = excluded.xp, level = excluded.level, coins = excluded.coins
  `).run(userId, xp, level, coins, guildId);
}
// ───── NOTES ─────
//add a note to the notes table
export function addNote({ userId, moderatorId, note, guildId }) {
  db.prepare(`INSERT INTO notes (userId, moderatorId, note, timestamp, guildId)
    VALUES (?,?,?,?,?)`).run(userId, moderatorId, note, Date.now(), guildId)
}
//view the notes of a user
export async function viewNotes(userId, guildId) {
  const rows = db.prepare(`SELECT * FROM notes
    WHERE userId = ? AND guildId = ?
    ORDER BY timestamp DESC
    `).all(userId, guildId)
  return Array.isArray(rows) ? rows : [];
}
//remove a note from a user
export function deleteNote(id) {
  db.prepare(`DELETE FROM notes WHERE id = ?
`).run(id);
}

// --- Moderation ---
//get all warns and mutes for a specific user
export async function getPunishments(userId, guildId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND guildId = ?  ORDER BY timestamp DESC
  `).all(userId, guildId);
  return Array.isArray(rows) ? rows : [];
}
//get mutes and warns that are only active 
export async function getActiveWarns(userId, guildId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND active = 1 AND guildId = ? ORDER BY timestamp DESC
  `).all(userId, guildId);
  return Array.isArray(rows) ? rows : [];
}
export function addPunishment(userId, moderatorId, reason, durationMs, warnType, weight, channel, guildId) {
  return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, duration, timestamp, active, weight, type, channel, guildId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, moderatorId, reason, durationMs, Date.now(), 1, weight, warnType, channel, guildId);
}

//───── Admin ─────
//clears out a users punishments
export function clearmodlogs(userId, guildId) {
  db.prepare(`DELETE FROM punishments WHERE userId = ? AND guildId = ?`).run(userId, guildId);
}
//clears all active warns for a user
export function clearActiveWarns(userId, guildId) {
  const result = db.prepare(`
    UPDATE punishments SET active = 0 WHERE userId = ? AND active = 1 AND guildId = ?
  `).run(userId, guildId);
  return result.changes > 0;
}
export function deletePunishment(id) {
  db.prepare(`DELETE FROM punishments WHERE id = ?`).run(id);
}