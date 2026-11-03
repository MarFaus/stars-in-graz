# Module C: Concerts API

This Laravel application provides the API used by Module D. For Windows setup and
running all three modules together, see the [project README](../README.md).

Requirements: PHP 8.3 or newer with `pdo_sqlite` and `sqlite3`, the `vendor` dependencies,
and `database/database.sqlite`.

From the project root, start the shared server with:

```powershell
php -S localhost:8000 router.php
```

The API is available at `http://localhost:8000/module-c/api/v1/concerts`. If the
`vendor` directory is missing, install Composer and run `composer install` from this
directory.
