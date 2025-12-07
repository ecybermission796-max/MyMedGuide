#git pull

# 1. Check what’s changed
#git status

# 2. Stage all changes (modified, added, deleted files)
git add .

# 3. Commit with a message describing the update
git commit -m "Add search function, trial 4"

# 4. Push to GitHub (main branch)
git push origin main


# cd D:\GitPage
# Open http://localhost:8000
# stop by Ctrl+C

# cd D:\GitPage
# API key is now loaded from .env file automatically
# No need to set $env:GOOGLE_VISION_API_KEY manually
node manifest-generator-server.js
#open in browser http://localhost:3001
# python -m http.server 8000
# Open http://localhost:8000
# stop by Ctrl+C