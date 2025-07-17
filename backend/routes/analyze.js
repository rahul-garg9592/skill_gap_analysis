const express = require('express');
const router = express.Router();
const roleSkills = require('../data/roleSkills.json');

router.post('/', (req, res) => {
  const { resumeSkills, selectedRole } = req.body;

  const requiredSkills = roleSkills[selectedRole] || [];
  const matched = resumeSkills.filter(skill => requiredSkills.includes(skill));
  const missing = requiredSkills.filter(skill => !resumeSkills.includes(skill));

  res.json({ matchedSkills: matched, missingSkills: missing });
});

module.exports = router;
