# Fix Render.com Deployment for Gemini AI

## Problem
Backend is returning 502 error because it's missing the new Gemini API configuration.

## Solution - Update Render.com Deployment

### Step 1: Update Environment Variable
1. Go to https://render.com/dashboard
2. Find your service: **mymedguide** or **mymedguide-api**
3. Click on the service name
4. Click **"Environment"** tab on the left
5. **Delete** the old variable if it exists:
   - `GOOGLE_VISION_API_KEY`
6. **Add** new environment variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `AIzaSyCp3Syx3XdUn_0SXMJtsY8gcm4EKKUFDaA`
7. Click **"Save Changes"**

### Step 2: Redeploy with Latest Code
1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "Update to Gemini AI with secure backend"
   git push origin main
   ```

2. On Render.com dashboard:
   - Your service should auto-deploy when you push to GitHub
   - OR click **"Manual Deploy"** → **"Deploy latest commit"**

3. Wait for deployment to complete (~2 minutes)
   - Watch the logs for any errors
   - Look for: `[server] Manifest generator server running on http://...`

### Step 3: Test
1. Go to your GitHub Pages site
2. Navigate to Picture Recognition
3. Upload an image
4. Click Submit
5. You should see "Analyzing image with Google AI..." followed by results

## Verification
If successful, you'll see in browser console:
```
Sending to backend - mime type: image/jpeg
Backend response: {ok: true, aiResponse: "...", matches: [...]}
```

## If Still Getting 502
Check Render.com logs:
1. On service page, click **"Logs"** tab
2. Look for error messages
3. Common issues:
   - Missing `GEMINI_API_KEY` environment variable
   - Wrong API key
   - Gemini API quota exceeded
   - Old code still deployed (click Manual Deploy again)
