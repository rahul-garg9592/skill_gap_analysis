const express = require('express');
const router = express.Router();
const { retrieveRelevantDocs } = require('../rag/retriever');
const axios = require('axios');
require('dotenv').config();

router.post('/generate', async (req, res) => {
    const { parameter } = req.body; // "basics", "libraries", "loops", or "functions"
    const retrieved = await retrieveRelevantDocs(`Generate MCQ about JavaScript ${parameter}`);

    const context = retrieved.map(doc => doc.text).join('\n');

    const prompt = `Using the following context:\n${context}\n\nGenerate a single JavaScript MCQ with one correct answer and three incorrect options. Do not reveal the correct answer. Only return the question and options.`;

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
        res.json({ mcq: response.data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

module.exports = router;
