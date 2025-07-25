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
  if (percent === 100 && missingSkills.length > 0) {
    showConfetti();
    showBanner('🎉 Congratulations! You have learned all the missing skills!','success');
    pulseProgressBar();
  }
}

function renderMissingSkills() {
  const output = document.getElementById('output');
  output.innerHTML += `<h3>📘 Track Your Progress:</h3>`;

  missingSkills.forEach(skill => {
    const normalizedSkill = normalizeSkillName(skill);
    const skillId = `skill-${normalizedSkill.replace(/[^a-z0-9]/g, '-')}`;
    const div = document.createElement('div');
    div.className = 'skill-box';
    div.innerHTML = `
      <label>
        <input type="checkbox" id="${skillId}" value="${normalizedSkill}" onchange="markSkillLearned('${skill}')">
        ${skill}
      </label>
    `;
    output.appendChild(div);
  });

  updateProgressBar();
}

function markSkillLearned(skill) {
  const normalized = normalizeSkillName(skill);
  const skillId = `skill-${normalized.replace(/[^a-z0-9]/g, '-')}`;
  const checkbox = document.getElementById(skillId);
  if (checkbox && checkbox.checked) {
    learnedSkills.add(normalized);
  } else {
    learnedSkills.delete(normalized);
  }
  updateProgressBar();
}

async function startMcqRound(skills) {
  for (const skill of skills) {
    const response = await fetch(`${BACKEND_URL}/mcq/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameter: skill })
    });
    if (!response.ok) {
      alert('Failed to fetch MCQ.');
      return;
    }
    const data = await response.json();
    // Remove any answer reveal from the MCQ text
    const mcqText = data.mcq.replace(/\*\*Correct answer:[^]*$/i, '').trim();
    const userAnswer = prompt(`MCQ on ${skill} (type your answer):\n\n${mcqText}`);
    if (!userAnswer) {
      alert('MCQ round cancelled.');
      return;
    }
    // Optionally, send userAnswer to backend for evaluation here
  }
  alert('Thank you for participating in the MCQ round!');
  await updateScoreAfterMcq();
}

async function updateScoreAfterMcq() {
  const role = document.getElementById('role').value;
  const output = document.getElementById('output');
  const chat = document.getElementById('chat');
  const clarifyRes = await fetch(`${BACKEND_URL}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume: { skills: resumeSkills }, role, chatHistory })
  });
  const rawText = await clarifyRes.text();
  let resJson;
  try {
    resJson = JSON.parse(rawText);
  } catch (e) {
    alert("⚠️ Could not parse response.");
    return;
  }
  if (resJson.status === 'done') {
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
      summaryHtml += `<h3>✅ Matched Skills:</h3>${resJson.matchedSkills.map(s => renderSkillCard(s, 'matched')).join('')}`;
    }
    if (Array.isArray(resJson.missingSkills)) {
      summaryHtml += `<h3>❌ Missing Skills:</h3>${resJson.missingSkills.map(s => renderSkillCard(s, 'missing')).join('')}`;
    }
    if (Array.isArray(resJson.skills)) {
      missingSkills = resJson.missingSkills || [];
      resumeSkills = resJson.skills;
    }
    summaryHtml += `<h3>✅ All Recognized Skills:</h3>
      ${resumeSkills.map(s => renderSkillCard(s)).join('')}
      <h3>❌ Missing Skills:</h3>`;
    output.innerHTML = summaryHtml;
    renderMissingSkills();
    if (missingSkills.length > 0) {
      document.getElementById('progress-container').style.display = 'block';
    }
    alert('Your score has been updated!');
  }
}

function showSatisfactionPopup(onYes, onNo) {
  // Remove any existing popup
  const existing = document.getElementById('satisfaction-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'satisfaction-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.border = '2px solid #00796b';
  popup.style.padding = '24px';
  popup.style.zIndex = 1000;
  popup.style.borderRadius = '12px';
  popup.innerHTML = `
    <div style="margin-bottom: 16px; font-size: 1.1em;">Are you satisfied with your score?</div>
    <button id="satisfy-yes" style="margin-right: 12px;">Yes</button>
    <button id="satisfy-no">No</button>
  `;
  document.body.appendChild(popup);
  document.getElementById('satisfy-yes').onclick = () => {
    popup.remove();
    if (onYes) onYes();
  };
  document.getElementById('satisfy-no').onclick = async () => {
    popup.remove();
    if (typeof missingSkills !== 'undefined' && missingSkills.length > 0) {
      await startMcqRound(missingSkills);
    } else {
      alert('No missing skills to generate MCQ for.');
    }
    if (onNo) onNo();
  };
}

// Enhanced chat bubble rendering with emoji avatars and fade-in
function addChatBubble(text, sender = 'ai') {
  const chat = document.getElementById('chat');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  const avatar = sender === 'ai' ? '🤖' : '🧑';
  bubble.innerHTML = `<span class='chat-avatar'>${avatar}</span><span>${text}</span>`;
  chat.appendChild(bubble);
  setTimeout(() => { bubble.style.opacity = 1; }, 10);
  chat.scrollTop = chat.scrollHeight;
}

// Animate skill cards and add colorful badges
function renderSkillCard(skill, type = 'default') {
  let badge = '';
  if (type === 'matched') badge = `<span class='skill-badge' style='background:linear-gradient(90deg,#34d399,#38bdf8);'>Matched</span>`;
  if (type === 'missing') badge = `<span class='skill-badge' style='background:linear-gradient(90deg,#fbbf24,#f472b6);'>Missing</span>`;
  return `<div class='skill-box'>${skill} ${badge}</div>`;
}

// Confetti animation
function showConfetti() {
  const confetti = document.createElement('div');
  confetti.style.position = 'fixed';
  confetti.style.left = 0;
  confetti.style.top = 0;
  confetti.style.width = '100vw';
  confetti.style.height = '100vh';
  confetti.style.pointerEvents = 'none';
  confetti.style.zIndex = 9999;
  confetti.innerHTML = Array.from({length: 80}).map(() => {
    const color = ['#38bdf8','#6366f1','#fbbf24','#f472b6','#34d399'][Math.floor(Math.random()*5)];
    const left = Math.random()*100;
    const delay = Math.random()*2;
    const duration = 2+Math.random()*2;
    return `<div style='position:absolute;left:${left}vw;top:-10vh;width:12px;height:12px;background:${color};border-radius:50%;opacity:0.8;animation:confetti-fall ${duration}s ${delay}s linear forwards;'></div>`;
  }).join('') + `<style>@keyframes confetti-fall{to{top:110vh;transform:rotate(720deg);}}</style>`;
  document.body.appendChild(confetti);
  setTimeout(()=>confetti.remove(), 4000);
}

// Colorful banner
function showBanner(message, type = 'success') {
  const output = document.getElementById('output');
  const color = type === 'success' ? 'linear-gradient(90deg,#34d399,#38bdf8)' : 'linear-gradient(90deg,#fbbf24,#f472b6)';
  output.innerHTML = `<div class='banner' style='background:${color};'>${message}</div>` + output.innerHTML;
}

// Pulse effect for progress bar
function pulseProgressBar() {
  const bar = document.getElementById('progress-bar');
  bar.style.boxShadow = '0 0 16px 4px #38bdf8';
  setTimeout(()=>{bar.style.boxShadow='';}, 1200);
}

// Render roadmap as a vertical timeline
function renderRoadmapTimeline(roadmapText) {
  const output = document.getElementById('output');
  const steps = roadmapText.split(/\n|\r/).filter(Boolean);
  let html = '<div class="roadmap-timeline">';
  steps.forEach(step => {
    html += `<div class="roadmap-step">${step}</div>`;
  });
  html += '</div>';
  output.innerHTML += html;
}

// Add loading spinner
function showLoadingSpinner() {
  const output = document.getElementById('output');
  output.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;">
    <div class="spinner" style="border: 6px solid #e0e7ff; border-top: 6px solid #6366f1; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite;"></div>
    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  </div>`;
}

async function analyze() {
  const fileInput = document.getElementById('resumeFile');
  const role = document.getElementById('role').value;
  const output = document.getElementById('output');
  const chat = document.getElementById('chat');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  showLoadingSpinner();
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
            <b>📈 Personalized Roadmap:</b></div>`;
        }
        if (typeof resJson.score === 'number') {
          summaryHtml += `<p><b>⭐ Skill Match Score:</b> ${Math.round(resJson.score * 100)}%</p>`;
        }
        if (Array.isArray(resJson.matchedSkills)) {
          summaryHtml += `<h3>✅ Matched Skills:</h3>${resJson.matchedSkills.map(s => renderSkillCard(s, 'matched')).join('')}`;
        }
        if (Array.isArray(resJson.missingSkills)) {
          summaryHtml += `<h3>❌ Missing Skills:</h3>${resJson.missingSkills.map(s => renderSkillCard(s, 'missing')).join('')}`;
        }
        if (Array.isArray(resJson.skills)) {
          missingSkills = resJson.missingSkills || [];
          resumeSkills = resJson.skills;
        }
        summaryHtml += `<h3>✅ All Recognized Skills:</h3>
          ${resumeSkills.map(s => renderSkillCard(s)).join('')}
          <h3>❌ Missing Skills:</h3>`;
        output.innerHTML = summaryHtml;
        if (typeof resJson.roadmap === 'string' && resJson.roadmap.trim().length > 0) {
          renderRoadmapTimeline(resJson.roadmap);
        }
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

      addChatBubble(question, 'ai');
      const userAnswer = prompt(question);
      if (!userAnswer) break;
      addChatBubble(userAnswer, 'user');

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
              addChatBubble(`🛠️ Fallback: Added canonical skill(s) from question: ${addedSkills.join(', ')}`, 'ai');
            } else {
              // If no canonical match, fallback to previous logic
              const normalizedSkill = extractedPhrase;
              const alreadyPresent = resumeSkills.some(s => s.toLowerCase() === normalizedSkill);
              if (!alreadyPresent) {
                resumeSkills.push(match[1].trim());
                addedSkills.push(match[1].trim());
                addChatBubble(`🛠️ Fallback: Added skill from question: ${match[1].trim()}`, 'ai');
              }
            }
          }
        }
        if (addedSkills.length === 0) {
          console.warn('⚠️ newSkills is missing or not an array:', newSkills);
          addChatBubble('⚠️ No new skills detected from your answer.', 'ai');
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
          addChatBubble(`🆕 Added skills: ${addedSkills.join(', ')}`, 'ai');
        } else {
          addChatBubble('No new skills added from your answer.', 'ai');
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
      ${resumeSkills.map(s => renderSkillCard(s)).join('')}
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

async function getRelevantDocs(query, topK = 2) {
  const response = await fetch(`${BACKEND_URL}/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topK })
  });
  if (!response.ok) throw new Error('Retrieval failed');
  const data = await response.json();
  return data.results;
}

// Add event listener for knowledge base search
window.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.onclick = async () => {
      const query = document.getElementById('searchInput').value;
      const resultsDiv = document.getElementById('retrievalResults');
      resultsDiv.innerHTML = '⏳ Searching...';
      try {
        const results = await getRelevantDocs(query);
        resultsDiv.innerHTML = results.map((doc, idx) => `
          <div class="retrieved-doc">
            <b>Result ${idx + 1} (${doc.file}):</b>
            <pre>${doc.text}</pre>
            <small>Score: ${doc.score.toFixed(4)}</small>
          </div>
        `).join('');
      } catch (err) {
        resultsDiv.innerHTML = `<span style="color:red;">Error: ${err.message}</span>`;
      }
    };
  }
});

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

  // Call the original analyze logic
  await originalAnalyze.apply(this, arguments);

  // After showing the score/roadmap, show satisfaction popup
  showSatisfactionPopup(
    () => {
      // User is satisfied
      alert('Thank you for your feedback!');
    },
    () => {
      // User is not satisfied, MCQ round handled in popup
    }
  );
};
