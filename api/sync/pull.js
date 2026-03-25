const { connectToDatabase } = require('../_lib/mongodb');
const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    try {
        const { db } = await connectToDatabase();

        const employees = await db.collection('employees')
            .find({ user_id: userId })
            .project({ _id: 0, user_id: 0, synced_at: 0 })
            .toArray();

        // Map local_id back to id for client compatibility
        const cleanEmployees = employees.map(({ local_id, ...rest }) => ({
            ...rest,
            id: rest.id || local_id
        }));

        const attendance_records = await db.collection('attendance_records')
            .find({ user_id: userId })
            .project({ _id: 0, user_id: 0, synced_at: 0 })
            .toArray();

        const settings = await db.collection('settings').findOne(
            { user_id: userId },
            { projection: { _id: 0, user_id: 0, synced_at: 0 } }
        );

        const holidays = await db.collection('holidays')
            .find({ user_id: userId })
            .project({ _id: 0, user_id: 0, synced_at: 0 })
            .toArray();

        res.json({
            employees: cleanEmployees,
            attendance_records,
            settings,
            holidays
        });
    } catch (err) {
        console.error('Sync pull error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
};
