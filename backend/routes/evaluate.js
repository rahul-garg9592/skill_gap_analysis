// backend/routes/evaluate.js
const express = require('express');
const router = express.Router();
const { retrieveRelevantDocs } = require('../rag/retriever');
const axios = require('axios');
require('dotenv').config();

router.post('/answer', async (req, res) => {
    const { question, userAnswer } = req.body;

    const retrieved = await retrieveRelevantDocs(question);
    const context = retrieved.map(doc => doc.text).join('\n');

    const prompt = `Question: ${question}\nUser's Answer: ${userAnswer}\nContext: ${context}\nIs user's answer correct? Give brief explanation.`;

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    try {
        const response = await axios.post(
            endpoint,
            {
                messages: [{ role: "user", content: prompt }],
            },
            {
                headers: {
                    'api-key': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );
        res.json({ evaluation: response.data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

module.exports = router;
