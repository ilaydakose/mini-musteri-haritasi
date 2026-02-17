<?php
// Basit audit ve login log fonksiyonları
// MySQL bağlantısı (api.php ile aynı bilgiler)

function get_audit_db_connection()
{
    static $conn = null;
    if ($conn !== null) {
        return $conn;
    }

    $servername = "localhost";
    $username   = "root";
    $password   = "";
    $dbname     = "tapu_backup";

    mysqli_report(MYSQLI_REPORT_OFF);

    try {
        $conn = @new mysqli($servername, $username, $password, $dbname);
        if ($conn->connect_error) {
            error_log("❌ Audit DB bağlantı hatası: " . $conn->connect_error);
            return null;
        }
        $conn->set_charset("utf8mb4");
    } catch (Exception $e) {
        error_log("❌ Audit DB exception: " . $e->getMessage());
        return null;
    }

    // Tabloları yoksa oluştur
    create_audit_tables_if_needed($conn);

    return $conn;
}

function create_audit_tables_if_needed(mysqli $conn): void
{
    // user_login_log tablosu
    $sqlLogin = "
        CREATE TABLE IF NOT EXISTS user_login_log (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            success TINYINT(1) NOT NULL DEFAULT 0,
            reason VARCHAR(100) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    // audit_log tablosu
    $sqlAudit = "
        CREATE TABLE IF NOT EXISTS audit_log (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NULL,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(50) NULL,
            resource_id VARCHAR(100) NULL,
            meta_json TEXT NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $conn->query($sqlLogin);
    $conn->query($sqlAudit);
}

/**
 * Login denemelerini logla
 *
 * @param string|null $username
 * @param bool        $success
 * @param string      $reason   'ok', 'invalid_credentials', 'rate_limited' vb.
 */
function log_login_attempt(?string $username, bool $success, string $reason): void
{
    $conn = get_audit_db_connection();
    if (!$conn) {
        return;
    }

    $ip        = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

    $stmt = $conn->prepare("
        INSERT INTO user_login_log (username, ip_address, user_agent, success, reason)
        VALUES (?, ?, ?, ?, ?)
    ");
    if (!$stmt) {
        error_log("❌ log_login_attempt prepare hatası: " . $conn->error);
        return;
    }

    $successInt = $success ? 1 : 0;
    // success TINYINT olduğu için integer olarak bind edelim
    $stmt->bind_param('sssis', $username, $ip, $userAgent, $successInt, $reason);
    $stmt->execute();
    $stmt->close();
}

/**
 * Genel aksiyon logu (audit)
 *
 * @param string      $action        Örn: 'login_success', 'login_failed', 'property_added_to_company'
 * @param array       $meta          Ek bilgiler (JSON olarak saklanır)
 * @param string|null $resourceType  Örn: 'property', 'company'
 * @param string|null $resourceId    Örn: property_id, company_id
 */
function audit_log(string $action, array $meta = [], ?string $resourceType = null, ?string $resourceId = null): void
{
    $conn = get_audit_db_connection();
    if (!$conn) {
        return;
    }

    // Öncelik: aktif oturumdaki kullanıcı adı
    // Eğer yoksa meta içinden 'username' varsa onu kullan
    $effectiveUsername = $_SESSION['username'] ?? ($meta['username'] ?? null);
    $ip                = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent         = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $metaJson          = !empty($meta) ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null;

    $stmt = $conn->prepare("
        INSERT INTO audit_log (username, action, resource_type, resource_id, meta_json, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$stmt) {
        error_log("❌ audit_log prepare hatası: " . $conn->error);
        return;
    }

    $stmt->bind_param('sssssss', $effectiveUsername, $action, $resourceType, $resourceId, $metaJson, $ip, $userAgent);
    $stmt->execute();
    $stmt->close();
}
