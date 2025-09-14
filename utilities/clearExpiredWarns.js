/**
 * Checks the database for expired warnings and updates their status.
 * @param {object} db - Your database connection object.
 */
export default async function clearExpiredWarns(usersCollection) {
    // 24 hours in milliseconds
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
        await usersCollection.updateMany(
            { "punishments.active": 1, },
            { $set: { "punishments.$[elem].active": 0 } },
            { arrayFilters: [{ "elem.timestamp": { $lt: now - twentyFourHours } }] }
        );
        console.log('✅ Expired warns cleared successfully.');
    } catch (error) {
        console.error('❌ An error occurred while clearing expired warns:', error);
    }
}
