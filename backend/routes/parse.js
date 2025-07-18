// backend/routes/parse.js
const express = require("express");
const router = express.Router();
const { parseResume } = require('../services/parserController');

router.post("/", parseResume);

module.exports = router;
