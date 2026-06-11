<?php

declare(strict_types=1);

/**
 * Página HTML para abrir o link do e-mail e definir nova senha (navegador).
 * URL base em EBD_PASSWORD_RESET_LINK_BASE (ex.: https://seudominio.com/api/auth/reset-form.php).
 */

require_once dirname(__DIR__, 2) . '/db_connection.php';

foreach ([__DIR__ . '/../lib/ebd_password_recovery.php', dirname(__DIR__, 2) . '/lib/ebd_password_recovery.php'] as $libPath) {
    if (is_readable($libPath)) {
        require_once $libPath;
        break;
    }
}

if (!function_exists('ebd_complete_password_reset')) {
    http_response_code(503);
    ebd_reset_simple_message('Servidor indisponível', 'Módulo em falta. Contacte o administrador.');
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const EBD_RESET_PRIMARY = '#0078D4';
const EBD_RESET_PRIMARY_DARK = '#005A9E';
const EBD_RESET_PAGE_BG = '#E8ECF1';
const EBD_RESET_CARD_BG = '#FFFFFF';
const EBD_RESET_TEXT = '#1F2937';
const EBD_RESET_MUTED = '#6B7280';
const EBD_RESET_BORDER = '#E5E7EB';

function ebd_reset_app_login_url(): string
{
    $url = trim(ebd_env_string('EBD_APP_LOGIN_DEEP_LINK', 'mobile://login'));

    return $url !== '' ? $url : 'mobile://login';
}

function ebd_reset_styles(): string
{
    return <<<'CSS'
*,*::before,*::after{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{
  margin:0;
  min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:EBD_RESET_PAGE_BG_PLACEHOLDER;
  color:EBD_RESET_TEXT_PLACEHOLDER;
  line-height:1.5;
}
.page{
  min-height:100vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding:32px 20px 40px;
}
.brand{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  margin-bottom:28px;
}
.brand-icon{width:40px;height:40px;flex-shrink:0;}
.brand-name{
  font-size:22px;
  font-weight:800;
  letter-spacing:0.04em;
  color:EBD_RESET_PRIMARY_PLACEHOLDER;
}
.card{
  width:100%;
  max-width:440px;
  background:EBD_RESET_CARD_BG_PLACEHOLDER;
  border:1px solid EBD_RESET_BORDER_PLACEHOLDER;
  border-radius:20px;
  padding:32px 28px 28px;
  box-shadow:0 4px 24px rgba(0,0,0,0.06);
}
.card-title{
  margin:0 0 8px;
  font-size:20px;
  font-weight:700;
  text-align:center;
  color:EBD_RESET_TEXT_PLACEHOLDER;
}
.greeting{
  margin:0 0 16px;
  font-size:16px;
  text-align:center;
  color:EBD_RESET_TEXT_PLACEHOLDER;
}
.greeting strong{color:EBD_RESET_PRIMARY_PLACEHOLDER;font-weight:700;}
.lead{
  margin:0 0 24px;
  font-size:15px;
  text-align:center;
  color:EBD_RESET_MUTED_PLACEHOLDER;
  line-height:1.55;
}
.alert{
  margin:0 0 18px;
  padding:12px 14px;
  border-radius:12px;
  font-size:14px;
  text-align:center;
  background:#FEF2F2;
  color:#B91C1C;
  border:1px solid #FECACA;
}
.field{margin-bottom:16px;}
.field label{
  display:block;
  font-size:13px;
  font-weight:600;
  color:EBD_RESET_MUTED_PLACEHOLDER;
  margin-bottom:6px;
  padding-left:4px;
}
.field input{
  width:100%;
  padding:14px 16px;
  font-size:16px;
  border:1px solid EBD_RESET_BORDER_PLACEHOLDER;
  border-radius:14px;
  background:#FAFAFA;
  color:EBD_RESET_TEXT_PLACEHOLDER;
  outline:none;
  transition:border-color .15s,box-shadow .15s;
}
.field input:focus{
  border-color:EBD_RESET_PRIMARY_PLACEHOLDER;
  box-shadow:0 0 0 3px rgba(0,120,212,0.15);
  background:#fff;
}
.btn{
  display:block;
  width:100%;
  margin-top:8px;
  padding:15px 20px;
  font-size:15px;
  font-weight:800;
  letter-spacing:0.06em;
  text-transform:uppercase;
  color:#fff;
  background:EBD_RESET_PRIMARY_PLACEHOLDER;
  border:none;
  border-radius:999px;
  cursor:pointer;
  text-decoration:none;
  text-align:center;
  transition:background .15s,transform .1s;
}
.btn:hover{background:EBD_RESET_PRIMARY_DARK_PLACEHOLDER;}
.btn:active{transform:scale(0.98);}
.note{
  margin:20px 0 0;
  font-size:13px;
  text-align:center;
  color:EBD_RESET_MUTED_PLACEHOLDER;
  line-height:1.5;
}
.success-icon{
  width:64px;height:64px;
  margin:0 auto 20px;
  border-radius:50%;
  background:rgba(0,120,212,0.12);
  display:flex;
  align-items:center;
  justify-content:center;
}
.footer{
  margin-top:auto;
  padding-top:32px;
  font-size:12px;
  color:#9CA3AF;
  text-align:center;
}
.footer a{color:EBD_RESET_MUTED_PLACEHOLDER;text-decoration:none;}
CSS;
}

function ebd_reset_styles_resolved(): string
{
    return str_replace(
        [
            'EBD_RESET_PAGE_BG_PLACEHOLDER',
            'EBD_RESET_CARD_BG_PLACEHOLDER',
            'EBD_RESET_TEXT_PLACEHOLDER',
            'EBD_RESET_MUTED_PLACEHOLDER',
            'EBD_RESET_BORDER_PLACEHOLDER',
            'EBD_RESET_PRIMARY_PLACEHOLDER',
            'EBD_RESET_PRIMARY_DARK_PLACEHOLDER',
        ],
        [
            EBD_RESET_PAGE_BG,
            EBD_RESET_CARD_BG,
            EBD_RESET_TEXT,
            EBD_RESET_MUTED,
            EBD_RESET_BORDER,
            EBD_RESET_PRIMARY,
            EBD_RESET_PRIMARY_DARK,
        ],
        ebd_reset_styles(),
    );
}

function ebd_reset_brand_html(): string
{
    $primary = htmlspecialchars(EBD_RESET_PRIMARY, ENT_QUOTES, 'UTF-8');

    return <<<HTML
<div class="brand">
  <svg class="brand-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 10C8 8.9 8.9 8 10 8H22C23.1 8 24 8.9 24 10V38C24 39.1 23.1 40 22 40H10C8.9 40 8 39.1 8 38V10Z" fill="{$primary}" fill-opacity="0.15"/>
    <path d="M10 8H22C23.1 8 24 8.9 24 10V38H10C8.9 38 8 37.1 8 36V10C8 8.9 8.9 8 10 8Z" stroke="{$primary}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 12H34C35.1 12 36 12.9 36 14V34C36 35.1 35.1 36 34 36H24V12Z" fill="{$primary}" fill-opacity="0.35"/>
    <path d="M24 12H34C35.1 12 36 12.9 36 14V34C36 35.1 35.1 36 34 36H24V12Z" stroke="{$primary}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M13 16H19M13 22H19M13 28H17" stroke="{$primary}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
  <span class="brand-name">EBD PRIME</span>
</div>
HTML;
}

function ebd_reset_page_shell(string $title, string $cardInner, bool $showFooter = true): void
{
    $brand = ebd_reset_brand_html();
    $styles = ebd_reset_styles_resolved();
    $titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $footer = $showFooter
        ? '<footer class="footer">EBD Prime · Recuperação de acesso segura</footer>'
        : '';

    echo <<<HTML
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0078D4">
<title>{$titleEsc}</title>
<style>{$styles}</style>
</head>
<body>
<div class="page">
  {$brand}
  <div class="card">
    {$cardInner}
  </div>
  {$footer}
</div>
</body>
</html>
HTML;
}

function ebd_reset_simple_message(string $title, string $message): void
{
    $titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $msgEsc = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    ebd_reset_page_shell(
        $title . ' — EBD Prime',
        <<<HTML
<p class="card-title">{$titleEsc}</p>
<p class="lead">{$msgEsc}</p>
HTML,
    );
}

function ebd_reset_success_render(): void
{
    $appUrl = htmlspecialchars(ebd_reset_app_login_url(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $primary = htmlspecialchars(EBD_RESET_PRIMARY, ENT_QUOTES, 'UTF-8');

    ebd_reset_page_shell(
        'Senha atualizada',
        <<<HTML
<div class="success-icon">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 6L9 17L4 12" stroke="{$primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>
<p class="card-title">Senha actualizada</p>
<p class="lead">A sua nova senha já está activa. Volte ao aplicativo EBD Prime e inicie sessão.</p>
<a class="btn" href="{$appUrl}">Abrir o aplicativo</a>
<p class="note">Se o botão não abrir o app, feche esta página e abra o EBD Prime manualmente.</p>
<script>setTimeout(function(){ window.location.href = "{$appUrl}"; }, 3000);</script>
HTML,
    );
}

/**
 * @param ?string $error Mensagem em texto simples (será escapada).
 */
function ebd_reset_form_render(string $token, ?string $error, string $nomeUsuario = ''): void
{
    $t = htmlspecialchars($token, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $errBlock = $error !== null
        ? '<div class="alert" role="alert">' . htmlspecialchars($error, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</div>'
        : '';

    $nome = trim($nomeUsuario);
    if ($nome !== '') {
        $nomeEsc = htmlspecialchars($nome, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $greeting = '<p class="greeting">Olá, <strong>' . $nomeEsc . '</strong></p>';
    } else {
        $greeting = '';
    }

    ebd_reset_page_shell(
        'Nova senha',
        <<<HTML
{$greeting}
<p class="lead">Para recuperar o seu acesso ao aplicativo <strong style="color:#0078D4;">EBD Prime</strong>, crie uma nova senha para a sua conta abaixo.</p>
{$errBlock}
<form method="post" action="">
  <input type="hidden" name="token" value="{$t}" />
  <div class="field">
    <label for="ns">Nova senha</label>
    <input id="ns" type="password" name="nova_senha" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres" />
  </div>
  <div class="field">
    <label for="ns2">Confirmar senha</label>
    <input id="ns2" type="password" name="nova_senha_confirm" required minlength="6" autocomplete="new-password" placeholder="Repita a nova senha" />
  </div>
  <button type="submit" class="btn">Redefinir senha</button>
</form>
<p class="note">Caso esta alteração não tenha sido solicitada por si, ignore esta página.</p>
HTML,
    );
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$token = '';
if ($method === 'POST') {
    $token = trim((string) ($_POST['token'] ?? ''));
} else {
    $token = trim((string) ($_GET['token'] ?? ''));
}

if ($method === 'POST') {
    $nova = (string) ($_POST['nova_senha'] ?? '');
    $nova2 = (string) ($_POST['nova_senha_confirm'] ?? '');
    if ($nova !== $nova2) {
        ebd_reset_form_render($token, 'As senhas não coincidem.');
        exit;
    }

    try {
        $pdo = ebd_get_pdo();
    } catch (Throwable $e) {
        http_response_code(503);
        ebd_reset_simple_message('Servidor indisponível', 'Tente novamente dentro de alguns minutos.');
        exit;
    }

    $err = ebd_complete_password_reset($pdo, $token, $nova);
    if ($err !== null) {
        ebd_reset_form_render($token, $err);
        exit;
    }

    ebd_reset_success_render();
    exit;
}

if ($token === '') {
    http_response_code(400);
    ebd_reset_simple_message('Link inválido', 'Este endereço não contém um token válido. Solicite nova recuperação no aplicativo.');
    exit;
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    http_response_code(503);
    ebd_reset_simple_message('Servidor indisponível', 'Tente novamente dentro de alguns minutos.');
    exit;
}

$h = hash('sha256', $token);
$chk = $pdo->prepare(
    <<<'SQL'
SELECT r.id, r.expires_at, r.used_at, u.nome_real
FROM recuperacao_senhas r
INNER JOIN usuarios u ON u.id = r.usuario_id AND u.deleted_at IS NULL
WHERE r.token_hash = :h
LIMIT 1
SQL
);
$chk->execute(['h' => $h]);
$r = $chk->fetch(PDO::FETCH_ASSOC);

if (
    $r === false
    || !empty($r['used_at'])
    || strtotime((string) $r['expires_at']) < time()
) {
    http_response_code(400);
    ebd_reset_simple_message(
        'Link expirado',
        'Este link é inválido ou já expirou. Abra o aplicativo EBD Prime e solicite nova recuperação de senha.',
    );
    exit;
}

$nome = trim((string) ($r['nome_real'] ?? ''));
ebd_reset_form_render($token, null, $nome);
