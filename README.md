# EuroSkills: concert Stars in Graz

The project contains three connected modules:

| Module | What it is | URL |
| --- | --- | --- |
| `module-b` | Concert website (HTML/CSS) | http://localhost:8000/module-b/ |
| `module-c` | Laravel 13 REST API | http://localhost:8000/module-c/api/v1/concerts |
| `module-d` | Ticket booking app (HTML/CSS/JS) | http://localhost:8000/module-d/ |

Module B links to ticket booking in D. Module D uses the API in C and links back to B.

## Быстрый запуск на Windows

1. Нужен PHP CLI 8.3 или новее. Скачайте x64 Thread Safe ZIP с
   [windows.php.net/download](https://windows.php.net/download/), распакуйте, например,
   в `C:\php`, добавьте эту папку в `PATH`.
2. В `php.ini` включите расширения `fileinfo`, `mbstring`, `openssl`, `pdo_sqlite` и
   `sqlite3` (уберите `;` перед строками `extension=...`).
3. Запустите `start.bat` двойным кликом. Он проверит PHP, создаст `.env` и ключ
   приложения при необходимости и поднимет сервер.
4. Откройте [http://localhost:8000/module-b/](http://localhost:8000/module-b/).

Composer, Node.js и MySQL не нужны: зависимости Laravel лежат в `module-c/vendor`,
база SQLite — в `module-c/database/database.sqlite`. Подробности ниже.

## Requirements

- PHP CLI 8.3 or newer, available as `php` on `PATH`.
- PHP extensions `ctype`, `fileinfo`, `filter`, `hash`, `mbstring`, `openssl`, `pdo`,
  `pdo_sqlite`, `session`, `sqlite3` and `tokenizer`.

Composer, Node.js, MySQL and a separate web server are not required to run the project:
Laravel dependencies are included in `module-c/vendor` in this project folder, and the
SQLite database is `module-c/database/database.sqlite`. If `module-c/vendor` is missing
(for example, after downloading only source files), install Composer and run
`composer install` from `module-c`.

## First-time setup on Windows

1. Download the x64 Thread Safe ZIP for PHP 8.3 or newer from
   [windows.php.net/download](https://windows.php.net/download/), then extract it to
   `C:\php`.
2. In that folder, copy `php.ini-development` to `php.ini`. In `php.ini`, enable the
   `fileinfo`, `mbstring`, `openssl`, `pdo_sqlite` and `sqlite3` extensions by removing
   the leading `;` from their `extension=...` lines. If `extension_dir` is commented
   out, set it to `extension_dir = "ext"`.
3. Add `C:\php` to the Windows **Path** environment variable, then close and reopen
   VS Code and any terminals.
4. In a new terminal, check `php -v` and `php -m`. The module list must include the
   extensions listed above.

If PHP reports a missing Visual C++ runtime DLL, install the current x64 Microsoft
Visual C++ Redistributable and reopen the terminal.

## Run

Double-click `start.bat`, or in the project root run:

```powershell
php -S localhost:8000 router.php
```

Open http://localhost:8000/module-b/. The booking app and API are available at the URLs
in the table above. Keep the server window open while using the site; press Ctrl+C to
stop it. In VS Code, Ctrl+Shift+B runs the same server task.

`start.bat` checks the PHP version, required extensions, bundled Laravel files and
database before starting. On first run it also creates `module-c/.env` from the example
and generates an application key when needed. If PHP is not found, install it and add
its folder to `PATH` as described above.

## Without PHP

Open `module-b/index.html` or `module-d/index.html` directly in a browser. Module D then
uses its built-in demo API; bookings are stored in that browser only. This mode does not
use the Laravel API or share bookings with it.

## API and data

The API routes are in `module-c/routes/api.php`; shared queries and response formatting
are in `module-c/app/Support/Concerts.php`. The project uses SQLite and does not need a
database server. The database file contains the concert data and booking tables.
