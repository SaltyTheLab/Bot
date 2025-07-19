import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
export async function clearmodlogs(userid) {
  const db = await open({
    filename: './Logging/database.sqlite',
    driver: sqlite3.Database
  });

  const { changes: warnsDeleted } = await db.run(`DELETE FROM warns WHERE userId = ?`, [userid]);
  const { changes: mutesDeleted } = await db.run(`DELETE FROM mutes WHERE userId = ?`, [userid]);

  console.log(`✅ Cleared moderation tables for user: ${userid}`);
  console.log(`Warns deleted: ${warnsDeleted}, Mutes deleted: ${mutesDeleted}`);
  console.log(`✅ Cleared moderation tables for user: ${userid} `);
}