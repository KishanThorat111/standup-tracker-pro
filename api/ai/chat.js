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
        chat: `You are an AI assistant for a team standup tracker. Answer ONLY from data provided. Be concise — use bullet points, short sentences. Use employee names. No filler text.
IMPORTANT: "No Response" in evening (es) means they did NOT submit an evening update — this is NOT a ghost promise and NOT an absence. A "ghost promise" means someone said they'd do something but didn't deliver. Only flag ghost if ghost=true in data.
Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, lag=response lag minutes, ghost=ghost promise, fake=fake excuse, trust=trust score.`,
        
        morning_prep: `Prepare a manager for their 10 AM MORNING STANDUP. You MUST cover ALL team members — do not skip anyone.
For EACH person, give:
**Name** (role) — Trust: X
- Yesterday: [what they did/said from their most recent mn and en notes]
- Ask: [2 specific follow-up questions based on their work]
- Flag: [only if real concern — low trust, ghost=true, or fake=true]

Keep each person to 3-4 lines. Cover EVERY person in the data. End with a 2-line summary of top priorities.
IMPORTANT: "No Response" for evening status means they didn't submit an update, NOT that they were absent. Only flag ghost if ghost=true. Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes.`,

        evening_prep: `Prepare a manager for their 6:30 PM EVENING UPDATE. Cover ALL present team members.
For EACH person who had morning status today:
**Name** — Committed: [from today's mn]
- Verify: [what to check]
- Ask: [1 follow-up]
Skip only people marked absent. "No Response" evening = no update submitted, not absent.
3 lines per person. Cover everyone. Data keys: d=date, ms/mn/es/en.`,

        friday_review: `FRIDAY WEEKLY REVIEW (4:30-6 PM). Cover ALL team members.
For EACH person:
**Name** — Rating: [Excellent/Good/Needs Attention/Concerning]
- Attendance: X/Y days present (morning), X/Y evening updates submitted
- Highlights: [key work from notes]
- Concerns: [if any — be specific]
- Discuss: [1-2 points]

End with **Team Summary** (4-5 bullets).
IMPORTANT: Missing evening update ≠ absence. ghost=true ≠ missing update. Cover EVERY person. Data keys: d/ms/mn/es/en/ghost/fake.`,

        team_summary: `Team performance summary. Cover ALL members. Be concise:
- Overall attendance (morning present / total)
- Evening update submission rate
- Top 3 performers (with reason)
- Bottom 3 concerns (with reason)
- Key blockers/dependencies noted in data
- 2-3 action items for manager
IMPORTANT: "No Response" evening ≠ absent. Only flag ghost if ghost=true in data. Data keys: d/ms/mn/es/en/trust.`,

        concerns: `Identify REAL team concerns from data. Be accurate:
For each concern:
**Name** — [issue] — Severity: High/Medium/Low
- Evidence: [specific dates and data]
- Action: [what manager should do]

RULES:
- "No Response" for evening = missed evening update, NOT absence
- Only flag ghost if ghost=true in their records
- Only flag fake excuse if fake=true
- Low trust (<80) is a real concern
- Be factual, don't invent issues
Data keys: d/ms/es/ghost/fake/trust.`
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
                        maxOutputTokens: 8192
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
