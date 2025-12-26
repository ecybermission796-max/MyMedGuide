# generate-plants-manifest.ps1
# Scans images/plants/ directory and creates a manifest.json listing all image files
# Includes both top-level logos and images from keyword subfolders

param(
  [string]$TargetDir = "images/plants",
  [string]$OutputFile = "images/plants/manifest.json"
)

# Validate target directory exists
if (-not (Test-Path $TargetDir -PathType Container)) {
  Write-Error "Target directory does not exist: $TargetDir"
  exit 1
}

$manifest = @{}

# Get top-level logo files (.png only)
$logoFiles = Get-ChildItem -Path $TargetDir -File | Where-Object { $_.Extension -match '(?i)^(\.png)$' } | ForEach-Object { "$TargetDir/$($_.Name)" } | Sort-Object
$manifest["logos"] = @($logoFiles)

# Get all keyword subdirectories
$keywordDirs = Get-ChildItem -Path $TargetDir -Directory

foreach ($dir in $keywordDirs) {
  $keyword = $dir.Name
  $keywordPath = $dir.FullName
  
  # Get all images in the keyword folder (jpg, jpeg, png)
  $images = Get-ChildItem -Path $keywordPath -File | Where-Object { $_.Extension -match '(?i)^\.(jpg|jpeg|png)$' } | ForEach-Object { "$TargetDir/$keyword/$($_.Name)" } | Sort-Object
  
  # Get all thumbnails if the thumbnails subfolder exists
  $thumbnailsPath = Join-Path $keywordPath "thumbnails"
  $thumbnails = @()
  if (Test-Path $thumbnailsPath -PathType Container) {
    $thumbnails = Get-ChildItem -Path $thumbnailsPath -File | Where-Object { $_.Extension -match '(?i)^\.(jpg|jpeg|png)$' } | ForEach-Object { "$TargetDir/$keyword/thumbnails/$($_.Name)" } | Sort-Object
  }
  
  # Add to manifest
  $manifest[$keyword] = @{
    images = @($images)
    thumbnails = @($thumbnails)
  }
}

# Convert to JSON
$json = $manifest | ConvertTo-Json -Depth 3

# Create output directory if it doesn't exist
$outputDir = Split-Path -Parent $OutputFile
if (-not (Test-Path $outputDir -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Write to file without BOM
[System.IO.File]::WriteAllText($OutputFile, $json)

Write-Host "Generated manifest: $OutputFile"
Write-Host "Total keywords: $($keywordDirs.Count)"
Write-Host "Total logos: $($logoFiles.Count)"
exit 0
