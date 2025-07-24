// backend/rag/retriever.js
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const embeddings = JSON.parse(fs.readFileSync('./backend/rag/embeddings.json'));

function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieveRelevantDocs(query, topK=2) {
    const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const queryEmbeddingResponse = await axios.post(
      endpoint,
      {
        input: query,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );
    const queryVec = queryEmbeddingResponse.data.data[0].embedding;

    const scored = embeddings.map(doc => ({
        ...doc,
        score: cosineSimilarity(queryVec, doc.embedding)
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

module.exports = { retrieveRelevantDocs };
