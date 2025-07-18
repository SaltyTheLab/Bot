import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
export async function resetModerationTables() {
  const dbPromise = open({
    filename: './Logging/database.sqlite',
    driver: sqlite3.Database
  });

  dbPromise.then(async db => {

    db.exec(`   
      DROP TABLE IF EXISTS warns;
        DROP TABLE IF EXISTS mutes;
  

      CREATE TABLE IF NOT EXISTS warns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      moderatorId TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      weight INTEGER DEFAULT 1,
      type TEXT
    );
    CREATE TABLE IF NOT EXISTS mutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      moderatorId TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      active DEFAULT 1,
      weight INTEGER DEFAULT 1,
      type TEXT
    );

    `)
  });

  console.log('✅ Moderation tables reset.');
}