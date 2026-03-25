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
        chat: `You are an AI assistant for a team standup tracking system. The manager is asking you questions about their team's attendance, work patterns, and performance. Answer based ONLY on the data provided. Be concise, specific, and actionable. Use names. If the data doesn't contain enough info to answer, say so clearly. Format with clear sections and bullet points.`,
        
        morning_prep: `You are preparing a manager for their MORNING STANDUP CALL (10:00 AM - 10:30 AM India time). For EACH team member, based on their recent attendance data and notes, generate:
1. A brief summary of what they said they'd do yesterday/recently
2. Their attendance pattern (reliable? often late? ghost promises?)
3. 2-3 specific questions the manager should ask them TODAY
4. Any red flags or concerns to address

Be direct, practical, and specific. Use the person's name. Format each person as a clear section with their name as heading.`,

        evening_prep: `You are preparing a manager for their EVENING UPDATE CALL (6:30 PM - 7:00 PM India time). For EACH team member, based on their morning commitments today and recent patterns, generate:
1. What they committed to doing this morning (from today's morning notes)
2. Key things to verify in their evening update
3. 1-2 follow-up questions to ask
4. Whether their morning status suggests potential issues (ghost promise? vague commitment?)

Be direct and specific. Skip people who were marked absent. Format each person as a clear section.`,

        friday_review: `You are preparing a manager for their FRIDAY WEEKLY REVIEW CALL (4:30 PM - 6:00 PM India time). For EACH team member, provide a comprehensive weekly review:
1. Weekly attendance summary (present/absent/late days)
2. Key accomplishments mentioned in their notes
3. Concerns (ghost promises, fake excuses, inconsistencies, vague updates)
4. Reliability trend (improving, stable, declining)
5. 2-3 discussion points for the Friday call
6. Overall weekly rating (Excellent/Good/Needs Attention/Concerning)

Be thorough but organized. End with a TEAM SUMMARY section with overall highlights and concerns.`,

        team_summary: `You are summarizing a team's performance this week. Provide:
1. Team Attendance Rate & Trend
2. Top Performers (most reliable, best updates)
3. Concerns (who needs attention, patterns of absence/ghosts)
4. Ghost Promise Summary (who made promises and didn't deliver)
5. Recommendations for the manager
Be data-driven and specific.`,

        concerns: `You are a team health analyst. Based on the attendance data, identify ALL concerns and red flags:
1. Employees with declining attendance patterns
2. Ghost promise repeat offenders  
3. Suspicious patterns (always absent on specific days, vague excuses)
4. Low trust scores and why
5. Anyone who needs immediate manager attention

Be specific with names, dates, and patterns. Rank by severity.`
    };

    const systemPrompt = systemPrompts[mode] || systemPrompts.chat;

    const userPrompt = `${question}

TEAM DATA:
${JSON.stringify(teamData, null, 2)}`;

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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

        res.json({ response: text });
    } catch (err) {
        console.error('AI chat error:', err);
        res.status(500).json({ error: 'AI service unavailable' });
    }
};
