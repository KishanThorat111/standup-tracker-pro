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

    try {
        const { db } = await connectToDatabase();
        const { ObjectId } = require('mongodb');

        const user = await db.collection('users').findOne(
            { _id: new ObjectId(auth.userId) },
            { projection: { password_hash: 0 } }
        );

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            user: { id: user._id.toString(), name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Auth check error:', err);
        res.status(500).json({ error: 'Auth check failed' });
    }
};
