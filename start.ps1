param([string]$intpid, [string]$gatewaypid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
function Start-BotProcess([string]$name, [string]$entryPoint) {
    $logPath = Join-Path $PSScriptRoot "$entryPoint.log"
    $runnerPath = Join-Path $PSScriptRoot 'run-bot.ps1'
    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $runnerPath,
        '-EntryPoint', $entryPoint
    ) `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -PassThru
    "Started $name output supervisor PID $($process.Id)" | Out-File $logPath -Append
    return $process
}

if ($intpid) {
    Start-BotProcess 'gateway' 'root' | Out-Null
}
elseif ($gatewaypid) {
    Start-BotProcess 'interactions' 'interactions' | Out-Null
}
else {
    Start-BotProcess 'gateway' 'root'
    Start-BotProcess 'interactions' 'interactions'
}
