<#
Convert an exported TAB-delimited TXT (from Excel "Save As" tab delimited) into a nested JSON structure for the Bugs pages.
Usage (from repo root):
  Powershell.exe -ExecutionPolicy Bypass -File .\scripts\convert-biters-txt.ps1 -txt .\rawfiles\biters.txt -out .\data\Biterdata.json

TXT format expected (headers):
  Keywords\tSection\tTitle\tDescription

Behavior:
  - Non-recursive grouping by Keywords.
  - Within each keyword pages are grouped by Section; within Section grouped by Title.
  - Multiple rows with the same Title are combined into a single description (joined with blank line between paragraphs).
  - Outputs a JSON object keyed by the keyword string (exact text from Keywords column).
#>

param(
  [Parameter(Mandatory=$false)] [string]$txt = ".\rawfiles\biters.txt",
  [Parameter(Mandatory=$false)] [string]$out = ".\data\Biterdata.json"
)

if(-not (Test-Path $txt)){
  Write-Error "TXT file not found: $txt. Export your Excel file to Tab-delimited text first and provide the path via -txt"
  exit 2
}

# Import-CSV with tab delimiter; this handles the header row similarly to CSV
$rows = Import-Csv -Path $txt -Delimiter "`t" -ErrorAction Stop
if($rows.Count -eq 0){ Write-Error "No rows found in TXT"; exit 3 }

# Build nested grouping: keyword -> section -> title -> [descriptions]
$grouped = @{}
# collect per-keyword metadata for index (Class and OtherKeywords)
$indexMeta = @{}
foreach($row in $rows){
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

  # If the TXT encodes Class or OtherKeywords using the Section column,
  # treat those rows as metadata and populate the index, then skip content insertion.
  $secLower = $sec.ToLower()
  if($secLower -eq 'class'){
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
    # initialize index meta for this keyword only if not already present
    if(-not $indexMeta.ContainsKey($kw)){ $indexMeta[$kw] = @{ Class = ''; OtherKeywords = @() } }
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

  # capture Class and OtherKeywords fields if provided as separate columns (case-insensitive)
  $classVal = $null
  $okVal = $null
  if($row.PSObject.Properties.Match('Class')){ $classVal = [string]$row.Class }
  elseif($row.PSObject.Properties.Match('class')){ $classVal = [string]$row.class }
  if($row.PSObject.Properties.Match('OtherKeywords')){ $okVal = [string]$row.OtherKeywords }
  elseif($row.PSObject.Properties.Match('Otherkeywords')){ $okVal = [string]$row.Otherkeywords }
  elseif($row.PSObject.Properties.Match('otherkeywords')){ $okVal = [string]$row.otherkeywords }

  if($classVal -ne $null -and $classVal.Trim() -ne ''){
    if([string]::IsNullOrWhiteSpace($indexMeta[$kw].Class)){
      $indexMeta[$kw].Class = $classVal.Trim()
    }
  }
  if($okVal -ne $null -and $okVal.Trim() -ne ''){
    $parts = ($okVal -split ',') | ForEach-Object { ($_ -replace '"','').Trim() } | Where-Object { $_ -ne '' }
    foreach($p in $parts){ if(-not ($indexMeta[$kw].OtherKeywords -contains $p)){ $indexMeta[$kw].OtherKeywords += $p } }
  }
}

# Compose output structure
$outObj = @{}
foreach($kw in $grouped.Keys){
  $secArr = @()
  $sections = $grouped[$kw]
  foreach($secName in $sections.Keys){
    $items = @()
    $titles = $sections[$secName]
    foreach($t in $titles.Keys){
      $descParts = $titles[$t] | Where-Object { $_ -ne $null }
      $descText = ($descParts -join "\n\n").Trim()
      $items += @{ title = $t; description = $descText }
    }
    $secArr += @{ name = $secName; items = $items }
  }
  $outObj[$kw] = @{ sections = $secArr }
}

# Build index object from collected metadata
$indexObj = @{}
foreach($kw in $outObj.Keys){
  $meta = $indexMeta[$kw]
  $classVal = ''
  if($meta -and $meta.Class){ $classVal = $meta.Class.Trim() }
  $oks = @()
  if($meta -and $meta.OtherKeywords){ $oks = $meta.OtherKeywords }
  $indexObj[$kw] = @{ class = $classVal; OtherKeywords = $oks }
}

# Build a filename->keyword map to help client-side matching (e.g. bed_bug -> "bed_bug")
$filenameMap = @{ }
foreach($kw in $outObj.Keys){
  $nk = $kw
  if ($nk -eq $null) { $nk = '' } else { $nk = [string]$nk }
  $nk = $nk.Trim().ToLower()
  if($nk -eq ''){ continue }
  $variants = @()
  $variants += $nk
  $variants += ($nk -replace '\s+','_')
  $variants += ($nk -replace '\s+','-')
  $variants += ($nk -replace '\s+','')
  $aggressive = ($nk -replace '[^a-z0-9]','')
  if($aggressive -ne ''){ $variants += $aggressive }

  foreach($v in $variants | Select-Object -Unique){
    if(-not $filenameMap.ContainsKey($v)){
      $filenameMap[$v] = $kw
    }
  }
}

# Ensure destination dir exists
$odir = Split-Path -Parent $out
if(-not (Test-Path $odir)){ New-Item -ItemType Directory -Path $odir | Out-Null }



# Validation: each item must have a class and at least one OtherKeywords entry
$errors = @()
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

# Write JSON with depth large enough for nested arrays
$outJson = $outObj | ConvertTo-Json -Depth 10
$outJson | Out-File -FilePath $out -Encoding UTF8
Write-Host "Wrote $(($outObj.Keys).Count) keywords to $out"

# Also write lowercase `biterdata.json` (client expects this path)
$biterdataPath = Join-Path $odir 'biterdata.json'
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
