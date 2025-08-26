import connectToMongoDB from "./database.js";

async function migrateData() {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');
    const notesCollection = db.collection('notes');
    const punishmentsCollection = db.collection('punishments');

    console.log("Starting data migration...");

    // --- Migrate Notes ---
    console.log("Migrating notes...");
    const allNotes = await notesCollection.find({}).toArray();
    for (const note of allNotes) {
        await usersCollection.updateOne(
            { userId: note.userId, guildId: note.guildId },
            {
                $push: {
                    notes: {
                        moderatorId: note.moderatorId,
                        note: note.note,
                        timestamp: note.timestamp
                    }
                }
            }
        );
    }
    console.log("Notes migration complete.");

    // --- Migrate Punishments ---
    console.log("Migrating punishments...");
    const allPunishments = await punishmentsCollection.find({}).toArray();
    for (const punishment of allPunishments) {
        await usersCollection.updateOne(
            { userId: punishment.userId, guildId: punishment.guildId },
            {
                $push: {
                    punishments: {
                        moderatorId: punishment.moderatorId,
                        reason: punishment.reason,
                        duration: punishment.duration,
                        timestamp: punishment.timestamp,
                        active: punishment.active,
                        weight: punishment.weight,
                        type: punishment.type,
                        channel: punishment.channel,
                        refrence: punishment.refrence
                    }
                }
            }
        );
    }
    console.log("Punishments migration complete.");

    console.log("Migration finished successfully! You can now drop the old collections.");
}

migrateData().catch(console.error);