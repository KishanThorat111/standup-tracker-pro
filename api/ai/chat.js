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
        
        morning_prep: `You're a sharp Delivery Lead prepping for 10AM standup. Think like a senior tech lead — ask about specific modules, deployments, environments, test results, design handoffs. Never generic HR questions.

${KEY_REF}
Extra keys: att={p:present,e:evening subs,total:days}, pending=[unfulfilled past promises], absences=[{d,type,note}], lastWork={d,mn,en:last work notes}, days=[7-day history].

STATUS RULES: PA/PL/AA/RC/AD = ALL WORKING (RC=remote chat, NOT absent). OL=Leave. IV=Informed absence+reason. NR/NI=Unreachable. AG=Ghost(broken promise). FE=Fake excuse.

QUESTION QUALITY: Parse their mn/en notes for specific tasks, then ask pointed questions:
- Devs: "Is [module/API] deployed to [env]? Test failures?" NOT "Did you make progress?"
- Testers: "Which modules passed on PROD APK? P1 blockers?" NOT "How's testing going?"
- Designers: "Is [screen] design handed off?" / Content: "Is [deliverable] published or draft?"

OUTPUT FORMAT:
## 📋 Team Status Board
| Name | Role | Today | Last Active | Flag |
(EVERY member. Today=today's ms or "⏳ Not yet". Flag=trust/ghost/absences or Clean)

## 👥 Working Members (PA/PL/AA/RC/AD)
### **Name** (Role) — Trust: X
**Yesterday:** [parsed mn+en — extract deliverables, not raw text. If no en: "No evening update — verify delivery"]
**Open Items:** [from pending field — past unfulfilled promises with dates. If none: skip]
**🎯 Ask:** 1) [sharp question about THEIR specific work/modules] 2) [follow-up on today's plan or pending items]
**⚠️ Watch:** [only if trust<80/ghost/fake/non-delivery pattern, else "✅ Clean"]

## 📋 Away (OL/IV/NR/NI)
### **Name** — [reason: "On Leave" / "Classes (IV)" / "Unreachable (NR)"]
- **Last work:** [from lastWork — specific tasks] | **Open:** [from pending or "None"]
- **When back:** [specific follow-up about their unfinished work]

## 🎯 Standup Priorities (3-5)
## 🚨 Flags [real concerns only, or "None — team stable"]

RULES: Before 10AM=standup hasn't happened, don't say anyone "missed today". RC/AD=working NOT absent. pending=PREVIOUS days' promises NOT today. PARSE notes, don't just quote. Every member must appear.`,

        evening_prep: `You're a sharp Delivery Lead prepping for 6:30PM evening update. Think like a senior tech lead — verify specific deliverables, modules, deployments, test results. Never generic HR questions.

${KEY_REF}
Extra keys: att={p:present,e:evening subs,total:days}, pending=[unfulfilled past promises], absences=[{d,type,note}], lastWork={d,mn,en:last work notes}, days=[7-day history].

STATUS RULES: PA/PL/AA/RC/AD = ALL WORKING (RC=remote chat, NOT absent — verify their tasks). OL=Leave. IV=Informed absence+reason. NR/NI=Unreachable. AG=Ghost. FE=Fake.

QUESTION QUALITY: Parse mn notes for concrete deliverables, then ask verification questions:
- Devs: "Are the [specific] bug fixes committed and validated in PROD?" NOT "How far along are you?"
- Testers: "Which modules passed? Any P1 blockers from PROD APK testing?" NOT "Were you able to complete testing?"
- Designers: "Is [screen] finalized and handed off?" / Content: "Is [deliverable] published?"

OUTPUT FORMAT:
## 📊 Evening Status
| Name | Role | Status | Evening | Priority |
(EVERY member. Status: "✅ Working" for PA/PL/AA/RC/AD, "🏖️ Leave" for OL, "📋 Informed+reason" for IV, "❌ Unreachable" for NR/NI)

## 👥 Working Members — Delivery Check (PA/PL/AA/RC/AD — ALL working, including RC)
### **Name** (Role)
**Morning Plan:** [parse mn notes — extract specific deliverables/modules, not raw text]
**Verify:** 1) [specific deliverable from mn] 2) [another specific item]
**Ask:** [sharp technical question about their SPECIFIC tasks — module names, envs, people, blockers]
**Pending:** [from pending field — PREVIOUS unfulfilled promises with dates. If none: skip]

## 📋 Away — Continuity Tracker (OL/IV/NR/NI only)
### **Name** — [reason: "On Leave" / "Morning classes (IV)" / "Unreachable"]
- **Last work:** [from lastWork — specific tasks] | **Open:** [pending or "None"]
- **When back:** [specific follow-up about their unfinished work]

## 🎯 End-of-Day Summary
- **On track:** [names with clear delivery] | **Needs verification:** [missing evening updates — may have delivered but not reported]
- **Blocked/escalate:** [real issues] | **Tomorrow:** [carry-forward items, returning members]

RULES: RC/AD=WORKING not absent. IV=show reason. pending=PREVIOUS days' promises not today's plan. PARSE notes for deliverables. No evening update yet="Pending" not "Reminder needed". Every member must appear.`,

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
