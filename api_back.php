<?php
// Hata raporlamayı açalım
error_reporting(E_ALL);
ini_set('display_errors', 1);

ob_start("ob_gzhandler");
// Veritabanı bağlantı bilgileri
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "tapu_backup";

// MySQL bağlantısı oluşturma
$conn = new mysqli($servername, $username, $password, $dbname);

// Bağlantıyı kontrol et
if ($conn->connect_error) {
    die("Bağlantı hatası: " . $conn->connect_error);
}

// Karakter setini UTF-8 olarak ayarla
$conn->set_charset("utf8mb4");

// Set the content type to JSON
header('Content-Type: application/json; charset=utf-8');

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
function normalizeTurkishChars($string) {
    $turkish = array('Ç', 'ç', 'Ğ', 'ğ', 'İ', 'ı', 'Ö', 'ö', 'Ş', 'ş', 'Ü', 'ü');
    $latin = array('C', 'c', 'G', 'g', 'I', 'i', 'O', 'o', 'S', 's', 'U', 'u');
    
    return str_replace($turkish, $latin, $string);
}


function fetchTasinmazDetayData($conn, $il = null, $ilce = null, $mahalle = null, $ada = null, $parsel = null, $nitelik = null, $araziBuyuklugu = null, $turSecimi = null, $hisseDurumu = null, $sorgulamaDurumu = null) {
    $where_clauses = [];
    $params = [];
    $types = '';

    if ($il !== null) {
        $where_clauses[] = "il_id = ?";
        $params[] = $il;
        $types .= 's';
    }

    if ($ilce !== null && $ilce !== "") {
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
    }

    if ($mahalle !== null && $mahalle !== "") {
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        $where_clauses[] = "mahalle_id IN ($placeholders)";
        foreach ($mahalleArray as $mahalleItem) {
            $params[] = trim($mahalleItem);
            $types .= 'i';
        }
    }

    if ($ada !== null && $ada !== 0) {
        $where_clauses[] = "AdaBilgisi = ?";
        $params[] = $ada;
        $types .= 'i';
    }

    if ($parsel !== null && $parsel !== 0) {
        $where_clauses[] = "ParselBilgisi = ?";
        $params[] = $parsel;
        $types .= 'i';
    }

    if ($nitelik !== null && $nitelik !== '') {
        $where_clauses[] = "AnaTasinmazNitelik LIKE ?";
        $params[] = "%$nitelik%";
        $types .= 's';
    }

    if ($araziBuyuklugu !== null && $araziBuyuklugu !== '') {
        $araziBuyukluguArray = explode(',', $araziBuyuklugu);
        $araziBuyukluguFilter = '';

        if (in_array('1', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= 'YuzolcumBilgisi/1000 <= 10 OR ';
        }
        if (in_array('2', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 10 AND YuzolcumBilgisi/1000 <= 20) OR ';
        }
        if (in_array('3', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 20 AND YuzolcumBilgisi/1000 <= 30) OR ';
        }
        if (in_array('4', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 30 AND YuzolcumBilgisi/1000 <= 40) OR ';
        }
        if (in_array('5', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 40 AND YuzolcumBilgisi/1000 <= 50) OR ';
        }
        if (in_array('6', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 50 AND YuzolcumBilgisi/1000 <= 60) OR ';
        }
        if (in_array('7', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 60 AND YuzolcumBilgisi/1000 <= 70) OR ';
        }
        if (in_array('8', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 70 AND YuzolcumBilgisi/1000 <= 80) OR ';
        }
        if (in_array('9', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 80 AND YuzolcumBilgisi/1000 <= 90) OR ';
        }
        if (in_array('10', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 90 AND YuzolcumBilgisi/1000 <= 100) OR ';
        }
        if (in_array('11', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 100 AND YuzolcumBilgisi/1000 <= 200) OR ';
        }
        if (in_array('12', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 200 AND YuzolcumBilgisi/1000 <= 500) OR ';
        }
        if (in_array('13', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 500 AND YuzolcumBilgisi/1000 <= 1000) OR ';
        }
        if (in_array('14', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= 'YuzolcumBilgisi/1000 > 1000 OR ';
        }

        // Son 'OR ' ifadesini kaldır
        if (!empty($araziBuyukluguFilter)) {
            $araziBuyukluguFilter = '(' . rtrim($araziBuyukluguFilter, ' OR ') . ')';
            $where_clauses[] = $araziBuyukluguFilter;
        }
    }

    if ($turSecimi !== null) {
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
        // turSecimi === '3' veya başka değerler için filtre uygulanmaz (Hepsi seçeneği)
    }

    if ($hisseDurumu !== null) {
        if ($hisseDurumu === '0') {
            $where_clauses[] = "(Hisse = 1 or Hisse > 1 or Hisse = 0)";
        } elseif ($hisseDurumu === '1') {
            $where_clauses[] = "Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1";
        }
    }

    if ($sorgulamaDurumu !== null && $sorgulamaDurumu !== 'Hepsi') {
        $where_clauses[] = "Durum = ?";
        $params[] = $sorgulamaDurumu;
        $types .= 's';
    }

    $where_clauses[] = "polygon IS NOT NULL"; // Geçerli verilerin seçilmesi için

    $where_clause = implode(" AND ", $where_clauses);
    $sql = "SELECT DISTINCT AnaTasinmazNitelik_1 as value, AnaTasinmazNitelik_1 as label FROM tapu_maliye";

    if (!empty($where_clause)) {
        $sql .= " WHERE " . $where_clause;
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
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    return $data;
}

function getParcelData($conn, $prolegalId = null, $il = null, $ilce = null, $mahalle = null, $ada = null, $parsel = null, $mahalle_id = null, $nitelik = null, $tasinmazDetay = null, $araziBuyuklugu = null, $turSecimi = null, $hisseDurumu = null, $sorgulamaDurumu = null, $basvuruDurumu = null, $ne_lat = null, $ne_lng = null, $sw_lat = null, $sw_lng = null)
{
    $where_clauses = [];
    $params = [];
    $types = '';
$il = isset($il) ? $il : null;
$ilce = isset($ilce) ? urldecode($ilce) : null;
$mahalle = isset($mahalle) ? urldecode($mahalle) : null;
$nitelik = isset($nitelik) ? urldecode($nitelik) : null;
$tasinmazDetay = isset($tasinmazDetay) ? urldecode($tasinmazDetay) : null;
$araziBuyuklugu = isset($araziBuyuklugu) ? urldecode($araziBuyuklugu) : null;
$turSecimi = isset($turSecimi) ? urldecode($turSecimi) : null;
$hisseDurumu = isset($hisseDurumu) ? urldecode($hisseDurumu) : null;
$sorgulamaDurumu = isset($sorgulamaDurumu) ? urldecode($sorgulamaDurumu) : null;

   
    // Harita sınırlarına göre parsel sorgulaması
if ($ne_lat !== null && $ne_lng !== null && $sw_lat !== null && $sw_lng !== null) {
    // Koordinatlar mevcutsa polygon alanını oluştur
    $polygon = "POLYGON(($sw_lng $sw_lat, $ne_lng $sw_lat, $ne_lng $ne_lat, $sw_lng $ne_lat, $sw_lng $sw_lat))";

    // Sorguyu oluştur
    $sql = "SELECT *, ST_AsText(polygon) as polygon_text FROM tapu_maliye WHERE polygon IS NOT NULL and ST_Intersects(polygon, ST_GeomFromText(?))";

    // Prepared statement hazırla
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        die("Prepare statement failed: " . $conn->error);
    }

    // Parametreyi bağla
    $stmt->bind_param('s', $polygon);

    // Sorguyu çalıştır
    if (!$stmt->execute()) {
        die("Execute failed: " . $stmt->error);
    }

    // Sonuçları al
    $result = $stmt->get_result();
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    // Sonuçları JSON formatında döndür
    return $data;
}


     // Prolegal Taşınmaz No sorgulama
    if ($prolegalId !== null) {
        $where_clauses[] = "Id = ?";
        $params[] = $prolegalId;
        $types .= 'i'; // Prolegal ID genelde integer'dır

         // Diğer koşulları atlamak için sadece Prolegal ID ile sorgulama yap ve fonksiyonu erken bitir
        $sql = "SELECT *, ST_AsText(polygon) as polygon_text FROM tapu_maliye WHERE " . implode(" AND ", $where_clauses);
        
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
        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }

        return $data;
    }
    
    if ($il !== null) {
        $where_clauses[] = "il_id = ?";
        $params[] = $il;
        $types .= 's';
    }
    /// İlçe için çoklu seçim desteği
    if ($ilce !== null && $ilce !== "") {
        $ilce = $ilce; // Çift URL kod çözme işlemi
        $ilceArray = explode(',', $ilce);
        $placeholders = implode(',', array_fill(0, count($ilceArray), '?'));
        $where_clauses[] = "ilce_id IN ($placeholders)";
        foreach ($ilceArray as $ilceItem) {
            $params[] = trim($ilceItem);
            $types .= 's';
        }
    }

    // Mahalle ID'lerini almak
    if ($mahalle !== null && $mahalle !== "") {
        $mahalle = urldecode($mahalle); // Çift URL kod çözme işlemi
        $mahalleArray = explode(',', $mahalle);
        $placeholders = implode(',', array_fill(0, count($mahalleArray), '?'));
        $where_clauses[] = "mahalle_id IN ($placeholders)";
        foreach ($mahalleArray as $mahalleItem) {
            $params[] = trim($mahalleItem);
            $types .= 'i'; // Mahalle ID'si integer olarak kullanılabilir
        }
    }
    if ($ada !== null && $ada !== 0) {
        $where_clauses[] = "AdaBilgisi = ?";
        $params[] = $ada;
        $types .= 'i';
    }
    if ($parsel !== null && $parsel !== 0) {
        $where_clauses[] = "ParselBilgisi = ?";
        $params[] = $parsel;
        $types .= 'i';
    }
    if ($nitelik !== null  or $nitelik !== '') {
        $where_clauses[] = "AnaTasinmazNitelik LIKE ?";
        $params[] = "%$nitelik%";
        $types .= 's';
    }

    if ($tasinmazDetay !== null && $tasinmazDetay !== '') {
        $tasinmazDetayArray = explode(',', $tasinmazDetay);
        $placeholders = implode(',', array_fill(0, count($tasinmazDetayArray), '?'));
        $where_clauses[] = "AnaTasinmazNitelik_1 IN ($placeholders)";
        foreach ($tasinmazDetayArray as $detay) {
            $params[] = $detay;
            $types .= 's';
        }
    }

    // Tür Seçimi için filtre
    if ($turSecimi === '0') {
        // Uygun Araziler: AnaTasinmazNitelik_2 = 'arazi'
        $where_clauses[] = "AnaTasinmazNitelik_2 = ?";
        $params[] = 'arazi';
        $types .= 's';
    } elseif ($turSecimi === '1') {
        // Diğer Araziler: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'arazi'
        $where_clauses[] = "AnaTasinmazNitelik_2 = ? AND AnaTasinmazNitelik_2_yedek = ?";
        $params[] = 'diğer';
        $params[] = 'arazi';
        $types .= 'ss';
    } elseif ($turSecimi === '2') {
        // Arazi Dışı: AnaTasinmazNitelik_2 = 'diğer' AND AnaTasinmazNitelik_2_yedek = 'diğer'
        $where_clauses[] = "AnaTasinmazNitelik_2 = ? AND AnaTasinmazNitelik_2_yedek = ?";
        $params[] = 'diğer';
        $params[] = 'diğer';
        $types .= 'ss';
    }
    // turSecimi === '3' veya başka değerler için filtre uygulanmaz (Hepsi seçeneği)

    // Hisse durumu için filtre
    if ($hisseDurumu === '0') {
        $where_clauses[] = "(Hisse = 1 or Hisse > 1 or Hisse = 0)";
    } elseif($hisseDurumu === '1')  {
        $where_clauses[] = "Hisse BETWEEN 0 AND 1 AND Hisse <> 0 AND Hisse <> 1";
    }

    if ($sorgulamaDurumu !== null && $sorgulamaDurumu !== 'Hepsi') {
        $where_clauses[] = "Durum = ?";
        $params[] = $sorgulamaDurumu;
        $types .= 's';
    }

    if ($araziBuyuklugu !== null && $araziBuyuklugu !== '') {
        // String'i array'e dönüştür
        $araziBuyukluguArray = explode(',', $araziBuyuklugu);
        $araziBuyukluguFilter = '';

        if (in_array('1', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= 'YuzolcumBilgisi/1000 <= 10 OR ';
        }
        if (in_array('2', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 10 AND YuzolcumBilgisi/1000 <= 20) OR ';
        }
        if (in_array('3', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 20 AND YuzolcumBilgisi/1000 <= 30) OR ';
        }
        if (in_array('4', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 30 AND YuzolcumBilgisi/1000 <= 40) OR ';
        }
        if (in_array('5', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 40 AND YuzolcumBilgisi/1000 <= 50) OR ';
        }
        if (in_array('6', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 50 AND YuzolcumBilgisi/1000 <= 60) OR ';
        }
        if (in_array('7', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 60 AND YuzolcumBilgisi/1000 <= 70) OR ';
        }
        if (in_array('8', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 70 AND YuzolcumBilgisi/1000 <= 80) OR ';
        }
        if (in_array('9', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 80 AND YuzolcumBilgisi/1000 <= 90) OR ';
        }
        if (in_array('10', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 90 AND YuzolcumBilgisi/1000 <= 100) OR ';
        }
        if (in_array('11', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 100 AND YuzolcumBilgisi/1000 <= 200) OR ';
        }
        if (in_array('12', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 200 AND YuzolcumBilgisi/1000 <= 500) OR ';
        }
        if (in_array('13', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= '(YuzolcumBilgisi/1000 > 500 AND YuzolcumBilgisi/1000 <= 1000) OR ';
        }
        if (in_array('14', $araziBuyukluguArray)) {
            $araziBuyukluguFilter .= 'YuzolcumBilgisi/1000 > 1000 OR ';
        }

        // Son 'OR ' ifadesini kaldır
        if (!empty($araziBuyukluguFilter)) {
            $araziBuyukluguFilter = '(' . rtrim($araziBuyukluguFilter, ' OR ') . ')';
            $where_clauses[] = $araziBuyukluguFilter;
        }
    }

    $where_clauses[] = "polygon IS NOT NULL";

    $where_clause = implode(" AND ", $where_clauses);
    $sql = "SELECT *, ST_AsText(polygon) as polygon_text FROM tapu_maliye";
    if (!empty($where_clause)) {
        $sql .= " WHERE " . $where_clause;
    }

    // Debugging purposes
    error_log("SQL Query: $sql");
    error_log("SQL Params: " . json_encode($params));

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
    // Tam SQL sorgusunu ve parametreleri logla
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
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    return $data;
}

if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'copy_company_properties') {
    $input = json_decode(file_get_contents('php://input'), true);
    $companyId = intval($input['companyId']);
    $newCompanyName = $input['newCompanyName'];

    // Create the new company
    $stmt = $conn->prepare("INSERT INTO companies (company_name) VALUES (?)");
    $stmt->bind_param("s", $newCompanyName);
    if ($stmt->execute()) {
        $newCompanyId = $stmt->insert_id;

        // Copy properties from the old company to the new one
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
    // POLYGON((x1 y1, x2 y2, ...)) formatını işle
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
    $firmId = $input['firmId'];
    $parcelKey = $input['parcelKey'];

    // Veritabanına ekleme işlemi
    $stmt = $conn->prepare("INSERT INTO parcel_company (company_id, parcel_id) VALUES (?, ?)");
    $stmt->bind_param("is", $firmId, $parcelKey);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Gayrimenkul firmaya eklendi.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ekleme işlemi sırasında bir hata oluştu.']);
    }
    $stmt->close();
    exit;
}

if (isset($_GET['action']) && $_GET['action']== 'get_property_count' && isset($_GET['company_id'])) {
    $companyId = intval($_GET['company_id']);

    // Şirketin gayrimenkul sayısını veritabanından alın
    $query = "SELECT COUNT(*) AS count FROM parcel_company WHERE company_id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $companyId);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();

echo json_encode(['success' => true, 'property_count' => $count]);
    $stmt->close();
    exit;
}

// Fetch company properties
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_company_properties') {
    $companyId = intval($_GET['company_id']);
    
    $query = "
    SELECT 
        m.Id, 
        m.İlBilgisi, 
        m.İlceBilgisi, 
        m.MahalleBilgisi, 
        m.AnaTasinmazNitelik,
        m.YuzolcumBilgisi, 
        m.Hisse, 
        m.AdaBilgisi, 
        m.ParselBilgisi, 
        m.mahalle_id,
        ST_AsText(m.polygon) as geometry
    FROM 
        parcel_company pc
    JOIN 
        tapu_maliye m ON pc.parcel_id = m.Id
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
                "data" => [
                    "type" => "Feature",
                    "geometry" => [
                        "type" => "Polygon",
                        "coordinates" => processPolygon($item['geometry'])
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
                        "hisse" => round(($item['Hisse'] *  100)). '%',
                        "gittigiParselSebep" => "",
                        "alan" => $item['YuzolcumBilgisi'] ? number_format((float)$item['YuzolcumBilgisi'], 2, ',', '.') : "",
                        "adaNo" => $item['AdaBilgisi'],
                        "nitelik" => $item['AnaTasinmazNitelik'],
                        "ilAd" => $item['İlBilgisi'] ?? "",
                        "mahalleId" => $item['mahalle_id'],
                        "pafta" => "",
                        "basvuru_durumu" => $item[''] ?? ""
                    ]
                ]
                
            ];
        }

    echo json_encode($properties, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'removePropertyFromFirm') {
    $firmId = $input['firmId'];
    $parcelKey = $input['parcelKey'];

    // Veritabanından silme işlemi
    $stmt = $conn->prepare("DELETE FROM parcel_company WHERE company_id = ? AND parcel_id = ?");
    $stmt->bind_param("is", $firmId, $parcelKey);

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
        SELECT c.id, c.company_name, COUNT(pc.id) AS property_count
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
    } else {
        echo json_encode(['error' => 'Failed to add company']);
    }
    exit;
}

// Delete a company
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['action']) && $_POST['action'] === 'delete_company') {
    $companyId = intval($_POST['company_id']);

    $stmt = $conn->prepare("DELETE FROM companies WHERE id = ?");
    $stmt->bind_param("i", $companyId);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Failed to delete company']);
    }
    exit;
}


// Handling different types of requests
if ($_SERVER["REQUEST_METHOD"] == "GET") {
    $prolegalId = isset($_GET['prolegalId']) ? intval($_GET['prolegalId']) : null;
    $il = isset($_GET['il']) ? $_GET['il'] : null;
    $ilce = isset($_GET['ilce']) ? $_GET['ilce'] : null;
    $mahalle = isset($_GET['mahalle']) ? $_GET['mahalle'] : null;
    $ada = isset($_GET['ada']) ? intval($_GET['ada']) : null;
    $parsel = isset($_GET['parsel']) ? intval($_GET['parsel']) : null;
    $mahalle_id = isset($_GET['mahalle_id']) ? intval($_GET['mahalle_id']) : null;
    $nitelik = isset($_GET['nitelik']) ? $_GET['nitelik'] : null;
    $tasinmazDetay = isset($_GET['tasinmazDetay']) ? $_GET['tasinmazDetay'] : null;
    $araziBuyuklugu = isset($_GET['araziBuyuklugu']) ? $_GET['araziBuyuklugu'] : null;
    $turSecimi = isset($_GET['turSecimi']) ? $_GET['turSecimi'] : null;
    $hisseDurumu = isset($_GET['hisseDurumu']) ? $_GET['hisseDurumu'] : null;
    $sorgulamaDurumu = isset($_GET['sorgulamaDurumu']) ? $_GET['sorgulamaDurumu'] : null;
    $ne_lat = isset($_GET['ne_lat']) ? floatval($_GET['ne_lat']) : null;
$ne_lng = isset($_GET['ne_lng']) ? floatval($_GET['ne_lng']) : null;
$sw_lat = isset($_GET['sw_lat']) ? floatval($_GET['sw_lat']) : null;
$sw_lng = isset($_GET['sw_lng']) ? floatval($_GET['sw_lng']) : null;

    
    // Gelen parametreleri logla
    error_log("Request parameters: " . json_encode($_GET));
    
        
        $isUpdate = isset($_GET['update']) ? $_GET['update'] : false;

        if ($isUpdate) {

        // Taşınmaz Detay verilerini almak için fonksiyonu çağır
        $data = fetchTasinmazDetayData($conn, $il, $ilce, $mahalle, $ada, $parsel, $nitelik, $araziBuyuklugu, $turSecimi, $hisseDurumu, $sorgulamaDurumu);

        // Sonuçları JSON olarak döndür
        echo json_encode($data);
        exit;
    }
    // Sorguyu güncelleyerek çağır
    $data = getParcelData($conn, $prolegalId,$il, $ilce, $mahalle, $ada, $parsel, $mahalle_id, $nitelik, $tasinmazDetay, $araziBuyuklugu, $turSecimi, $hisseDurumu, $sorgulamaDurumu,$ne_lat, $ne_lng , $sw_lat, $sw_lng);
    // Ana script içinde, response oluşturma kısmı
    if (!empty($data)) {
        $responses = [];
        foreach ($data as $item) {
            $responses[] = [
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
                        "hisse" => round(($item['Hisse'] *  100)). '%',
                        "gittigiParselSebep" => "",
                        "alan" => $item['YuzolcumBilgisi'] ? number_format((float)$item['YuzolcumBilgisi'], 2, ',', '.') : "",
                        "adaNo" => $item['AdaBilgisi'],
                        "nitelik" => $item['AnaTasinmazNitelik'],
                        "ilAd" => $item['İlBilgisi'] ?? "",
                        "mahalleId" => $item['mahalle_id'],
                        "pafta" => "",
                        "basvuru_durumu" => $item['basvuru_durumu_aktif'] ?? ""
                    ]
                ],
                "status" => 200
            ];
        }

        // Log the request and response
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
} else {
    $response = [
        [
            "data" => null,
            "status" => 405
        ]
    ];
    logRequestAndResponse($_SERVER, $response);
    echo json_encode($response, JSON_PRETTY_PRINT);
}

// Başvuru durumu güncelleme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'update_basvuru_durumu') {
    $input = json_decode(file_get_contents('php://input'), true);
    $parcelIds = $input['parcel_ids'];
    $basvuruDurumu = $input['basvuru_durumu'];
    
    foreach ($parcelIds as $parcelId) {
        $stmt = $conn->prepare("UPDATE tapu_maliye SET basvuru_durumu_aktif = ? WHERE Id = ?");
        $stmt->bind_param("si", $basvuruDurumu, $parcelId);
        $stmt->execute();
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

// İmar bilgisi güncelleme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'update_imar_data') {
    $input = json_decode(file_get_contents('php://input'), true);
    $prolegalId = $input['prolegal_id'];
    $imarData = $input['imar_data'];
    
    $stmt = $conn->prepare("UPDATE tapu_maliye SET imar_fonksiyon = ? WHERE Id = ?");
    $stmt->bind_param("si", $imarData, $prolegalId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false]);
    }
    exit;
}

// Prolegal notu kaydetme
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_GET['action']) && $_GET['action'] === 'save_prolegal_note') {
    $input = json_decode(file_get_contents('php://input'), true);
    $tapuId = $input['tapu_id'];
    $prolegalNote = $input['prolegal_note'];
    
    $stmt = $conn->prepare("UPDATE tapu_maliye SET prolegal_notu = ? WHERE Id = ?");
    $stmt->bind_param("si", $prolegalNote, $tapuId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false]);
    }
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

// Bağlantıyı kapat
$conn->close();
?>