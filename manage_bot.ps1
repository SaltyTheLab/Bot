param ( [Parameter(Mandatory = $true, Position = 0)] [ValidateSet("start", "stop", "status", "restart")] $Action)
$PidFile = "bot.pid"
$ScriptName = "bot.ts"
$LogFile = "bot_error.log"
$LogOutFile = "bot_out.log"
function Start-Bot {
    if (Test-Path $PidFile) {
        $oldPid = Get-Content $PidFile
        if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) { Write-Host "Bot is already running (PID: $oldPid)" -ForegroundColor Yellow return }
    } 
    Write-Host "Starting Febot..." -ForegroundColor Cyan
    $process = Start-Process -FilePath "bun" -ArgumentList "run", $ScriptName `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardError $LogFile -RedirectStandardOutput $LogOutFile    
    $process.Id | Out-File -FilePath $PidFile -Encoding ascii   
}
function Stop-Bot {
    if (Test-Path $PidFile) {
        $procId = Get-Content $PidFile
        Write-Host "Stopping Febot (PID: $procId)..." -ForegroundColor Red
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Remove-Item $PidFile
        Write-Host "Bot stopped" -ForegroundColor Green
    }
    else {
        Write-Host "No bot.pid file found. Is the bot running?" -ForegroundColor Yellow
    }
}
switch ($Action) {
    "start" {
        Start-Bot 
        break;
    }
    "stop" { Stop-Bot  break; }
    "restart" {
        Write-Host "Restarting Febot..." -ForegroundColor Magenta
        Stop-Bot
        Start-Sleep -Seconds 1 
        Start-Bot
        break;
    }
    "status" {
        if (Test-Path $LogFile) {
            $lastError = Get-Content $LogFile -Tail 1
            if ($lastError) { Write-Host "Last Log Entry: $lastError" -ForegroundColor Gray }
        }
        if (Test-Path $PidFile) {
            $procId = Get-Content $PidFile
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
           
            if ($proc) {
                Write-Host "Bot is Running (PID: $procId)" -ForegroundColor Green
                Write-Host "Memory Usage: $([math]::Round($proc.WorkingSet64 / 1mb, 2)) MB"
                
            }
            else { Write-Host "Bot is not running (stale PID file)." -ForegroundColor Red }
        }
        else {
            Write-Host "Bot is NOT running." -ForegroundColor Red
        }
        break;
    }
}