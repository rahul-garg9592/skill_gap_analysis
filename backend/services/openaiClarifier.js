const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
  defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
});

async function askClarifyingQuestion(resume, role, chatHistory = []) {
  const questionCount = chatHistory.filter(e => e.role === 'assistant').length;

  // Convert to OpenAI format
  const messages = chatHistory.map(entry => ({
    role: entry.role,
    content: entry.parts.map(p => typeof p.text === 'string' ? p.text : JSON.stringify(p.text)).join(' ')
  }));

  const questionPrompt = `
You are acting as a career coach helping a student apply for the role: **${role}**.

You already have their resume and the entire conversation so far. Based on their **last answer**, do the following:

---

1. 👀 **Review what they said** — carefully read their last response in context.
2. 🧠 **Infer any new skills or experience** they demonstrated (write them in "newSkills").
3. ❓ **Ask one new question** about an important missing or unclear skill.
   - Be *specific* and *incremental*.
   - Ask only if the skill hasn’t already been confirmed.
   - Think like a human mentor: stay friendly, focused, and relevant.

⛔ Don't repeat previous questions. End after 5 questions.

---

🎯 Respond with this **exact JSON** (no explanation):

{
  "status": "continue",
  "question": "Your next smart question here",
  "newSkills": ["Skill1", "Skill2"]
}

Student's Resume:
${JSON.stringify(resume, null, 2)}

Conversation so far:
${chatHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
`;

  messages.push({ role: 'user', content: basePrompt });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano', // your Azure deployment name
      messages,
      temperature: 0.7
    });

    let rawText = response.choices[0].message.content.trim();
    rawText = rawText.replace(/```json|```/g, '').trim();

    return JSON.parse(rawText);
  } catch (err) {
    console.error('❌ Azure OpenAI Error:', err.message);
    return {
      status: questionCount >= 5 ? 'done' : 'continue',
      question: '⚠️ Could not parse response.',
      newSkills: [],
      roadmap: questionCount >= 5 ? '⚠️ Failed to generate roadmap.' : undefined,
      skills: questionCount >= 5 ? [] : undefined
    };
  }
}

module.exports = { askClarifyingQuestion };
