require('dotenv').config();
const fetch = require('node-fetch');

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

async function askClarifyingQuestion(resume, role, chatHistory = []) {
  const validRoles = ['system', 'user', 'assistant'];
  const questionCount = chatHistory.filter(e => e.role === 'assistant').length;

  // Always define messages as an array before the if/else
  const messages = [];
  if (questionCount >= 5) {
    // Compose a final prompt for scoring and roadmap
    // Extract canonical recognized skills (intersection of recognized and required skills)
    const requiredSkills = require('../data/roleSkills.json')[role] || [];
    // Gather all user-provided skills from chatHistory
    const recognizedSkillsSet = new Set();
    chatHistory.forEach(h => {
      h.parts.forEach(p => {
        if (typeof p.text === 'string') {
          p.text.split(',').forEach(s => {
            const skill = s.trim();
            if (skill && skill.length > 1 && skill.length < 50) recognizedSkillsSet.add(skill);
          });
        }
      });
    });
    // Only use canonical skills for scoring
    const canonicalRecognizedSkills = requiredSkills.filter(s => {
      return Array.from(recognizedSkillsSet).some(rs => rs.toLowerCase() === s.toLowerCase());
    });
    const finalPrompt = `
You are a career coach helping a student apply for the role: **${role}**.

You have the student's resume, the list of required skills for the role, and the full conversation history (including all recognized skills from both the resume and the Q&A).

---
Recognized Skills: ${JSON.stringify(canonicalRecognizedSkills)}
Required Skills: ${JSON.stringify(requiredSkills)}
---

Instructions:
1. Compare the recognized skills to the required skills for the role.
2. Give a score between 0 and 1 (rounded to two decimals) representing how well the user's skills match the requirements (e.g., score = recognized/required).
3. List the matched and missing skills.
4. Write a personalized, step-by-step roadmap to help the user achieve the target role, focusing on the missing skills and best learning strategies.

Respond in this **exact JSON format** only — no explanation or extra content:
{
  "status": "done",
  "score": 0.85,
  "matchedSkills": ["Skill1", "Skill2"],
  "missingSkills": ["Skill3", "Skill4"],
  "roadmap": "Step 1: ...\nStep 2: ...",
  "skills": ["Skill1", "Skill2", "Skill3", ...]
}

Resume:
${JSON.stringify(resume, null, 2)}

Conversation History:
${chatHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
`;
    messages.push({ role: 'user', content: finalPrompt });
  } else {
    // Instead of redeclaring 'const messages', push to the existing array
    messages.push(...chatHistory
      .filter(entry => validRoles.includes(entry.role))
      .map(entry => ({
        role: entry.role,
        content: entry.parts.map(p =>
          typeof p.text === 'string' ? p.text : JSON.stringify(p.text)
        ).join(' ')
      }))
    );
    // Extract previous question and latest answer for the prompt
    const previousQuestion = chatHistory
      .filter(h => h.role === 'assistant')
      .slice(-1)[0]?.parts?.map(p => p.text).join(' ') || '';
    const latestAnswer = chatHistory
      .filter(h => h.role === 'user')
      .slice(-1)[0]?.parts?.map(p => p.text).join(' ') || '';

    // Compute recognized skills so far
    const recognizedSkillsSet = new Set();
    chatHistory.forEach(h => {
      h.parts.forEach(p => {
        if (typeof p.text === 'string') {
          // crude extraction: split by comma and trim
          p.text.split(',').forEach(s => {
            const skill = s.trim();
            if (skill && skill.length > 1 && skill.length < 50) recognizedSkillsSet.add(skill);
          });
        }
      });
    });
    const requiredSkills = require('../data/roleSkills.json')[role] || [];
    const missingSkills = requiredSkills.filter(s => !recognizedSkillsSet.has(s));

    const systemPrompt = `
You are a career coach helping a student apply for the role: **${role}**.

You have their resume and all previous questions and answers.

---
**Previous Question:** ${previousQuestion}
**Latest Answer:** ${latestAnswer}
---

Instructions:
1. Only ask yes/no questions about specific skills, tools, or technologies that are in the required skills list for the role but are NOT present in the user's recognized skills so far (i.e., missing from the resume and previous answers). Do not ask about skills the user already has.
2. Each question should be in the format: "Do you have experience with [Skill/Tool/Technology]? (yes/no)" or similar.
3. Do not ask for details, examples, or open-ended responses—only yes/no is required.
4. If the latest answer is "yes", extract and add as new skills any tools, technologies, or platforms mentioned in the previous question.
5. If the latest answer is "no", do not add any new skills unless the user mentions something new.
6. If the latest answer is a list or description, extract all new skills, tools, libraries, or concepts mentioned or implied.
7. If the answer is ambiguous, make a best guess based on the question context and conversation so far.
8. Use the list of missing skills for the selected role below.
9. Ask one new yes/no question about a missing skill, tool, or technology not already confirmed.

Missing Skills for this Role:
${JSON.stringify(missingSkills)}

Respond in this **exact JSON format** only — no explanation or extra content:

{
  "status": "continue",
  "question": "Your next yes/no question here",
  "newSkills": ["Skill1", "Skill2"]
}

Resume:
${JSON.stringify(resume, null, 2)}

Conversation History:
${chatHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
`;
    messages.push({ role: 'user', content: systemPrompt });
  }

  // Fallback: Ensure messages is never empty and always requests valid JSON
  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: `Respond in this exact JSON format only:\n{\n  "status": "done",\n  "score": 0,\n  "matchedSkills": [],\n  "missingSkills": [],\n  "roadmap": "",\n  "skills": []\n}`
    });
  }

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
    // Log the raw LLM response for debugging
    console.log('🔎 Raw LLM response:', rawText);
    rawText = rawText.replace(/```json|```/g, '').trim();
    // JSON repair: remove trailing commas before ] and fix double closing brackets
    rawText = rawText.replace(/,\s*\]/g, ']');
    rawText = rawText.replace(/\]\s*\]/g, ']');

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
