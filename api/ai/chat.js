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
        chat: `You are a smart AI assistant for a Delivery Lead managing a software team. Analyze ONLY from data provided. Be concise — use bullet points, short sentences. Use employee names.
CRITICAL RULES:
- The user's question includes the current date and time. If standup hasn't happened yet today, do NOT say anyone "missed" today.
- "No Response" in evening (es) = they didn't submit evening update, NOT absent/ghost.
- ghost=true in data = ghost promise (said they'd do something, didn't). Only flag if data says ghost=true.
- Track WORK CONTENT: what did they work on? What did they promise? Did they deliver?
- If someone said "will do X today" in morning notes (mn) and their evening notes (en) don't mention X, flag it as unfinished.
Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes, lag=response lag minutes, ghost=ghost promise, fake=fake excuse, trust=trust score.`,
        
        morning_prep: `You are preparing a Delivery Lead for their 10 AM MORNING STANDUP. The user's question includes today's date and current time.

CRITICAL: If the current time is BEFORE 10 AM, today's standup has NOT happened yet. Do NOT say anyone "missed today" or "didn't attend today." You are preparing QUESTIONS to ask them in the upcoming standup. If today's date has no records yet, that is NORMAL — the standup hasn't happened.

For EACH team member, analyze their PREVIOUS days' data and give:
**Name** (Role) — Trust: X
- Last Update: [summarize what they worked on from their most recent mn and en notes]
- Promises vs Delivery: [compare what they said they'd do (from mn) vs what they reported doing (from en). Flag any unfinished work]
- Ask: [2 targeted follow-up questions about their specific work — reference ticket numbers, module names, features mentioned in their notes]
- Flag: [ONLY if: trust<80, ghost=true, fake=true, or repeated pattern of promising but not delivering]

WORK TRACKING RULES:
- Read morning notes (mn) for what they PLANNED/PROMISED
- Read evening notes (en) for what they actually DID
- If mn says "will finish X today" but en doesn't mention X → flag as "Unfinished: X"
- If someone repeatedly mentions the same blocker across days → flag as "Recurring blocker"
- Focus on WORK CONTENT, not just attendance

Cover EVERY person. End with top 3 priorities for today's standup.
Data keys: d=date, ms=morning status, mn=morning notes, es=evening status, en=evening notes.`,

        evening_prep: `Prepare a Delivery Lead for their 6:30 PM EVENING UPDATE. The user's question includes today's date and current time.
For EACH person who had morning status today:
**Name** — Committed This Morning: [from today's mn notes]
- Verify: [specific things to check if they completed — reference exact tasks/tickets from their morning notes]
- Ask: [1 targeted follow-up about their specific work]
Skip only people who were actually absent (morning status is absent_*). "No Response" evening = haven't submitted yet, NOT absent.
Cover everyone who was present. Data keys: d=date, ms/mn/es/en.`,

        friday_review: `FRIDAY WEEKLY REVIEW (4:30-6 PM). Cover ALL team members.
For EACH person:
**Name** — Rating: [Excellent/Good/Needs Attention/Concerning]
- Attendance: X/Y days present (morning), X/Y evening updates submitted
- Key Work: [specific tasks/features/tickets from their notes across the week]
- Promises vs Delivery: [what they said they'd do vs what they completed]
- Blockers: [any recurring issues mentioned]
- Discuss: [1-2 points for the review meeting]

End with **Team Summary**:
- Overall delivery rate
- Top 3 accomplishments
- Unresolved blockers
- Action items for next week

RULES: Cover ALL employees. Track actual work content. "No Response" evening ≠ absence. Data keys: d/ms/mn/es/en/ghost/fake.`,

        team_summary: `Team performance summary. Cover ALL members. Analyze WORK CONTENT not just attendance:
- Overall attendance rate (morning present / working days)
- Evening update submission rate
- Top 3 performers (with specific work examples from their notes)
- Bottom 3 concerns (with specific evidence — what they promised, what they didn't deliver)
- Key blockers/dependencies mentioned across the team
- Work patterns: who collaborates with whom (mentioned in notes)
- 3-5 action items for the Delivery Lead
RULES: "No Response" evening ≠ absent. Only flag ghost if ghost=true in data. Focus on work delivery. Data keys: d/ms/mn/es/en/trust.`,

        concerns: `Identify REAL team concerns from data. Be factual and evidence-based:
For each concern:
**Name** — [issue] — Severity: High/Medium/Low
- Evidence: [specific dates, what they said, what happened]
- Pattern: [is this recurring? how many times?]
- Action: [what the Delivery Lead should do]

TYPES OF CONCERNS TO LOOK FOR:
- Broken promises: said "will do X" in morning, evening doesn't mention X (check across multiple days)
- Recurring blockers: same issue mentioned in different days
- Low engagement: very short/vague notes compared to others
- Trust issues: trust<80, ghost=true, fake=true
- Collaboration gaps: "waiting for X" or "blocked by Y" patterns

RULES:
- "No Response" for evening = missed evening update, NOT absence
- Only flag ghost if ghost=true in their records
- Be factual, cite specific dates and note content
Data keys: d/ms/es/mn/en/ghost/fake/trust.`,

        monthly_report: `Generate a comprehensive MONTHLY REPORT. Cover ALL team members individually.

## Monthly Team Report — [Month Year]

### Overall Statistics
- Working days tracked: X
- Average morning attendance rate: X%
- Average evening update rate: X%

### Individual Performance (for EACH employee):
**Name** (Role) — Rating: ⭐ Excellent / ✅ Good / ⚠️ Needs Attention / 🔴 Concerning
- Attendance: X/Y mornings, X/Y evening updates
- Key Work Delivered: [specific tasks/features from their notes]
- Promises vs Delivery: [overall track record — how often did they complete what they committed?]
- Growth Areas: [if any]

### Team Highlights
- Best performer with specific evidence
- Most improved with evidence
- Key concerns with evidence

### Manager Action Items
- 3-5 specific actionable items

RULES: Cover ALL employees. Count actual dates. Analyze work content from notes. Data keys: d/ms/mn/es/en/ghost/fake/trust.`,

        best_performer: `Determine the BEST PERFORMER from the team data. Analyze ALL employees.

CRITERIA (weighted):
1. **Attendance (25%)**: Morning present rate
2. **Evening Updates (15%)**: Consistency of submissions
3. **Work Quality (35%)**: Depth of notes, specific tasks mentioned, actual delivery
4. **Reliability (25%)**: Trust score, promises kept, no ghost/fake marks

## 🏆 Best Performer — [Month]

### Winner: **[Name]** (Role)
- Score: X/100
- Why: [3 specific evidence points from their work notes]

### Full Rankings (ALL employees):
For each person: Rank, Name, Score, Key Strength

### Special Awards:
- Most Consistent
- Most Detailed Updates
- Best Collaborator (mentions helping/connecting with others)

RULES: Rank ALL employees. Use actual data. Evaluate note quality and work delivery. Data keys: d/ms/mn/es/en/ghost/fake/trust.`
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
