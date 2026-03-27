const { authenticateRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticateRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey: clientKey, employeeData, prompt, provider: clientProvider, azureEndpoint, azureDeployment, azureApiVersion } = req.body || {};
    const provider = clientProvider || 'gemini';
    const apiKey = clientKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.AZURE_OPENAI_KEY);

    if (!apiKey || !employeeData) {
        return res.status(400).json({ error: 'API key and employee data are required' });
    }

    const systemPrompt = `You are an AI work pattern analyst for a team standup tracking system. Analyze the employee's attendance data and provide actionable insights. Be concise, professional, and data-driven. Format your response with clear sections.`;

    const userPrompt = prompt || `Analyze this employee's work patterns, attendance, reliability, and give recommendations for their manager:

${JSON.stringify(employeeData)}

Please provide:
1. Overall Work Pattern Summary (2-3 sentences)
2. Reliability Score Assessment (out of 10)
3. Key Concerns (if any)
4. Positive Patterns
5. Recommendations for Manager`;

    try {
        let text;

        if (provider === 'azure_openai') {
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
