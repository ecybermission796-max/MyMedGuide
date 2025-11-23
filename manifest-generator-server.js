#!/usr/bin/env node
// manifest-generator-server.js
// Simple Node/Express server that provides HTTP endpoints to run PowerShell scripts
// for generating the animals and plants manifests.
//
// Usage:
//   npm install express cors body-parser
//   node manifest-generator-server.js
//
// The server will listen on http://localhost:3001 and provide endpoints:
//   POST /run-script/generate-bugs-manifest.ps1
//   POST /run-script/generate-animals-manifest.ps1
//   POST /run-script/generate-plants-manifest.ps1

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the repo root (for testing)
app.use(express.static(path.join(__dirname, '.')));

// Endpoint to run a PowerShell script
app.post('/run-script/:scriptName', (req, res) => {
  const scriptName = req.params.scriptName;
  const scriptPath = path.join(__dirname, 'scripts', scriptName);

  console.log(`[server] Running: ${scriptPath}`);

  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  ps.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log(`[powershell] ${data.toString().trim()}`);
  });

  ps.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error(`[powershell] ERROR: ${data.toString().trim()}`);
  });

  ps.on('close', (code) => {
    if (code === 0) {
      console.log(`[server] Script succeeded: ${scriptName}`);
      res.json({
        success: true,
        script: scriptName,
        output: stdout,
        code: code
      });
    } else {
      console.error(`[server] Script failed with code ${code}: ${scriptName}`);
      res.status(500).json({
        success: false,
        script: scriptName,
        output: stdout,
        error: stderr,
        code: code
      });
    }
  });

  ps.on('error', (err) => {
    console.error(`[server] Failed to spawn process: ${err.message}`);
    res.status(500).json({
      success: false,
      script: scriptName,
      error: err.message
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[server] Manifest generator server running on http://localhost:${PORT}`);
  console.log('[server] Endpoints:');
  console.log(`  POST /run-script/generate-bugs-manifest.ps1`);
  console.log(`  POST /run-script/generate-animals-manifest.ps1`);
  console.log(`  POST /run-script/generate-plants-manifest.ps1`);
  console.log(`  GET /health`);
});
