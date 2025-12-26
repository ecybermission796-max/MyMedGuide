# Generate images/bugs/manifest.json listing all image files
# Includes both top-level logos and images from keyword subfolders
# Run this from the repository root in PowerShell.

$targetDir = ".\images\bugs"
$outFile = Join-Path $targetDir "manifest.json"

if(-not (Test-Path $targetDir)){
  Write-Error "Directory '$targetDir' not found. Run this from the repo root where 'images/bugs' exists."
  exit 1
}

$manifest = @{}

# Get top-level logo files (.png only)
$logoFiles = Get-ChildItem -Path $targetDir -File | Where-Object { $_.Extension -match '(?i)^(\.png)$' } | ForEach-Object { "images/bugs/$($_.Name)" } | Sort-Object
$manifest["logos"] = @($logoFiles)

# Get all keyword subdirectories
$keywordDirs = Get-ChildItem -Path $targetDir -Directory

foreach ($dir in $keywordDirs) {
  $keyword = $dir.Name
  $keywordPath = $dir.FullName
  
  # Get all images in the keyword folder (jpg, jpeg, png)
  $images = Get-ChildItem -Path $keywordPath -File | Where-Object { $_.Extension -match '(?i)^\.(jpg|jpeg|png)$' } | ForEach-Object { "images/bugs/$keyword/$($_.Name)" } | Sort-Object
  
  # Get all thumbnails if the thumbnails subfolder exists
  $thumbnailsPath = Join-Path $keywordPath "thumbnails"
  $thumbnails = @()
  if (Test-Path $thumbnailsPath -PathType Container) {
    $thumbnails = Get-ChildItem -Path $thumbnailsPath -File | Where-Object { $_.Extension -match '(?i)^\.(jpg|jpeg|png)$' } | ForEach-Object { "images/bugs/$keyword/thumbnails/$($_.Name)" } | Sort-Object
  }
  
  # Add to manifest
  $manifest[$keyword] = @{
    images = @($images)
    thumbnails = @($thumbnails)
  }
}

# Convert to JSON
$json = $manifest | ConvertTo-Json -Depth 3

# Write to file without BOM
$fullPath = (Resolve-Path $targetDir).Path + "\manifest.json"
[System.IO.File]::WriteAllText($fullPath, $json)

Write-Host "Generated manifest: $outFile"
Write-Host "Total keywords: $($keywordDirs.Count)"
Write-Host "Total logos: $($logoFiles.Count)"
exit 0
