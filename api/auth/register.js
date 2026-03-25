const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('../_lib/mongodb');
const { createToken } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, name } = req.body || {};

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        const { db } = await connectToDatabase();

        const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await db.collection('users').insertOne({
            email: email.toLowerCase().trim(),
            password_hash: passwordHash,
            name: name.trim(),
            created_at: new Date()
        });

        const token = createToken(result.insertedId.toString(), email.toLowerCase().trim());

        res.status(201).json({
            token,
            user: { id: result.insertedId.toString(), name: name.trim(), email: email.toLowerCase().trim() }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};
