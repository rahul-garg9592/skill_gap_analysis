// backend/rag/embedContent.js
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

async function embedText(text) {
  const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const response = await axios.post(
    endpoint,
    {
      input: text,
      model: 'text-embedding-ada-002',
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.data[0].embedding;
}

async function generateEmbeddings() {
    const contentDir = './backend/rag/content/';
    const files = fs.readdirSync(contentDir);
    const embeddings = [];

    for (const file of files) {
        const text = fs.readFileSync(contentDir + file, 'utf-8');
        const embedding = await embedText(text);
        embeddings.push({ file, text, embedding });
    }

    fs.writeFileSync('./backend/rag/embeddings.json', JSON.stringify(embeddings, null, 2));
}

generateEmbeddings();
