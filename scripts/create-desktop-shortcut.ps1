# Puts a "Transcriver" icon on the desktop that runs start-transcriver.ps1 (run this once)
$root = Split-Path -Parent $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Transcriver.lnk'))
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\start-transcriver.ps1`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$root\public\favicon.ico"
$shortcut.Description = 'Transcriver: start the local server and open the app'
$shortcut.Save()
"Created: $($shortcut.FullName)"
