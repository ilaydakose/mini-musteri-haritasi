<?php
require_once 'SimpleXLSXGen.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['data']) && isset($_POST['filename'])) {
    $data = json_decode($_POST['data'], true);
    $filename = $_POST['filename'];
    $columns = isset($_POST['columns']) ? json_decode($_POST['columns'], true) : null;
    $customHeaders = isset($_POST['headers']) ? json_decode($_POST['headers'], true) : null;

    // Varsayılan header ve mapping (geriye dönük uyum)
    $defaultHeaders = ['ID', 'İl', 'İlçe', 'Mahalle', 'Ada/Parsel', 'Nitelik', 'İmar Fonksiyonu', 'Durum', 'Sorgu Durumu', 'Alan'];

    $excelData = [];
    $headers = [];

    if (is_array($columns) && count($columns) > 0) {
        // Özel kolon listesi
        $headers = is_array($customHeaders) && count($customHeaders) > 0 ? $customHeaders : $columns;
        foreach ($data as $row) {
            $excelRow = [];
            foreach ($columns as $colKey) {
                if (is_array($row)) {
                    $excelRow[] = $row[$colKey] ?? '';
                } elseif (is_object($row)) {
                    $excelRow[] = $row->{$colKey} ?? '';
                } else {
                    $excelRow[] = '';
                }
            }
            $excelData[] = $excelRow;
        }
    } else {
        // Eski davranış
        $headers = $defaultHeaders;
        foreach ($data as $row) {
            if (is_array($row)) {
                $excelRow = [
                    $row['id'] ?? $row[0] ?? '',
                    $row['il'] ?? $row[1] ?? '',
                    $row['ilce'] ?? $row[2] ?? '',
                    $row['mahalle'] ?? $row[3] ?? '',
                    $row['adaParsel'] ?? $row[4] ?? '',
                    $row['nitelik'] ?? $row[5] ?? '',
                    $row['imarFonksiyon'] ?? $row[6] ?? '',
                    $row['durum'] ?? $row[7] ?? '',
                    $row['sorguDurumu'] ?? $row[8] ?? '',
                    $row['alan'] ?? $row[9] ?? ''
                ];
            } else if (is_object($row)) {
                $excelRow = [
                    $row->id ?? '',
                    $row->il ?? '',
                    $row->ilce ?? '',
                    $row->mahalle ?? '',
                    $row->adaParsel ?? '',
                    $row->nitelik ?? '',
                    $row->imarFonksiyon ?? '',
                    $row->durum ?? '',
                    $row->sorguDurumu ?? '',
                    $row->alan ?? ''
                ];
            } else {
                continue;
            }
            
            $excelData[] = $excelRow;
        }
    }
    
    // XLSX dosyası oluştur
    $xlsx = new SimpleXLSXGen($excelData);
    $xlsx->setHeaders($headers);
    $xlsx->generate($filename);
} else {
    echo "Geçersiz istek.";
}
