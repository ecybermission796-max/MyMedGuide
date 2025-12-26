<#
Convert an exported TAB-delimited TSV (from Excel "Save As" tab delimited) into a nested JSON structure for the Bugs pages.
Usage (from repo root):
  Powershell.exe -ExecutionPolicy Bypass -File .\scripts\convert-biters-txt.ps1 -txt .\data\Biterdata.tsv -out .\data\Biterdata.json

TSV format expected (headers):
  Keywords\tSection\tDescription

Behavior:
  - Non-recursive grouping by Keywords.
  - Within each keyword pages are grouped by Section.
  - Multiple rows with the same Section are combined into a single description (joined with blank line between paragraphs).
  - Outputs a JSON object keyed by the keyword string (exact text from Keywords column).
  - Index includes Class, state, Category, Scientific_name, and Other_name as additional keywords for search.
#>

param(
  [Parameter(Mandatory=$false)] [string]$txt = ".\data\Biterdata.tsv",
  [Parameter(Mandatory=$false)] [string]$out = ".\data\Biterdata.json"
)

if(-not (Test-Path $txt)){
  Write-Error "TSV file not found: $txt. Export your Excel file to Tab-delimited text first and provide the path via -txt"
  exit 2
}

# Import-CSV with tab delimiter; this handles the header row similarly to CSV
$rows = Import-Csv -Path $txt -Delimiter "`t" -ErrorAction Stop
if($rows.Count -eq 0){ Write-Error "No rows found in TSV"; exit 3 }

# Build nested grouping: keyword -> section -> [descriptions]
$grouped = @{}
# collect per-keyword metadata for index (Class, state, Category, Scientific_name, Other_name)
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
  if($sec -eq ''){ continue }

  $desc = $row.Description
  if ($desc -eq $null) { $desc = '' } else { $desc = [string]$desc }

  # Initialize metadata for this keyword if not present
  if(-not $indexMeta.ContainsKey($kw)){ 
    $indexMeta[$kw] = @{ 
      Class = ''; 
      state = @(); 
      Category = ''; 
      Scientific_name = ''; 
      Other_name = '' 
    } 
  }

  # Capture metadata fields from Section column
  $secLower = $sec.ToLower()
  if($secLower -eq 'class'){
    if(-not [string]::IsNullOrWhiteSpace($desc) -and [string]::IsNullOrWhiteSpace($indexMeta[$kw].Class)){
      $indexMeta[$kw].Class = $desc.Trim()
    }
    continue
  }
  if($secLower -eq 'state'){
    if(-not [string]::IsNullOrWhiteSpace($desc)){
      # Split by comma, semicolon, and/or "and"/"or" words
      $parts = ($desc -split '[,;]|\\band\\b|\\bor\\b') | ForEach-Object { ($_ -replace '"','').Trim() } | Where-Object { $_ -ne '' }
      foreach($p in $parts){ 
        if(-not ($indexMeta[$kw].state -contains $p)){ 
          $indexMeta[$kw].state += $p 
        } 
      }
    }
    continue
  }
  if($secLower -eq 'category'){
    if(-not [string]::IsNullOrWhiteSpace($desc) -and [string]::IsNullOrWhiteSpace($indexMeta[$kw].Category)){
      $indexMeta[$kw].Category = $desc.Trim()
    }
    continue
  }
  if($secLower -eq 'scientific_name' -or $secLower -eq 'scientificname'){
    if(-not [string]::IsNullOrWhiteSpace($desc) -and [string]::IsNullOrWhiteSpace($indexMeta[$kw].Scientific_name)){
      $indexMeta[$kw].Scientific_name = $desc.Trim()
    }
    # Don't continue - also add as a content section for display
  }
  if($secLower -eq 'other_name' -or $secLower -eq 'othername'){
    if(-not [string]::IsNullOrWhiteSpace($desc) -and [string]::IsNullOrWhiteSpace($indexMeta[$kw].Other_name)){
      $indexMeta[$kw].Other_name = $desc.Trim()
    }
    # Don't continue - also add as a content section for display
  }

  # For content sections, add to grouped data
  if(-not $grouped.ContainsKey($kw)){
    $grouped[$kw] = @{}
  }
  $sections = $grouped[$kw]

  if(-not $sections.ContainsKey($sec)){
    $sections[$sec] = @()
  }
  $sections[$sec] += $desc
}

# Compose output structure
$outObj = @{}
foreach($kw in $grouped.Keys){
  $secArr = @()
  $sections = $grouped[$kw]
  foreach($secName in $sections.Keys){
    $descParts = $sections[$secName] | Where-Object { $_ -ne $null }
    $descText = ($descParts -join "\n\n").Trim()
    $secArr += @{ name = $secName; description = $descText }
  }
  $outObj[$kw] = @{ sections = $secArr }
}

# Also add keywords that only have metadata (no content sections)
foreach($kw in $indexMeta.Keys){
  if(-not $outObj.ContainsKey($kw)){
    # Add empty sections array for keywords with only metadata
    $outObj[$kw] = @{ sections = @() }
  }
}

# Build index object from collected metadata
$indexObj = @{}
foreach($kw in $outObj.Keys){
  $meta = $indexMeta[$kw]
  $classVal = ''
  if($meta -and $meta.Class){ $classVal = $meta.Class.Trim() }
  $stateVal = @()
  if($meta -and $meta.state){ $stateVal = $meta.state }
  $catVal = ''
  if($meta -and $meta.Category){ $catVal = $meta.Category.Trim() }
  $sciVal = ''
  if($meta -and $meta.Scientific_name){ $sciVal = $meta.Scientific_name.Trim() }
  $otherVal = ''
  if($meta -and $meta.Other_name){ $otherVal = $meta.Other_name.Trim() }
  
  $indexObj[$kw] = @{ 
    class = $classVal; 
    state = $stateVal; 
    Category = $catVal; 
    Scientific_name = $sciVal; 
    Other_name = $otherVal 
  }
}

# Build a filename->keyword map to help client-side matching (e.g. bed_bug -> "bed_bug")
$filenameMap = @{ }
foreach($kw in $outObj.Keys){
  $nk = $kw
  if ($nk -eq $null) { $nk = '' } else { $nk = [string]$nk }
  $nk = $nk.Trim()
  if($nk -eq ''){ continue }
  
  # Standardized normalization: 1) Remove parentheses, commas, and apostrophes, 2) Replace spaces/hyphens with underscores, 3) Lowercase
  $normalized = $nk -replace "[(),']",""
  $normalized = $normalized -replace '[ \-]+','_'
  $normalized = $normalized.ToLower()
  
  if(-not $filenameMap.ContainsKey($normalized)){
    $filenameMap[$normalized] = $kw
  }
}

# Ensure destination dir exists
$odir = Split-Path -Parent $out
if(-not (Test-Path $odir)){ New-Item -ItemType Directory -Path $odir | Out-Null }



# Validation: each item must have a class
$errors = @()
foreach($k in $indexObj.Keys){
  $entry = $indexObj[$k]
  if([string]::IsNullOrWhiteSpace($entry.class)){
    $errors += "Missing Class for keyword: '$k'"
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
