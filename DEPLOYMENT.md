# Deployment Checklist

## Before You Deploy

- [ ] API key is in `.env` (not in any committed files)
- [ ] `.gitignore` includes `.env`
- [ ] Tested locally at http://localhost:3001

## Step 1: Deploy Backend Server (Choose ONE option)

### Option A: Render.com (Recommended - easiest)
1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo: `ecybermission796-max/MyMedGuide`
4. Settings:
   - **Name**: `mymedguide-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node manifest-generator-server.js`
   - **Environment Variables**: 
     - Key: `GOOGLE_VISION_API_KEY`
     - Value: (paste your API key)
5. Click "Create Web Service"
6. Wait for deploy to complete (~2 min)
7. **Copy the URL** (e.g., `https://mymedguide-api.onrender.com`)

### Option B: Railway.app
1. Go to https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Select `MyMedGuide`
4. Click on the service → Variables → Add Variable:
   - `GOOGLE_VISION_API_KEY` = your key
5. Railway auto-deploys
6. Click "Generate Domain" to get public URL
7. **Copy the URL**

## Step 2: Update Frontend Config

Edit `js/config.js` line 6:
```javascript
: 'https://YOUR-BACKEND-URL-HERE.com';  // Replace with URL from Step 1
```

Example:
```javascript
: 'https://mymedguide-api.onrender.com';
```

## Step 3: Commit and Push

```bash
git add .
git commit -m "Add image recognition with deployed backend"
git push origin main
```

## Step 4: Enable GitHub Pages

1. Go to https://github.com/ecybermission796-max/MyMedGuide
2. Click "Settings" tab
3. Scroll to "Pages" in left sidebar
4. Under "Source":
   - Branch: `main`
   - Folder: `/ (root)`
5. Click "Save"
6. Wait ~2 minutes
7. Your site will be live at:
   ```
   https://ecybermission796-max.github.io/MyMedGuide/
   ```

## Step 5: Test Production

1. Open `https://ecybermission796-max.github.io/MyMedGuide/`
2. Go to Picture Recognition
3. Upload a test image
4. Click "Search similar"
5. New tab should open with results

## Troubleshooting

**"Recognition failed" error:**
- Check backend logs on Render/Railway
- Verify `GOOGLE_VISION_API_KEY` is set correctly
- Check CORS: backend should allow GitHub Pages origin

**"Failed to fetch" error:**
- Check `js/config.js` has correct backend URL
- Verify backend is running (visit backend URL in browser, should see server message)

**Backend shows "BILLING_DISABLED":**
- Enable billing in Google Cloud Console
- Wait a few minutes for changes to propagate

## Cost Notes

- **Render free tier**: 750 hours/month (enough for 24/7 uptime)
- **Railway free tier**: $5 credit/month
- **Google Vision API**: First 1,000 requests/month free
- **GitHub Pages**: Free for public repos

## Security

✅ Your API key is safe:
- Stored only in backend environment variables (not in git)
- Never exposed to frontend JavaScript
- Users can't extract it from your site

⚠️ Anyone can use your deployed app (consuming your API quota)
💡 Consider adding rate limiting if usage becomes high
