import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Open database
const dbPromise = open({
  filename: './Logging/database.sqlite',
  driver: sqlite3.Database
});

// Initialize tables
dbPromise.then(async db => {
  const tableSchemas = [
    `CREATE TABLE IF NOT EXISTS warns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      moderatorId TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      weight INTEGER DEFAULT 1,
      type TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS mutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      moderatorId TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      active DEFAULT 1,
      weight INTEGER DEFAULT 1,
      type TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      userId TEXT,
      guildId TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      PRIMARY KEY (userId, guildId)
    )`
  ];

  for (const schema of tableSchemas) {
    await db.exec(schema);
  }
});

// Helpers
const getDb = async () => await dbPromise;

// ───── USER XP/LEVEL SYSTEM ─────

export async function getUserAsync(userId, guildId) {
  const db = await getDb();
  const row = await db.get(`SELECT * FROM users WHERE userId = ? AND guildId = ?`, [userId, guildId]);

  if (row) return row;

  await db.run(`INSERT INTO users (userId, guildId, xp, level) VALUES (?, ?, 0, 0)`, [userId, guildId]);
  return { userId, guildId, xp: 0, level: 0 };
}

export async function updateUser(userId, guildId, xp, level) {
  const db = await getDb();
  await db.run(
    `UPDATE users SET xp = ?, level = ? WHERE userId = ? AND guildId = ?`,
    [xp, level, userId, guildId]
  );
}

export async function saveUserAsync({ userId, guildId, xp, level }) {
  const db = await getDb();
  await db.run(`
    INSERT INTO users (userId, guildId, xp, level) VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, guildId) DO UPDATE SET xp = excluded.xp, level = excluded.level
  `, [userId, guildId, xp, level]);
}

// ───── WARNS ─────

export async function addWarn(userId, moderatorId, reason, weight = 1, type = null) {
  const db = await getDb();
  return db.run(`
    INSERT INTO warns (userId, moderatorId, reason, timestamp, active, weight, type)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `, [userId, moderatorId, reason, Date.now(), weight, type]);
}

export async function getWarns(userId) {
  const db = await getDb();
  return db.all(`SELECT * FROM warns WHERE userId = ? ORDER BY timestamp DESC`, [userId]);
}

export async function getActiveWarns(userId) {
  const db = await getDb();
  return db.all(`SELECT userId, moderatorId, reason, timestamp, weight, type 
    FROM warns
    WHERE userId = ? AND active = 1 
    ORDER BY timestamp DESC`, [userId]);
}

export async function clearActiveWarns(userId) {
  const db = await getDb();
  const result = await db.run(`UPDATE warns SET active = 0 WHERE userId = ? AND active = 1`, [userId]);
  return result.changes > 0;
}

export async function deleteWarn(id) {
  const db = await getDb();
  await db.run(`DELETE FROM warns WHERE id = ?`, [id]);
}

// ───── MUTES ─────

export async function addMute(userId, moderatorId, reason, durationMs, weight = 1, type = null) {
  const db = await getDb();
  return db.run(`
    INSERT INTO mutes (userId, moderatorId, reason, duration, timestamp, active, weight, type)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `, [userId, moderatorId, reason, durationMs, Date.now(), weight, type]);
}

export async function getMutes(userId) {
  const db = await getDb();
  return db.all(`SELECT * FROM mutes WHERE userId = ? ORDER BY timestamp DESC`, [userId]);
}

export async function deleteMute(id) {
  const db = await getDb();
  await db.run(`DELETE FROM mutes WHERE id = ?`, [id]);
}
