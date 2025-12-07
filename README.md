# MyMedGuide - Picture Recognition

Live site for identifying dangerous bugs, animals, and poisonous plants from skin lesion images.

## Public Deployment Architecture

This app uses a **split architecture** to keep API keys secure:

- **Frontend**: Hosted on GitHub Pages (public, static files)
- **Backend**: Node.js server deployed separately (keeps Google Vision API key safe)

## For Users

Visit the live site (once deployed) and use Picture Recognition to identify possible biters/plants. No setup needed!

## For Developers: Local Development

### Prerequisites
- Node.js 18+ installed
- Google Cloud Vision API key (with billing enabled)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ecybermission796-max/MyMedGuide.git
   cd MyMedGuide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API key**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env and add your Google Vision API key
   # GOOGLE_VISION_API_KEY=your_actual_key_here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3001
   ```

## Deployment Instructions (For Maintainers)

### 1. Deploy Backend Server

Choose one of these free hosting options:

**Option A: Render.com (Recommended - Free tier available)**
1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - Name: `mymedguide-api`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node manifest-generator-server.js`
   - Add Environment Variable: `GOOGLE_VISION_API_KEY` = your key
5. Click "Create Web Service"
6. Copy the deployed URL (e.g., `https://mymedguide-api.onrender.com`)

**Option B: Railway.app**
1. Go to https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Add environment variable: `GOOGLE_VISION_API_KEY`
5. Railway auto-detects Node.js and deploys
6. Copy the public URL

**Option C: Heroku**
```bash
heroku create mymedguide-api
heroku config:set GOOGLE_VISION_API_KEY=your_key_here
git push heroku main
```

### 2. Update Frontend Config

Edit `js/config.js` and replace `'https://your-backend-url.com'` with your deployed backend URL:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://mymedguide-api.onrender.com';  // YOUR DEPLOYED URL HERE
```

### 3. Deploy Frontend to GitHub Pages

```bash
git add .
git commit -m "Configure production backend URL"
git push origin main
```

Then in GitHub:
1. Go to your repo → Settings → Pages
2. Source: Deploy from branch `main`
3. Folder: `/ (root)`
4. Click Save
5. Your site will be live at: `https://ecybermission796-max.github.io/MyMedGuide/`

## Security Notes

- ✅ API key is stored in backend `.env` (never committed to git)
- ✅ Backend server proxies Vision API requests (key never exposed to frontend)
- ✅ Frontend is public static files (no secrets)
- ⚠️ Anyone can use your deployed app (and your API key quota)
- 💡 Consider adding rate limiting if usage grows

## Features

- **Picture Recognition**: Upload skin lesion images and get AI-powered identification
- **Search**: Text-based search across bugs, animals, and poisonous plants
- **Browse**: Navigate categories of dangerous biters and plants
- **Nearby Providers**: Find healthcare providers on a map
