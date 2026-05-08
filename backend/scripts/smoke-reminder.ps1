param(
  [string]$MailUsername = "",
  [string]$MailAppPassword = "",
  [string]$MailFrom = "",
  [switch]$RunDatabase,
  [string]$BackendPort = "8081",
  [switch]$RunFrontend,
  [string]$FrontendPort = "5173",
  [string]$FrontendHost = "127.0.0.1",
  [int]$HealthTimeoutSec = 180,
  [int]$HealthPollSec = 5,
  [switch]$RunReminderNow,
  [string]$ValidatorEmail = "validator.rossi@supplierplatform.com",
  [string]$ValidatorPassword = "Test@12345"
)

$ErrorActionPreference = "Stop"

function Stop-BackendOnPort {
  param([string]$Port)

  $lines = netstat -ano | Select-String ":$Port"
  if (-not $lines) {
    Write-Host "No process is listening on port $Port"
    return
  }

  $pids = $lines |
    ForEach-Object { ($_ -split "\s+")[-1] } |
    Where-Object { $_ -match "^\d+$" } |
    Sort-Object -Unique

  foreach ($procId in $pids) {
    try {
      Stop-Process -Id ([int]$procId) -Force
      Write-Host "Stopped process PID $procId on port $Port"
    } catch {
      Write-Host "Could not stop PID ${procId}: $($_.Exception.Message)"
    }
  }
}

function Get-MavenCommand {
  $mvnInPath = Get-Command mvn -ErrorAction SilentlyContinue
  if ($mvnInPath) {
    return "mvn"
  }

  $localMvn = Join-Path $PSScriptRoot "..\..\tools\apache-maven-3.9.9\bin\mvn.cmd"
  $resolved = Resolve-Path $localMvn -ErrorAction SilentlyContinue
  if ($resolved) {
    return $resolved.Path
  }

  throw "Maven not found. Install Maven or keep tools/apache-maven-3.9.9 in project root."
}

function Get-NpmCommand {
  $npmInPath = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmInPath) {
    return "npm.cmd"
  }
  throw "npm not found in PATH. Install Node.js/npm to start frontend."
}

function Get-DockerCommand {
  $dockerInPath = Get-Command docker -ErrorAction SilentlyContinue
  if ($dockerInPath) {
    return "docker"
  }
  throw "docker not found in PATH. Install Docker Desktop to start database containers."
}

if ([string]::IsNullOrWhiteSpace($MailUsername) -or [string]::IsNullOrWhiteSpace($MailAppPassword)) {
  throw "Set -MailUsername and -MailAppPassword before running."
}

if ([string]::IsNullOrWhiteSpace($MailFrom)) {
  $MailFrom = $MailUsername
}

$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectRoot = Resolve-Path (Join-Path $backendDir "..")
$logPath = Join-Path $backendDir ".be.log"
$errLogPath = Join-Path $backendDir ".be.err.log"
$mvnCmd = Get-MavenCommand
$frontendDir = Resolve-Path (Join-Path $backendDir "..\frontend")
$frontendLogPath = Join-Path $frontendDir ".fe.log"
$frontendErrLogPath = Join-Path $frontendDir ".fe.err.log"
$npmCmd = $null
if ($RunFrontend) {
  $npmCmd = Get-NpmCommand
}
$dockerCmd = $null
if ($RunDatabase) {
  $dockerCmd = Get-DockerCommand
}

if ($RunDatabase) {
  Write-Host "Starting database containers (postgres + pgadmin)..."
  & $dockerCmd compose up -d postgres pgadmin | Out-Host
}

Stop-BackendOnPort -Port $BackendPort
if ($RunFrontend) {
  Stop-BackendOnPort -Port $FrontendPort
}

Remove-Item $logPath -ErrorAction SilentlyContinue
Remove-Item $errLogPath -ErrorAction SilentlyContinue
if ($RunFrontend) {
  Remove-Item $frontendLogPath -ErrorAction SilentlyContinue
  Remove-Item $frontendErrLogPath -ErrorAction SilentlyContinue
}

$env:MAIL_HOST = "smtp.gmail.com"
$env:MAIL_PORT = "587"
$env:MAIL_USERNAME = $MailUsername
$env:MAIL_PASSWORD = ($MailAppPassword -replace "\s", "")
$env:REMINDER_MAIL_ENABLED = "true"
$env:REMINDER_MAIL_FROM = $MailFrom

# Force scheduler to check every minute even if file config changes.
$env:SPRING_APPLICATION_JSON = (@{
  app = @{
    reminders = @{
      'document-expiry' = @{
        cron = "0 * * * * *"
        'days-before' = 30
        mail = @{
          enabled = $true
          from = $MailFrom
        }
      }
    }
  }
} | ConvertTo-Json -Compress -Depth 10)

$backendArgs = "-s mvn-settings.xml -Dmaven.test.skip=true spring-boot:run"

Write-Host "Starting backend on port $BackendPort..."
Write-Host "Backend command: $mvnCmd $backendArgs"
$process = Start-Process -FilePath $mvnCmd -ArgumentList $backendArgs -WorkingDirectory $backendDir -RedirectStandardOutput $logPath -RedirectStandardError $errLogPath -PassThru
Start-Sleep -Seconds 2
if ($process.HasExited) {
  Write-Host "Backend process exited immediately (exit code $($process.ExitCode))."
  Write-Host "Last backend logs:"
  if (Test-Path $logPath) { Get-Content $logPath -Tail 40 }
  Write-Host "Last backend error logs:"
  if (Test-Path $errLogPath) { Get-Content $errLogPath -Tail 40 }
  throw "Backend failed to start. Check logs above."
}

Write-Host "Backend started with PID $($process.Id). Logs: $logPath and $errLogPath"
Write-Host "Reminder scheduler is enabled for every minute."

if ($RunFrontend) {
  Write-Host "Starting frontend on http://$FrontendHost`:$FrontendPort ..."
  $frontendArgs = "run dev -- --host $FrontendHost --port $FrontendPort"
  $frontendProcess = Start-Process -FilePath $npmCmd -ArgumentList $frontendArgs -WorkingDirectory $frontendDir -RedirectStandardOutput $frontendLogPath -RedirectStandardError $frontendErrLogPath -PassThru
  Write-Host "Frontend started with PID $($frontendProcess.Id). Logs: $frontendLogPath and $frontendErrLogPath"
}

Start-Sleep -Seconds 8

$isHealthy = $false
$attempts = [Math]::Ceiling($HealthTimeoutSec / [Math]::Max(1, $HealthPollSec))
for ($i = 0; $i -lt $attempts; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/ops/health" -Method Get -TimeoutSec 5
    Write-Host "Health endpoint OK: $($health.message)"
    $isHealthy = $true
    break
  } catch {
    Start-Sleep -Seconds $HealthPollSec
  }
}

if (-not $isHealthy) {
  Write-Host "Backend did not become healthy within $HealthTimeoutSec seconds."
  Write-Host "Last backend logs:"
  if (Test-Path $logPath) { Get-Content $logPath -Tail 40 }
  Write-Host "Last backend error logs:"
  if (Test-Path $errLogPath) { Get-Content $errLogPath -Tail 40 }
}

if ($RunReminderNow -and $isHealthy) {
  try {
    $loginBody = @{ email = $ValidatorEmail; password = $ValidatorPassword } | ConvertTo-Json
    $login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$BackendPort/api/auth/login" -ContentType "application/json" -Body $loginBody
    $token = $login.data.token
    $result = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$BackendPort/api/reminders/run-document-expiry" -Headers @{ Authorization = "Bearer $token" }
    Write-Host "Manual reminder trigger result:"
    $result | ConvertTo-Json -Depth 5
  } catch {
    Write-Host "Manual reminder trigger failed: $($_.Exception.Message)"
  }
} elseif ($RunReminderNow) {
  Write-Host "Manual reminder trigger skipped because backend is not healthy yet."
}
