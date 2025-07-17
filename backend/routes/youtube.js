const express = require('express');
const router = express.Router();
const { fetchYouTubeVideos } = require('../services/youtubeScraper');

router.post('/', async (req, res) => {
  const { query } = req.body;
  const videos = await fetchYouTubeVideos(query);
  res.json({ videos });
});

module.exports = router;
