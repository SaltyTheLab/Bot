import db from './database.js';

// ───── USER XP/LEVEL SYSTEM ─────
//fetch or create the user in the data base
export function getUser(userId) {
  // Ensure user exists
  db.prepare(`
    INSERT OR IGNORE INTO users (userId, xp, level, coins)
    VALUES (?, ?, ?, ?)
  `).run(userId, 0, 1, 100);

  const userData = db.prepare(`
    SELECT * FROM users WHERE userId = ?
  `).get(userId);

  const allUsers = db.prepare(`
    SELECT * FROM users WHERE userId is not null
    ORDER BY level DESC, xp DESC
  `).all();

  return { userData, allUsers };
}

// update user stats
export function saveUser({ userId, xp, level, coins }) {
  db.prepare(`
    INSERT INTO users (userId, xp, level, coins)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET xp = excluded.xp, level = excluded.level, coins = excluded.coins
  `).run(userId, xp, level, coins);
}
// ───── NOTES ─────
//add a note to the notes table
export function addNote({ userId, moderatorId, note }) {
  db.prepare(`INSERT INTO notes (userId, moderatorId, note, timestamp)
    VALUES (?,?,?,?)`).run(userId, moderatorId, note, Date.now())
}
//view the notes of a user
export function viewNotes(userId) {
  const rows = db.prepare(`SELECT * FROM notes
    WHERE userId = ? 
    ORDER BY timestamp DESC
    `).all(userId)
  return Array.isArray(rows) ? rows : [];
}
//remove a note from a user
export function deleteNote(id) {
  db.prepare(`DELETE FROM notes WHERE id = ?
`).run(id);
}

// ───── WARNS ─────
//add warn to the database
export function addWarn(userId, moderatorId, reason, weight, channel) {
  return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, timestamp, active, weight, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, moderatorId, reason, Date.now(), 1, weight, 'Warn', channel);
}
//get all warns and mutes for a specific user
export async function getPunishments(userId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ?  ORDER BY timestamp DESC
  `).all(userId);
  return Array.isArray(rows) ? rows : [];
}
//get mutes and warns that are only active 
export async function getActiveWarns(userId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND active = 1 ORDER BY timestamp DESC
  `).all(userId);
  return Array.isArray(rows) ? rows : [];
}

// ───── MUTES ─────
// add the mute to the database
export function addMute(userId, moderatorId, reason, durationMs, weight, channel) {
  return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, duration, timestamp, active, weight, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, moderatorId, reason, durationMs, Date.now(), 1, weight, 'Mute', channel);
}

// --- BANS ---
export function addBan(userId, moderatorId, reason, channel) {
  return db.prepare(`INSET INTO punishments (userId, moderatorId, reason, duration, timestamp, active, weight, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, moderatorId, reason, 0, 0, 1, 1, 'Ban', channel)
}

//───── Admin ─────
//clears out a users punishments
export function clearmodlogs(userId) {
  db.prepare(`DELETE FROM punishments WHERE userId = ?`).run(userId);
}
//clears all active warns for a user
export function clearActiveWarns(userId) {
  const result = db.prepare(`
    UPDATE punishments SET active = 0 WHERE userId = ? AND active = 1 AND type = 'Warn'
  `).run(userId);
  return result.changes > 0;
}
//deletes a warn from the database
export function deleteWarn(id) {
  db.prepare(`DELETE FROM punishments WHERE id = ? AND type = 'Warn'`).run(id);
}
//deletes a mute from the database
export function deleteMute(id) {
  db.prepare(`
    DELETE FROM punishments WHERE id = ? AND type = 'Mute'
  `).run(id);
}