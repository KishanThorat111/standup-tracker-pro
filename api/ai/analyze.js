const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey: clientKey, employeeData, prompt, provider: clientProvider, azureEndpoint, azureDeployment, azureApiVersion, openaiModel } = req.body || {};
    const provider = clientProvider || 'gemini';
    const apiKey = clientKey || (
        provider === 'gemini' ? process.env.GEMINI_API_KEY :
        provider === 'openai' ? process.env.OPENAI_API_KEY :
        process.env.AZURE_OPENAI_KEY
    );

    if (!apiKey || !employeeData) {
        return res.status(400).json({ error: 'API key and employee data are required' });
    }

    const systemPrompt = `You are an expert AI work pattern analyst for a team standup tracking system. You analyze individual employee data thoroughly and provide comprehensive, data-driven insights. Format your response with clear markdown sections and use bullet points for readability.`;

    const userPrompt = prompt || `Perform a comprehensive individual performance analysis for this employee based on their standup attendance and work data:

${JSON.stringify(employeeData)}

FIELD REFERENCE: morning_status/evening_status = standup attendance status. morning_notes/evening_notes = what they said in standup (work updates, plans, blockers). lag_minutes = how long after standup time they responded. trust_score = system-calculated reliability score (0-100).

Please provide a DETAILED analysis covering ALL of the following sections:

## 1. Executive Summary
2-3 sentences summarizing this person's overall performance, reliability, and work patterns.

## 2. Attendance & Participation
- Total standups attended vs expected (morning and evening separately)
- Attendance rate percentage
- Pattern analysis: Are they consistent? Any day-of-week patterns? (e.g., frequent absences on Mondays/Fridays)
- Late arrival frequency and average response lag

## 3. Work Content Analysis
- What types of work/tasks have they been doing? (based on their standup notes)
- Are they working on meaningful deliverables or giving vague updates?
- Key projects/tasks mentioned across the period
- Completions: Did they follow through on what they said they'd do? (compare morning promises to evening updates)

## 4. Reliability & Trust Assessment
- Trust score interpretation (current: ${employeeData.trust_score || 100}/100)
- Ghost promises: How many times did they promise work but not deliver?
- Fake excuses or questionable absences (if any)
- Overall consistency and dependability rating (out of 10)

## 5. Leave & Absence Patterns
- Total absences/leaves taken
- Types of absences (No Internet, No Response, Informed Valid, On Leave, Fake Excuse)
- Reasons given for absences
- Are absences clustered (before/after weekends, holidays)?
- Verification status of absence claims

## 6. Strengths (Pros)
List specific strengths with evidence from the data.

## 7. Areas of Concern (Cons)
List specific concerns with evidence from the data.

## 8. Efficiency & Productivity Assessment
- Based on work notes: How productive do they appear?
- Are they taking on enough work?
- Do they finish tasks or carry them over?
- Response time/lag analysis

## 9. Recommendations for Manager
- 3-5 specific, actionable recommendations
- Suggested discussion points for 1-on-1
- Any flags that need immediate attention`;

    try {
        let text;

        if (provider === 'openai') {
            const model = openaiModel || 'gpt-4o-mini';
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                    max_tokens: 16384
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
            text = data.choices?.[0]?.message?.content || 'No analysis generated';
        } else if (provider === 'azure_openai') {
            if (!azureEndpoint || !azureDeployment) {
                return res.status(400).json({ error: 'Azure endpoint and deployment name are required' });
            }
            const baseUrl = azureEndpoint.replace(/\/+$/, '');
            const version = azureApiVersion || '2024-06-01';
            const response = await fetch(
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
                        max_tokens: 16384
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
            text = data.choices?.[0]?.message?.content || 'No analysis generated';
        } else {
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
                            maxOutputTokens: 16384
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
            text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n') || parts[parts.length - 1]?.text || 'No analysis generated';
        }

        res.json({ analysis: text });
    } catch (err) {
        console.error('AI analyze error:', err);
        res.status(500).json({ error: 'AI analysis failed: ' + err.message });
    }
};
