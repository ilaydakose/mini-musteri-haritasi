<?php
session_name('mini_harita_session');
session_start();
require_once __DIR__ . '/audit.php';

// Kullanıcının IP adresini alıyoruz
$ip_address = $_SERVER['REMOTE_ADDR'];

// Deneme limiti ve süre (15 dakika)
$attempt_limit = 35;
$block_time = 15 * 60; // 15 dakika (saniye cinsinden)

// Hatalı giriş denemeleri için oturum başlatıyoruz
if (!isset($_SESSION['login_attempts'])) {
    $_SESSION['login_attempts'] = [];
}

// IP için hatalı deneme sayısı ve son deneme zamanını kontrol et
if (isset($_SESSION['login_attempts'][$ip_address])) {
    $attempts = $_SESSION['login_attempts'][$ip_address]['attempts'];
    $last_attempt_time = $_SESSION['login_attempts'][$ip_address]['last_attempt_time'];

    // IP adresi yasaklı mı kontrol et
    if ($attempts >= $attempt_limit && (time() - $last_attempt_time) < $block_time) {
        $remaining_time = ($block_time - (time() - $last_attempt_time)) / 60;
        $response = [
            'success' => false,
            'message' => "Çok fazla başarısız giriş denemesi. Lütfen $remaining_time dakika sonra tekrar deneyin."
        ];

        // Rate limit durumunu da loglayalım
        log_login_attempt(null, false, 'rate_limited');
        audit_log('login_rate_limited', ['remaining_minutes' => $remaining_time]);

        echo json_encode($response);
        exit();
    }
} else {
    // IP adresi için ilk giriş denemesi başlatılır
    $_SESSION['login_attempts'][$ip_address] = ['attempts' => 0, 'last_attempt_time' => 0];
}

// AJAX isteği olup olmadığını kontrol et
if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) != 'xmlhttprequest') {
    // AJAX isteği değilse anasayfaya yönlendir
    header("Location: index.php");
    exit();
}

$response = [];

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'] ?? null;
    $password = $_POST['password'] ?? null;

    // 'prolegal' kullanıcısı ile giriş kesinlikle engellensin
    if ($username === 'prolegal') {
        $_SESSION['login_attempts'][$ip_address]['attempts']++;
        $_SESSION['login_attempts'][$ip_address]['last_attempt_time'] = time();

        $response['success'] = false;
        $response['message'] = 'Bu kullanıcı adı ile giriş yapılamaz.';

        // Log'lar: bilinçli olarak engellenen kullanıcı
        log_login_attempt($username, false, 'blocked_username');
        audit_log('login_blocked', ['username' => $username, 'reason' => 'blocked_username']);

        echo json_encode($response);
        exit();
    }

    // Kullanıcıyı DB'den çek (user_name veya user_email ile)
    $dbUser = null;
    $db = get_audit_db_connection();
    if ($db && $username !== null && $password !== null) {
        $stmt = $db->prepare("SELECT user_id, user_name, user_email, user_password, user_role FROM users WHERE user_name=? OR user_email=? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('ss', $username, $username);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows) {
                $dbUser = $res->fetch_assoc();
            }
            $stmt->close();
        }
    }

    // Şifre karşılaştırmasını doğrudan yapıyoruz (hash kullanmıyorsak plain text eşitliği)
    $passwordOk = $dbUser && ($dbUser['user_password'] === $password);

    if ($passwordOk) {
        $userRole = $dbUser['user_role'] ?: 'prolegal';

        // Giriş başarılıysa oturum başlatılır ve giriş denemeleri sıfırlanır
        $_SESSION['loggedin'] = true;
        $_SESSION['username'] = $dbUser['user_name'];
        $_SESSION['user_role'] = $userRole;
        $_SESSION['user_id']   = $dbUser['user_id'];
        $_SESSION['login_attempts'][$ip_address] = ['attempts' => 0, 'last_attempt_time' => 0]; // Başarılı girişte sıfırlanır
        $response['success']  = true;
        $response['role']     = $userRole;
        $response['username'] = $dbUser['user_name'];

        // Log'lar
        log_login_attempt($dbUser['user_name'], true, 'ok');
        audit_log('login_success');
    } else {
        // Hatalı girişte deneme sayısı arttırılır
        $_SESSION['login_attempts'][$ip_address]['attempts']++;
        $_SESSION['login_attempts'][$ip_address]['last_attempt_time'] = time();

        if ($_SESSION['login_attempts'][$ip_address]['attempts'] >= $attempt_limit) {
            $response['message'] = 'Çok fazla hatalı giriş denemesi. 15 dakika boyunca giriş yapamazsınız.';
            $reason = 'too_many_attempts';
        } else {
            $response['message'] = 'Hatalı kullanıcı adı veya şifre.';
            $reason = 'invalid_credentials';
        }
        $response['success'] = false;

        // Log'lar
        log_login_attempt($username, false, $reason);
        audit_log('login_failed', ['username' => $username, 'reason' => $reason]);
    }

    // JSON formatında yanıt gönderiyoruz
    echo json_encode($response);
}
