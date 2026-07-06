param([string]$intpid)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$logPath = "C:\Users\micha\Desktop\bot\log.log"
$botDir = "C:\Users\micha\Desktop\bot\"
$bun = "bun.exe"

"--- Startup invoked at $(Get-Date) ---" | Out-File $logPath -Append 

$interactionsArgs = @{
    FilePath  = $bun
    ArgumentList = @("run", "./dist/interactions.js")
    WorkingDirectory = $botDir
    WindowStyle  = "Hidden"
}
$gatewayArgs = @{
    FilePath   = $bun
    ArgumentList  = @("run", "./dist/root.js")
    WorkingDirectory = $botDir
    WindowStyle  = "Hidden"
}
# $twitchArgs = @{
#     FilePath = $bun
#     ArugmentList = @("run", "./twitch.js")
#     WorkingDIrectory = $botDir
#     WindowStyle = "hidden"
# }
if($intpid){
     $gatewayProc = Start-Process @gatewayArgs -PassThru
     "Started gateway PID $($gatewayProc.Id)" | Out-File $logPath -Append 
     Write-Output $gatewayProc
} else {
     $gatewayProc = Start-Process @gatewayArgs -PassThru
     "Started gateway PID $($gatewayProc.Id)" | Out-File $logPath -Append 
     $interactionsProc = Start-Process @interactionsArgs -PassThru
     "Started interactions PID $($interactionsProc.Id)" | Out-File $logPath -Append 
     Write-Output $interactionsProc $gatewayProc
}


