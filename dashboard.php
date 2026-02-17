<?php
session_start();

if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header("Location: login.php");
    exit();
}


// Oturumda username anahtarı var mı kontrol et
$username = isset($_SESSION['username']) ? $_SESSION['username'] : 'Bilinmeyen kullanıcı';
?>

<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Parsel sorgu</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺</text></svg>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <meta http-equiv="Content-Security-Policy" content="img-src * data:;">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <link href="tasarim/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/app.css?ver=1.8" />
    <!-- Flatpickr (tarih / aralık seçimi için) -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <!-- Tom Select (modern dropdown) -->
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css" rel="stylesheet">
    <link rel="icon" type="image/png" href="tasarim/favicon.png">
    <meta name="description" content="TKGM - Ada, Parsel, İmar Durumu Sorgulama işlemlerinizi buradan yapabilirsiniz.">
    <link rel="stylesheet" href="tasarim/main.css?v=4.3&t=<?php echo time(); ?>">
    <link rel="stylesheet" href="tasarim/modern-modal.css?v=1.0&t=<?php echo time(); ?>">
    <style>
        /* Sağ panel tam ekran modu (sağdan açılır, sol referansı temiz) */
        .right-side-menu.fullscreen {
            width: 100vw !important;
            right: 0;
            left: auto;
            border-radius: 0;
        }

        body.fullscreen-viewport {
            overflow: hidden;
        }

        /* Admin panel tam ekran overlay */
        #adminPanelOverlay {
            position: fixed;
            inset: 0;
            background: #0b0c0f;
            z-index: 9999;
            display: none;
        }

        #adminPanelOverlay .overlay-bar {
            height: 52px;
            background: linear-gradient(120deg, #111827, #1f2937);
            color: #f9fafb;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            font-weight: 600;
            letter-spacing: .2px;
        }

        #adminPanelOverlay .overlay-content {
            height: calc(100% - 52px);
        }

        #adminPanelOverlay iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: #fff;
        }

        /* Admin panel iframe alanı tam yükseklik */
        #data-update-pane .query-list-container {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            height: 100% !important;
            max-height: none !important;
            padding: 0;
            margin: 0;
            display: flex !important;
            /* iframe'in bulunduğu alanı tam boy esnet */
        }

        #data-update-pane iframe {
            display: block;
            flex: 1 1 auto;
            width: 100%;
            height: 100%;
            border: none;
        }

        /* Sağ panelde admin sekmesi yüksekliği: main.css override'larını bastır */
        #data-update-pane {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            height: 100% !important;
        }

        /* Sağ panel genel esnek yapı */
        .query-panels {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 120px);
            min-height: 0;
        }

        .query-pane {
            display: none;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }

        .query-pane.active {
            display: flex;
            flex-direction: column;
        }

        .query-pane .query-list-container {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
        }

        /* Sağ panel ve içeriklerinin tam yükseklik davranışı */
        #rightMenu {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 50px);
        }

        #rightMenu .query-panel {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
        }

        #rightMenu .query-panels {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
        }

        #rightMenu .query-pane {
            display: none !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
        }

        #rightMenu .query-pane.active {
            display: flex !important;
            flex-direction: column !important;
        }

        /* Belge Kartı Modern Stilleri */
        .parcel-doc-card {
            padding: 12px;
            background: #F8FAFC;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: background 0.15s ease;
        }

        .parcel-doc-card:hover {
            background: #F1F5F9;
        }

        /* Araştırma Soru-Cevap Birleşik Kart Stilleri */
        .research-q-a-card {
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
            position: relative;
        }

        .research-question-section {
            background: linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%);
            border-left: 4px solid #0ea5e9;
            padding: 20px;
            position: relative;
        }

        .research-answer-section {
            background: linear-gradient(135deg, #dcfce7 0%, #ffffff 100%);
            border-right: 4px solid #22c55e;
            padding: 20px;
            position: relative;
            margin-top: 0;
        }

        .research-connection-line {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 0;
            position: relative;
        }

        .research-connection-line::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(180deg, #0ea5e9 0%, #22c55e 100%);
            transform: translateX(-50%);
        }

        .research-connection-line i {
            position: relative;
            z-index: 1;
            background: #ffffff;
            padding: 4px;
            color: #22c55e;
            font-size: 18px;
        }

        .research-user-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 20px;
            font-size: 12px;
            color: #64748b;
            margin-top: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .research-user-badge i {
            font-size: 14px;
        }

        .research-question-section .research-user-badge {
            color: #0369a1;
        }

        .research-answer-section .research-user-badge {
            color: #15803d;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .parcel-doc-info {
            flex: 1;
        }

        .parcel-doc-name {
            font-weight: 500;
            color: #111827;
            margin-bottom: 4px;
            font-size: 14px;
        }

        .parcel-doc-size {
            font-size: 12px;
            color: #6b7280;
        }

        .doc-btn {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: 0.15s ease;
            border: none;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .doc-btn.view {
            background: #3b82f6;
            color: white;
        }

        .doc-btn.view:hover {
            background: #2563eb;
        }

        .doc-btn.remove {
            background: #ef4444;
            color: white;
        }

        .doc-btn.remove:hover {
            background: #dc2626;
        }

        .parcel-doc-card-existing {
            padding: 12px;
            background: #ecfdf5;
            border: 1px solid #10b981;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: background 0.15s ease;
            gap: 12px;
        }

        .parcel-doc-card-existing:hover {
            background: #d1fae5;
        }

        .parcel-doc-card-existing .parcel-doc-info {
            flex: 1;
            min-width: 0;
            overflow: hidden;
        }

        .parcel-doc-existing-label {
            font-weight: 500;
            color: #065f46;
            margin-bottom: 4px;
            font-size: 14px;
        }

        .parcel-doc-existing-link {
            font-size: 12px;
            color: #047857;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .parcel-doc-existing-link span {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .parcel-doc-existing-link a {
            color: #059669;
            text-decoration: underline;
        }

        .doc-btn.existing {
            background: #10b981;
            color: white;
        }

        .doc-btn.existing:hover {
            background: #059669;
        }
        /* Table Filter Styles */
        .table-filter-header:hover {
            background: #f1f5f9;
        }

        .column-filter-dropdown {
            padding: 8px;
        }

        .column-filter-dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.2s;
        }

        .column-filter-dropdown-item:hover {
            background: #f1f5f9;
        }

        .column-filter-dropdown-item.active {
            background: #dbeafe;
            color: #1e40af;
            font-weight: 600;
        }
    </style>
</head>

<body>
    <!-- Sağ Sidebar - Baştan Tasarım -->
    <div class="right-side-menu" id="rightMenu">
        <div class="query-panel">
            <!-- Segmentler ve aksiyonlar en üstte -->
            <div class="d-flex align-items-center justify-content-between mb-0">
                <div class="query-segment">
                    <button type="button" class="segment-button active" data-target="query-pane">
                        Sorguya Gönderme
                    </button>
                    <button type="button" class="segment-button" data-target="query-result-pane">
                        Sorgu Sonucu
                    </button>
                    <button type="button" class="segment-button" data-target="application-pane">
                        Başvuru
                    </button>
                    <button type="button" class="segment-button" data-target="data-update-pane">
                        Admin Panel
                    </button>
                </div>
                <div class="d-flex flex-column align-items-end gap-1">
                    <button class="btn btn-outline-secondary btn-sm w-100" id="rightMenuExpandBtn" title="Tam ekran">
                        <i class="fas fa-expand"></i>
                    </button>
                    <a href="logout.php" class="btn btn-outline-danger btn-sm w-100">
                        <i class="fas fa-sign-out-alt"></i>
                    </a>
                </div>
            </div>

            <!-- Ortak üst filtre barı (tarih + ID + durum) -->
            <div class="query-shared-filters mb-3" id="sharedFilters">
                <div class="d-flex flex-column gap-2">
                    <div class="d-flex gap-2 align-items-center">
                        <div class="flex-grow-1">
                            <label class="form-label form-label-sm text-muted mb-1">Tarih / Aralık</label>
                            <input type="text" class="form-control form-control-sm" id="queryDateRange"
                                placeholder="Tarih veya aralık seçin">
                        </div>
                        <div class="flex-grow-1">
                            <label class="form-label form-label-sm text-muted mb-1">Şirket</label>
                            <input type="text" class="form-control form-control-sm" id="sharedCompanyFilter"
                                list="sharedCompanyOptions" placeholder="Şirket seç / yaz">
                            <datalist id="sharedCompanyOptions"></datalist>
                        </div>
                    </div>
                        <div class="d-flex gap-2 align-items-center">
                            <div class="flex-grow-1">
                                <label class="form-label form-label-sm text-muted mb-1">İl</label>
                                <select class="form-select form-select-sm" id="queryFilterIl">
                                    <option value="">İl seç</option>
                                </select>
                            </div>
                            <div class="flex-grow-1">
                                <label class="form-label form-label-sm text-muted mb-1">Ada</label>
                                <input type="text" class="form-control form-control-sm" id="queryFilterAda"
                                    placeholder="Ada">
                            </div>
                            <div class="flex-grow-1">
                                <label class="form-label form-label-sm text-muted mb-1">Parsel</label>
                                <input type="text" class="form-control form-control-sm" id="queryFilterParsel"
                                    placeholder="Parsel">
                            </div>
                        </div>
                        <div class="d-flex gap-2 align-items-center">

                            <button class="btn btn-outline-secondary btn-sm" id="clearQueryFilters">
                            Filtreleri Temizle
                        </button>
                    </div>
                </div>
            </div>

            <!-- İçerik panelleri -->
            <div class="query-panels">
                <!-- Tab 1: Sorguya Gönderme -->
                <div class="query-pane active" id="query-pane">
                    <div class="d-flex justify-content-between align-items-center mb-2">

                        <span class="badge bg-soft-primary text-primary" id="queryCountBadge">0 kayıt</span>
                    </div>

                    <div class="mb-3">
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-outline-danger btn-sm" id="removeFromQueueBtn">
                                Sorgudan Çıkar
                            </button>
                            <button class="btn btn-primary btn-sm" id="bulkUpdateBtn">
                                Sorguya Gönder
                            </button>
                            <button class="btn btn-outline-success btn-sm" id="queueExportBtn">
                                <i class="fas fa-file-excel"></i> Excel'e İndir
                            </button>
                        </div>
                    </div>

                    <div id="queryQueueLoading" class="text-center py-4" style="display: none;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Yükleniyor...</span>
                        </div>
                        <p class="mt-2 text-muted small">Kayıtlar yükleniyor...</p>
                    </div>

                    <div id="queueListContainer" class="query-list-container">
                        <div class="text-muted text-center p-3 small">
                            Filtreleri kullanarak sorgu ve uygunluk kayıtlarını görüntüleyin.
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Sorgu Sonucu -->
                <div class="query-pane" id="query-result-pane">
                    <div class="d-flex justify-content-between align-items-center mb-2">

                        <span class="badge bg-soft-primary text-primary" id="queryResultCountBadge">0 kayıt</span>
                        <div class="d-flex align-items-center gap-2">
                            <select class="form-select form-select-sm" id="queryResultStatusSelect"
                                style="width: 160px;">
                                <option value="">Uygunluk seç</option>
                                <option value="Uygun">Uygun</option>
                                <option value="Uygun Değil">Uygun Değil</option>
                            </select>
                            <button class="btn btn-primary btn-sm" id="queryResultStatusUpdateBtn">Güncelle</button>
                            <button class="btn btn-outline-secondary btn-sm" id="queryResultExportBtn">
                                <i class="fas fa-file-excel"></i>
                            </button>
                        </div>
                    </div>
                    <div id="queryResultListContainer" class="query-list-container">
                        <div class="text-muted text-center p-3 small">
                            Filtreleri kullanarak sorgu sonuçlarını görüntüleyin.
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Başvurular -->
                <div class="query-pane" id="application-pane">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="badge bg-soft-primary text-primary" id="applicationCountBadge">0 kayıt</span>
                        <h6 class="mb-0 small text-muted">Başvurular</h6>
                    </div>

                    <!-- Başvurular için Konum Filtreleri (gizlenebilir) -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <button type="button"
                                class="btn btn-sm btn-outline-secondary text-start flex-grow-1 d-flex align-items-center justify-content-between"
                                id="appLocationToggle">
                                <span class="d-flex align-items-center">
                                    <span class="me-2" id="appLocationToggleIcon">▼</span>
                                    <span class="small app-location-toggle-label">Konum filtrelerini göster</span>
                                </span>
                            </button>
                        </div>
                        <div id="appLocationPanel">
                            <div class="d-flex flex-wrap gap-2 mb-2">
                                <select class="form-select form-select-sm" id="appFilterIl">
                                    <option value="">İl Seçiniz</option>
                                </select>
                                <select class="form-select form-select-sm" id="appFilterIlce">
                                    <option value="">İlçe Seçiniz</option>
                                </select>
                                <select class="form-select form-select-sm" id="appFilterMahalle">
                                    <option value="">Mahalle Seçiniz</option>
                                </select>
                                <input type="text" class="form-control form-control-sm" id="appFilterAda"
                                    placeholder="Ada">
                                <input type="text" class="form-control form-control-sm" id="appFilterParsel"
                                    placeholder="Parsel">
                            </div>
                            <div class="d-flex justify-content-end gap-2">
                                <button class="btn btn-outline-secondary btn-sm" id="appFilterClear">Temizle</button>
                                <button class="btn btn-primary btn-sm" id="appFilterApply">Listele</button>
                            </div>
                        </div>
                    </div>

                    <!-- Başvurular – toplu güncelle (Şirket + Konu + Durum) -->
                    <div class="mb-3">
                        <label class="form-label form-label-sm text-muted fw-semibold mb-1">Toplu Güncelle</label>
                        <div class="d-flex flex-column gap-2">
                            <div class="d-flex gap-2">
                                <select class="form-select form-select-sm" id="applicationStatusSelect">
                                    <option value="">Durum Seçiniz</option>
                                    <option value="Küçük Başvuru">Küçük Başvuru</option>
                                    <option value="Büyük Başvuru">Büyük Başvuru</option>
                                    <option value="Belirtilmemiş">Belirtilmemiş</option>
                                </select>
                            </div>
                            <div class="d-flex justify-content-end">
                                <button class="btn btn-primary btn-sm" id="applicationBulkUpdateBtn">
                                    Seçili Kayıtları Güncelle
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="applicationListContainer" class="query-list-container">
                        <div class="text-muted text-center p-3 small">
                            Aynı filtrelerle gelen kayıtları burada da görebilirsiniz.
                        </div>
                    </div>
                </div>

                <!-- Tab 4: Veri Güncelleme -->
                <div class="query-pane" id="data-update-pane">
                    <div class="d-flex justify-content-between align-items-center">

                    </div>
                    <div class="query-list-container">
                        <iframe id="adminPanelInlineIframe" src="adminPanel.php" title="Admin Panel"
                            style="width:100%; height:100%; border:none;"></iframe>
                    </div>
                </div>
            </div>
        </div>
    </div>



    <div class="noPrint container-fluid p-0">
        <header class="bg-dark text-light">
            <nav class="navbar-static-top d-flex align-items-center px-2" style="position: relative;">
                <div class="d-flex align-items-center flex-grow-0">
                    <div class="navbar-brand-container">
                        <a href="#" class="navbar-brand" id="left-menu-toggle">
                            <i class="bi bi-list"></i>
                        </a>
                    </div>
                    <div class="header-label-container">
                        <h6 class="app-label mb-0" id="sub-title-h6-short">
                            <span id="prolegalLogo" style="cursor: pointer; font-weight: 700; font-size: 16px;"
                                title="Dark Mode Toggle">Mini Harita</span>
                        </h6>
                    </div>
                </div>
                <div class="d-flex align-items-center flex-grow-1 justify-content-end">
                    <!-- Sağ Toggle Buton -->
                    <div class="toggle" id="menuToggle"><i class="fa fa-cog"></i></div>
                </div>
                <!-- Seçili şirket adı - navbar ortasına göre tam ortalanır -->
                <span class="fw-semibold" id="globalSelectedCompanyName"
                    style="position:absolute; left:50%; transform:translateX(-50%);"></span>
            </nav>
            <!-- Header loading bar -->
            <div id="headerLoadingBar">
                <div class="header-loading-inner"></div>
            </div>
            <div id="messagebox" class="messagebox danger">
                <span id="message">message</span>
                <button type="button" class="messagebox-ok">Tamam</button>
                <span class="close">&times;</span>
            </div>
        </header>
        <div id="wrapper" class="right-side-toggled">
            <div id="left-sidebar-wrapper" class="resizable-sidebar">
                <!-- Resize Handle -->
                <div class="resize-handle" id="sidebarResizeHandle">
                    <div class="resize-line"></div>
                </div>

                <div class="nav-tabs-custom">
                    <nav>
                        <div class="nav nav-tabs" id="left-nav-tab" role="tablist">
                            <button class="nav-link active" id="nav-home-tab" data-bs-toggle="tab"
                                data-bs-target="#nav-home" type="button" role="tab" aria-controls="nav-home"
                                aria-selected="true">Sorgu</button>
                            <button class="nav-link" id="nav-kontrol-tab" data-bs-toggle="tab"
                                data-bs-target="#nav-kontrol" type="button" role="tab" aria-controls="nav-kontrol"
                                aria-selected="false">Kontrol</button>
                            <button class="nav-link" id="nav-liste-tab" data-bs-toggle="tab" data-bs-target="#nav-liste"
                                type="button" role="tab" aria-controls="nav-liste" aria-selected="false">Liste</button>
                            <button class="nav-link" id="nav-company-management-tab" data-bs-toggle="tab"
                                data-bs-target="#nav-company-management" type="button" role="tab"
                                aria-controls="nav-company-management" aria-selected="false">Şirketler</button>
                        </div>
                    </nav>

                    <div class="tab-content" id="left-nav-tabContent">
                        <!-- Liste sekmesi -->
                        <div class="tab-pane fade" id="nav-liste" role="tabpanel" aria-labelledby="nav-liste-tab"
                            tabindex="0" style="padding: 0; height: 100vh; overflow-y: auto;">
                            <div style="padding: 15px;">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="mb-0">Sorgu Sonuçları<span id="property-count"></span></h5>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap">
                                        <button id="playButton" class="btn btn-sm btn-outline-primary" title="Oynat">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <button id="stopButton" class="btn btn-sm btn-outline-danger"
                                            style="display: none;" title="Durdur">
                                            <i class="fas fa-stop"></i>
                                        </button>
                                        <button id="exportListToExcelBtn" class="btn btn-outline-secondary btn-sm"
                                            title="Excel'e indir">
                                            <i class="fas fa-file-excel"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Seçili Parseller İçin Aksiyon button -->
                                <div class="mb-3" id="selectedActions" style="display: none;">
                                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                        <span class="badge bg-primary" id="selectedCount">0 seçili</span>
                                        <div class="d-flex gap-2">
                                        <button id="exportToExcelBtn" class="btn btn-outline-secondary btn-sm"
                                            title="Excel'e indir">
                                            <i class="fas fa-file-excel"></i>
                                        </button>
                                        </div>
                                    </div>
                                </div>
                                <div id="selectedPropertyInfo" class="mb-3" style="display: none;">
                                    <h6>Seçili Arazi Bilgileri</h6>
                                    <table class="table table-bordered">
                                        <tbody>
                                            <tr>
                                                <td>Prolegal Taşınmaz No</td>
                                                <td id="info-id"></td>
                                            </tr>
                                            <tr>
                                                <td>İl</td>
                                                <td id="info-il"></td>
                                            </tr>
                                            <tr>
                                                <td>İlçe</td>
                                                <td id="info-ilce"></td>
                                            </tr>
                                            <tr>
                                                <td>Mahalle</td>
                                                <td id="info-mahalle"></td>
                                            </tr>
                                            <tr>
                                                <td>Nitelik</td>
                                                <td id="info-nitelik"></td>
                                            </tr>
                                            <tr>
                                                <td>Alan</td>
                                                <td id="info-alan"></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>


                                <!-- Liste Tabı için Aksiyon Buton's -->
                                <div class="mb-3 d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">Parsel Listesi</h6>
                                    <div class="d-flex gap-2"></div>
                                </div>

                                <!-- Üst scroll bar -->
                                <div class="table-responsive" id="top-scroll-bar"
                                    style="overflow-x: auto; overflow-y: hidden; height: 20px; margin-bottom: 5px;">
                                    <div style="height: 1px; min-width: 1200px;"></div>
                                </div>

                                <div class="table-responsive modern-table" id="main-table-container"
                                    style="overflow-x: auto;">
                                    <table class="table table-hover" style="min-width: 1200px;">
                                        <thead class="table-header-sticky">
                                            <tr>
                                                <th style="width: 40px; min-width: 40px;">
                                                    <input type="checkbox" id="selectAllProperties"
                                                        class="form-check-input">
                                                </th>
                                                <th style="width: 50px; min-width: 50px; text-align: center;">
                                                    Sıra
                                                </th>
                                                <th data-column="id" data-order="desc"
                                                    style="min-width: 120px; cursor: pointer;" class="sortable-header">
                                                    Prolegal Taşınmaz No <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="il" data-order="asc"
                                                    style="min-width: 80px; cursor: pointer;" class="sortable-header">
                                                    İl <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="ilce" data-order="asc"
                                                    style="min-width: 100px; cursor: pointer;" class="sortable-header">
                                                    İlçe <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="mahalle" data-order="asc"
                                                    style="min-width: 120px; cursor: pointer;" class="sortable-header">
                                                    Mahalle <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="ada" data-order="asc"
                                                    style="min-width: 60px; cursor: pointer;" class="sortable-header">
                                                    Ada <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="parsel" data-order="asc"
                                                    style="min-width: 60px; cursor: pointer;" class="sortable-header">
                                                    Parsel <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="alan" data-order="asc"
                                                    style="min-width: 80px; cursor: pointer;" class="sortable-header">
                                                    Alan <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="nitelik" data-order="asc"
                                                    style="min-width: 100px; cursor: pointer;" class="sortable-header">
                                                    Nitelik <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="imarFonksiyon" data-order="asc"
                                                    style="min-width: 150px; cursor: pointer;" class="sortable-header">
                                                    İmar Fonksiyonu <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="durum" data-order="asc"
                                                    style="min-width: 100px; cursor: pointer;" class="sortable-header">
                                                    Uygunluk Durumu <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="sorguDurumu" data-order="asc"
                                                    style="min-width: 120px; cursor: pointer;" class="sortable-header">
                                                    Sorgu Durumu <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="basvuru_turu" data-order="asc"
                                                    style="min-width: 100px; cursor: pointer;" class="sortable-header">
                                                    Başvuru Türü <i class="fas fa-sort"></i>
                                                </th>
                                                <th data-column="basvurulan_firma" data-order="asc"
                                                    style="min-width: 120px; cursor: pointer;" class="sortable-header">
                                                    Başvurulan Firma <i class="fas fa-sort"></i>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody id="result-list">
                                            <!-- Sonuçlar buraya JavaScript ile eklenecek -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <!-- New Tab Content -->
                        <div class="tab-pane fade p-3" id="nav-company-management" role="tabpanel"
                            aria-labelledby="nav-company-management-tab" tabindex="0"
                            style="height: 100vh; overflow-y: auto; padding-bottom: 60px;">


                            <!-- Şirket listesi - minimal, açılır/kapanır panel -->
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <button type="button"
                                        class="btn btn-sm btn-outline-secondary text-start flex-grow-1 d-flex align-items-center justify-content-between"
                                        id="companyTabToggle">
                                        <span class="d-flex align-items-center">
                                            <span class="me-2" id="companyTabToggleIcon">▼</span>
                                            <span class="small company-tab-toggle-label">Şirketleri listele</span>
                                        </span>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-secondary ms-2"
                                        id="companyTabAddBtn">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                                <div id="companyTabPanel">
                                    <div class="input-group input-group-sm mb-2">
                                        <span class="input-group-text"><i class="fas fa-search"></i></span>
                                        <input type="text" class="form-control" id="companyTabSearch"
                                            placeholder="Şirket ara">
                                    </div>
                                    <div id="companyTabList" class="list-group list-group-flush border rounded-3">
                                        <!-- Şirket satırları JS ile doldurulacak -->
                                    </div>
                                </div>
                            </div>

                            <!-- Seçili şirketin arazileri -->
                            <div class="mb-3">
                                <div class="d-flex flex-column gap-1 mb-2">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <h6 class="mb-1 small text-muted mb-0">Şirkete Ait Araziler</h6>
                                        <span class="badge bg-primary flex-shrink-0" id="companySelectedCount">0
                                            seçili</span>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center mt-1">
                                        <div class="company-action-bar">
                                            <button id="companyAddToQueueBtn"
                                                class="btn btn-outline-success btn-sm company-queue-btn">
                                                <i class="fas fa-plus"></i> Sorgu Sırasına
                                            </button>
                                        </div>
                                        <div class="d-flex align-items-center gap-1">
                                            <button id="companyPlayButton" class="btn btn-sm btn-outline-primary">
                                                <i class="fas fa-play"></i>
                                            </button>
                                            <button id="companyStopButton" class="btn btn-sm btn-outline-danger"
                                                style="display: none;">
                                                <i class="fas fa-stop"></i>
                                            </button>
                                            <button id="companyExportExcelBtn" class="btn btn-outline-secondary btn-sm"
                                                title="Excel'e indir">
                                                <i class="fas fa-file-excel"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div id="companySelectedPropertyInfo" class="mb-2" style="display: none;">
                                    <table class="table table-sm table-borderless mb-0">
                                        <tbody>
                                            <tr>
                                                <td class="text-muted small">Prolegal No</td>
                                                <td id="company-info-id"></td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted small">Konum</td>
                                                <td><span id="company-info-il"></span> / <span
                                                        id="company-info-ilce"></span> / <span
                                                        id="company-info-mahalle"></span></td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted small">Nitelik</td>
                                                <td id="company-info-nitelik"></td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted small">Alan</td>
                                                <td id="company-info-alan"></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="table-responsive modern-table" id="company-table-container"
                                    style="overflow-x: auto; overflow-y: scroll;">
                                    <table class="table table-hover" style="min-width: 1200px;">
                                        <thead class="table-header-sticky">
                                            <tr>
                                                <th style="width: 40px; min-width: 40px;">
                                                    <input type="checkbox" id="companySelectAllProperties"
                                                        class="form-check-input">
                                                </th>
                                                <th style="width: 50px; min-width: 50px; text-align: center;">
                                                    Sıra
                                                </th>
                                                <th style="min-width: 120px;" class="sortable" data-sort-key="id">
                                                    Prolegal Taşınmaz No <span class="sort-icon"></span></th>
                                                <th style="min-width: 80px;" class="sortable" data-sort-key="il">İl
                                                    <span class="sort-icon"></span>
                                                </th>
                                                <th style="min-width: 100px;" class="sortable" data-sort-key="ilce">İlçe
                                                    <span class="sort-icon"></span>
                                                </th>
                                                <th style="min-width: 120px;" class="sortable" data-sort-key="mahalle">
                                                    Mahalle <span class="sort-icon"></span></th>
                                                <th style="min-width: 60px;" class="sortable" data-sort-key="ada">Ada
                                                    <span class="sort-icon"></span>
                                                </th>
                                                <th style="min-width: 60px;" class="sortable" data-sort-key="parsel">
                                                    Parsel <span class="sort-icon"></span></th>
                                                <th style="min-width: 80px;" class="sortable" data-sort-key="alan">Alan
                                                    <span class="sort-icon"></span>
                                                </th>
                                                <th style="min-width: 100px;" class="sortable" data-sort-key="nitelik">
                                                    Nitelik <span class="sort-icon"></span></th>
                                                <th style="min-width: 150px;" class="sortable"
                                                    data-sort-key="imarFonksiyon">İmar Fonksiyonu <span
                                                        class="sort-icon"></span></th>
                                                <th style="min-width: 100px;" class="sortable" data-sort-key="uygunluk">
                                                    Uygunluk Durumu <span class="sort-icon"></span></th>
                                                <th style="min-width: 120px;" class="sortable" data-sort-key="sorgu">
                                                    Sorgu Durumu <span class="sort-icon"></span></th>
                                                <th style="min-width: 120px;" class="sortable" data-sort-key="firma">
                                                    Başvurulan Firma <span class="sort-icon"></span></th>
                                            </tr>
                                        </thead>
                                        <tbody id="company-property-list">
                                            <!-- Company properties will be added here via JavaScript -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Sol Sidebar - Hızlı Şirket Oluştur Modal -->
                        <div class="modal fade" id="leftQuickCompanyModal" tabindex="-1"
                            aria-labelledby="leftQuickCompanyModalLabel" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title" id="leftQuickCompanyModalLabel">Yeni Şirket Oluştur</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"
                                            aria-label="Kapat"></button>
                                    </div>
                                    <div class="modal-body">
                                        <div class="mb-3">
                                            <label for="leftQuickCompanyName" class="form-label">Şirket Adı</label>
                                            <input type="text" class="form-control" id="leftQuickCompanyName"
                                                placeholder="Örn: ABC Yatırım A.Ş.">
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary btn-sm"
                                            data-bs-dismiss="modal">Vazgeç</button>
                                        <button type="button" class="btn btn-primary btn-sm"
                                            id="leftQuickCompanySaveBtn">
                                            <i class="fas fa-check"></i> Oluştur ve Seç
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Kontrol sekmesi -->
                        <div class="tab-pane fade p-3" id="nav-kontrol" role="tabpanel"
                            aria-labelledby="nav-kontrol-tab" tabindex="0">

                            <!-- Durum Filtreleme -->
                            <div class="mb-4 px-3">
                                <label class="form-label text-muted small fw-semibold mb-3">DURUM FİLTRELEME</label>
                                <div class="d-flex flex-column gap-2">
                                    <!-- Müşterisiz BaşvurU -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox"
                                            id="durumMusterisizBasvuru" value="kucuk_basvuru">
                                        <label class="form-check-label w-100 d-block" for="durumMusterisizBasvuru">
                                            <div class="btn btn-outline-warning text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#FF8C00">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #FF8C00; border-radius: 50%; box-shadow: 0 0 6px rgba(255,140,0,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Müşterisiz
                                                        Başvuru</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Müşterili Başvuru -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox"
                                            id="durumMusteriliBasvuru" value="buyuk_basvuru">
                                        <label class="form-check-label w-100 d-block" for="durumMusteriliBasvuru">
                                            <div class="btn btn-outline-warning text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#FFED4E">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #FFED4E; border-radius: 50%; box-shadow: 0 0 6px rgba(255,237,78,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Müşterili
                                                        Başvuru</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Sorguda -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox" id="durumSorguda"
                                            value="SORGUDA">
                                        <label class="form-check-label w-100 d-block" for="durumSorguda">
                                            <div class="btn btn-outline-success text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#00732F">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #00732F; border-radius: 50%; box-shadow: 0 0 6px rgba(0,115,47,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Sorguda</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Sırada -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox" id="durumSirada"
                                            value="SIRADA">
                                        <label class="form-check-label w-100 d-block" for="durumSirada">
                                            <div class="btn btn-outline-secondary text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#808080">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #808080; border-radius: 50%; box-shadow: 0 0 6px rgba(128,128,128,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Sırada</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>



                                    <!-- Uygun -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox" id="durumUygun"
                                            value="UYGUN">
                                        <label class="form-check-label w-100 d-block" for="durumUygun">
                                            <div class="btn btn-outline-primary text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#004CFF">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #004CFF; border-radius: 50%; box-shadow: 0 0 6px rgba(0,76,255,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Uygun</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Uygun Değil -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox" id="durumUygunDegil"
                                            value="UYGUN DEĞİL">
                                        <label class="form-check-label w-100 d-block" for="durumUygunDegil">
                                            <div class="btn btn-outline-secondary text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#732982">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #732982; border-radius: 50%; box-shadow: 0 0 6px rgba(115,41,130,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Uygun Değil</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Başvurusu Yapılmamış Uygunlar -->
                                    <div class="form-check p-0">
                                        <input class="form-check-input d-none" type="checkbox"
                                            id="durumBasvurusuYapilmamisUygunlar" value="UYGUN_BASVURU_NULL">
                                        <label class="form-check-label w-100 d-block"
                                            for="durumBasvurusuYapilmamisUygunlar">
                                            <div class="btn btn-outline-info text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                                style="width: 100%" data-color="#0066CC">
                                                <div class="d-flex align-items-center">
                                                    <div class="me-3"
                                                        style="width: 12px; height: 12px; background: #0066CC; border-radius: 50%; box-shadow: 0 0 6px rgba(0,102,204,0.4);">
                                                    </div>
                                                    <span style="font-size: 13px; font-weight: 700;">Başvurusu
                                                        Yapılmamış Uygunlar</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <style>
                                .durum-filter-btn {
                                    transition: all 0.3s ease;
                                    cursor: pointer;
                                    font-size: 11px !important;
                                    border-radius: 20px !important;
                                    backdrop-filter: blur(10px);
                                }

                                .durum-filter-btn:hover {
                                    transform: translateY(-1px);
                                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                                }

                                input[type="checkbox"]:checked+label .durum-filter-btn {
                                    color: white !important;
                                    border-color: transparent !important;
                                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                                }

                                /* Tıklandığında renklendirme */
                                input[id="durumMusterisizBasvuru"]:checked+label .durum-filter-btn {
                                    background-color: #FF8C00 !important;
                                }

                                input[id="durumMusteriliBasvuru"]:checked+label .durum-filter-btn {
                                    background-color: #FFED4E !important;
                                    color: black !important;
                                }

                                input[id="durumSorguda"]:checked+label .durum-filter-btn {
                                    background-color: #00732F !important;
                                }

                                input[id="durumSirada"]:checked+label .durum-filter-btn {
                                    background-color: #808080 !important;
                                    color: white !important;
                                }

                                input[id="durumSorgulandi"]:checked+label .durum-filter-btn {
                                    background-color: #17a2b8 !important;
                                    color: white !important;
                                }

                                input[id="durumUygun"]:checked+label .durum-filter-btn {
                                    background-color: #004CFF !important;
                                }

                                input[id="durumUygunDegil"]:checked+label .durum-filter-btn {
                                    background-color: #732982 !important;
                                }

                                input[id="durumBasvurusuYapilmamisUygunlar"]:checked+label .durum-filter-btn {
                                    background-color: #0066CC !important;
                                }

                            </style>

                            <!-- Prolegal Taşınmaz No Input -->
                            <div class="mb-4 px-3">
                                <label class="form-label text-muted small fw-semibold mb-3">PROLEGAL TAŞINMAZ NO</label>
                                <div class="form-check p-0">
                                    <div class="btn btn-outline-secondary text-start border-1 py-2 px-3 durum-filter-btn rounded-pill"
                                        style="width: 100%" data-color="#FFB6C1">
                                        <div class="d-flex align-items-center">
                                            <div class="me-3"
                                                style="width: 12px; height: 12px; background: #FFB6C1; border-radius: 50%; box-shadow: 0 0 6px rgba(255,182,193,0.4);">
                                            </div>
                                            <input type="text" class="form-control border-0 bg-transparent p-0"
                                                id="prolegalNo" placeholder="Prolegal Taşınmaz No giriniz"
                                                style="box-shadow: none; font-size: 13px; font-weight: 700;">
                                        </div>
                                    </div>
                                </div>
                            </div>


                            <div class="d-grid gap-2 px-3">
                                <button class="btn btn-success" type="button" id="btn-sorgulaPro">Sorgula</button>
                            </div>
                            <div style="margin-top:10px;" class="d-grid gap-2 px-3">
                                <button class="btn btn-danger" type="button" id="btn-temizle">Temizle</button>
                            </div>

                        </div>

                        <div class="tab-pane fade show active p-3" id="nav-home" role="tabpanel"
                            aria-labelledby="nav-home-tab" tabindex="0">

                            <!-- Şirket Seçimi (Sorgu Tabı Üstü) -->
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="mb-0"><i class="fas fa-building me-2"></i>Şirket Seçimi</h6>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="input-group input-group-sm" style="max-width: 260px;">
                                        <span class="input-group-text"><i class="fas fa-briefcase"></i></span>
                                        <input id="leftQueryCompanyInput" class="form-control" list="leftCompanyList"
                                            placeholder="Şirket ara & seç...">
                                        <datalist id="leftCompanyList"></datalist>
                                    </div>
                                    <button id="leftQuickAddCompanyBtn"
                                        class="btn btn-outline-primary btn-sm d-flex align-items-center" type="button"
                                        title="Yeni şirket oluştur">
                                        <i class="fas fa-plus fa-xs me-1"></i>
                                        <span class="small">Ekle</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Ada/Parsel Filtreleme Switch -->
                            <div class="mb-3 parsel-switch-container">
                                <div class="toggle-container">
                                    <label for="parselSwitch" class="form-label">Ada/Parsel Filtreleme</label>
                                    <label class="switch">
                                        <input type="checkbox" id="parselSwitch">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div class="mb-3">
                                <select class="form-select" aria-label="İl Seçiniz" id="select-il">
                                    <option value="" selected>İl Seçiniz</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">İlçe Seçiniz</label>
                                <div id="ilce-container" class="stylish-checkbox-container"></div>
                                <div class="button-group">
                                    <button type="button" id="selectAllIlce"
                                        class="btn btn-primary stylish-button">Hepsini Seç</button>
                                    <button type="button" id="clearIlce" class="btn btn-secondary stylish-button">Tümünü
                                        Temizle</button>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Mahalle Seçiniz</label>
                                <div id="mahalle-container" class="stylish-checkbox-container"></div>
                                <div class="button-group">
                                    <button type="button" id="selectAllMahalle"
                                        class="btn btn-primary stylish-button">Hepsini Seç</button>
                                    <button type="button" id="clearMahalle"
                                        class="btn btn-secondary stylish-button">Tümünü Temizle</button>
                                </div>
                            </div>
                            <div class="mb-3 input-ada" id="ada-parsel-container" style="display: none;">
                                <input type="text" class="form-control" placeholder="Ada" id="input-ada" value="">
                            </div>
                            <div class="mb-3 input-parsel" id="ada-parsel-container-2" style="display: none;">
                                <input type="text" class="form-control" placeholder="Parsel" id="input-parsel" value="">
                            </div>
                            <div style="display:none;" class="mb-3">
                                <input type="text" class="form-control" placeholder="Nitelik" id="input-nitelik"
                                    value="">
                            </div>
                            <div class="mb-3">
                                <label for="turSecimi" class="form-label">Tür Seçimi</label>
                                <select class="form-select" id="turSecimi">
                                    <option value="0" selected>Uygun Araziler</option>
                                    <option value="1">Diğer Araziler</option>
                                    <option value="2">Arazi Dışı</option>
                                    <option value="3">Hepsi</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="hisseDurumu" class="form-label">Hisse Durumu</label>
                                <select class="form-select" id="hisseDurumu">
                                    <option value="0" selected>Tam</option>
                                    <option value="1">Hisseli</option>
                                    <option value="2">Hepsi</option>
                                </select>
                            </div>


                            <div class="mb-3">
                                <label for="sorgulamaDurumu" class="form-label">Sorgulama Durumu</label>
                                <select class="form-select" id="sorgulamaDurumu">
                                    <option value="Hepsi" selected>Hepsi</option>
                                    <option value="Uygun">Uygun</option>
                                    <option value="Sorgulanmadı">Sorgulanmadı</option>
                                </select>
                            </div>



                            <div class="mb-3 stylish-container">
                                <label class="form-label stylish-label">Arazi Büyüklüğü (da)</label>
                                <div class="row">
                                    <div class="col-6">
                                        <input type="number" id="araziMin" class="form-control stylish-search mb-2"
                                            placeholder="Min (örn: 80)" min="0" step="0.1" value="0">
                                    </div>
                                    <div class="col-6">
                                        <input type="number" id="araziMax" class="form-control stylish-search mb-2"
                                            placeholder="Max (örn: 120)" min="0" step="0.1" value="600000">
                                    </div>
                                </div>
                                <div class="button-group">
                                    <button type="button" id="clearAraziBuyuklugu"
                                        class="btn btn-secondary stylish-button">Temizle</button>
                                </div>
                            </div>

                            <!-- Taşınmaz Detay bölümü -->
                            <div class="mb-3 stylish-container">
                                <label class="form-label stylish-label">Taşınmaz Detay</label>
                                <input type="text" id="tasinmazDetaySearch" class="form-control stylish-search mb-2"
                                    placeholder="Taşınmaz Detay Arayın...">
                                <div id="tasinmazDetayCheckboxes" class="stylish-checkbox-container">
                                    <!-- Checkboxlar JavaScript ile buraya eklenecek -->
                                </div>
                                <div class="button-group">
                                    <button type="button" id="selectAllTasinmazDetay"
                                        class="btn btn-primary stylish-button">Hepsini Seç</button>
                                    <button type="button" id="clearTasinmazDetay"
                                        class="btn btn-secondary stylish-button">Tümünü
                                        Temizle</button>
                                </div>
                            </div>

                            <!-- İmar Fonksiyonu bölümü - Ana/Alt Fonksiyon Yapısı -->
                            <div class="mb-3 stylish-container">
                                <!-- İmar Fonksiyon Switch -->
                                <div class="mb-3 imar-switch-container">
                                    <div class="toggle-container">
                                        <label for="imarSwitch" class="form-label">Sadece imar bilgisi olanları
                                            sorgula</label>
                                        <label class="switch">
                                            <input type="checkbox" id="imarSwitch">
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Ana Fonksiyon Seçimi -->
                                <div class="mb-3" style="display: none;">
                                    <label class="form-label">Ana Fonksiyon</label>
                                    <input type="text" id="anaFonksiyonSearch" class="form-control stylish-search mb-2"
                                        placeholder="Ana Fonksiyon Arayın...">
                                    <div id="anaFonksiyonCheckboxes" class="stylish-checkbox-container">
                                        <!-- Ana fonksiyonlar JavaScript ile buraya eklenecek -->
                                    </div>
                                    <div class="button-group">
                                        <button type="button" id="selectAllAnaFonksiyon"
                                            class="btn btn-primary stylish-button">Hepsini Seç</button>
                                        <button type="button" id="clearAnaFonksiyon"
                                            class="btn btn-secondary stylish-button">Tümünü Temizle</button>
                                    </div>
                                </div>

                                <!-- Alt Fonksiyon Seçimi -->
                                <div class="mb-3" style="display: none;">
                                    <label class="form-label">Alt Fonksiyon</label>
                                    <input type="text" id="altFonksiyonSearch" class="form-control stylish-search mb-2"
                                        placeholder="Alt Fonksiyon Arayın...">
                                    <div id="altFonksiyonCheckboxes" class="stylish-checkbox-container">
                                        <!-- Alt fonksiyonlar JavaScript ile buraya eklenecek -->
                                    </div>
                                    <div class="button-group">
                                        <button type="button" id="selectAllAltFonksiyon"
                                            class="btn btn-primary stylish-button">Hepsini Seç</button>
                                        <button type="button" id="clearAltFonksiyon"
                                            class="btn btn-secondary stylish-button">Tümünü Temizle</button>
                                    </div>
                                </div>
                            </div>

                            <div class="d-grid gap-2">
                                <button class="btn btn-success" type="button" id="btn-sorgula">Sorgula</button>
                            </div>
                            <div style="margin-top:10px;margin-bottom:50px;" class="d-grid gap-2">
                                <button class="btn btn-danger" type="button" id="btn-temizle-sorgu">Temizle</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sidebar-footer-container">&copy; 2024. <a href="https://www.captrx.com"
                        target="_blank"><b>CAPTRX</b>.</a></div>
            </div>
            <div id="page-content-wrapper">
                <div class="map-container">
                    <div id="map"></div>
                    <div class="map-toolbar-container" style="border-radius:999px; padding:6px 8px; gap:8px; background:rgba(255,255,255,0.85);">
                        <div class="btn-group">
                            <div id="map-toolbar-group-1" class="btn-group">
                                <button class="btn btn-flat btn-sm btn-default me-1" id="zoom-in-btn" title="Yakınlaş">
                                    <i class="bi bi-plus"></i>
                                </button>
                                <button class="btn btn-flat btn-sm btn-default me-1" id="zoom-out-btn" title="Uzaklaş">
                                    <i class="bi bi-dash"></i>
                                </button>
                            </div>
                            <!-- Yeni Tara Butonu -->
                            <button class="btn btn-primary btn-sm me-1" id="scan-region-btn" title="Bölgeyi Tara">
                                <i class="fas fa-search"></i> Bölgeyi Tara
                            </button>
                            <button class="btn btn-warning btn-sm me-1" id="scan-region-nofilter-btn" title="Filtresiz Tara">
                                <i class="fas fa-search"></i> Filtresiz Tara
                            </button>
                           
                        </div>
                        <div id="map-toolbar-group-2" class="btn-group">
                            <!----
                     <div class="btn-group">
                        <button class="btn btn-flat btn-default btn-sm " id="map-query-btn" title="Haritadan Sorgula">
                           <i class="bi bi-info-lg"></i>
                        </button>
                     </div>
                     <div class="btn-group">
                        <button class="btn btn-flat btn-default btn-sm " id="print-btn" title="Yazdır">
                           <i class="bi bi-printer"></i>
                        </button>
                     </div> 
                     --!-->
                        </div>
                        <div id="coordinate-panel-container" class="input-group">
                            <button type="button" class="btn btn-flat btn-sm me-1" id="toolbar-logout-btn" title="Çıkış"
                                style="width:60px; display:flex; align-items:center; justify-content:center; border-radius:4px; border:0; background:linear-gradient(135deg,#4285f4,#0b63e7); color:#fff;"
                                onclick="window.location.href='/logout.php'">
                                <span style="display:flex; align-items:center; justify-content:center; font-size:16px;">
                                    <i class="bi bi-box-arrow-right"></i>
                                </span>
                            </button>
                            <input type="text" class="form-control form-control-sm flat"
                                style="border-left: solid 1px #ccc !important; display:none;" id="coordinate-info-input"
                                readonly="readonly" title="" disabled>
                            <input type="text" class="form-control form-control-sm flat"
                                style="border-left: solid 1px #ccc !important; display:none;" id="zoom-level-text"
                                readonly="readonly" title="" disabled>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Modern Draggable Modal -->
    <div class="modal fade" id="info-modal" tabindex="-1" aria-labelledby="info-modal-title" aria-hidden="true">
        <div class="modal-dialog modern-draggable-modal" id="info-modal-dialog">
            <div class="modal-content" id="info-modal-content">
                <!-- Modal Header with Controls -->
                <div class="modal-header modern-modal-header" id="info-modal-header">
                    <!-- Control Buttons -->
                    <div class="modern-modal-controls">
                    </div>

                    <!-- Title -->
                    <h5 class="modern-modal-title" id="info-modal-title">Arazi Bilgileri</h5>

                    <!-- Header Actions: Teknik / 3D / TKGM / A/P -->
                    <div class="d-flex align-items-center ms-2 gap-1">
                        <button id="tapusorBtn"
                            class="btn btn-sm btn-outline-light tapusor-tab d-inline-flex align-items-center"
                            type="button" title="Teknik Analiz"
                            style="border-radius:999px; font-size:12px; padding:5px 14px; min-width:90px;">
                            Teknik
                            <input class="form-check-input action-checked ms-2" type="checkbox" id="tapusorChecked"
                                title="Teknik analiz yapıldı" onclick="event.stopPropagation();">
                        </button>
                        <button id="googleEarthBtn"
                            class="btn btn-sm btn-outline-light google-earth-tab d-inline-flex align-items-center"
                            type="button" title="3D Görünüm"
                            style="border-radius:999px; font-size:12px; padding:5px 14px; min-width:90px;">
                            3D
                            <input class="form-check-input action-checked ms-2" type="checkbox" id="googleEarthChecked"
                                title="3D bakıldı" onclick="event.stopPropagation();">
                        </button>
                        <button id="tkgmBtn"
                            class="btn btn-sm btn-outline-light tkgm-tab d-inline-flex align-items-center" type="button"
                            title="TKGM" style="border-radius:999px; font-size:12px; padding:5px 14px; min-width:90px;">
                            TKGM
                            <input class="form-check-input action-checked ms-2" type="checkbox" id="tkgmChecked"
                                title="TKGM kontrol edildi" onclick="event.stopPropagation();">
                        </button>
                        <button id="apToggleBtn" class="btn btn-sm btn-outline-light ms-1 me-2 ap-toggle-btn"
                            type="button" title="Ada / Parsel"
                            style="border-radius:999px; font-size:12px; padding:5px 14px; min-width:90px;">
                            A/P
                        </button>
                    </div>

                    <!-- Close Button -->
                    <button type="button" class="modern-modal-close" data-bs-dismiss="modal" aria-label="Close">
                        <i class="bi bi-x"></i>
                    </button>
                </div>

                <!-- Resize Handles -->
                <div class="modern-resize-handle nw"></div>
                <div class="modern-resize-handle ne"></div>
                <div class="modern-resize-handle sw"></div>
                <div class="modern-resize-handle se"></div>
                <div class="modern-resize-handle n"></div>
                <div class="modern-resize-handle s"></div>
                <div class="modern-resize-handle w"></div>
                <div class="modern-resize-handle e"></div>
                <div class="modal-body p-0 m-0" id="modal-dots-tabs">
                    <div class="" id="oznitelik">
                        <div class="nav-tabs-custom">
                            <nav>
                                <div class="modal-segment-tabs" id="info-nav-tab" role="tablist">
                                    <button aria-controls="info-oznitelik" aria-selected="true"
                                        class="segment-button active" data-bs-target="#info-oznitelik"
                                        data-bs-toggle="tab" id="info-oznitelik-tab" role="tab"
                                        type="button">Tapu</button>
                                    <button aria-controls="info-imar" aria-selected="false" class="segment-button"
                                        data-bs-target="#info-imar" data-bs-toggle="tab" id="info-imar-tab" role="tab"
                                        type="button">İmar</button>
                                    <button aria-controls="info-sorgu" aria-selected="false" class="segment-button"
                                        data-bs-target="#info-sorgu" data-bs-toggle="tab" id="info-sorgu-tab" role="tab"
                                        type="button">Sorgu & Başvuru</button>
                                    <button aria-controls="info-veri" aria-selected="false"
                                        class="segment-button d-none" data-bs-target="#info-veri" data-bs-toggle="tab"
                                        id="info-veri-tab" role="tab" type="button" style="display:none;">Veri
                                        Güncelleme</button>
                                </div>
                                <div class="modal-quick-actions mt-2 d-flex align-items-center gap-2">
                                    <span id="veriLoadingIndicator" class="text-muted small d-none">Yükleniyor...</span>
                                    <!-- Aksiyon butonları artık Sorgu & Başvuru kartı içinde -->
                                </div>
                            </nav>
                            <div class="tab-content mt-2" id="info-nav-tabContent">
                                <div aria-labelledby="info-oznitelik-tab" class="tab-pane fade p-3 show active"
                                    id="info-oznitelik" role="tabpanel" tabindex="0">
                                    <table class="table table-sm table-bordered table-striped" style="font-size:12px">
                                        <tr>
                                            <td>İl</td>
                                            <td id="oznitelik:il"></td>
                                        </tr>
                                        <tr>
                                            <td>İlçe</td>
                                            <td id="oznitelik:ilce"></td>
                                        </tr>
                                        <tr>
                                            <td>Mahalle/Köy</td>
                                            <td id="oznitelik:mahalle"></td>
                                        </tr>
                                        <tr>
                                            <td>Mahalle No</td>
                                            <td id="oznitelik:mahalleno"></td>
                                        </tr>
                                        <tr>
                                            <td>Prolegal Taşınmaz No</td>
                                            <td id="oznitelik:id"></td>
                                        </tr>
                                        <tr>
                                            <td>Hisse</td>
                                            <td id="oznitelik:hisse"></td>
                                        </tr>
                                        <tr>
                                            <td>Tapu Alanı</td>
                                            <td id="oznitelik:tapualani"></td>
                                        </tr>
                                        <tr>
                                            <td>Ada</td>
                                            <td id="oznitelik:ada"></td>
                                        </tr>
                                        <tr>
                                            <td>Parsel</td>
                                            <td id="oznitelik:parsel"></td>
                                        </tr>
                                        <tr>
                                            <td>Nitelik</td>
                                            <td id="oznitelik:nitelik"></td>
                                        </tr>
                                        <tr>
                                            <td>Mevkii</td>
                                            <td id="oznitelik:mevkii"></td>
                                        </tr>
                                        <tr>
                                            <td>Zemin Tip</td>
                                            <td id="oznitelik:zemintipi"></td>
                                        </tr>
                                        <tr>
                                            <td>Pafta</td>
                                            <td id="oznitelik:pafta"></td>
                                        </tr>
                                        <tr id="sirketIliskisiRow">
                                            <td>Şirket İlişkisi</td>
                                            <td id="oznitelik:sirket_iliskisi">
                                                <div class="d-flex justify-content-between align-items-center">
                                                    <span id="company-relations-text"></span>
                                                    <div class="form-check m-0">
                                                        <input class="form-check-input" type="checkbox"
                                                            id="firm-checkbox">
                                                        <label class="form-check-label small ms-1" for="firm-checkbox">
                                                            Seçili şirkete ekle
                                                        </label>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Değerlendirme</td>
                                            <td>
                                                <select id="oznitelik:not_rating" class="form-select form-select-sm">
                                                    <option value="0">Seçiniz...</option>
                                                    <option value="1">Yarar</option>
                                                    <option value="2">Yaramaz</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Prolegal Notu</td>
                                            <td>
                                                <div id="prolegalNoteDisplay"
                                                    class="d-flex justify-content-between align-items-start">
                                                    <div id="prolegalNoteText" class="flex-grow-1">
                                                        <span class="text-muted"></span>
                                                    </div>
                                                    <button type="button" class="btn btn-sm btn-outline-secondary ms-2"
                                                        id="editProlegalNoteBtn" title="Notu düzenle">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                </div>
                                                <div id="prolegalNoteEdit" class="d-none">
                                                    <textarea id="oznitelik-prolegal-not"
                                                        class="form-control form-control-sm" rows="3"
                                                        placeholder="Not yazınız..."></textarea>
                                                    <div class="mt-2">
                                                        <button type="button" class="btn btn-sm btn-success"
                                                            id="saveProlegalNoteBtn">
                                                            <i class="fas fa-check"></i> Kaydet
                                                        </button>
                                                        <button type="button" class="btn btn-sm btn-secondary ms-1"
                                                            id="cancelProlegalNoteBtn">
                                                            <i class="fas fa-times"></i> İptal
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Yeni Şirket Ekleme Bölümü -->
                                    <div class="mt-4">
                                        <!-- Yeni Şirket Ekleme -->
                                        <div class="mb-3">
                                            <label class="form-label small">Şirket İlişkisi Kur</label>
                                            <div class="position-relative">
                                                <select class="form-select form-select-sm" id="newCompanySearch"
                                                    onchange="handleCompanySelection()">
                                                    <option value="">Şirket seçiniz veya yeni şirket oluşturun...
                                                    </option>
                                                </select>
                                                <input type="text" class="form-control form-control-sm mt-2"
                                                    id="newCompanyManualInput" placeholder="Yeni şirket adı yazın..."
                                                    style="display: none;">
                                                <div class="mt-2 d-flex gap-2">
                                                    <button type="button" class="btn btn-outline-primary btn-sm"
                                                        id="toggleManualInput" onclick="toggleManualInput()">
                                                        <i class="fas fa-plus"></i> Yeni Şirket Oluştur
                                                    </button>
                                                    <!-- Şirkete Ekle Butonu (şirket seçildiğinde görünür) -->
                                                    <button type="button" class="btn btn-success btn-sm"
                                                        id="addToSelectedCompanyBtn" style="display: inline-block;">
                                                        <i class="fas fa-link"></i> Şirkete Ekle
                                                    </button>
                                                    <!-- createAndAddToCompanyBtn butonu kaldırıldı -->
                                                    <!-- Şirket Oluştur + Araziye Bağla Butonu -->
                                                    <button id="createAndLinkBtn" class="btn btn-warning btn-sm">
                                                        <i class="fas fa-bolt"></i> Şirket Oluştur + Araziye Bağla
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Onay Mesajı -->
                                        <div id="confirmationMessage" class="alert alert-info d-none">
                                            <div id="confirmationText"></div>
                                            <button type="button" class="btn btn-success btn-sm mt-2"
                                                id="confirmAddToCompanyBtn">
                                                <i class="fas fa-check"></i> Evet, Ekle
                                            </button>
                                        </div>

                                    </div>
                                    <div aria-labelledby="info-veri-tab" class="tab-pane fade p-3 d-none" id="info-veri"
                                        role="tabpanel" tabindex="0" style="display:none; background:#F9FAFB;">
                                        <div
                                            style="background:#FFFFFF; border-radius:14px; border:1px solid #E5E7EB; padding:12px 14px; box-shadow:0 14px 32px rgba(15,23,42,0.05);">
                                            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                                <input type="text" class="form-control form-control-sm"
                                                    id="veriMahalleId" placeholder="Mahalle ID" style="width:130px;"
                                                    readonly>
                                                <input type="number" class="form-control form-control-sm" id="veriAda"
                                                    placeholder="Ada" style="width:110px;">
                                                <input type="number" class="form-control form-control-sm"
                                                    id="veriParsel" placeholder="Parsel" style="width:110px;">
                                                <button class="btn btn-primary btn-sm" id="veriFetchBtn">Getir</button>
                                                <span class="text-muted small ms-2">Varsayılan: seçili parselin
                                                    bilgileri otomatik doldurulur.</span>
                                            </div>
                                            <div id="veriUpdateContainer" class="border rounded p-2"
                                                style="min-height:120px;">
                                                <div class="text-muted small">Veri yüklemek için Mahalle ID / Ada /
                                                    Parsel girin ya da seçili parsel bilgilerini kullanın.</div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <!-- İmar Bilgileri Sekmesi -->
                                <div aria-labelledby="info-imar-tab" class="tab-pane fade p-3" id="info-imar"
                                    role="tabpanel" tabindex="0">
                                    <div class="imar-info-section">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <h6 class="mb-0">İmar Bilgileri</h6>
                                        </div>

                                        <!-- Görüntüleme Modu -->
                                        <div id="imarViewMode">
                                            <table class="table table-sm table-bordered table-striped"
                                                style="font-size:12px">
                                                <tr>
                                                    <td><strong>İmar Detay</strong></td>
                                                    <td id="imar:imar_detay">İmar bilgisi bulunamadı</td>
                                                </tr>
                                            </table>
                                        </div>

                                    </div>
                                </div>

                                <!-- Sorgu ve Başvuru Durumu Sekmesi -->
                                <div aria-labelledby="info-sorgu-tab" class="tab-pane fade p-3" id="info-sorgu"
                                    role="tabpanel" tabindex="0" style="background:#F3F4F6;">
                                    <div
                                        style="background:#FFFFFF; border-radius:16px; border:1px solid #CBD5E1; padding:14px 16px; margin:0; box-shadow:0 18px 45px rgba(15,23,42,0.06);">
                                        <div class="row g-3">
                                            <!-- Sorgu Kartı -->
                                            <div class="col-md-6">
                                                <div
                                                    style="background:#FFFFFF; border-radius:14px; border:1px solid #E5E7EB; padding:12px 14px; min-height:180px; max-height:180px; overflow:hidden;">
                                                    <div
                                                        style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                                                        <span
                                                            style="font-size:13px; font-weight:600; letter-spacing:0.01em; color:#1F2933;">Sorgu</span>
                                                        <span id="oznitelik:sorgu_durumu"
                                                            style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:500; background:#EFF6FF; color:#2563EB; border:1px solid rgba(37,99,235,0.18);">
                                                            Belirtilmemiş
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div
                                                            style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                            <span style="color:#4B5563;">Son Güncelleme</span>
                                                            <span id="sorgu:guncelleme"
                                                                style="color:#111827; font-weight:500;">-</span>
                                                        </div>
                                                        <div
                                                            style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                            <span style="color:#4B5563;">Sorguya Alınma Tarihi</span>
                                                            <span id="sorgu:tarih"
                                                                style="color:#111827; font-weight:500;">-</span>
                                                        </div>
                                                        <div
                                                            style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                            <span style="color:#4B5563;">Sorgu Sonucu</span>
                                                            <span id="sorgu:sonuc"
                                                                style="color:#111827; font-weight:500;">-</span>
                                                        </div>
                                                        <div
                                                            style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                            <span style="color:#4B5563;">Sorgulanan Firma</span>
                                                            <span id="oznitelik:sorgulanan_firma"
                                                                style="color:#111827; font-weight:500; text-align:right; max-width:55%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">-</span>
                                                        </div>
                                                        <div
                                                            style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                            <span style="color:#4B5563;">Konu</span>
                                                            <span id="oznitelik:sorgu_konu"
                                                                style="color:#111827; font-weight:500; text-align:right; max-width:55%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">-</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- Başvuru Kartı -->
                                                <div class="col-md-6">
                                                    <div
                                                        style="background:#FFFFFF; border-radius:14px; border:1px solid #E5E7EB; padding:12px 14px; min-height:180px; max-height:180px; overflow:hidden;">
                                                        <div
                                                            style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                                                            <span
                                                                style="font-size:13px; font-weight:600; letter-spacing:0.01em; color:#1F2933;">Başvuru</span>
                                                            <span id="oznitelik:basvuru_turu"
                                                                style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:500; background:#ECFDF3; color:#166534;">
                                                                Belirtilmemiş
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <div
                                                                style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                                <span style="color:#4B5563;">Başvuru Sayısı</span>
                                                                <span id="oznitelik:basvuru_sayisi"
                                                                    style="color:#111827; font-weight:500;">-</span>
                                                            </div>
                                                            <div
                                                                style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                                <span style="color:#4B5563;">Başvurulan Firma</span>
                                                                <span id="oznitelik:ilgili_firma"
                                                                    style="color:#111827; font-weight:500; text-align:right; max-width:55%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">-</span>
                                                            </div>
                                                            <div
                                                                style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                                                <span style="color:#4B5563;">Başvuru Konusu</span>
                                                                <span id="oznitelik:basvuru_konu"
                                                                    style="color:#111827; font-weight:500; text-align:right; max-width:55%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">-</span>
                                                            </div>
                                                            <div
                                                                style="display:flex; justify-content:space-between; font-size:13px;">
                                                                <span style="color:#4B5563;">Başvuru Tarihi</span>
                                                                <span id="oznitelik:basvuru_tarihi"
                                                                    style="color:#111827; font-weight:500;">-</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Onay Mesajı -->
                                            <div id="confirmationMessageSecondary"
                                                class="sb-confirmation alert alert-info d-none"
                                                style="margin-top:14px; font-size:12px; border-radius:12px; padding:10px 12px; background:#FFFFFF; border:1px solid #E5E7EB; color:#1F2933;">
                                                <div id="confirmationTextSecondary"></div>
                                                <button type="button" class="btn btn-success btn-sm mt-2"
                                                    id="confirmAddToCompanyBtnSecondary">
                                                    <i class="fas fa-check"></i> Evet, Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                    <div class="d-none" id="baglidetaylar">
                        <table class="table table-sm table-bordered table-striped"
                            style="font-size:12px;text-align: center;">
                            <thead>
                                <tr>
                                    <th>Tip</th>
                                    <th>Alan (m<sup>2</sup>)</th>
                                </tr>
                            </thead>
                            <tbody id="baglidetaylar-listesi-data"></tbody>
                        </table>
                    </div>
                    <div class="d-none" id="koordinatlistesi">
                        <div class="nav-tabs-custom">
                            <nav>
                                <div class="nav nav-tabs" id="coord-nav-tab" role="tablist">
                                    <button aria-controls="nav-koordinat" aria-selected="true" class="nav-link active"
                                        data-bs-target="#nav-koordinat" data-bs-toggle="tab" id="nav-koordinat-tab"
                                        role="tab" type="button">Koordinat Listesi</button>
                                    <button aria-controls="nav-uzunluk" aria-selected="true" class="nav-link"
                                        data-bs-target="#nav-uzunluk" data-bs-toggle="tab" id="nav-uzunluk-tab"
                                        role="tab" type="button">Kenar Uzunluklari</button>
                                </div>
                            </nav>
                            <div class="tab-content" id="coord-nav-tabContent">
                                <div aria-labelledby="nav-koordinat-tab" class="tab-pane fade show active p-3"
                                    id="nav-koordinat" role="tabpanel" tabindex="0">
                                    <table class="table table-sm table-bordered table-striped"
                                        style="font-size:12px;text-align: center;">
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>Enlem</th>
                                                <th>Boylam</th>
                                            </tr>
                                        </thead>
                                        <tbody id="koordinat-listesi-data"></tbody>
                                    </table>
                                </div>
                                <div aria-labelledby="nav-uzunluk-tab" class="tab-pane fade show p-3" id="nav-uzunluk"
                                    role="tabpanel" tabindex="0">
                                    <table class="table table-sm table-bordered table-striped"
                                        style="font-size:12px;text-align: center;">
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>Uzunluk (m)</th>
                                            </tr>
                                        </thead>
                                        <tbody id="uzunluk-listesi-data"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-none" id="rota">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\google.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">Google Map</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input checked="" name="rota" type="radio" value="google" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\bing-map.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">Bing Map</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="rota" type="radio" value="bing" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\yandex.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">Yandex Map</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="rota" type="radio" value="yandex" />
                                    </td>
                                </tr>
                            </thead>
                        </table>
                        <div class="d-grid mt-5">
                            <div class="btn btn-success" id="rota-btn">
                                Git
                            </div>
                        </div>
                    </div>
                    <div class="d-none" id="indirme">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\pdf.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">PDF</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input checked="" name="indirme" type="radio" value="pdf" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\kml.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">KML</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="indirme" type="radio" value="kml" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\json.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">Geo JSON</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="indirme" type="radio" value="json" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\shapefile.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">SHAPE</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="indirme" type="radio" value="shp" />
                                    </td>
                                </tr>
                                <tr onclick="this.querySelector('input').checked = true;">
                                    <td style="width: 1px;"><img src="resimler\dxf.png" /></td>
                                    <td style="height: 73px;line-height: 73px;">DXF</td>
                                    <td style="height: 73px;line-height: 73px;text-align: center;">
                                        <input name="indirme" type="radio" value="dxf" />
                                    </td>
                                </tr>
                            </thead>
                        </table>
                        <div class="d-grid mt-5">
                            <div class="btn btn-success" id="indirme-btn">
                                Git
                            </div>
                        </div>
                    </div>
                    <div class="d-none" id="ortofoto">
                        <table class="table table-sm table-bordered table-striped"
                            style="font-size:12px;text-align: center;">
                            <thead>
                                <tr>
                                    <th>Üretim Tarihi</th>
                                    <th>Üreten Kurum</th>
                                    <th>Ad</th>
                                    <th>Ölçek</th>
                                </tr>
                            </thead>
                            <tbody id="ortofoto-listesi-data"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="modal" id="modal-olcum" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Ölçüm</h5>
                    <button aria-label="Close" class="btn-close" data-bs-dismiss="modal" type="button"></button>
                </div>
                <div class="modal-body">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr onclick="this.querySelector('input').checked = true;">
                                <td style="width: 1px;"><img src="resimler\measure-area.png" /></td>
                                <td style="height:73px;line-height: 73px;">Alan</td>
                                <td style="height:73px;line-height: 73px;text-align: center;">
                                    <input checked="" id="" name="measure" type="radio" value="area" />
                                </td>
                            </tr>
                            <tr onclick="this.querySelector('input').checked = true;">
                                <td style="width: 1px;"><img src="resimler\measure-distance.png" /></td>
                                <td style="height:73px;line-height: 73px;">Mesafe</td>
                                <td style="height:73px;line-height: 73px;text-align: center;">
                                    <input name="measure" type="radio" value="distance" />
                                </td>
                            </tr>
                        </thead>
                    </table>
                </div>
                <div class="modal-footer d-block">
                    <div class="d-grid">
                        <div class="btn btn-success" id="measure-btn">
                            Başlat
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="modal" id="modal-yazdir" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Yazdırılacak Parseli Seçiniz</h5>
                    <button aria-label="Close" class="btn-close" data-bs-dismiss="modal" type="button"></button>
                </div>
                <div class="modal-body">
                    <table class="table table-sm table-bordered">
                        <thead id="printer-data"></thead>
                    </table>
                </div>
                <div class="modal-footer d-block">
                    <div class="d-grid">
                        <div class="btn btn-success" id="printer-btn">
                            Yazdır
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Şirket düzenleme popup'ı -->
    <div class="modal fade" id="editCompanyModal" tabindex="-1" aria-labelledby="editCompanyLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="editCompanyLabel">Şirketi Düzenle</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="editCompanyId">
                    <div class="mb-3">
                        <label for="editCompanyName" class="form-label">Şirket Adı</label>
                        <input type="text" class="form-control" id="editCompanyName" placeholder="Şirket Adı">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                    <button type="button" class="btn btn-primary" id="saveCompanyBtn">Kaydet</button>
                </div>
            </div>
        </div>
    </div>
    <div class="modal" id="copyCompanyModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Şirket Kopyala</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="copyCompanyId">
                    <div class="form-group">
                        <label for="newCompanyName">Yeni Şirket Adı</label>
                        <input type="text" class="form-control" id="newCompanyNameInput"
                            placeholder="Şirket adı giriniz">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                    <button type="button" class="btn btn-primary" id="saveCopyCompany">Kaydet</button>
                </div>
            </div>
        </div>
    </div>

    <script src="assets/app.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/bootstrap.bundle.min.js"></script>
    <script src="tasarim/ui.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/imar_api.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/form.api.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/map.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/map.helper.js?v=<?php echo time(); ?>"></script>

    <script async
        src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAXNliOydb5zw06p7uBIp31tMpECoU6Tis&loading=async&callback=initMap&libraries=geometry&v=weekly">

        </script>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const sorguSonucuGuncelleBtn = document.getElementById('sorguSonucuGuncelleBtn');

            if (sorguSonucuGuncelleBtn) {
                sorguSonucuGuncelleBtn.addEventListener('click', function () {
                    console.log("Sorgu Sonucu Güncelle butonuna tıklandı");
                    // Pop-up mesajını göster
                    alert("Henüz çalışma devam ediyor");
                });
            }

            // ==================== ADA/PARSEL SWITCH FUNCTIONALITY ====================
            const parselSwitch = document.getElementById('parselSwitch');
            const adaParselContainer1 = document.getElementById('ada-parsel-container');
            const adaParselContainer2 = document.getElementById('ada-parsel-container-2');

            if (parselSwitch && adaParselContainer1 && adaParselContainer2) {
                parselSwitch.addEventListener('change', function () {
                    const isChecked = this.checked;
                    console.log('🔄 Ada/Parsel Switch:', isChecked ? 'AÇIK' : 'KAPALI');

                    if (isChecked) {
                        // Switch açık - Ada/Parsel alanlarını göster
                        adaParselContainer1.style.display = 'block';
                        adaParselContainer2.style.display = 'block';

                        // Kaydedilmiş değerleri yükle
                        loadAdaParselValues();
                        console.log('✅ Ada/Parsel filtreleme aktif');
                    } else {
                        // Switch kapalı - Değerleri kaydet ve alanları gizle
                        saveAdaParselValues();
                        adaParselContainer1.style.display = 'none';
                        adaParselContainer2.style.display = 'none';

                        console.log('❌ Ada/Parsel filtreleme kapatıldı (değerler korundu)');
                    }
                });

                // Sayfa yüklendiğinde switch durumunu kontrol et
                const isInitiallyChecked = parselSwitch.checked;
                if (isInitiallyChecked) {
                    adaParselContainer1.style.display = 'block';
                    adaParselContainer2.style.display = 'block';
                    loadAdaParselValues(); // Kaydedilmiş değerleri yükle
                }
            }

            // ==================== ADA/PARSEL INPUT EVENT LISTENERS ====================
            // Ada/Parsel input'larında değişiklik olduğunda otomatik kaydet
            document.addEventListener('DOMContentLoaded', function () {
                const inputAda = document.getElementById('input-ada');
                const inputParsel = document.getElementById('input-parsel');

                if (inputAda) {
                    inputAda.addEventListener('input', saveAdaParselValues);
                    inputAda.addEventListener('change', saveAdaParselValues);
                }

                if (inputParsel) {
                    inputParsel.addEventListener('input', saveAdaParselValues);
                    inputParsel.addEventListener('change', saveAdaParselValues);
                }
            });

            // ==================== ADA/PARSEL DEĞERİ SAKLAMA ====================
            function saveAdaParselValues() {
                const inputAda = document.getElementById('input-ada');
                const inputParsel = document.getElementById('input-parsel');

                if (inputAda && inputParsel) {
                    localStorage.setItem('savedAda', inputAda.value);
                    localStorage.setItem('savedParsel', inputParsel.value);
                    console.log('💾 Ada/Parsel değerleri kaydedildi:', inputAda.value, inputParsel.value);
                }
            }

            function loadAdaParselValues() {
                const inputAda = document.getElementById('input-ada');
                const inputParsel = document.getElementById('input-parsel');
                const savedAda = localStorage.getItem('savedAda');
                const savedParsel = localStorage.getItem('savedParsel');

                if (inputAda && savedAda) inputAda.value = savedAda;
                if (inputParsel && savedParsel) inputParsel.value = savedParsel;

                if (savedAda || savedParsel) {
                    console.log('📂 Ada/Parsel değerleri yüklendi:', savedAda, savedParsel);
                }
            }

            // ==================== TEMIZLE BUTONU FUNCTIONALITY ====================
            const btnTemizle = document.getElementById('btn-temizle-sorgu');

            if (btnTemizle) {
                btnTemizle.addEventListener('click', function () {
                    console.log('🧹 Temizle butonu tıklandı - Sadece sonuçları temizliyorum...');

                    // Sadece sonuçları temizle, parametreleri koru
                    if (typeof clearMap === 'function') {
                        clearMap(); // Haritadaki sonuçları temizle
                    }

                    // propertyData'yı temizle
                    if (typeof propertyData !== 'undefined') {
                        propertyData = [];
                    }

                    // Liste tablosunu temizle
                    if (typeof updateList === 'function') {
                        updateList([]);
                    }

                    // Seçili parselleri temizle
                    if (typeof selectedProperties !== 'undefined') {
                        selectedProperties = [];
                    }
                    if (typeof updateSelectedProperties === 'function') {
                        updateSelectedProperties();
                    }

                    // Sorgu sayısını sıfırla
                    const propertyCountElement = document.getElementById('property-count');
                    if (propertyCountElement) {
                        propertyCountElement.style.display = 'none';
                    }

                    console.log('✅ Sonuçlar temizlendi, parametreler korundu');
                });
            }

            // ==================== KONTROL SEKMESİ KONUM FİLTRELEME ====================
            const kontrolIl = document.getElementById('kontrolIl');
            const kontrolIlce = document.getElementById('kontrolIlce');

            // İl seçeneklerini yükle (Sorgu sekmesindeki ile aynı)
            if (kontrolIl) {
                // İl listesini al ve kontrol sekmesine de ekle
                fetch('./il/illiste.json')
                    .then(response => response.json())
                    .then(data => {
                        console.log('📊 İl verisi:', data);
                        data.features.forEach(feature => {
                            const option = document.createElement('option');
                            option.value = feature.properties.id; // il_id yerine id kullan
                            option.textContent = feature.properties.text; // il_adi yerine text kullan
                            kontrolIl.appendChild(option);
                        });
                        console.log('✅ Kontrol sekmesi - İl listesi yüklendi:', data.features.length, 'adet');
                    })
                    .catch(error => {
                        console.error('❌ Kontrol sekmesi - İl listesi yüklenemedi:', error);
                    });
            }

            // İl değiştiğinde ilçeleri yükle
            if (kontrolIl && kontrolIlce) {
                kontrolIl.addEventListener('change', async function () {
                    const ilId = this.value;
                    kontrolIlce.innerHTML = '<option value="">İlçe seçiniz</option>';

                    if (ilId) {
                        kontrolIlce.disabled = false;

                        try {
                            const response = await fetch(`./ilce/${ilId}.json`);
                            const data = await response.json();

                            data.features.forEach(feature => {
                                const option = document.createElement('option');
                                option.value = feature.properties.id; // ilce_id yerine id kullan
                                option.textContent = feature.properties.text; // ilce_adi yerine text kullan
                                kontrolIlce.appendChild(option);
                            });

                            console.log('✅ Kontrol sekmesi - İlçe listesi yüklendi:', data.features.length, 'adet');
                        } catch (error) {
                            console.error('❌ Kontrol sekmesi - İlçe listesi yüklenemedi:', error);
                            kontrolIlce.innerHTML = '<option value="">İlçe yüklenemedi</option>';
                        }
                    } else {
                        kontrolIlce.disabled = true;
                        kontrolIlce.innerHTML = '<option value="">Önce il seçiniz</option>';
                    }
                });
            }

            // ==================== DARK MODE FUNCTIONALITY ====================
            const prolegalLogo = document.getElementById('prolegalLogo');

            // Kaydedilmiş dark mode tercihini kontrol et
            const savedDarkMode = localStorage.getItem('darkMode') === 'true';
            if (savedDarkMode) {
                document.body.classList.add('dark-mode');
            }

            if (prolegalLogo) {
                prolegalLogo.addEventListener('click', function (e) {
                    e.preventDefault();
                    const isDarkMode = document.body.classList.toggle('dark-mode');

                    // Tercihi localStorage'a kaydet
                    localStorage.setItem('darkMode', isDarkMode);

                    console.log('🌙 Dark mode:', isDarkMode ? 'AÇIK' : 'KAPALI');

                    // Prolegal logo için kısa feedback efekti
                    prolegalLogo.style.transform = 'scale(0.95)';
                    prolegalLogo.style.transition = 'transform 0.15s ease';
                    setTimeout(() => {
                        prolegalLogo.style.transform = 'scale(1)';
                    }, 150);

                    // Smooth transition efekti
                    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
                    setTimeout(() => {
                        document.body.style.transition = '';
                    }, 300);
                });
            }

            // ==================== SIDEBAR RESIZE FUNCTIONALITY ====================
            const sidebar = document.getElementById('left-sidebar-wrapper');
            const resizeHandle = document.getElementById('sidebarResizeHandle');
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            // Sidebar'ın gerçek durumunu kontrol et
            let sidebarIsOpen = true; // Default açık

            // Sayfa yüklendiğinde sidebar'ın durumunu kontrol et
            setTimeout(() => {
                const wrapper = document.getElementById('wrapper');
                const isToggled = wrapper.classList.contains('left-side-toggled');
                sidebarIsOpen = !isToggled; // left-side-toggled varsa kapalı
                console.log('🔍 Gerçek sidebar durumu tespit edildi:', sidebarIsOpen ? 'AÇIK' : 'KAPALI');
                console.log('🔍 Wrapper has left-side-toggled:', isToggled);
            }, 100);

            // Global mapContainer tanımı
            const mapContainer = document.getElementById('page-content-wrapper');

            if (resizeHandle && sidebar) {
                resizeHandle.addEventListener('mousedown', function (e) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);

                    sidebar.classList.add('resizing');
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';

                    e.preventDefault();
                });

                document.addEventListener('mousemove', function (e) {
                    if (!isResizing) return;

                    const width = startWidth + e.clientX - startX;
                    const minWidth = 150;  // Daha da daralabilir
                    const maxWidth = 600;

                    if (width >= minWidth && width <= maxWidth) {
                        sidebar.style.width = width + 'px';

                        // Harita container'ını da ayarla
                        updateMapContainer(width);

                        // Responsive class'ları güncelle
                        sidebar.classList.remove('ultra-narrow', 'narrow', 'wide');
                        document.body.classList.remove('ultra-narrow-active', 'narrow-active', 'wide-active', 'normal-active');

                        if (width <= 200) {
                            sidebar.classList.add('ultra-narrow');
                            document.body.classList.add('ultra-narrow-active');
                            console.log('🎨 Logo: Ultra-narrow (80px) - Width:', width);
                        } else if (width <= 300) {
                            sidebar.classList.add('narrow');
                            document.body.classList.add('narrow-active');
                            console.log('🎨 Logo: Narrow (100px) - Width:', width);
                        } else if (width >= 450) {
                            sidebar.classList.add('wide');
                            document.body.classList.add('wide-active');
                            console.log('🎨 Logo: Wide (150px) - Width:', width);
                        } else {
                            document.body.classList.add('normal-active');
                            console.log('🎨 Logo: Normal (130px) - Width:', width);
                        }

                        console.log('📏 Body classes:', document.body.className);
                    }
                });

                document.addEventListener('mouseup', function () {
                    if (isResizing) {
                        isResizing = false;
                        sidebar.classList.remove('resizing');
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';

                        // Width'i localStorage'a kaydet
                        localStorage.setItem('sidebarWidth', sidebar.style.width);
                    }
                });

                // Sayfa yüklendiğinde kaydedilmiş width'i uygula
                const savedWidth = localStorage.getItem('sidebarWidth');
                if (savedWidth) {
                    sidebar.style.width = savedWidth;
                    const width = parseInt(savedWidth, 10);

                    // Harita container'ını da ayarla
                    updateMapContainer(width);

                    sidebar.classList.remove('ultra-narrow', 'narrow', 'wide');
                    document.body.classList.remove('ultra-narrow-active', 'narrow-active', 'wide-active', 'normal-active');

                    if (width <= 200) {
                        sidebar.classList.add('ultra-narrow');
                        document.body.classList.add('ultra-narrow-active');
                    } else if (width <= 300) {
                        sidebar.classList.add('narrow');
                        document.body.classList.add('narrow-active');
                    } else if (width >= 450) {
                        sidebar.classList.add('wide');
                        document.body.classList.add('wide-active');
                    } else {
                        document.body.classList.add('normal-active');
                    }
                } else {
                    // Default genişlik için harita ayarla
                    updateMapContainer(350);
                    document.body.classList.add('normal-active'); // Default için normal class
                }

                // Default durumu kontrol et
                setTimeout(() => {
                    const wrapper = document.getElementById('wrapper');
                    console.log('🔍 Sayfa yüklendiğinde wrapper class:', wrapper.className);
                    console.log('🔍 Default left-side-toggled var mı?:', wrapper.classList.contains('left-side-toggled'));

                    // Eğer default olarak left-side-toggled varsa, kaldır (sidebar açık olsun)
                    if (wrapper.classList.contains('left-side-toggled')) {
                        console.log('🔧 Default left-side-toggled kaldırılıyor - sidebar açık olacak');
                        wrapper.classList.remove('left-side-toggled');
                        updateMapContainer(parseInt(sidebar.style.width || '350', 10));
                    }
                }, 200);
            }

            // Harita container'ını sidebar genişliğine göre ayarla - SADECE RESIZE İÇİN
            function updateMapContainer(sidebarWidth) {
                const mapContainer = document.getElementById('page-content-wrapper');
                const sidebar = document.getElementById('left-sidebar-wrapper');

                if (mapContainer && sidebar) {
                    // Sidebar genişliğini güncelle
                    sidebar.style.width = sidebarWidth + 'px';

                    // SADECE sidebar açıksa harita konumunu ayarla
                    if (sidebarIsOpen) {
                        mapContainer.style.left = sidebarWidth + 'px';
                        mapContainer.style.right = '0';
                    }
                    // Kapalıysa toggle fonksiyonu halledecek

                    // Google Maps resize event'ini tetikle
                    if (window.google && window.google.maps && window.myMap) {
                        setTimeout(() => {
                            window.google.maps.event.trigger(window.myMap, 'resize');
                        }, 100);
                    }
                }
            }

            // ==================== SOL SIDEBAR BAŞLANGIÇ DURUMU - KAPALI ====================
            // Sayfa yüklendiğinde sol sidebar'ı kapalı yap
            const leftSidebarInit = document.getElementById('left-sidebar-wrapper');
            const mapElementInit = document.getElementById('page-content-wrapper');
            
            if (leftSidebarInit && mapElementInit) {
                // visible class'ını kaldır (eğer varsa)
                leftSidebarInit.classList.remove('visible');
                
                // Sidebar'ı kapalı konuma getir
                const sidebarWidth = parseInt(leftSidebarInit.style.width || '350', 10);
                leftSidebarInit.style.left = '-' + sidebarWidth + 'px';
                mapElementInit.style.left = '0px';
                
                console.log('✅ Sol sidebar başlangıçta kapalı olarak ayarlandı');
            }

            // ==================== SOL SIDEBAR TOGGLE - SAĞ GİBİ ====================
            const leftMenuToggle = document.getElementById('left-menu-toggle');
            if (leftMenuToggle) {
                leftMenuToggle.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🍔 Sol Sidebar Toggle (sağ gibi) - ' + new Date().getTime());

                    const leftSidebar = document.getElementById('left-sidebar-wrapper');
                    const mapElement = document.getElementById('page-content-wrapper');

                    if (!leftSidebar || !mapElement) {
                        console.error('❌ Element bulunamadı!');
                        return;
                    }

                    // Sağ sidebar mantığı gibi - visible class kontrolü
                    const isVisible = leftSidebar.classList.contains('visible');
                    const currentWidth = parseInt(leftSidebar.style.width || '350', 10);

                    console.log('📊 Sol sidebar durumu:', {
                        visible: isVisible,
                        width: currentWidth
                    });

                    if (isVisible) {
                        // Kapatma - sağ sidebar gibi
                        console.log('📕 Sol sidebar kapatılıyor (sağ gibi)');
                        leftSidebar.classList.remove('visible');
                        leftSidebar.style.left = '-' + currentWidth + 'px'; // Sola gizle
                        mapElement.style.left = '0px'; // Map tam ekran
                    } else {
                        // Açma - sağ sidebar gibi
                        console.log('📖 Sol sidebar açılıyor (sağ gibi)');
                        leftSidebar.classList.add('visible');
                        leftSidebar.style.left = '0px'; // Görünür pozisyon
                        mapElement.style.left = currentWidth + 'px'; // Map sağa kaydır
                    }

                    // Google Maps resize
                    if (window.google && window.google.maps && window.myMap) {
                        setTimeout(() => {
                            window.google.maps.event.trigger(window.myMap, 'resize');
                        }, 100);
                    }

                    console.log('✅ Sol toggle tamamlandı:', leftSidebar.classList.contains('visible') ? 'AÇIK' : 'KAPALI');
                });
            }
        });
    </script>

    <!-- Password Protection Modal -->
    <div class="modal fade" id="passwordModal" tabindex="-1" aria-labelledby="passwordModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="passwordModalLabel">
                        <i class="fas fa-lock"></i> Güvenli Erişim
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="passwordInput" class="form-label">Şifre</label>
                        <input type="password" class="form-control" id="passwordInput"
                            placeholder="Şifrenizi giriniz...">
                    </div>
                    <div class="alert alert-danger" id="passwordError" style="display: none;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="passwordErrorMessage">Yanlış şifre!</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                    <button type="button" class="btn btn-primary" id="checkPassword">
                        <i class="fas fa-check"></i> Giriş Yap
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Şirket Seçimi Modal -->
    <div class="modal fade" id="companySelectionModal" tabindex="-1" aria-labelledby="companySelectionModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="companySelectionModalLabel">Şirket Seç</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Şirket Listesi -->
                    <div class="table-container">
                        <div class="table-header">
                            <h6>Şirket Listesi</h6>
                            <div class="search-container">
                                <input type="text" id="companySearchInputModal" placeholder="Şirket ara..."
                                    class="form-control" />
                            </div>
                        </div>
                        <div class="table-responsive modern-table">
                            <table class="table table-hover">
                                <thead class="table-header-sticky">
                                    <tr>
                                        <th class="checkbox-column">Seç</th>
                                        <th class="id-column sortable" data-sort="id">
                                            ID <i class="fas fa-sort sort-icon"></i>
                                        </th>
                                        <th class="name-column sortable" data-sort="name">
                                            Şirket Adı <i class="fas fa-sort sort-icon"></i>
                                        </th>
                                        <th class="count-column">G. Sayısı</th>
                                    </tr>
                                </thead>
                                <tbody id="companyTableBodyModal">
                                    <!-- Dynamic rows will be added here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                    <button type="button" class="btn btn-primary" id="saveToCompanyBtn">Kaydet</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Batch Sorgu Sırasına Ekleme Modal -->
    <div class="modal fade" id="batchQueueModal" tabindex="-1" aria-labelledby="batchQueueModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="batchQueueModalLabel">
                        <i class="fas fa-list"></i> Toplu Sorgu Sırasına Ekleme
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        Seçili arazileri farklı şirketlere atayarak sorgu sırasına ekleyebilirsiniz.
                    </div>

                    <div id="batchQueueList" class="mb-3">
                        <!-- Seçili araziler buraya dinamik olarak eklenecek -->
                    </div>

                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> İptal
                        </button>
                        <button type="button" class="btn btn-success" id="batchAddToQueueBtn">
                            <i class="fas fa-plus"></i> Toplu Ekle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Konu Ekleme Modal -->
    <div class="modal fade" id="konuModal" tabindex="-1" aria-labelledby="konuModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="konuModalLabel">
                        <i class="fas fa-comment-alt"></i> Başvuru Konusu Ekle
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="konuTextarea" class="form-label">
                            <i class="fas fa-edit"></i> Konu Açıklaması
                        </label>
                        <textarea class="form-control" id="konuTextarea" rows="4"
                            placeholder="Başvuru konusunu detaylı olarak açıklayın..."></textarea>
                    </div>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <strong>Bilgi:</strong> Bu konu başvuru kaydına eklenecek ve daha sonra düzenlenebilir.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i> İptal
                    </button>
                    <button type="button" class="btn btn-primary" id="saveKonuBtn">
                        <i class="fas fa-save"></i> Kaydet
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Sorgulanan Firma Modal -->
    <div class="modal fade" id="sorgulananFirmaModal" tabindex="-1" aria-labelledby="sorgulananFirmaModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="sorgulananFirmaModalLabel">
                        <i class="fas fa-building"></i> Sorgulanan Firma Seç
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Şirket Seçimi -->
                    <div class="mb-3">
                        <label class="form-label">
                            <i class="fas fa-building"></i> Sorgulanan Şirket Seçin
                        </label>
                        <select class="form-select" id="sorgulananFirmaCompanySelect">
                            <option value="">Şirket Seçiniz</option>
                            <!-- Şirketler buraya yüklenecek -->
                        </select>
                    </div>

                    <!-- Yeni Şirket Ekleme -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label mb-0">
                                <i class="fas fa-plus"></i> Yeni Şirket Ekle
                            </label>
                            <button type="button" class="btn btn-outline-primary btn-sm"
                                id="toggleSorgulananNewCompany">
                                <i class="fas fa-plus"></i> Yeni Şirket
                            </button>
                        </div>
                        <div id="sorgulananNewCompanyForm" style="display: none;">
                            <div class="row">
                                <div class="col-md-6">
                                    <input type="text" class="form-control" id="sorgulananNewCompanyName"
                                        placeholder="Şirket Adı">
                                </div>
                                <div class="col-md-6">
                                    <input type="text" class="form-control" id="sorgulananNewCompanyContact"
                                        placeholder="İletişim Bilgisi">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <strong>Bilgi:</strong> Mevcut şirketlerden birini seçebilir veya yeni şirket ekleyebilirsiniz.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i> İptal
                    </button>
                    <button type="button" class="btn btn-primary" id="saveSorgulananFirmaBtn">
                        <i class="fas fa-save"></i> Kaydet
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Sorgu Yönetimi Şifre Modal -->
    <div class="modal fade" id="queryManagementPasswordModal" tabindex="-1"
        aria-labelledby="queryManagementPasswordModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="queryManagementPasswordModalLabel">
                        <i class="fas fa-lock"></i> Harita Yönetimi ve Mevzuat Sistemi
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        Bu bölümden harita verileri üzerinde düzenleme yapılabilmekte olup, sadece Profintech ekipleri tarafından kullanılmaktadır.
                    </div>

                  

                    <div class="mb-3">
                        <label for="queryManagementPassword" class="form-label">Şifre</label>
                        <input type="password" class="form-control" id="queryManagementPassword"
                            placeholder="Şifrenizi giriniz">
                        <!--<div class="form-text">Sorgu yönetimi bölümüne erişim için şifre gereklidir.</div> -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i> İptal
                    </button>
                    <button type="button" class="btn btn-primary" id="queryManagementPasswordSubmit">
                        <i class="fas fa-check"></i> Giriş Yap
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Flatpickr JS -->
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <!-- Flatpickr Turkish Locale -->
    <script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/tr.js"></script>
    <!-- Tom Select JS -->
    <script src="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js"></script>
    <script>
        let lastVeriDataForHighlight = null;
        let currentVeriRequestToken = 0;
        let currentVeriRequestKey = null;
        let latestVeriFeedbackEl = null;

        document.addEventListener('DOMContentLoaded', () => {
            const veriMahalleInput = document.getElementById('veriMahalleId');
            const veriAdaInput = document.getElementById('veriAda');
            const veriParselInput = document.getElementById('veriParsel');
            const veriFetchBtn = document.getElementById('veriFetchBtn');
            const veriContainer = document.getElementById('veriUpdateContainer');
            const veriLoadingIndicator = document.getElementById('veriLoadingIndicator');
            const veriTabBtn = document.getElementById('info-veri-tab');
            const escapeHtml = (value) => {
                if (value === null || value === undefined) return '';
                return String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            };

            const resetVeriSection = () => {
                if (!veriContainer) return;
                veriContainer.innerHTML = '<div class="text-muted small">Yeni parsel seçildi, Mahalle ID / Ada / Parsel bilgilerini kullanarak verileri çekin.</div>';
                lastVeriDataForHighlight = null;
                currentVeriRequestToken++;
                currentVeriRequestKey = null;
                latestVeriFeedbackEl = null;
            };

            const fillFromCurrentParcel = () => {
                const mahalle = document.getElementById('oznitelik:mahalleno')?.textContent?.trim();
                const ada = document.getElementById('oznitelik:ada')?.textContent?.trim();
                const parsel = document.getElementById('oznitelik:parsel')?.textContent?.trim();
                if (mahalle && veriMahalleInput) veriMahalleInput.value = mahalle;
                if (ada && veriAdaInput) veriAdaInput.value = ada;
                if (parsel && veriParselInput) veriParselInput.value = parsel;
                resetVeriSection();
            };

            const toUpperTr = (val) => {
                if (val === null || val === undefined) return '';
                return String(val).toLocaleUpperCase('tr-TR');
            };
            const applyAtnComboOverride = (base, combo) => {
                if (!base) return base;
                if (!combo) return base;
                const override = { ...base };
                ['AnaTasinmazNitelik_1', 'AnaTasinmazNitelik_2', 'AnaTasinmazNitelik_2_yedek'].forEach((key) => {
                    const value = combo[key];
                    if (value !== undefined && value !== null && String(value).trim() !== '') {
                        override[key] = toUpperTr(value);
                    }
                });
                return override;
            };
            const resolvePassiveTkgmFeature = (featureData) => {
                const source = featureData?.properties || featureData || {};
                let geometry = featureData?.geometry || null;
                const list = [];
                const rawList = source?.gittigiParselListe;
                if (rawList) {
                    try {
                        const parsed = typeof rawList === 'string' ? JSON.parse(rawList) : rawList;
                        if (parsed && Array.isArray(parsed.features)) {
                            list.push(...parsed.features);
                        }
                    } catch (err) {
                        console.warn('gittigiParselListe parse hatası', err);
                    }
                }
                const durumValue = String(source?.durum ?? source?.Durum ?? '').trim();
                if (durumValue === '0' && list.length > 0) {
                    const first = list[0];
                    const replacementProps = first?.properties || first || source;
                    geometry = first?.geometry || geometry;
                    return { props: replacementProps, geometry, list };
                }
                return { props: source, geometry, list };
            };
            const extractPassiveFeatures = (record) => {
                const candidate = record?.gittigiParselListeFeatures ?? record?.gittigiParselListe;
                if (Array.isArray(candidate)) return candidate;
                if (typeof candidate === 'string') {
                    try {
                        const parsed = JSON.parse(candidate);
                        if (parsed && Array.isArray(parsed.features)) {
                            return parsed.features;
                        }
                    } catch (err) {
                        // ignore
                    }
                }
                return [];
            };
            const showVeriLoading = (text = 'Yükleniyor...') => {
                if (!veriLoadingIndicator) return;
                veriLoadingIndicator.textContent = text;
                veriLoadingIndicator.classList.remove('d-none');
            };
            const hideVeriLoading = () => {
                if (!veriLoadingIndicator) return;
                veriLoadingIndicator.classList.add('d-none');
            };
            const setStatus = (msg, type = 'muted') => {
                if (!msg) return;
                const normalizedType = ['muted', 'success', 'warning', 'danger'].includes(type) ? type : 'muted';
                if (latestVeriFeedbackEl) {
                    latestVeriFeedbackEl.className = `text-${normalizedType} small`;
                    latestVeriFeedbackEl.textContent = msg;
                    return;
                }
                if (typeof TitleAlertMessage === 'function') {
                    const alertType = normalizedType === 'muted' ? 'info' : normalizedType;
                    TitleAlertMessage(msg, alertType);
                }
            };
            async function fetchComboSuggestions(anaValue, baseData, requestContextKey) {
                if (!anaValue) return;
                try {
                    const resp = await fetch(`api.php?action=get_atn_suggestions&ana=${encodeURIComponent(anaValue)}`);
                    const json = await resp.json();
                    const combos = json?.success && Array.isArray(json.data) ? json.data : [];
                    if (!combos.length) return;
                    if (currentVeriRequestKey !== requestContextKey) return;
                    const top = combos[0];
                    renderData(baseData, top, true, requestContextKey);
                } catch (error) {
                    console.error('ATN önerileri alınamadı', error);
                }
            }

            const renderData = (data, comboOverride = null, skipComboFetch = false, contextKey = null) => {
                if (!veriContainer || !data) return;
                const baseData = data;
                const effectiveData = comboOverride ? applyAtnComboOverride(baseData, comboOverride) : { ...baseData };
                const propertyId = effectiveData?.Id ?? effectiveData?.id ?? '';
                const fieldDefs = [
                    { label: 'ID', keys: ['Id', 'id'], default: '' },
                    { label: 'İl', keys: ['il', 'İlBilgisi', 'ilAd'], default: '' },
                    { label: 'İlçe', keys: ['ilce', 'İlceBilgisi', 'ilceAd'], default: '' },
                    { label: 'Mahalle', keys: ['mahalle', 'MahalleBilgisi', 'mahalleAd'], default: '' },
                    { label: 'Mahalle ID', keys: ['mahalle_id', 'mahalleId'], default: '' },
                    { label: 'Ada', keys: ['ada', 'AdaBilgisi'], default: '' },
                    { label: 'Parsel', keys: ['parsel', 'ParselBilgisi'], default: '' },
                    { label: 'Alan', keys: ['yuzolcumu', 'YuzolcumBilgisi', 'alan'], default: '' },
                    { label: 'A.T.N', keys: ['AnaTasinmazNitelik', 'ana_tasinmaz_nitelik'], default: '' },
                    { label: 'A.T.N-1', keys: ['AnaTasinmazNitelik_1', 'ana_tasinmaz_nitelik_1'], default: '' },
                    { label: 'A.T.N-2', keys: ['AnaTasinmazNitelik_2', 'ana_tasinmaz_nitelik_2'], default: '' },
                    { label: 'A.T.N-2 Yedek', keys: ['AnaTasinmazNitelik_2_yedek', 'ana_tasinmaz_nitelik_2_yedek'], default: '' }
                ];
                const computeValue = (obj, keys, def = '') => {
                    for (const key of keys) {
                        if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
                            return obj[key];
                        }
                    }
                    return def;
                };
                const rows = fieldDefs.map(def => {
                    let newVal = computeValue(effectiveData, def.keys, def.default);
                    if (def.keys.some(k => k.includes('AnaTasinmazNitelik'))) {
                        newVal = toUpperTr(newVal);
                    }
                    const oldVal = lastVeriDataForHighlight ? computeValue(lastVeriDataForHighlight, def.keys, def.default) : null;
                    const changed = lastVeriDataForHighlight && String(newVal).trim() !== String(oldVal).trim();
                    return {
                        label: def.label,
                        value: escapeHtml(newVal),
                        changed
                    };
                });

                veriContainer.innerHTML = `
                <table class="table table-sm table-bordered mb-2">
                    <tbody>
                        ${rows.map(r => `<tr><th style="width:160px;">${r.label}</th><td class="${r.changed ? 'text-danger fw-semibold' : ''}">${r.value}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="mt-3 d-flex gap-2 align-items-center">
                    <button type="button" class="btn btn-sm btn-success" id="veriUpdateBtn" disabled>Güncelle</button>
                    <div id="veriUpdateFeedback" class="text-muted small"></div>
                </div>
            `;

                const updateBtn = document.getElementById('veriUpdateBtn');
                const feedbackEl = document.getElementById('veriUpdateFeedback');
                latestVeriFeedbackEl = feedbackEl;
                const activeCombo = comboOverride;
                const eligibility = evaluateUpdateEligibility(effectiveData);
                const allowUpdate = eligibility.can && Boolean(activeCombo);
                if (updateBtn) {
                    updateBtn.disabled = !allowUpdate;
                }
                if (!eligibility.can) {
                    setStatus(eligibility.message, 'warning');
                } else if (feedbackEl) {
                    feedbackEl.textContent = '';
                }

                if (updateBtn) {
                    updateBtn.addEventListener('click', async () => {
                        if (!propertyId || !activeCombo) {
                            if (feedbackEl) {
                                feedbackEl.className = 'text-danger small';
                                feedbackEl.textContent = 'Geçerli veri bulunamadı.';
                            }
                            return;
                        }
                        setStatus('ATN güncelleniyor...', 'muted');
                        updateBtn.disabled = true;
                        try {
                            const payload = {
                                id: propertyId,
                                AnaTasinmazNitelik: toUpperTr(activeCombo.AnaTasinmazNitelik ?? ''),
                                AnaTasinmazNitelik_1: toUpperTr(activeCombo.AnaTasinmazNitelik_1 ?? ''),
                                AnaTasinmazNitelik_2: toUpperTr(activeCombo.AnaTasinmazNitelik_2 ?? ''),
                                AnaTasinmazNitelik_2_yedek: toUpperTr(activeCombo.AnaTasinmazNitelik_2_yedek ?? '')
                            };
                            const response = await fetch('api.php?action=update_tapu', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            const result = await response.json();
                            const message = result?.message || (result?.success ? 'ATN güncellendi.' : 'ATN güncellemesi başarısız oldu.');
                            const statusType = result?.success ? 'success' : 'danger';
                            setStatus(message, statusType);
                            if (feedbackEl) {
                                feedbackEl.className = `text-${statusType} small`;
                                feedbackEl.textContent = message;
                            }
                        } catch (error) {
                            console.error('ATN uygulama hatası', error);
                            const message = 'ATN güncellemesi sırasında hata oluştu.';
                            setStatus(message, 'danger');
                            if (feedbackEl) {
                                feedbackEl.className = 'text-danger small';
                                feedbackEl.textContent = message;
                            }
                        } finally {
                            updateBtn.disabled = !allowUpdate;
                        }
                    });
                }

                const rawAnaValue = baseData?.AnaTasinmazNitelik ?? baseData?.ana_tasinmaz_nitelik ?? '';
                if (!skipComboFetch) {
                    fetchComboSuggestions(rawAnaValue, baseData, contextKey);
                }

                lastVeriDataForHighlight = JSON.parse(JSON.stringify(effectiveData));
            };

            const parseArea = (val) => {
                if (val === null || val === undefined || val === '') return null;
                const normalized = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
                const num = parseFloat(normalized);
                return Number.isFinite(num) ? num : null;
            };

            const evaluateUpdateEligibility = (record) => {
                const durumRaw = record?.durum ?? record?.Durum ?? record?.tapu_durum ?? '';
                const durumValue = String(durumRaw).toLowerCase();
                const isActive = durumValue === '1' || durumValue.includes('aktif');
                if (isActive) return { can: true, message: '' };

                const geometryJson = record?.polygon_geojson ?? record?.polygon ?? record?.geometry ?? '';
                let polygonCount = 1;
                let geometryType = '';
                if (geometryJson) {
                    try {
                        const parsed = typeof geometryJson === 'string' ? JSON.parse(geometryJson) : geometryJson;
                        geometryType = parsed?.type ?? '';
                        if (geometryType === 'MultiPolygon' && Array.isArray(parsed.coordinates)) {
                            polygonCount = parsed.coordinates.length;
                        }
                    } catch {
                        // ignore
                    }
                }
                const passiveFeatures = extractPassiveFeatures(record);
                const hasMultiplePassiveFeatures = passiveFeatures.length > 1;
                const geometryMultiple = geometryType === 'MultiPolygon' && polygonCount > 1;
                const baseNoSplit = geometryType === 'Polygon' || (geometryType === 'MultiPolygon' && polygonCount === 1);
                const noSplit = baseNoSplit && !hasMultiplePassiveFeatures;

                const oldArea = parseArea(window.currentPanel?.properties?.alan ?? window.currentPanel?.properties?.YuzolcumBilgisi ?? '');
                const newArea = parseArea(record?.yuzolcumu ?? record?.YuzolcumBilgisi ?? record?.alan ?? '');
                let areaRatioExceeded = false;
                if (oldArea && newArea && oldArea > 0) {
                    const ratio = Math.abs(newArea - oldArea) / oldArea;
                    areaRatioExceeded = ratio > 0.1;
                }

                if (noSplit && !areaRatioExceeded) return { can: true, message: '' };

                const reasons = [];
                if (hasMultiplePassiveFeatures || geometryMultiple) reasons.push('birden çok polygon var');
                if (areaRatioExceeded) reasons.push('%10’dan fazla alan farkı oluşmuş');
                const message = `Pasif parsel için güncelleme engellendi (${reasons.join('; ')}).`;
                return { can: false, message };
            };

            const fetchVeri = async () => {
                if (!veriMahalleInput || !veriAdaInput || !veriParselInput) return;
                const mahalleId = veriMahalleInput.value.trim();
                const ada = veriAdaInput.value.trim();
                const parsel = veriParselInput.value.trim();
                if (!mahalleId || !ada || !parsel) {
                    setStatus('Mahalle ID / Ada / Parsel girin ya da Tapu sekmesinden doldurun.', 'danger');
                    return;
                }
                const requestKey = `${mahalleId}:${ada}:${parsel}`;
                const token = ++currentVeriRequestToken;
                currentVeriRequestKey = requestKey;
                setStatus('Yükleniyor...', 'muted');
                showVeriLoading();
                veriContainer.innerHTML = '<div class="text-center text-muted small py-2">Veri çekiliyor...</div>';
                try {
                    const resp = await fetch(`api.php?action=tkgm_parsel_proxy&mahalle_id=${encodeURIComponent(mahalleId)}&ada=${encodeURIComponent(ada)}&parsel=${encodeURIComponent(parsel)}`);
                    const json = await resp.json();
                    if (json?.success && json.data) {
                        if (token !== currentVeriRequestToken || requestKey !== currentVeriRequestKey) {
                            return;
                        }
                        const resolvedFeature = resolvePassiveTkgmFeature(json.data);
                        const props = resolvedFeature.props;
                        const fallbackPanelId = window.currentPanel?.properties?.id ?? window.currentPanel?.properties?.Id ?? '';
                        const resolvedId = props.id ?? props.Id ?? fallbackPanelId;
                        const resolvedGeometry = resolvedFeature.geometry ?? json.data.geometry ?? null;
                        const featureList = Array.isArray(resolvedFeature.list) ? resolvedFeature.list : [];
                        const normalized = {
                            Id: resolvedId,
                            id: resolvedId,
                            il: props.ilAd ?? props.İlBilgisi ?? '',
                            ilce: props.ilceAd ?? props.İlceBilgisi ?? '',
                            mahalle: props.mahalleAd ?? props.MahalleBilgisi ?? '',
                            mahalle_id: props.mahalleId ?? props.mahalle_id ?? '',
                            ada: props.adaNo ?? props.AdaBilgisi ?? '',
                            parsel: props.parselNo ?? props.ParselBilgisi ?? '',
                            yuzolcumu: props.alan ?? props.YuzolcumBilgisi ?? '',
                            AnaTasinmazNitelik: toUpperTr(props.nitelik ?? props.AnaTasinmazNitelik ?? ''),
                            AnaTasinmazNitelik_1: toUpperTr(props.imarFonksiyon ?? props.AnaTasinmazNitelik_1 ?? ''),
                            AnaTasinmazNitelik_2: toUpperTr(props.AnaTasinmazNitelik_2 ?? ''),
                            AnaTasinmazNitelik_2_yedek: toUpperTr(props.AnaTasinmazNitelik_2_yedek ?? ''),
                            durum: props.durum ?? props.Durum ?? props.sorguDurumu ?? '',
                            Durum: props.Durum ?? props.durum ?? '',
                            sorgulama_durumu: props.sorguDurumu ?? '',
                            basvuru_turu: props.basvuru_turu ?? '',
                            basvuru_sayısı: props.basvuru_sayısı ?? '',
                            basvurulan_firma: props.basvurulan_firma ?? '',
                            basvuru_tarihi: props.basvuru_tarihi ?? '',
                            basvuru_konu: props.konu ?? '',
                            prolegal_not: props.prolegal_not ?? '',
                            not_rating: props.not_rating ?? 0,
                            polygon: JSON.stringify(resolvedGeometry ?? props.polygon ?? {}),
                            gittigiParselListeFeatures: featureList
                        };
                        lastVeriDataForHighlight = null;
                        renderData(normalized, null, false, requestKey);
                        setStatus('Kayıt bulundu.', 'success');
                    } else {
                        setStatus(json?.message || 'Kayıt bulunamadı.', 'danger');
                        veriContainer.innerHTML = '<div class="text-muted small">Kayıt bulunamadı.</div>';
                    }
                } catch (e) {
                    console.error('Veri Güncelleme sorgu hatası', e);
                    setStatus('Hata: veri alınamadı.', 'danger');
                    veriContainer.innerHTML = '<div class="text-muted small">Hata oluştu.</div>';
                } finally {
                    hideVeriLoading();
                }
            };

            if (veriFetchBtn) {
                veriFetchBtn.addEventListener('click', fetchVeri);
            }
            if (veriTabBtn) {
                veriTabBtn.addEventListener('shown.bs.tab', () => {
                    fillFromCurrentParcel();
                });
            }
        });
    </script>

    <!-- Admin Panel Overlay -->
    <div id="adminPanelOverlay">
        <div class="overlay-bar">
            <span>Admin Panel</span>
            <button class="btn btn-sm btn-outline-light" id="adminOverlayClose">Kapat</button>
        </div>
        <div class="overlay-content">
            <iframe src="adminPanel.php" title="Admin Panel" id="adminPanelIframe"></iframe>
        </div>
    </div>





</body>

</html>

</html>
