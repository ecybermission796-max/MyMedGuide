# Quick Start Guide: Auto-Running Manifest Generators

## Overview
The GitPage app automatically generates image manifests for bugs, animals, and plants views when those views are loaded. The manifest generators are PowerShell scripts that scan the image folders and create JSON lists.

## Setup

### Option 1: Use the Node/Express Server (Recommended for Development)

1. Install dependencies:
```bash
npm install express cors body-parser
```

2. Run the manifest generator server:
```bash
node manifest-generator-server.js
```

The server will start on `http://localhost:3001` and provide HTTP endpoints that the browser will call automatically.

3. Open the app in your browser (make sure it's served from the same origin or the server has CORS enabled):
```bash
# Option A: Use a simple static server
npx http-server .

# Option B: Access via local file (file://) - won't work with CORS, use server instead
```

4. Navigate to the Bugs, Animals, or Plants views. The manifests will be generated automatically.

### Option 2: Run Scripts Manually

If you prefer to run the scripts manually:

```powershell
# Generate bugs manifest
.\scripts\generate-bugs-manifest.ps1

# Generate animals manifest
.\scripts\generate-animals-manifest.ps1

# Generate plants manifest
.\scripts\generate-plants-manifest.ps1
```

Then open the app in your browser. The app will detect the existing manifests and load the images.

### Option 3: Embed in Electron or Other Host Environment

If you're embedding the GitPage app in Electron or another host environment, implement these hooks:

```javascript
// In your host environment, before the app loads:
window.runGenerateBugsManifest = async () => {
  // Call your native/system script execution
  // e.g., invoke PowerShell via Electron IPC
  return true; // return true on success
};

window.runGenerateAnimalsManifest = async () => {
  // Similar implementation
  return true;
};

window.runGeneratePlantsManifest = async () => {
  // Similar implementation
  return true;
};
```

## How It Works

1. When the user navigates to the Bugs, Animals, or Plants view, the app calls:
   - `generateBugsManifest()`
   - `generateAnimalsManifest()`
   - `generatePlantsManifest()`

2. These functions try, in order:
   - **Option A**: Call the integration hook (e.g., `window.runGenerateBugsManifest()`)
   - **Option B**: POST to `/run-script/generate-{type}-manifest.ps1` (HTTP endpoint)
   - **Option C**: Load an existing manifest from `images/{type}/manifest.json`
   - **Fallback**: Show a message if no manifest is found

3. Once a manifest is available, the images are rendered in a 4-column table.

## Files

- `scripts/generate-bugs-manifest.ps1` — scans `images/bugs/` and creates `images/bugs/manifest.json`
- `scripts/generate-animals-manifest.ps1` — scans `images/animals/` and creates `images/animals/manifest.json`
- `scripts/generate-plants-manifest.ps1` — scans `images/plants/` and creates `images/plants/manifest.json`
- `js/manifest-generator-client.js` — client-side integration hooks for the HTTP endpoints
- `manifest-generator-server.js` — Node/Express server that runs the PowerShell scripts

## Troubleshooting

**Images not showing up?**
- Check the browser console for messages starting with `[manifest-generator]`
- Verify the `images/bugs/`, `images/animals/`, and `images/plants/` directories exist and contain image files
- Ensure the PowerShell scripts have executed and created the manifest files in those directories

**PowerShell script errors?**
- Run the script manually to see detailed error messages:
  ```powershell
  .\scripts\generate-animals-manifest.ps1
  ```
- Check that PowerShell execution policy allows running scripts:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
  ```

**Server not responding?**
- Make sure `node manifest-generator-server.js` is running
- Check that the browser is accessing the app from `http://localhost:3000` (or the same origin as the server)
- Verify firewall allows local port access
