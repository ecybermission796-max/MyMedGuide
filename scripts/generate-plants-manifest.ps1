# generate-plants-manifest.ps1
# Scans images/plants/ directory and creates a manifest.json listing all image files

param(
  [string]$TargetDir = "images/plants",
  [string]$OutputFile = "images/plants/manifest.json"
)

# Validate target directory exists
if (-not (Test-Path $TargetDir -PathType Container)) {
  Write-Error "Target directory does not exist: $TargetDir"
  exit 1
}

# Get all image files in the target directory (not in subdirectories)
$files = Get-ChildItem -Path $TargetDir -File | Where-Object { $_.Extension -match '(?i)^(\.jpg|\.jpeg|\.png)$' } | ForEach-Object { "$TargetDir/$($_.Name)" }

# Sort files alphabetically
$files = $files | Sort-Object

# Convert to JSON array
$json = $files | ConvertTo-Json

# Create output directory if it doesn't exist
$outputDir = Split-Path -Parent $OutputFile
if (-not (Test-Path $outputDir -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Write to file
$json | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "Generated manifest: $OutputFile"
Write-Host "Total files: $($files.Count)"
exit 0
