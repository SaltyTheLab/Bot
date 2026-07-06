param([string]$BotPid, [string]$intpid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$logPath = 'C:\Users\micha\Desktop\bot\log.log'
"Restart script started at $(Get-Date)" | Out-File $logPath -Append 
if ($BotPid -and (Get-Process -Id $BotPid -ErrorAction SilentlyContinue)) {
    "Killing PID $BotPid" | Out-File $logPath -Append
    taskkill /F /PID $BotPid | Out-File $logPath -Append 
} else {
    "PID $BotPid not running, skipping" | Out-File $logPath -Append 
}
$botArgs = @{   
    FilePath         = 'powershell.exe'
    ArgumentList     = @('-ExecutionPolicy', 'Bypass', '-File', './start.ps1', '-intpid', $intpid)
    WorkingDirectory = 'C:\Users\micha\Desktop\Bot'
    WindowStyle      = 'Hidden'
}
Start-Process @botArgs -PassThru