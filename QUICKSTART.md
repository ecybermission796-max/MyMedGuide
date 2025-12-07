# Quick Start: Deploy Your App Publicly

## What's Set Up

✅ Backend server that keeps your API key safe  
✅ Frontend config that switches between local/production automatically  
✅ CORS configured to allow GitHub Pages to call your backend  
✅ `.env` file protection (API key never pushed to GitHub)

## Your Next Steps

### 1. Fix the .gitignore issue
You have a `.gitignore` folder instead of a file. Rename it:

```powershell
# Rename the folder to keep your archive files
Rename-Item -Path "D:\GitPage\.gitignore" -NewName ".gitignore_archive"

# Use the proper gitignore file
Rename-Item -Path "D:\GitPage\.gitignore_proper" -NewName ".gitignore"
```

### 2. Deploy Your Backend (Choose Render.com - easiest)

1. **Go to https://render.com** and sign up with GitHub
2. Click **"New +" → "Web Service"**
3. **Connect your repo**: `ecybermission796-max/MyMedGuide`
4. **Configure**:
   - Name: `mymedguide-api`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node manifest-generator-server.js`
5. Click **"Advanced"** → **"Add Environment Variable"**:
   - Key: `GOOGLE_VISION_API_KEY`
   - Value: `AIzaSyDsyjxqAvk4rwRYfpSHeFDVJ_bsqiDzJf8`
6. Click **"Create Web Service"**
7. **Wait 2 minutes** for deployment
8. **Copy your URL** (e.g., `https://mymedguide-api.onrender.com`)

### 3. Update Frontend Config

Edit `js/config.js` line 6 and paste your Render URL:

```javascript
: 'https://mymedguide-api.onrender.com';  // REPLACE WITH YOUR URL
```

### 4. Push to GitHub

```powershell
cd D:\GitPage
git add .
git commit -m "Add image recognition with secure backend"
git push origin main
```

### 5. Enable GitHub Pages

1. Go to https://github.com/ecybermission796-max/MyMedGuide/settings/pages
2. Under "Source": select **Branch: main**, **Folder: / (root)**
3. Click **"Save"**
4. Wait 2 minutes
5. Your public site: `https://ecybermission796-max.github.io/MyMedGuide/`

## How It Works

```
User visits GitHub Pages
    ↓
Uploads image in browser
    ↓
Frontend sends to your Render backend (HTTPS)
    ↓
Backend uses YOUR API key to call Google Vision
    ↓
Backend returns results to frontend
    ↓
User sees matches (never sees your API key!)
```

## Security

✅ **API key is safe**: Only stored on Render (environment variable)  
✅ **GitHub repo is clean**: No secrets committed  
✅ **Public can use your app**: They consume your API quota  

## Free Tier Limits

- **Render**: 750 hours/month (24/7 uptime ✅)
- **Google Vision**: 1,000 requests/month free
- **GitHub Pages**: Unlimited (for public repos)

## Need Help?

Check `DEPLOYMENT.md` for detailed troubleshooting!
