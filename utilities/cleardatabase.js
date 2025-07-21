import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
export async function clearmodlogs(userid) {
  const db = await open({
    filename: './Logging/database.sqlite',
    driver: sqlite3.Database
  });

  await db.run(`DELETE FROM punishments WHERE userId = ?`, [userid]);


  console.log(`✅ Cleared moderation tables for user: ${userid}`);
}