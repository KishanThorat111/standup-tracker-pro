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

    const systemPrompt = `You are an expert work pattern analyst. Analyze employee standup data and provide thorough, evidence-based insights using markdown. Be data-driven — cite specific dates and notes. Never assume; only use what's in the data.
KEY: d=date, ms/es=morning/evening status abbreviation, mn/en=morning/evening notes, ma/ea=async content, lag=response lag mins, ghost=unfulfilled promise, v=verification(legit/fake). Status codes: PA=Present Active, AA=Async, AG=Ghost Promise, PL=Late, IV=Informed Valid, OL=On Leave, NI=No Internet, NR=No Response, FE=Fake Excuse, RC=Chat Only, AD=Async Deferred. The "stats" object has pre-computed counts so use them directly.`;

    const userPrompt = prompt || `Analyze this employee:
${JSON.stringify(employeeData)}

Provide ALL 9 sections (use the pre-computed stats, don't recount):

## 1. Executive Summary
2-3 sentences on overall performance and reliability.

## 2. Attendance & Participation
Morning/evening rates (use stats.present/${employeeData.days} and stats.evening/${employeeData.days}), day-of-week patterns if visible, late frequency, avg response lag (stats.avgLag mins).

## 3. Work Content Analysis
What tasks/projects from their notes (mn/en)? Are updates specific or vague? Did morning promises match evening delivery? Flag unfinished work with dates.

## 4. Reliability & Trust
Trust: ${employeeData.trust || 100}/100. Ghost promises: ${employeeData.stats?.ghosts || 0}. Fakes: ${employeeData.stats?.fakes || 0}. Dependability rating /10.

## 5. Leave & Absence Patterns
${employeeData.stats?.absences || 0} total absences, ${employeeData.stats?.leaves || 0} leaves. Types, reasons from notes, clustering patterns, verification status.

## 6. Strengths
List with evidence from data.

## 7. Concerns
List with evidence from data.

## 8. Efficiency Assessment
Productivity based on work notes depth, task completion patterns, lag analysis.

## 9. Manager Recommendations
3-5 actionable items, 1-on-1 discussion points, immediate flags.`;

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
                    max_tokens: 6144
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
                        max_tokens: 6144
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
                            maxOutputTokens: 6144
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
