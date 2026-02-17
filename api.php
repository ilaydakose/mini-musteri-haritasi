<?php
// Oturum ve audit helper (login bilgisi + IP ile log tutmak için)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
@require_once __DIR__ . '/audit.php';

// Hata raporlamayı GELİŞTİRME ortamında açmak isterseniz aşağıdaki satırları aktif edin.
// Canlıda kapalı kalması önerilir.
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

// ob_start("ob_gzhandler"); // Gzip compression kaldırıldı - JSON parse hatasına neden oluyordu
// Veritabanı bağlantı bilgileri
$servername = "localhost";
$username = "root";
$password = "";
$dbname ="tapu_miniharita_v2";

// MySQL bağlantısı oluşturma
try {
$conn = new mysqli($servername, $username, $password, $dbname);

// Bağlantıyı kontrol et
if ($conn->connect_error) {
        error_log("❌ MySQL Bağlantı Hatası: " . $conn->connect_error);
        // MySQL çalışmıyorsa test response döndür
        if (isset($_GET['action']) && $_GET['action'] === 'addPropertyToFirm') {
            echo json_encode(['success' => false, 'message' => 'MySQL bağlantı hatası: ' . $conn->connect_error]);
            exit;
        }
    die("Bağlantı hatası: " . $conn->connect_error);
    }
} catch (Exception $e) {
    error_log("❌ MySQL Bağlantı Exception: " . $e->getMessage());
    if (isset($_GET['action']) && $_GET['action'] === 'addPropertyToFirm') {
        echo json_encode(['success' => false, 'message' => 'MySQL bağlantı hatası: ' . $e->getMessage()]);
        exit;
    }
    die("Bağlantı hatası: " . $e->getMessage());
}

// Karakter setini UTF-8 olarak ayarla
$conn->set_charset("utf8mb4");

// ATN işlemlerinde kullanılacak collation (tapu_maliye ile birebir uyum için)
$ATN_COLLATION = 'utf8mb4_turkish_ci';

// Talep modülü helper'larını ekle (aşağıdaki action router'ında kullanılacak)
require_once __DIR__ . '/talep/api_requests.php';

// Ortak action parametresi (GET/POST) ve varsayılan JSON içerik tipi
$action = $_GET['action'] ?? $_POST['action'] ?? null;
header('Content-Type: application/json; charset=utf-8');


// Talep modülü router (talep/api_requests.php)
$talepActions = [
    'create_request','update_request','get_request','list_requests','update_request_status',
    'add_request_parcel','update_request_parcel','delete_request_parcel','bulk_update_request_parcels','list_request_parcels','get_request_parcel','get_request_parcels_detailed',
    'update_parcels_partner_batch','update_parcel_documents',
    'create_user','list_users','get_user','update_user',
    'create_research_answer','update_research_answer','list_research_answers','get_research_answer',
    'create_subject','list_subjects','update_subject',
    'create_firm','list_firms','update_firm',
    'upsert_contract_flags','get_contract_flags',
    'create_research_request','update_research_request','get_research_request','list_research_requests','update_research_request_status','answer_research_request','mark_research_answer_read',
    'get_active_requests','get_waiting_requests','get_unreviewed_requests','get_completed_requests','get_weekly_requests','get_filing_stage_requests','get_pending_query_requests',
    'update_request_priorities','update_request_priority','update_prolegal_priority','send_partner_email','create_request_revision','get_request_revisions',
    'delete_request'
];
if ($action && in_array($action, $talepActions, true) && function_exists('handleRequestsApi')) {
    handleRequestsApi($conn); // Fonksiyon kendi içinde exit eder
    exit;
}

// ------------------- REQUEST AUTO STATUS (dashboard: "Şirkete Eklenen Parseller") -------------------
// Partner Uygunluğu Alındı (request_parcels.partner_batch = 'araziler_onaylandı_sorgu') olan parsellerin
// tamamı sorgudurumu.sorgulama_durumu = 'Sorgulandı' olunca talep statüsünü 6 -> 7 yap.
if ($action === 'maybe_advance_request_status') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $p = json_decode(file_get_contents('php://input'), true) ?? [];
    $requestId = intval($p['request_id'] ?? 0);
    if ($requestId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'request_id gerekli'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Statü mapping (talep/api_requests.php içinden geliyor)
    global $REQUEST_STATUS;
    $fromStatus = intval($REQUEST_STATUS['sorguya_yollandi'] ?? 6);
    $toStatus = intval($REQUEST_STATUS['sorgudan_geldi'] ?? 7);

    // Talep mevcut mu ve statüsü ne?
    $stmt = $conn->prepare("SELECT status_id FROM requests WHERE request_id = ? LIMIT 1");
    $stmt->bind_param("i", $requestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'request_id bulunamadı'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $currentStatus = intval($row['status_id']);

    // 0 adet partner uyg. parsel varsa geçiş yapma
    $q = "
        SELECT rp.parcel_id, rp.partner_batch, s.sorgulama_durumu
        FROM request_parcels rp
        LEFT JOIN sorgudurumu s ON rp.parcel_id = s.prolegal_id
        INNER JOIN (
            SELECT request_id, parcel_id, MAX(id) AS max_id
            FROM request_parcels
            WHERE request_id = ?
            GROUP BY request_id, parcel_id
        ) t ON rp.request_id = t.request_id AND rp.parcel_id = t.parcel_id AND rp.id = t.max_id
        WHERE rp.request_id = ? AND rp.partner_batch = 'araziler_onaylandı_sorgu'
    ";
    $stmt = $conn->prepare($q);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("ii", $requestId, $requestId);
    $stmt->execute();
    $r = $stmt->get_result();
    $total = 0;
    $queried = 0;
    while ($rr = $r->fetch_assoc()) {
        $total++;
        $sd = $rr['sorgulama_durumu'] ?? '';
        if ($sd === 'Sorgulandı') $queried++;
    }
    $stmt->close();

    if ($total === 0) {
        echo json_encode([
            'success' => true,
            'changed' => false,
            'reason' => 'no_partner_approved_parcels',
            'current_status_id' => $currentStatus,
            'total_partner_approved' => 0,
            'queried_partner_approved' => 0
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $shouldAdvance = ($queried === $total) && ($currentStatus === $fromStatus);
    if (!$shouldAdvance) {
        echo json_encode([
            'success' => true,
            'changed' => false,
            'reason' => 'conditions_not_met',
            'current_status_id' => $currentStatus,
            'total_partner_approved' => $total,
            'queried_partner_approved' => $queried
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Idempotent update: sadece 6 ise 7 yap
    $stmt = $conn->prepare("UPDATE requests SET status_id = ?, sorgudan_geldi_tarihi = NOW(), updated_at = NOW() WHERE request_id = ? AND status_id = ?");
    $stmt->bind_param("iii", $toStatus, $requestId, $fromStatus);
    $ok = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'update failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Statü geçmişine yaz
    if ($affected > 0 && function_exists('logRequestStatusHistory') && function_exists('currentUserId')) {
        $uid = currentUserId() ?? 0;
        logRequestStatusHistory($conn, $requestId, $fromStatus, $toStatus, $uid, '');
    }

    echo json_encode([
        'success' => true,
        'changed' => $affected > 0,
        'reason' => $affected > 0 ? 'advanced' : 'already_advanced_or_race',
        'from_status_id' => $fromStatus,
        'to_status_id' => $toStatus,
        'total_partner_approved' => $total,
        'queried_partner_approved' => $queried
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// "Partner Uygunluğu Alındı" (request_parcels.partner_batch = 'araziler_onaylandı_sorgu') parsellerinin
// tamamı sorgudurumu.sorgulama_durumu = 'Sorguda' veya 'Sorgulandı' olunca talep statüsünü 4 -> 6 yap
if ($action === 'maybe_set_request_status_sorguya_yollandi') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $p = json_decode(file_get_contents('php://input'), true) ?? [];
    $requestId = intval($p['request_id'] ?? 0);
    if ($requestId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'request_id gerekli'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    global $REQUEST_STATUS;
    $fromStatus = intval($REQUEST_STATUS['sorgu_sirasi_olumlu'] ?? 4); // Sorgu Sırasına Alındı
    $toStatus = intval($REQUEST_STATUS['sorguya_yollandi'] ?? 6); // Sorguya Yollandı

    // Talep mevcut mu ve statüsü ne?
    $stmt = $conn->prepare("SELECT status_id FROM requests WHERE request_id = ? LIMIT 1");
    $stmt->bind_param("i", $requestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'request_id bulunamadı'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $currentStatus = intval($row['status_id']);

    // Sadece 4 iken 6'ya geç (idempotent / koruma)
    if ($currentStatus !== $fromStatus) {
        echo json_encode([
            'success' => true,
            'changed' => false,
            'reason' => 'status_not_eligible',
            'current_status_id' => $currentStatus,
            'from_status_id' => $fromStatus,
            'to_status_id' => $toStatus
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // request_parcels latest listesi (kartta görünenler) + sorgudurumu
    // Sadece partner_batch='araziler_onaylandı_sorgu' olan parselleri kontrol et.
    $q = "
        SELECT rp.parcel_id, s.sorgulama_durumu
        FROM request_parcels rp
        LEFT JOIN sorgudurumu s ON rp.parcel_id = s.prolegal_id
        INNER JOIN (
            SELECT request_id, parcel_id, MAX(id) AS max_id
            FROM request_parcels
            WHERE request_id = ?
            GROUP BY request_id, parcel_id
        ) t ON rp.request_id = t.request_id AND rp.parcel_id = t.parcel_id AND rp.id = t.max_id
        WHERE rp.request_id = ? AND rp.partner_batch = 'araziler_onaylandı_sorgu'
    ";
    $stmt = $conn->prepare($q);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stmt->bind_param("ii", $requestId, $requestId);
    $stmt->execute();
    $r = $stmt->get_result();

    $allowed = ['Sorguda' => true, 'Sorgulandı' => true];
    $total = 0;
    $okCount = 0;
    while ($rr = $r->fetch_assoc()) {
        $total++;
        $sd = trim($rr['sorgulama_durumu'] ?? '');
        if (isset($allowed[$sd])) $okCount++;
    }
    $stmt->close();

    if ($total === 0) {
        echo json_encode([
            'success' => true,
            'changed' => false,
            'reason' => 'no_parcels',
            'current_status_id' => $currentStatus,
            'total' => 0,
            'ok' => 0
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($okCount !== $total) {
        echo json_encode([
            'success' => true,
            'changed' => false,
            'reason' => 'conditions_not_met',
            'current_status_id' => $currentStatus,
            'total' => $total,
            'ok' => $okCount
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Update: sadece 4 ise 6 yap (race safe)
    $stmt = $conn->prepare("UPDATE requests SET status_id = ?, updated_at = NOW() WHERE request_id = ? AND status_id = ?");
    $stmt->bind_param("iii", $toStatus, $requestId, $fromStatus);
    $ok = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'update failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($affected > 0 && function_exists('logRequestStatusHistory') && function_exists('currentUserId')) {
        $uid = currentUserId() ?? 0;
        logRequestStatusHistory($conn, $requestId, $fromStatus, $toStatus, $uid, '');
    }

    echo json_encode([
        'success' => true,
        'changed' => $affected > 0,
        'reason' => $affected > 0 ? 'advanced' : 'already_advanced_or_race',
        'from_status_id' => $fromStatus,
        'to_status_id' => $toStatus,
        'total' => $total,
        'ok' => $okCount
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Yüzölçümü değeri string (10.537,17 gibi) gelse bile doğru parse et
function formatYuzolcum($val): string
{
    if ($val === null || $val === '') {
        return '';
    }
    // Türkçe formatı normalize et: binlik nokta sil, virgülü ondalık yap
    if (is_string($val)) {
        $normalized = str_replace(['.', ','], ['', '.'], $val);
    } else {
        $normalized = $val;
    }
    if (!is_numeric($normalized)) {
        return (string)$val;
    }
    return number_format((float)$normalized, 2, ',', '.');
}

/**
 * Yüzölçümü girişini normalize et: binlik ayraçları sil, ondalık ayıracı virgül yap, gereksiz sıfırları kırp.
 * Ör: "90.143,50" → "90143,5", "90143.50" → "90143,5"
 */
function normalizeYuzolcumForStorage($val): ?string
{
    if ($val === null) return null;
    $s = trim((string)$val);
    if ($s === '') return null;
    // Sadece rakam, nokta ve virgül tut
    $s = preg_replace('/[^\d,\.]/', '', $s);
    // Önce virgüllü format
    if (strpos($s, ',') !== false) {
        [$intPart, $decPart] = array_pad(explode(',', $s, 2), 2, '');
        $intDigits = preg_replace('/\D/', '', $intPart);
        $decDigits = preg_replace('/\D/', '', $decPart);
        $decDigits = rtrim($decDigits, '0'); // gereksiz sıfırları at
        return $decDigits === '' ? $intDigits : ($intDigits . ',' . $decDigits);
    }
    // Noktalı ondalık varsa (son nokta ondalık varsayılır)
    if (substr_count($s, '.') >= 1) {
        $pos = strrpos($s, '.');
        $intPart = substr($s, 0, $pos);
        $decPart = substr($s, $pos + 1);
        $intDigits = preg_replace('/\D/', '', $intPart);
        $decDigits = preg_replace('/\D/', '', $decPart);
        $decDigits = rtrim($decDigits, '0');
        return $decDigits === '' ? $intDigits : ($intDigits . ',' . $decDigits);
    }
    // Sadece tam sayı
    return preg_replace('/\D/', '', $s);
}

function toUpperTr(?string $val): ?string
{
    if ($val === null) return null;
    return mb_strtoupper($val, 'UTF-8');
}

function normalizeAtnValueForLookup(?string $val): string
{
    if ($val === null) {
        return '(bos)';
    }
    $cleaned = str_replace(["\r", "\n", "\t", chr(160)], ' ', (string)$val);
    $trimmed = trim($cleaned);
    if ($trimmed === '') {
        return '(bos)';
    }
    return toUpperTr($trimmed);
}

function normalizedAtnSqlExpr(string $column): string
{
    // SATIRBAŞI ve NBSP karakterlerini temizle, TRIM + UPPER ile normalize et
    global $ATN_COLLATION;
    $collate = preg_replace('/[^A-Za-z0-9_]/', '', $ATN_COLLATION ?? '') ?: 'utf8mb4_unicode_ci';
    return "COALESCE(NULLIF(UPPER(TRIM(REPLACE(REPLACE(REPLACE($column, CHAR(13), ' '), CHAR(10), ' '), CHAR(160), ' '))) COLLATE {$collate}, ''), '(bos)')";
}

// Popup güncelleme başarısızlık log tablosunu garantiye al
function ensurePopupFailLogTable(mysqli $conn): void
{
    $sql = "CREATE TABLE IF NOT EXISTS popup_update_fail_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tapu_id INT NULL,
        mahalle_id INT NULL,
        ada INT NULL,
        parsel INT NULL,
        il VARCHAR(255) NULL,
        ilce VARCHAR(255) NULL,
        mahalle VARCHAR(255) NULL,
        reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_tapu (tapu_id),
        INDEX idx_mahalle (mahalle_id),
        INDEX idx_ada_parsel (ada, parsel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->query($sql);
}

/**
 * Bright Data proxy kimlik bilgisini isteğe göre döndürür.
 * BRIGHT_PROXY_ROTATE=1 ise her istekte yeni session ile IP rotasyonu sağlar.
 */
function buildBrightProxyCreds(?string $baseCreds, bool $forceRotate = false): ?string
{
    if ($baseCreds === null || $baseCreds === '') {
        return null;
    }
    $parts = explode(':', $baseCreds, 2);
    if (count($parts) !== 2) {
        return $baseCreds;
    }
    [$user, $pwd] = $parts;
    $rotate = getenv('BRIGHT_PROXY_ROTATE');
    $shouldRotate = $forceRotate || $rotate === '1' || strcasecmp($rotate ?? '', 'true') === 0;
    if (!$shouldRotate) {
        return $baseCreds;
    }
    // Mevcut session varsa temizle, yeni session ekle
    $user = preg_replace('/-session-[^-]+$/', '', $user);
    try {
        $session = bin2hex(random_bytes(4));
    } catch (Exception $e) {
        $session = substr(uniqid('', true), -8);
    }
    return $user . '-session-' . $session . ':' . $pwd;
}

// Proxy bilgilerini parola olmadan maskeleyip döndürür
function maskProxyInfo(?string $host, ?string $port, ?string $userpwd): array
{
    $displayHost = ($host && $port) ? ($host . ':' . $port) : null;
    $session = null;
    $userOnly = null;
    if ($userpwd && strpos($userpwd, ':') !== false) {
        [$userOnly] = explode(':', $userpwd, 2);
        if (preg_match('/-session-([^-:]+)/', $userOnly, $m)) {
            $session = $m[1];
        }
    }
    return [
        'proxy_host' => $displayHost,
        'proxy_user' => $userOnly,
        'proxy_session' => $session,
    ];
}

// Proxy üzerinden çıkış IP'sini döndürür (başarısız olursa null)
function getProxyExitIp(string $host, string $port, string $userpwd): ?string
{
    $endpoints = [
        'https://geo.brdtest.com/myip',
        'http://geo.brdtest.com/myip',
        'https://api.ipify.org',
        'http://api.ipify.org',
    ];
    foreach ($endpoints as $ep) {
        $ch = curl_init($ep);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_PROXY => $host . ':' . $port,
            CURLOPT_PROXYUSERPWD => $userpwd,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        $resp = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($resp === false || $http >= 400) {
            continue;
        }
        $ip = trim($resp);
        if ($ip !== '') {
            return $ip;
        }
    }
    return null;
}

function isNumericLike($val): bool
{
    if ($val === null || $val === '') return false;
    if (is_numeric($val)) return true;
    if (is_string($val)) {
        $normalized = str_replace(['.', ','], ['', '.'], $val);
        return is_numeric($normalized);
    }
    return false;
}

/**
 * Strip every non-digit character and return the integer value.
 * Useful when DB fields contain NBSP/newline/tab or mixed content that breaks MySQL's numeric cast.
 */
function normalizeDigitsToInt($val): ?int
{
    if ($val === null) {
        return null;
    }
    $digits = preg_replace('/\D+/', '', (string)$val);
    if ($digits === '') {
        return null;
    }
    // int cast is safe because we only keep digits
    return (int)$digits;
}

/**
 * get_result desteklenmeyen ortamlarda da (mysqlnd yoksa) güvenli fetch için yardımcı fonksiyonlar
 */
function stmtFetchFirstAssoc(mysqli_stmt $stmt): ?array
{
    if (method_exists($stmt, 'get_result')) {
        $res = $stmt->get_result();
        if ($res && $res->num_rows > 0) {
            return $res->fetch_assoc();
        }
        return null;
    }

    if (!$stmt->store_result()) {
        return null;
    }
    $meta = $stmt->result_metadata();
    if (!$meta) return null;

    $row = [];
    $bind = [];
    while ($field = $meta->fetch_field()) {
        $row[$field->name] = null;
        $bind[] = &$row[$field->name];
    }
    $stmt->bind_result(...$bind);
    if ($stmt->fetch()) {
        // Kopyasını döndür
        return array_map(function ($v) { return $v; }, $row);
    }
    return null;
}

function stmtFetchAllAssoc(mysqli_stmt $stmt): array
{
    if (method_exists($stmt, 'get_result')) {
        $res = $stmt->get_result();
        $rows = [];
        if ($res) {
            while ($r = $res->fetch_assoc()) {
                $rows[] = $r;
            }
        }
        return $rows;
    }

    if (!$stmt->store_result()) {
        return [];
    }
    $meta = $stmt->result_metadata();
    if (!$meta) return [];

    $row = [];
    $bind = [];
    $keys = [];
    while ($field = $meta->fetch_field()) {
        $row[$field->name] = null;
        $bind[] = &$row[$field->name];
        $keys[] = $field->name;
    }
    $stmt->bind_result(...$bind);

    $rows = [];
    while ($stmt->fetch()) {
        // Derin kopya
        $copy = [];
        foreach ($keys as $k) {
            $copy[$k] = $row[$k];
        }
        $rows[] = $copy;
    }
    return $rows;
}

function atnLookupExists(mysqli $conn): bool
{
    $res = $conn->query("SHOW TABLES LIKE 'atn_lookup'");
    return $res && $res->num_rows > 0;
}

function dropAtnLookup(mysqli $conn): array
{
    if (!$conn->query("DROP TABLE IF EXISTS atn_lookup")) {
        return ['success' => false, 'message' => 'atn_lookup silinemedi: ' . $conn->error];
    }
    return ['success' => true];
}

function rebuildAtnLookup(mysqli $conn): array
{
    global $ATN_COLLATION;
    $collate = preg_replace('/[^A-Za-z0-9_]/', '', $ATN_COLLATION ?? '') ?: 'utf8mb4_unicode_ci';

    $needsRecreate = !atnLookupExists($conn) || !tableHasColumn($conn, 'atn_lookup', 'combo_hash', false);
    if ($needsRecreate) {
        if (!$conn->query("DROP TABLE IF EXISTS atn_lookup")) {
            return ['success' => false, 'message' => 'atn_lookup silinemedi: ' . $conn->error];
        }
    }

    // Hash bazlı PK ile tam uzunlukta ATN değerlerini sakla
    $sqlCreate = "
        CREATE TABLE IF NOT EXISTS atn_lookup (
            combo_hash BINARY(16) NOT NULL,
            ana VARCHAR(255) NOT NULL,
            atn1 VARCHAR(255) DEFAULT NULL,
            atn2 VARCHAR(255) DEFAULT NULL,
            atn2_yedek VARCHAR(255) DEFAULT NULL,
            freq INT NOT NULL DEFAULT 0,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (combo_hash),
            INDEX idx_ana_freq (ana(191), freq)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={$collate};
    ";
    if (!$conn->query($sqlCreate)) {
        return ['success' => false, 'message' => 'atn_lookup oluşturulamadı: ' . $conn->error];
    }
    if (!$conn->query("TRUNCATE TABLE atn_lookup")) {
        return ['success' => false, 'message' => 'atn_lookup temizlenemedi: ' . $conn->error];
    }

    $normAna = normalizedAtnSqlExpr('AnaTasinmazNitelik');
    $normAtn1 = normalizedAtnSqlExpr('AnaTasinmazNitelik_1');
    $normAtn2 = normalizedAtnSqlExpr('AnaTasinmazNitelik_2');
    $normAtn2Yedek = normalizedAtnSqlExpr('AnaTasinmazNitelik_2_yedek');

    $sqlInsert = "
        INSERT INTO atn_lookup (combo_hash, ana, atn1, atn2, atn2_yedek, freq, last_seen)
        SELECT UNHEX(MD5(CONCAT_WS('|', ana, atn1, atn2, atn2_yedek))) AS combo_hash,
               ana, atn1, atn2, atn2_yedek,
               COUNT(*) as freq,
               NOW() as ls
        FROM (
            SELECT
                {$normAna} AS ana,
                {$normAtn1} AS atn1,
                {$normAtn2} AS atn2,
                {$normAtn2Yedek} AS atn2_yedek
            FROM tapu_maliye
        ) AS t
        GROUP BY ana, atn1, atn2, atn2_yedek
        ON DUPLICATE KEY UPDATE freq = VALUES(freq), last_seen = VALUES(last_seen);
    ";
    if (!$conn->query($sqlInsert)) {
        return ['success' => false, 'message' => 'atn_lookup doldurulamadı: ' . $conn->error];
    }
    return ['success' => true, 'inserted' => $conn->affected_rows];
}

// tapu_maliye'deki ATN kolonlarını normalize edip (UPPER/TRIM/NBSP temizliği) doğrudan tabloya yazar
function normalizeTapuAtn(mysqli $conn): array
{
    $normAna = normalizedAtnSqlExpr('AnaTasinmazNitelik');
    $normAtn1 = normalizedAtnSqlExpr('AnaTasinmazNitelik_1');
    $normAtn2 = normalizedAtnSqlExpr('AnaTasinmazNitelik_2');
    $normAtn2Yedek = normalizedAtnSqlExpr('AnaTasinmazNitelik_2_yedek');

    $sql = "
        UPDATE tapu_maliye SET
            AnaTasinmazNitelik      = {$normAna},
            AnaTasinmazNitelik_1    = {$normAtn1},
            AnaTasinmazNitelik_2    = {$normAtn2},
            AnaTasinmazNitelik_2_yedek = {$normAtn2Yedek}
    ";
    if (!$conn->query($sql)) {
        return ['success' => false, 'message' => 'tapu_maliye normalize edilemedi: ' . $conn->error];
    }
    return ['success' => true, 'affected' => $conn->affected_rows];
}

// Benzersiz ID üret (AUTO_INCREMENT yoksa güvenli id üretimi)
function generateUniqueTapuId(mysqli $conn, int $maxAttempts = 10): ?int
{
    for ($i = 0; $i < $maxAttempts; $i++) {
        // 10 haneli aralık: çakışma ihtimali düşük
        $id = random_int(1_000_000_000, 1_999_999_999);
        $stmt = $conn->prepare("SELECT 1 FROM tapu_maliye WHERE Id = ? LIMIT 1");
        if (!$stmt) {
            return null;
        }
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $exists = $res && $res->num_rows > 0;
        $stmt->close();
        if (!$exists) {
            return $id;
        }
    }
    return null;
}

// TKGM web uygulamasındaki sabit menü verisini (CORS engelini aşmak için) proxy ile çek
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'tkgm_attribute_menu') {
    $url = "https://parselsorgu.tkgm.gov.tr/app/modules/map/data/attributeMenuList.json?t=" . time();
    // Proxy bilgileri: önce BRIGHT_PROXY_* , yoksa BRIGHTDATA_* , yoksa sabitler
    $proxyHost = getenv('BRIGHT_PROXY_HOST') ?: getenv('BRIGHTDATA_HOST') ?: 'brd.superproxy.io';
    $proxyPort = getenv('BRIGHT_PROXY_PORT') ?: getenv('BRIGHTDATA_PORT') ?: '33335';
    $proxyBaseCreds = getenv('BRIGHT_PROXY_USERPWD');
    if (!$proxyBaseCreds) {
        $u = getenv('BRIGHTDATA_USERNAME');
        $p = getenv('BRIGHTDATA_PASSWORD');
        if ($u && $p) {
            $proxyBaseCreds = $u . ':' . $p;
        }
    }
    // Son çare: sabit kimlik bilgisi (geçici)
    if (!$proxyBaseCreds) {
        $proxyBaseCreds = 'brd-customer-hl_6a8ab962-zone-residential_proxy1:mna6ss72mu8u';
    }
    // Eğer hiçbir şey yoksa proxy kullanma
    if (!$proxyHost || !$proxyPort || !$proxyBaseCreds) {
        $proxyHost = null;
        $proxyPort = null;
        $proxyBaseCreds = null;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'stage-app/1.0',
    ]);
    if ($proxyHost && $proxyPort && $proxyUserPwd) {
        curl_setopt($ch, CURLOPT_PROXY, $proxyHost . ':' . $proxyPort);
        curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxyUserPwd);
    }
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    header('Content-Type: application/json; charset=utf-8');
    if ($resp === false || $httpCode >= 400) {
        http_response_code(502);
        echo json_encode(['success' => false, 'message' => 'TKGM menü verisi alınamadı', 'status' => $httpCode, 'error' => $err]);
    } else {
        echo $resp;
    }
    exit;
}

// ATN lookup: AnaTasinmazNitelik'e göre en çok kullanılan kombinasyonları getir
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_atn_suggestions') {
    $anaRaw = isset($_GET['ana']) ? $_GET['ana'] : '';
    if (trim($anaRaw) === '') {
        echo json_encode(['success' => false, 'message' => 'ana parametresi gerekli']);
        exit;
    }
    $ana = normalizeAtnValueForLookup($anaRaw);
    $rows = [];

    // Tablo eksikse veya eski şemadaysa yeniden inşa et
    if (!atnLookupExists($conn) || !tableHasColumn($conn, 'atn_lookup', 'combo_hash', false)) {
        rebuildAtnLookup($conn);
    }
    // Lookup içinde olası mükerrer satırları toplamak için tekrar grupla
    $stmt = $conn->prepare("
        SELECT atn1 AS AnaTasinmazNitelik_1,
               atn2 AS AnaTasinmazNitelik_2,
               atn2_yedek AS AnaTasinmazNitelik_2_yedek,
               SUM(freq) AS freq
        FROM atn_lookup
        WHERE ana = ?
        GROUP BY atn1, atn2, atn2_yedek
        ORDER BY freq DESC
        LIMIT 20
    ");
    if ($stmt) {
        $stmt->bind_param('s', $ana);
        $stmt->execute();
        $resData = $stmt->get_result();
        while ($row = $resData->fetch_assoc()) {
            $rows[] = $row;
        }
        $stmt->close();
    }

    // Lookup'ta yoksa canlı olarak tapu_maliye'den çek ve cache'e yaz
    if (count($rows) === 0) {
        $normAnaSql = normalizedAtnSqlExpr('AnaTasinmazNitelik');
        $normAtn1Sql = normalizedAtnSqlExpr('AnaTasinmazNitelik_1');
        $normAtn2Sql = normalizedAtnSqlExpr('AnaTasinmazNitelik_2');
        $normAtn2YedekSql = normalizedAtnSqlExpr('AnaTasinmazNitelik_2_yedek');

        $liveSql = "
            SELECT
                {$normAtn1Sql} AS AnaTasinmazNitelik_1,
                {$normAtn2Sql} AS AnaTasinmazNitelik_2,
                {$normAtn2YedekSql} AS AnaTasinmazNitelik_2_yedek,
                COUNT(*) AS freq
            FROM tapu_maliye
            WHERE {$normAnaSql} = ?
            GROUP BY AnaTasinmazNitelik_1, AnaTasinmazNitelik_2, AnaTasinmazNitelik_2_yedek
            ORDER BY freq DESC
            LIMIT 20
        ";
        $liveStmt = $conn->prepare($liveSql);
        if ($liveStmt) {
            $liveStmt->bind_param('s', $ana);
            if ($liveStmt->execute()) {
                $res = $liveStmt->get_result();
                if ($res) {
                    while ($r = $res->fetch_assoc()) {
                        $rows[] = $r;
                    }
                }
            }
            $liveStmt->close();
        }

        // Cache'e yaz (lookup tablosu varsa)
        if (count($rows) > 0 && atnLookupExists($conn)) {
            $upsert = $conn->prepare("
                INSERT INTO atn_lookup (combo_hash, ana, atn1, atn2, atn2_yedek, freq, last_seen)
                VALUES (UNHEX(MD5(CONCAT_WS('|', ?, ?, ?, ?))), ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE freq = VALUES(freq), last_seen = VALUES(last_seen)
            ");
            if ($upsert) {
                foreach ($rows as $r) {
                    $atn1 = $r['AnaTasinmazNitelik_1'] ?? '(bos)';
                    $atn2 = $r['AnaTasinmazNitelik_2'] ?? '(bos)';
                    $atn2y = $r['AnaTasinmazNitelik_2_yedek'] ?? '(bos)';
                    $freq = (int)($r['freq'] ?? 0);
                    $upsert->bind_param(
                        'ssssssssi',
                        $ana, $atn1, $atn2, $atn2y,
                        $ana, $atn1, $atn2, $atn2y,
                        $freq
                    );
                    $upsert->execute();
                }
                $upsert->close();
            }
        }
    }

    echo json_encode(['success' => true, 'data' => $rows]);
    exit;
}

// ATN lookup tabloyu yeniden oluştur
if (
    in_array($_SERVER['REQUEST_METHOD'], ['POST', 'GET'], true) &&
    $action === 'rebuild_atn_lookup'
) {
    $result = rebuildAtnLookup($conn);
    echo json_encode($result);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'reset_atn_lookup') {
    $dropResult = dropAtnLookup($conn);
    if (!$dropResult['success']) {
        echo json_encode($dropResult);
        exit;
    }
    $rebuildResult = rebuildAtnLookup($conn);
    echo json_encode($rebuildResult);
    exit;
}

// ATN kolonlarını tapu_maliye üzerinde normalize et ve lookup'ı yeniden kur
if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'GET'], true) && $action === 'normalize_tapu_atn') {
    // Bu işlem tüm tapu_maliye tablosunu günceller, bakım anında çalıştırın
    $normResult = normalizeTapuAtn($conn);
    if (!$normResult['success']) {
        echo json_encode($normResult);
        exit;
    }
    $rebuildResult = rebuildAtnLookup($conn);
    echo json_encode([
        'success' => $normResult['success'] && $rebuildResult['success'],
        'normalize' => $normResult,
        'rebuild' => $rebuildResult,
    ]);
    exit;
}

// KML servis (base64'ten decode edip KML olarak döner)
if (isset($_GET['action']) && $_GET['action'] === 'serve_kml') {
    // Google Earth Web doğrudan bu endpoint'e istek attığı için CORS serbest bırakıldı
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS, HEAD');
    header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
    header('Access-Control-Max-Age: 86400');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') {
        http_response_code(405);
        echo 'Method not allowed';
        exit;
    }

    $kmlB64 = $_GET['kml'] ?? '';
    if ($kmlB64 === '') {
        http_response_code(400);
        echo 'No KML provided';
        exit;
    }
    // URL-safe base64 varyantlarını normalize et
    $kmlB64 = strtr($kmlB64, ' ', '+');
    $kml = base64_decode($kmlB64);
    if ($kml === false) {
        http_response_code(400);
        echo 'Invalid KML';
        exit;
    }
    header('Content-Type: application/vnd.google-earth.kml+xml');
    header('Content-Disposition: inline; filename="parcel.kml"');
    header('Content-Length: ' . strlen($kml));
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
        echo $kml;
    }
    exit;
}

// Proxy IP rotasyon testi (TKGM proxy ile aynı BrightData ayarlarını kullanır)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'tkgm_proxy_ip_test') {
    header('Content-Type: application/json; charset=utf-8');
    $proxyHost = getenv('BRIGHT_PROXY_HOST') ?: getenv('BRIGHTDATA_HOST') ?: 'brd.superproxy.io';
    $proxyPort = getenv('BRIGHT_PROXY_PORT') ?: getenv('BRIGHTDATA_PORT') ?: '33335';
    $proxyBaseCreds = getenv('BRIGHT_PROXY_USERPWD') ?: null;
    if (!$proxyBaseCreds) {
        $u = getenv('BRIGHTDATA_USERNAME');
        $p = getenv('BRIGHTDATA_PASSWORD');
        if ($u && $p) {
            $proxyBaseCreds = $u . ':' . $p;
        }
    }
    // Son çare sabit kimlik bilgisi
    if (!$proxyBaseCreds) {
        $proxyBaseCreds = 'brd-customer-hl_6a8ab962-zone-harita:2r3e34thjoot';
    }
    if (!$proxyHost || !$proxyPort || !$proxyBaseCreds) {
        echo json_encode([
            'success' => false,
            'message' => 'Proxy konfigürasyonu eksik (host/port/kimlik bilgisi)',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rotateParam = $_GET['rotate'] ?? '1';
    $shouldRotate = ($rotateParam === '1') || (strcasecmp($rotateParam, 'true') === 0);
    $baseMasked = maskProxyInfo($proxyHost, $proxyPort, $proxyBaseCreds);

    $t0 = microtime(true);
    $ipBeforeStart = microtime(true);
    $ipBefore = getProxyExitIp($proxyHost, $proxyPort, $proxyBaseCreds);
    $proxyIpBeforeMs = round((microtime(true) - $ipBeforeStart) * 1000, 2);

    $ipAfter = null;
    $proxyIpAfterMs = null;
    $rotatedCreds = null;
    $ipChanged = null;
    $rotated = false;
    if ($shouldRotate) {
        $rotatedCreds = buildBrightProxyCreds($proxyBaseCreds, true);
        $rotated = $rotatedCreds !== $proxyBaseCreds;
        $ipAfterStart = microtime(true);
        $ipAfter = getProxyExitIp($proxyHost, $proxyPort, $rotatedCreds);
        $proxyIpAfterMs = round((microtime(true) - $ipAfterStart) * 1000, 2);
        if ($ipBefore !== null && $ipAfter !== null) {
            $ipChanged = $ipBefore !== $ipAfter;
        }
    }

    $totalMs = round((microtime(true) - $t0) * 1000, 2);
    $success = $ipBefore !== null && (!$shouldRotate || $ipAfter !== null);
    $message = null;
    if ($ipBefore === null) {
        $message = 'Proxy çıkış IP alınamadı';
    } elseif ($shouldRotate && $ipAfter === null) {
        $message = 'Rotasyon sonrası IP alınamadı';
    } elseif ($shouldRotate && $ipChanged === false) {
        $message = 'Rotasyon denendi fakat IP değişmedi';
    }

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'proxy_rotated' => $shouldRotate && $rotated ? 1 : 0,
        'proxy_used' => $baseMasked,
        'proxy_used_rotated' => $rotatedCreds ? maskProxyInfo($proxyHost, $proxyPort, $rotatedCreds) : null,
        'proxy_ip_before' => $ipBefore,
        'proxy_ip_after' => $ipAfter,
        'ip_changed' => $ipChanged,
        'timings' => [
            'total_ms' => $totalMs,
            'proxy_ip_before_ms' => $proxyIpBeforeMs,
            'proxy_ip_after_ms' => $proxyIpAfterMs
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// TKGM parsel verisini (mahalle/ada/parsel) sunucu üzerinden proxy et
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'tkgm_parsel_proxy') {
    $t0 = microtime(true);
    $mahalleId = isset($_GET['mahalle_id']) ? intval($_GET['mahalle_id']) : 0;
    $ada       = isset($_GET['ada']) ? intval($_GET['ada']) : 0;
    $parsel    = isset($_GET['parsel']) ? intval($_GET['parsel']) : 0;
    $proxyDebug = isset($_GET['proxy_debug']) && $_GET['proxy_debug'] === '1';
    if ($mahalleId <= 0 || $ada < 0 || $parsel < 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Geçersiz mahalle/ada/parsel']);
        exit;
    }

    $bases = [
        'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel',
        'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel'
    ];
    // Proxy bilgileri: önce BRIGHT_PROXY_*, sonra BRIGHTDATA_*, en son sabit fallback
    $proxyHost = getenv('BRIGHT_PROXY_HOST') ?: getenv('BRIGHTDATA_HOST') ?: 'brd.superproxy.io';
    $proxyPort = getenv('BRIGHT_PROXY_PORT') ?: getenv('BRIGHTDATA_PORT') ?: '33335';
    $proxyBaseCreds = getenv('BRIGHT_PROXY_USERPWD') ?: null;
    if (!$proxyBaseCreds) {
        $u = getenv('BRIGHTDATA_USERNAME');
        $p = getenv('BRIGHTDATA_PASSWORD');
        if ($u && $p) {
            $proxyBaseCreds = $u . ':' . $p;
        }
    }
    // Son çare sabit kimlik bilgisi
    if (!$proxyBaseCreds) {
        $proxyBaseCreds = 'brd-customer-hl_6a8ab962-zone-harita:2r3e34thjoot';
    }
    $forceRotate = isset($_GET['force_proxy_rotate']) && $_GET['force_proxy_rotate'] === '1';
    $lastError = 'TKGM servis hatası';
    $lastHttp = null;
    $lastErr = null;
    $lastBody = null;
    $usedProxyRotation = false;
    $proxyIpBefore = null;
    $proxyIpAfter = null;
    $proxyTrace = [];
    $proxyMasked = maskProxyInfo($proxyHost, $proxyPort, $proxyBaseCreds);
    $proxyIpBeforeMs = null;
    $proxyIpAfterMs = null;
    if ($proxyHost && $proxyPort && $proxyBaseCreds && $proxyDebug) {
        $ipStart = microtime(true);
        $proxyIpBefore = getProxyExitIp($proxyHost, $proxyPort, $proxyBaseCreds);
        $proxyIpBeforeMs = round((microtime(true) - $ipStart) * 1000, 2);
    }
    $lastProxyUsed = null;
    foreach ($bases as $base) {
        $url = sprintf('%s/%d/%d/%d', $base, $mahalleId, $ada, $parsel);
        // İlk denemede base cred; 403/429 gelirse bir kez rotate edip tekrar dene
        $attemptCreds = $forceRotate && $proxyBaseCreds ? buildBrightProxyCreds($proxyBaseCreds, true) : $proxyBaseCreds;
        if ($forceRotate && $proxyBaseCreds) {
            $usedProxyRotation = true;
            if ($proxyDebug) {
                $ipStartAfter = microtime(true);
                $proxyIpAfter = getProxyExitIp($proxyHost, $proxyPort, $attemptCreds);
                $proxyIpAfterMs = round((microtime(true) - $ipStartAfter) * 1000, 2);
            }
        }
        $maxAttempts = ($proxyHost && $proxyPort && $proxyBaseCreds) ? 2 : 1;
        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $tCurlStart = microtime(true);
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_USERAGENT => 'stage-app/1.0',
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_ENCODING => '', // gzip/deflate otomatik aç
                CURLOPT_HTTPHEADER => [
                    'Accept: application/json',
                    'Origin: https://parselsorgu.tkgm.gov.tr',
                    'Referer: https://parselsorgu.tkgm.gov.tr/',
                ],
            ]);
            if ($proxyHost && $proxyPort && $attemptCreds) {
                curl_setopt($ch, CURLOPT_PROXY, $proxyHost . ':' . $proxyPort);
                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $attemptCreds);
                $lastProxyUsed = maskProxyInfo($proxyHost, $proxyPort, $attemptCreds);
            }
            $resp = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlInfo = curl_getinfo($ch);
            $err = curl_error($ch);
            curl_close($ch);
            $curlTotalMs = round((microtime(true) - $tCurlStart) * 1000, 2);

            $lastHttp = $httpCode;
            $lastErr = $err;
            $lastBody = $resp;
            if ($proxyDebug) {
                $proxyTrace[] = [
                    'base' => $base,
                    'attempt' => $attempt + 1,
                    'http_code' => $httpCode,
                    'error' => $err,
                    'proxy_used' => $lastProxyUsed,
                    'timings_ms' => [
                        'total' => $curlTotalMs,
                        'namelookup' => isset($curlInfo['namelookup_time']) ? round($curlInfo['namelookup_time'] * 1000, 2) : null,
                        'connect' => isset($curlInfo['connect_time']) ? round($curlInfo['connect_time'] * 1000, 2) : null,
                        'starttransfer' => isset($curlInfo['starttransfer_time']) ? round($curlInfo['starttransfer_time'] * 1000, 2) : null
                    ]
                ];
            }

            if ($resp === false) {
                $lastError = $err ?: 'Bağlantı hatası';
                // Proxy limiti için rotate denemesi yap
                if (in_array($httpCode, [403, 429], true) && $attempt + 1 < $maxAttempts) {
                    $attemptCreds = buildBrightProxyCreds($proxyBaseCreds, true);
                    $usedProxyRotation = true;
                    $proxyIpAfter = getProxyExitIp($proxyHost, $proxyPort, $attemptCreds);
                    continue;
                }
                continue 2; // sonraki base
            }
            $tDecodeStart = microtime(true);
            $json = json_decode($resp, true);
            $jsonErr = json_last_error();
            // Bazı durumlarda TKGM gövdeyi string içinde JSON olarak dönebiliyor (double-encoded)
            if (!is_array($json) && is_string($json) && strlen($json) > 0 && $json[0] === '{') {
                $jsonDecoded = json_decode($json, true);
                if (is_array($jsonDecoded)) {
                    $json = $jsonDecoded;
                    $jsonErr = json_last_error();
                }
            }
            // UTF sorunları için fallback decode denemesi
            if (!is_array($json) && is_string($resp)) {
                $respUtf = @iconv('ISO-8859-9', 'UTF-8//IGNORE', $resp);
                if ($respUtf !== false) {
                    $jsonUtf = json_decode($respUtf, true);
                    if (is_array($jsonUtf)) {
                        $json = $jsonUtf;
                        $jsonErr = json_last_error();
                    }
                }
            }
            $decodeMs = round((microtime(true) - $tDecodeStart) * 1000, 2);
            if ($httpCode == 429 || $httpCode == 403) {
                $lastError = $json['message'] ?? ('HTTP ' . $httpCode . ' ' . $err);
                if ($attempt + 1 < $maxAttempts) {
                    $attemptCreds = buildBrightProxyCreds($proxyBaseCreds, true);
                    $usedProxyRotation = true;
                    $proxyIpAfter = getProxyExitIp($proxyHost, $proxyPort, $attemptCreds);
                    continue; // aynı base için yeni IP ile dene
                }
                continue 2; // diğer base'e geç
            }
            // TKGM bazen {status:200,data:{...}} döner, bazen doğrudan GeoJSON Feature
            // TKGM bazen geometry=null döndürebiliyor; type+properties varsa Feature olarak kabul et
            $isFeature = is_array($json) && isset($json['type']) && isset($json['properties']);
            // geometry yoksa ve gittigiParselListe tek Feature ise, geometry'yi oradan doldur
            if ($isFeature && (!isset($json['geometry']) || $json['geometry'] === null) && isset($json['properties']['gittigiParselListe'])) {
                $glistRaw = $json['properties']['gittigiParselListe'];
                $glist = is_string($glistRaw) ? json_decode($glistRaw, true) : (is_array($glistRaw) ? $glistRaw : null);
                if ($glist && isset($glist['features']) && is_array($glist['features']) && count($glist['features']) === 1) {
                    $json['geometry'] = $glist['features'][0]['geometry'] ?? $json['geometry'];
                    // Eğer ana properties boşsa ve alt properties doluysa bazı alanları yukarı kopyala
                    if (empty($json['properties']['adaNo']) && isset($glist['features'][0]['properties']['adaNo'])) {
                        $json['properties'] = array_merge($json['properties'], $glist['features'][0]['properties']);
                    }
                }
            }
            $isFeatureCollection = is_array($json) && isset($json['type']) && $json['type'] === 'FeatureCollection' && isset($json['features']);
            if (isset($json['status']) && $json['status'] == 200 && isset($json['data'])) {
                header('Content-Type: application/json; charset=utf-8');
                $respPayload = [
                    'success' => true,
                    'data' => $json['data'],
                    'proxy_rotated' => $usedProxyRotation ? 1 : 0,
                    'proxy_used' => $lastProxyUsed,
                    'proxy_ip_before' => $proxyIpBefore,
                    'proxy_ip_after' => $proxyIpAfter,
                    'timings' => [
                        'total_ms' => round((microtime(true) - $t0) * 1000, 2),
                        'curl_ms' => $curlTotalMs,
                        'decode_ms' => $decodeMs,
                        'proxy_ip_before_ms' => $proxyIpBeforeMs,
                        'proxy_ip_after_ms' => $proxyIpAfterMs
                    ],
                ];
                if ($proxyDebug) {
                    $respPayload['proxy_trace'] = $proxyTrace;
                }
                echo json_encode($respPayload);
                exit;
            } elseif ($isFeature || $isFeatureCollection) {
                header('Content-Type: application/json; charset=utf-8');
                $respPayload = [
                    'success' => true,
                    'data' => $json,
                    'proxy_rotated' => $usedProxyRotation ? 1 : 0,
                    'proxy_used' => $lastProxyUsed,
                    'proxy_ip_before' => $proxyIpBefore,
                    'proxy_ip_after' => $proxyIpAfter,
                    'timings' => [
                        'total_ms' => round((microtime(true) - $t0) * 1000, 2),
                        'curl_ms' => $curlTotalMs,
                        'decode_ms' => $decodeMs,
                        'proxy_ip_before_ms' => $proxyIpBeforeMs,
                        'proxy_ip_after_ms' => $proxyIpAfterMs
                    ],
                ];
                if ($proxyDebug) {
                    $respPayload['proxy_trace'] = $proxyTrace;
                }
                echo json_encode($respPayload);
                exit;
            }
            $lastError = $json['message'] ?? ('HTTP ' . $httpCode . ' ' . $err . ($jsonErr !== JSON_ERROR_NONE ? (' json_error=' . json_last_error_msg()) : ''));
            // Başarısız ama rotate denemesi varsa ve bu ilk denemeyse, tekrar dene
            if (($httpCode >= 500 || $jsonErr !== JSON_ERROR_NONE) && $attempt + 1 < $maxAttempts) {
                $attemptCreds = buildBrightProxyCreds($proxyBaseCreds, true);
                continue;
            }
            // mevcut base için denemeler bitti
            break;
        }
    }

    // 502 yerine 200 + detaylı hata dön, frontend fetch başarısız olmasın
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    $debugInfo = [
        'http_code' => $lastHttp,
        'curl_error' => $lastErr,
        'body' => $lastBody,
        'proxy_rotated' => $usedProxyRotation ? 1 : 0,
        'timings' => [
            'total_ms' => round((microtime(true) - $t0) * 1000, 2),
            'proxy_ip_before_ms' => $proxyIpBeforeMs,
            'proxy_ip_after_ms' => $proxyIpAfterMs
        ]
    ];
    if ($proxyDebug) {
        $debugInfo['proxy_trace'] = $proxyTrace;
    }
    if (isset($jsonErr)) {
        $debugInfo['json_error'] = json_last_error_msg();
    }
    if (isset($json)) {
        $debugInfo['parsed_type'] = is_array($json) ? ($json['type'] ?? null) : gettype($json);
        $debugInfo['is_feature'] = isset($isFeature) ? ($isFeature ? 1 : 0) : 0;
        $debugInfo['is_feature_collection'] = isset($isFeatureCollection) ? ($isFeatureCollection ? 1 : 0) : 0;
    }
    echo json_encode([
        'success' => false,
        'message' => $lastError,
        'debug' => $debugInfo
    ]);
    exit;
}

// Benzersiz tapu ID üret (auto increment yoksa)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'generate_tapu_id') {
    $newId = generateUniqueTapuId($conn);
    header('Content-Type: application/json; charset=utf-8');
    if ($newId === null) {
        echo json_encode(['success' => false, 'message' => 'ID üretilemedi']);
    } else {
        echo json_encode(['success' => true, 'id' => $newId]);
    }
    exit;
}

// Genel debug kontrolü – sadece gerektiğinde detaylı log üret
function isDebugEnabled(): bool
{
    static $debug = null;

    if ($debug !== null) {
        return $debug;
    }

    $debug = false;

    if (getenv('APP_DEBUG') === '1') {
        $debug = true;
    }

    if (isset($_GET['debug']) && $_GET['debug'] === '1') {
        $debug = true;
    }

    if (isset($_POST['debug']) && $_POST['debug'] === '1') {
        $debug = true;
    }

    return $debug;
}

// Tablo-kolon varlık kontrolü
function tableHasColumn(mysqli $conn, string $table, string $column, bool $useCache = true): bool
{
    static $cache = [];
    $key = $table . '|' . $column;
    if ($useCache && array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $conn->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1");
    if (!$stmt) {
        $cache[$key] = false;
        return false;
    }
    $stmt->bind_param('ss', $table, $column);
    if (!$stmt->execute()) {
        $stmt->close();
        $cache[$key] = false;
        return false;
    }
    $stmt->bind_result($count);
    $stmt->fetch();
    $stmt->close();
    $cache[$key] = ($count > 0);
    return $cache[$key];
}

// Log fonksiyonunu tanımlama
function logRequestAndResponse($request, $response, $sql = null, $params = null) {
    $logData = "Request: " . json_encode($request) . "\n";
    if ($sql) {
        $logData .= "SQL Query: " . $sql . "\n";
        if ($params) {
            $logData .= "SQL Params: " . json_encode($params) . "\n";
        }
    }
    $logData .= "Response: " . json_encode($response) . "\n---\n";
    $logFile = __DIR__ . '/api_log.txt';
    file_put_contents($logFile, $logData, FILE_APPEND);
}

// Taşınmaz aksiyonları (Teknik Analiz / 3D / TKGM) için tabloyu oluştur
function ensure_parcel_actions_table(mysqli $conn): void
{
    $sql = "
        CREATE TABLE IF NOT EXISTS parcel_actions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            parcel_id INT NOT NULL,
            tapusor TINYINT(1) NOT NULL DEFAULT 0,
            earth TINYINT(1) NOT NULL DEFAULT 0,
            tkgm TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uidx_user_parcel (username, parcel_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    // Hata olursa sadece logla, normal akışı bozma
    if (!$conn->query($sql)) {
        error_log("❌ parcel_actions tablo oluşturma hatası: " . $conn->error);
    }
}

// Başvurular tablosunun varlığını garanti altına al
function ensure_basvurular_table(mysqli $conn): void
{
    $sql = "
        CREATE TABLE IF NOT EXISTS basvurular (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prolegal_id INT NOT NULL,
            basvuru_turu VARCHAR(50) DEFAULT NULL,
            basvuru_sayısı INT DEFAULT 0,
            basvurulan_firma VARCHAR(255) DEFAULT NULL,
            basvuru_tarihi DATE DEFAULT NULL,
            konu TEXT DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uidx_prolegal (prolegal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    if (!$conn->query($sql)) {
        error_log("❌ basvurular tablo oluşturma hatası: " . $conn->error);
    }
}

function normalizeTurkishChars($string) {
    $turkish = array('Ç', 'ç', 'Ğ', 'ğ', 'İ', 'ı', 'Ö', 'ö', 'Ş', 'ş', 'Ü', 'ü');
    $latin = array('C', 'c', 'G', 'g', 'I', 'i', 'O', 'o', 'S', 's', 'U', 'u');
    return str_replace($turkish, $latin, $string);
}

function fetchTasinmazDetayData($conn, $il = null, $ilce = null, $mahalle = null, $ada = null, $parsel = null, $nitelik = null, $araziMin = null, $araziMax = null, $turSecimi = null, $hisseDurumu = null, $sorgulamaDurumu = null) {
    if (isDebugEnabled()) {
        error_log("🔍 fetchTasinmazDetayData çağrıldı");
        error_log("📊 Gelen parametreler: il=$il, ilce=$ilce, mahalle=$mahalle, ada=$ada, parsel=$parsel");
    }
    
    $where_clauses = [];
    $params = [];
    $types = '';

    // Eğer hiçbir kriter seçilmemişse, tüm taşınmaz detaylarını getir
    $hasAnyCriteria = false;

    if ($il !== null && $il !== '') {
        $where_clauses[] = "tm.il_id = ?";
        $params[] = $il;
        $types .= 's';
        $hasAnyCriteria = true;
    }

    if ($ilce !== null && $ilce !== "") {
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
        $hasAnyCriteria = true;
    }

    if ($mahalle !== null && $mahalle !== "") {
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        $where_clauses[] = "mahalle_id IN ($placeholders)";
        foreach ($mahalleArray as $mahalleItem) {
            $params[] = trim($mahalleItem);
            $types .= 'i';
        }
        $hasAnyCriteria = true;
    }

    if ($ada !== null && $ada !== 0 && $ada !== '') {
        $where_clauses[] = "AdaBilgisi = ?";
        $params[] = $ada;
        $types .= 'i';
        $hasAnyCriteria = true;
    }

    if ($parsel !== null && $parsel !== 0 && $parsel !== '') {
        $where_clauses[] = "ParselBilgisi = ?";
        $params[] = $parsel;
        $types .= 'i';
        $hasAnyCriteria = true;
    }

    if ($nitelik !== null && $nitelik !== '') {
        $where_clauses[] = "AnaTasinmazNitelik_1 LIKE ?";
        $params[] = "%$nitelik%";
        $types .= 's';
        $hasAnyCriteria = true;
    }

    // Arazi büyüklüğü min-max filtreleme
    if (($araziMin !== null && $araziMin !== '') || ($araziMax !== null && $araziMax !== '')) {
        $araziFilter = '';
        
        if ($araziMin !== null && $araziMin !== '') {
            $araziFilter .= 'YuzolcumBilgisi/1000 >= ?';
            $params[] = $araziMin;
            $types .= 'd'; // double
        }
        
        if ($araziMax !== null && $araziMax !== '') {
            if (!empty($araziFilter)) {
                $araziFilter .= ' AND ';
            }
            $araziFilter .= 'YuzolcumBilgisi/1000 <= ?';
            $params[] = $araziMax;
            $types .= 'd'; // double
        }
        
        if (!empty($araziFilter)) {
            $where_clauses[] = '(' . $araziFilter . ')';
            $hasAnyCriteria = true;
        }
    }

    if ($turSecimi !== null && $turSecimi !== '') {
        if ($turSecimi === '0') {
            // Uygun Araziler: AnaTasinmazNitelik_2 = 'arazi'
            $where_clauses[] = "tm.AnaTasinmazNitelik_2 = 'arazi'";
        } elseif ($turSecimi === '1') {
            // Diğer Araziler: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'arazi'
            $where_clauses[] = "tm.AnaTasinmazNitelik_2 = 'diğer' AND tm.AnaTasinmazNitelik_2_yedek = 'arazi'";
        } elseif ($turSecimi === '2') {
            // Arazi Dışı: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'diğer'
            $where_clauses[] = "tm.AnaTasinmazNitelik_2 = 'diğer' AND tm.AnaTasinmazNitelik_2_yedek = 'diğer'";
        }
        // turSecimi === '3' veya başka değerler için filtre uygulanmaz (Hepsi seçeneği)
        $hasAnyCriteria = true;
    }

    if ($hisseDurumu !== null && $hisseDurumu !== '') {
        if ($hisseDurumu === '0') {
            $where_clauses[] = "Hisse = 1";
        } elseif ($hisseDurumu === '1') {
            $where_clauses[] = "Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1";
        }
        $hasAnyCriteria = true;
    }

    if ($sorgulamaDurumu !== null && $sorgulamaDurumu !== 'Hepsi' && $sorgulamaDurumu !== '') {
        $where_clauses[] = "tm.Durum = ?";
        $params[] = $sorgulamaDurumu;
        $types .= 's';
        $hasAnyCriteria = true;
    }

    // Eğer hiçbir kriter seçilmemişse, tüm taşınmaz detayları yap
    if (!$hasAnyCriteria) {
        $sql = "SELECT DISTINCT AnaTasinmazNitelik_1 as value, AnaTasinmazNitelik_1 as label FROM tapu_maliye WHERE polygon IS NOT NULL AND AnaTasinmazNitelik_1 IS NOT NULL AND AnaTasinmazNitelik_1 != ''";
    } else {
        $where_clauses[] = "polygon IS NOT NULL"; // Geçerli verilerin seçilmesi için
        $where_clause = implode(" AND ", $where_clauses);
        $sql = "SELECT DISTINCT AnaTasinmazNitelik_1 as value, AnaTasinmazNitelik_1 as label FROM tapu_maliye WHERE " . $where_clause;
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        die("Prepare statement failed: " . $conn->error);
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        die("Execute failed: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $data = [];
    $total_rows = 0;
    $valid_rows = 0;
    
    while ($row = $result->fetch_assoc()) {
        $total_rows++;
        if (!empty($row['value']) && !empty($row['label'])) {
            $data[] = $row;
            $valid_rows++;
        }
    }

    if (isDebugEnabled()) {
        error_log("📦 Toplam satır: " . $total_rows);
        error_log("📦 Geçerli satır: " . $valid_rows);
        error_log("📦 Dönen veri sayısı: " . count($data));
        error_log("📋 İlk 3 veri: " . json_encode(array_slice($data, 0, 3)));
        error_log("🔍 SQL sorgusu: " . $sql);
        error_log("🔍 Parametreler: " . json_encode($params));
        error_log("🔍 Types: " . $types);
    }

    return $data;
}

function getParcelData($conn, $prolegalId = null, $il = null, $ilce = null, $mahalle = null, $ada = null, $parsel = null, $mahalle_id = null, $nitelik = null, $tasinmazDetay = null, $araziMin = null, $araziMax = null, $imarFonksiyonu = null, $turSecimi = null, $hisseDurumu = null, $durum = null, $sorguDurumu = null, $sorgulama_durumu = null, $basvuruDurumu = null, $notRating = null, $anaFonksiyonId = null, $altFonksiyonId = null, $ne_lat = null, $ne_lng = null, $sw_lat = null, $sw_lng = null, $imarSwitchActive = 'false', $imarAllFunctions = 'false')
{
    $where_clauses = [];
    $params = [];
    $types = '';

$il = isset($il) ? $il : null;
$ilce = isset($ilce) ? urldecode($ilce) : null;
$mahalle = isset($mahalle) ? urldecode($mahalle) : null;
$nitelik = isset($nitelik) ? urldecode($nitelik) : null;
$tasinmazDetay = isset($tasinmazDetay) ? urldecode($tasinmazDetay) : null;
    $araziBuyuklugu = isset($araziBuyuklugu) ? urldecode($araziBuyuklugu) : null; // var olmayan param için sadece korunmuş
$imarFonksiyonu = isset($imarFonksiyonu) ? urldecode($imarFonksiyonu) : null;
$turSecimi = isset($turSecimi) ? urldecode($turSecimi) : null;
$hisseDurumu = isset($hisseDurumu) ? urldecode($hisseDurumu) : null;
$sorguDurumu = isset($sorguDurumu) ? urldecode($sorguDurumu) : null;
$sorgulama_durumu = isset($sorgulama_durumu) ? urldecode($sorgulama_durumu) : null;
$basvuruDurumu = isset($basvuruDurumu) ? urldecode($basvuruDurumu) : null;
    $notRating = isset($notRating) ? urldecode($notRating) : null;
    $anaFonksiyonId = isset($anaFonksiyonId) ? urldecode($anaFonksiyonId) : null;
    $altFonksiyonId = isset($altFonksiyonId) ? urldecode($altFonksiyonId) : null;
   
    // Harita sınırlarına göre parsel sorgulaması
    // Not: Liste tablosundaki "Sorgu Durumu" kolonunun da dolabilmesi için
    // burada da sorgudurumu ve basvurular tablolarına LEFT JOIN ekliyoruz.
    if ($ne_lat !== null && $ne_lng !== null && $sw_lat !== null && $sw_lng !== null) {
        $isFiltresiz = isset($_GET['filtresiz']) && in_array(strtolower($_GET['filtresiz']), ['1', 'true'], true);
        $polygon = "POLYGON(($sw_lng $sw_lat, $ne_lng $sw_lat, $ne_lng $ne_lat, $sw_lng $ne_lat, $sw_lng $sw_lat))";
        
        $sql = "SELECT 
                    tm.*, 
                    ST_AsText(tm.polygon) as polygon_text, 
                    tm.prolegal_not, 
                    tm.not_rating, 
                    tm.AnaTasinmazNitelik_1,
                    s.sorgulama_durumu,
                    b.basvuru_turu,
                    b.basvuru_sayısı,
                    b.basvurulan_firma
                FROM tapu_maliye tm
                LEFT JOIN sorgudurumu s ON tm.Id = s.prolegal_id
                LEFT JOIN basvurular b ON tm.Id = b.prolegal_id
                WHERE tm.polygon IS NOT NULL 
                  AND ST_Intersects(tm.polygon, ST_GeomFromText(?))
                  AND tm.Hisse = 1";
        
        if (!$isFiltresiz) {
            $sql .= " AND tm.AnaTasinmazNitelik_2 = 'arazi'";
        }

        $stmt = $conn->prepare($sql);
        if (!$stmt) { die("Prepare statement failed: " . $conn->error); }

        $stmt->bind_param('s', $polygon);
        if (!$stmt->execute()) { die("Execute failed: " . $stmt->error); }

        $result = $stmt->get_result();
        $data = [];
        while ($row = $result->fetch_assoc()) {
            if (isDebugEnabled()) {
                error_log("DEBUG: AnaTasinmazNitelik_1 değeri: " . ($row['AnaTasinmazNitelik_1'] ?? 'NULL'));
            }
            $data[] = $row;
        }
        if (isDebugEnabled()) {
            error_log("DEBUG: Toplam " . count($data) . " kayıt döndürülüyor");
        }
        return $data;
    }

     // Prolegal Taşınmaz No sorgulama
    if ($prolegalId !== null) {
        $where_clauses[] = "tm.Id = ?";
        $params[] = $prolegalId;
        $types .= 'i';

        $sql = "SELECT tm.Id, tm.İlBilgisi, tm.İlceBilgisi, tm.MahalleBilgisi, tm.AdaBilgisi, tm.ParselBilgisi, 
                       tm.YuzolcumBilgisi, tm.AnaTasinmazNitelik, tm.Hisse, tm.mahalle_id, tm.il_id, tm.ilce_id, 
                       tm.polygon, tm.AnaTasinmazNitelik_1, tm.Durum, tm.prolegal_not, tm.not_rating,
                       ST_AsText(tm.polygon) as polygon_text,
                       s.sorgulama_durumu,
                       b.basvuru_turu, b.basvuru_sayısı, b.basvurulan_firma,
                       vf.ana_fonksiyon_ad,
                       vf.alt_fonksiyon_ad,
                       vf.ana_fonksiyon_id,
                       vf.alt_fonksiyon_id
                FROM tapu_maliye tm
                LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id
                LEFT JOIN basvurular b ON tm.id = b.prolegal_id
                LEFT JOIN vw_imar_filtre vf ON tm.id = vf.tapu_id AND vf.is_current = 1
                WHERE " . implode(" AND ", $where_clauses);
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) { die("Prepare statement failed: " . $conn->error); }
        if (!empty($params)) { $stmt->bind_param($types, ...$params); }
        if (!$stmt->execute()) { die("Execute failed: " . $stmt->error); }
        $result = $stmt->get_result();
        $data = [];
        while ($row = $result->fetch_assoc()) {
            if (isDebugEnabled()) {
                // Debug: prolegal_not ve not_rating alanlarını logla
                error_log("API DEBUG - Row data: prolegal_not=" . ($row['prolegal_not'] ?? 'NULL') . ", not_rating=" . ($row['not_rating'] ?? 'NULL'));
            }
            
            // NULL değerleri boş string olarak ayarla
            $row['prolegal_not'] = $row['prolegal_not'] ?? '';
            // not_rating NULL ise 0 (Seçiniz) olarak gönder
            $row['not_rating'] = $row['not_rating'] ?? 0;
            
            $data[] = $row;
        }
        return $data;
    }
    
    if ($il !== null) {
        $where_clauses[] = "tm.il_id = ?";
            $params[] = $il;
            $types .= 's';
    }
    // İlçe için çoklu seçim desteği
    if ($ilce !== null && $ilce !== "") {
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "tm.ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
    }

    // Mahalle ID'leri
    if ($mahalle !== null && $mahalle !== "") {
        $mahalle = urldecode($mahalle);
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        // 👇 HATA DÜZELTİLDİ: mahelle_id → mahalle_id
        $where_clauses[] = "tm.mahalle_id IN ($placeholders)";
            foreach ($mahalleArray as $mahalleItem) {
                $params[] = trim($mahalleItem);
            $types .= 'i';
        }
    }
    if ($ada !== null && $ada > 0) {
        $where_clauses[] = "AdaBilgisi = ?";
        $params[] = $ada;
        $types .= 'i';
        error_log("🔍 [DEBUG] Ada koşulu eklendi: AdaBilgisi = $ada");
    }
    if ($parsel !== null && $parsel > 0) {
        $where_clauses[] = "ParselBilgisi = ?";
        $params[] = $parsel;
        $types .= 'i';
        error_log("🔍 [DEBUG] Parsel koşulu eklendi: ParselBilgisi = $parsel");
    }
    if ($nitelik !== null  or $nitelik !== '') {
        $where_clauses[] = "AnaTasinmazNitelik_1 LIKE ?";
        $params[] = "%$nitelik%";
        $types .= 's';
    }

    if ($tasinmazDetay !== null && $tasinmazDetay !== '') {
        $tasinmazDetayArray = explode(',', $tasinmazDetay);
        // Boş string'leri filtrele
        $tasinmazDetayArray = array_filter($tasinmazDetayArray, function($item) {
            return trim($item) !== '';
        });
        
        if (!empty($tasinmazDetayArray)) {
            $placeholders = implode(',', array_fill(0, count($tasinmazDetayArray), '?'));
            $where_clauses[] = "AnaTasinmazNitelik_1 IN ($placeholders)";
            foreach ($tasinmazDetayArray as $detay) {
                $params[] = trim($detay);
                $types .= 's';
            }
            error_log("🔍 [DEBUG] Taşınmaz detay koşulu eklendi: AnaTasinmazNitelik_1 IN (" . implode(',', $tasinmazDetayArray) . ")");
        }
    }

    // ESKİ İMAR FONKSİYON SİSTEMİ KALDIRILDI - YENİ SİSTEM KULLANILIYOR

    // ✅ İMAR SWITCH DURUMUNA GÖRE SORGU MANTIĞI
    if ($imarSwitchActive === 'true') {
        error_log("🔍 [DEBUG] İmar switch açık - hem tapu_maliye hem de imar view sorgusu yapılacak");
        
        // Eğer tüm imar fonksiyonları için sorgu yapılacaksa
        if ($imarAllFunctions === 'true') {
            error_log("🔍 [DEBUG] Tüm imar fonksiyonları için sorgu yapılacak");
            $where_clauses[] = "tm.Id IN (SELECT DISTINCT tapu_id FROM vw_imar_filtre WHERE is_current = 1)";
        } else {
            // İmar fonksiyonları filtresi - sadece switch açıkken uygula
            if ($anaFonksiyonId !== null && $anaFonksiyonId !== '') {
                $anaFonksiyonArray = explode(',', $anaFonksiyonId);
                $placeholders = implode(',', array_fill(0, count($anaFonksiyonArray), '?'));
                $where_clauses[] = "tm.Id IN (SELECT DISTINCT tapu_id FROM vw_imar_filtre WHERE ana_fonksiyon_id IN ($placeholders) AND is_current = 1)";
                foreach ($anaFonksiyonArray as $anaFonksiyon) {
                    $params[] = intval(trim($anaFonksiyon));
                    $types .= 'i';
                }
                error_log("🔍 [DEBUG] Ana fonksiyon filtresi uygulandı: " . $anaFonksiyonId);
            }

            if ($altFonksiyonId !== null && $altFonksiyonId !== '') {
                $altFonksiyonArray = explode(',', $altFonksiyonId);
                $placeholders = implode(',', array_fill(0, count($altFonksiyonArray), '?'));
                $where_clauses[] = "tm.Id IN (SELECT DISTINCT tapu_id FROM vw_imar_filtre WHERE alt_fonksiyon_id IN ($placeholders) AND is_current = 1)";
                foreach ($altFonksiyonArray as $altFonksiyon) {
                    $params[] = intval(trim($altFonksiyon));
                    $types .= 'i';
                }
                error_log("🔍 [DEBUG] Alt fonksiyon filtresi uygulandı: " . $altFonksiyonId);
            }
        }
    } else {
        error_log("🔍 [DEBUG] İmar switch kapalı - sadece tapu_maliye sorgusu yapılacak, imar filtreleri uygulanmayacak");
        // İmar switch kapalıyken imar fonksiyon filtrelerini uygulama
    }

    // Tür Seçimi
    if ($turSecimi === '0') {
        // Uygun Araziler: AnaTasinmazNitelik_2 = 'arazi'
        $where_clauses[] = "tm.AnaTasinmazNitelik_2 = ?";
        $params[] = 'arazi';
        $types .= 's';
        error_log("🔍 Tür Seçimi filtresi uygulandı: Uygun Araziler");
    } elseif ($turSecimi === '1') {
        // Diğer Araziler: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'arazi'
        $where_clauses[] = "tm.AnaTasinmazNitelik_2 = ? AND tm.AnaTasinmazNitelik_2_yedek = ?";
        $params[] = 'diğer';
        $params[] = 'arazi';
        $types .= 'ss';
        error_log("🔍 Tür Seçimi filtresi uygulandı: Diğer Araziler");
    } elseif ($turSecimi === '2') {
        // Arazi Dışı: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'diğer'
        $where_clauses[] = "tm.AnaTasinmazNitelik_2 = ? AND tm.AnaTasinmazNitelik_2_yedek = ?";
        $params[] = 'diğer';
        $params[] = 'diğer';
        $types .= 'ss';
        error_log("🔍 Tür Seçimi filtresi uygulandı: Arazi Dışı");
    }
    // turSecimi === '3' veya başka değerler için filtre uygulanmaz (Hepsi seçeneği)

    // Hisse durumu
    if ($hisseDurumu === '0') {
        $where_clauses[] = "Hisse = 1";
        error_log("🔍 Hisse filtresi uygulandı: (Hisse = 1) - Sadece %100 tam hisse");
    } elseif($hisseDurumu === '1')  {
        $where_clauses[] = "Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1";
        error_log("🔍 Hisse filtresi uygulandı: (Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1) - Hisseli");
    }

    // DURUM / BAŞVURU / SORGU - Eski sistem kaldırıldı, yeni filtreleme sistemi kullanılıyor
    
    
    // Filtreleri kategorilere göre grupla ve her kategoriyi ayrı ayrı işle
    $filterCategories = [
        'sorguDurumu' => [],
        'sorgulamaDurumu' => [],
        'basvuruDurumu' => [],
        'uygunlukDurumu' => [],
        'notRating' => []
    ];
    
    // Sorgu durumu filtresi (tm.Durum tablosundan - Sorgulanmadı, Uygun değil vb.)
    if ($sorguDurumu !== null && $sorguDurumu !== '' && $sorguDurumu !== 'Hepsi') {
        $sorguArray = explode(',', $sorguDurumu);
        foreach ($sorguArray as $sorgu) {
            $sorgu = trim($sorgu);
            // Sırada, Sorguda, Sorgulandı sorgudurumu tablosundan gelir
            if (in_array($sorgu, ['Sırada', 'Sorguda', 'Sorgulandı'])) {
                $filterCategories['sorgulamaDurumu'][] = "s.sorgulama_durumu = ?";
                $params[] = $sorgu;
                $types .= 's';
            } else {
                // Diğerleri tapu_maliye tablosundan gelir
                $filterCategories['sorguDurumu'][] = "tm.Durum = ?";
                $params[] = $sorgu;
                $types .= 's';
            }
        }
    }
    
    // Sorgulama durumu filtresi (sorgudurumu tablosundan)
    if ($sorgulama_durumu !== null && $sorgulama_durumu !== '' && $sorgulama_durumu !== 'Hepsi') {
        $sorgulamaArray = explode(',', $sorgulama_durumu);
        foreach ($sorgulamaArray as $sorgulama) {
            $sorgulama = trim($sorgulama);
            if ($sorgulama === 'Sorguda') {
                $filterCategories['sorgulamaDurumu'][] = "s.sorgulama_durumu = 'Sorguda'";
            } elseif ($sorgulama === 'Sırada') {
                $filterCategories['sorgulamaDurumu'][] = "s.sorgulama_durumu = 'Sırada'";
            } elseif ($sorgulama === 'Sorgulanmadı') {
                $filterCategories['sorgulamaDurumu'][] = "tm.Durum = 'Sorgulanmadı'";
            }
        }
    }
    
    // Başvuru durumu filtresi
    if ($basvuruDurumu !== null && $basvuruDurumu !== '' && $basvuruDurumu !== 'Hepsi') {
        $basvuruArray = explode(',', $basvuruDurumu);
        foreach ($basvuruArray as $basvuru) {
            $basvuru = trim($basvuru);
            if ($basvuru === 'Küçük') {
                $filterCategories['basvuruDurumu'][] = "b.basvuru_turu = 'Küçük'";
            } elseif ($basvuru === 'Büyük') {
                $filterCategories['basvuruDurumu'][] = "b.basvuru_turu = 'Büyük'";
            }
        }
    }
    
    // Uygunluk durumu filtresi
    if ($durum !== null && $durum !== '' && $durum !== 'Hepsi') {
        $durumArray = explode(',', $durum);
        $hasUygun = false;
        $hasBasvurusuYapilmamisUygun = false;
        
        foreach ($durumArray as $durumItem) {
            $durumItem = trim($durumItem);
            if ($durumItem === 'Uygun') {
                $hasUygun = true;
            } elseif ($durumItem === 'Başvurusu yapılmamış uygunlar' || $durumItem === 'UYGUN_BASVURU_NULL') {
                $hasBasvurusuYapilmamisUygun = true;
            } elseif ($durumItem === 'Uygun değil') {
                $filterCategories['uygunlukDurumu'][] = "tm.Durum = 'Uygun değil'";
            } elseif ($durumItem === 'Sorgulanmadı') {
                $filterCategories['uygunlukDurumu'][] = "tm.Durum = 'Sorgulanmadı'";
            }
        }
        
        // Özel durum: Uygun ve Başvurusu yapılmamış uygunlar aynı anda seçildiğinde
        if ($hasUygun && $hasBasvurusuYapilmamisUygun) {
            $filterCategories['uygunlukDurumu'][] = "tm.Durum = 'Uygun'";
        } elseif ($hasUygun) {
            $filterCategories['uygunlukDurumu'][] = "tm.Durum = 'Uygun'";
        } elseif ($hasBasvurusuYapilmamisUygun) {
            $filterCategories['uygunlukDurumu'][] = "(tm.Durum = 'Uygun' AND (b.basvuru_turu IS NULL OR b.basvuru_turu = ''))";
        }
    }
    
    // Not Rating filtresi
    if ($notRating !== null && $notRating !== '' && $notRating !== 'Hepsi') {
        $notRatingArray = explode(',', $notRating);
        foreach ($notRatingArray as $rating) {
            $rating = trim($rating);
            $filterCategories['notRating'][] = "tm.not_rating = ?";
            $params[] = $rating;
            $types .= 'i';
        }
    }
    
    // Tüm filtreleri tek bir OR koşulu olarak birleştir
    $allConditions = [];
    foreach ($filterCategories as $categoryName => $conditions) {
        if (!empty($conditions)) {
            foreach ($conditions as $condition) {
                $allConditions[] = $condition;
            }
            error_log("🔍 [DEBUG] $categoryName filtresi eklendi: " . implode(' OR ', $conditions));
        }
    }
    
    // Tüm koşulları OR ile birleştir
    if (!empty($allConditions)) {
        $where_clauses[] = "(" . implode(' OR ', $allConditions) . ")";
        error_log("🔍 [DEBUG] Tüm filtreler OR ile birleştirildi: " . implode(' OR ', $allConditions));
    }
    
    // Debug: Final SQL sorgusunu logla
    error_log("🔍 [DEBUG] Final WHERE koşulları: " . implode(' AND ', $where_clauses));
    error_log("🔍 [DEBUG] Final parametreler: " . implode(', ', $params));
    error_log("🔍 [DEBUG] Final types: $types");

    // Arazi büyüklüğü
    if (($araziMin !== null && $araziMin !== '') || ($araziMax !== null && $araziMax !== '')) {
        $araziFilter = '';
        if ($araziMin !== null && $araziMin !== '') {
            $araziFilter .= 'YuzolcumBilgisi/1000 >= ?';
            $params[] = $araziMin;
            $types .= 'd';
        }
        if ($araziMax !== null && $araziMax !== '') {
            if (!empty($araziFilter)) { $araziFilter .= ' AND '; }
            $araziFilter .= 'YuzolcumBilgisi/1000 <= ?';
            $params[] = $araziMax;
            $types .= 'd';
        }
        if (!empty($araziFilter)) { $where_clauses[] = '(' . $araziFilter . ')'; }
    }

    // Polygon kontrolü
    $where_clauses[] = "polygon IS NOT NULL";

    // WHERE içindeki kolonlara tm. öneki (polygon hariç gerekli yerler)
        $fixed_where_clauses = [];
        foreach ($where_clauses as $clause) {
            if (strpos($clause, 'polygon') !== false) {
                $clause = str_replace('polygon', 'tm.polygon', $clause);
            }
            if (strpos($clause, 'tm.') === false && strpos($clause, 'b.') === false) {
            $clause = preg_replace('/\b(Durum|İlBilgisi|İlceBilgisi|MahalleBilgisi|Ada|Parsel|Nitelik|id|YuzolcumBilgisi|Hisse|fonksiyon)\b/u', 'tm.$1', $clause);
            }
            $fixed_where_clauses[] = $clause;
        }
        $where_clause = implode(" AND ", $fixed_where_clauses);
        
    // ✅ İmar switch durumuna göre SQL sorgusu oluştur
    if ($imarSwitchActive === 'true') {
        error_log("🔍 [DEBUG] İmar switch açık - imar view JOIN'i dahil ediliyor");
        $sql = "SELECT tm.*, ST_AsText(tm.polygon) as polygon_text, 
                       b.basvuru_sayısı, b.basvurulan_firma, b.basvuru_turu,
                       tm.Durum as tapu_durum,
                       s.sorgulama_durumu,
                       tm.prolegal_not,
                       tm.not_rating,
                       vf.ana_fonksiyon_ad,
                       vf.alt_fonksiyon_ad,
                       vf.ana_fonksiyon_id,
                       vf.alt_fonksiyon_id
            FROM tapu_maliye tm
                LEFT JOIN basvurular b ON tm.id = b.prolegal_id
                    LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id
                    LEFT JOIN vw_imar_filtre vf ON tm.id = vf.tapu_id AND vf.is_current = 1";
    } else {
        error_log("🔍 [DEBUG] İmar switch kapalı - sadece tapu_maliye sorgusu, imar view JOIN'i yok");
        $sql = "SELECT tm.*, ST_AsText(tm.polygon) as polygon_text,
                       b.basvuru_sayısı, b.basvurulan_firma, b.basvuru_turu,
                       tm.Durum as tapu_durum,
                       s.sorgulama_durumu,
                       tm.prolegal_not,
                       tm.not_rating,
                       NULL as ana_fonksiyon_ad,
                       NULL as alt_fonksiyon_ad,
                       NULL as ana_fonksiyon_id,
                       NULL as alt_fonksiyon_id
                FROM tapu_maliye tm
                    LEFT JOIN basvurular b ON tm.id = b.prolegal_id
                LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id";
    }
    
    if (!empty($where_clause)) {
        $sql .= " WHERE " . $where_clause;
    }

    error_log("🚨 FINAL SQL Query: $sql");
    error_log("🚨 FINAL SQL Params: " . json_encode($params));
    error_log("🚨 WHERE Clauses: " . print_r($where_clauses, true));
    
    if ($durum === 'Uygun değil') {
        error_log("❌ UYGUN OLMAYANLAR SORGUSU: SQL çalıştırılıyor...");
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) { die("Prepare statement failed: " . $conn->error); }

    if (!empty($params)) { $stmt->bind_param($types, ...$params); }

    if (!$stmt->execute()) { die("Execute failed: " . $stmt->error); }

    $fullSql = $sql;
    if (!empty($params)) {
        foreach ($params as $param) {
            $fullSql = preg_replace('/\?/', "'$param'", $fullSql, 1);
        }
    }
    error_log("Full SQL Query: $fullSql");
    logRequestAndResponse($_GET, $fullSql);
    $result = $stmt->get_result();
    $data = [];
    $durum_values = [];
    $basvuru_values = [];
    
    while ($row = $result->fetch_assoc()) {
        if (!empty($row['Durum']) && !in_array($row['Durum'], $durum_values)) { $durum_values[] = $row['Durum']; }
        if (!empty($row['basvuru_turu']) && !in_array($row['basvuru_turu'], $basvuru_values)) { $basvuru_values[] = $row['basvuru_turu']; }
        $data[] = $row;
    }
    if (!empty($durum_values)) { error_log("🎯 VERİTABANINDA BULUNAN DURUM DEĞERLERİ: " . implode(', ', $durum_values)); }
    if (!empty($basvuru_values)) { error_log("📋 VERİTABANINDA BULUNAN BAŞVURU TÜRLERİ: " . implode(', ', $basvuru_values)); }
    
    if ($durum === 'Uygun değil') {
        error_log("❌ UYGUN OLMAYANLAR SONUCU: " . count($data) . " adet kayıt bulundu");
        if (count($data) > 0) {
            error_log("❌ İlk kayıt örneği: ID=" . $data[0]['Id'] . ", Durum=" . $data[0]['Durum']);
        }
    }

    return $data;
}

// ---- Actions / Endpoints ----

// Şirketten taşınmazları kopyalama
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'copy_company_properties') {
    $input = json_decode(file_get_contents('php://input'), true);
    $companyId = intval($input['companyId']);
    $newCompanyName = $input['newCompanyName'];

    $stmt = $conn->prepare("INSERT INTO companies (company_name) VALUES (?)");
    $stmt->bind_param("s", $newCompanyName);
    if ($stmt->execute()) {
        $newCompanyId = $stmt->insert_id;

        $stmt = $conn->prepare("INSERT INTO parcel_company (company_id, parcel_id) SELECT ?, parcel_id FROM parcel_company WHERE company_id = ?");
        $stmt->bind_param("ii", $newCompanyId, $companyId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Properties could not be copied']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Company could not be created']);
    }
    exit;
}

// Şirket güncelleme işlemi
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'update_company') {
    $companyId = intval($_POST['company_id']);
    $companyName = $_POST['company_name'];

    $stmt = $conn->prepare("UPDATE companies SET company_name = ? WHERE id = ?");
    $stmt->bind_param("si", $companyName, $companyId);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Failed to update company']);
    }
    exit;
}

function processPolygon($polygonText) {
    if ($polygonText === null) {
        return null;
    }
    preg_match('/POLYGON\(\((.*?)\)\)/', $polygonText, $matches);
    if (isset($matches[1])) {
        $coords = explode(',', $matches[1]);
        $points = array_map(function($coord) {
            $point = explode(' ', trim($coord));
            return array_map('floatval', $point);
        }, $coords);
        return [$points];
    }
    return null;
}

$input = json_decode(file_get_contents('php://input'), true);

// 'addPropertyToFirm' işlemi
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'addPropertyToFirm') {
    error_log("🚀 addPropertyToFirm - İşlem başladı");
    error_log("🔍 REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
    error_log("🔍 GET action: " . ($_GET['action'] ?? 'YOK'));
    error_log("🔍 Raw input: " . file_get_contents('php://input'));
    
    // Input'u kontrol et
    error_log("🔍 Input decode öncesi: " . json_encode($input));
    
    if (!isset($input['firmId']) || !isset($input['parcelKey'])) {
        error_log("❌ Eksik parametreler - firmId: " . (isset($input['firmId']) ? 'VAR' : 'YOK') . ", parcelKey: " . (isset($input['parcelKey']) ? 'VAR' : 'YOK'));
        echo json_encode(['success' => false, 'message' => 'Eksik parametreler: firmId veya parcelKey bulunamadı.']);
        exit;
    }
    
    $firmId = intval($input['firmId']);
    $parcelKey = intval($input['parcelKey']);

    error_log("🔍 Parametreler alındı - firmId: $firmId (integer), parcelKey: $parcelKey (integer)");
    error_log("🔍 Veritabanı bağlantısı kontrol ediliyor...");
    
    // Veritabanı bağlantısını kontrol et
    if ($conn->connect_error) {
        error_log("❌ Veritabanı bağlantı hatası: " . $conn->connect_error);
        echo json_encode(['success' => false, 'message' => 'Veritabanı bağlantı hatası: ' . $conn->connect_error]);
        exit;
    }
    
    error_log("✅ Veritabanı bağlantısı OK");
    error_log("🔍 SQL hazırlanıyor...");
    
    $stmt = $conn->prepare("INSERT INTO parcel_company (company_id, parcel_id) VALUES (?, ?)");
    
    if (!$stmt) {
        error_log("❌ SQL prepare hatası: " . $conn->error);
        echo json_encode(['success' => false, 'message' => 'SQL prepare hatası: ' . $conn->error]);
        exit;
    }
    
    error_log("✅ SQL prepare OK");
    error_log("🔍 Parametreler bind ediliyor...");
    
    $stmt->bind_param("ii", $firmId, $parcelKey);
    error_log("✅ Parametreler bind edildi");
    error_log("🔍 SQL execute ediliyor...");

    if ($stmt->execute()) {
        // Başarılı olduysa companies tablosuna da ekle
        try {
            // Önce firm_id'ye göre firm_name'i bul
            $firmNameStmt = $conn->prepare("SELECT firm_name FROM firms WHERE firm_id = ?");
            if ($firmNameStmt) {
                $firmNameStmt->bind_param("i", $firmId);
                $firmNameStmt->execute();
                $firmNameResult = $firmNameStmt->get_result();
                $firmNameRow = $firmNameResult->fetch_assoc();
                $firmName = $firmNameRow['firm_name'] ?? null;
                $firmNameStmt->close();
                
                if ($firmName) {
                    // companies tablosunda şirket var mı kontrol et
                    $checkCompanyStmt = $conn->prepare("SELECT id FROM companies WHERE company_name = ?");
                    if ($checkCompanyStmt) {
                        $checkCompanyStmt->bind_param("s", $firmName);
                        $checkCompanyStmt->execute();
                        $companyResult = $checkCompanyStmt->get_result();
                        $companyRow = $companyResult->fetch_assoc();
                        $checkCompanyStmt->close();
                        
                        $companyId = null;
                        if (!$companyRow) {
                            // companies tablosunda yoksa oluştur
                            $createCompanyStmt = $conn->prepare("INSERT INTO companies (company_name) VALUES (?)");
                            if ($createCompanyStmt) {
                                $createCompanyStmt->bind_param("s", $firmName);
                                if ($createCompanyStmt->execute()) {
                                    $companyId = $createCompanyStmt->insert_id;
                                    error_log("✅ addPropertyToFirm - companies tablosunda yeni şirket oluşturuldu: " . $firmName . " (ID: " . $companyId . ")");
                                }
                                $createCompanyStmt->close();
                            }
                        } else {
                            $companyId = $companyRow['id'];
                        }
                        
                        // companies tablosuna parsel ekle (eğer companyId bulunduysa)
                        if ($companyId) {
                            $addToCompanyStmt = $conn->prepare("INSERT IGNORE INTO parcel_company (company_id, parcel_id) VALUES (?, ?)");
                            if ($addToCompanyStmt) {
                                $addToCompanyStmt->bind_param("ii", $companyId, $parcelKey);
                                if ($addToCompanyStmt->execute()) {
                                    error_log("✅ addPropertyToFirm - Parsel companies tablosuna eklendi: parcel_id=" . $parcelKey . ", company_id=" . $companyId);
                                } else {
                                    error_log("⚠️ addPropertyToFirm - Parsel companies tablosuna eklenemedi: " . $addToCompanyStmt->error);
                                }
                                $addToCompanyStmt->close();
                            }
                        }
                    }
                }
            }
        } catch (Exception $e) {
            // companies tablosuna ekleme hatası olsa bile ana işlem başarılı olduğu için devam et
            error_log("⚠️ addPropertyToFirm - companies tablosuna ekleme hatası (ana işlem başarılı): " . $e->getMessage());
        }
        
        $result = ['success' => true, 'message' => 'Gayrimenkul firmaya eklendi.'];
        error_log("✅ addPropertyToFirm - Başarılı: " . json_encode($result));
        echo json_encode($result);
    } else {
        $result = ['success' => false, 'message' => 'Ekleme işlemi sırasında bir hata oluştu: ' . $stmt->error];
        error_log("❌ addPropertyToFirm - SQL Execute Hatası: " . $stmt->error);
        echo json_encode($result);
    }
    $stmt->close();
    error_log("🏁 addPropertyToFirm - İşlem tamamlandı");
    exit;
}

// Seçilen parsellere ait taleplerin statüsünü güncelle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_requests_status_by_parcels') {
    $parcelIds = json_decode($_POST['parcel_ids'] ?? '[]', true);
    $statusId = intval($_POST['status_id'] ?? 6); // Varsayılan: 6 = Sorguya Yollandı
    
    if (empty($parcelIds) || !is_array($parcelIds)) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz parsel ID listesi']);
        exit;
    }
    
    $placeholders = implode(',', array_fill(0, count($parcelIds), '?'));
    $types = str_repeat('i', count($parcelIds));
    
    // Seçilen parsellere ait talepleri bul
    // parcel_company → companies → firms → requests
    $query = "
        SELECT DISTINCT r.request_id
        FROM requests r
        INNER JOIN firms f ON r.firm_id = f.firm_id
        INNER JOIN companies c ON c.company_name = f.firm_name
        INNER JOIN parcel_company pc ON pc.company_id = c.id
        WHERE pc.parcel_id IN ($placeholders)
        AND r.status_id < 6  -- Sadece henüz \"Sorguya Yollandı\" olmayan talepleri güncelle
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$parcelIds);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $requestIds = [];
    while ($row = $result->fetch_assoc()) {
        $requestIds[] = $row['request_id'];
    }
    
    if (empty($requestIds)) {
        echo json_encode(['success' => true, 'message' => 'Güncellenecek talep bulunamadı', 'updated_count' => 0]);
        $stmt->close();
        exit;
    }
    
    // Taleplerin statüsünü güncelle
    $requestPlaceholders = implode(',', array_fill(0, count($requestIds), '?'));
    $requestTypes = str_repeat('i', count($requestIds) + 1);
    
    $updateQuery = "
        UPDATE requests 
        SET status_id = ?
        WHERE request_id IN ($requestPlaceholders)
    ";
    
    $updateStmt = $conn->prepare($updateQuery);
    $updateParams = array_merge([$statusId], $requestIds);
    $updateStmt->bind_param($requestTypes, ...$updateParams);
    
    if ($updateStmt->execute()) {
        echo json_encode([
            'success' => true, 
            'message' => count($requestIds) . ' talep statüsü güncellendi',
            'updated_count' => count($requestIds),
            'request_ids' => $requestIds
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Statü güncellenemedi: ' . $updateStmt->error]);
    }
    
    $stmt->close();
    $updateStmt->close();
    exit;
}

if (isset($_GET['action']) && $_GET['action']== 'get_property_count' && isset($_GET['company_id'])) {
    $companyId = intval($_GET['company_id']);

    $query = "SELECT COUNT(parcel_id) AS count FROM parcel_company WHERE company_id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $companyId);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();

    echo json_encode(['success' => true, 'property_count' => $count]);
    $stmt->close();
    exit;
}

// Tek bir tapu_maliye kaydını ID ile getir
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_tapu_by_id') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz ID']);
        exit;
    }

    $sql = "SELECT 
                Id,
                İlBilgisi AS il,
                İlceBilgisi AS ilce,
                MahalleBilgisi AS mahalle,
                AdaBilgisi AS ada,
                ParselBilgisi AS parsel,
                YuzolcumBilgisi AS yuzolcumu,
                AnaTasinmazNitelik AS ana_tasinmaz_nitelik,
                AnaTasinmazNitelik_1 AS ana_tasinmaz_nitelik_1,
                AnaTasinmazNitelik_2 AS ana_tasinmaz_nitelik_2,
                AnaTasinmazNitelik_2_yedek AS ana_tasinmaz_nitelik_2_yedek,
                Hisse AS hisse,
                mahalle_id,
                il_id,
                ilce_id,
                polygon,
                Durum AS durum,
                prolegal_not,
                not_rating
            FROM tapu_maliye 
            WHERE Id = ? 
            LIMIT 1";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Sorgu hazırlanamıyor']);
        exit;
    }

    $stmt->bind_param("i", $id);
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'message' => 'Sorgu çalıştırılamadı']);
        exit;
    }

    $result = $stmt->get_result();
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo json_encode(['success' => true, 'data' => $row]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Kayıt bulunamadı']);
    }
    exit;
}

// tapu_maliye: mahalle/ada/parsel kombinasyonuna göre kaydı bul
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'find_tapu_by_location') {
    $t0 = microtime(true);
    $timings = [];
    header('Content-Type: application/json; charset=utf-8');
    // Fatal hata olursa bile boş dönmesin
    register_shutdown_function(function() {
        $e = error_get_last();
        if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
            error_log("❌ [find_tapu_by_location] Fatal: {$e['message']} ({$e['file']}:{$e['line']})");
            // Eğer henüz çıktı gitmediyse JSON hata dön
            if (!headers_sent()) {
                header('Content-Type: application/json; charset=utf-8');
            }
            echo json_encode(['success' => false, 'message' => 'Sunucu hatası', 'debug' => 'fatal']);
        }
    });

    $mahalleRaw = trim($_GET['mahalle_id'] ?? '');
    $adaRaw = trim($_GET['ada'] ?? '');
    $parselRaw = trim($_GET['parsel'] ?? '');

    $mahalleId = normalizeDigitsToInt($mahalleRaw);
    $ada = normalizeDigitsToInt($adaRaw);
    $parsel = normalizeDigitsToInt($parselRaw);

    if ($mahalleId === null || $ada === null || $parsel === null || $mahalleId <= 0 || $ada < 0 || $parsel < 0) {
        error_log("❌ [find_tapu_by_location] Geçersiz parametreler: mahalle_id={$mahalleRaw}, ada={$adaRaw}, parsel={$parselRaw}");
        echo json_encode(['success' => false, 'message' => 'Geçersiz mahalle/ada/parsel']);
        exit;
    }

    $select = "SELECT 
                Id,
                İlBilgisi AS il,
                İlceBilgisi AS ilce,
                MahalleBilgisi AS mahalle,
                AdaBilgisi AS ada,
                ParselBilgisi AS parsel,
                YuzolcumBilgisi AS yuzolcumu,
                AnaTasinmazNitelik AS ana_tasinmaz_nitelik,
                AnaTasinmazNitelik_1 AS ana_tasinmaz_nitelik_1,
                AnaTasinmazNitelik_2 AS ana_tasinmaz_nitelik_2,
                AnaTasinmazNitelik_2_yedek AS ana_tasinmaz_nitelik_2_yedek,
                Hisse AS hisse,
                mahalle_id,
                il_id,
                ilce_id,
                polygon,
                ST_AsText(polygon) AS polygon_wkt,
                ST_AsGeoJSON(polygon) AS polygon_geojson,
                Durum AS durum,
                prolegal_not,
                not_rating
            FROM tapu_maliye ";

    // Ada/Parsel ve mahalle_id bazı kayıtlarda string/boş olabildiği için hem ham değeri hem de sayısal cast'i kontrol et
    $sql = $select . " 
        WHERE 
          (
            AdaBilgisi = ?
            OR CAST(NULLIF(TRIM(AdaBilgisi), '') AS UNSIGNED) = ?
          )
          AND (
            ParselBilgisi = ?
            OR CAST(NULLIF(TRIM(ParselBilgisi), '') AS UNSIGNED) = ?
          )
          AND CAST(IFNULL(mahalle_id, 0) AS UNSIGNED) = ?
        LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ [find_tapu_by_location] Prepare 1 başarısız: " . $conn->error);
        echo json_encode(['success' => false, 'message' => 'Sorgu hazırlanamıyor', 'debug' => $conn->error]);
        exit;
    }
    // İlk parametreleri string + int olarak bağla: TRIM eşleşmesi için ham değer, CAST için sayısal
    if (!$stmt->bind_param("sisii", $adaRaw, $ada, $parselRaw, $parsel, $mahalleId)) {
        error_log("❌ [find_tapu_by_location] Bind 1 başarısız: " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Parametre bağlanamadı', 'debug' => $stmt->error]);
        exit;
    }
    if (!$stmt->execute()) {
        error_log("❌ [find_tapu_by_location] Execute 1 başarısız: " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Sorgu çalıştırılamadı', 'debug' => $stmt->error]);
        exit;
    }
    $timings['select1_ms'] = round((microtime(true) - $t0) * 1000, 2);
    $row = stmtFetchFirstAssoc($stmt);
    if ($row) {
        $payload = ['success' => true, 'data' => $row];
        $payload['timings'] = [
            'total_ms' => round((microtime(true) - $t0) * 1000, 2),
            'select1_ms' => $timings['select1_ms']
        ];
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($json === false) {
            error_log("❌ [find_tapu_by_location] JSON encode 1 hatası: " . json_last_error_msg());
            $json = json_encode(['success' => false, 'message' => 'JSON encode hatası', 'debug' => json_last_error_msg()]);
        }
        echo $json;
    } else {
        // İkinci bir deneme: cast ile doğrudan sayısal karşılaştırma (OR olmadan)
        $stmt->close();
        $sql2 = $select . " 
            WHERE 
              CAST(IFNULL(AdaBilgisi, 0) AS UNSIGNED) = ? 
              AND CAST(IFNULL(ParselBilgisi, 0) AS UNSIGNED) = ? 
              AND CAST(IFNULL(mahalle_id, 0) AS UNSIGNED) = ?
            LIMIT 1";
        $stmt2 = $conn->prepare($sql2);
        if ($stmt2 && $stmt2->bind_param("iii", $ada, $parsel, $mahalleId) && $stmt2->execute()) {
            $row = stmtFetchFirstAssoc($stmt2);
            if ($row) {
                $payload = ['success' => true, 'data' => $row, 'debug' => 'matched with cast-only'];
                $payload['timings'] = [
                    'total_ms' => round((microtime(true) - $t0) * 1000, 2),
                    'select1_ms' => $timings['select1_ms'] ?? null,
                    'select2_ms' => round((microtime(true) - $t0) * 1000, 2)
                ];
                $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
                if ($json === false) {
                    error_log("❌ [find_tapu_by_location] JSON encode 2 hatası: " . json_last_error_msg());
                    $json = json_encode(['success' => false, 'message' => 'JSON encode hatası', 'debug' => json_last_error_msg()]);
                }
                echo $json;
                $stmt2->close();
                exit;
            }
        } elseif (!$stmt2) {
            error_log("❌ [find_tapu_by_location] Prepare 2 başarısız: " . $conn->error);
        }
        if ($stmt2) $stmt2->close();
        // Üçüncü deneme: mahalle_id'ye göre adayları çekip PHP tarafında tüm olmayan karakterleri ayıklayarak eşle
        $sql3 = $select . " 
            WHERE CAST(IFNULL(mahalle_id, 0) AS UNSIGNED) = ?
            LIMIT 50";
        $stmt3 = $conn->prepare($sql3);
        if ($stmt3 && $stmt3->bind_param("i", $mahalleId) && $stmt3->execute()) {
            $rows = stmtFetchAllAssoc($stmt3);
            foreach ($rows as $row) {
                $adaNorm = normalizeDigitsToInt($row['ada']);
                $parselNorm = normalizeDigitsToInt($row['parsel']);
                $mahalleNorm = normalizeDigitsToInt($row['mahalle_id']);
                if ($adaNorm === $ada && $parselNorm === $parsel && $mahalleNorm === $mahalleId) {
                    error_log("✅ [find_tapu_by_location] PHP normalize ile eşleşti (mahalle_id=$mahalleId, ada=$ada, parsel=$parsel)");
                    $payload = ['success' => true, 'data' => $row, 'debug' => 'matched after php-normalize'];
                    $payload['timings'] = [
                        'total_ms' => round((microtime(true) - $t0) * 1000, 2),
                        'select1_ms' => $timings['select1_ms'] ?? null,
                        'select2_ms' => $timings['select2_ms'] ?? null,
                        'select3_ms' => round((microtime(true) - $t0) * 1000, 2)
                    ];
                    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
                    if ($json === false) {
                        error_log("❌ [find_tapu_by_location] JSON encode 3 hatası: " . json_last_error_msg());
                        $json = json_encode(['success' => false, 'message' => 'JSON encode hatası', 'debug' => json_last_error_msg()]);
                    }
                    echo $json;
                    $stmt3->close();
                    exit;
                }
            }
        } elseif (!$stmt3) {
            error_log("❌ [find_tapu_by_location] Prepare 3 başarısız: " . $conn->error);
        }
        if ($stmt3) $stmt3->close();
        $json = json_encode(['success' => false, 'message' => 'Kayıt bulunamadı'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($json === false) {
            error_log("❌ [find_tapu_by_location] JSON encode 4 hatası: " . json_last_error_msg());
            $json = json_encode(['success' => false, 'message' => 'JSON encode hatası', 'debug' => json_last_error_msg()]);
        }
        // Total süreyi ekle
        $payload = json_decode($json, true);
        if (is_array($payload)) {
            $payload['timings'] = [
                'total_ms' => round((microtime(true) - $t0) * 1000, 2),
                'select1_ms' => $timings['select1_ms'] ?? null,
                'select2_ms' => $timings['select2_ms'] ?? null,
                'select3_ms' => $timings['select3_ms'] ?? null
            ];
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        }
        echo $json;
    }
    exit;
}

// tapu_maliye tam veri (GeoJSON dahil) - tek endpoint
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_tapu_full') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz ID']);
        exit;
    }

    $sql = "SELECT 
                Id,
                İlBilgisi,
                İlceBilgisi,
                MahalleBilgisi,
                AdaBilgisi,
                ParselBilgisi,
                YuzolcumBilgisi,
                AnaTasinmazNitelik,
                AnaTasinmazNitelik_1,
                AnaTasinmazNitelik_2,
                AnaTasinmazNitelik_2_yedek,
                COALESCE(Hisse, '') AS Hisse,
                mahalle_id,
                il_id,
                ilce_id,
                Durum,
                prolegal_not,
                not_rating,
                ST_AsText(polygon) AS polygon_wkt,
                ST_AsGeoJSON(polygon) AS polygon_geojson
            FROM tapu_maliye 
            WHERE Id = ? 
            LIMIT 1";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Sorgu hazırlanamıyor']);
        exit;
    }
    $stmt->bind_param("i", $id);
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'message' => 'Sorgu çalıştırılamadı']);
        exit;
    }
    $result = $stmt->get_result();
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo json_encode(['success' => true, 'data' => $row]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Kayıt bulunamadı']);
    }
    exit;
}

// tapu_maliye yeni kayıt ekleme
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'create_tapu') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);

    if (!is_array($payload)) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON']);
        exit;
    }

    // Zorunlu alanlar/varsayılanlar
    if (!isset($payload['not_rating']) || $payload['not_rating'] === null || $payload['not_rating'] === '') {
        $payload['not_rating'] = 0;
    }

    // Aynı mahalle/ada/parsel zaten varsa yeni ID üretme, mevcut ID'yi dön
    $normMahalle = normalizeDigitsToInt($payload['mahalle_id'] ?? null);
    $normAda = normalizeDigitsToInt($payload['AdaBilgisi'] ?? null);
    $normParsel = normalizeDigitsToInt($payload['ParselBilgisi'] ?? null);
    if ($normMahalle !== null && $normAda !== null && $normParsel !== null) {
        $dupSelect = "SELECT Id, AdaBilgisi, ParselBilgisi, mahalle_id, İlBilgisi, İlceBilgisi, MahalleBilgisi FROM tapu_maliye ";
        $dupSql = $dupSelect . "
            WHERE 
              (
                AdaBilgisi = ?
                OR CAST(NULLIF(TRIM(AdaBilgisi), '') AS UNSIGNED) = ?
              )
              AND (
                ParselBilgisi = ?
                OR CAST(NULLIF(TRIM(ParselBilgisi), '') AS UNSIGNED) = ?
              )
              AND CAST(IFNULL(mahalle_id, 0) AS UNSIGNED) = ?
            LIMIT 1";
        $dupStmt = $conn->prepare($dupSql);
        if ($dupStmt && $dupStmt->bind_param("iiiii", $normAda, $normAda, $normParsel, $normParsel, $normMahalle) && $dupStmt->execute()) {
            $existing = stmtFetchFirstAssoc($dupStmt);
            if ($existing) {
                echo json_encode([
                    'success' => true,
                    'duplicate' => true,
                    'message' => 'Bu mahalle/ada/parsel için kayıt zaten var, yeni ID üretilmedi',
                    'id' => $existing['Id'],
                    'data' => $existing
                ]);
                $dupStmt->close();
                exit;
            }
        }
        if ($dupStmt) $dupStmt->close();

        // PHP tarafı normalize fallback: mahalle_id eşleşen ilk 50 kayıt içinde rakamsal eşleşme ara
        $dupSql2 = $dupSelect . " WHERE CAST(IFNULL(mahalle_id, 0) AS UNSIGNED) = ? LIMIT 50";
        $dupStmt2 = $conn->prepare($dupSql2);
        if ($dupStmt2 && $dupStmt2->bind_param("i", $normMahalle) && $dupStmt2->execute()) {
            $rows = stmtFetchAllAssoc($dupStmt2);
            foreach ($rows as $row) {
                $adaNormRow = normalizeDigitsToInt($row['AdaBilgisi']);
                $parselNormRow = normalizeDigitsToInt($row['ParselBilgisi']);
                $mahalleNormRow = normalizeDigitsToInt($row['mahalle_id']);
                if ($adaNormRow === $normAda && $parselNormRow === $normParsel && $mahalleNormRow === $normMahalle) {
                    echo json_encode([
                        'success' => true,
                        'duplicate' => true,
                        'message' => 'Bu mahalle/ada/parsel için kayıt zaten var, yeni ID üretilmedi',
                        'id' => $row['Id'],
                        'data' => $row,
                        'debug' => 'matched after php-normalize'
                    ]);
                    $dupStmt2->close();
                    exit;
                }
            }
        }
        if ($dupStmt2) $dupStmt2->close();
    }

    // ID verilmemişse benzersiz ID üret
    if (empty($payload['Id'])) {
        $generatedId = generateUniqueTapuId($conn);
        if ($generatedId === null) {
            echo json_encode(['success' => false, 'message' => 'Benzersiz ID üretilemedi']);
            exit;
        }
        $payload['Id'] = $generatedId;
    }

    // Whitelist
    $allowedFields = [
        'Id' => ['type' => 'int', 'column' => 'Id'],
        'İlBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlBilgisi'],
        'IlBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlBilgisi'],
        'İlceBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlceBilgisi'],
        'IlceBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlceBilgisi'],
        'MahalleBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'MahalleBilgisi'],
        'AdaBilgisi' => ['type' => 'int', 'column' => 'AdaBilgisi'],
        'ParselBilgisi' => ['type' => 'int', 'column' => 'ParselBilgisi'],
        'YuzolcumBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'YuzolcumBilgisi'],
        'AnaTasinmazNitelik' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik'],
        'AnaTasinmazNitelik_1' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_1'],
        'AnaTasinmazNitelik_2' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_2'],
        'AnaTasinmazNitelik_2_yedek' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_2_yedek'],
        'Hisse' => ['type' => 'double', 'column' => 'Hisse'],
        'mahalle_id' => ['type' => 'int', 'column' => 'mahalle_id'],
        'il_id' => ['type' => 'int', 'column' => 'il_id'],
        'ilce_id' => ['type' => 'int', 'column' => 'ilce_id'],
        'polygon' => ['type' => 'string', 'column' => 'polygon'],
        'Durum' => ['type' => 'string', 'max' => 50, 'column' => 'Durum'],
        'prolegal_not' => ['type' => 'string', 'max' => 255, 'column' => 'prolegal_not'],
        'not_rating' => ['type' => 'int', 'column' => 'not_rating'],
    ];

    $columns = [];
    $placeholders = [];
    $params = [];
    $types = '';

    foreach ($allowedFields as $key => $rule) {
        if (!array_key_exists($key, $payload)) {
            continue;
        }
        $value = $payload[$key];
        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                $value = null;
            }
        }

        switch ($rule['type']) {
            case 'int':
                if ($value === null) {
                    $columns[] = $rule['column'];
                    $placeholders[] = 'NULL';
                } elseif (!is_numeric($value)) {
                    echo json_encode(['success' => false, 'message' => "{$key} sayısal olmalı"]);
                    exit;
                } else {
                    if ($rule['column'] === 'not_rating' && !in_array(intval($value), [0,1,2], true)) {
                        echo json_encode(['success' => false, 'message' => 'not_rating değeri 0, 1 veya 2 olmalıdır']);
                        exit;
                    }
                    $columns[] = $rule['column'];
                    $placeholders[] = '?';
                    $params[] = intval($value);
                    $types .= 'i';
                }
                break;
            case 'double':
                if ($value === null) {
                    $columns[] = $rule['column'];
                    $placeholders[] = 'NULL';
                } elseif (!is_numeric($value)) {
                    echo json_encode(['success' => false, 'message' => "{$key} sayısal olmalı"]);
                    exit;
                } else {
                    $columns[] = $rule['column'];
                    $placeholders[] = '?';
                    $params[] = floatval($value);
                    $types .= 'd';
                }
                break;
            case 'string':
            default:
                if ($value === null) {
                    $columns[] = $rule['column'];
                    $placeholders[] = 'NULL';
                } else {
                    if (isset($rule['max']) && mb_strlen($value) > $rule['max']) {
                        echo json_encode(['success' => false, 'message' => "{$key} en fazla {$rule['max']} karakter olmalı"]);
                        exit;
                    }
                    if (in_array($rule['column'], ['İlBilgisi', 'İlceBilgisi', 'MahalleBilgisi'], true)) {
                        $value = toUpperTr($value);
                    }
                    if ($rule['column'] === 'polygon') {
                        $decoded = json_decode($value, true);
                        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                            echo json_encode(['success' => false, 'message' => 'Polygon geçerli GeoJSON olmalı']);
                            exit;
                        }
                        $typeVal = $decoded['type'] ?? '';
                        if (!in_array($typeVal, ['Polygon', 'MultiPolygon'], true)) {
                            echo json_encode(['success' => false, 'message' => 'Polygon sadece Polygon/MultiPolygon GeoJSON olarak gönderilmeli']);
                            exit;
                        }
                        $columns[] = $rule['column'];
                        $placeholders[] = 'ST_GeomFromGeoJSON(?)';
                        $params[] = $value;
                        $types .= 's';
                    } elseif ($rule['column'] === 'YuzolcumBilgisi') {
                        $normYz = normalizeYuzolcumForStorage($value);
                        if ($normYz === null || !isNumericLike(str_replace(',', '.', $normYz))) {
                            echo json_encode(['success' => false, 'message' => 'YuzolcumBilgisi sayısal olmalı']);
                            exit;
                        }
                        $columns[] = $rule['column'];
                        $placeholders[] = '?';
                        $params[] = $normYz;
                        $types .= 's';
                    } else {
                        $columns[] = $rule['column'];
                        $placeholders[] = '?';
                        $params[] = $value;
                        $types .= 's';
                    }
                }
                break;
        }
    }

    if (empty($columns)) {
        echo json_encode(['success' => false, 'message' => 'Eklenecek alan yok']);
        exit;
    }

    $colSql = implode(', ', $columns);
    $phSql = implode(', ', $placeholders);
    $sql = "INSERT INTO tapu_maliye ({$colSql}) VALUES ({$phSql})";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Sorgu hazırlanamadı']);
        exit;
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        echo json_encode(['success' => false, 'message' => 'Ekleme başarısız: ' . $err]);
        exit;
    }
    $newId = $conn->insert_id ?: ($payload['Id'] ?? null);
    $stmt->close();

    // Audit log
    if (function_exists('audit_log')) {
        audit_log(
            'tapu_create',
            [
                'id' => $newId,
                'payload' => $payload
            ],
            'tapu_maliye',
            $newId ? (string)$newId : null
        );
    }

    echo json_encode(['success' => true, 'message' => 'Eklendi', 'id' => $newId]);
    exit;
}

// tapu_maliye güncelleme (partial update, whitelist, optional optimistic lock)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'update_tapu') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);

    if (!is_array($payload)) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON']);
        exit;
    }

    $id = isset($payload['id']) ? intval($payload['id']) : 0;
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz ID']);
        exit;
    }

    // Whitelist ve tip/uzunluk kontrolleri
    $allowedFields = [
        'İlBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlBilgisi'],
        'IlBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlBilgisi'],
        'İlceBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlceBilgisi'],
        'IlceBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'İlceBilgisi'],
        'MahalleBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'MahalleBilgisi'],
        'AdaBilgisi' => ['type' => 'int', 'column' => 'AdaBilgisi'],
        'ParselBilgisi' => ['type' => 'int', 'column' => 'ParselBilgisi'],
        'YuzolcumBilgisi' => ['type' => 'string', 'max' => 255, 'column' => 'YuzolcumBilgisi'],
        'AnaTasinmazNitelik' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik'],
        'AnaTasinmazNitelik_1' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_1'],
        'AnaTasinmazNitelik_2' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_2'],
        'AnaTasinmazNitelik_2_yedek' => ['type' => 'string', 'max' => 255, 'column' => 'AnaTasinmazNitelik_2_yedek'],
        'Hisse' => ['type' => 'double', 'column' => 'Hisse'],
        'mahalle_id' => ['type' => 'int', 'column' => 'mahalle_id'],
        'il_id' => ['type' => 'int', 'column' => 'il_id'],
        'ilce_id' => ['type' => 'int', 'column' => 'ilce_id'],
        'polygon' => ['type' => 'string', 'column' => 'polygon'],
        'Durum' => ['type' => 'string', 'max' => 50, 'column' => 'Durum'],
        'prolegal_not' => ['type' => 'string', 'max' => 255, 'column' => 'prolegal_not'],
        'not_rating' => ['type' => 'int', 'column' => 'not_rating'],
    ];

    $updates = [];
    $params = [];
    $types = '';

    foreach ($allowedFields as $key => $rule) {
        if (!array_key_exists($key, $payload)) {
            continue;
        }
        $value = $payload[$key];
        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                $value = null;
            }
        }

        switch ($rule['type']) {
            case 'int':
                if ($value === null) {
                    $updates[] = "{$rule['column']} = NULL";
                } elseif (!is_numeric($value)) {
                    echo json_encode(['success' => false, 'message' => "{$key} sayısal olmalı"]);
                    exit;
                } else {
                    if ($rule['column'] === 'not_rating' && !in_array(intval($value), [0,1,2], true)) {
                        echo json_encode(['success' => false, 'message' => 'not_rating değeri 0, 1 veya 2 olmalıdır']);
                        exit;
                    }
                    $updates[] = "{$rule['column']} = ?";
                    $params[] = intval($value);
                    $types .= 'i';
                }
                break;
            case 'double':
                if ($value === null) {
                    $updates[] = "{$rule['column']} = NULL";
                } elseif (!is_numeric($value)) {
                    echo json_encode(['success' => false, 'message' => "{$key} sayısal olmalı"]);
                    exit;
                } else {
                    $updates[] = "{$rule['column']} = ?";
                    $params[] = floatval($value);
                    $types .= 'd';
                }
                break;
            case 'string':
            default:
                if ($value === null) {
                    $updates[] = "{$rule['column']} = NULL";
                } else {
                    if (isset($rule['max']) && mb_strlen($value) > $rule['max']) {
                        echo json_encode(['success' => false, 'message' => "{$key} en fazla {$rule['max']} karakter olmalı"]);
                        exit;
                    }
                    if (in_array($rule['column'], ['İlBilgisi', 'İlceBilgisi', 'MahalleBilgisi'], true)) {
                        $value = toUpperTr($value);
                    }
                    if ($rule['column'] === 'polygon') {
                        $decoded = json_decode($value, true);
                        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                            echo json_encode(['success' => false, 'message' => 'Polygon geçerli GeoJSON olmalı']);
                            exit;
                        }
                        $typeVal = $decoded['type'] ?? '';
                        if (!in_array($typeVal, ['Polygon', 'MultiPolygon'], true)) {
                            echo json_encode(['success' => false, 'message' => 'Polygon sadece Polygon/MultiPolygon GeoJSON olarak gönderilmeli']);
                            exit;
                        }
                        $updates[] = "polygon = ST_GeomFromGeoJSON(?)";
                        $params[] = $value;
                        $types .= 's';
                    } elseif ($rule['column'] === 'YuzolcumBilgisi') {
                        $normYz = normalizeYuzolcumForStorage($value);
                        if ($normYz === null || !isNumericLike(str_replace(',', '.', $normYz))) {
                            echo json_encode(['success' => false, 'message' => 'YuzolcumBilgisi sayısal olmalı']);
                            exit;
                        }
                        $updates[] = "{$rule['column']} = ?";
                        $params[] = $normYz;
                        $types .= 's';
                    } else {
                        $updates[] = "{$rule['column']} = ?";
                        $params[] = $value;
                        $types .= 's';
                    }
                }
                break;
        }
    }

    if (empty($updates)) {
        echo json_encode(['success' => false, 'message' => 'Güncellenecek alan yok']);
        exit;
    }

    // Eski değerleri log için al
    $oldValues = [];
    $selectedColumns = array_map(function($u) {
        // "col = ?" ya da "col = NULL" ya da "col = ST_GeomFromGeoJSON(?)" formatında
        $parts = explode('=', $u);
        return trim($parts[0]);
    }, $updates);
    $selectedColumns = array_unique($selectedColumns);
    $selectColsSql = implode(', ', array_map(function($c) {
        $clean = str_replace("`", "", $c);
        if ($clean === 'polygon') {
            return "ST_AsText(polygon) AS polygon";
        }
        return "`{$clean}`";
    }, $selectedColumns));

    $prevStmt = $conn->prepare("SELECT {$selectColsSql} FROM tapu_maliye WHERE Id = ? LIMIT 1");
    if ($prevStmt) {
        $prevStmt->bind_param('i', $id);
        if ($prevStmt->execute()) {
            $res = $prevStmt->get_result();
            $oldValues = $res ? $res->fetch_assoc() : [];
        }
        $prevStmt->close();
    }

    $hasUpdatedAt = tableHasColumn($conn, 'tapu_maliye', 'updated_at');
    $rowVersion = isset($payload['row_version']) ? $payload['row_version'] : null;

    if ($hasUpdatedAt && $rowVersion !== null) {
        $checkStmt = $conn->prepare("SELECT UNIX_TIMESTAMP(updated_at) as ts FROM tapu_maliye WHERE Id = ?");
        if (!$checkStmt) {
            echo json_encode(['success' => false, 'message' => 'Sürüm kontrolü yapılamadı']);
            exit;
        }
        $checkStmt->bind_param('i', $id);
        $checkStmt->execute();
        $res = $checkStmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $checkStmt->close();
        $currentTs = $row['ts'] ?? null;
        if ($currentTs !== null && strval($currentTs) !== strval($rowVersion)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Kayıt başka biri tarafından güncellendi, lütfen yeniden yükleyin']);
            exit;
        }
    }

    $sql = "UPDATE tapu_maliye SET " . implode(', ', $updates) . " WHERE Id = ?";
    $params[] = $id;
    $types .= 'i';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Sorgu hazırlanamadı']);
        exit;
    }
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        echo json_encode(['success' => false, 'message' => 'Güncelleme başarısız: ' . $err]);
        exit;
    }
    $stmt->close();

    $newVersion = null;
    $newValues = [];
    if ($hasUpdatedAt) {
        $verStmt = $conn->prepare("SELECT {$selectColsSql}, UNIX_TIMESTAMP(updated_at) as ts FROM tapu_maliye WHERE Id = ?");
        if ($verStmt) {
            $verStmt->bind_param('i', $id);
            if ($verStmt->execute()) {
                $res = $verStmt->get_result();
                $row = $res ? $res->fetch_assoc() : null;
                if ($row) {
                    $newVersion = $row['ts'] ?? null;
                    $newValues = $row;
                    unset($newValues['ts']);
                }
            }
            $verStmt->close();
        }
    } else {
        // updated_at yoksa yine yeni değerleri çekelim
        $newStmt = $conn->prepare("SELECT {$selectColsSql} FROM tapu_maliye WHERE Id = ?");
        if ($newStmt) {
            $newStmt->bind_param('i', $id);
            if ($newStmt->execute()) {
                $res = $newStmt->get_result();
                $row = $res ? $res->fetch_assoc() : null;
                if ($row) {
                    $newValues = $row;
                }
            }
            $newStmt->close();
        }
    }

    // Audit log
    if (function_exists('audit_log')) {
        $changes = [];
        foreach ($selectedColumns as $colName) {
            $oldVal = $oldValues[$colName] ?? null;
            $newVal = $newValues[$colName] ?? null;
            if ($oldVal !== $newVal) {
                $changes[$colName] = ['old' => $oldVal, 'new' => $newVal];
            }
        }
        audit_log(
            'tapu_update',
            [
                'id' => $id,
                'changes' => $changes,
                'row_version_old' => $rowVersion,
                'row_version_new' => $newVersion
            ],
            'tapu_maliye',
            (string)$id
        );
    }

    echo json_encode(['success' => true, 'message' => 'Güncellendi', 'row_version' => $newVersion]);
    exit;
}

// Popup güncellemesi başarısız olduğunda logla
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'log_popup_update_fail') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz JSON']);
        exit;
    }

    // Tabloyu garantiye al
    ensurePopupFailLogTable($conn);

    $tapuId = isset($payload['tapu_id']) ? intval($payload['tapu_id']) : null;
    $mahalleId = isset($payload['mahalle_id']) ? intval($payload['mahalle_id']) : null;
    $ada = isset($payload['ada']) ? intval($payload['ada']) : null;
    $parsel = isset($payload['parsel']) ? intval($payload['parsel']) : null;
    $il = isset($payload['il']) ? trim($payload['il']) : null;
    $ilce = isset($payload['ilce']) ? trim($payload['ilce']) : null;
    $mahalle = isset($payload['mahalle']) ? trim($payload['mahalle']) : null;
    $reason = isset($payload['reason']) ? trim($payload['reason']) : 'Bilinmeyen neden';

    $stmt = $conn->prepare("INSERT INTO popup_update_fail_log (tapu_id, mahalle_id, ada, parsel, il, ilce, mahalle, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Log hazırlanamadı: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param(
        'iiiissss',
        $tapuId,
        $mahalleId,
        $ada,
        $parsel,
        $il,
        $ilce,
        $mahalle,
        $reason
    );
    $ok = $stmt->execute();
    $stmt->close();
    if ($ok) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Log eklenemedi: ' . $conn->error]);
    }
    exit;
}

// Kullanıcı + taşınmaz bazlı aksiyon durumlarını getir
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_parcel_actions') {
    ensure_parcel_actions_table($conn);

    $parcelId = isset($_GET['parcel_id']) ? intval($_GET['parcel_id']) : 0;
    $username = $_SESSION['username'] ?? null;

    if (!$parcelId || !$username) {
        echo json_encode([
            'success' => false,
            'message' => 'parcel_id veya kullanıcı bulunamadı'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "SELECT tapusor, earth, tkgm FROM parcel_actions WHERE parcel_id = ? AND username = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ get_parcel_actions prepare hatası: " . $conn->error);
        echo json_encode(['success' => false, 'message' => 'Veritabanı hatası'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bind_param("is", $parcelId, $username);
    $stmt->execute();
    $stmt->bind_result($tapusor, $earth, $tkgm);

    $hasRow = $stmt->fetch();
    $stmt->close();

    echo json_encode([
        'success' => true,
        'parcel_id' => $parcelId,
        'tapusor' => $hasRow ? (bool)$tapusor : false,
        'earth' => $hasRow ? (bool)$earth : false,
        'tkgm' => $hasRow ? (bool)$tkgm : false,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Kullanıcı + taşınmaz bazlı aksiyon durumlarını kaydet
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'save_parcel_actions') {
    ensure_parcel_actions_table($conn);

    $username = $_SESSION['username'] ?? null;
    $rawBody = file_get_contents('php://input');
    $data = json_decode($rawBody, true);

    $parcelId = isset($data['parcel_id']) ? intval($data['parcel_id']) : 0;
    $tapusor = !empty($data['tapusor']) ? 1 : 0;
    $earth   = !empty($data['earth']) ? 1 : 0;
    $tkgm    = !empty($data['tkgm']) ? 1 : 0;

    if (!$username || !$parcelId) {
        echo json_encode([
            'success' => false,
            'message' => 'Kullanıcı veya parcel_id eksik'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "
        INSERT INTO parcel_actions (username, parcel_id, tapusor, earth, tkgm)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            tapusor = VALUES(tapusor),
            earth   = VALUES(earth),
            tkgm    = VALUES(tkgm),
            updated_at = CURRENT_TIMESTAMP
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ save_parcel_actions prepare hatası: " . $conn->error);
        echo json_encode(['success' => false, 'message' => 'Veritabanı hatası'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bind_param('siiii', $username, $parcelId, $tapusor, $earth, $tkgm);
    $ok = $stmt->execute();
    if (!$ok) {
        error_log("❌ save_parcel_actions execute hatası: " . $stmt->error);
    }
    $stmt->close();

    echo json_encode([
        'success' => $ok ? true : false
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Fetch company properties
// Şirketler tabındaki liste, popup'taki Sorgu & Başvuru tab'ı ile aynı kaynaklardan
// (tapu_maliye + sorgudurumu + basvurular) veri alır.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_company_properties') {
    $companyId = intval($_GET['company_id']);
    
    $query = "
        SELECT 
            m.Id, 
            m.İlBilgisi, 
            m.İlceBilgisi, 
            m.MahalleBilgisi, 
            m.AnaTasinmazNitelik_1,
            m.YuzolcumBilgisi, 
            m.Hisse, 
            m.AdaBilgisi, 
            m.ParselBilgisi, 
            m.mahalle_id,
            m.Durum,
            m.prolegal_not,
            m.not_rating,
            ST_AsText(m.polygon) as geometry,
            s.sorgulama_durumu,
            b.basvuru_turu,
            b.basvuru_sayısı,
            b.basvurulan_firma
        FROM 
            parcel_company pc
        JOIN 
            tapu_maliye m ON pc.parcel_id = m.Id
        LEFT JOIN 
            sorgudurumu s ON m.Id = s.prolegal_id
        LEFT JOIN 
            basvurular b ON m.Id = b.prolegal_id
        WHERE 
            pc.company_id = ?
    ";

    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        error_log("Prepare failed: " . $conn->error);
        echo json_encode(['error' => 'Database query failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt->bind_param("i", $companyId);
    
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        echo json_encode(['error' => 'Query execution failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $result = $stmt->get_result();
    $properties = [];

    foreach ($result as $item) {
        $properties[] = [
            "status" => 200,
            "data" => [
                "type" => "Feature",
                "geometry" => [
                    "type" => "Polygon",
                    "coordinates" => processPolygon($item['geometry'])
                ],
                "properties" => [
                    "id" => $item['Id'] ?? "taş",
                    "ilceAd" => $item['İlceBilgisi'] ?? "",
                    "mevkii" => "",
                    "ilId" => "",
                    "durum" => $item['Durum'] ?? "",
                    "ilceId" => "",
                    "zeminKmdurum" => "",
                    "parselNo" => $item['ParselBilgisi'],
                    "mahalleAd" => $item['MahalleBilgisi'],
                    "ozet" => $item['MahalleBilgisi'] . "-" . $item['AdaBilgisi'] . "/" . $item['ParselBilgisi'],
                    "gittigiParselListe" => "",
                    "hisse" => ($item['Hisse'] === null || $item['Hisse'] === '' ? '' : round((float)$item['Hisse'] * 100) . '%'),
                    "gittigiParselSebep" => "",
                    "alan" => formatYuzolcum($item['YuzolcumBilgisi']),
                    "adaNo" => $item['AdaBilgisi'],
                    "nitelik" => $item['AnaTasinmazNitelik_1'],
                    "ilAd" => $item['İlBilgisi'] ?? "",
                    "mahalleId" => $item['mahalle_id'],
                    "pafta" => "",
                    // Sorgu & Başvuru bilgileri – popup ile aynı tablolardan
                    "sorguDurumu" => $item['sorgulama_durumu'] ?? '',
                    "basvuru_turu" => $item['basvuru_turu'] ?? '',
                    "basvuru_sayısı" => $item['basvuru_sayısı'] ?? '',
                    "basvurulan_firma" => $item['basvurulan_firma'] ?? '',
                    "prolegal_not" => $item['prolegal_not'] ?? '',
                    "not_rating" => $item['not_rating'] ?? 0
                ]
            ]
        ];
    }

    echo json_encode($properties, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'removePropertyFromFirm') {
    $firmId = intval($input['firmId']);
    $parcelKey = intval($input['parcelKey']);

    $stmt = $conn->prepare("DELETE FROM parcel_company WHERE company_id = ? AND parcel_id = ?");
    $stmt->bind_param("ii", $firmId, $parcelKey);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Gayrimenkul firmadan çıkarıldı.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Silme işlemi sırasında bir hata oluştu.']);
    }
    $stmt->close();
    exit;
}

// Fetch all companies with their property count
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_companies_summary') {
    $sql = "
        SELECT c.id, c.company_name, COUNT(pc.parcel_id) AS property_count
        FROM companies c
        LEFT JOIN parcel_company pc ON c.id = pc.company_id
        GROUP BY c.id, c.company_name
        ORDER BY c.company_name ASC
    ";
    
    $result = $conn->query($sql);

    if ($result) {
        $companies = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($companies);
    } else {
        echo json_encode(["error" => "Database query failed"]);
    }
    exit;
}

// Add a new company
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'add_company') {
    $companyName = $_POST['company_name'];

    $stmt = $conn->prepare("INSERT INTO companies (company_name) VALUES (?)");
    $stmt->bind_param("s", $companyName);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $stmt->insert_id, 'company_name' => $companyName, 'property_count' => 0]);
        exit;
    } else {
        echo json_encode(['error' => 'Failed to add company']);
        exit;
    }
}

// Talep firmasından companies tablosuna şirket oluştur ve bağlantı kur
if ($_SERVER["REQUEST_METHOD"] == "POST" && ($action === 'create_company_from_firm' || (isset($_POST['action']) && $_POST['action'] === 'create_company_from_firm'))) {
    // JSON body'den oku
    $input = json_decode(file_get_contents('php://input'), true);
    
    // JSON body yoksa POST'tan oku
    if (!$input) {
        $input = $_POST;
    }
    
    $firmId = intval($input['firm_id'] ?? 0);
    $firmName = trim($input['firm_name'] ?? '');
    $requestId = intval($input['request_id'] ?? 0);
    
    if (empty($firmName) || $firmId <= 0 || $requestId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz parametreler: firm_id, firm_name, request_id gerekli']);
        exit;
    }
    
    // Şirket adına "-TALEPTEN-{TalepId}" ekle
    $companyName = $firmName . '-TALEPTEN-' . $requestId;
    
    // Önce bu isimde bir şirket var mı kontrol et
    $checkSql = "SELECT id FROM companies WHERE company_name = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param("s", $companyName);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    
    if ($existing) {
        // Zaten varsa, mevcut şirketi kullan ve mapping'i kontrol et
        $companyId = $existing['id'];
        
        // Mapping var mı kontrol et
        $mappingCheck = $conn->prepare("SELECT id FROM firm_company_mapping WHERE firm_id = ? AND company_id = ?");
        $mappingCheck->bind_param("ii", $firmId, $companyId);
        $mappingCheck->execute();
        $mappingExists = $mappingCheck->get_result()->fetch_assoc();
        
        if (!$mappingExists) {
            // Mapping yoksa oluştur
            $insertMapping = $conn->prepare("INSERT INTO firm_company_mapping (firm_id, company_id) VALUES (?, ?)");
            $insertMapping->bind_param("ii", $firmId, $companyId);
            $insertMapping->execute();
            $insertMapping->close();
        }
        
        $mappingCheck->close();
        $checkStmt->close();
        
        echo json_encode([
            'success' => true,
            'company_id' => $companyId,
            'company_name' => $companyName,
            'firm_id' => $firmId,
            'message' => 'Mevcut şirket kullanıldı ve bağlantı kuruldu'
        ]);
        exit;
    }
    
    // Yeni şirket oluştur
    $insertSql = "INSERT INTO companies (company_name) VALUES (?)";
    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->bind_param("s", $companyName);
    
    if ($insertStmt->execute()) {
        $companyId = $conn->insert_id;
        
        // Mapping oluştur
        $insertMapping = $conn->prepare("INSERT INTO firm_company_mapping (firm_id, company_id) VALUES (?, ?)");
        $insertMapping->bind_param("ii", $firmId, $companyId);
        $insertMapping->execute();
        $insertMapping->close();
        
        $insertStmt->close();
        $checkStmt->close();
        
        echo json_encode([
            'success' => true,
            'company_id' => $companyId,
            'company_name' => $companyName,
            'firm_id' => $firmId,
            'message' => 'Şirket oluşturuldu ve bağlantı kuruldu'
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Şirket oluşturulamadı: ' . $insertStmt->error]);
    }
    
    exit;
}

// Query Management Functions
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_query_queue') {
    $sql = "SELECT * FROM query_queue ORDER BY created_at DESC";
    $result = $conn->query($sql);
    
    if ($result) {
        $queue = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($queue);
    } else {
        echo json_encode(["error" => "Database query failed"]);
    }
    exit;
}

// Sorgu sırasına ekleme endpoint'i
// Not: Sol listedeki "Sorgu sırasına ekle" ve sağdaki Kontrol sekmesi bu endpoint'i kullanır.
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'add_to_query_queue') {
    $propertyIdsString = $_POST['property_ids'] ?? '';
    $propertyIds = array_filter(array_map('trim', explode(',', $propertyIdsString)));
    $konuProvided = array_key_exists('konu', $_POST);
    $konu = $konuProvided ? trim($_POST['konu']) : '';
    $postedCompanyId = isset($_POST['company_id']) ? intval($_POST['company_id']) : null;
    $postedCompanyName = $_POST['company_name'] ?? '';

    try {
        $conn->begin_transaction();

        $successCount = 0;
        $errors = [];
        $totalCount = count($propertyIds);

        // Eğer company_id gönderildiyse, şirket adını DB'den güvenilir şekilde çek
        $resolvedCompanyName = $postedCompanyName;
        if ($postedCompanyId) {
            $companyStmt = $conn->prepare("SELECT company_name FROM companies WHERE id = ?");
            $companyStmt->bind_param("i", $postedCompanyId);
            $companyStmt->execute();
            $companyResult = $companyStmt->get_result();
            if ($companyResult && $companyResult->num_rows > 0) {
                $companyRow = $companyResult->fetch_assoc();
                $resolvedCompanyName = $companyRow['company_name'];
            }
            $companyStmt->close();
        }

        foreach ($propertyIds as $propertyIdRaw) {
            $propertyId = intval($propertyIdRaw);
            if ($propertyId <= 0) {
                $errors[] = "Geçersiz Prolegal ID: " . $propertyIdRaw;
                continue;
            }

            // İlgili taşınmaz gerçekten tapu_maliye tablosunda var mı kontrol et (isteğe bağlı ama güvenli)
            $checkTapuStmt = $conn->prepare("SELECT Id FROM tapu_maliye WHERE Id = ?");
            $checkTapuStmt->bind_param("i", $propertyId);
            $checkTapuStmt->execute();
            $tapuResult = $checkTapuStmt->get_result();
            $checkTapuStmt->close();

            if (!$tapuResult || $tapuResult->num_rows === 0) {
                $errors[] = "Property ID $propertyId tapu_maliye tablosunda bulunamadı!";
                continue;
            }

            // sorgudurumu tablosunda kayıt var mı kontrol et
            $checkStmt = $conn->prepare("SELECT id, sorgulama_durumu FROM sorgudurumu WHERE prolegal_id = ?");
            $checkStmt->bind_param("i", $propertyId);
            $checkStmt->execute();
            $result = $checkStmt->get_result();

            if ($result && $result->num_rows > 0) {
                $existingRecord = $result->fetch_assoc();
                $checkStmt->close();

                // Zaten 'Sırada' ise tekrar yazmaya gerek yok
                if ($existingRecord['sorgulama_durumu'] === 'Sırada') {
                    $successCount++;
                    continue;
                }

                // Kayıt varsa ama durumu farklıysa güncelle
                $updateSql = "UPDATE sorgudurumu 
                     SET sorgulama_durumu = 'Sırada',
                         sorgulanan_firma = ?";
                $updateTypes = 's';
                $updateParams = [$resolvedCompanyName];
                if ($konuProvided) {
                    $updateSql .= ",
                         konu = ?";
                    $updateTypes .= 's';
                    $updateParams[] = $konu;
                }
                $updateSql .= ",
                         updated_at = NOW()
                     WHERE prolegal_id = ?";
                $updateTypes .= 'i';
                $updateParams[] = $propertyId;

                $updateStmt = $conn->prepare($updateSql);
                if (!$updateStmt) {
                    $errors[] = "Property ID $propertyId güncellenemedi (prep): " . $conn->error;
                } else {
                    $updateStmt->bind_param($updateTypes, ...$updateParams);
                    if ($updateStmt->execute()) {
                        $successCount++;
                    } else {
                        $errors[] = "Property ID $propertyId güncellenemedi: " . $updateStmt->error;
                    }
                    $updateStmt->close();
                }
            } else {
                if ($checkStmt) {
                    $checkStmt->close();
                }

                // Kayıt yoksa ekle
                $insertStmt = $conn->prepare(
                    "INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu, sorgulanan_firma, konu, created_at, updated_at)
                     VALUES (?, 'Sırada', ?, ?, NOW(), NOW())"
                );
                $insertStmt->bind_param("iss", $propertyId, $resolvedCompanyName, $konu);
                if ($insertStmt->execute()) {
                    $successCount++;
                } else {
                    $errors[] = "Property ID $propertyId eklenemedi: " . $insertStmt->error;
                }
                $insertStmt->close();
            }
        }

        $conn->commit();

        $response = [
            'success' => $successCount > 0,
            'message' => "$successCount arazi sorgu sırasına eklendi.",
            'success_count' => $successCount,
            'total_count' => $totalCount,
            'errors' => $errors
        ];

        echo json_encode($response);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode([
            'success' => false,
            'message' => 'Sorgu sırasına ekleme hatası: ' . $e->getMessage()
        ]);
    }
    exit;
}

if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_query_results') {
    $sql = "SELECT * FROM query_results ORDER BY query_date DESC";
    $result = $conn->query($sql);
    
    if ($result) {
        $results = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($results);
    } else {
        echo json_encode(["error" => "Database query failed"]);
    }
    exit;
}

if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'update_query_result') {
    $input = json_decode(file_get_contents('php://input'), true);
    $resultId = $input['result_id'];
    $status = $input['status']; // 'approved' or 'rejected'
    
    $stmt = $conn->prepare("UPDATE query_results SET status = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $status, $resultId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Update failed']);
    }
    exit;
}

// Delete a company
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'delete_company') {
    $companyId = intval($_POST['company_id']);

    try {
        // Transaction başlat
        $conn->begin_transaction();
        
        // Önce parcel_company tablosundaki ilişkili kayıtları sil
        $stmt1 = $conn->prepare("DELETE FROM parcel_company WHERE company_id = ?");
        $stmt1->bind_param("i", $companyId);
        $stmt1->execute();
        $stmt1->close();
        
        // Sonra companies tablosundan şirketi sil
        $stmt2 = $conn->prepare("DELETE FROM companies WHERE id = ?");
        $stmt2->bind_param("i", $companyId);
        
        if ($stmt2->execute()) {
            // Transaction'ı commit et
            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Şirket ve ilişkili kayıtlar başarıyla silindi']);
        } else {
            // Hata durumunda rollback
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Şirket silinemedi: ' . $stmt2->error]);
        }
        
        $stmt2->close();
        
    } catch (Exception $e) {
        // Exception durumunda rollback
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Şirket silinirken hata oluştu: ' . $e->getMessage()]);
    }
    
    exit;
}
    
// ESKİ İMAR FONKSİYON SİSTEMİ KALDIRILDI - YENİ SİSTEM KULLANILIYOR

// ---- Ana GET işleyici (parsel verileri) ----
if ($_SERVER["REQUEST_METHOD"] == "GET" && !isset($_GET['action'])) {
    error_log("🚀 API GET Request: " . $_SERVER['REQUEST_URI']);
    error_log("📋 GET Parameters: " . json_encode($_GET));
    
    $prolegalId = isset($_GET['prolegalId']) ? intval($_GET['prolegalId']) : null;
    $il = isset($_GET['il']) ? $_GET['il'] : null;
    $ilce = isset($_GET['ilce']) ? $_GET['ilce'] : null;
    $mahalle = isset($_GET['mahalle']) ? $_GET['mahalle'] : null;
    $ada = isset($_GET['ada']) && $_GET['ada'] !== '' ? intval($_GET['ada']) : null;
    $parsel = isset($_GET['parsel']) && $_GET['parsel'] !== '' ? intval($_GET['parsel']) : null;
    
    // Debug: Ada/Parsel parametrelerini logla
    error_log("🔍 [DEBUG] API'ye gelen ada parametresi: " . ($_GET['ada'] ?? 'YOK') . " -> " . ($ada ?? 'NULL'));
    error_log("🔍 [DEBUG] API'ye gelen parsel parametresi: " . ($_GET['parsel'] ?? 'YOK') . " -> " . ($parsel ?? 'NULL'));
    $mahalle_id = isset($_GET['mahalle_id']) ? intval($_GET['mahalle_id']) : null;
    $nitelik = isset($_GET['nitelik']) ? $_GET['nitelik'] : null;
    $tasinmazDetay = isset($_GET['tasinmazDetay']) ? $_GET['tasinmazDetay'] : null;
    $araziMin = isset($_GET['araziMin']) ? floatval($_GET['araziMin']) : null;
    $araziMax = isset($_GET['araziMax']) ? floatval($_GET['araziMax']) : null;
    $imarFonksiyonu = isset($_GET['imarFonksiyonu']) ? $_GET['imarFonksiyonu'] : null;
    $turSecimi = isset($_GET['turSecimi']) ? $_GET['turSecimi'] : null;
    $hisseDurumu = isset($_GET['hisseDurumu']) ? $_GET['hisseDurumu'] : null;
    $durum = isset($_GET['durum']) ? $_GET['durum'] : null;
    
    // Debug: Gelen parametreleri logla
    error_log("🔍 API DEBUG - Gelen parametreler: turSecimi=$turSecimi, hisseDurumu=$hisseDurumu, durum=$durum");
    $sorguDurumu = isset($_GET['sorguDurumu']) ? $_GET['sorguDurumu'] : null;
    $sorgulama_durumu = isset($_GET['sorgulama_durumu']) ? $_GET['sorgulama_durumu'] : null;
    
    // Debug: Sorgulama durumu parametrelerini logla
    error_log("🔍 [DEBUG] API - sorguDurumu: " . ($sorguDurumu ?? 'null'));
    error_log("🔍 [DEBUG] API - sorgulama_durumu: " . ($sorgulama_durumu ?? 'null'));
    
    // Debug: sorgudurumu tablosunda 'Sırada' değerine sahip kayıt sayısını kontrol et
    if ($sorgulama_durumu === 'Sırada') {
        $debugStmt = $conn->prepare("SELECT COUNT(*) as count FROM sorgudurumu WHERE sorgulama_durumu = 'Sırada'");
        $debugStmt->execute();
        $debugResult = $debugStmt->get_result();
        $debugData = $debugResult->fetch_assoc();
        error_log("🔍 [DEBUG] sorgudurumu tablosunda 'Sırada' değerine sahip kayıt sayısı: " . $debugData['count']);
        $debugStmt->close();
    }
    
    // Debug: sorgudurumu tablosunda 'Sorgulandı' değerine sahip kayıt sayısını kontrol et
    if ($sorgulama_durumu === 'Sorgulandı') {
        $debugStmt = $conn->prepare("SELECT COUNT(*) as count FROM sorgudurumu WHERE sorgulama_durumu = 'Sorgulandı'");
        $debugStmt->execute();
        $debugResult = $debugStmt->get_result();
        $debugData = $debugResult->fetch_assoc();
        error_log("🔍 [DEBUG] sorgudurumu tablosunda 'Sorgulandı' değerine sahip kayıt sayısı: " . $debugData['count']);
        
        // Debug log'u dosyaya da yaz
        file_put_contents('debug_sorguland.txt', "🔍 [DEBUG] sorgudurumu tablosunda 'Sorgulandı' değerine sahip kayıt sayısı: " . $debugData['count'] . "\n", FILE_APPEND);
        
        $debugStmt->close();
        
        // Debug: sorgudurumu tablosundaki tüm farklı sorgulama_durumu değerlerini listele
        $debugStmt2 = $conn->prepare("SELECT DISTINCT sorgulama_durumu, COUNT(*) as count FROM sorgudurumu GROUP BY sorgulama_durumu");
        $debugStmt2->execute();
        $debugResult2 = $debugStmt2->get_result();
        error_log("🔍 [DEBUG] sorgudurumu tablosundaki tüm sorgulama_durumu değerleri:");
        file_put_contents('debug_sorguland.txt', "🔍 [DEBUG] sorgudurumu tablosundaki tüm sorgulama_durumu değerleri:\n", FILE_APPEND);
        while ($debugRow = $debugResult2->fetch_assoc()) {
            error_log("🔍 [DEBUG] - '" . $debugRow['sorgulama_durumu'] . "': " . $debugRow['count'] . " kayıt");
            file_put_contents('debug_sorguland.txt', "🔍 [DEBUG] - '" . $debugRow['sorgulama_durumu'] . "': " . $debugRow['count'] . " kayıt\n", FILE_APPEND);
        }
        $debugStmt2->close();
    }
    $basvuruDurumu = isset($_GET['basvuruDurumu']) ? $_GET['basvuruDurumu'] : null;
    $notRating = isset($_GET['notRating']) ? $_GET['notRating'] : null;
    $anaFonksiyonId = isset($_GET['ana_fonksiyon_id']) ? $_GET['ana_fonksiyon_id'] : null;
    $altFonksiyonId = isset($_GET['alt_fonksiyon_id']) ? $_GET['alt_fonksiyon_id'] : null;
    $imarSwitchActive = isset($_GET['imar_switch_active']) ? $_GET['imar_switch_active'] : 'false';
    $imarAllFunctions = isset($_GET['imar_all_functions']) ? $_GET['imar_all_functions'] : 'false';
    $ne_lat = isset($_GET['ne_lat']) ? floatval($_GET['ne_lat']) : null;
    $ne_lng = isset($_GET['ne_lng']) ? floatval($_GET['ne_lng']) : null;
    $sw_lat = isset($_GET['sw_lat']) ? floatval($_GET['sw_lat']) : null;
    $sw_lng = isset($_GET['sw_lng']) ? floatval($_GET['sw_lng']) : null;

    error_log("Request parameters: " . json_encode($_GET));
    error_log("🔍 [DEBUG] Ana fonksiyon ID: " . ($anaFonksiyonId ?? 'NULL'));
    error_log("🔍 [DEBUG] Alt fonksiyon ID: " . ($altFonksiyonId ?? 'NULL'));
    error_log("🔍 [DEBUG] İmar switch aktif: " . $imarSwitchActive);
        
        $isUpdate = isset($_GET['update']) ? $_GET['update'] : false;

        if ($isUpdate) {
        error_log("🔍 Taşınmaz Detay API çağrıldı");
        error_log("📊 Parametreler: il=$il, ilce=$ilce, mahalle=$mahalle, ada=$ada, parsel=$parsel");

        $data = fetchTasinmazDetayData($conn, $il, $ilce, $mahalle, $ada, $parsel, $nitelik, $araziMin, $araziMax, $turSecimi, $hisseDurumu, $sorguDurumu);
        
        error_log("📦 Dönen veri sayısı: " . count($data));
        error_log("📋 İlk 3 veri: " . json_encode(array_slice($data, 0, 3)));

        // Arazi detay sorgusunu audit log'a yaz
        if (function_exists('audit_log')) {
            audit_log('parcel_detail', [
                'filters'   => $_GET,
                'row_count' => count($data),
            ], 'property', null);
        }

        echo json_encode($data);
        exit;
    }

    $data = getParcelData($conn, $prolegalId, $il, $ilce, $mahalle, $ada, $parsel, $mahalle_id, $nitelik, $tasinmazDetay, $araziMin, $araziMax, $imarFonksiyonu, $turSecimi, $hisseDurumu, $durum, $sorguDurumu, $sorgulama_durumu, $basvuruDurumu, $notRating, $anaFonksiyonId, $altFonksiyonId, $ne_lat, $ne_lng , $sw_lat, $sw_lng, $imarSwitchActive, $imarAllFunctions);

    // Arazi listeleme sorgusunu audit log'a yaz
    if (function_exists('audit_log')) {
        $meta = [
            'filters'   => $_GET,
            'row_count' => is_array($data) ? count($data) : 0,
        ];
        $resourceId = $prolegalId !== null ? (string)$prolegalId : null;
        audit_log('parcel_search', $meta, 'property', $resourceId);
    }

    if (!empty($data)) {
        $responses = [];
        foreach ($data as $item) {
            $responses[] = [
                "status" => 200,
                "data" => [
                    "type" => "Feature",
                    "geometry" => [
                        "type" => "Polygon",
                        "coordinates" => processPolygon($item['polygon_text'])
                    ],
                    "properties" => [
                        "id"=>$item['Id']??"taş",
                        "ilceAd" => $item['İlceBilgisi'] ?? "",
                        "mevkii" => "",
                        "ilId" => "",
                        "durum" => $item['Durum'] ?? "",
                        "ilceId" => "",
                        "zeminKmdurum" => "",
                        "parselNo" => $item['ParselBilgisi'],
                        "mahalleAd" => $item['MahalleBilgisi'],
                        "ozet" => $item['MahalleBilgisi'] . "-" . $item['AdaBilgisi'] . "/" . $item['ParselBilgisi'],
                        "gittigiParselListe" => "",
                        "hisse" => ($item['Hisse'] === null || $item['Hisse'] === '' ? '' : round((float)$item['Hisse'] * 100) . '%'),
                        "gittigiParselSebep" => "",
                        "alan" => formatYuzolcum($item['YuzolcumBilgisi']),
                        "adaNo" => $item['AdaBilgisi'],
                        "nitelik" => $item['AnaTasinmazNitelik_1'],
                        "ilAd" => $item['İlBilgisi'] ?? "",
                        "mahalleId" => $item['mahalle_id'],
                        "pafta" => "",
                        "basvuru_durumu" => $item['basvuru_durumu_aktif'] ?? "",
                        "basvuru_turu" => $item['basvuru_turu'] ?? "",
                        "basvuru_sayısı" => $item['basvuru_sayısı'] ?? "",
                        "basvurulan_firma" => $item['basvurulan_firma'] ?? "",
                        "adaParsel" => $item['AdaBilgisi'] . "/" . $item['ParselBilgisi'],
                        "imarFonksiyon" => (function() use ($item) {
                            $ana = $item['ana_fonksiyon_ad'] ?? "";
                            $alt = $item['alt_fonksiyon_ad'] ?? "";
                            $result = $ana;
                            if (!empty($ana) && !empty($alt)) {
                                $result .= " - " . $alt;
                            }
                            // error_log("🔍 İmar fonksiyonu debug: ana='$ana', alt='$alt', result='$result'");
                            return $result;
                        })(),
                        "sorguDurumu" => $item['sorgulama_durumu'] ?? "",
                        "prolegal_not" => $item['prolegal_not'] ?? "",
                        "not_rating" => $item['not_rating'] ?? ""
                    ]
                ],
                "status" => 200
            ];
        }

        logRequestAndResponse($_GET, $responses);
        
        echo json_encode($responses, JSON_UNESCAPED_SLASHES);
    } else {
        $response = [
            [
                "data" => null,
                "status" => 404
            ]
        ];
        logRequestAndResponse($_GET, $response);
        echo json_encode($response, JSON_PRETTY_PRINT);
    }
    exit;
}

// Destekleyici POST aksiyonları (güncelleme vb.)

// Başvuru durumu güncelleme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'update_basvuru_durumu') {
    ensure_basvurular_table($conn);

    $input = json_decode(file_get_contents('php://input'), true);
    $parcelIds = $input['parcel_ids'];
    $basvuruDurumu = $input['basvuru_durumu'];
    
    foreach ($parcelIds as $parcelId) {
        $stmt = $conn->prepare("UPDATE tapu_maliye SET basvuru_durumu_aktif = ? WHERE Id = ?");
        if (!$stmt) {
            error_log("❌ update_basvuru_durumu prepare hatası: " . $conn->error);
            echo json_encode(['success' => false, 'message' => 'Veritabanı hatası: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param("si", $basvuruDurumu, $parcelId);
        if (!$stmt->execute()) {
            error_log("❌ update_basvuru_durumu execute hatası: " . $stmt->error);
            echo json_encode(['success' => false, 'message' => 'Güncelleme hatası: ' . $stmt->error]);
            $stmt->close();
            exit;
        }
        $stmt->close();
    }
    
    echo json_encode(['success' => true]);
    exit;
}

// Sorgu durumu güncelleme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'update_sorgu_durumu') {
    $input = json_decode(file_get_contents('php://input'), true);
    $parcelIds = $input['parcel_ids'];
    $sorguDurumu = $input['sorgu_durumu'];
    
    foreach ($parcelIds as $parcelId) {
        $stmt = $conn->prepare("UPDATE tapu_maliye SET Durum = ? WHERE Id = ?");
        $stmt->bind_param("si", $sorguDurumu, $parcelId);
        $stmt->execute();
    }
    
    echo json_encode(['success' => true]);
    exit;
}

// İmar bilgisi güncelleme (imar2 kaldırıldığı için no-op)
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'update_imar_data') {
    echo json_encode(['success' => true]);
    exit;
}

// Prolegal notu kaydetme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'save_prolegal_note') {
    ob_clean();
    $prolegalId = intval($_POST['prolegal_id']);
    $prolegalNote = $_POST['prolegal_not'];
    $notRating = isset($_POST['not_rating']) ? intval($_POST['not_rating']) : null;
    
    error_log("SAVE_PROLEGAL_NOTE: ID=$prolegalId, NoteLen=" . strlen($prolegalNote) . ", Rating=$notRating");
    
    // Debug: Mevcut değerleri kontrol et
    $checkStmt = $conn->prepare("SELECT Id, prolegal_not, not_rating FROM tapu_maliye WHERE Id = ?");
    $checkStmt->bind_param("i", $prolegalId);
        $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $currentData = $checkResult->fetch_assoc();
    error_log("CURRENT DATA: " . json_encode($currentData));
    
    $stmt = $conn->prepare("UPDATE tapu_maliye SET prolegal_not = ?, not_rating = ? WHERE Id = ?");
    $stmt->bind_param("sii", $prolegalNote, $notRating, $prolegalId);
        
    if ($stmt->execute()) {
        $affected = $stmt->affected_rows;
        $error = $stmt->error;
        
        echo json_encode([
            'success' => true, 
            'message' => 'Prolegal notu kaydedildi',
            'affected_rows' => $affected,
            'error' => $error,
            'debug' => [
                'prolegalId' => $prolegalId,
                'prolegalNote' => $prolegalNote,
                'notRating' => $notRating,
                'currentData' => $currentData,
                'sql' => "UPDATE tapu_maliye SET prolegal_not = '$prolegalNote', not_rating = $notRating WHERE Id = $prolegalId"
            ],
            'received' => [
                'id' => $prolegalId, 
                'noteLen' => strlen($prolegalNote)
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Prolegal notu kaydedilemedi',
            'error' => $stmt->error,
            'affected_rows' => $stmt->affected_rows
        ]);
    }
    $stmt->close();
    exit;
}

// Not rating kaydetme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'save_not_rating') {
    $input = json_decode(file_get_contents('php://input'), true);
    $tapuId = $input['tapu_id'];
    $notRating = $input['not_rating'];
    
    $stmt = $conn->prepare("UPDATE tapu_maliye SET not_rating = ? WHERE Id = ?");
    $stmt->bind_param("ii", $notRating, $tapuId);
        
    if ($stmt->execute()) {
            echo json_encode(['success' => true]);
            } else {
        echo json_encode(['success' => false]);
    }
    exit;
}

// İmar bilgilerini getirme (imar2 kaldırıldı – boş şablon)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_imar_bilgileri') {
    $prolegalId = $_GET['prolegal_id'] ?? '';
    
    if (empty($prolegalId)) {
        echo json_encode(['success' => false, 'error' => 'Prolegal ID gerekli']);
        exit;
    }

    echo json_encode(['success' => true, 'data' => [
        'fonksiyon' => '',
        'durum' => '',
        'plani' => '',
        'yapilasma_orani' => '',
        'emsal' => '',
        'kat_adedi' => '',
        'yukseklik' => '',
        'imar_durumu' => ''
    ]]);
    exit;
}

// Prolegal verilerini kaydetme işlemi
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'save_prolegal_data') {
    $prolegalId = intval($_POST['prolegal_id']);
    $prolegalNot = $_POST['prolegal_not'];
    $durum = $_POST['durum'];
    $notRating = isset($_POST['not_rating']) ? intval($_POST['not_rating']) : null;
    
    $stmt = $conn->prepare("UPDATE tapu_maliye SET prolegal_not = ?, Durum = ?, not_rating = ? WHERE Id = ?");
    $stmt->bind_param("ssii", $prolegalNot, $durum, $notRating, $prolegalId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Prolegal verileri başarıyla kaydedildi']);
        } else {
        echo json_encode(['success' => false, 'message' => 'Veriler kaydedilemedi: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

// Şirketleri listele (dropdown için)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_companies') {
    try {
        $sql = "SELECT id, company_name as name FROM companies ORDER BY company_name";
        $result = $conn->query($sql);
        
        if ($result && $result->num_rows > 0) {
            $companies = [];
            while ($row = $result->fetch_assoc()) {
                $companies[] = $row;
            }
            echo json_encode($companies);
        } else {
            echo json_encode([]);
        }
    } catch (Exception $e) {
        echo json_encode(["error" => "Database error: " . $e->getMessage()]);
    }
    exit;
}

// Yeni şirket oluştur
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'create_company') {
    $companyName = trim($_POST['company_name']);
    
    if (empty($companyName)) {
        echo json_encode(['success' => false, 'message' => 'Şirket adı boş olamaz!']);
        exit;
    }
    
    $checkSql = "SELECT id FROM companies WHERE company_name = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param("s", $companyName);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    
    if ($existing) {
        echo json_encode(['success' => false, 'message' => 'Bu isimde bir şirket zaten mevcut!']);
        $checkStmt->close();
        exit;
    }
    
    $insertSql = "INSERT INTO companies (company_name) VALUES (?)";
        $insertStmt = $conn->prepare($insertSql);
    $insertStmt->bind_param("s", $companyName);
        
        if ($insertStmt->execute()) {
        $newCompanyId = $conn->insert_id;
        error_log("🔧 Company created - ID: $newCompanyId, Name: $companyName");
        echo json_encode([
            'success' => true, 
            'message' => 'Şirket başarıyla oluşturuldu!',
            'company' => ['id' => $newCompanyId, 'name' => $companyName],
            'debug' => ['inserted_id' => $newCompanyId, 'company_name' => $companyName]
        ]);
            } else {
        echo json_encode(['success' => false, 'message' => 'Şirket oluşturulamadı: ' . $insertStmt->error]);
    }
    
    $checkStmt->close();
    $insertStmt->close();
    exit;
}

// Arazinin şirket ilişkilerini getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_property_companies') {
    try {
        $propertyId = intval($_GET['property_id']);
        
        if ($propertyId <= 0) {
            echo json_encode(['success' => true, 'companies' => []]);
    exit;
}

        $sql = "SELECT c.id, c.company_name as name 
                FROM companies c 
                INNER JOIN parcel_company pc ON c.id = pc.company_id 
                WHERE pc.parcel_id = ? 
                ORDER BY c.company_name";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $propertyId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $companies = [];
        while ($row = $result->fetch_assoc()) {
            $companies[] = $row;
        }
        
        echo json_encode(['success' => true, 'companies' => $companies]);
        $stmt->close();
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Araziyi şirkete ekle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'add_property_to_company') {
    $propertyId = intval($_POST['property_id']);
    $companyId = intval($_POST['company_id']);
    
    $checkSql = "SELECT id FROM parcel_company WHERE parcel_id = ? AND company_id = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param("ii", $propertyId, $companyId);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    
    if ($existing) {
        echo json_encode(['success' => false, 'message' => 'Bu arazi zaten bu şirkete ekli!']);
        $checkStmt->close();
        exit;
    }
    
    $insertSql = "INSERT INTO parcel_company (parcel_id, company_id) VALUES (?, ?)";
    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->bind_param("ii", $propertyId, $companyId);
    
    if ($insertStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Arazi başarıyla şirkete eklendi!']);
        } else {
        echo json_encode(['success' => false, 'message' => 'Arazi eklenirken hata oluştu: ' . $insertStmt->error]);
    }
    
    $checkStmt->close();
    $insertStmt->close();
    exit;
}

// Araziyi şirketten kaldır
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'remove_property_from_company') {
    $propertyId = intval($_POST['property_id']);
    $companyId = intval($_POST['company_id']);

    $deleteSql = "DELETE FROM parcel_company WHERE parcel_id = ? AND company_id = ?";
    $deleteStmt = $conn->prepare($deleteSql);
    $deleteStmt->bind_param("ii", $propertyId, $companyId);

    if ($deleteStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Şirket ilişkisi kaldırıldı!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'İlişki kaldırılırken hata oluştu: ' . $deleteStmt->error]);
    }
    $deleteStmt->close();
    exit;
}

// Arazinin mevcut durumlarını getir
if (
    $_SERVER["REQUEST_METHOD"] == "GET" &&
    isset($_GET['action']) &&
    $_GET['action'] === 'get_property_status'
) {
    $propertyId = isset($_GET['property_id']) ? intval($_GET['property_id']) : 0;

    $sql = "SELECT tm.Durum as uygunluk_durumu,
                   COALESCE(s.sorgulama_durumu, 'Sorgulanmadı') as sorgulama_durumu,
                   COALESCE(b.basvuru_turu, 'Küçük') as basvuru_durumu
            FROM tapu_maliye tm
            LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id
            LEFT JOIN basvurular b ON tm.id = b.prolegal_id
            WHERE tm.id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $propertyId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        echo json_encode(array_merge(['success' => true], $row));
    } else {
        echo json_encode(['success' => false, 'message' => 'Arazi bulunamadı']);
    }
    $stmt->close();
    exit;
}

// Arazi durumlarını güncelle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'update_property_status') {
    $propertyId = intval($_POST['property_id']);
    $uygunlukDurumu = $_POST['uygunluk_durumu'];
    $sorgulamaDurumu = $_POST['sorgulama_durumu'];
    $basvuruDurumu = $_POST['basvuru_durumu'];
    
    $conn->begin_transaction();
    
    try {
        $stmt1 = $conn->prepare("UPDATE tapu_maliye SET Durum = ? WHERE id = ?");
        $stmt1->bind_param("si", $uygunlukDurumu, $propertyId);
        $stmt1->execute();
        
        $stmt2 = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu) VALUES (?, ?) ON DUPLICATE KEY UPDATE sorgulama_durumu = ?");
        $stmt2->bind_param("iss", $propertyId, $sorgulamaDurumu, $sorgulamaDurumu);
        $stmt2->execute();
        
        $stmt3 = $conn->prepare("INSERT INTO basvurular (prolegal_id, basvuru_turu) VALUES (?, ?) ON DUPLICATE KEY UPDATE basvuru_turu = ?");
        $stmt3->bind_param("iss", $propertyId, $basvuruDurumu, $basvuruDurumu);
        $stmt3->execute();
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Durumlar başarıyla güncellendi']);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Güncelleme hatası: ' . $e->getMessage()]);
    }
    
    $stmt1->close();
    $stmt2->close();
    $stmt3->close();
    exit;
}

// Sorgu kayıtlarını getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_query_records') {
    $sql = "SELECT tm.id, tm.ilAd, tm.ilceAd, tm.mahalleAd, tm.adaNo, tm.parselNo, tm.Durum as durum,
                   COALESCE(s.sorgulama_durumu, 'Sorgulanmadı') as sorgulama_durumu,
                   COALESCE(b.basvuru_turu, 'Küçük') as basvuru_turu,
                   COALESCE(s.konu, '') as konu
            FROM tapu_maliye tm
            LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id
            LEFT JOIN basvurular b ON tm.id = b.prolegal_id
            WHERE s.sorgulama_durumu IN ('Sorguda', 'Sırada', 'Sorgulandı')
            ORDER BY tm.id DESC
            LIMIT 100";
    
    $result = $conn->query($sql);
    
    if ($result) {
        $records = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'records' => $records]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Sorgu kayıtları alınamadı: ' . $conn->error]);
    }
    exit;
}

// Seçilen kayıtları sorguya gönder
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'send_to_query') {
    global $REQUEST_STATUS;
    $propertyIds = $_POST['property_ids'];
    $propertyIdArray = explode(',', $propertyIds);
    $propertyIdArray = array_values(array_filter(array_map('intval', $propertyIdArray)));
    if (empty($propertyIdArray)) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz kayıt listesi']);
        exit;
    }
    
    $conn->begin_transaction();
    
    try {
        $timestamp = date('Y-m-d H:i:s');
        
        foreach ($propertyIdArray as $propertyId) {
            $propertyId = intval($propertyId);
            
            $stmt = $conn->prepare("INSERT INTO query_history (property_id, sent_at, status) VALUES (?, ?, 'Gönderildi')");
            $stmt->bind_param("is", $propertyId, $timestamp);
            $stmt->execute();
            
            $stmt2 = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu) VALUES (?, 'Sorguda') ON DUPLICATE KEY UPDATE sorgulama_durumu = 'Sorguda'");
            $stmt2->bind_param("i", $propertyId);
            $stmt2->execute();
            
            $stmt->close();
            $stmt2->close();
        }

        // İlgili taleplerin statüsünü sadece tüm parselleri gönderilmişse "Sorguya Yollandı" yap
        $requestIds = [];
        $requestParcelMap = []; // request_id => [parcel_ids sent]
        $placeholders = implode(',', array_fill(0, count($propertyIdArray), '?'));
        $types = str_repeat('i', count($propertyIdArray));
        $mapSql = "SELECT request_id, parcel_id FROM request_parcels WHERE parcel_id IN ($placeholders)";
        $mapStmt = $conn->prepare($mapSql);
        if ($mapStmt) {
            $mapStmt->bind_param($types, ...$propertyIdArray);
            if ($mapStmt->execute()) {
                $mapRes = $mapStmt->get_result();
                if ($mapRes) {
                    while ($row = $mapRes->fetch_assoc()) {
                        $rid = intval($row['request_id'] ?? 0);
                        $pid = intval($row['parcel_id'] ?? 0);
                        if ($rid) {
                            $requestIds[$rid] = true;
                            if (!isset($requestParcelMap[$rid])) $requestParcelMap[$rid] = [];
                            if ($pid) $requestParcelMap[$rid][$pid] = true;
                        }
                    }
                }
            }
            $mapStmt->close();
        }
        if ($requestIds) {
            $reqIdsArr = array_keys($requestIds);
            $reqPlace = implode(',', array_fill(0, count($reqIdsArr), '?'));
            $reqTypes = str_repeat('i', count($reqIdsArr));
            $totalSql = "SELECT request_id, COUNT(*) as total_parcels FROM request_parcels WHERE request_id IN ($reqPlace) GROUP BY request_id";
            $totStmt = $conn->prepare($totalSql);
            if ($totStmt) {
                $totStmt->bind_param($reqTypes, ...$reqIdsArr);
                $updateIds = [];
                if ($totStmt->execute()) {
                    $totRes = $totStmt->get_result();
                    if ($totRes) {
                        while ($row = $totRes->fetch_assoc()) {
                            $rid = intval($row['request_id'] ?? 0);
                            $total = intval($row['total_parcels'] ?? 0);
                            $sentCount = isset($requestParcelMap[$rid]) ? count($requestParcelMap[$rid]) : 0;
                            if ($rid && $total > 0 && $sentCount >= $total) {
                                $updateIds[] = $rid;
                            }
                        }
                    }
                }
                $totStmt->close();

                if ($updateIds) {
                    $updPlace = implode(',', array_fill(0, count($updateIds), '?'));
                    $updTypes = str_repeat('i', count($updateIds));
                    $statusId = $REQUEST_STATUS['sorguya_yollandi'] ?? 6;
                    $reqSql = "UPDATE requests SET status_id = ?, updated_at = NOW() WHERE request_id IN ($updPlace)";
                    $reqStmt = $conn->prepare($reqSql);
                    if ($reqStmt) {
                        $reqStmt->bind_param('i' . $updTypes, $statusId, ...$updateIds);
                        $reqStmt->execute();
                        $reqStmt->close();
                    }
                }
            }
        }
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => count($propertyIdArray) . ' kayıt sorguya gönderildi']);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Sorguya gönderme hatası: ' . $e->getMessage()]);
    }
    exit;
}

// Sorgu geçmişini getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_query_history') {
    try {
        // Tablo varlığını kontrol et
        $checkTable = $conn->query("SHOW TABLES LIKE 'query_history'");
        if ($checkTable->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'query_history tablosu bulunamadı']);
            exit;
        }
        
    $sql = "SELECT qh.id, qh.property_id, qh.sent_at, qh.status,
                   tm.ilAd, tm.ilceAd, tm.mahalleAd, tm.adaNo, tm.parselNo
            FROM query_history qh
            LEFT JOIN tapu_maliye tm ON qh.property_id = tm.id
            ORDER BY qh.sent_at DESC
            LIMIT 50";
    
    $result = $conn->query($sql);
    
    if ($result) {
        $history = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'history' => $history]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Sorgu geçmişi alınamadı: ' . $conn->error]);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Hata: ' . $e->getMessage()]);
    }
    exit;
}

// Uygunluk durumunu işaretle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'mark_as_suitable') {
    $propertyId = intval($_POST['property_id']);
    $status = $_POST['status'];
    
    $conn->begin_transaction();
    
    try {
        $stmt1 = $conn->prepare("UPDATE query_history SET status = ? WHERE property_id = ? ORDER BY sent_at DESC LIMIT 1");
        $stmt1->bind_param("si", $status, $propertyId);
        $stmt1->execute();
        
        $stmt2 = $conn->prepare("UPDATE tapu_maliye SET Durum = ? WHERE id = ?");
        $stmt2->bind_param("si", $status, $propertyId);
        $stmt2->execute();
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Durum başarıyla güncellendi']);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Durum güncelleme hatası: ' . $e->getMessage()]);
    }
    
    $stmt1->close();
    $stmt2->close();
    exit;
}

// Sorgu kayıtlarını Excel'e export et
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'export_query_records') {
    $ids = $_GET['ids'];
    $idArray = explode(',', $ids);
    
    $placeholders = str_repeat('?,', count($idArray) - 1) . '?';
    $sql = "SELECT tm.id, tm.ilAd, tm.ilceAd, tm.mahalleAd, tm.adaNo, tm.parselNo, tm.Durum as durum,
                   COALESCE(s.sorgulama_durumu, 'Sorgulanmadı') as sorgulama_durumu,
                   COALESCE(b.basvuru_turu, 'Küçük') as basvuru_turu
            FROM tapu_maliye tm
            LEFT JOIN sorgudurumu s ON tm.id = s.prolegal_id
            LEFT JOIN basvurular b ON tm.id = b.prolegal_id
            WHERE tm.id IN ($placeholders)
            ORDER BY tm.id DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(str_repeat('i', count($idArray)), ...$idArray);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $records = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="sorgu_kayitlari_' . date('Y-m-d_H-i-s') . '.xlsx"');
    
    require_once 'SimpleXLSXGen.php';
    
    $data = [
        ['Prolegal ID', 'İl', 'İlçe', 'Mahalle', 'Ada', 'Parsel', 'Durum', 'Sorgulama Durumu', 'Başvuru Durumu']
    ];
    
    foreach ($records as $record) {
        $data[] = [
            $record['id'],
            $record['ilAd'] ?? '-',
            $record['ilceAd'] ?? '-',
            $record['mahalleAd'] ?? '-',
            $record['adaNo'] ?? '-',
            $record['parselNo'] ?? '-',
            $record['durum'] ?? 'Sorgulanmadı',
            $record['sorgulama_durumu'] ?? 'Sorgulanmadı',
            $record['basvuru_turu'] === 'Küçük' ? 'Müşterisiz' : ($record['basvuru_turu'] === 'Büyük' ? 'Müşterili' : 'Belirtilmemiş')
        ];
    }
    
    $xlsx = SimpleXLSXGen::fromArray($data);
    $xlsx->downloadAs('sorgu_kayitlari_' . date('Y-m-d_H-i-s') . '.xlsx');
    exit;
}

// Çoklu arazi durumlarını güncelle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'update_multiple_property_status') {
    $propertyIds = $_POST['property_ids'];
    $propertyIdArray = explode(',', $propertyIds);
    $basvuruDurumu = $_POST['basvuru_durumu'];
    $prolegalDegerlendirme = $_POST['prolegal_degerlendirme'];
    $sorguDurumu = $_POST['sorgu_durumu'];
    $uygunlukDurumu = $_POST['uygunluk_durumu'];
    
    $conn->begin_transaction();
    
    try {
        foreach ($propertyIdArray as $propertyId) {
            $propertyId = intval($propertyId);
            
            if ($uygunlukDurumu) {
                $stmt1 = $conn->prepare("UPDATE tapu_maliye SET Durum = ? WHERE id = ?");
                $stmt1->bind_param("si", $uygunlukDurumu, $propertyId);
                $stmt1->execute();
                $stmt1->close();
            }
            
            if ($prolegalDegerlendirme) {
                $stmt2 = $conn->prepare("UPDATE tapu_maliye SET not_rating = ? WHERE id = ?");
                $stmt2->bind_param("ii", $prolegalDegerlendirme, $propertyId);
                $stmt2->execute();
                $stmt2->close();
            }
            
            if ($sorguDurumu) {
                $stmt3 = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu) VALUES (?, ?) ON DUPLICATE KEY UPDATE sorgulama_durumu = ?");
                $stmt3->bind_param("iss", $propertyId, $sorguDurumu, $sorguDurumu);
                $stmt3->execute();
                $stmt3->close();
            }
            
            if ($basvuruDurumu) {
                $stmt4 = $conn->prepare("INSERT INTO basvurular (prolegal_id, basvuru_turu) VALUES (?, ?) ON DUPLICATE KEY UPDATE basvuru_turu = ?");
                $stmt4->bind_param("iss", $propertyId, $basvuruDurumu, $basvuruDurumu);
                $stmt4->execute();
                $stmt4->close();
            }
        }
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => count($propertyIdArray) . ' arazi başarıyla güncellendi']);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Güncelleme hatası: ' . $e->getMessage()]);
    }
    exit;
}

// Sorgu durumu verilerini getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_sorgu_durumu') {
    $propertyId = isset($_GET['property_id']) ? intval($_GET['property_id']) : null;
    
    if (!$propertyId) {
        echo json_encode(['error' => 'Property ID gerekli']);
        exit;
    }
    
    try {
        $stmt = $conn->prepare("SELECT sorgulama_durumu, sorgulanan_firma, konu, created_at, updated_at FROM sorgudurumu WHERE prolegal_id = ?");
        $stmt->bind_param("i", $propertyId);
        $stmt->execute();
        $result = $stmt->get_result();
        $data = $result->fetch_assoc();
        $stmt->close();
        
        if ($data) {
            echo json_encode([
                'sorgulama_durumu' => $data['sorgulama_durumu'],
                'sorgulanan_firma' => $data['sorgulanan_firma'],
                'konu' => $data['konu'],
                'sorgu_tarihi' => $data['created_at'],
                'sorgu_sonucu' => $data['sorgulama_durumu'],
                'son_guncelleme' => $data['updated_at']
            ]);
        } else {
            echo json_encode([
                'sorgulama_durumu' => 'Sorgulanmadı',
                'sorgulanan_firma' => '-',
                'konu' => '-',
                'sorgu_tarihi' => '-',
                'sorgu_sonucu' => '-',
                'son_guncelleme' => '-'
            ]);
        }
    } catch (Exception $e) {
        echo json_encode(['error' => 'Veri alınamadı: ' . $e->getMessage()]);
    }
    exit;
}

// Başvuru durumu verilerini getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_basvuru_durumu') {
    $propertyId = isset($_GET['property_id']) ? intval($_GET['property_id']) : null;
    
    if (!$propertyId) {
        echo json_encode(['error' => 'Property ID gerekli']);
        exit;
    }
    
    try {
        $stmt = $conn->prepare("SELECT basvuru_turu, basvurulan_firma, konu, created_at FROM basvurular WHERE prolegal_id = ?");
        $stmt->bind_param("i", $propertyId);
        $stmt->execute();
        $result = $stmt->get_result();
        $data = $result->fetch_assoc();
        $stmt->close();
        
        if ($data) {
            echo json_encode([
                'basvuru_durumu' => $data['basvuru_turu'],
                'basvuru_tarihi' => $data['created_at'],
                'basvuru_sayisi' => '1',
                'ilgili_firma' => $data['basvurulan_firma'] ?: '-',
                'konu' => $data['konu'] ?: '-'
            ]);
        } else {
            echo json_encode([
                'basvuru_durumu' => 'Başvuru yok',
                'basvuru_tarihi' => '-',
                'basvuru_sayisi' => '0',
                'ilgili_firma' => '-',
                'konu' => '-'
            ]);
        }
    } catch (Exception $e) {
        echo json_encode(['error' => 'Veri alınamadı: ' . $e->getMessage()]);
    }
    exit;
}

// Kayıt durumunu güncelleme
if (isset($_POST['action']) && $_POST['action'] === 'update_record_status') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['data'])) {
        echo json_encode(['success' => false, 'message' => 'Geçersiz veri']);
        exit;
    }
    
    $data = $input['data'];
    $recordId = $data['id'];
    $sorgulamaDurumu = $data['sorgulama_durumu'] ?? null;
    $basvuruTuru = $data['basvuru_turu'] ?? null;
    $durum = $data['durum'] ?? null;
    
    try {
        $conn->begin_transaction();
        
        // Sorgulama durumunu güncelle (sorgudurumu tablosu)
        if ($sorgulamaDurumu !== null) {
            if ($sorgulamaDurumu === '') {
                // Seçiniz... seçildiğinde sorgu durumu tablosundan kaydı sil
                $stmt = $conn->prepare("DELETE FROM sorgudurumu WHERE prolegal_id = ?");
                $stmt->bind_param("i", $recordId);
                $stmt->execute();
                $stmt->close();
                error_log("🗑️ Sorgu durumu kaydı silindi: prolegal_id = $recordId");
            } else {
                // Normal güncelleme
                $stmt = $conn->prepare("UPDATE sorgudurumu SET sorgulama_durumu = ? WHERE prolegal_id = ?");
                $stmt->bind_param("si", $sorgulamaDurumu, $recordId);
                $stmt->execute();
                $stmt->close();
                error_log("✅ Sorgu durumu güncellendi: prolegal_id = $recordId, durum = $sorgulamaDurumu");
            }
        }
        
        // Başvuru türünü güncelle (basvurular tablosu)
        if ($basvuruTuru !== null && $basvuruTuru !== '') {
            // Önce mevcut başvuru var mı kontrol et
            $checkStmt = $conn->prepare("SELECT id FROM basvurular WHERE prolegal_id = ?");
            $checkStmt->bind_param("i", $recordId);
            $checkStmt->execute();
            $existing = $checkStmt->get_result()->fetch_assoc();
            $checkStmt->close();
            
            if ($existing) {
                // Güncelle
                $stmt = $conn->prepare("UPDATE basvurular SET basvuru_turu = ? WHERE prolegal_id = ?");
                $stmt->bind_param("si", $basvuruTuru, $recordId);
                $stmt->execute();
                $stmt->close();
        } else {
                // Yeni kayıt ekle
                $stmt = $conn->prepare("INSERT INTO basvurular (prolegal_id, basvuru_turu, created_at) VALUES (?, ?, NOW())");
                $stmt->bind_param("is", $recordId, $basvuruTuru);
                $stmt->execute();
                $stmt->close();
            }
        }
        
        // Uygunluk durumunu güncelle (tapu_maliye ve imar2 tabloları)
        if ($durum !== null && $durum !== '') {
            // tapu_maliye tablosunu güncelle
            $stmt = $conn->prepare("UPDATE tapu_maliye SET durum = ? WHERE prolegal_id = ?");
            $stmt->bind_param("si", $durum, $recordId);
            $stmt->execute();
            $stmt->close();
            
            // imar2 tablosunu güncelle
            $stmt = $conn->prepare("UPDATE imar2 SET durum = ? WHERE prolegal_id = ?");
            $stmt->bind_param("si", $durum, $recordId);
            $stmt->execute();
            $stmt->close();
        }
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Kayıt başarıyla güncellendi']);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Güncelleme hatası: ' . $e->getMessage()]);
    }
    exit;
}

// Varsayılan: Method Not Allowed (sadece GET request'ler için)
if ($_SERVER["REQUEST_METHOD"] == "GET" && !isset($_GET['action'])) {
    $response = [
        [
            "data" => null,
            "status" => 405
        ]
    ];
    logRequestAndResponse($_SERVER, $response);
    echo json_encode($response, JSON_PRETTY_PRINT);
    exit;
}

// ===== SORGU SIRASI API FONKSİYONLARI =====

// Parsellerin sorgu durumunu toplu güncelle (yalnızca Sırada)
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $actionParam = $_POST['action'] ?? ($_GET['action'] ?? null);
    if ($actionParam === 'set_sorgu_status') {
        $payload = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!$payload && !empty($_POST)) {
            $payload = $_POST;
        }
        $idsRaw = $payload['prolegal_ids'] ?? [];
        $status = isset($payload['status']) ? trim($payload['status']) : '';
        $allowedStatuses = ['Sırada'];
        if (!in_array($status, $allowedStatuses, true)) {
            echo json_encode(['success' => false, 'message' => 'Geçersiz statü (yalnızca Sırada desteklenir)']);
            exit;
        }
        if (is_string($idsRaw)) {
            $ids = array_filter(array_map('intval', explode(',', $idsRaw)));
        } elseif (is_array($idsRaw)) {
            $ids = array_filter(array_map('intval', $idsRaw));
        } else {
            $ids = [];
        }
        if (!count($ids)) {
            echo json_encode(['success' => false, 'message' => 'Geçerli prolegal_id bulunamadı']);
            exit;
        }

        $success = 0;
        $errors = [];

        foreach ($ids as $propertyId) {
            $checkTapuStmt = $conn->prepare("SELECT Id FROM tapu_maliye WHERE Id = ?");
            $checkTapuStmt->bind_param("i", $propertyId);
            $checkTapuStmt->execute();
            $tapuResult = $checkTapuStmt->get_result();
            if ($tapuResult->num_rows === 0) {
                $errors[] = "Property ID $propertyId tapu_maliye tablosunda bulunamadı";
                continue;
            }
            $stmt = $conn->prepare("
                INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu, created_at, updated_at)
                VALUES (?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE sorgulama_durumu = VALUES(sorgulama_durumu), updated_at = VALUES(updated_at), sorgulanan_firma = NULL
            ");
            $stmt->bind_param("is", $propertyId, $status);
            if ($stmt->execute()) {
                $success++;
            } else {
                $errors[] = "Property ID $propertyId güncellenemedi: " . $stmt->error;
            }
        }

        echo json_encode([
            'success' => $success > 0,
            'updated' => $success,
            'errors' => $errors
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Sorgu sırasına arazi ekle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'add_to_queue') {
    // Output buffer'ı temizle
    ob_clean();
    $propertyIds = $_POST['property_ids'];
    $propertyIdArray = explode(',', $propertyIds);
    
    $successCount = 0;
    $errors = [];
    
    foreach ($propertyIdArray as $propertyId) {
        $propertyId = trim($propertyId);
        if (empty($propertyId)) continue;
        
        try {
            // Önce tapu_maliye tablosunda bu ID'nin var olup olmadığını kontrol et
            $checkTapuStmt = $conn->prepare("SELECT Id FROM tapu_maliye WHERE Id = ?");
            $checkTapuStmt->bind_param("i", $propertyId);
            $checkTapuStmt->execute();
            $tapuResult = $checkTapuStmt->get_result();
            
            if ($tapuResult->num_rows === 0) {
                $errors[] = "Property ID $propertyId tapu_maliye tablosunda bulunamadı!";
                continue;
            }
            
            // sorgudurumu tablosunda kayıt var mı kontrol et
            $checkStmt = $conn->prepare("SELECT id, sorgulama_durumu FROM sorgudurumu WHERE prolegal_id = ?");
            $checkStmt->bind_param("i", $propertyId);
            $checkStmt->execute();
            $result = $checkStmt->get_result();
            
            if ($result->num_rows > 0) {
                $existingRecord = $result->fetch_assoc();
                
                // Eğer zaten 'Sırada' ise uyarı ver
                if ($existingRecord['sorgulama_durumu'] === 'Sırada') {
                    $errors[] = "Property ID $propertyId zaten sorgu sırasında!";
                    continue;
                }
                
                // Kayıt varsa ama durumu farklıysa güncelle
                $updateStmt = $conn->prepare("UPDATE sorgudurumu SET sorgulama_durumu = 'Sırada', sorgulanan_firma = NULL, updated_at = NOW() WHERE prolegal_id = ?");
                $updateStmt->bind_param("i", $propertyId);
                if ($updateStmt->execute()) {
                    $successCount++;
                } else {
                    $errors[] = "Property ID $propertyId güncellenemedi: " . $updateStmt->error;
                }
            } else {
                        // Kayıt yoksa ekle
                        $insertStmt = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu, sorgulanan_firma, created_at, updated_at) VALUES (?, 'Sırada', NULL, NOW(), NOW())");
                $insertStmt->bind_param("i", $propertyId);
                if ($insertStmt->execute()) {
                    $successCount++;
                } else {
                    $errors[] = "Property ID $propertyId eklenemedi: " . $insertStmt->error;
                }
            }
        } catch (Exception $e) {
            $errors[] = "Property ID $propertyId işlenirken hata: " . $e->getMessage();
        }
    }
    
    $response = [
        "success" => $successCount > 0,
        "message" => "$successCount arazi sorgu sırasına eklendi.",
        "success_count" => $successCount,
        "total_count" => count($propertyIdArray),
        "errors" => $errors
    ];
    
    echo json_encode($response);
    exit;
}

// Sorgu sırasını getir (filtreleme ile)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_queue_list') {
    // Filtreleme parametrelerini al
    $basvuruDurumu = isset($_GET['basvuru_durumu']) ? $_GET['basvuru_durumu'] : '';
    // Hem sorgu_durumu hem sorgulama_durumu parametrelerini destekle
    $sorguDurumu = isset($_GET['sorgu_durumu']) ? $_GET['sorgu_durumu'] : (isset($_GET['sorgulama_durumu']) ? $_GET['sorgulama_durumu'] : '');
    $uygunlukDurumu = isset($_GET['uygunluk_durumu']) ? $_GET['uygunluk_durumu'] : '';
    $anaFonksiyonId = isset($_GET['ana_fonksiyon_id']) ? $_GET['ana_fonksiyon_id'] : '';
    $altFonksiyonId = isset($_GET['alt_fonksiyon_id']) ? $_GET['alt_fonksiyon_id'] : '';
    $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : '';
    $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : '';
    $dateType = isset($_GET['date_type']) ? $_GET['date_type'] : '';
    $companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : 0;
    $companyNameForFilter = null;

    // Şirket adını al (firma bazlı filtrelerde kullanılacak)
    if ($companyId > 0) {
        $cnStmt = $conn->prepare("SELECT company_name FROM companies WHERE id = ?");
        if ($cnStmt) {
            $cnStmt->bind_param("i", $companyId);
            if ($cnStmt->execute()) {
                $cnRes = $cnStmt->get_result()->fetch_assoc();
                $companyNameForFilter = $cnRes['company_name'] ?? null;
            }
            $cnStmt->close();
        }
    }
    
    // Base SQL sorgusu
    $companyJoin = $companyId > 0 ? "INNER JOIN parcel_company pc ON pc.parcel_id = s.prolegal_id\n            " : '';
    $sql = "SELECT s.id, s.prolegal_id, s.sorgulama_durumu, s.sorgulanan_firma, s.created_at, s.updated_at,
                   tm.İlBilgisi as il, tm.İlceBilgisi as ilce, tm.MahalleBilgisi as mahalle,
                   tm.AdaBilgisi as ada, tm.ParselBilgisi as parsel,
                   tm.Durum as uygunluk_durumu,
                   COALESCE(b.basvuru_turu, 'Küçük') as basvuru_turu,
                   b.basvuru_tarihi,
                   b.basvurulan_firma,
                   s.konu
            FROM sorgudurumu s
            {$companyJoin}
            LEFT JOIN tapu_maliye tm ON s.prolegal_id = tm.Id
            LEFT JOIN basvurular b ON s.prolegal_id = b.prolegal_id";
    
    $whereConditions = [];
    $params = [];
    $types = '';
    
    // Sorgu durumu filtresi
    if (empty($sorguDurumu)) {
        $whereConditions[] = "s.sorgulama_durumu IN ('Sırada', 'Sorguda', 'Sorgulandı')";
    } else if ($sorguDurumu === 'Tümünü Sorgula') {
        // Tümünü Sorgula: Sorguda, Sırada ve Sorgulanmadı olan tüm kayıtları getir
        $whereConditions[] = "(s.sorgulama_durumu IN ('Sırada', 'Sorguda', 'Sorgulandı') OR s.sorgulama_durumu IS NULL)";
    } else {
        $sorguArray = explode(',', $sorguDurumu);
        $sorguConditions = [];
        foreach ($sorguArray as $sorgu) {
            $sorgu = trim($sorgu);
            if ($sorgu !== 'List All' && !empty($sorgu)) {
                if ($sorgu === 'Sorgulanmadı') {
                    $sorguConditions[] = "s.sorgulama_durumu IS NULL";
                } else {
                    $sorguConditions[] = "s.sorgulama_durumu = ?";
                    $params[] = $sorgu;
                    $types .= 's';
                }
            }
        }
        if (!empty($sorguConditions)) {
            $whereConditions[] = "(" . implode(" OR ", $sorguConditions) . ")";
        }
    }
    
    // Başvuru durumu filtresi
    if (!empty($basvuruDurumu) && $basvuruDurumu !== 'List All') {
        $basvuruArray = explode(',', $basvuruDurumu);
        $basvuruConditions = [];
        foreach ($basvuruArray as $basvuru) {
            $basvuru = trim($basvuru);
            if ($basvuru !== 'List All' && !empty($basvuru)) {
                if ($basvuru === 'Küçük Başvuru') {
                    $basvuruConditions[] = "b.basvuru_turu IN ('Küçük', 'Küçük Başvuru')";
                } elseif ($basvuru === 'Büyük Başvuru') {
                    $basvuruConditions[] = "b.basvuru_turu IN ('Büyük', 'Büyük Başvuru')";
                }
            }
        }
        if (!empty($basvuruConditions)) {
            $whereConditions[] = "(" . implode(" OR ", $basvuruConditions) . ")";
        }
    }
    
    // Uygunluk durumu filtresi
    if (!empty($uygunlukDurumu) && $uygunlukDurumu !== 'List All') {
        $uygunlukArray = explode(',', $uygunlukDurumu);
        $uygunlukConditions = [];
        foreach ($uygunlukArray as $uygunluk) {
            $uygunluk = trim($uygunluk);
            if ($uygunluk !== 'List All' && !empty($uygunluk)) {
                if ($uygunluk === 'Uygun') {
                    $uygunlukConditions[] = "tm.Durum = 'Uygun'";
                } elseif ($uygunluk === 'Uygun Değil') {
                    $uygunlukConditions[] = "tm.Durum = 'Uygun değil'";
                }
            }
        }
        if (!empty($uygunlukConditions)) {
            $whereConditions[] = "(" . implode(" OR ", $uygunlukConditions) . ")";
        }
    }
    
    // Fonksiyon filtresi - Eğer ana fonksiyon seçilmişse, tapu_id üzerinden filtrele
    if (!empty($anaFonksiyonId)) {
        error_log("🔍 [DEBUG] get_queue_list - Fonksiyon filtresi aktif - anaFonksiyonId: $anaFonksiyonId, altFonksiyonId: $altFonksiyonId");
        
        $anaFonksiyonArray = explode(',', $anaFonksiyonId);
        $altFonksiyonArray = !empty($altFonksiyonId) ? explode(',', $altFonksiyonId) : [];
        
        // Ana fonksiyon ID'lerini temizle
        $anaFonksiyonArray = array_map('trim', $anaFonksiyonArray);
        $altFonksiyonArray = array_map('trim', $altFonksiyonArray);
        
        error_log("🔍 [DEBUG] get_queue_list - Temizlenmiş ana fonksiyon ID'leri: " . json_encode($anaFonksiyonArray));
        error_log("🔍 [DEBUG] get_queue_list - Temizlenmiş alt fonksiyon ID'leri: " . json_encode($altFonksiyonArray));
        
        // Ana fonksiyon placeholder'ları oluştur
        $anaPlaceholders = implode(',', array_fill(0, count($anaFonksiyonArray), '?'));
        
        // Alt fonksiyon koşulu
        $altFonksiyonCondition = '';
        if (!empty($altFonksiyonArray)) {
            $altPlaceholders = implode(',', array_fill(0, count($altFonksiyonArray), '?'));
            $altFonksiyonCondition = " AND alt_fonksiyon_id IN ($altPlaceholders)";
        }
        
        // Fonksiyon filtresi koşulu - vw_imar_filtre view'ını kullan
        $fonksiyonCondition = "s.prolegal_id IN (
            SELECT DISTINCT tapu_id 
            FROM vw_imar_filtre 
            WHERE ana_fonksiyon_id IN ($anaPlaceholders)
            $altFonksiyonCondition
            AND is_current = 1
        )";
        
        error_log("🔍 [DEBUG] get_queue_list - Fonksiyon filtresi koşulu: $fonksiyonCondition");
        
        $whereConditions[] = $fonksiyonCondition;
        
        // Parametreleri ekle
        foreach ($anaFonksiyonArray as $anaId) {
            $params[] = $anaId;
            $types .= 'i';
        }
        
        foreach ($altFonksiyonArray as $altId) {
            $params[] = $altId;
            $types .= 'i';
        }
        
        error_log("🔍 [DEBUG] get_queue_list - Fonksiyon filtresi parametreleri: " . json_encode($params));
        error_log("🔍 [DEBUG] get_queue_list - Fonksiyon filtresi tipleri: $types");
    } else {
        error_log("🔍 [DEBUG] get_queue_list - Fonksiyon filtresi PASIF - anaFonksiyonId: " . ($anaFonksiyonId ?? 'NULL'));
    }

    // Tarih filtresi (aktif filtrelere göre esnek)
    if (!empty($dateFrom) && !empty($dateTo)) {
        $dateConditions = [];

        // Yardımcı: iki alanı da kapsayan OR bloğu ekle
        $addDualDateCondition = function (&$arr, &$params, &$types, $from, $to, $field1, $field2) {
            $arr[] = "(({$field1} IS NOT NULL AND DATE({$field1}) BETWEEN ? AND ?) OR ({$field2} IS NOT NULL AND DATE({$field2}) BETWEEN ? AND ?))";
            $params[] = $from; $params[] = $to; $params[] = $from; $params[] = $to;
            $types .= 'ssss';
        };

        // date_type öncelikli
        if ($dateType === 'basvuru') {
            $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 'b.basvuru_tarihi', 's.updated_at');
        } elseif ($dateType === 'sorgu') {
            $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 's.updated_at', 'b.basvuru_tarihi');
        } elseif ($dateType === 'all') {
            $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 's.updated_at', 'b.basvuru_tarihi');
        } else {
            // Aktif filtrelere göre
            $hasBasvuruFilter = !empty($basvuruDurumu) && $basvuruDurumu !== 'List All';
            $hasSorguFilter = !empty($sorguDurumu);
            $hasUygunlukFilter = !empty($uygunlukDurumu) && $uygunlukDurumu !== 'List All';

            if ($hasBasvuruFilter) {
                $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 'b.basvuru_tarihi', 's.updated_at');
            }
            if ($hasSorguFilter) {
                $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 's.updated_at', 'b.basvuru_tarihi');
            }
            if ($hasUygunlukFilter) {
                $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 's.updated_at', 'b.basvuru_tarihi');
            }

            // Hiç durum filtresi yoksa tüm tarihleri kapsa
            if (empty($dateConditions)) {
                $addDualDateCondition($dateConditions, $params, $types, $dateFrom, $dateTo, 's.updated_at', 'b.basvuru_tarihi');
            }
        }

    if (!empty($dateConditions)) {
        $whereConditions[] = '(' . implode(' OR ', $dateConditions) . ')';
    }

    // Şirket + başvuru durumu -> basvurulan_firma ile eşle
    if ($companyId > 0 && !empty($basvuruDurumu) && $companyNameForFilter) {
        $whereConditions[] = "b.basvurulan_firma = '{$conn->real_escape_string($companyNameForFilter)}'";
    }

    // Şirket + sorgu durumu -> sorgulanan_firma ile eşle
    if ($companyId > 0 && !empty($sorguDurumu) && $companyNameForFilter) {
        $whereConditions[] = "s.sorgulanan_firma = '{$conn->real_escape_string($companyNameForFilter)}'";
    }

    // Şirket + başvuru durumu -> basvurulan_firma ile eşle (parcel_company join korunuyor)
    if ($companyId > 0 && !empty($basvuruDurumu) && $companyNameForFilter) {
        $whereConditions[] = "b.basvurulan_firma = ?";
        $params[] = $companyNameForFilter;
        $types .= 's';
    }

    // Şirket + sorgu durumu -> sorgulanan_firma ile eşle
    if ($companyId > 0 && !empty($sorguDurumu) && $companyNameForFilter) {
        $whereConditions[] = "s.sorgulanan_firma = ?";
        $params[] = $companyNameForFilter;
        $types .= 's';
    }
    }

    // Şirket filtresi
    if ($companyId > 0) {
        $whereConditions[] = "pc.company_id = ?";
        $params[] = $companyId;
        $types .= 'i';
    }
    
    // WHERE koşullarını ekle
    if (!empty($whereConditions)) {
        $sql .= " WHERE " . implode(" AND ", $whereConditions);
    }
    
    $sql .= " ORDER BY s.created_at ASC";
    
    // Sorguyu çalıştır
    if (!empty($params)) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $queueItems = [];
    
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            // Debug: sorgulanan_firma değerini logla
            if ($row['prolegal_id'] == '97891649') {
                error_log("🔍 DEBUG get_queue_list - Property 97891649: sorgulanan_firma = '" . $row['sorgulanan_firma'] . "'");
            }
            $queueItems[] = $row;
        }
    }
    
    echo json_encode($queueItems);
    exit;
}

// Tüm durumları listele (tüm kayıtlar) - filtreleme ile
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_all_records') {
    // Filtreleme parametrelerini al
    $basvuruDurumu = isset($_GET['basvuru_durumu']) ? $_GET['basvuru_durumu'] : '';
    $sorguDurumu = isset($_GET['sorgulama_durumu']) ? $_GET['sorgulama_durumu'] : '';
    $uygunlukDurumu = isset($_GET['uygunluk_durumu']) ? $_GET['uygunluk_durumu'] : '';
    $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : '';
    $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : '';
    $dateType = isset($_GET['date_type']) ? $_GET['date_type'] : '';
    $ilFilter = isset($_GET['il']) ? trim($_GET['il']) : '';
    $ilceFilter = isset($_GET['ilce']) ? trim($_GET['ilce']) : '';
    $mahalleFilter = isset($_GET['mahalle']) ? trim($_GET['mahalle']) : '';
    $adaFilter = isset($_GET['ada']) ? trim($_GET['ada']) : '';
    $parselFilter = isset($_GET['parsel']) ? trim($_GET['parsel']) : '';
    $companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : 0;
    $companyNameForFilter = null;

    if ($companyId > 0) {
        $cnStmt = $conn->prepare("SELECT company_name FROM companies WHERE id = ?");
        if ($cnStmt) {
            $cnStmt->bind_param("i", $companyId);
            if ($cnStmt->execute()) {
                $cnRes = $cnStmt->get_result()->fetch_assoc();
                $companyNameForFilter = $cnRes['company_name'] ?? null;
            }
            $cnStmt->close();
        }
    }
    
    // Debug log
    error_log("🔍 [DEBUG] get_all_records - sorguDurumu: " . $sorguDurumu);
    
    // Base SQL sorgusu - tüm tapu_maliye kayıtlarını al
    $companyJoin = $companyId > 0 ? "INNER JOIN parcel_company pc ON tm.Id = pc.parcel_id\n            " : '';
    $sql = "SELECT tm.Id as prolegal_id,
                   tm.İlBilgisi as il, tm.İlceBilgisi as ilce, tm.MahalleBilgisi as mahalle,
                   tm.AdaBilgisi as ada, tm.ParselBilgisi as parsel,
                   tm.Durum as uygunluk_durumu,
                   COALESCE(b.basvuru_turu, 'Belirtilmemiş') as basvuru_turu,
                   s.sorgulama_durumu as sorgulama_durumu,
                   s.sorgulanan_firma, b.basvurulan_firma, s.konu,
                   s.sorgu_tarihi AS sorgu_tarihi,
                   s.created_at, s.updated_at,
                   b.basvuru_tarihi
            FROM tapu_maliye tm
            {$companyJoin}
            LEFT JOIN basvurular b ON tm.Id = b.prolegal_id
            LEFT JOIN sorgudurumu s ON tm.Id = s.prolegal_id";
    
    $whereConditions = [];
    $companyCondition = ($companyId > 0) ? "pc.company_id = {$companyId}" : '';
    $isListAllStatuses = !empty($basvuruDurumu) && !empty($sorguDurumu) && !empty($uygunlukDurumu);
    
    // Eğer tüm durumları listele ise OR ile filtrele
    if ($isListAllStatuses) {
        // Tüm Durumları Listele - her durumun tüm kayıtlarını getir
        $whereConditions[] = "(
            tm.Durum = 'Uygun' OR 
            tm.Durum = 'Uygun değil' OR 
            b.basvuru_turu = 'Küçük' OR 
            b.basvuru_turu = 'Büyük' OR 
            s.sorgulama_durumu = 'Sorguda' OR 
            s.sorgulama_durumu = 'Sırada'
        )";
    } else {
        // Normal filtreleme varsa, sıkı filtreleme yap

        // Başvuru durumu filtresi
        if (!empty($basvuruDurumu) && $basvuruDurumu !== 'Tümü') {
            $basvuruArray = explode(',', $basvuruDurumu);
            $basvuruConditions = [];
            foreach ($basvuruArray as $basvuru) {
                $basvuru = trim($basvuru);
                if ($basvuru === 'Küçük Başvuru') {
                    $basvuruConditions[] = "b.basvuru_turu IN ('Küçük', 'Küçük Başvuru')";
                } elseif ($basvuru === 'Büyük Başvuru') {
                    $basvuruConditions[] = "b.basvuru_turu IN ('Büyük', 'Büyük Başvuru')";
                } elseif ($basvuru === 'Belirtilmemiş') {
                    $basvuruConditions[] = "b.basvuru_turu IS NULL";
                }
            }
            if (!empty($basvuruConditions)) {
                $whereConditions[] = "(" . implode(" OR ", $basvuruConditions) . ")";
            }
        }
        
        // Sorgu durumu filtresi
        if (!empty($sorguDurumu) && $sorguDurumu !== 'Tümü') {
            $sorguArray = explode(',', $sorguDurumu);
            $sorguConditions = [];
            foreach ($sorguArray as $sorgu) {
                $sorgu = trim($sorgu);
                if ($sorgu === 'Sorguda') {
                    $sorguConditions[] = "s.sorgulama_durumu = 'Sorguda'";
                } elseif ($sorgu === 'Sırada') {
                    $sorguConditions[] = "s.sorgulama_durumu = 'Sırada'";
                } elseif ($sorgu === 'Sorgulandı') {
                    $sorguConditions[] = "s.sorgulama_durumu = 'Sorgulandı'";
                } elseif ($sorgu === 'Sorgulanmadı') {
                    $sorguConditions[] = "s.sorgulama_durumu IS NULL";
                }
            }
            if (!empty($sorguConditions)) {
                $whereConditions[] = "(" . implode(" OR ", $sorguConditions) . ")";
            }
        }
        
        // Uygunluk durumu filtresi
        if (!empty($uygunlukDurumu) && $uygunlukDurumu !== 'Tümü') {
            $uygunlukArray = explode(',', $uygunlukDurumu);
            $uygunlukConditions = [];
            foreach ($uygunlukArray as $uygunluk) {
                $uygunluk = trim($uygunluk);
                if ($uygunluk === 'Uygun') {
                    $uygunlukConditions[] = "tm.Durum = 'Uygun'";
                } elseif ($uygunluk === 'Uygun Değil') {
                    $uygunlukConditions[] = "tm.Durum = 'Uygun değil'";
                }
            }
            if (!empty($uygunlukConditions)) {
                $whereConditions[] = "(" . implode(" OR ", $uygunlukConditions) . ")";
            }
        }
    }

    // Tarih filtresi (sorgu / başvuru / her ikisi)
    if (!empty($dateFrom) && !empty($dateTo)) {
        $dateFromEsc = $conn->real_escape_string($dateFrom);
        $dateToEsc = $conn->real_escape_string($dateTo);

        $dateConditions = [];

        // Yardımcı: iki alanı kapsayan OR bloğu
        $dualDateCond = function ($field1, $field2) use ($dateFromEsc, $dateToEsc) {
            return "(({$field1} IS NOT NULL AND DATE({$field1}) BETWEEN '{$dateFromEsc}' AND '{$dateToEsc}') OR ({$field2} IS NOT NULL AND DATE({$field2}) BETWEEN '{$dateFromEsc}' AND '{$dateToEsc}'))";
        };

        // Özel date_type öncelikli
        if ($dateType === 'basvuru') {
            $dateConditions[] = $dualDateCond('b.basvuru_tarihi', 's.updated_at');
        } elseif ($dateType === 'sorgu') {
            $dateConditions[] = $dualDateCond('s.updated_at', 'b.basvuru_tarihi');
        } elseif ($dateType === 'all') {
            $dateConditions[] = $dualDateCond('s.updated_at', 'b.basvuru_tarihi');
        } else {
            // Aktif filtrelere göre tarih alanı seç
            $hasBasvuruFilter = !empty($basvuruDurumu) && $basvuruDurumu !== 'Tümü';
            $hasSorguFilter = !empty($sorguDurumu) && $sorguDurumu !== 'Tümü';
            $hasUygunlukFilter = !empty($uygunlukDurumu) && $uygunlukDurumu !== 'Tümü';

            if ($hasBasvuruFilter) {
                $dateConditions[] = $dualDateCond('b.basvuru_tarihi', 's.updated_at');
            }
            if ($hasSorguFilter) {
                $dateConditions[] = $dualDateCond('s.updated_at', 'b.basvuru_tarihi');
            }
            if ($hasUygunlukFilter) {
                $dateConditions[] = $dualDateCond('s.updated_at', 'b.basvuru_tarihi');
            }

            // Hiç durum filtresi yoksa COALESCE ile tüm tarihleri kapsa
            if (empty($dateConditions)) {
                $dateConditions[] = $dualDateCond('s.updated_at', 'b.basvuru_tarihi');
            }
        }

        if (!empty($dateConditions)) {
            $whereConditions[] = '(' . implode(' OR ', $dateConditions) . ')';
        }
    }
    
    // Konum filtreleri (İl/İlçe/Mahalle/Ada/Parsel)
    // Ada/Parsel her zaman tam eşleşme; il/ilçe de varsa AND ile daraltılır.
    // Mahalle filtresi, ada+parsel varken opsiyonel (yazım/aksan hatalarına takılmaması için).
    $hasAdaParsel = (!empty($adaFilter) && !empty($parselFilter));

    if (!empty($ilFilter)) {
        $ilEsc = $conn->real_escape_string($ilFilter);
        $whereConditions[] = "tm.İlBilgisi LIKE '%{$ilEsc}%'";
    }
    if (!empty($ilceFilter)) {
        $ilceEsc = $conn->real_escape_string($ilceFilter);
        $whereConditions[] = "tm.İlceBilgisi LIKE '%{$ilceEsc}%'";
    }
    if (!empty($mahalleFilter) && !$hasAdaParsel) {
        $mahalleEsc = $conn->real_escape_string($mahalleFilter);
        $whereConditions[] = "tm.MahalleBilgisi LIKE '%{$mahalleEsc}%'";
    }
    if (!empty($adaFilter)) {
        $adaEsc = $conn->real_escape_string($adaFilter);
        $whereConditions[] = "tm.AdaBilgisi = '{$adaEsc}'";
    }
    if (!empty($parselFilter)) {
        $parselEsc = $conn->real_escape_string($parselFilter);
        $whereConditions[] = "tm.ParselBilgisi = '{$parselEsc}'";
    }

    // WHERE koşullarını ekle
    if (!empty($whereConditions)) {
        // Eğer tüm durumları listele ise OR kullan, yoksa AND kullan
        if ($isListAllStatuses) {
            // Tüm Durumları Listele - OR ile birleştir, şirket filtresi varsa AND ile uygula
            $sql .= " WHERE " . ($companyCondition ? $companyCondition . " AND (" . implode(" OR ", $whereConditions) . ")" : implode(" OR ", $whereConditions));
        } else {
            // Normal filtreleme - AND ile birleştir
            if ($companyCondition) {
                $whereConditions[] = $companyCondition;
            }
            $sql .= " WHERE " . implode(" AND ", $whereConditions);
        }
    } elseif ($companyCondition) {
        // Sadece şirket filtresi varsa
        $sql .= " WHERE " . $companyCondition;
    }
    
    $sql .= " ORDER BY tm.Id DESC"; // Tüm kayıtlar
    
    // Debug: SQL sorgusunu logla
    error_log("🔍 Tüm Durumları Listele SQL: " . $sql);
    
    $result = $conn->query($sql);
    $allRecords = [];
    
    if (!$result) {
        error_log("❌ SQL Hatası: " . $conn->error);
        echo json_encode(['error' => 'SQL Error: ' . $conn->error]);
        exit;
    }
    
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $allRecords[] = $row;
        }
        
        // Debug: İlk 5 kaydın uygunluk durumunu logla
        error_log("🔍 İlk 5 kaydın uygunluk durumları:");
        for ($i = 0; $i < min(5, count($allRecords)); $i++) {
            error_log("  ID: " . $allRecords[$i]['prolegal_id'] . " - Durum: '" . $allRecords[$i]['uygunluk_durumu'] . "'");
        }
        
        // Debug: Uygun Değil kayıtlarını say
        $uygunDegilCount = 0;
        foreach ($allRecords as $record) {
            if ($record['uygunluk_durumu'] === 'Uygun Değil') {
                $uygunDegilCount++;
            }
        }
        error_log("🔍 Toplam Uygun Değil kayıt sayısı: " . $uygunDegilCount);
        
        // Debug: Tüm farklı durumları listele
        $durumlar = [];
        foreach ($allRecords as $record) {
            $durum = $record['uygunluk_durumu'];
            if (!in_array($durum, $durumlar)) {
                $durumlar[] = $durum;
            }
        }
        error_log("🔍 Database'deki tüm uygunluk durumları: " . implode(', ', $durumlar));
    }
    
    echo json_encode($allRecords);
    exit;
}

// Sorgu yönetimi kayıtlarını güncelle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'update_query_record') {
    // Başvuru ile ilgili işlemler için tabloyu garantiye al
    ensure_basvurular_table($conn);

    $propertyId = intval($_POST['property_id']);
    $basvuruDurumu = $_POST['basvuru_durumu'] ?? null;
    $sorguDurumu = $_POST['sorgu_durumu'] ?? null;
    $uygunlukDurumu = $_POST['uygunluk_durumu'] ?? null;
    $basvuruTarihi = $_POST['basvuru_tarihi'] ?? null;
    $konu = $_POST['konu'] ?? null;
    $sorgulananFirma = $_POST['sorgulanan_firma'] ?? null;
    $manualBasvurulanFirma = $_POST['basvurulan_firma'] ?? null;
    $existingKonu = null;
    
    try {
        // Eski değerleri oku (uygunluk + sorgu durumu) - audit için
        $oldDurum = null;
        $oldSorgulama = null;
        if (function_exists('audit_log')) {
            $checkOldStmt = $conn->prepare("
                SELECT tm.Durum, s.sorgulama_durumu, s.konu
                FROM tapu_maliye tm
                LEFT JOIN sorgudurumu s ON tm.Id = s.prolegal_id
                WHERE tm.Id = ?
            ");
            if ($checkOldStmt) {
                $checkOldStmt->bind_param("i", $propertyId);
                if ($checkOldStmt->execute()) {
                    $oldRes = $checkOldStmt->get_result()->fetch_assoc();
                    if ($oldRes) {
                        $oldDurum = $oldRes['Durum'] ?? null;
                        $oldSorgulama = $oldRes['sorgulama_durumu'] ?? null;
                        $existingKonu = $oldRes['konu'] ?? null;
                    }
                }
                $checkOldStmt->close();
            }
        }
        $conn->begin_transaction();
        
        // Başvuru durumunu, tarihini veya konusunu güncelle
        if ($basvuruDurumu !== null || $basvuruTarihi !== null || $konu !== null) {
            if ($basvuruDurumu === 'Küçük Başvuru') {
                $basvuruTuru = 'Küçük';
            } elseif ($basvuruDurumu === 'Büyük Başvuru') {
                $basvuruTuru = 'Büyük';
            } else {
                $basvuruTuru = null;
            }
            
            if ($basvuruTuru) {
                $companyId = isset($_POST['company_id']) ? $_POST['company_id'] : '';
                $companyName = $manualBasvurulanFirma !== null ? $manualBasvurulanFirma : $companyId;
                $konuToUse = $konu ?? $existingKonu ?? '';
                $basvuruTarihi = isset($_POST['basvuru_tarihi']) ? $_POST['basvuru_tarihi'] : date('Y-m-d');
                $stmt = $conn->prepare("INSERT INTO basvurular (prolegal_id, basvuru_turu, basvuru_sayısı, basvurulan_firma, basvuru_tarihi, konu) VALUES (?, ?, 1, ?, ?, ?) ON DUPLICATE KEY UPDATE basvuru_turu = ?, basvurulan_firma = ?, basvuru_tarihi = ?, konu = ?");
                if (!$stmt) {
                    throw new Exception("basvurular insert prepare hatası: " . $conn->error);
                }
                // 1 adet integer (prolegal_id) + 8 adet string parametre
                $stmt->bind_param("issssssss", $propertyId, $basvuruTuru, $companyName, $basvuruTarihi, $konuToUse, $basvuruTuru, $companyName, $basvuruTarihi, $konuToUse);
                if (!$stmt->execute()) {
                    $err = $stmt->error;
                    $stmt->close();
                    throw new Exception("basvurular insert execute hatası: " . $err);
                }
                $stmt->close();
            } else if ($basvuruTarihi !== null) {
                // Sadece tarih güncelleniyorsa mevcut kaydı güncelle
                $stmt = $conn->prepare("UPDATE basvurular SET basvuru_tarihi = ? WHERE prolegal_id = ?");
                if (!$stmt) {
                    throw new Exception("basvurular tarih update prepare hatası: " . $conn->error);
                }
                $stmt->bind_param("si", $basvuruTarihi, $propertyId);
                if (!$stmt->execute()) {
                    $err = $stmt->error;
                    $stmt->close();
                    throw new Exception("basvurular tarih update execute hatası: " . $err);
                }
                $stmt->close();
            } else if ($konu !== null) {
                // Sadece konu güncelleniyorsa mevcut kaydı güncelle
                $stmt = $conn->prepare("UPDATE basvurular SET konu = ? WHERE prolegal_id = ?");
                if (!$stmt) {
                    throw new Exception("basvurular konu update prepare hatası: " . $conn->error);
                }
                $stmt->bind_param("si", $konu, $propertyId);
                if (!$stmt->execute()) {
                    $err = $stmt->error;
                    $stmt->close();
                    throw new Exception("basvurular konu update execute hatası: " . $err);
                }
                $stmt->close();
            } else if ($basvuruDurumu === 'Belirtilmemiş') {
                // Belirtilmemiş seçilirse kaydı sil
                $stmt = $conn->prepare("DELETE FROM basvurular WHERE prolegal_id = ?");
                if (!$stmt) {
                    throw new Exception("basvurular delete prepare hatası: " . $conn->error);
                }
                $stmt->bind_param("i", $propertyId);
                if (!$stmt->execute()) {
                    $err = $stmt->error;
                    $stmt->close();
                    throw new Exception("basvurular delete execute hatası: " . $err);
                }
                $stmt->close();
            }

        // Başvuru girilmişse otomatik olarak sorgu durumunu "Sorgulandı",
        // uygunluk durumunu ise "Uygun" olarak ayarla (iş kuralları gereği)
        if ($basvuruTuru !== null) {
            $sorguDurumu = 'Sorgulandı';
            $uygunlukDurumu = 'Uygun';
        }
    }
        
        // Sorgu durumunu veya sorgulanan firmayı güncelle
        if ($sorguDurumu !== null || $sorgulananFirma !== null) {
            if ($sorguDurumu === 'Sorgulanmadı') {
                // Sorgulanmadı ise kaydı sil
                $stmt = $conn->prepare("DELETE FROM sorgudurumu WHERE prolegal_id = ?");
                $stmt->bind_param("i", $propertyId);
                $stmt->execute();
                $stmt->close();
            } else {
                // Önce mevcut kaydı kontrol et
                $checkStmt = $conn->prepare("SELECT id, sorgulanan_firma FROM sorgudurumu WHERE prolegal_id = ?");
                $checkStmt->bind_param("i", $propertyId);
                $checkStmt->execute();
                $existingRecord = $checkStmt->get_result()->fetch_assoc();
                $checkStmt->close();
                
                if ($existingRecord) {
                    // Mevcut kaydı güncelle
                    if ($sorguDurumu !== null && $sorgulananFirma !== null) {
                        // Hem durum hem firma güncelleniyor
                        $stmt = $conn->prepare("UPDATE sorgudurumu SET sorgulama_durumu = ?, sorgulanan_firma = ?, updated_at = NOW() WHERE prolegal_id = ?");
                        $stmt->bind_param("ssi", $sorguDurumu, $sorgulananFirma, $propertyId);
                    } else if ($sorgulananFirma !== null) {
                        // Sadece sorgulanan firma güncelleniyor
                        $stmt = $conn->prepare("UPDATE sorgudurumu SET sorgulanan_firma = ?, updated_at = NOW() WHERE prolegal_id = ?");
                        $stmt->bind_param("si", $sorgulananFirma, $propertyId);
                    } else {
                        // Sadece durum güncelleniyor - mevcut sorgulanan_firma'yı koru
                        $stmt = $conn->prepare("UPDATE sorgudurumu SET sorgulama_durumu = ?, updated_at = NOW() WHERE prolegal_id = ?");
                        $stmt->bind_param("si", $sorguDurumu, $propertyId);
                    }
                } else {
                    // Yeni kayıt ekle
                    $sorgulananFirmaValue = $sorgulananFirma !== null ? $sorgulananFirma : '';
                    $stmt = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu, sorgulanan_firma, updated_at) VALUES (?, ?, ?, NOW())");
                    $stmt->bind_param("iss", $propertyId, $sorguDurumu, $sorgulananFirmaValue);
                }
                $stmt->execute();
                $stmt->close();
            }
        }
        
        // Uygunluk durumunu güncelle
        if ($uygunlukDurumu !== null) {
            if ($uygunlukDurumu === 'Seçiniz') {
                // Seçiniz seçilirse NULL yap
                $stmt = $conn->prepare("UPDATE tapu_maliye SET Durum = NULL WHERE Id = ?");
                $stmt->bind_param("i", $propertyId);
                $stmt->execute();
                $stmt->close();
            } elseif ($uygunlukDurumu === 'Sorgulanmadı') {
                // Sorgulanmadı seçilirse 'Sorgulanmadı' yap
                $stmt = $conn->prepare("UPDATE tapu_maliye SET Durum = 'Sorgulanmadı' WHERE Id = ?");
                $stmt->bind_param("i", $propertyId);
                $stmt->execute();
                $stmt->close();
            } else {
                $stmt = $conn->prepare("UPDATE tapu_maliye SET Durum = ? WHERE Id = ?");
                $stmt->bind_param("si", $uygunlukDurumu, $propertyId);
                $stmt->execute();
                $stmt->close();
            }
        }
        
        $conn->commit();
        
        // Audit log – endpoint + eski/yeni değerler
        if (function_exists('audit_log')) {
            $meta = [
                'endpoint' => 'api.php?action=update_query_record',
                'method'   => 'POST',
                'old'      => [
                    'uygunluk'      => $oldDurum,
                    'sorgu_durumu'  => $oldSorgulama,
                ],
                'new'      => [
                    'uygunluk'      => $uygunlukDurumu,
                    'sorgu_durumu'  => $sorguDurumu,
                ],
            ];
            audit_log('update_query_record', $meta, 'property', (string)$propertyId);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Kayıt başarıyla güncellendi.',
            'updated_fields' => [
                'basvuru_durumu' => $basvuruDurumu !== null,
                'sorgu_durumu' => $sorguDurumu !== null,
                'uygunluk_durumu' => $uygunlukDurumu !== null,
                'konu' => $konu !== null,
                'sorgulanan_firma' => $sorgulananFirma !== null
            ]
        ]);
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode([
            'success' => false,
            'message' => 'Güncelleme hatası: ' . $e->getMessage()
        ]);
    }
    
    exit;
}

// Sorgu sırasından çıkar
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'remove_from_queue') {
    $queueId = intval($_POST['queue_id']);
    
    $stmt = $conn->prepare("DELETE FROM sorgudurumu WHERE id = ?");
    $stmt->bind_param("i", $queueId);
    
    if ($stmt->execute()) {
        $response = [
            "success" => true,
            "message" => "Arazi sorgu sırasından çıkarıldı."
        ];
    } else {
        $response = [
            "success" => false,
            "message" => "Arazi sorgu sırasından çıkarılamadı: " . $stmt->error
        ];
    }
    
    echo json_encode($response);
    exit;
}

// Toplu sorgu sırasına arazi ekle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'batch_add_to_queue') {
    // Output buffer'ı temizle
    ob_clean();
    $batchData = json_decode($_POST['batch_data'], true);
    
    $successCount = 0;
    $errors = [];
    
    foreach ($batchData as $item) {
        $propertyId = intval($item['property_id']);
        $companyId = intval($item['company_id']);
        $konu = $item['konu'] ?? '';
        
        if (empty($propertyId) || empty($companyId) || empty($konu)) {
            $errors[] = "Geçersiz property_id, company_id veya konu: " . json_encode($item);
            continue;
        }
        
        try {
            // Önce tapu_maliye tablosunda bu ID'nin var olup olmadığını kontrol et
            $checkTapuStmt = $conn->prepare("SELECT Id FROM tapu_maliye WHERE Id = ?");
            $checkTapuStmt->bind_param("i", $propertyId);
            $checkTapuStmt->execute();
            $tapuResult = $checkTapuStmt->get_result();
            
            if ($tapuResult->num_rows === 0) {
                $errors[] = "Property ID $propertyId tapu_maliye tablosunda bulunamadı!";
                continue;
            }
            
            // Şirket adını al
            $companyStmt = $conn->prepare("SELECT company_name FROM companies WHERE id = ?");
            $companyStmt->bind_param("i", $companyId);
            $companyStmt->execute();
            $companyResult = $companyStmt->get_result();
            
            if ($companyResult->num_rows === 0) {
                $errors[] = "Property ID $propertyId için şirket bulunamadı (Company ID: $companyId)";
                continue;
            }
            
            $companyData = $companyResult->fetch_assoc();
            $companyName = $companyData['company_name'];
            
            // sorgudurumu tablosunda kayıt var mı kontrol et
            $checkStmt = $conn->prepare("SELECT id, sorgulama_durumu FROM sorgudurumu WHERE prolegal_id = ?");
            $checkStmt->bind_param("i", $propertyId);
            $checkStmt->execute();
            $result = $checkStmt->get_result();
            
            if ($result->num_rows > 0) {
                $existingRecord = $result->fetch_assoc();
                
                // Eğer zaten 'Sırada' ise uyarı ver
                if ($existingRecord['sorgulama_durumu'] === 'Sırada') {
                    $errors[] = "Property ID $propertyId zaten sorgu sırasında!";
                    continue;
                }
                
                // Kayıt varsa ama durumu farklıysa güncelle
                $updateStmt = $conn->prepare("UPDATE sorgudurumu SET sorgulama_durumu = 'Sırada', sorgulanan_firma = ?, konu = ?, updated_at = NOW() WHERE prolegal_id = ?");
                $updateStmt->bind_param("ssi", $companyName, $konu, $propertyId);
                if ($updateStmt->execute()) {
                    $successCount++;
                } else {
                    $errors[] = "Property ID $propertyId güncellenemedi: " . $updateStmt->error;
                }
            } else {
                // Kayıt yoksa ekle
                $insertStmt = $conn->prepare("INSERT INTO sorgudurumu (prolegal_id, sorgulama_durumu, sorgulanan_firma, konu, created_at, updated_at) VALUES (?, 'Sırada', ?, ?, NOW(), NOW())");
                $insertStmt->bind_param("iss", $propertyId, $companyName, $konu);
                if ($insertStmt->execute()) {
                    $successCount++;
                } else {
                    $errors[] = "Property ID $propertyId eklenemedi: " . $insertStmt->error;
                }
            }
        } catch (Exception $e) {
            $errors[] = "Property ID $propertyId işlenirken hata: " . $e->getMessage();
        }
    }
    
    $response = [
        "success" => $successCount > 0,
        "message" => "$successCount arazi sorgu sırasına eklendi.",
        "success_count" => $successCount,
        "total_count" => count($batchData),
        "errors" => $errors
    ];
    
    echo json_encode($response);
    exit;
}

// WKT'den ilk koordinatı al (Point için)
function getFirstCoordinateFromWkt($wkt) {
    // WKT formatı: POLYGON((lng1 lat1, lng2 lat2, ...))
    if (preg_match('/POLYGON\s*\(\s*\(\s*(.+?)\s*\)\s*\)/', $wkt, $matches)) {
        $coordinates = $matches[1];
        $coordPairs = explode(',', $coordinates);
        
        if (count($coordPairs) > 0) {
            $firstPair = trim($coordPairs[0]);
            if (preg_match('/^\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*$/', $firstPair, $coordMatch)) {
                $lng = floatval($coordMatch[1]);
                $lat = floatval($coordMatch[2]);
                return $lng . ',' . $lat . ',0'; // KML format: lng,lat,altitude
            }
        }
    }
    
    return false;
}

// WKT'yi KML'e dönüştürme fonksiyonu
function convertWktToKml($wkt) {
    // WKT formatı: POLYGON((lng1 lat1, lng2 lat2, ...))
    if (preg_match('/POLYGON\s*\(\s*\(\s*(.+?)\s*\)\s*\)/', $wkt, $matches)) {
        $coordinates = $matches[1];
        
        // Koordinatları parse et
        $coords = [];
        $coordPairs = explode(',', $coordinates);
        
        foreach ($coordPairs as $pair) {
            $pair = trim($pair);
            if (preg_match('/^\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*$/', $pair, $coordMatch)) {
                $lng = floatval($coordMatch[1]);
                $lat = floatval($coordMatch[2]);
                $coords[] = $lng . ',' . $lat . ',0'; // KML format: lng,lat,altitude
            }
        }
        
        if (count($coords) >= 3) {
            $coordString = implode(' ', $coords);
            return "<Polygon><outerBoundaryIs><LinearRing><coordinates>$coordString</coordinates></LinearRing></outerBoundaryIs></Polygon>";
        }
    }
    
    return false;
}

// KML Export Endpoint - Google Earth için polygon export
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'export_kml') {
    $propertyId = $_GET['property_id'] ?? null;
    
    if (!$propertyId) {
        http_response_code(400);
        echo json_encode(['error' => 'Property ID is required']);
        exit;
    }
    
    try {
        // MySQL'de polygon'u WKT formatında al
        $sql = "SELECT 
                    Id,
                    AnaTasinmazNitelik_1,
                    AnaTasinmazNitelik_1,
                    ST_AsText(polygon) as polygon_wkt
                FROM tapu_maliye 
                WHERE Id = ? AND polygon IS NOT NULL";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $propertyId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Property not found or no polygon data']);
            exit;
        }
        
        $row = $result->fetch_assoc();
        $polygonWkt = $row['polygon_wkt'];
        $propertyName = $row['AnaTasinmazNitelik_1'] ?? 'Property ' . $propertyId;
        
        // WKT'yi KML formatına dönüştür
        $kmlGeometry = convertWktToKml($polygonWkt);
        
        if (!$kmlGeometry) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to convert polygon to KML format']);
            exit;
        }
        
        // Polygon'un ilk koordinatını al (Point için)
        $pointCoordinates = getFirstCoordinateFromWkt($polygonWkt);
        
        // KML dosyası oluştur
        $kml = '<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Property ' . htmlspecialchars($propertyName) . '</name>
        <Placemark>
            <name>' . htmlspecialchars($propertyName) . '</name>
            <description>Property ID: ' . $propertyId . '</description>
            <Style>
                <LineStyle>
                    <color>ff0000ff</color>
                    <width>2</width>
                </LineStyle>
                <PolyStyle>
                    <color>7d00ffff</color>
                </PolyStyle>
            </Style>
            ' . $kmlGeometry . '
        </Placemark>';
        
        // Point ekle (Polygon'un ilk koordinatı)
        if ($pointCoordinates) {
            $kml .= '
        <Placemark>
            <name>Property Center</name>
            <description>Property center point</description>
            <Style>
                <IconStyle>
                    <color>ff00ff00</color>
                    <scale>1.2</scale>
                </IconStyle>
            </Style>
            <Point>
                <coordinates>' . $pointCoordinates . '</coordinates>
            </Point>
        </Placemark>';
        }
        
        $kml .= '
    </Document>
</kml>';
        
        // KML dosyasını /kml/ klasörüne kaydet
        $kmlDir = __DIR__ . '/kml/';
        if (!is_dir($kmlDir)) {
            mkdir($kmlDir, 0755, true);
        }
        
        $kmlFile = $kmlDir . 'property_' . $propertyId . '.kml';
        file_put_contents($kmlFile, $kml);
        
        // Public URL oluştur
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $publicUrl = $protocol . '://' . $host . '/kml/property_' . $propertyId . '.kml';
        
        // JSON response döndür
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'kml_url' => $publicUrl,
            'property_id' => $propertyId,
            'property_name' => $propertyName
        ]);
        exit;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}

// Duplicate sorgudurumu kayıtlarını temizle
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'cleanup_duplicate_sorgudurumu') {
    try {
        // Duplicate kayıtları bul (aynı prolegal_id'ye sahip birden fazla kayıt)
        $sql = "SELECT prolegal_id, COUNT(*) as count FROM sorgudurumu GROUP BY prolegal_id HAVING COUNT(*) > 1";
        $result = $conn->query($sql);
        
        $cleaned = 0;
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $prolegalId = $row['prolegal_id'];
                
                // Her prolegal_id için en son güncellenen kaydı tut, diğerlerini sil
                $deleteSql = "DELETE s1 FROM sorgudurumu s1 
                             INNER JOIN sorgudurumu s2 
                             WHERE s1.prolegal_id = s2.prolegal_id 
                             AND s1.prolegal_id = ? 
                             AND s1.updated_at < s2.updated_at";
                $deleteStmt = $conn->prepare($deleteSql);
                $deleteStmt->bind_param("i", $prolegalId);
                $deleteStmt->execute();
                $cleaned += $deleteStmt->affected_rows;
                $deleteStmt->close();
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => "Duplicate kayıtlar temizlendi. $cleaned kayıt silindi.",
            'cleaned_count' => $cleaned
        ]);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Temizleme hatası: ' . $e->getMessage()
        ]);
    }
    exit;
}

// İmar Fonksiyonu Ana Fonksiyonları Getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_main_functions') {
    $ids = $_GET['ids'] ?? ''; // mahalle/id filtresinden gelen id listesi
    $idArray = explode(',', $ids);
    $placeholders = implode(',', array_fill(0, count($idArray), '?'));
    
    $sql = "SELECT DISTINCT ana_fonksiyon 
            FROM imar_fonksiyon 
            WHERE parcel_id IN ($placeholders) 
            ORDER BY ana_fonksiyon";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(str_repeat('i', count($idArray)), ...$idArray);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $functions = [];
    while ($row = $result->fetch_assoc()) {
        $functions[] = $row['ana_fonksiyon'];
    }
    
    echo json_encode($functions, JSON_UNESCAPED_UNICODE);
    exit;
}

// İmar Fonksiyonu Alt Fonksiyonları Getir
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_sub_functions') {
    $ids = $_GET['ids'] ?? '';
    $mainFunction = $_GET['main_function'] ?? '';
    $idArray = explode(',', $ids);
    $placeholders = implode(',', array_fill(0, count($idArray), '?'));
    
    $sql = "SELECT DISTINCT alt_fonksiyon 
            FROM imar_fonksiyon 
            WHERE parcel_id IN ($placeholders) 
              AND ana_fonksiyon = ?
            ORDER BY alt_fonksiyon";
    
    $stmt = $conn->prepare($sql);
    $types = str_repeat('i', count($idArray)) . 's';
    $stmt->bind_param($types, ...array_merge($idArray, [$mainFunction]));
    $stmt->execute();
    $result = $stmt->get_result();
    
    $subFunctions = [];
    while ($row = $result->fetch_assoc()) {
        $subFunctions[] = $row['alt_fonksiyon'];
    }
    
    echo json_encode($subFunctions, JSON_UNESCAPED_UNICODE);
    exit;
}


// ===================================================================================
// İMAR FONKSİYONLARI OPTİMİZE EDİLMİŞ SİSTEM - vw_imar_filtre KULLANIMI
// ===================================================================================

// Ana fonksiyonları getir (vw_imar_filtre kullanarak)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_imar_ana_fonksiyonlari') {
    $il_id = $_GET['il_id'] ?? '';
    $ilce_id = $_GET['ilce_id'] ?? '';
    $mahalle_id = $_GET['mahalle_id'] ?? '';
    
    error_log("🔍 [DEBUG] Ana fonksiyonlar API çağrıldı - Parametreler: il_id=$il_id, ilce_id=$ilce_id, mahalle_id=$mahalle_id");
    
    // View varlığını kontrol et
    $checkView = $conn->query("SHOW TABLES LIKE 'vw_imar_filtre'");
    if ($checkView->num_rows === 0) {
        error_log("❌ [DEBUG] vw_imar_filtre view'ı bulunamadı");
        echo json_encode(['error' => 'vw_imar_filtre view bulunamadı'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Eğer hiç parametre yoksa boş array döndür
    if (empty($il_id) && empty($ilce_id) && empty($mahalle_id)) {
        echo json_encode([], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    $where_conditions = [];
    $params = [];
    $param_types = "";
    
    if (!empty($il_id)) {
        $where_conditions[] = "il_id = ?";
        $params[] = $il_id;
        $param_types .= "i";
    }
    if (!empty($ilce_id)) {
        $where_conditions[] = "ilce_id = ?";
        $params[] = $ilce_id;
        $param_types .= "i";
    }
    if (!empty($mahalle_id)) {
        $where_conditions[] = "mahalle_id = ?";
        $params[] = $mahalle_id;
        $param_types .= "i";
    }
    
    $where_conditions[] = "is_current = 1";
    $where_conditions[] = "ana_fonksiyon_ad IS NOT NULL";
    $where_conditions[] = "ana_fonksiyon_ad != ''";
    
    $where_clause = implode(" AND ", $where_conditions);
    $sql = "SELECT DISTINCT ana_fonksiyon_id, ana_fonksiyon_ad 
            FROM vw_imar_filtre 
            WHERE $where_clause 
            ORDER BY ana_fonksiyon_ad";
    
    error_log("🔍 [DEBUG] Ana fonksiyonlar SQL: $sql");
    error_log("🔍 [DEBUG] Ana fonksiyonlar Parametreler: " . json_encode($params));
    error_log("🔍 [DEBUG] Ana fonksiyonlar Parametre tipleri: $param_types");
    
    $start_time = microtime(true);
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ [DEBUG] Ana fonksiyonlar Prepare failed: " . $conn->error);
        die("Prepare statement failed: " . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($param_types, ...$params);
    }
    
        $stmt->execute();
        $result = $stmt->get_result();
        
    $anaFonksiyonlar = [];
        while ($row = $result->fetch_assoc()) {
        $anaFonksiyonlar[] = [
            'id' => $row['ana_fonksiyon_id'],
            'name' => $row['ana_fonksiyon_ad']
        ];
    }
    
    $end_time = microtime(true);
    $execution_time = ($end_time - $start_time) * 1000; // Convert to milliseconds
    
    error_log("⏱️ [DEBUG] Ana fonksiyonlar SQL execution time: " . number_format($execution_time, 2) . "ms");
    error_log("📊 [DEBUG] Ana fonksiyonlar sonuç sayısı: " . count($anaFonksiyonlar));
    error_log("📋 [DEBUG] Ana fonksiyonlar sonuç: " . json_encode($anaFonksiyonlar));
    
    echo json_encode($anaFonksiyonlar, JSON_UNESCAPED_UNICODE);
    exit;
}

// Alt fonksiyonları getir (ana fonksiyon seçimine göre)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_imar_alt_fonksiyonlari') {
    $il_id = $_GET['il_id'] ?? '';
    $ilce_id = $_GET['ilce_id'] ?? '';
    $mahalle_id = $_GET['mahalle_id'] ?? '';
    $ana_fonksiyon_id = $_GET['ana_fonksiyon_id'] ?? '';
    
    error_log("🔍 [DEBUG] Alt fonksiyonlar API çağrıldı - Parametreler: il_id=$il_id, ilce_id=$ilce_id, mahalle_id=$mahalle_id, ana_fonksiyon_id=$ana_fonksiyon_id");
    
    // Ana fonksiyon ID'lerini işle
    if (!empty($ana_fonksiyon_id)) {
        $ana_fonksiyon_id_decoded = urldecode($ana_fonksiyon_id);
        $ana_fonksiyon_array = explode(',', $ana_fonksiyon_id_decoded);
        $ana_fonksiyon_array = array_map('trim', $ana_fonksiyon_array);
        $ana_fonksiyon_array = array_filter($ana_fonksiyon_array);
        error_log("🔍 [DEBUG] Alt fonksiyonlar - İşlenmiş ana fonksiyon ID'leri: " . json_encode($ana_fonksiyon_array));
    }
    
        $where_conditions = [];
        $params = [];
        $param_types = "";
        
    if (!empty($il_id)) {
            $where_conditions[] = "il_id = ?";
        $params[] = $il_id;
            $param_types .= "i";
        }
    if (!empty($ilce_id)) {
            $where_conditions[] = "ilce_id = ?";
        $params[] = $ilce_id;
            $param_types .= "i";
        }
    if (!empty($mahalle_id)) {
            $where_conditions[] = "mahalle_id = ?";
        $params[] = $mahalle_id;
            $param_types .= "i";
        }
    if (!empty($ana_fonksiyon_id)) {
        // URL decode ve virgülle ayrılmış değerleri işle
        $ana_fonksiyon_id = urldecode($ana_fonksiyon_id);
        $ana_fonksiyon_array = explode(',', $ana_fonksiyon_id);
        $ana_fonksiyon_array = array_map('trim', $ana_fonksiyon_array);
        $ana_fonksiyon_array = array_filter($ana_fonksiyon_array); // Boş değerleri kaldır
        
        if (!empty($ana_fonksiyon_array)) {
            $ana_placeholders = implode(',', array_fill(0, count($ana_fonksiyon_array), '?'));
            $where_conditions[] = "ana_fonksiyon_id IN ($ana_placeholders)";
            foreach ($ana_fonksiyon_array as $ana_id) {
                $params[] = $ana_id;
                $param_types .= "i";
            }
        }
    }
    
    $where_conditions[] = "is_current = 1";
    $where_conditions[] = "alt_fonksiyon_ad IS NOT NULL";
    $where_conditions[] = "alt_fonksiyon_ad != ''";
    
    $where_clause = implode(" AND ", $where_conditions);
    $sql = "SELECT DISTINCT alt_fonksiyon_id, alt_fonksiyon_ad 
            FROM vw_imar_filtre 
            WHERE $where_clause 
            ORDER BY alt_fonksiyon_ad";
    
    error_log("🔍 [DEBUG] Alt fonksiyonlar SQL: $sql");
    error_log("🔍 [DEBUG] Alt fonksiyonlar Parametreler: " . json_encode($params));
    error_log("🔍 [DEBUG] Alt fonksiyonlar Parametre tipleri: $param_types");
    
    $start_time = microtime(true);
        
        $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ [DEBUG] Alt fonksiyonlar Prepare failed: " . $conn->error);
        die("Prepare statement failed: " . $conn->error);
    }
    
        if (!empty($params)) {
            $stmt->bind_param($param_types, ...$params);
        }
    
        $stmt->execute();
        $result = $stmt->get_result();
        
    $altFonksiyonlar = [];
        while ($row = $result->fetch_assoc()) {
        $altFonksiyonlar[] = [
            'id' => $row['alt_fonksiyon_id'],
            'name' => $row['alt_fonksiyon_ad']
        ];
        }
        
    $end_time = microtime(true);
    $execution_time = ($end_time - $start_time) * 1000; // Convert to milliseconds
    
    error_log("⏱️ [DEBUG] Alt fonksiyonlar SQL execution time: " . number_format($execution_time, 2) . "ms");
    error_log("📊 [DEBUG] Alt fonksiyonlar sonuç sayısı: " . count($altFonksiyonlar));
    error_log("📋 [DEBUG] Alt fonksiyonlar sonuç: " . json_encode($altFonksiyonlar));
    
    echo json_encode($altFonksiyonlar, JSON_UNESCAPED_UNICODE);
    exit;
}

// Harici İmar API proxy (il/ilçe/mahalle/ada/parsel ile sorgu atar)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'imar_api_query') {
    $p = json_decode(file_get_contents('php://input'), true) ?? [];
    $il = trim($p['il'] ?? '');
    $ilce = trim($p['ilce'] ?? '');
    $mahalle = trim($p['mahalle'] ?? '');
    $ada = trim($p['ada'] ?? '');
    $parsel = trim($p['parsel'] ?? '');

    $missing = [];
    if ($il === '') $missing[] = 'il';
    if ($ilce === '') $missing[] = 'ilce';
    if ($mahalle === '') $missing[] = 'mahalle';
    if ($ada === '') $missing[] = 'ada';
    if ($parsel === '') $missing[] = 'parsel';

    if ($missing) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Eksik alanlar: ' . implode(', ', $missing)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Konfigürasyon (opsiyonel dosya: imar_config.php -> ['api_url' => '', 'headers' => ['Authorization' => 'Bearer ...']])
    $imarConfig = [];
    $imarCfgPath = __DIR__ . '/imar_config.php';
    if (file_exists($imarCfgPath)) {
        $cfg = include $imarCfgPath;
        if (is_array($cfg)) $imarConfig = $cfg;
    }

    $apiUrl = $imarConfig['api_url'] ?? getenv('IMAR_API_URL') ?: "https://imar-app-rho.vercel.app/api/query";
    $extraHeaders = [];
    if (!empty($imarConfig['headers']) && is_array($imarConfig['headers'])) {
        foreach ($imarConfig['headers'] as $hk => $hv) {
            if ($hk === '' || $hv === '' || $hv === null) continue;
            $extraHeaders[] = $hk . ': ' . $hv;
        }
    }
    $payload = json_encode([
        'il' => $il,
        'ilce' => $ilce,
        'mahalle' => $mahalle,
        'ada' => $ada,
        'parsel' => $parsel
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($apiUrl);
    $headers = [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload)
    ];
    if ($extraHeaders) {
        $headers = array_merge($headers, $extraHeaders);
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'message' => 'İmar API bağlantı hatası',
            'error' => $curlError
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $decoded = json_decode($response, true);
    $jsonErr = json_last_error();
    $rawSnippet = $jsonErr === JSON_ERROR_NONE ? null : mb_substr($response ?? '', 0, 500);

    // Başarı kriteri: HTTP 2xx + geçerli JSON + (varsa) status = Success
    $success = ($statusCode >= 200 && $statusCode < 300) && ($jsonErr === JSON_ERROR_NONE);
    $message = '';

    if ($jsonErr !== JSON_ERROR_NONE) {
        $success = false;
        $message = 'Geçersiz JSON yanıtı';
    } elseif (isset($decoded['status']) && strtolower($decoded['status']) !== 'success') {
        $success = false;
        $message = $decoded['message'] ?? $decoded['full_result'] ?? "HTTP {$statusCode}";
    } elseif (!$success) {
        $message = $decoded['message'] ?? "HTTP {$statusCode}";
    }

    echo json_encode([
        'success' => $success,
        'status_code' => $statusCode,
        'message' => $message,
        'data' => $jsonErr === JSON_ERROR_NONE ? $decoded : null,
        'raw' => $jsonErr === JSON_ERROR_NONE ? null : $rawSnippet
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// İmar detay bilgilerini getir (modal için)
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET['action']) && $_GET['action'] === 'get_imar_detay') {
    $tapu_id = $_GET['tapu_id'] ?? '';
    
    error_log("🔍 [DEBUG] İmar detay API çağrıldı - tapu_id: $tapu_id");
    
    if (empty($tapu_id)) {
        echo json_encode(['error' => 'tapu_id parametresi gerekli']);
    exit;
}

    $sql = "SELECT 
                imar_detay
            FROM imar_fonksiyon 
            WHERE tapu_id = ? AND is_current = 1
            LIMIT 1";
    
    error_log("🔍 [DEBUG] İmar detay SQL: $sql");
    error_log("🔍 [DEBUG] İmar detay Parametre: $tapu_id");
    
    $start_time = microtime(true);
    
        $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("❌ [DEBUG] İmar detay Prepare failed: " . $conn->error);
        die("Prepare statement failed: " . $conn->error);
    }
    
    $stmt->bind_param("i", $tapu_id);
        $stmt->execute();
        $result = $stmt->get_result();
    
    $imarDetay = [];
    if ($row = $result->fetch_assoc()) {
        $imarDetay = [
            'imar_detay' => $row['imar_detay']
        ];
    }
    
    $end_time = microtime(true);
    $execution_time = ($end_time - $start_time) * 1000;
    
    error_log("⏱️ [DEBUG] İmar detay SQL execution time: " . number_format($execution_time, 2) . "ms");
    error_log("📊 [DEBUG] İmar detay sonuç: " . json_encode($imarDetay));
    
    echo json_encode($imarDetay, JSON_UNESCAPED_UNICODE);
    exit;
}

// Bağlantıyı kapat - EN SONDA OLMALI
// $conn->close(); // Bu satır endpoint'lerden sonra olmalı

// Partner'ları getir (user_role='partner' olan kullanıcılar)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_partners') {
    $stmt = $conn->prepare("SELECT DISTINCT u.user_id, u.user_name
FROM requests r
JOIN users u ON u.user_id = r.partner_user_id
ORDER BY u.user_name;");
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'SQL execute failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $partners = [];
    while ($row = $result->fetch_assoc()) {
        $partners[] = [
            'id' => $row['user_id'],
            'name' => $row['user_name']
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $partners], JSON_UNESCAPED_UNICODE);
    exit;
}

// Firmaları getir (firms tablosundan)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_firms') {
    $stmt = $conn->prepare("SELECT firm_id, firm_name FROM firms ORDER BY firm_name ASC");
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'SQL execute failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $firms = [];
    while ($row = $result->fetch_assoc()) {
        $firms[] = [
            'id' => $row['firm_id'],
            'name' => $row['firm_name']
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $firms], JSON_UNESCAPED_UNICODE);
    exit;
}

// Talep statülerini getir (request_status tablosundan)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_request_statuses') {
    $stmt = $conn->prepare("SELECT status_id, status_name, is_final FROM request_status ORDER BY status_id ASC");
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'SQL execute failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $statuses = [];
    while ($row = $result->fetch_assoc()) {
        $statuses[] = [
            'id' => $row['status_id'],
            'name' => $row['status_name'],
            'is_final' => (bool)$row['is_final']
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $statuses], JSON_UNESCAPED_UNICODE);
    exit;
}

// Araştırma statülerini getir (research_status tablosundan)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_research_statuses') {
    $stmt = $conn->prepare("SELECT status_id, status_name FROM research_status ORDER BY status_id ASC");
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'SQL execute failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $statuses = [];
    while ($row = $result->fetch_assoc()) {
        $statuses[] = [
            'id' => $row['status_id'],
            'name' => $row['status_name']
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $statuses], JSON_UNESCAPED_UNICODE);
    exit;
}

// Araştırma statü geçmişi - research_requests.created_at kullanarak
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_research_status_history') {
    $researchId = intval($_GET['research_id'] ?? 0);
    
    if ($researchId <= 0) {
        echo json_encode(['success' => false, 'error' => 'research_id gerekli']);
        exit;
    }
    
    // research_requests tablosundan created_at ve status_id al
    $sql = "SELECT 
                status_id,
                created_at as changed_at
            FROM research_requests
            WHERE research_id = ?";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    
    $stmt->bind_param("i", $researchId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $history = [];
    if ($row = $result->fetch_assoc()) {
        $history[] = [
            'status_id' => (int)$row['status_id'],
            'changed_at' => $row['changed_at']
        ];
    }
    
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $history], JSON_UNESCAPED_UNICODE);
    exit;
}

// Statü geçmişi - request_status_history tablosundan tarihleri getir
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_status_history') {
    $requestId = isset($_GET['request_id']) ? intval($_GET['request_id']) : 0;
    
    if ($requestId <= 0) {
        echo json_encode(['success' => false, 'error' => 'request_id gerekli']);
        exit;
    }
    
    $sql = "SELECT 
                h.new_status_id,
                h.changed_at,
                s.status_name
            FROM request_status_history h
            JOIN request_status s ON s.status_id = h.new_status_id
            WHERE h.request_id = ?
            ORDER BY h.changed_at ASC";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    
    $stmt->bind_param("i", $requestId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $history = [];
    while ($row = $result->fetch_assoc()) {
        $history[] = [
            'status_id' => (int)$row['new_status_id'],
            'status_name' => $row['status_name'],
            'changed_at' => $row['changed_at']
        ];
    }
    
    $stmt->close();
    echo json_encode(['success' => true, 'data' => $history], JSON_UNESCAPED_UNICODE);
    exit;
}

// Requests tablosundaki il_id'lere göre illeri getir (illiste.json'dan)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_request_ils') {
    // Requests tablosundan DISTINCT il_id'leri al
    $stmt = $conn->prepare("SELECT DISTINCT il_id FROM requests WHERE il_id IS NOT NULL AND il_id > 0");
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'SQL prepare failed: ' . $conn->error]);
        exit;
    }
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'SQL execute failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $ilIds = [];
    while ($row = $result->fetch_assoc()) {
        $ilIds[] = (int)$row['il_id'];
    }
    $stmt->close();
    
    // Eğer hiç il_id yoksa boş dizi döndür
    if (empty($ilIds)) {
        echo json_encode(['success' => true, 'data' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // illiste.json dosyasını oku
    $jsonPath = __DIR__ . '/il/illiste.json';
    if (!file_exists($jsonPath)) {
        echo json_encode(['success' => false, 'error' => 'illiste.json dosyası bulunamadı']);
        exit;
    }
    
    $jsonContent = file_get_contents($jsonPath);
    $ilData = json_decode($jsonContent, true);
    
    if (!$ilData || !isset($ilData['features']) || !is_array($ilData['features'])) {
        echo json_encode(['success' => false, 'error' => 'illiste.json formatı geçersiz']);
        exit;
    }
    
    // Sadece requests tablosunda bulunan il_id'lere sahip illeri filtrele
    $matchedIls = [];
    foreach ($ilData['features'] as $feature) {
        if (isset($feature['properties']['id']) && in_array((int)$feature['properties']['id'], $ilIds, true)) {
            $matchedIls[] = [
                'id' => (int)$feature['properties']['id'],
                'name' => $feature['properties']['text'] ?? ''
            ];
        }
    }
    
    // İl adına göre sırala
    usort($matchedIls, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    echo json_encode(['success' => true, 'data' => $matchedIls], JSON_UNESCAPED_UNICODE);
    exit;
}

// Dashboard KPI Endpoint - Performans Grafikleri
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_dashboard_kpi') {
    $data = [];
    
    try {
        // 1. Partner başına talep / toplam talepler
        $sql1 = "SELECT u.user_name AS partner, COUNT(r.request_id) AS toplam_talep 
                 FROM requests r 
                 JOIN users u ON u.user_id = r.partner_user_id 
                 GROUP BY u.user_id";
        $result1 = $conn->query($sql1);
        $data['partner_talepler'] = [];
        if ($result1) {
            while ($row = $result1->fetch_assoc()) {
                $data['partner_talepler'][] = $row;
            }
        }
        
        // 2. Partner taleplerinin iptal / park oranı
        $sql2 = "SELECT u.user_name AS partner,
                        SUM(CASE WHEN r.status_id = 10 THEN 1 ELSE 0 END) AS iptal_park,
                        COUNT(r.request_id) AS toplam,
                        ROUND(SUM(CASE WHEN r.status_id = 10 THEN 1 ELSE 0 END) / COUNT(r.request_id) * 100, 2) AS oran
                 FROM requests r
                 JOIN users u ON u.user_id = r.partner_user_id
                 GROUP BY u.user_id";
        $result2 = $conn->query($sql2);
        $data['iptal_oranlari'] = [];
        if ($result2) {
            while ($row = $result2->fetch_assoc()) {
                $data['iptal_oranlari'][] = $row;
            }
        }
        
        // 3. Partner taleplerinin sözleşmeye dönme oranı
        $sql3 = "SELECT u.user_name AS partner,
                        SUM(CASE WHEN r.sozlesme_var_mi = 1 THEN 1 ELSE 0 END) AS sozlesmeye_donen,
                        COUNT(r.request_id) AS toplam,
                        ROUND(SUM(CASE WHEN r.sozlesme_var_mi = 1 THEN 1 ELSE 0 END) / COUNT(r.request_id) * 100, 2) AS oran
                 FROM requests r
                 JOIN users u ON u.user_id = r.partner_user_id
                 GROUP BY u.user_id";
        $result3 = $conn->query($sql3);
        $data['sozlesme_oranlari'] = [];
        if ($result3) {
            while ($row = $result3->fetch_assoc()) {
                $data['sozlesme_oranlari'][] = $row;
            }
        }
        
        // 4. Statülerde ne kadar vakit geçirmiş (talep bazlı)
        // Not: LEAD() window function MySQL 8.0+ gerektirir, alternatif olarak basitleştirilmiş sorgu
        $sql4 = "SELECT r.request_id, s.status_name,
                        TIMESTAMPDIFF(HOUR, h.changed_at,
                            (SELECT changed_at FROM request_status_history h2 
                             WHERE h2.request_id = h.request_id 
                             AND h2.changed_at > h.changed_at 
                             ORDER BY h2.changed_at ASC LIMIT 1)
                        ) AS gecirilen_saat
                 FROM request_status_history h
                 JOIN request_status s ON s.status_id = h.new_status_id
                 JOIN requests r ON r.request_id = h.request_id
                 ORDER BY r.request_id, h.changed_at";
        $result4 = $conn->query($sql4);
        $data['statu_sureleri'] = [];
        if ($result4) {
            while ($row = $result4->fetch_assoc()) {
                $data['statu_sureleri'][] = $row;
            }
        }
        
        // 5. İl bazlı performans
        $sql5 = "SELECT il_id, COUNT(*) AS toplam_talep 
                 FROM requests 
                 WHERE il_id IS NOT NULL
                 GROUP BY il_id";
        $result5 = $conn->query($sql5);
        $data['il_performans'] = [];
        if ($result5) {
            while ($row = $result5->fetch_assoc()) {
                // İl adını illiste.json'dan al
                $ilId = (int)$row['il_id'];
                $jsonPath = __DIR__ . '/il/illiste.json';
                $ilName = 'İl #' . $ilId;
                if (file_exists($jsonPath)) {
                    $jsonContent = file_get_contents($jsonPath);
                    $ilData = json_decode($jsonContent, true);
                    if ($ilData && isset($ilData['features'])) {
                        foreach ($ilData['features'] as $feature) {
                            if (isset($feature['properties']['id']) && (int)$feature['properties']['id'] === $ilId) {
                                $ilName = $feature['properties']['text'] ?? $ilName;
                                break;
                            }
                        }
                    }
                }
                $data['il_performans'][] = [
                    'il_id' => $ilId,
                    'il_name' => $ilName,
                    'toplam_talep' => (int)$row['toplam_talep']
                ];
            }
        }
        
        // 6. Partnerde bekleme süresi (2 adımlı)
        $sql6 = "SELECT r.request_id,
                        TIMESTAMPDIFF(HOUR,
                            (SELECT changed_at FROM request_status_history WHERE request_id = r.request_id AND new_status_id = 1 LIMIT 1),
                            (SELECT changed_at FROM request_status_history WHERE request_id = r.request_id AND new_status_id = 2 LIMIT 1)
                        ) AS bekleme_1,
                        TIMESTAMPDIFF(HOUR,
                            (SELECT changed_at FROM request_status_history WHERE request_id = r.request_id AND new_status_id = 2 LIMIT 1),
                            (SELECT changed_at FROM request_status_history WHERE request_id = r.request_id AND new_status_id = 3 LIMIT 1)
                        ) AS bekleme_2
                 FROM requests r";
        $result6 = $conn->query($sql6);
        $data['bekleme_sureleri'] = [];
        if ($result6) {
            while ($row = $result6->fetch_assoc()) {
                $data['bekleme_sureleri'][] = $row;
            }
        }
        
        // 7. Acil taleplerin sözleşmeye dönme oranı (prolegal önceliği)
        $sql7 = "SELECT priority AS oncelik,
                        COUNT(*) AS toplam,
                        SUM(CASE WHEN sozlesme_var_mi = 1 THEN 1 ELSE 0 END) AS sozlesmeye_donen,
                        ROUND(SUM(CASE WHEN sozlesme_var_mi = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS oran
                 FROM requests
                 GROUP BY priority";
        $result7 = $conn->query($sql7);
        $data['acil_talepler'] = [];
        if ($result7) {
            while ($row = $result7->fetch_assoc()) {
                $data['acil_talepler'][] = $row;
            }
        }
        
        echo json_encode([
            'success' => true,
            'data' => $data
        ], JSON_UNESCAPED_UNICODE);
        exit;
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Poligon ile sorgu endpoint'i
if ($_SERVER["REQUEST_METHOD"] === "GET" && isset($_GET['action']) && $_GET['action'] === 'query_by_polygon') {
    $polygonGeoJson = isset($_GET['polygon']) ? $_GET['polygon'] : null;
    $araziMin = isset($_GET['araziMin']) ? floatval($_GET['araziMin']) : null;
    $araziMax = isset($_GET['araziMax']) ? floatval($_GET['araziMax']) : null;
    
    if (!$polygonGeoJson) {
        echo json_encode([
            'success' => false,
            'message' => 'Polygon parametresi gerekli'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // GeoJSON'u parse et
    $polygonData = json_decode($polygonGeoJson, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($polygonData)) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz GeoJSON formatı'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // GeoJSON'u MySQL WKT formatına çevir
    $wktPolygon = null;
    if (isset($polygonData['type']) && $polygonData['type'] === 'Polygon' && isset($polygonData['coordinates'])) {
        $coords = $polygonData['coordinates'][0]; // İlk ring (dış ring)
        $wktCoords = [];
        foreach ($coords as $coord) {
            $wktCoords[] = $coord[0] . ' ' . $coord[1]; // lng lat
        }
        $wktPolygon = 'POLYGON((' . implode(', ', $wktCoords) . '))';
    } elseif (isset($polygonData['type']) && $polygonData['type'] === 'MultiPolygon' && isset($polygonData['coordinates'])) {
        // MultiPolygon için ilk poligonu al
        $coords = $polygonData['coordinates'][0][0];
        $wktCoords = [];
        foreach ($coords as $coord) {
            $wktCoords[] = $coord[0] . ' ' . $coord[1];
        }
        $wktPolygon = 'POLYGON((' . implode(', ', $wktCoords) . '))';
    }
    
    if (!$wktPolygon) {
        echo json_encode([
            'success' => false,
            'message' => 'Geçersiz poligon formatı'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // SQL sorgusu
    $sql = "SELECT 
                tm.*, 
                ST_AsText(tm.polygon) as polygon_text, 
                tm.prolegal_not, 
                tm.not_rating, 
                tm.AnaTasinmazNitelik_1,
                s.sorgulama_durumu,
                b.basvuru_turu,
                b.basvuru_sayısı,
                b.basvurulan_firma,
                vf.ana_fonksiyon_ad,
                vf.alt_fonksiyon_ad,
                vf.ana_fonksiyon_id,
                vf.alt_fonksiyon_id
            FROM tapu_maliye tm
            LEFT JOIN sorgudurumu s ON tm.Id = s.prolegal_id
            LEFT JOIN basvurular b ON tm.Id = b.prolegal_id
            LEFT JOIN vw_imar_filtre vf ON tm.Id = vf.tapu_id AND vf.is_current = 1
            WHERE tm.polygon IS NOT NULL 
              AND ST_Intersects(tm.polygon, ST_GeomFromText(?))
              AND tm.Hisse = 1
              AND tm.AnaTasinmazNitelik_2 = 'arazi'";
    
    // Alan filtresi ekle
    if ($araziMin !== null && $araziMin > 0) {
        $sql .= " AND tm.YuzolcumBilgisi/1000 >= ?";
    }
    if ($araziMax !== null && $araziMax > 0) {
        $sql .= " AND tm.YuzolcumBilgisi/1000 <= ?";
    }
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'message' => 'Sorgu hazırlanamadı: ' . $conn->error
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Parametreleri bağla
    $bindTypes = 's';
    $bindParams = [$wktPolygon];
    
    if ($araziMin !== null && $araziMin > 0) {
        $bindTypes .= 'd';
        $bindParams[] = $araziMin; // /1000 kaldırıldı, direkt değer kullanılıyor
    }
    if ($araziMax !== null && $araziMax > 0) {
        $bindTypes .= 'd';
        $bindParams[] = $araziMax; // /1000 kaldırıldı, direkt değer kullanılıyor
    }
    
    $stmt->bind_param($bindTypes, ...$bindParams);
    
    if (!$stmt->execute()) {
        echo json_encode([
            'success' => false,
            'message' => 'Sorgu çalıştırılamadı: ' . $stmt->error
        ], JSON_UNESCAPED_UNICODE);
        $stmt->close();
        exit;
    }
    
    $result = $stmt->get_result();
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    $stmt->close();
    
    // GeoJSON formatına çevir
    $responses = [];
    foreach ($data as $item) {
        $responses[] = [
            "status" => 200,
            "data" => [
                "type" => "Feature",
                "geometry" => [
                    "type" => "Polygon",
                    "coordinates" => processPolygon($item['polygon_text'])
                ],
                "properties" => [
                    "id" => $item['Id'] ?? "",
                    "ilceAd" => $item['İlceBilgisi'] ?? "",
                    "mevkii" => "",
                    "ilId" => "",
                    "durum" => $item['Durum'] ?? "",
                    "ilceId" => "",
                    "zeminKmdurum" => "",
                    "parselNo" => $item['ParselBilgisi'],
                    "mahalleAd" => $item['MahalleBilgisi'],
                    "ozet" => $item['MahalleBilgisi'] . "-" . $item['AdaBilgisi'] . "/" . $item['ParselBilgisi'],
                    "gittigiParselListe" => "",
                    "hisse" => ($item['Hisse'] === null || $item['Hisse'] === '' ? '' : round((float)$item['Hisse'] * 100) . '%'),
                    "gittigiParselSebep" => "",
                    "alan" => formatYuzolcum($item['YuzolcumBilgisi']),
                    "adaNo" => $item['AdaBilgisi'],
                    "nitelik" => $item['AnaTasinmazNitelik_1'],
                    "ilAd" => $item['İlBilgisi'] ?? "",
                    "mahalleId" => $item['mahalle_id'],
                    "pafta" => "",
                    "basvuru_durumu" => $item['basvuru_durumu_aktif'] ?? "",
                    "basvuru_turu" => $item['basvuru_turu'] ?? "",
                    "basvuru_sayısı" => $item['basvuru_sayısı'] ?? "",
                    "basvurulan_firma" => $item['basvurulan_firma'] ?? "",
                    "adaParsel" => $item['AdaBilgisi'] . "/" . $item['ParselBilgisi'],
                    "imarFonksiyon" => (function() use ($item) {
                        $ana = $item['ana_fonksiyon_ad'] ?? "";
                        $alt = $item['alt_fonksiyon_ad'] ?? "";
                        $result = $ana;
                        if (!empty($ana) && !empty($alt)) {
                            $result .= " - " . $alt;
                        }
                        return $result;
                    })(),
                    "sorguDurumu" => $item['sorgulama_durumu'] ?? "",
                    "prolegal_not" => $item['prolegal_not'] ?? "",
                    "not_rating" => $item['not_rating'] ?? ""
                ]
            ],
            "status" => 200
        ];
    }
    
    echo json_encode($responses, JSON_UNESCAPED_SLASHES);
    exit;
}

// Eğer hiçbir endpoint'e ulaşamazsa, 405 Method Not Allowed döndür
http_response_code(405);
echo json_encode([
    'error' => 'Method not allowed or invalid action',
    'status' => 405
]);
exit;

// ===================================================================================
// DOSYA SONU - BAĞLANTI KAPATMA
// ===================================================================================
// Bağlantıyı kapat (tüm endpoint'ler işlendikten sonra)
$conn->close();
?>
