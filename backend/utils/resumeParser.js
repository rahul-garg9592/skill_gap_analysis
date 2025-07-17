const axios = require('axios');

async function parseResume(fileBuffer) {
  const formData = new FormData();
  formData.append('file', fileBuffer, 'resume.pdf');

  const response = await axios.post('https://resume-api-js-2.onrender.com/score-resume,', formData, {
    headers: formData.getHeaders()
  });

  return response.data; // expected: { name, skills, projects, experience }
}

module.exports = { parseResume };
