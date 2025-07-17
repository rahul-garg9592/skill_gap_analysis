const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ Middleware order matters
app.use(cors());
app.use(express.json());
app.use(fileUpload()); // Must come before routes that use req.files

// ✅ Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Ping route for testing connection
app.get('/ping', (req, res) => {
  res.send('ping');
});

// ✅ Backend API routes
app.use('/clarify', require('./backend/routes/clarify'));
app.use('/analyze-skill-gaps', require('./backend/routes/analyze'));
app.use('/youtube', require('./backend/routes/youtube'));
app.use('/parse-resume', require('./backend/routes/parse')); // File upload route

// ✅ Fallback to serve frontend HTML on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
