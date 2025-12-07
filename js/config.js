// config.js - Configuration for API endpoints
// For local development, use localhost:3001
// For production (GitHub Pages), use your deployed backend URL

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'  // local development
  : 'https://your-backend-url.com';  // UPDATE THIS with your deployed backend URL (e.g., Render, Railway, Heroku)

window.API_CONFIG = { BASE_URL: API_BASE_URL };
