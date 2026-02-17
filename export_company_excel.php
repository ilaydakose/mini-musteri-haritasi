<?php
require_once 'SimpleXLSXGen.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['data']) && isset($_POST['filename'])) {
    $data = json_decode($_POST['data'], true);
    $filename = $_POST['filename'];

    // Sadece istenen alanlar: id, il, ilçe, mahalle, ada, parsel, şirket
    $headers = ['ID', 'İl', 'İlçe', 'Mahalle', 'Ada', 'Parsel', 'Şirket'];

    $excelData = [];
    foreach ($data as $row) {
        if (!is_array($row) && !is_object($row)) {
            continue;
        }

        // Hem array hem object için ortak okuma
        $id       = is_array($row) ? ($row['id'] ?? '')       : ($row->id ?? '');
        $il       = is_array($row) ? ($row['il'] ?? '')       : ($row->il ?? '');
        $ilce     = is_array($row) ? ($row['ilce'] ?? '')     : ($row->ilce ?? '');
        $mahalle  = is_array($row) ? ($row['mahalle'] ?? '')  : ($row->mahalle ?? '');
        $ada      = is_array($row) ? ($row['ada'] ?? '')      : ($row->ada ?? '');
        $parsel   = is_array($row) ? ($row['parsel'] ?? '')   : ($row->parsel ?? '');
        $company  = is_array($row) ? ($row['company'] ?? '')  : ($row->company ?? '');

        $excelData[] = [
            $id,
            $il,
            $ilce,
            $mahalle,
            $ada,
            $parsel,
            $company,
        ];
    }

    // XLSX dosyası oluştur
    $xlsx = new SimpleXLSXGen($excelData);
    $xlsx->setHeaders($headers);
    $xlsx->generate($filename);
} else {
    echo "Geçersiz istek.";
}

