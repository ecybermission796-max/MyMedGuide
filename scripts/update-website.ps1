PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\convert-biters-csv.ps1 -csv .\data\Biterdata.csv -out .\data\Biterdata.json
#PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\convert-biters-txt.ps1 -txt .\data\Biterdata.txt -out .\data\Biterdata.json
PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-animals-manifest.ps1
PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-plants-manifest.ps1
PowerShell.exe -ExecutionPolicy Bypass -File .\scripts\generate-bugs-manifest.ps1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\check-manifest-names.ps1
