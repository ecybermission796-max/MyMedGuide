// manifest-generator-client.js
// Provides integration hooks to automatically run PowerShell manifest generators
// when the page loads. This script attempts to POST to local HTTP endpoints
// that invoke the PowerShell scripts (e.g., Node/Express server).
//
// Usage: include this script BEFORE browse.js in index.html
// <script src="js/manifest-generator-client.js"></script>
// <script src="js/browse.js"></script>

(function(){
  'use strict';

  // Helper to POST to a local endpoint and run a PowerShell script
  async function runPowerShellScript(scriptName) {
    try {
      const response = await fetch(`/run-script/${scriptName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptName })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const result = await response.json();
      console.log(`[manifest-generator] ${scriptName} executed:`, result);
      return true;
    } catch (err) {
      console.debug(`[manifest-generator] Could not run ${scriptName} via HTTP endpoint:`, err.message);
      return false;
    }
  }

  // Integration hook: run generate-bugs-manifest.ps1
  window.runGenerateBugsManifest = async function() {
    console.debug('[manifest-generator] Attempting to run generate-bugs-manifest.ps1');
    return await runPowerShellScript('generate-bugs-manifest.ps1');
  };

  // Integration hook: run generate-animals-manifest.ps1
  window.runGenerateAnimalsManifest = async function() {
    console.debug('[manifest-generator] Attempting to run generate-animals-manifest.ps1');
    return await runPowerShellScript('generate-animals-manifest.ps1');
  };

  // Integration hook: run generate-plants-manifest.ps1
  window.runGeneratePlantsManifest = async function() {
    console.debug('[manifest-generator] Attempting to run generate-plants-manifest.ps1');
    return await runPowerShellScript('generate-plants-manifest.ps1');
  };

  console.log('[manifest-generator] Integration hooks registered. Manifest generators will auto-run when views load.');
})();
