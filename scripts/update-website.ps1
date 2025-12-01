#powershell -NoProfile -Command "Import-Csv '.\.gitignore\rawfiles\Biterdata.csv' | Where-Object Section -match 'class' | Select-Object Keywords,Section,Title,Description | Format-Table -AutoSize"

# PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\convert-biters-txt.ps1 -txt .\.gitignore\rawfiles\Biterdata.txt -out .\data\Biterdata.json
# PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-animals-manifest.ps1
# PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-plants-manifest.ps1
# PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-bugs-manifest.ps1
# powershell.exe -ExecutionPolicy Bypass -File .\scripts\check-manifest-names.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\manage-images.ps1