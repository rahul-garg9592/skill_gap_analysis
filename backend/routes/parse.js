const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const FormData = require('form-data');

router.post('/', async (req, res) => {
  try {
    // ✅ Check if file is actually uploaded
    console.log('🧾 req.files:', req.files);
    console.log("🧾 req.files keys:", Object.keys(req.files || {}));
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const file = req.files.file;
    console.log("📄 Received file:", file.name);

    const formData = new FormData();
    formData.append('resume', file.data, {
  filename: file.name,
  contentType: file.mimetype
});

    const response = await fetch('https://resume-api-js-2.onrender.com/score-resume', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resume parsing failed: ${errText}`);
    }

    const result = await response.json();
    res.json(result);

  } catch (err) {
    console.error('❌ Resume parse error:', err.message);
    res.status(500).json({ error: 'Resume parsing failed', details: err.message });
  }
});

module.exports = router;
