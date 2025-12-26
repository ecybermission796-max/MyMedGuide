# check-manifest-names.ps1
# Verifies that all image filenames in manifests have matching entries in Biterdata.json
# Usage: .\scripts\check-manifest-names.ps1
#        (checks all three types: bugs, animals, plants)

param(
  # Optional: check only specific types
  [ValidateSet('bugs', 'animals', 'plants')]
  [string[]]$Types = @('bugs', 'animals', 'plants')
)

$biterdataPath = "data/Biterdata.json"

# Validate Biterdata exists
if (-not (Test-Path $biterdataPath)) {
  Write-Error "Biterdata.json not found: $biterdataPath"
  exit 1
}

# Load Biterdata once
try {
  $biterdata = Get-Content $biterdataPath -Raw | ConvertFrom-Json
} catch {
  Write-Error "Failed to parse JSON: $_"
  exit 1
}

# Get all keys from Biterdata and normalize them
$biterKeys = @{}
$biterdata.PSObject.Properties | ForEach-Object {
  $originalKey = $_.Name
  # Standardized normalization: 1) Remove parentheses, commas, and apostrophes, 2) Replace spaces/hyphens with underscores, 3) Lowercase
  $normalizedKey = $originalKey -replace "[(),']",""
  $normalizedKey = $normalizedKey -replace '[ \-]+','_'
  $normalizedKey = $normalizedKey.ToLower()
  $biterKeys[$normalizedKey] = $originalKey
}

# Function to check a single type
function Check-ManifestType {
  param(
    [string]$Type,
    [hashtable]$BiterKeys
  )
  
  $manifestPath = "images/$Type/manifest.json"
  
  # Validate manifest exists
  if (-not (Test-Path $manifestPath)) {
    Write-Host "  [SKIP] Manifest not found: $manifestPath" -ForegroundColor Yellow
    return 0, 0, 0
  }
  
  # Load manifest
  try {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  } catch {
    Write-Host "  [ERROR] Failed to parse manifest: $_" -ForegroundColor Red
    return 0, 0, 0
  }
  
  $matchCount = 0
  $missingCount = 0
  $results = @()
  
  foreach ($imagePath in $manifest) {
    # Extract filename and remove extension
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileName($imagePath))
    
    # Normalize filename the same way
    # Standardized normalization: 1) Remove parentheses, commas, and apostrophes, 2) Replace spaces/hyphens with underscores, 3) Lowercase
    $normalizedName = $fileName -replace "[(),']",""
    $normalizedName = $normalizedName -replace '[ \-]+','_'
    $normalizedName = $normalizedName.ToLower()
    
    # Try to find a match
    $matchedKey = $null
    if ($BiterKeys.ContainsKey($normalizedName)) {
      $matchedKey = $BiterKeys[$normalizedName]
      $matchCount++
      $results += @{
        File     = $fileName
        Match    = $matchedKey
        Status   = 'FOUND'
        Color    = 'Green'
      }
    } else {
      $missingCount++
      $results += @{
        File     = $fileName
        Match    = 'N/A'
        Status   = 'MISSING'
        Color    = 'Red'
      }
    }
  }
  
  # Display results for this type
  Write-Host "`n  Type: $Type" -ForegroundColor Cyan
  Write-Host "  Manifest: $manifestPath" -ForegroundColor Gray
  
  foreach ($result in $results) {
    $statusColor = $result.Color
    $status = $result.Status
    $file = $result.File
    $match = $result.Match
    
    Write-Host "    [$status] $file" -ForegroundColor $statusColor -NoNewline
    if ($match -ne 'N/A') {
      Write-Host " -> '$match'" -ForegroundColor Gray
    } else {
      Write-Host " -> NOT FOUND" -ForegroundColor Red
    }
  }
  
  # Summary for this type
  Write-Host "    Total: $($manifest.Count) | Matched: $matchCount | Missing: $missingCount" -ForegroundColor $(if ($missingCount -gt 0) { 'Yellow' } else { 'Green' })
  
  return $manifest.Count, $matchCount, $missingCount
}

# Main execution
Write-Host "========== Manifest Name Checking ==========" -ForegroundColor Cyan
Write-Host "Biterdata: $biterdataPath`n"

$totalImages = 0
$totalMatched = 0
$totalMissing = 0

foreach ($type in $Types) {
  $count, $matched, $missing = Check-ManifestType -Type $type -BiterKeys $biterKeys
  $totalImages += $count
  $totalMatched += $matched
  $totalMissing += $missing
}

# Overall summary
Write-Host "`n========== Overall Summary ==========" -ForegroundColor Cyan
Write-Host "Total images: $totalImages"
Write-Host "Matched: $totalMatched" -ForegroundColor Green
Write-Host "Missing: $totalMissing" -ForegroundColor $(if ($totalMissing -gt 0) { 'Red' } else { 'Green' })

if ($totalMissing -eq 0) {
  Write-Host "`n[OK] All images have matching entries in Biterdata.json" -ForegroundColor Green
  exit 0
} else {
  Write-Host "`n[ERROR] $totalMissing image(s) missing from Biterdata.json" -ForegroundColor Red
  exit 1
}
