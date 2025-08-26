
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
        const expiredWarns = await db.punishmentsCollection.updateMany(
            {
                active: 1,
                timestamp: { $lt: now - twentyFourHours },
            },
            {
                $set: { active: 0 }
            }
        );
        if (expiredWarns.modifiedCount > 0)
            console.log(`✅ Successfully expired ${expiredWarns.modifiedCount} warns.`);
        else {
            console.log('No expired warns found.');
        }

    } catch (error) {
        console.error('❌ An error occurred while clearing expired warns:', error);
    }
}
