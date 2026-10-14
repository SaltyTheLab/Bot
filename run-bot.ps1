param([Parameter(Mandatory = $true)][string]$EntryPoint)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$ErrorActionPreference = 'Continue'
$logPath = Join-Path $PSScriptRoot "$EntryPoint.log"
$bun = 'bun.exe'

Set-Location $PSScriptRoot
& $bun run "./dist/$EntryPoint.js" >> $logPath 2>&1
exit $LASTEXITCODE
