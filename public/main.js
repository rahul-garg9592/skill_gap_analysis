let resumeSkills = [];
let chatHistory = [];
let missingSkills = [];
let learnedSkills = new Set();

const BACKEND_URL = 'http://localhost:5001';

function normalizeSkillName(skill) {
  return skill.trim().toLowerCase();
}

function updateProgressBar() {
  // Debug log
  console.log('learnedSkills:', Array.from(learnedSkills));
  console.log('missingSkills:', missingSkills);

  const progressBar = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');

  if (!missingSkills.length) {
    progressBar.value = 0;
    label.innerText = 'Progress: 0%';
    return;
  }

  // Count how many missingSkills are in learnedSkills (normalized)
  const learnedCount = missingSkills.filter(skill => learnedSkills.has(normalizeSkillName(skill))).length;
  const percent = Math.round((learnedCount / missingSkills.length) * 100);
  progressBar.value = percent;
  label.innerText = `Progress: ${percent}%`;
}

function markSkillLearned(skill) {
  const checkbox = document.querySelector(`#skill-${skill.replace(/\s+/g, '-')}`);
  const normalized = normalizeSkillName(skill);
  if (checkbox && checkbox.checked) {
    learnedSkills.add(normalized);
  } else {
    learnedSkills.delete(normalized);
  }
  updateProgressBar();
}

function renderMissingSkills() {
  const output = document.getElementById('output');
  output.innerHTML += `<h3>📘 Track Your Progress:</h3>`;

  missingSkills.forEach(skill => {
    const skillId = `skill-${skill.replace(/\s+/g, '-')}`;
    const div = document.createElement('div');
    div.className = 'skill-box';
    div.innerHTML = `
      <label>
        <input type="checkbox" id="${skillId}" onchange="markSkillLearned('${skill}')">
        ${skill}
      </label>
    `;
    output.appendChild(div);
  });

  updateProgressBar();
}

async function analyze() {
  const fileInput = document.getElementById('resumeFile');
  const role = document.getElementById('role').value;
  const output = document.getElementById('output');
  const chat = document.getElementById('chat');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  output.innerHTML = '⏳ Analyzing your resume...';
  chat.innerHTML = '';
  progressContainer.style.display = 'none';
  progressBar.value = 0;
  document.getElementById('progress-label').innerText = '';
  missingSkills = [];
  learnedSkills = new Set();
  chatHistory = [];

  try {
    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);
    const parseRes = await fetch(`${BACKEND_URL}/parse-resume`, {
      method: 'POST',
      body: formData
    });

    if (!parseRes.ok) throw new Error("Resume parsing failed");
    const parsed = await parseRes.json();
    resumeSkills = parsed.skills || [];

    chatHistory.push({
      role: 'user',
      parts: [{
        text: `Hi Gemini, here is my background. Please ask clarifying questions if needed.\n\nName: ${parsed.name}\nSkills: ${parsed.skills?.join(', ') || 'None'}\nProjects: ${(parsed.projects || []).map(p => p.name || p).join(', ')}\nExperience: ${(parsed.experience || []).map(e => e.title || e).join(', ')}\nEducation: ${(parsed.education || []).map(ed => ed.degree || ed).join(', ')}\n\nI'm aiming for the role: ${role}.`
      }]
    });

    let done = false;
    let attempts = 0;
    const maxQuestions = 6;

    while (!done && attempts < maxQuestions) {
      attempts++;

      const clarifyRes = await fetch(`${BACKEND_URL}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: parsed, role, chatHistory })
      });

      const rawText = await clarifyRes.text();
      console.log("🧠 Raw clarify response:", rawText);

      let resJson;
      try {
        resJson = JSON.parse(rawText);
      } catch (e) {
        alert("⚠️ Could not parse response.");
        console.error("❌ JSON parse error:", e.message);
        continue;
      }

      if (resJson.status === 'done') {
        done = true;

        // Always show roadmap and score at the very top
        let summaryHtml = '';
        if (typeof resJson.roadmap === 'string' && resJson.roadmap.trim().length > 0) {
          summaryHtml += `<div style="background:#e0f7fa;padding:16px;border-radius:8px;margin-bottom:16px;">
            <b>📈 Personalized Roadmap:</b><br>${resJson.roadmap.replace(/\n/g, '<br>')}
          </div>`;
        }
        if (typeof resJson.score === 'number') {
          summaryHtml += `<p><b>⭐ Skill Match Score:</b> ${Math.round(resJson.score * 100)}%</p>`;
        }
        if (Array.isArray(resJson.matchedSkills)) {
          summaryHtml += `<h3>✅ Matched Skills:</h3>${resJson.matchedSkills.map(s => `<div class='skill-box'>${s}</div>`).join('')}`;
        }
        if (Array.isArray(resJson.missingSkills)) {
          summaryHtml += `<h3>❌ Missing Skills:</h3>${resJson.missingSkills.map(s => `<div class='skill-box'>${s}</div>`).join('')}`;
        }
        if (Array.isArray(resJson.skills)) {
          missingSkills = resJson.missingSkills || [];
          resumeSkills = resJson.skills;
        }
        summaryHtml += `<h3>✅ All Recognized Skills:</h3>
          ${resumeSkills.map(s => `<div class='skill-box'>${s}</div>`).join('')}
          <h3>❌ Missing Skills:</h3>`;
        output.innerHTML = summaryHtml;
        console.log('OUTPUT HTML:', output.innerHTML); // Debug log
        renderMissingSkills();
        if (missingSkills.length > 0) {
          progressContainer.style.display = 'block';
        }
        for (const skill of missingSkills) {
          const vidRes = await fetch(`${BACKEND_URL}/youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `${skill} tutorial` })
          });
          if (!vidRes.ok) throw new Error(`Failed to get tutorials for ${skill}`);
          const { videos } = await vidRes.json();
          output.innerHTML += `<h4>📹 Best tutorials for ${skill}:</h4>` +
            videos.map(v => `<div class='video-box'><a href='${v.link}' target='_blank'>${v.title}</a></div>`).join('');
        }
        return;
      }

      let question = resJson.question?.question || resJson.question;
      if (typeof question === 'string' && question.includes('{')) {
        try {
          const parsedQ = JSON.parse(question);
          question = parsedQ.question || question;
        } catch {}
      }

      if (!question || typeof question !== 'string') {
        console.warn("⚠️ No valid question, skipping");
        break;
      }

      chat.innerHTML += `<p><b>AI asks:</b> ${question}</p>`;
      const userAnswer = prompt(question);
      if (!userAnswer) break;

      chatHistory.push({ role: 'assistant', parts: [{ text: question }] });
      chatHistory.push({ role: 'user', parts: [{ text: userAnswer }] });

      const newSkills = resJson.newSkills;
      let addedSkills = [];
      if (!Array.isArray(newSkills) || newSkills.length === 0) {
        // Fallback: If user answered 'yes' and question is in the right format, extract skill from question
        if (userAnswer.trim().toLowerCase() === 'yes' && typeof question === 'string') {
          // Try to extract the skill/tool/tech from the question
          const match = question.match(/experience with ([^?]+)\?/i);
          if (match && match[1]) {
            const extractedPhrase = match[1].trim().toLowerCase();
            // Get required skills for the selected role
            const requiredSkills = (window.roleSkillsForCurrentRole || []);
            // Try to match canonical skills by substring (case-insensitive)
            let found = false;
            requiredSkills.forEach(skill => {
              if (extractedPhrase.includes(skill.toLowerCase())) {
                const alreadyPresent = resumeSkills.some(s => s.toLowerCase() === skill.toLowerCase());
                if (!alreadyPresent) {
                  resumeSkills.push(skill);
                  addedSkills.push(skill);
                  found = true;
                }
              }
            });
            if (found) {
              chat.innerHTML += `<p style='color:blue;'>🛠️ Fallback: Added canonical skill(s) from question: ${addedSkills.join(', ')}</p>`;
            } else {
              // If no canonical match, fallback to previous logic
              const normalizedSkill = extractedPhrase;
              const alreadyPresent = resumeSkills.some(s => s.toLowerCase() === normalizedSkill);
              if (!alreadyPresent) {
                resumeSkills.push(match[1].trim());
                addedSkills.push(match[1].trim());
                chat.innerHTML += `<p style='color:blue;'>🛠️ Fallback: Added skill from question: ${match[1].trim()}</p>`;
              }
            }
          }
        }
        if (addedSkills.length === 0) {
          console.warn('⚠️ newSkills is missing or not an array:', newSkills);
          chat.innerHTML += `<p style='color:orange;'>⚠️ No new skills detected from your answer.</p>`;
        }
      } else {
        for (const skill of newSkills) {
          // Normalize for case-insensitive comparison
          const normalizedSkill = skill.toLowerCase();
          const alreadyPresent = resumeSkills.some(s => s.toLowerCase() === normalizedSkill);
          if (!alreadyPresent) {
            resumeSkills.push(skill);
            addedSkills.push(skill);
          }
        }
        console.log('🆕 newSkills from clarify:', newSkills);
        console.log('📋 Updated resumeSkills:', resumeSkills);
        if (addedSkills.length > 0) {
          chat.innerHTML += `<p style='color:green;'>🆕 Added skills: ${addedSkills.join(', ')}</p>`;
        } else {
          chat.innerHTML += `<p style='color:gray;'>No new skills added from your answer.</p>`;
        }
      }
    }

    const gapRes = await fetch(`${BACKEND_URL}/analyze-skill-gaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeSkills, selectedRole: role })
    });

    if (!gapRes.ok) throw new Error("Skill gap analysis failed");
    const { matchedSkills, missingSkills: gaps } = await gapRes.json();
    missingSkills = gaps;

    // Show all recognized skills (from resume and questions)
    output.innerHTML = `<h3>✅ All Recognized Skills:</h3>
      ${resumeSkills.map(s => `<div class='skill-box'>${s}</div>`).join('')}
      <h3>❌ Missing Skills:</h3>`;

    renderMissingSkills();

    if (missingSkills.length > 0) {
      progressContainer.style.display = 'block';
    }

    for (const skill of missingSkills) {
      const vidRes = await fetch(`${BACKEND_URL}/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${skill} tutorial` })
      });

      if (!vidRes.ok) throw new Error(`Failed to get tutorials for ${skill}`);
      const { videos } = await vidRes.json();

      output.innerHTML += `<h4>📹 Best tutorials for ${skill}:</h4>` +
        videos.map(v => `<div class='video-box'><a href='${v.link}' target='_blank'>${v.title}</a></div>`).join('');
    }

  } catch (err) {
    console.error('❌ Error:', err);
    output.innerHTML = `<p style="color:red;">❌ Error: ${err.message}</p>`;
  }
}

window.markSkillLearned = markSkillLearned;

// Store required skills for the selected role globally for fallback use
window.roleSkillsForCurrentRole = [];
const originalAnalyze = analyze;
analyze = async function() {
  const role = document.getElementById('role').value;
  // Fetch required skills for the selected role from the backend (or hardcode if available)
  try {
    const res = await fetch('/backend/data/roleSkills.json');
    if (res.ok) {
      const allRoles = await res.json();
      window.roleSkillsForCurrentRole = allRoles[role] || [];
    }
  } catch {}
  return originalAnalyze.apply(this, arguments);
};
