param([string]$intpid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
function Start-BotProcess([string]$entryPoint) {
    $exePath = Join-Path $PSScriptRoot "$entryPoint.exe"
    if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
        throw "Executable not found: $exePath"
    }
    $process = Start-Process -FilePath $exePath `
        -WorkingDirectory $PSScriptRoot `
        -RedirectStandardOutput (Join-Path $PSScriptRoot "$entryPoint.log") `
        -RedirectStandardError (Join-Path $PSScriptRoot "$entryPoint-error.log") `
        -WindowStyle Hidden `
        -PassThru
    Write-Output "Started $entryPoint.exe PID $($process.Id)"
    return $process
}

if ($intpid) {
    Start-BotProcess 'root' | Out-Null
}
