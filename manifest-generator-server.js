#!/usr/bin/env node
// manifest-generator-server.js
// Simple Node/Express server that provides HTTP endpoints to run PowerShell scripts
// for generating the animals and plants manifests.
//
// Usage:
//   npm install express cors body-parser dotenv
//   node manifest-generator-server.js
//
// The server will listen on http://localhost:3001 and provide endpoints:
//   POST /run-script/generate-bugs-manifest.ps1
//   POST /run-script/generate-animals-manifest.ps1
//   POST /run-script/generate-plants-manifest.ps1

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for GitHub Pages and local development
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://ecybermission796-max.github.io'
  ],
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

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

// Recognition endpoint: accepts JSON { image: '<base64-data>' }
app.post('/api/recognize', async (req, res) => {
  try{
    const { image } = req.body || {};
    if(!image) return res.status(400).json({ error: 'Missing image (base64) in request body' });

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if(!apiKey){
      return res.status(501).json({ error: 'Server-side Google Vision API key not configured. Set GOOGLE_VISION_API_KEY.' });
    }

    // Build Vision API request
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const body = {
      requests: [
        {
          image: { content: image },
          features: [
            { type: 'WEB_DETECTION', maxResults: 10 },
            { type: 'LABEL_DETECTION', maxResults: 10 }
          ]
        }
      ]
    };

    const vres = await fetch(visionUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if(!vres.ok){
      const txt = await vres.text();
      console.error('[vision] non-ok', vres.status, txt);
      return res.status(502).json({ error: 'Vision API request failed', detail: txt });
    }
    const vjson = await vres.json();
    const resp = (vjson.responses && vjson.responses[0]) || {};

    // Extract candidate names from webDetection and labelAnnotations
    const candidates = new Set();
    if(resp.webDetection){
      (resp.webDetection.bestGuessLabels || []).forEach(b=>{ if(b.label) candidates.add(b.label.toLowerCase()); });
      (resp.webDetection.webEntities || []).forEach(e=>{ if(e.description) candidates.add(e.description.toLowerCase()); });
    }
    if(resp.labelAnnotations){
      (resp.labelAnnotations || []).forEach(l=>{ if(l.description) candidates.add(l.description.toLowerCase()); });
    }

    // Now load local biter index and score matches (simple token matching)
    const indexRaw = await fs.readFile(path.join(__dirname, 'data', 'biterdata_index.json'), 'utf8');
    // strip BOM if present (common on Windows)
    const indexStr = indexRaw.replace(/^\uFEFF/, '');
    const index = JSON.parse(indexStr);
    const tokens = Array.from(candidates).flatMap(s => s.split(/[,;\s]+/)).map(s=>s.trim()).filter(Boolean);

    function scoreEntry(key, entry){
      const name = (key||'').toLowerCase();
      const others = (entry.OtherKeywords||[]).map(o=>o.toLowerCase());
      let score = 0;
      for(const t of tokens){ if(!t) continue; if(name.includes(t)) score += 3; else if(others.some(o=>o.includes(t))) score += 2; }
      return score;
    }

    const scored = [];
    for(const k of Object.keys(index)){
      const s = scoreEntry(k, index[k]);
      if(s>0) scored.push({ key: k, class: index[k].class, score: s });
    }
    scored.sort((a,b)=>b.score - a.score);

    // For each top result try to locate an image path in images/<class>/manifest.json
    async function findImageForKeyword(keyword, cls){
      const manifestPath = path.join(__dirname, 'images', cls.toLowerCase(), 'manifest.json');
      try{
        const mf = await fs.readFile(manifestPath, 'utf8');
        let files = JSON.parse(mf);
        if(!Array.isArray(files)){
          if(typeof files === 'string') files = [files];
          else if(files && typeof files === 'object'){
            if(Array.isArray(files.files)) files = files.files;
            else if(Array.isArray(files.paths)) files = files.paths;
            else files = Object.values(files).flat().filter(v=>typeof v === 'string');
          } else files = [];
        }
        const k = keyword.toLowerCase();
        for(const f of files){
          const base = path.basename(f).replace(/\.(jpg|jpeg|png)$/i,'').replace(/[_\-]+/g,' ').trim().toLowerCase();
          if(base === k) return f;
        }
      }catch(e){ /* ignore */ }
      return null;
    }

    const matches = [];
    for(const s of scored.slice(0,3)){
      const img = await findImageForKeyword(s.key, s.class);
      matches.push({ keyword: s.key, class: s.class, img });
    }

    // Prepare helpful fallback links (pagesWithMatchingImages)
    const fallbackPages = (resp.webDetection && resp.webDetection.pagesWithMatchingImages) ? resp.webDetection.pagesWithMatchingImages.map(p=>p.url) : [];

    res.json({ ok: true, candidates: Array.from(candidates).slice(0,20), matches, fallbackPages });
  }catch(err){
    console.error('[server/recognize] error', err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
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
