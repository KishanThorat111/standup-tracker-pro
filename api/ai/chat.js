const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey: clientKey, question, teamData, mode, provider: clientProvider, azureEndpoint, azureDeployment, azureApiVersion, openaiModel } = req.body || {};
    const provider = clientProvider || 'gemini';
    const apiKey = clientKey || (
        provider === 'gemini' ? process.env.GEMINI_API_KEY :
        provider === 'openai' ? process.env.OPENAI_API_KEY :
        process.env.AZURE_OPENAI_KEY
    );

    if (!apiKey || !question) {
        return res.status(400).json({ error: 'API key and question are required' });
    }

    const KEY_REF = `Data keys: d=date, ms/es=morning/evening status abbr, mn/en=morning/evening notes, lag=response lag mins, ghost=ghost promise, fake=fake excuse, trust=trust score. Status: PA=Present Active, AA=Async, AG=Ghost, PL=Late, IV=Informed Valid, OL=On Leave, NI=No Internet, NR=No Response, FE=Fake Excuse, RC=Chat Only, AD=Async Deferred.`;

    const systemPrompts = {
        chat: `Smart AI assistant for a Delivery Lead. Analyze ONLY from data. Be concise — bullets, short sentences, use names.
RULES: Question includes current date/time. If standup hasn't happened yet, do NOT say anyone "missed" today. NR in evening = didn't submit update, NOT absent. ghost=true = broken promise. Track WORK: compare morning plans (mn) vs evening delivery (en). Flag unfinished work.
${KEY_REF}`,
        
        morning_prep: `You prepare a Delivery Lead for their 10AM MORNING STANDUP. Use ONLY the provided data — never assume or fabricate work items.

${KEY_REF}
Additional data keys: att={p:present days, e:evening submissions, total:days tracked, ghosts/fakes/lates if >0}, pending=[{d:date, task:unfulfilled morning promise}], absences=[{d:date, type:status, note:reason}], lastWork={d:date, mn/en:last work notes}, days=[7-day record history].

RESPOND WITH THIS EXACT STRUCTURE:

## 📋 Quick Status Board
| Name | Today | Trust | Present (7d) | Flag |
Show EVERY member. Today = their morning status from today's record in days array, or "⏳ Not recorded" if no record for today.

## 👥 Per-Person Standup Briefing
Cover EVERY member — present AND absent, no exceptions.

### **Name** (Role) — Trust: X/100 | Present X/Y days
- **Today:** [morning status from today's record, or "Not yet recorded"]
- **Yesterday:** [what they did — from yesterday's mn/en notes in days array. If absent, say so with reason]
- **Last Work Context:** [QUOTE their most recent work notes from lastWork field — what specific tasks/projects were they on]
- **Promises vs Delivery:** [from days array: compare recent mn (morning plan) → en (evening result). Flag undelivered with DATES. Use pending field for known gaps]
- **🎯 Ask Them:**
  1. [Specific question referencing their ACTUAL work/tasks from notes — not generic]
  2. [Follow-up about deliverables, blockers, or what they'll work on today]
- **⚠️ Flags:** [ONLY if real issues: trust<80, ghost promises, fake excuses, consecutive absences, non-delivery pattern. If none, write "✅ Clean"]

**FOR ABSENT MEMBERS additionally include:**
- **Absent Since:** [date + reason from absences field]
- **Was Working On:** [their last work notes before absence — from lastWork field]
- **When They Return:** [specific follow-up question about their unfinished work]

## 🎯 Top 3 Priorities for This Standup
[Based on data: deliverables due, blocked items, returning members, accountability gaps]

## 🚨 Red Flags
[Team-level concerns needing immediate attention. If none, say "None — team tracking well."]

CRITICAL RULES:
- Before 10AM = standup hasn't happened. Do NOT say anyone "missed today's standup"
- QUOTE actual notes/tasks from the data — do NOT make up work items
- NR = No Response status, not on leave
- ghost=true = they promised but didn't deliver
- Every team member must appear in the output — zero exceptions`,

        evening_prep: `You prepare a Delivery Lead for their 6:30PM EVENING UPDATE. Use ONLY the provided data — never assume or fabricate work items.

${KEY_REF}
Additional data keys: att={p:present days, e:evening submissions, total:days tracked}, pending=[{d:date, task:unfulfilled promise}], absences=[{d:date, type:status, note:reason}], lastWork={d:date, mn/en:last work notes}, days=[7-day record history].

RESPOND WITH THIS EXACT STRUCTURE:

## 📊 Evening Status Dashboard
| Name | Morning Status | Evening Submitted? | Action |
Show EVERY member.

## 👥 Per-Person Evening Briefing
Cover EVERY member — present AND absent.

### FOR PRESENT MEMBERS:
### **Name** (Role) — Trust: X/100
- **Morning Commitment:** [QUOTE their EXACT morning notes (mn) from today's record in days array — what they said they'd do]
- **Evening Status:** [Submitted with notes / Submitted no notes / Not yet submitted]
- **Evening Report:** [QUOTE their evening notes (en) from today if available]
- **✅ Verify These Deliverables:**
  1. [Specific task FROM their morning notes to check completion]
  2. [Another specific task to verify]
- **Promise vs Reality:** [Compare today's mn → en. What was promised? What was delivered? What's missing?]
- **📋 Pending from Earlier:** [From pending field: previous unfulfilled promises with dates]
- **Ask:** [1-2 specific verification questions about their actual tasks]

### FOR ABSENT MEMBERS:
### **Name** — Absent: [reason from today's status]
- **Last Present:** [date from lastWork or most recent present day in days array]
- **Was Working On:** [QUOTE their last work notes — specific tasks/projects from lastWork field]
- **Blocked By Absence:** [any pending items affected]
- **When They Return:** [continuity question about their unfinished work]

## ✅ Accountability Summary
- **Delivered on promises:** [names who matched mn→en]
- **Gaps in delivery:** [names + what specifically wasn't delivered]
- **No evening update yet:** [names — may need a reminder]

## 🔔 Concerns & Action Items
[Patterns, blockers, follow-ups needed. If none, say "Team on track."]

CRITICAL RULES:
- Cover ALL members — present AND absent. Zero exceptions
- NR in evening = haven't submitted update yet, NOT absent
- QUOTE actual morning notes as "commitments" — do NOT fabricate tasks
- Compare mn → en for promise vs delivery accuracy
- ghost=true = they promised but didn't deliver
- If someone was absent, always include what they were last working on`,

        friday_review: `FRIDAY WEEKLY REVIEW. Cover ALL members.
Per person: **Name** — Rating: [Excellent/Good/Needs Attention/Concerning]
- Attendance: X/Y morning, X/Y evening
- Key Work: [from notes]
- Promises vs Delivery: [track record]
- Discuss: [1-2 points]
End with Team Summary: delivery rate, top 3 accomplishments, unresolved blockers, next week actions.
${KEY_REF}`,

        team_summary: `Team performance summary. ALL members. Focus on WORK CONTENT:
- Attendance rates (morning/evening)
- Top 3 performers (with work evidence)
- Bottom 3 concerns (with evidence)
- Key blockers across team
- 3-5 action items
NR evening ≠ absent. Flag ghost only if ghost=true. ${KEY_REF}`,

        concerns: `Identify REAL concerns from data. Factual, evidence-based.
Per concern: **Name** — [issue] — Severity: High/Med/Low
- Evidence: [dates, notes]
- Pattern: [recurring? how many times?]
- Action: [what to do]
Look for: broken promises (mn vs en), recurring blockers, low engagement, trust<80/ghost/fake, collaboration gaps.
NR evening = missed update, NOT absence. ${KEY_REF}`,

        monthly_report: `MONTHLY REPORT. Cover ALL members.
### Overall: working days, avg morning %, avg evening %
### Per employee: **Name** (Role) — Rating: ⭐/✅/⚠️/🔴
- Attendance, Key Work, Promises vs Delivery, Growth Areas
### Highlights: best performer, most improved, concerns (all with evidence)
### 3-5 Manager Action Items
${KEY_REF}`,

        best_performer: `BEST PERFORMER analysis. Rank ALL employees.
Criteria: Attendance 25%, Evening Updates 15%, Work Quality 35%, Reliability 25%.
## 🏆 Winner: **Name** — Score: X/100 — Why: [3 evidence points]
### Rankings: all employees with rank, score, key strength
### Awards: Most Consistent, Most Detailed, Best Collaborator
${KEY_REF}`
    };

    const systemPrompt = systemPrompts[mode] || systemPrompts.chat;

    // Serialize team data and cap total prompt size to stay within limits
    let teamDataStr = JSON.stringify(teamData);
    
    // If payload is too large (>60KB), progressively trim notes
    if (teamDataStr.length > 60000 && teamData?.employees) {
        const trimmed = {
            ...teamData,
            employees: teamData.employees.map(emp => ({
                ...emp,
                records: (emp.records || []).map(r => ({
                    ...r,
                    mn: r.mn ? r.mn.slice(0, 120) + (r.mn.length > 120 ? '...' : '') : undefined,
                    en: r.en ? r.en.slice(0, 120) + (r.en.length > 120 ? '...' : '') : undefined
                }))
            }))
        };
        teamDataStr = JSON.stringify(trimmed);
    }

    const userPrompt = `${question}\n\nDATA:\n${teamDataStr}`;

    // Adaptive max tokens: standup prep and large reports get more, quick queries get less
    const outputTokens = ['monthly_report', 'friday_review', 'best_performer', 'morning_prep', 'evening_prep'].includes(mode) ? 8192 : ['team_summary', 'concerns'].includes(mode) ? 6144 : 4096;

    try {
        let response, text;

        if (provider === 'openai') {
            const model = openaiModel || 'gpt-4o-mini';
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: outputTokens
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const status = response.status;
                const msg = err.error?.message || 'OpenAI API error';
                if (status === 401) return res.status(401).json({ error: 'Invalid OpenAI API key. Please check your key in Settings.' });
                if (status === 429) return res.status(429).json({ error: 'OpenAI rate limit reached. Please wait a moment and try again.' });
                if (status === 402) return res.status(402).json({ error: 'OpenAI billing issue. Please check your account at platform.openai.com.' });
                return res.status(status).json({ error: msg });
            }

            const data = await response.json();
            text = data.choices?.[0]?.message?.content || 'No response generated';
        } else if (provider === 'azure_openai') {
            if (!azureEndpoint || !azureDeployment) {
                return res.status(400).json({ error: 'Azure endpoint and deployment name are required' });
            }
            const baseUrl = azureEndpoint.replace(/\/+$/, '');
            const version = azureApiVersion || '2024-06-01';
            response = await fetch(
                `${baseUrl}/openai/deployments/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=${version}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': apiKey
                    },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: outputTokens
                    })
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: err.error?.message || 'Azure OpenAI API error'
                });
            }

            const data = await response.json();
            text = data.choices?.[0]?.message?.content || 'No response generated';
        } else {
            // Gemini (default)
            response = await fetch(
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
                            maxOutputTokens: outputTokens
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
            const parts = data.candidates?.[0]?.content?.parts || [];
            text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n') || parts[parts.length - 1]?.text || 'No response generated';
        }

        res.json({ response: text });
    } catch (err) {
        console.error('AI chat error:', err);
        res.status(500).json({ error: 'AI service unavailable' });
    }
};
