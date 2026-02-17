<?php
declare(strict_types=1);

/**
 * Windows/XAMPP STAGE webhook (in-place deploy)
 * - Sadece GitHub push (branch: main) olayında çalışır
 * - C:\xampp\htdocs\stage içinde: git fetch + reset --hard origin/main
 * - Güvenlik: HMAC (X-Hub-Signature-256), file lock, idempotency, log
 */

$CONFIG = [
    'branch'       => 'main', // main=stage
    'repo_remote'  => 'git@github.com:ozgurbakyols/stage-app.git',
    'workdir'      => 'C:\\xampp\\htdocs\\stage',
    'log_file'     => 'C:\\xampp\\htdocs\\stage\\deploy\\logs\\deploy.log',
    'secret'       => 'qrz28SPEsysuueXH2FHHiv4hynn04/GJTCrEnLVBKWIwnS3uitPxGunGwRxfAoOj', 
    'git_bin'      => 'C:\\Program Files\\Git\\bin\\git.exe',
    'php_bin'      => 'C:\\xampp\\php\\php.exe', // (opsiyonel framework komutları için)
];

function logln(string $msg, string $file): void {
    @file_put_contents($file, '['.date('Y-m-d H:i:s')."] $msg\r\n", FILE_APPEND);
}
function run(string $cmd, ?string $cwd, string $log): array {
    $desc = [1=>['pipe','w'], 2=>['pipe','w']];
    $p = proc_open($cmd, $desc, $pipes, $cwd ?: null, null);
    if (!is_resource($p)) { logln("ERR: proc_open failed for $cmd", $log); return [1,'','proc_open failed']; }
    $out = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]); fclose($pipes[2]);
    $code = proc_close($p);
    logln("CMD: $cmd\nOUT:\n$out\nERR:\n$err\nEXIT:$code", $log);
    return [$code,$out,$err];
}

// --- Security
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit('Method Not Allowed'); }
$payload = file_get_contents('php://input') ?: '';
$given = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$calc  = 'sha256=' . hash_hmac('sha256', $payload, $CONFIG['secret']);
if (!hash_equals($given, $calc)) { http_response_code(403); exit('Invalid signature'); }
if (($_SERVER['HTTP_X_GITHUB_EVENT'] ?? '') !== 'push') { http_response_code(202); exit('Ignored: not push'); }
$data = json_decode($payload, true) ?: [];
if (($data['ref'] ?? '') !== 'refs/heads/'.$CONFIG['branch']) { http_response_code(202); exit('Ignored: other branch'); }
$sha = $data['after'] ?? ''; if (!$sha) { http_response_code(400); exit('No SHA'); }

// --- Lock + idempotency
$lockPath = $CONFIG['workdir'].'\\deploy.lock';
$lock = fopen($lockPath, 'c+');
if (!$lock || !flock($lock, LOCK_EX|LOCK_NB)) { http_response_code(429); exit('Another deploy is running'); }
$shaFile = $CONFIG['workdir'].'\\last_sha';
$lastSha = @is_file($shaFile) ? trim((string)@file_get_contents($shaFile)) : '';
if ($lastSha === $sha) { logln("Same SHA ($sha) already deployed. Skipping.", $CONFIG['log_file']); echo "Already deployed."; exit; }

logln("=== Deploy start (in-place) for SHA $sha ===", $CONFIG['log_file']);

// Remote sabitle (gerekirse)
run('"'.$CONFIG['git_bin'].'" remote set-url origin "'.$CONFIG['repo_remote'].'"', $CONFIG['workdir'], $CONFIG['log_file']);

// Asıl senkronizasyon
run('"'.$CONFIG['git_bin'].'" fetch --all --prune', $CONFIG['workdir'], $CONFIG['log_file']);
run('"'.$CONFIG['git_bin'].'" checkout '.$CONFIG['branch'], $CONFIG['workdir'], $CONFIG['log_file']);
run('"'.$CONFIG['git_bin'].'" reset --hard origin/'.$CONFIG['branch'], $CONFIG['workdir'], $CONFIG['log_file']);

// (Opsiyonel) Build/migrate adımları:
// run('"'.$CONFIG['php_bin'].'" artisan down', $CONFIG['workdir'], $CONFIG['log_file']);
// run('composer install --no-dev --optimize-autoloader', $CONFIG['workdir'], $CONFIG['log_file']);
// run('npm ci && npm run build', $CONFIG['workdir'], $CONFIG['log_file']);
// run('"'.$CONFIG['php_bin'].'" artisan migrate --force', $CONFIG['workdir'], $CONFIG['log_file']);
// run('"'.$CONFIG['php_bin'].'" artisan optimize', $CONFIG['workdir'], $CONFIG['log_file']);
// run('"'.$CONFIG['php_bin'].'" artisan up', $CONFIG['workdir'], $CONFIG['log_file']);

@file_put_contents($shaFile, $sha);
flock($lock, LOCK_UN); fclose($lock);

logln("=== Deploy OK (in-place) ===", $CONFIG['log_file']);
header('Content-Type: application/json');
echo json_encode(['status'=>'ok','mode'=>'in-place','sha'=>$sha]);
