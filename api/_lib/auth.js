const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function createToken(userId, email) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
    return jwt.verify(token, JWT_SECRET);
}

async function authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    try {
        const token = authHeader.split(' ')[1];
        return verifyToken(token);
    } catch {
        return null;
    }
}

module.exports = { createToken, verifyToken, authenticateRequest };
