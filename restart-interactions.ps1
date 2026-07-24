param([string]$IntPid, [string]$BotPid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$logPath = 'C:\Users\micha\Desktop\bot\log.log'
"Interactions restart script started at $(Get-Date)" | Out-File $logPath -Append
$botArgs = @{
    FilePath         = 'powershell.exe'
    ArgumentList     = @('-ExecutionPolicy', 'Bypass', '-File', './start.ps1', '-gatewaypid', $BotPid)
    WorkingDirectory = 'C:\Users\micha\Desktop\Bot'
    WindowStyle      = 'Hidden'
}
Start-Process @botArgs -PassThru
if ($IntPid -and (Get-Process -Id $IntPid -ErrorAction SilentlyContinue)) {
    "Killing interactions PID $IntPid" | Out-File $logPath -Append
    taskkill /F /PID $IntPid | Out-File $logPath -Append
} else {
    "PID $IntPid not running, skipping" | Out-File $logPath -Append
}