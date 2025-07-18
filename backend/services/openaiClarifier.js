require('dotenv').config();
const fetch = require('node-fetch');

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

async function askClarifyingQuestion(resume, role, chatHistory = []) {
  const validRoles = ['system', 'user', 'assistant'];
  const questionCount = chatHistory.filter(e => e.role === 'assistant').length;

  if (questionCount >= 5) {
    return {
      status: 'done',
      question: null,
      newSkills: [],
      message: "✅ Clarification complete. Generating upskilling roadmap..."
    };
  }

  const messages = chatHistory
    .filter(entry => validRoles.includes(entry.role))
    .map(entry => ({
      role: entry.role,
      content: entry.parts.map(p =>
        typeof p.text === 'string' ? p.text : JSON.stringify(p.text)
      ).join(' ')
    }));

  const systemPrompt = `
You are a career coach helping a student apply for the role: **${role}**.

You have their resume and all previous questions and answers. Based on their **latest response**, follow these rules:

---

1. 🔍 Carefully review their last answer in context.
2. 🧠 Infer all **new skills, tools, libraries, or concepts** mentioned or implied (add them to "newSkills").
3. ❓ Ask **one new high-impact question** that helps extract maximum useful info not already confirmed.
   - The question must be clear, targeted, and **different from any earlier ones**.
   - Ask about skills that would be **critical or differentiating** for this role.
   - If they already mentioned a broad skill (e.g., web dev), dive deeper (e.g., specific framework/tools/projects).
   - Avoid asking anything already clarified.

---

💡 Think like a mentor with only 5 questions. Be strategic and extract as much as possible.

🎯 Respond in this **exact JSON format** only — no explanation or extra content:

{
  "status": "continue",
  "question": "Your smart next question here",
  "newSkills": ["Skill1", "Skill2"]
}

Resume:
${JSON.stringify(resume, null, 2)}

Conversation History:
${chatHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
`;

  messages.push({ role: 'user', content: systemPrompt });

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages,
        temperature: 0.7,
        model: 'gpt-4.1-nano'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Azure OpenAI Error:', response.status, errText);
      throw new Error(`OpenAI Error: ${response.status}`);
    }

    const data = await response.json();
    let rawText = data.choices[0].message.content.trim();
    rawText = rawText.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(rawText);
    } catch (err) {
      console.error('⚠️ JSON Parse Error:', rawText);
      throw new Error("Invalid JSON from LLM");
    }

  } catch (err) {
    console.error('❌ Azure OpenAI Exception:', err.message);
    return {
      status: questionCount >= 5 ? 'done' : 'continue',
      question: '⚠️ Could not parse response.',
      newSkills: [],
      message: questionCount >= 5
        ? '⚠️ Failed to generate roadmap.'
        : '⚠️ Please try again.'
    };
  }
}

module.exports = { askClarifyingQuestion };
