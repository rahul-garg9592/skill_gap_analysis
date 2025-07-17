const puppeteer = require('puppeteer');

async function fetchYouTubeVideos(query) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);

  const videos = await page.evaluate(() => {
    const results = [];
    const items = document.querySelectorAll('ytd-video-renderer');

    for (let item of items) {
      const title = item.querySelector('#video-title')?.textContent.trim();
      const url = 'https://www.youtube.com' + item.querySelector('#video-title')?.getAttribute('href');

      if (title && url) results.push({ title, link: url });
      if (results.length === 5) break;
    }
    return results;
  });

  await browser.close();
  return videos;
}

module.exports = { fetchYouTubeVideos };
