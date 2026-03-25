const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey: clientKey, employeeData, prompt } = req.body || {};
    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    if (!apiKey || !employeeData) {
        return res.status(400).json({ error: 'API key and employee data are required' });
    }

    const systemPrompt = `You are an AI work pattern analyst for a team standup tracking system. Analyze the employee's attendance data and provide actionable insights. Be concise, professional, and data-driven. Format your response with clear sections.`;

    const userPrompt = prompt || `Analyze this employee's work patterns, attendance, reliability, and give recommendations for their manager:

${JSON.stringify(employeeData, null, 2)}

Please provide:
1. Overall Work Pattern Summary (2-3 sentences)
2. Reliability Score Assessment (out of 10)
3. Key Concerns (if any)
4. Positive Patterns
5. Recommendations for Manager`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: err.error?.message || 'Gemini API error'
            });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated';

        res.json({ analysis: text });
    } catch (err) {
        console.error('AI analyze error:', err);
        res.status(500).json({ error: 'AI analysis failed: ' + err.message });
    }
};
