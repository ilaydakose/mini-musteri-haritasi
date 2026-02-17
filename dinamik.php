<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Hata raporlamayı aç
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Veritabanı bağlantısı
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "tapu_miniharita_v2";

try {
    $conn = new mysqli($servername, $username, $password, $dbname);
    $conn->set_charset("utf8");

    if ($conn->connect_error) {
        throw new Exception("Bağlantı hatası: " . $conn->connect_error);
    }
} catch (Exception $e) {
    echo json_encode(['error' => 'Veritabanı bağlantı hatası: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// GET parametrelerini al
$type = isset($_GET['type']) ? $_GET['type'] : '';
$il = isset($_GET['il']) ? $_GET['il'] : null;
$ilce = isset($_GET['ilce']) ? $_GET['ilce'] : null;
$mahalle = isset($_GET['mahalle']) ? $_GET['mahalle'] : null;
$turSecimi = isset($_GET['turSecimi']) ? $_GET['turSecimi'] : null;
$hisseDurumu = isset($_GET['hisseDurumu']) ? $_GET['hisseDurumu'] : null;
$sorgulamaDurumu = isset($_GET['sorgulamaDurumu']) ? $_GET['sorgulamaDurumu'] : null;

// Debug için parametreleri logla
error_log("Dinamik.php parametreleri - Type: $type, İl: $il, İlçe: $ilce, Mahalle: $mahalle, Tür: $turSecimi, Hisse: $hisseDurumu, Sorgulama: $sorgulamaDurumu");

try {
    switch ($type) {
        case 'tasinmazDetay':
            echo json_encode(getTasinmazDetayData($conn, $il, $ilce, $mahalle, $turSecimi, $hisseDurumu, $sorgulamaDurumu), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'turSecimi':
            echo json_encode(getTurSecimiData($conn, $il, $ilce, $mahalle), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'araziBuyuklugu':
            echo json_encode(getAraziBuyukluguData($conn, $il, $ilce, $mahalle), JSON_UNESCAPED_UNICODE);
            break;
            
        default:
            echo json_encode(['error' => 'Geçersiz tip'], JSON_UNESCAPED_UNICODE);
            break;
    }
} catch (Exception $e) {
    error_log("Dinamik.php hatası: " . $e->getMessage());
    echo json_encode(['error' => 'Sunucu hatası'], JSON_UNESCAPED_UNICODE);
}

$conn->close();

function getTasinmazDetayData($conn, $il = null, $ilce = null, $mahalle = null, $turSecimi = null, $hisseDurumu = null, $sorgulamaDurumu = null) {
    // Debug için parametreleri logla
    error_log("getTasinmazDetayData çağrıldı - İl: $il, İlçe: $ilce, Mahalle: $mahalle, Tür: $turSecimi, Hisse: $hisseDurumu, Sorgulama: $sorgulamaDurumu");
    
    // En az bir seçim yapılmışsa veri döndür, yoksa boş array döndür
    if (empty($il) && empty($ilce) && empty($mahalle)) {
        error_log("Hiçbir lokasyon seçimi yapılmamış, boş array döndürülüyor");
        return [];
    }
    
    $where_clauses = [];
    $params = [];
    $types = '';
    
    // Temel koşul - polygon olan kayıtlar
    $where_clauses[] = "polygon IS NOT NULL";
    $where_clauses[] = "AnaTasinmazNitelik_1 IS NOT NULL";
    $where_clauses[] = "AnaTasinmazNitelik_1 != ''";
    
    if ($il !== null && $il !== '') {
        $where_clauses[] = "il_id = ?";
        $params[] = $il;
        $types .= 's';
    }
    
    if ($ilce !== null && $ilce !== '') {
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
    }
    
    if ($mahalle !== null && $mahalle !== '') {
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        $where_clauses[] = "mahalle_id IN ($placeholders)";
        foreach ($mahalleArray as $mahalleItem) {
            $params[] = trim($mahalleItem);
            $types .= 'i';
        }
    }

    // Tür Seçimi filtresi
    if ($turSecimi !== null && $turSecimi !== '') {
        if ($turSecimi === '0') {
            // Uygun Araziler: AnaTasinmazNitelik_2 = 'arazi'
            $where_clauses[] = "AnaTasinmazNitelik_2 = 'arazi'";
        } elseif ($turSecimi === '1') {
            // Diğer Araziler: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'arazi'
            $where_clauses[] = "AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'arazi'";
        } elseif ($turSecimi === '2') {
            // Arazi Dışı: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'diğer'
            $where_clauses[] = "AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'diğer'";
        }
    }

    // Hisse durumu filtresi
    if ($hisseDurumu !== null && $hisseDurumu !== '') {
        if ($hisseDurumu === '0') {
            $where_clauses[] = "(Hisse = 1 or Hisse > 1 or Hisse = 0)";
        } elseif ($hisseDurumu === '1') {
            $where_clauses[] = "Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1";
        }
    }

    // Sorgulama durumu filtresi
    if ($sorgulamaDurumu !== null && $sorgulamaDurumu !== 'Hepsi' && $sorgulamaDurumu !== '') {
        $where_clauses[] = "Durum = ?";
        $params[] = $sorgulamaDurumu;
        $types .= 's';
    }
    
    $where_clause = implode(" AND ", $where_clauses);
    $sql = "SELECT DISTINCT AnaTasinmazNitelik_1 as value, AnaTasinmazNitelik_1 as label 
            FROM tapu_maliye 
            WHERE $where_clause 
            ORDER BY AnaTasinmazNitelik_1";
    
    // Debug için SQL sorgusunu logla
    error_log("SQL Sorgusu: $sql");
    error_log("SQL Parametreleri: " . json_encode($params));
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare statement failed: " . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Execute failed: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $data = [];
    
    while ($row = $result->fetch_assoc()) {
        if (!empty($row['value']) && !empty($row['label'])) {
            $data[] = $row;
        }
    }
    
    return $data;
}

function getTurSecimiData($conn, $il = null, $ilce = null, $mahalle = null) {
    // En az bir seçim yapılmışsa veri döndür, yoksa boş array döndür
    if (empty($il) && empty($ilce) && empty($mahalle)) {
        return [];
    }
    
    $where_clauses = [];
    $params = [];
    $types = '';
    
    // Temel koşul - polygon olan kayıtlar
    $where_clauses[] = "polygon IS NOT NULL";
    $where_clauses[] = "AnaTasinmazNitelik_1 IS NOT NULL";
    $where_clauses[] = "AnaTasinmazNitelik_1 != ''";
    
    if ($il !== null && $il !== '') {
        $where_clauses[] = "il_id = ?";
        $params[] = $il;
        $types .= 's';
    }
    
    if ($ilce !== null && $ilce !== '') {
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
    }
    
    if ($mahalle !== null && $mahalle !== '') {
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        $where_clauses[] = "mahalle_id IN ($placeholders)";
        foreach ($mahalleArray as $mahalleItem) {
            $params[] = trim($mahalleItem);
            $types .= 'i';
        }
    }
    
    $where_clause = implode(" AND ", $where_clauses);
    $sql = "SELECT DISTINCT AnaTasinmazNitelik_1 as value, AnaTasinmazNitelik_1 as label 
            FROM tapu_maliye 
            WHERE $where_clause 
            ORDER BY AnaTasinmazNitelik_1";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare statement failed: " . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Execute failed: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $data = [];
    
    while ($row = $result->fetch_assoc()) {
        if (!empty($row['value']) && !empty($row['label'])) {
            $data[] = $row;
        }
    }
    
    return $data;
}

function getAraziBuyukluguData($conn, $il = null, $ilce = null, $mahalle = null) {
    // Arazi büyüklüğü için sabit aralıklar
    $data = [
        ['value' => '1', 'label' => '0-100 m²'],
        ['value' => '2', 'label' => '100-250 m²'],
        ['value' => '3', 'label' => '250-500 m²'],
        ['value' => '4', 'label' => '500-750 m²'],
        ['value' => '5', 'label' => '750-1000 m²'],
        ['value' => '6', 'label' => '1000-1500 m²'],
        ['value' => '7', 'label' => '1500-2000 m²'],
        ['value' => '8', 'label' => '2000-2500 m²'],
        ['value' => '9', 'label' => '2500-3000 m²'],
        ['value' => '10', 'label' => '3000-4000 m²'],
        ['value' => '11', 'label' => '4000-5000 m²'],
        ['value' => '12', 'label' => '5000-10000 m²'],
        ['value' => '13', 'label' => '10000-50000 m²'],
        ['value' => '14', 'label' => '50000+ m²']
    ];
    
    return $data;
}
?>
