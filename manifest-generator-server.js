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

// Recognition endpoint: accepts JSON { image: '<base64-data>', mimeType: 'image/jpeg' }
app.post('/api/recognize', async (req, res) => {
  try{
    const { image, mimeType } = req.body || {};
    if(!image) return res.status(400).json({ error: 'Missing image (base64) in request body' });

    // Gemini API key - stored securely on server (use environment variable in production)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if(!apiKey){
      console.error('[server] GEMINI_API_KEY not set in environment');
      return res.status(501).json({ error: 'Server API key not configured' });
    }
    
    console.log('[server] Calling Gemini API for image recognition...');

    // Models to try in order (fallback when quota exceeded)
    const models = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-exp',
      'gemini-2.5-flash'
    ];

    let geminiJson = null;
    let lastError = null;
    
    for(const model of models){
      try{
        console.log(`[server] Trying model: ${model}`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiBody = {
          contents: [{
            parts: [
              {
                text: "Identify the animal/bug/plants in the picture and return in the following format: Category: xxx, Top three hits: 1...  2... 3....  In the Category part, fill in either Mosquitos, Plants, Snake, Spider, Scorpion, Lizard, Other Bugs, Fleas, Snakes, Bees, Scorpions, Ticks, Snail, Dogs, Stingray, or unidentified. and then return the top three best hits of the identified animal/bug/plant."
              },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: image
                }
              }
            ]
          }]
        };

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        });

        if(!geminiRes.ok){
          const errorText = await geminiRes.text();
          console.error(`[gemini] ${model} API error:`, geminiRes.status, errorText);
          
          // Check if it's a quota error (429 or resource exhausted)
          if(geminiRes.status === 429 || errorText.includes('RESOURCE_EXHAUSTED') || errorText.includes('quota')){
            console.log(`[server] ${model} quota exceeded, trying next model...`);
            lastError = `${model}: quota exceeded`;
            continue; // Try next model
          }
          
          // Other errors - don't retry
          return res.status(502).json({ error: 'Gemini API request failed', detail: errorText, status: geminiRes.status });
        }

        geminiJson = await geminiRes.json();
        console.log(`[gemini] ${model} success`);
        break; // Success - exit loop
        
      }catch(e){
        console.error(`[server] Error with ${model}:`, e.message);
        lastError = `${model}: ${e.message}`;
        continue; // Try next model
      }
    }

    if(!geminiJson){
      console.error('[server] All models failed');
      return res.status(502).json({ error: 'All Gemini models failed or quota exceeded', detail: lastError });
    }
    console.log('[gemini] Response:', JSON.stringify(geminiJson, null, 2));

    // Extract AI text response
    let aiText = '';
    if(geminiJson.candidates && geminiJson.candidates[0] && geminiJson.candidates[0].content && geminiJson.candidates[0].content.parts){
      aiText = geminiJson.candidates[0].content.parts.map(p => p.text || '').join(' ');
    }

    if(!aiText){
      console.error('[gemini] No text in response');
      return res.status(502).json({ error: 'Gemini returned no text', raw: geminiJson });
    }

    console.log('[gemini] AI identified:', aiText);

    // Extract Category from Gemini response
    const categoryMatch = aiText.match(/Category:\s*([^,\n]+)/i);
    let category = categoryMatch ? categoryMatch[1].trim() : 'unidentified';
    console.log('[server] Extracted category:', category);
    
    // Map category to class name (handle plural/singular variations)
    const categoryMap = {
      'mosquitos': 'bugs',
      'plants': 'plants',
      'snake': 'animals',
      'snakes': 'animals',
      'spider': 'bugs',
      'scorpion': 'bugs',
      'scorpions': 'bugs',
      'lizard': 'animals',
      'other bugs': 'bugs',
      'fleas': 'bugs',
      'bees': 'bugs',
      'ticks': 'bugs',
      'snail': 'bugs',
      'dogs': 'animals',
      'stingray': 'animals',
      'unidentified': null
    };
    
    const targetClass = categoryMap[category.toLowerCase()];
    console.log('[server] Target class:', targetClass);
    
    // If category is unidentified or not recognized, return full Gemini text with no local matches
    if(!targetClass){
      console.log('[server] Category unidentified or not recognized, returning full Gemini response');
      return res.json({
        ok: true,
        aiResponse: aiText,
        matches: [],
        candidates: [],
        noLocalMatch: true,
        category: category
      });
    }

    // Load local biter index and search for matches
    const indexRaw = await fs.readFile(path.join(__dirname, 'data', 'biterdata_index.json'), 'utf8');
    const indexStr = indexRaw.replace(/^\uFEFF/, ''); // strip BOM
    const index = JSON.parse(indexStr);

    // Extract species names from numbered list (e.g., "1. **Western Rattlesnake** (_Crotalus oreganus_)")
    const speciesNames = [];
    const lines = aiText.split('\n');
    for(const line of lines){
      // Match patterns like: "1. **Species Name** (_Scientific name_)" or "1. Species Name (Scientific name)"
      const match = line.match(/^\d+\.\s+\*{0,2}([^*(_]+)\*{0,2}\s*(?:\([^)]*\))?/);
      if(match){
        const commonName = match[1].trim();
        speciesNames.push(commonName);
      }
    }

    console.log('[server] Extracted species names:', speciesNames);

    // Create search tokens from extracted species names only
    const tokens = speciesNames
      .flatMap(name => name.toLowerCase().split(/\s+/))
      .map(s => s.trim())
      .filter(s => s.length > 2);

    console.log('[server] Searching for tokens:', tokens);

    // Zero-score keywords that don't count as matches
    const zeroScoreKeywords = ['common', 'general'];

    // Score entries by matched tokens (only within target class)
    const scored = [];
    for(const key of Object.keys(index)){
      const entry = index[key];
      
      // Only search within the target class
      if(entry.class && entry.class.toLowerCase() !== targetClass.toLowerCase()){
        continue;
      }
      
      const name = (key || '').toLowerCase();
      const sciName = (entry.Scientific_name || '').toLowerCase();
      const otherName = (entry.Other_name || '').toLowerCase();

      let matchCount = 0;

      // Check if any extracted species name matches this entry
      for(const speciesName of speciesNames){
        const lower = speciesName.toLowerCase();
        
        // Exact or substring match with extracted species names
        if(name.includes(lower) || lower.includes(name)){
          matchCount += 15;
        }
        if(sciName && (sciName.includes(lower) || lower.includes(sciName))){
          matchCount += 12;
        }
        if(otherName && (otherName.includes(lower) || lower.includes(otherName))){
          matchCount += 12;
        }
      }

      // Check each token for partial matches (skip zero-score keywords)
      for(const t of tokens){
        // Skip zero-score keywords
        if(zeroScoreKeywords.includes(t)){
          continue;
        }
        
        if(name.includes(t)){
          matchCount += 2;
        } else if(sciName.includes(t)){
          matchCount += 1;
        } else if(otherName.includes(t)){
          matchCount += 1;
        }
      }

      if(matchCount > 0){
        scored.push({ key, class: entry.class, score: matchCount });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);

    console.log('[server] Found', top.length, 'matches:', top);
    
    // If no local matches found, return full Gemini text
    if(top.length === 0){
      console.log('[server] No local matches found, returning full Gemini response');
      return res.json({
        ok: true,
        aiResponse: aiText,
        matches: [],
        candidates: tokens.slice(0, 20),
        noLocalMatch: true,
        category: category
      });
    }

    // Find images for matches
    async function findImageForKeyword(keyword, cls){
      const manifestPath = path.join(__dirname, 'images', cls.toLowerCase(), 'manifest.json');
      try{
        const mf = await fs.readFile(manifestPath, 'utf8');
        let manifest = JSON.parse(mf);
        
        const normalizedKeyword = keyword.replace(/[(),']/g, '').replace(/[ \-]+/g, '_').toLowerCase();
        
        // New manifest structure: {keyword: {images: [...], thumbnails: [...]}}
        if(manifest && manifest[normalizedKeyword]){
          const imgs = manifest[normalizedKeyword].images || [];
          if(imgs.length > 0) return imgs[0];
        }
        
        // Also check logos
        if(manifest && manifest.logos && Array.isArray(manifest.logos)){
          for(const logo of manifest.logos){
            if(logo.toLowerCase().includes(normalizedKeyword)){
              return logo;
            }
          }
        }
      }catch(e){ 
        console.error('[server] Error loading manifest for', cls, ':', e.message);
      }
      return null;
    }

    const matches = [];
    for(const item of top){
      const img = await findImageForKeyword(item.key, item.class);
      matches.push({ key: item.key, keyword: item.key, class: item.class, img, score: item.score });
    }

    res.json({ 
      ok: true, 
      aiResponse: aiText,
      matches, 
      candidates: tokens.slice(0, 20),
      category: category,
      targetClass: targetClass
    });

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
  console.log(`  POST /api/recognize - Gemini AI image recognition`);
  console.log(`  GET /health`);
});
