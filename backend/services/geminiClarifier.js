// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' }); // Use Flash to reduce quota issues

// async function askClarifyingQuestion(resume, role, chatHistory = []) {
//   const cleanedHistory = chatHistory.map(entry => ({
//     role: entry.role,
//     parts: entry.parts.map(part => ({
//       text: typeof part.text === 'string' ? part.text : JSON.stringify(part.text)
//     }))
//   }));

//   const chat = model.startChat({
//     history: cleanedHistory,
//     generationConfig: { temperature: 0.7 }
//   });

//   const questionCount = cleanedHistory.filter(e => e.role === 'model').length;

//   // ✅ Final Roadmap after 5 questions
//   if (questionCount >= 5) {
//     const summaryPrompt = `
// You are an expert AI career mentor.

// Based on the student's resume and their clarifying answers, your job is to:
// 1. Infer what essential skills they are missing (do NOT rely on any hardcoded list).
// 2. Generate a personalized, practical learning roadmap to become a strong candidate for the role: "${role}".
// 3. Recommend beginner-friendly YouTube search queries for each missing skill.

// Return ONLY this JSON:
// {
//   "status": "done",
//   "roadmap": "Your detailed roadmap goes here...",
//   "skills": [
//     { "skill": "SkillName", "youtubeQuery": "Search query for tutorial" }
//   ]
// }

// Resume:
// ${JSON.stringify(resume, null, 2)}

// Chat History:
// ${cleanedHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
//     `;

//     const finalRes = await chat.sendMessage(summaryPrompt);
//     const finalText = (await finalRes.response).text().trim();

//     try {
//       const json = JSON.parse(finalText);
//       return json;
//     } catch {
//       return {
//         status: 'done',
//         roadmap: '⚠️ Could not parse roadmap. Please try again.',
//         skills: []
//       };
//     }
//   }

//   // ✅ Clarifying Question Prompt
//   const questionPrompt = `
// You are a highly intelligent AI helping a student prepare for the role of "${role}".

// You’ve reviewed their resume and already asked a few questions. Now:

// 1. Look at the ENTIRE conversation so far (especially the last user answer).
// 2. Determine if the student confirmed or demonstrated any new skill(s) in that answer.
// 3. List those inferred skills in "newSkills".
// 4. Then, ask ONE new smart, short question to explore another unclear or critical skill.
// 5. Think like a top career coach. Be specific, not vague. Don't ask if already answered.
// 6. After 5 total questions, you must stop.

// Respond ONLY with a clean JSON like this:
// {
//   "status": "continue",
//   "question": "Your short, clear next question here",
//   "newSkills": ["Skill1", "Skill2"]
// }

// Resume:
// ${JSON.stringify(resume, null, 2)}

// Chat History:
// ${cleanedHistory.map(h => `${h.role}: ${h.parts.map(p => p.text).join(' ')}`).join('\n')}
//   `;

//   const result = await chat.sendMessage(questionPrompt);
// let rawText = (await result.response).text().trim();

// // ✅ Clean Markdown code fences BEFORE parsing
// rawText = rawText.replace(/```json|```/g, '').trim();

// try {
//   const parsed = JSON.parse(rawText);
//   return parsed;
// } catch (e) {
//   console.error("❌ Failed to parse LLM question response:", rawText);
//   return {
//     status: 'continue',
//     question: rawText,
//     newSkills: []
//   };
// }

// }

// module.exports = { askClarifyingQuestion };
