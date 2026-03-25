const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

let cached = global.__mongoCache;
if (!cached) {
    cached = global.__mongoCache = { client: null, db: null, promise: null };
}

async function connectToDatabase() {
    if (cached.client && cached.db) {
        return { client: cached.client, db: cached.db };
    }

    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    if (!cached.promise) {
        cached.promise = new MongoClient(uri).connect();
    }

    cached.client = await cached.promise;
    cached.db = cached.client.db('standup_tracker');

    // Ensure indexes exist
    await cached.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await cached.db.collection('employees').createIndex({ user_id: 1, local_id: 1 }, { unique: true });
    await cached.db.collection('attendance_records').createIndex(
        { user_id: 1, employee_id: 1, date: 1 },
        { unique: true }
    );
    await cached.db.collection('settings').createIndex({ user_id: 1 }, { unique: true });

    return { client: cached.client, db: cached.db };
}

module.exports = { connectToDatabase };
