param([string]$intpid, [string]$gatewaypid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$logPath = Join-Path $PSScriptRoot 'log.log'
$bun = 'bun.exe'

"--- Startup invoked at $(Get-Date) ---" | Out-File $logPath -Append

function Start-BotProcess([string]$name, [string]$entryPoint) {
    $process = Start-Process -FilePath $bun `
        -ArgumentList @('run', "./dist/$entryPoint.js") `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -PassThru
    "Started $name PID $($process.Id)" | Out-File $logPath -Append
    return $process
}

if ($intpid) {
    Start-BotProcess 'gateway' 'root' | Out-Null
} elseif ($gatewaypid) {
    Start-BotProcess 'interactions' 'interactions' | Out-Null
} else {
    $gatewayProc = Start-BotProcess 'gateway' 'root'
    $interactionsProc = Start-BotProcess 'interactions' 'interactions'
    Write-Output $interactionsProc $gatewayProc
}

