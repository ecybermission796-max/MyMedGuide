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
foreach($row in $rows){
  $kw = $row.Keywords
  if ($kw -eq $null) { $kw = '' } else { $kw = [string]$kw }
  $kw = $kw.Trim()
  if($kw -eq '') { continue }
  # preserve underscores, collapse multiple spaces
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

  if(-not $grouped.ContainsKey($kw)){
    $grouped[$kw] = @{}
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

# Write JSON with depth large enough for nested arrays
$outJson = $outObj | ConvertTo-Json -Depth 10
$outJson | Out-File -FilePath $out -Encoding UTF8
Write-Host "Wrote $(($outObj.Keys).Count) keywords to $out"

# Write filename map next to output JSON so client can match filenames to keywords
$mapFile = Join-Path (Split-Path -Parent $out) 'BiterFilenameMap.json'
$mapJson = $filenameMap | ConvertTo-Json -Depth 5
$mapJson | Out-File -FilePath $mapFile -Encoding UTF8
Write-Host "Wrote filename map to $mapFile"
