
/**
 * Checks the database for expired warnings and updates their status.
 * This is the function that will be run by your scheduled task.
 *
 * @param {object} db - Your database connection object.
 */
export default async function clearExpiredWarns(db) {
    // 24 hours in milliseconds
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const now = Date.now();

    console.log('Running scheduled task to clear expired warns...');

    try {
        // Step 1: Find all active warns that are older than 24 hours
        // The query is modified to check for `active = 1` and old `timestamp`
        const expiredWarns = db.prepare(`
            SELECT id FROM punishments
            WHERE active = 1 AND timestamp < ?
        `).all(now - twentyFourHours);
        // Step 2: If any expired warns are found, update their 'active' status to 0
        if (expiredWarns.length > 0) {
            const expiredWarnIds = expiredWarns.map(warn => warn.id);
            const placeHolders = expiredWarnIds.map(() => '?').join(', ');
            const updateStatement = db.prepare(`
                UPDATE punishments
                SET active = 0
                WHERE id IN (${placeHolders})
            `);
            updateStatement.run(expiredWarnIds);
            console.log(`✅ Successfully expired ${expiredWarnIds.length} warns.`);
        } else {
            console.log('No expired warns found.');
        }

    } catch (error) {
        console.error('❌ An error occurred while clearing expired warns:', error);
    }
}
