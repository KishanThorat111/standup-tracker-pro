const { connectToDatabase } = require('../_lib/mongodb');
const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { employees, attendance_records, settings } = req.body || {};
    const userId = auth.userId;

    try {
        const { db } = await connectToDatabase();

        // Upsert employees
        if (Array.isArray(employees) && employees.length) {
            const ops = employees.map(emp => ({
                updateOne: {
                    filter: { user_id: userId, local_id: String(emp.id) },
                    update: {
                        $set: {
                            ...emp,
                            user_id: userId,
                            local_id: String(emp.id),
                            synced_at: new Date()
                        }
                    },
                    upsert: true
                }
            }));
            await db.collection('employees').bulkWrite(ops);
        }

        // Upsert attendance records
        if (Array.isArray(attendance_records) && attendance_records.length) {
            const ops = attendance_records.map(rec => ({
                updateOne: {
                    filter: {
                        user_id: userId,
                        employee_id: String(rec.employee_id),
                        date: rec.date
                    },
                    update: {
                        $set: {
                            ...rec,
                            employee_id: String(rec.employee_id),
                            user_id: userId,
                            synced_at: new Date()
                        }
                    },
                    upsert: true
                }
            }));
            await db.collection('attendance_records').bulkWrite(ops);
        }

        // Upsert settings
        if (settings && typeof settings === 'object') {
            const { key, ...settingsData } = settings;
            await db.collection('settings').updateOne(
                { user_id: userId },
                { $set: { ...settingsData, user_id: userId, synced_at: new Date() } },
                { upsert: true }
            );
        }

        res.json({ success: true, synced_at: new Date().toISOString() });
    } catch (err) {
        console.error('Sync push error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
};
