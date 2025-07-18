// backend/controllers/parserController.js

const fs = require('fs');
const pdfParse = require('pdf-parse');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

// 🧠 Prompt Template
function buildPrompt(resumeText) {
  return `
You are an intelligent resume evaluator. Given the resume text below, extract key candidate details and assign a **quality score between 0.0 and 1.0**. Be precise and strict in evaluation — do not award score if evidence is weak or missing.

You must extract:
- name (mandatory)
- age (estimate if not explicit)
- skills (only those supported by project evidence)
- score (based on rubric below)

Respond ONLY in this valid JSON format:
{
  "name": "string",
  "age": number,
  "skills": ["string", ...],
  "score": number
}

Scoring Rubric (Max 20 pts → normalize):

🔍 Profile (10 pts)
- Focused skill domains → +4
- Project-backed skills → +5
- Clean formatting → +1

💼 Technical (6 pts)
- GitHub/projects → +4
- Certifications/societies → +2

🎓 Education (4 pts)
- Tier 1 → +4, Tier 2 → +2

Score = round(total / 20, 2)

Resume:
\`\`\`
${resumeText}
\`\`\`
`;
}

// 📥 Extract Text from PDF
async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// 🤖 Use Azure OpenAI to Evaluate Resume
async function scoreResumeWithLLM(resumeText) {
  const prompt = buildPrompt(resumeText);

  const requestBody = {
    messages: [
      {
        role: "system",
        content: "You are a strict but helpful resume evaluator. Only reply with a JSON object.",
      },
      {
        role: "user",
        content: prompt,
      }
    ],
    temperature: 0.5,
    model: "gpt-4.1-nano"
  };

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Azure Error:", response.status, errText);
      throw new Error("Azure OpenAI API Error");
    }

    let text = (await response.json()).choices[0].message.content.trim();

    // Clean Markdown fences if present
    if (text.startsWith("```json")) text = text.replace(/^```json/, "").trim();
    if (text.endsWith("```")) text = text.slice(0, -3).trim();

    return JSON.parse(text);
  } catch (err) {
    console.error("❌ LLM Exception:", err.message);
    return null;
  }
}

// 🎯 Main Controller Function
// 🎯 Main Controller Function
async function parseResume(req, res) {
  try {
    if (!req.files || !req.files.resume) {
      return res.status(400).json({ error: 'Resume file missing' });
    }

    const file = req.files.resume;
    const tempPath = `./uploads/${file.name}`;
    await file.mv(tempPath);

    const resumeText = await extractTextFromPDF(tempPath);
    const result = await scoreResumeWithLLM(resumeText);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse resume via Azure OpenAI' });
    }

    // ✅ Log parsed result
    console.log("✅ Parsed Resume Result:", result);

    fs.appendFileSync('scored_resumes.json', JSON.stringify(result, null, 2) + ",\n");

    res.json(result);
  } catch (err) {
    console.error("🔥 Fatal error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}


module.exports = {
  parseResume
};
