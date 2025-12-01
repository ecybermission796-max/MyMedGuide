# manage-images.ps1
# Recursively process images, create thumbnails, and build registry
param(
    [string]$RootDir = "images",
    [string]$IndexJson = "data/biterdata_index.json",
    [string]$RegistryOut = "images/image_registry.txt"
)

# Helper: get image files (optionally non-recursive)
function Get-ImageFiles($base, $recurse=$false) {
    if (-not (Test-Path $base)) { return @() }
    if ($recurse) { Get-ChildItem -Path $base -Recurse -File } else { Get-ChildItem -Path $base -File }
}

# Helper: ensure unique base names in a folder (rename duplicates)
function Ensure-UniqueNames($files) {
    if (-not $files) { return }
    $byBase = @{}
    foreach ($img in $files) {
        $san = ($img.BaseName -replace '[ ()]', '').ToLower()
        if (-not $byBase.ContainsKey($san)) { $byBase[$san] = @() }
        $byBase[$san] += $img
    }
    foreach ($pair in $byBase.GetEnumerator()) {
        $base = $pair.Key
        $list = $pair.Value | Sort-Object Name
        if ($list.Count -gt 1) {
            $i = 0
            foreach ($img in $list) {
                $ext = $img.Extension
                if ($i -eq 0) {
                    $desired = "$base$ext"
                    $newPath = Join-Path $img.DirectoryName $desired
                    if ($img.Name -ne $desired -and -not (Test-Path $newPath)) { Rename-Item -Path $img.FullName -NewName $desired }
                } else {
                    $suffix = "_$i"
                    $newBase = "$base$suffix"
                    $newName = "$newBase$ext"
                    $newPath = Join-Path $img.DirectoryName $newName
                    while (Test-Path $newPath) { $i++; $suffix = "_$i"; $newBase = "$base$suffix"; $newName = "$newBase$ext"; $newPath = Join-Path $img.DirectoryName $newName }
                    Rename-Item -Path $img.FullName -NewName $newName
                }
                $i++
            }
        } else {
            $img = $list[0]
            $ext = $img.Extension
            $desired = ($img.BaseName -replace '[ ()]', '') + $ext
            if ($img.Name -ne $desired -and -not (Test-Path (Join-Path $img.DirectoryName $desired))) { Rename-Item -Path $img.FullName -NewName $desired }
        }
    }
}

# Helper: compress image if >2MB (uses System.Drawing for common formats)
function Compress-Image($path) {
    try {
        $size = (Get-Item $path).Length
        if ($size -gt 2MB) {
            Add-Type -AssemblyName System.Drawing
            $img = [System.Drawing.Image]::FromFile($path)
            $scale = [Math]::Sqrt(2MB / $size)
            $w = [int]([Math]::Max(1, [Math]::Round($img.Width * $scale)))
            $h = [int]([Math]::Max(1, [Math]::Round($img.Height * $scale)))
            $bmp = New-Object System.Drawing.Bitmap $w, $h
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($img, 0, 0, $w, $h)
            $img.Dispose(); $g.Dispose()
            $enc = [System.Drawing.Imaging.ImageFormat]::Jpeg
            $bmp.Save($path, $enc)
            $bmp.Dispose()
        }
    } catch {
        Write-Warning ("Compress failed for {0}: {1}" -f $path, $_.Exception.Message)
    }
}

# Helper: create thumbnail (max 1.8in x 1.8in @ 96dpi) - preserves aspect ratio
function Create-Thumbnail($src, $dest) {
    try {
        $ext = [IO.Path]::GetExtension($src).ToLower()
        $dpi = 96
        $maxPx = [int](1.8 * $dpi)
        # For webp, prefer ImageMagick if available
        if ($ext -eq '.webp') {
            $magick = Get-Command magick -ErrorAction SilentlyContinue
            if ($magick) {
                & magick "$src" -resize "${maxPx}x${maxPx}" "$dest" 2>$null
                if (Test-Path $dest) { return }
            } else {
                Write-Warning ("ImageMagick 'magick' not found; skipping webp thumbnail for {0}" -f $src)
                return
            }
        }

        Add-Type -AssemblyName System.Drawing
        $img = [System.Drawing.Image]::FromFile($src)
        $scale = [Math]::Min([Math]::Min($maxPx / $img.Width, $maxPx / $img.Height), 1)
        $w = [int]([Math]::Max(1, [Math]::Round($img.Width * $scale)))
        $h = [int]([Math]::Max(1, [Math]::Round($img.Height * $scale)))
        $thumb = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($thumb)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $w, $h)
        $img.Dispose(); $g.Dispose()
        $thumb.Save($dest)
        $thumb.Dispose()
    } catch {
        Write-Warning ("Thumbnail creation failed for {0}: {1}" -f $src, $_.Exception.Message)
    }
}

# Load index JSON and build a lookup by normalized key
if (-not (Test-Path $IndexJson)) { Write-Warning "Index JSON not found: $IndexJson"; $indexObj = @{} } else {
    $raw = Get-Content $IndexJson -ErrorAction Stop | Out-String
    $parsed = $null
    try { $parsed = $raw | ConvertFrom-Json } catch { Write-Warning ("Failed to parse {0}: {1}" -f $IndexJson, $_.Exception.Message); $parsed = @{} }
    $indexObj = @{}
    foreach ($p in $parsed.PSObject.Properties) { $indexObj[$p.Name.ToLower().Trim()] = $p.Value }
}

# Prepare registry
$registry = @()

# Process each class dir
foreach ($class in @('animals','bugs','plants')) {
    $classDir = Join-Path $RootDir $class
    if (-not (Test-Path $classDir)) { continue }
    $subdirs = Get-ChildItem $classDir -Directory
    foreach ($sub in $subdirs) {
        $imgDir = $sub.FullName
        $thumbDir = Join-Path $imgDir 'thumbnails'
        if (!(Test-Path $thumbDir)) { New-Item -ItemType Directory -Path $thumbDir | Out-Null }

        # only images directly within this folder (no recursion)
        $images = Get-ImageFiles $imgDir $false | Where-Object { $_.Directory.Name -ne 'thumbnails' }
        if (-not $images) { $registry += [PSCustomObject]@{ keyword = $sub.Name; Image_ct = 0; Thumbnail_ct = 0; Class=''; OtherKeywords=''}; continue }

        # sanitize and ensure unique names
        Ensure-UniqueNames $images
        # refresh list after renames
        $images = Get-ImageFiles $imgDir $false | Where-Object { $_.Directory.Name -ne 'thumbnails' }
        $imgCt = $images.Count

        # compress large images first (best-effort)
        foreach ($img in $images) { Compress-Image $img.FullName }

        $thumbs = @()
        if (Test-Path $thumbDir) { $thumbs = Get-ChildItem $thumbDir -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png)$' } }
        $thumbCt = $thumbs.Count

        if ($thumbCt -ne $imgCt) {
            Write-Host "Thumbnail count ($thumbCt) does not match image count ($imgCt) in $imgDir. Recreating thumbnails."
            # remove existing thumbnails
            foreach ($t in $thumbs) { try { Remove-Item $t.FullName -Force } catch { Write-Warning "Could not remove $($t.FullName): $($_.Exception.Message)" } }
            foreach ($img in $images) {
                # only process jpg/jpeg/png images
                if ($img.Extension -match '\.(jpg|jpeg|png)$') {
                    $thumbPath = Join-Path $thumbDir $img.Name
                    Create-Thumbnail $img.FullName $thumbPath
                } else {
                    Write-Warning ("Skipping unsupported image format for thumbnail: {0}" -f $img.FullName)
                }
            }
            $thumbs = Get-ChildItem $thumbDir -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp)$' }
            $thumbCt = $thumbs.Count
        }

        # build registry entry using normalized subdir name as keyword
        $keyword = ($sub.Name -replace '_',' ' -replace '-',' ').Trim().ToLower()
        $meta = @{Class=''; OtherKeywords=''}
        if ($indexObj.ContainsKey($keyword)) {
            $m = $indexObj[$keyword]
            $meta.Class = $m.class
            if ($m.PSObject.Properties.Name -contains 'OtherKeywords') { $meta.OtherKeywords = ($m.OtherKeywords -join ', ') }
        }
        $registry += [PSCustomObject]@{
            keyword = $keyword
            Image_ct = $imgCt
            Thumbnail_ct = $thumbCt
            Class = $meta.Class
            OtherKeywords = $meta.OtherKeywords
        }
    }
}

# Write registry as tab-delimited to a temp file then move to final path
$tmp = "$RegistryOut.tmp"
try {
    $registry | Export-Csv -Path $tmp -Delimiter "`t" -NoTypeInformation -Force
    try { Move-Item -Path $tmp -Destination $RegistryOut -Force -ErrorAction Stop } catch {
        Write-Warning ("Could not overwrite {0}: {1}. The temp registry is at {2}" -f $RegistryOut, $_.Exception.Message, $tmp)
    }
    Write-Host "Image registry written to $RegistryOut"
} catch {
    Write-Warning "Failed to write registry: $($_.Exception.Message)"
}
