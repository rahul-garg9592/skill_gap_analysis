const express = require('express');
const router = express.Router();
const { askClarifyingQuestion } = require('../services/geminiClarifier');

router.post('/', async (req, res) => {
  const { resume, role, chatHistory } = req.body;

  const question = await askClarifyingQuestion(resume, role, chatHistory);
  res.json({ question });
});

module.exports = router;
