<?php

// IMAR API PHP ENTEGRASYON KODU

// 1. API Endpoint Adresi (Vercel adresiniz)
$api_url = "https://imar.prolegal.com.tr/api/query"; // BURAYI KENDI VERCEL SITENIZLE DEGISTIRIN

// 2. Sorgulanacak Veriler
$request_data = [
    "il" => "ISTANBUL",
    "ilce" => "PENDIK",
    "mahalle" => "BAHÇELİEVLER",
    "ada" => "11179",
    "parsel" => "1"
];

// 3. JSON Formatına Çevir
$payload = json_encode($request_data, JSON_UNESCAPED_UNICODE);

// 4. cURL Başlat
$ch = curl_init($api_url);

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload)
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_SSL_VERIFYPEER => false, // HTTPS sertifika hatası almamak için
    CURLOPT_TIMEOUT => 30 // Maksimum bekleme süresi (saniye)
]);

// 5. İsteği Gönder
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

// 6. Sonucu İşle
if ($error) {
    echo "HATA: Bağlantı sorunu: $error";
} else {
    $result = json_decode($response, true);

    if (json_last_error() === JSON_ERROR_NONE) {
        // BAŞARILI SONUÇ
        echo "<h1>Sorgu Sonucu: " . $result['status'] . "</h1>";
        echo "<p><strong>Plan Fonksiyonu:</strong> " . $result['plan_function'] . "</p>";
        echo "<p><strong>KAKS (Emsal):</strong> " . $result['kaks'] . "</p>";
        echo "<p><strong>TAKS:</strong> " . $result['taks'] . "</p>";

        // Detaylı Veriler
        echo "<h3>Detaylar:</h3>";
        if (isset($result['parsed_details'])) {
            echo "<ul>";
            foreach ($result['parsed_details'] as $key => $value) {
                echo "<li><strong>$key:</strong> $value</li>";
            }
            echo "</ul>";
        }

    } else {
        echo "HATA: Sunucudan geçersiz yanıt döndü: " . htmlspecialchars($response);
    }
}
?>