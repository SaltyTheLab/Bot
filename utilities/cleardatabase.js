import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
export async function clearmodlogs(userId) {
  const db = open({
    filename: './Logging/database.sqlite',
    driver: sqlite3.Database
  });
  db.run(`DELETE FROM warns WHERE userId = ?`, userId);
  db.run(`DELETE FROM mutes WHERE userId = ?`, userId);
  console.log(`✅ Cleared moderation tables for user: ${userId} `);
}