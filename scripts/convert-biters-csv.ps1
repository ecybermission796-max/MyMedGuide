<#
Convert an exported CSV (from Excel) into a nested JSON structure for the Bugs pages.
Usage (from repo root):
  Powershell.exe -ExecutionPolicy Bypass -File .\scripts\convert-bugs-csv.ps1 -csv .\rawfiles\bugs.csv -out .\data\bugs.json

CSV format expected (headers):
  Keywords,Section,Title,Description

Behavior:
  - Non-recursive grouping by Keywords.
  - Within each keyword pages are grouped by Section; within Section grouped by Title.
  - Multiple rows with the same Title are combined into a single description (joined with blank line between paragraphs).
  - Outputs a JSON object keyed by the keyword string (exact text from Keywords column).

Output example:
{
  "bed bug": {
    "sections": [
      {
        "name": "Overview",
        "items": [
          { "title": "Appearance", "description": "..." },
          { "title": "Behavior", "description": "..." }
        ]
      }
    ]
  }
}
#>

param(
  [Parameter(Mandatory=$false)] [string]$csv = ".\rawfiles\biters.csv",
  [Parameter(Mandatory=$false)] [string]$outDir = ".\data"
)


if(-not (Test-Path $csv)){
  Write-Error "CSV file not found: $csv. Export your Excel file to CSV first and provide the path via -csv"
  exit 2
}

# Import CSV (PowerShell's Import-Csv handles commas and quoted fields)
try{
  $rows = Import-Csv -Path $csv -ErrorAction Stop
}catch{
  Write-Error "Failed to import CSV: $($_.Exception.Message)"
  exit 2
}
if($rows.Count -eq 0){ Write-Error "No rows found in CSV"; exit 3 }

# Build nested grouping: keyword -> section -> title -> [descriptions]
$grouped = @{}

# Also collect per-keyword metadata for the index (Class and OtherKeywords)
$indexMeta = @{}
foreach($row in $rows){
  # Safely coerce CSV fields to strings. Import-Csv can yield non-string types
  # (booleans, numbers, etc.) which would cause .Trim() to fail.
  $kw = $row.Keywords
  if ($kw -eq $null) { $kw = '' } else { $kw = [string]$kw }
  $kw = $kw.Trim()
  if($kw -eq '') { continue }
  # normalize keyword: convert underscores/hyphens to spaces, collapse spaces
  $kw = $kw -replace '[_\-]+',' '
  $kw = ($kw -replace '\s+',' ').Trim()

  $sec = $row.Section
  if ($sec -eq $null) { $sec = '' } else { $sec = [string]$sec }
  $sec = $sec.Trim()
  if($sec -eq ''){ $sec = 'General' }

  $title = $row.Title
  if ($title -eq $null) { $title = '' } else { $title = [string]$title }
  $title = $title.Trim()
  if($title -eq ''){ $title = 'Details' }

  $desc = $row.Description
  if ($desc -eq $null) { $desc = '' } else { $desc = [string]$desc }

  # If the CSV encodes Class or OtherKeywords using the Section column (e.g. Section='Class' and
  # the actual class value is stored in Description), handle that pattern first and skip adding
  # this row as content. This supports spreadsheets where metadata rows are stored like that.
  $secLower = $sec.ToLower()
  if($secLower -eq 'class'){
    # treat description as the Class value for this keyword
    if(-not $indexMeta.ContainsKey($kw)){ $indexMeta[$kw] = @{ Class = ''; OtherKeywords = @() } }
    if(-not [string]::IsNullOrWhiteSpace($desc) -and [string]::IsNullOrWhiteSpace($indexMeta[$kw].Class)){
      $indexMeta[$kw].Class = $desc.Trim()
    }
    continue
  }
  if($secLower -eq 'otherkeywords' -or $secLower -eq 'other keywords'){
    if(-not $indexMeta.ContainsKey($kw)){ $indexMeta[$kw] = @{ Class = ''; OtherKeywords = @() } }
    if(-not [string]::IsNullOrWhiteSpace($desc)){
      $parts = ($desc -split ',') | ForEach-Object { ($_ -replace '"','').Trim() } | Where-Object { $_ -ne '' }
      foreach($p in $parts){ if(-not ($indexMeta[$kw].OtherKeywords -contains $p)){ $indexMeta[$kw].OtherKeywords += $p } }
    }
    continue
  }

  if(-not $grouped.ContainsKey($kw)){
    $grouped[$kw] = @{}
    # initialize index meta for this keyword
    $indexMeta[$kw] = @{ Class = ''; OtherKeywords = @() }
  }
  $sections = $grouped[$kw]

  if(-not $sections.ContainsKey($sec)){
    $sections[$sec] = @{}
  }
  $titles = $sections[$sec]

  if(-not $titles.ContainsKey($title)){
    $titles[$title] = @()
  }
  $titles[$title] += $desc

  # capture Class and OtherKeywords fields (case-insensitive headers)
  $classVal = $null
  $okVal = $null
  if($row.PSObject.Properties.Match('Class')){ $classVal = [string]$row.Class }
  elseif($row.PSObject.Properties.Match('class')){ $classVal = [string]$row.class }
  if($row.PSObject.Properties.Match('OtherKeywords')){ $okVal = [string]$row.OtherKeywords }
  elseif($row.PSObject.Properties.Match('Otherkeywords')){ $okVal = [string]$row.Otherkeywords }
  elseif($row.PSObject.Properties.Match('otherkeywords')){ $okVal = [string]$row.otherkeywords }

  if($classVal -ne $null -and $classVal.Trim() -ne ''){
    # prefer the first non-empty Class seen for this keyword
    if([string]::IsNullOrWhiteSpace($indexMeta[$kw].Class)){
      $indexMeta[$kw].Class = $classVal.Trim()
    }
  }
  if($okVal -ne $null -and $okVal.Trim() -ne ''){
    # split comma-separated OtherKeywords and add unique trimmed values
    $parts = ($okVal -split ',') | ForEach-Object { ($_ -replace '"','').Trim() } | Where-Object { $_ -ne '' }
    foreach($p in $parts){ if(-not ($indexMeta[$kw].OtherKeywords -contains $p)){ $indexMeta[$kw].OtherKeywords += $p } }
  }
}

# Compose output structure
$outObj = @{}

# index object keyed by keyword, holds class and OtherKeywords arrays
$indexObj = @{}
foreach($kw in $grouped.Keys){
  $secArr = @()
  $sections = $grouped[$kw]
  foreach($secName in $sections.Keys){
    $items = @()
    $titles = $sections[$secName]
    foreach($t in $titles.Keys){
      $descParts = $titles[$t] | Where-Object { $_ -ne $null }
      # join multiple description rows into paragraphs
      $descText = ($descParts -join "\n\n").Trim()
      $items += @{ title = $t; description = $descText }
    }
    $secArr += @{ name = $secName; items = $items }
  }
    $outObj[$kw] = @{ sections = $secArr }

    # populate index entry for this keyword
    $meta = $indexMeta[$kw]
    $classVal = ''
    if($meta -and $meta.Class){ $classVal = $meta.Class.Trim() }
    $oks = @()
    if($meta -and $meta.OtherKeywords){ $oks = $meta.OtherKeywords }
    $indexObj[$kw] = @{ class = $classVal; OtherKeywords = $oks }
}
  # Build a filename->keyword map to help client-side matching (e.g. bed_bug -> "bed bug")
$filenameMap = @{ }
foreach($kw in $outObj.Keys){
  # normalize keyword and create several filename-like variants
  # Safely coerce keyword to string (avoid using -or which is a boolean operator)
  $nk = $kw
  if ($nk -eq $null) { $nk = '' } else { $nk = [string]$nk }
  $nk = $nk.Trim().ToLower()
  if($nk -eq ''){ continue }
  $variants = @()
  $variants += $nk
  $variants += ($nk -replace '\s+','_')
  $variants += ($nk -replace '\s+','-')
  $variants += ($nk -replace '\s+','')
  # aggressive: strip non-alphanumeric
  $aggressive = ($nk -replace '[^a-z0-9]','')
  if($aggressive -ne ''){ $variants += $aggressive }

  foreach($v in $variants | Select-Object -Unique){
    if(-not $filenameMap.ContainsKey($v)){
      $filenameMap[$v] = $kw
    }
  }
}

# Validation: each item must have a class and at least one OtherKeywords entry
$errors = @()
# DEBUG: dump indexMeta and grouped keys to debug files to help diagnose empty index
try{
  $dbgOutDir = $outDir
  if(-not (Test-Path $dbgOutDir)){ New-Item -ItemType Directory -Path $dbgOutDir | Out-Null }
  $dbgMetaPath = Join-Path $dbgOutDir 'debug_indexMeta.json'
  ($indexMeta | ConvertTo-Json -Depth 5) | Out-File -FilePath $dbgMetaPath -Encoding UTF8
  $dbgGroupedPath = Join-Path $dbgOutDir 'debug_grouped_keys.json'
  ($grouped.Keys | Sort-Object | ConvertTo-Json -Depth 5) | Out-File -FilePath $dbgGroupedPath -Encoding UTF8
  Write-Host "Wrote debug files: $dbgMetaPath, $dbgGroupedPath"
}catch{
  Write-Warning "Failed to write debug files: $($_.Exception.Message)"
}
foreach($k in $indexObj.Keys){
  $entry = $indexObj[$k]
  if([string]::IsNullOrWhiteSpace($entry.class)){
    $errors += "Missing Class for keyword: '$k'"
  }
  if(-not $entry.OtherKeywords -or $entry.OtherKeywords.Count -eq 0){
    $errors += "Missing OtherKeywords for keyword: '$k'"
  }
}
if($errors.Count -gt 0){
  Write-Error "Validation failed: the following problems were found:`n$($errors -join "`n")"
  exit 4
}

# Ensure destination dir exists
$odir = $outDir
if(-not (Test-Path $odir)){ New-Item -ItemType Directory -Path $odir | Out-Null }

# Write biterdata.json (without class/OtherKeywords)
$biterdataPath = Join-Path $odir 'biterdata.json'
$outJson = $outObj | ConvertTo-Json -Depth 10
$outJson | Out-File -FilePath $biterdataPath -Encoding UTF8
Write-Host "Wrote $(($outObj.Keys).Count) keywords to $biterdataPath"

# Write index file that includes class and OtherKeywords arrays
$indexPath = Join-Path $odir 'biterdata_index.json'
$indexJson = $indexObj | ConvertTo-Json -Depth 5
$indexJson | Out-File -FilePath $indexPath -Encoding UTF8
Write-Host "Wrote index to $indexPath"

# Write filename map next to output JSON so client can match filenames to keywords
$mapFile = Join-Path $odir 'BiterFilenameMap.json'
$mapJson = $filenameMap | ConvertTo-Json -Depth 5
$mapJson | Out-File -FilePath $mapFile -Encoding UTF8
Write-Host "Wrote filename map to $mapFile"
