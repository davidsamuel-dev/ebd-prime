<?php

declare(strict_types=1);

/**
 * Gera deploy/hostinger-ebd.adparaiso.com.br/ para upload FTP.
 * Uso: php backend/scripts/prepare-hostinger-deploy.php
 */

$backend = dirname(__DIR__);
$root = dirname($backend);
$out = $root . DIRECTORY_SEPARATOR . 'deploy' . DIRECTORY_SEPARATOR . 'hostinger-ebd.adparaiso.com.br';

$exclude = ['.env', '.env.production', 'scripts', '.git', '.gitignore', 'vendor'];

if (is_dir($out)) {
    rmTree($out);
}
mkdir($out, 0775, true);

$vendorAutoload = $backend . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (!is_readable($vendorAutoload)) {
    fwrite(STDOUT, "A executar composer install...\n");
    passthru('composer install --no-dev --optimize-autoloader', $code);
    if ($code !== 0) {
        exit(1);
    }
}

foreach (scandir($backend) ?: [] as $name) {
    if ($name === '.' || $name === '..') {
        continue;
    }
    if (in_array($name, $exclude, true)) {
        continue;
    }
    $src = $backend . DIRECTORY_SEPARATOR . $name;
    $dst = $out . DIRECTORY_SEPARATOR . $name;
    if (is_dir($src)) {
        copyDir($src, $dst);
    } else {
        copy($src, $dst);
    }
}

copyDir($backend . DIRECTORY_SEPARATOR . 'vendor', $out . DIRECTORY_SEPARATOR . 'vendor');

$envProd = $backend . DIRECTORY_SEPARATOR . '.env.production';
if (!is_readable($envProd)) {
    fwrite(STDERR, "Falta backend/.env.production\n");
    exit(1);
}
copy($envProd, $out . DIRECTORY_SEPARATOR . '.env');

$landing = $root . DIRECTORY_SEPARATOR . 'landing';
if (is_dir($landing)) {
    copyLanding($landing, $out);
    fwrite(STDOUT, "Landing page incluída (index.html + site-assets/ + .htaccess).\n");
}

fwrite(STDOUT, "\nOK — enviar para a raiz de ebd.adparaiso.com.br:\n  $out\n");
fwrite(STDOUT, "Testar: https://ebd.adparaiso.com.br/\n");
fwrite(STDOUT, "API:    https://ebd.adparaiso.com.br/api/health.php\n");

function copyDir(string $src, string $dst): void
{
    if (!is_dir($dst)) {
        mkdir($dst, 0775, true);
    }
    foreach (scandir($src) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $s = $src . DIRECTORY_SEPARATOR . $name;
        $d = $dst . DIRECTORY_SEPARATOR . $name;
        is_dir($s) ? copyDir($s, $d) : copy($s, $d);
    }
}

function rmTree(string $dir): void
{
    foreach (scandir($dir) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        is_dir($path) ? rmTree($path) : unlink($path);
    }
    rmdir($dir);
}

/** Copia landing (index.html, site-assets/, .htaccess) para a raiz do deploy — sem tocar em /api/. */
function copyLanding(string $landing, string $out): void
{
    foreach (['index.html', 'ajuda.html'] as $page) {
        $srcPage = $landing . DIRECTORY_SEPARATOR . $page;
        if (is_readable($srcPage)) {
            copy($srcPage, $out . DIRECTORY_SEPARATOR . $page);
        }
    }


    $htaccess = $landing . DIRECTORY_SEPARATOR . '.htaccess';
    if (is_readable($htaccess)) {
        copy($htaccess, $out . DIRECTORY_SEPARATOR . '.htaccess');
    }

    $assetsSrc = $landing . DIRECTORY_SEPARATOR . 'site-assets';
    $assetsDst = $out . DIRECTORY_SEPARATOR . 'site-assets';
    if (is_dir($assetsSrc)) {
        copyDir($assetsSrc, $assetsDst);
    }

    $mobileImages = dirname($landing) . DIRECTORY_SEPARATOR . 'mobile' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images';
    if (is_dir($mobileImages)) {
        if (!is_dir($assetsDst)) {
            mkdir($assetsDst, 0775, true);
        }
        foreach (['logo_comprida.png', 'logo_fundo_azul.png', 'logo1.png'] as $img) {
            $src = $mobileImages . DIRECTORY_SEPARATOR . $img;
            if (is_readable($src)) {
                copy($src, $assetsDst . DIRECTORY_SEPARATOR . $img);
            }
        }
    }
}
