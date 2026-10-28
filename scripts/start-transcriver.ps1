# Opens Transcriver from the desktop icon: starts the local server if it is not running yet
# (in a minimized window), waits until it answers, then opens the app in the browser.
$root = Split-Path -Parent $PSScriptRoot
$url = 'http://localhost:3000'

$running = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $running) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "title Transcriver server && cd /d `"$root`" && npm run dev" -WindowStyle Minimized
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      break
    } catch {
      # Not answering yet
    }
  }
}
Start-Process $url
