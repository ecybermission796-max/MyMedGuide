# Generate images/bugs/manifest.json listing top-level image files (jpg, jpeg, png)
# Run this from the repository root in PowerShell.

$targetDir = ".\images\bugs"
$outFile = Join-Path $targetDir "manifest.json"

if(-not (Test-Path $targetDir)){
  Write-Error "Directory '$targetDir' not found. Run this from the repo root where 'images/bugs' exists."
  exit 1
}

# Get files directly in images/bugs (no subdirectories), prioritizing .png files
$files = Get-ChildItem -Path $targetDir -File | Where-Object { $_.Extension -match '(?i)^(\.png)$' } | ForEach-Object { "images/bugs/$($_.Name)" }

if($files.Count -eq 0){
  Write-Host "No image files found in $targetDir"
} else {
  # Ensure we always produce a JSON array even when only one file is present
  $json = @($files) | ConvertTo-Json -Depth 1
  $json | Out-File -FilePath $outFile -Encoding UTF8
  Write-Host "Wrote $($files.Count) entries to $outFile"
}
