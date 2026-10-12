param([string]$BotPid, [string]$intpid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$logPath = Join-Path $PSScriptRoot 'log.log'
"Restart script started at $(Get-Date)" | Out-File $logPath -Append

if ($BotPid -and ($process = Get-Process -Id $BotPid -ErrorAction SilentlyContinue)) {
    "Killing PID $BotPid" | Out-File $logPath -Append
    Stop-Process -InputObject $process -Force
    Wait-Process -InputObject $process -Timeout 10 -ErrorAction SilentlyContinue
} else {
    "PID $BotPid not running, skipping" | Out-File $logPath -Append
}
$botArgs = @{
    FilePath         = 'powershell.exe'
    ArgumentList     = @('-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start.ps1'), '-intpid', $intpid)
    WorkingDirectory = $PSScriptRoot
    WindowStyle      = 'Hidden'
}
Start-Process @botArgs -PassThru