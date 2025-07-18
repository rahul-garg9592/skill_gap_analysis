let resumeSkills = [];
let chatHistory = [];
let missingSkills = [];
let learnedSkills = new Set();

const BACKEND_URL = 'http://localhost:5001';

function updateProgressBar() {
  const progressBar = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');

  if (!missingSkills.length) {
    progressBar.value = 0;
    label.innerText = 'Progress: 0%';
    return;
  }

  const percent = Math.round((learnedSkills.size / missingSkills.length) * 100);
  progressBar.value = percent;
  label.innerText = `Progress: ${percent}%`;
}

function markSkillLearned(skill) {
  learnedSkills.add(skill);
  updateProgressBar();

  const checkbox = document.querySelector(`#skill-${skill.replace(/\s+/g, '-')}`);
  if (checkbox) checkbox.disabled = true;
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

        if (resJson.roadmap && Array.isArray(resJson.skills)) {
          chat.innerHTML += `<p><b>📈 Final Roadmap:</b><br>${resJson.roadmap.replace(/\n/g, '<br>')}</p>`;
          for (const skill of resJson.skills) {
            const query = skill.youtubeQuery || `${skill.skill} tutorial`;
            chat.innerHTML += `<p><b>📚 Learn:</b> ${skill.skill} — <i>${query}</i></p>`;
          }
          missingSkills = resJson.skills.map(s => s.skill);
        } else {
          chat.innerHTML += `<p><b>✅ No further questions. Final roadmap not returned.</b></p>`;
        }
        break;
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

      const newSkills = resJson.newSkills || [];
      for (const skill of newSkills) {
        if (!resumeSkills.includes(skill)) {
          resumeSkills.push(skill);
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

    output.innerHTML = `<h3>✅ Matched Skills:</h3>
      ${matchedSkills.map(s => `<div class='skill-box'>${s}</div>`).join('')}
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
