const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey: clientKey, question, teamData, mode } = req.body || {};
    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    if (!apiKey || !question) {
        return res.status(400).json({ error: 'API key and question are required' });
    }

    const systemPrompts = {
        chat: `You are an AI assistant for a team standup tracker. Answer ONLY from data provided. Be concise — use bullet points, short sentences. Use employee names. No filler text. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, lag=response lag minutes, ghost=ghost promise, fake=fake excuse, trust=trust score.`,
        
        morning_prep: `Prepare a manager for their 10 AM MORNING STANDUP. Be brief and actionable.
For EACH person, give a compact block:
**Name** (role) — Trust: X
- Yesterday: [what they said/did from recent notes]
- Pattern: [1 line — reliable/late/ghost-prone]
- Ask: [2 specific questions]
- Flag: [only if concern exists, else skip]

Keep each person to 4-5 lines max. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, ghost=ghost promise.`,

        evening_prep: `Prepare a manager for their 6:30 PM EVENING UPDATE. Be brief.
For EACH person who was present today:
**Name** — Morning commitment: [from mn field]
- Verify: [what to check]
- Ask: [1 follow-up question]
Skip absent people. 3 lines per person max. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes.`,

        friday_review: `Prepare a FRIDAY WEEKLY REVIEW (4:30-6 PM). Be structured but concise.
For EACH person:
**Name** — Rating: [Excellent/Good/Needs Attention/Concerning]
- Attendance: X/5 days present
- Highlights: [key work from notes]
- Concerns: [if any]
- Discuss: [1-2 points]

End with **Team Summary** (3-4 bullets). 5 lines per person max. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, ghost/fake=flags.`,

        team_summary: `Summarize team performance this week. Be concise with bullet points:
- Attendance rate & trend
- Top 2-3 performers (why)
- Bottom 2-3 concerns (why)
- Ghost/fake flags
- 2 recommendations
Keep under 300 words total. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, trust=trust score.`,

        concerns: `Identify team red flags. Rank by severity. Be concise:
For each concern:
**Name** — [issue type] — Severity: High/Medium/Low
- Evidence: [specific dates/patterns]
- Action: [what manager should do]
Only list real concerns from data. No filler. Keep under 300 words. Data keys: d=date, ms=morning status, ghost=ghost promise, fake=fake excuse, trust=trust score.`
    };

    const systemPrompt = systemPrompts[mode] || systemPrompts.chat;

    const userPrompt = `${question}

DATA:
${JSON.stringify(teamData)}`;

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
                        maxOutputTokens: 2048
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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

        res.json({ response: text });
    } catch (err) {
        console.error('AI chat error:', err);
        res.status(500).json({ error: 'AI service unavailable' });
    }
};
