@echo off
rem Starts all three modules. Double-click this file.
setlocal
cd /d "%~dp0"

set "PHP="
where.exe php >nul 2>nul
if not errorlevel 1 set "PHP=php"
if not defined PHP if exist "C:\php\php.exe" set "PHP=C:\php\php.exe"
if not defined PHP if exist "C:\php83\php.exe" set "PHP=C:\php83\php.exe"
if not defined PHP goto :php_missing

"%PHP%" -r "if (PHP_VERSION_ID < 80300) {fwrite(STDERR, 'PHP 8.3 or newer is required; found '.PHP_VERSION.PHP_EOL); exit(1);} $required = ['ctype', 'fileinfo', 'filter', 'hash', 'mbstring', 'openssl', 'pdo', 'pdo_sqlite', 'session', 'sqlite3', 'tokenizer']; $missing = array_filter($required, fn ($extension) => !extension_loaded($extension)); if ($missing) {fwrite(STDERR, 'Enable PHP extensions: '.implode(', ', $missing).PHP_EOL); exit(1);} echo 'Using PHP '.PHP_VERSION.PHP_EOL;"
if errorlevel 1 goto :startup_failed
if not exist "module-c\vendor\autoload.php" (
  echo Laravel dependencies are missing: module-c\vendor\autoload.php
  echo Restore the included vendor folder or run composer install in module-c.
  goto :startup_failed
)
if not exist "module-c\database\database.sqlite" (
  echo SQLite database is missing: module-c\database\database.sqlite
  goto :startup_failed
)
if not exist "module-c\.env" (
  if not exist "module-c\.env.example" (
    echo Laravel configuration template is missing: module-c\.env.example
    goto :startup_failed
  )
  copy /y "module-c\.env.example" "module-c\.env" >nul
  if errorlevel 1 (
    echo Could not create module-c\.env from module-c\.env.example.
    goto :startup_failed
  )
)
findstr /r /c:"^APP_KEY=." "module-c\.env" >nul
if errorlevel 1 (
  echo Generating Laravel application key...
  pushd "module-c"
  "%PHP%" artisan key:generate --force
  if errorlevel 1 (
    popd
    goto :startup_failed
  )
  popd
)

echo.
echo  Site:      http://localhost:8000/module-b/
echo  Booking:   http://localhost:8000/module-d/
echo  API:       http://localhost:8000/module-c/api/v1/concerts
echo.
echo  Close this window (or press Ctrl+C) to stop the server.
echo.
start "" "http://localhost:8000/module-b/"
"%PHP%" -S localhost:8000 router.php
pause
exit /b

:php_missing
echo PHP 8.3 or newer was not found.
echo Install PHP, add its folder to the Windows PATH, then reopen this window.
echo See README.md for setup instructions.
goto :startup_failed

:startup_failed
echo.
pause
exit /b 1
