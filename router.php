<?php

/*
 * Router for PHP's built-in server: php -S localhost:8000 router.php
 * Serves module-b and module-d as static files and runs the Laravel app of
 * module-c under /module-c, so the three modules behave as they will on the
 * competition server (http://competitor-N/module-b, /module-c, /module-d).
 */

$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');

if ($uri === '/') {
    header('Location: /module-b/');
    return true;
}

if (preg_match('#^/module-c(/.*)?$#', $uri, $m)) {
    $public = __DIR__ . '/module-c/public';
    $path = $m[1] ?? '/';
    $file = realpath($public . $path);

    if ($file !== false && is_file($file) && str_starts_with($file, $public) && !str_ends_with($file, '.php')) {
        header('Content-Type: ' . (mime_content_type($file) ?: 'application/octet-stream'));
        readfile($file);
        return true;
    }

    $_SERVER['SCRIPT_NAME'] = '/module-c/index.php';
    $_SERVER['PHP_SELF'] = '/module-c/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $public . '/index.php';
    chdir($public);
    require $public . '/index.php';

    return true;
}

return false;
