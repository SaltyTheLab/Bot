export async function resetModerationTables() {
    const db = await dbPromise;

    await db.exec(`
        DROP TABLE IF EXISTS warns;
        DROP TABLE IF EXISTS mutes;

      CREATE TABLE IF NOT EXISTS warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        active INTEGER DEFAULT 1
      )
      CREATE TABLE IF NOT EXISTS mutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
    )

    `);

    console.log('✅ Moderation tables reset.');
}