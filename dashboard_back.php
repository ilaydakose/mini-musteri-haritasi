<?php
session_start();

// Eğer kullanıcı giriş yapmamışsa login sayfasına yönlendirmece
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true)
{
    header("Location: login.php");
    exit();
}

// Oturumda username anahtarı var mı kontrol edelim
$username = isset($_SESSION['username']) ? $_SESSION['username'] : 'Bilinmeyen kullanıcı';
?>

<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Parsel sorgu</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <meta http-equiv="Content-Security-Policy" content="img-src * data:;">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <link rel="stylesheet" href="assets/app.css?ver=1.8" />
    <link rel="icon" type="image/png" href="tasarim/favicon.png">
    <meta name="description" content="TKGM - Ada, Parsel, İmar Durumu Sorgulama işlemlerinizi buradan yapabilirsiniz.">
    <link href="tasarim/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="tasarim/main.css?min=1.9">
</head>

<body>
    <!-- Sağ Menü -->
    <div class="right-side-menu" id="rightMenu">
        <div class="toggle" id="menuToggle"><i class="fa fa-cog"></i></div>
        <div class="menu-title">Menü</div>
        <div class="toggle-container">
            <label for="parselSwitch">Parsel</label>
            <label class="switch">
                <input type="checkbox" id="parselSwitch">
                <span class="slider"></span>
            </label>  </div>
            <div class="toggle-container">
            <div style="display: contents;" class="user-info">
            <span>Hoş geldin, <?php echo htmlspecialchars($username); ?>!</span>
            <a href="logout.php" class="btn btn-danger btn-sm">Çıkış Yap</a>
            </div>
            
        </div>
        <div id="company-management">
    
    <div class="mb-3">
        <input type="text" id="newCompanyName" placeholder="Yeni Şirket Adı" class="form-control" />
        <button id="addCompanyBtn" class="btn btn-primary mt-2">Şirket Ekle</button>
    </div>
    
    <!-- Table for displaying companies -->
    <table class="table captab table-striped table-bordered mt-3">
        <thead class="table-dark">
            <tr>
                <th>Seç</th>
                <th>ID</th>
                <th>Şirket Adı</th>
                <th>G. Sayısı</th>
                <th>İşlemler</th>
            </tr>
        </thead>
        <tbody id="companyTableBody">
            <!-- Dynamic rows will be added here -->
        </tbody>
    </table>
</div>



        </div>
    </div>

   

    <div class="noPrint container-fluid p-0">
        <header class="bg-dark text-light">
            <nav class="navbar-static-top">
                <div class="navbar-brand-container">
                    <a href="#" class="navbar-brand" id="left-menu-toggle">
                        <i class="bi bi-list"></i>
                    </a>
                </div>
                <div class="header-label-container">
                    <h6 class="app-label" id="sub-title-h6-short"><img width="150" src="prolegal-logo.svg"></h6>

                    
                </div>
                
            </nav>
            <div id="messagebox" class="messagebox danger">
                <span id="message">message</span>
                <span class="close">&times;</span>
            </div>
        </header>
        <div id="wrapper" class="right-side-toggled">
            <div id="left-sidebar-wrapper" class="bg-primary-subtle">

                <div class="nav-tabs-custom">
                   
               <nav>
                  <div class="nav nav-tabs" id="nav-tab" role="tablist">
                     <button class="nav-link active" id="nav-home-tab" data-bs-toggle="tab" data-bs-target="#nav-home"
                        type="button" role="tab" aria-controls="nav-home" aria-selected="true">Sorgu</button>
                        <!-- Yeni sekmeyi ekleyelim -->
                    <button class="nav-link" id="nav-kontrol-tab" data-bs-toggle="tab" data-bs-target="#nav-kontrol" type="button" role="tab" aria-controls="nav-new" aria-selected="false">Kontrol</button>
                     <!-- Yeni sekme -->
        <button class="nav-link" id="nav-liste-tab" data-bs-toggle="tab" data-bs-target="#nav-liste"
            type="button" role="tab" aria-controls="nav-liste" aria-selected="false">Liste</button>  
            <button class="nav-link" id="nav-company-management-tab" data-bs-toggle="tab" data-bs-target="#nav-company-management" type="button" role="tab" aria-controls="nav-company-management" aria-selected="false" style="display: none;">Şirket Yönetimi</button>

                </div>
               </nav>
            
                    <div class="tab-content" id="nav-tabContent">
                         <!-- Liste sekmesi -->
    <div class="tab-pane fade p-3" id="nav-liste" role="tabpanel" aria-labelledby="nav-liste-tab" tabindex="0">
    <h5>Sorgu Sonuçları<span id="property-count"></span></h5>
    <div class="mb-3">
        <button id="playButton" class="btn btn-primary">
            <i class="fas fa-play"></i> Oynat
        </button>
        <button id="stopButton" class="btn btn-danger" style="display: none;">
            <i class="fas fa-stop"></i> Durdur
        </button>
    </div>
    <div id="selectedPropertyInfo" class="mb-3" style="display: none;">
        <h6>Seçili Arazi Bilgileri</h6>
        <table class="table table-bordered">
            <tbody>
                <tr><td>Prolegal Taşınmaz No</td><td id="info-id"></td></tr>
                <tr><td>İl</td><td id="info-il"></td></tr>
                <tr><td>İlçe</td><td id="info-ilce"></td></tr>
                <tr><td>Mahalle</td><td id="info-mahalle"></td></tr>
                <tr><td>Nitelik</td><td id="info-nitelik"></td></tr>
                <tr><td>Alan</td><td id="info-alan"></td></tr>
            </tbody>
        </table>
    </div>
   

    <div class="table-responsive" style="max-height: 600px; overflow-x: auto; overflow-y: auto;">
        <table class="table table-bordered table-striped" style="min-width: 1200px;">
            <thead style="position: sticky; top: 0; background-color: #f8f9fa; z-index: 10;">
                <tr>
                <th data-column="id" data-order="desc" style="min-width: 120px;">Prolegal Taşınmaz No</th>
                <th data-column="il" data-order="desc" style="min-width: 80px;">İl</th>
                <th data-column="ilce" data-order="desc" style="min-width: 100px;">İlçe</th>
                <th data-column="mahalle" data-order="desc" style="min-width: 120px;">Mahalle</th>
                <th data-column="adaParsel" data-order="desc" style="min-width: 80px;">Ada/Parsel</th>
                <th data-column="nitelik" data-order="desc" style="min-width: 100px;">Nitelik</th>
                <th data-column="imarFonksiyon" data-order="desc" style="min-width: 150px;">İmar Fonksiyonu</th>
                <th data-column="durum" data-order="desc" style="min-width: 100px;">Durum</th>
                <th data-column="sorguDurumu" data-order="desc" style="min-width: 120px;">Sorgu Durumu</th>
                <th data-column="alan" data-order="desc" style="min-width: 80px;">Alan</th>
            </tr>
            </thead>
            <tbody id="result-list">
                <!-- Sonuçlar buraya JavaScript ile eklenecek -->
            </tbody>
        </table>
    </div>
</div>
<!-- New Tab Content -->
<div class="tab-pane fade p-3" id="nav-company-management" role="tabpanel" aria-labelledby="nav-company-management-tab" tabindex="0">
    <h5 id="company-tab-title">Şirket Yönetimi</h5>
    <div class="mb-3">
        <button id="companyPlayButton" class="btn btn-primary">
            <i class="fas fa-play"></i> Oynat
        </button>
        <button id="companyStopButton" class="btn btn-danger" style="display: none;">
            <i class="fas fa-stop"></i> Durdur
        </button>
    </div>
    <div id="companySelectedPropertyInfo" class="mb-3" style="display: none;">
        <h6>Seçili Arazi Bilgileri</h6>
        <table class="table table-bordered">
            <tbody>
                <tr><td>Prolegal Taşınmaz No</td><td id="company-info-id"></td></tr>
                <tr><td>İl</td><td id="company-info-il"></td></tr>
                <tr><td>İlçe</td><td id="company-info-ilce"></td></tr>
                <tr><td>Mahalle</td><td id="company-info-mahalle"></td></tr>
                <tr><td>Nitelik</td><td id="company-info-nitelik"></td></tr>
                <tr><td>Alan</td><td id="company-info-alan"></td></tr>
            </tbody>
        </table>
    </div>
    <table class="table table-bordered">
        <thead>
           <tr>
            <th>Prolegal Taşınmaz No</th>
            <th>İl</th>
            <th>İlçe</th>
            <th>Mahalle</th>
            <th>Nitelik</th>
            <th>Alan</th>
        </tr>
        </thead>
        <tbody id="company-property-list">
            <!-- Company properties will be added here via JavaScript -->
        </tbody>
    </table>
</div>
                        <!-- Yeni sekme içeriği -->
<div class="tab-pane fade p-3" id="nav-kontrol" role="tabpanel" aria-labelledby="nav-kontrol-tab" tabindex="0">
    
    <!-- Prolegal Taşınmaz No Input -->
    <div class="mb-3">
        <label for="prolegalNo" class="form-label">Prolegal Taşınmaz No</label>
        <input type="text" class="form-control" id="prolegalNo" placeholder="Prolegal Taşınmaz No giriniz">
    </div>

     <div class="d-grid gap-2">
                                <button class="btn btn-success" type="button" id="btn-sorgulaPro">Sorgula</button>
                            </div>
                             <div style="margin-top:10px;" class="d-grid gap-2">
                                <button class="btn btn-danger" type="button" id="btn-temizle">Temizle</button>
                            </div>
</div>

                        <div class="tab-pane fade show active p-3" id="nav-home" role="tabpanel"
                            aria-labelledby="nav-home-tab" tabindex="0">
                            <div class="mb-3">
                                <select class="form-select" aria-label="İl Seçiniz" id="select-il">
                                    <option selected>İl Seçiniz</option>
                                </select>
                            </div>
                          <div class="mb-3">
    <label class="form-label">İlçe Seçiniz</label>
    <div id="ilce-container" class="stylish-checkbox-container"></div>
    <div class="button-group">
        <button type="button" id="selectAllIlce" class="btn btn-primary stylish-button">Hepsini Seç</button>
        <button type="button" id="clearIlce" class="btn btn-secondary stylish-button">Tümünü Temizle</button>
    </div>
</div>
<div class="mb-3">
    <label class="form-label">Mahalle Seçiniz</label>
    <div id="mahalle-container" class="stylish-checkbox-container"></div>
    <div class="button-group">
        <button type="button" id="selectAllMahalle" class="btn btn-primary stylish-button">Hepsini Seç</button>
        <button type="button" id="clearMahalle" class="btn btn-secondary stylish-button">Tümünü Temizle</button>
    </div>
</div>
                            <div class="mb-3 input-ada">
                                <input type="text" class="form-control" placeholder="Ada" id="input-ada" value="">
                            </div>
                            <div class="mb-3 input-parsel">
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

                            <div class="mb-3 stylish-container">
                                <label class="form-label stylish-label">Arazi Büyüklüğü Dilimi</label>
                                <input style="display:none;" type="text" id="araziBuyukluguSearch" class="form-control stylish-search mb-2"
                                    placeholder="Arazi Büyüklüğü Arayın...">
                                <div id="araziBuyukluguCheckboxes" class="stylish-checkbox-container">
                                    <!-- Checkboxlar JavaScript ile buraya eklenecek -->
                                </div>
                                <div class="button-group">
                                    <button type="button" id="selectAllAraziBuyuklugu"
                                        class="btn btn-primary stylish-button">Hepsini Seç</button>
                                    <button type="button" id="clearAraziBuyuklugu"
                                        class="btn btn-secondary stylish-button">Tümünü Temizle</button>
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


                            <div class="d-grid gap-2">
                                <button class="btn btn-success" type="button" id="btn-sorgula">Sorgula</button>
                            </div>
                             <div style="margin-top:10px;margin-bottom:50px;" class="d-grid gap-2">
                                <button class="btn btn-danger" type="button" id="btn-temizle">Temizle</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sidebar-footer-container">&copy; 2024. <a href="https://www.captrx.com"
                        target="_blank"><b>CAPTRX</b>.</a></div>
            </div>
            <div id="page-content-wrapper" class="bg-primary-subtle">
                <div class="map-container">
                    <div id="map"></div>
                    <div class="map-toolbar-container">
                        <div class="btn-group">
                            <div id="map-toolbar-group-1" class="btn-group">
                                <button class="btn btn-flat btn-sm btn-default" id="zoom-in-btn" title="Yakınlaş">
                                    <i class="bi bi-plus"></i>
                                </button>
                                <button class="btn btn-flat btn-sm btn-default" id="zoom-out-btn" title="Uzaklaş">
                                    <i class="bi bi-dash"></i>
                                </button>
                            </div>
                            <!-- Yeni Tara Butonu -->
        <button class="btn btn-primary btn-sm" id="scan-region-btn" title="Bölgeyi Tara">
            <i class="fas fa-search"></i> Bölgeyi Tara
        </button>
                        </div>
                        <div id="map-toolbar-group-2" class="btn-group">
                            <div class="btn-group">
                                <button class="btn btn-flat btn-default btn-sm" id="refresh-btn" title="Yenile">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
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
                            <div class="btn-group">
                                <button class="btn btn-flat btn-default btn-sm" id="show-measurement-btn" title="Ölçüm">
                                    <i class="bi bi-arrows"></i>
                                </button>
                            </div>
                        </div>
                        <div id="coordinate-panel-container" class="input-group">
                            <input class="form-control form-control-sm flat"
                                style="border-left: solid 1px #ccc !important" type="text" id="coordinate-info-input"
                                readonly="readonly" title="" disabled>
                            <input class="form-control form-control-sm flat"
                                style="border-left: solid 1px #ccc !important" type="text" id="zoom-level-text"
                                readonly="readonly" title="" disabled>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="modal" id="info-modal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <!-- Example split danger button -->
                    <div class="btn-group">
                        <button aria-expanded="false" aria-haspopup="true"
                            class="btn btn-default dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown"
                            type="button">
                            <span class="visually-hidden">Toggle Dropdown</span>
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu" id="modal-dots-menu">
                            <li><a class="dropdown-item active" data-container="#oznitelik" href="#">Öz Nitelik
                                    Bilgisi</a>
                            </li>
                            <li>
                                <a class="dropdown-item" data-container="#baglidetaylar" href="#">Bağlı
                                    Detaylar</a>
                            </li>
                            <li><a class="dropdown-item" data-container="#koordinatlistesi" href="#">Koordinat
                                    Listesi</a>
                            </li>
                            <li><a class="dropdown-item" data-container="#rota" href="#">Rota</a></li>
                            <li><a class="dropdown-item" data-container="#indirme" href="#">İndirme</a></li>
                            <li><a class="dropdown-item" data-container="#ortofoto" href="#">Ortofoto Bilgisi</a></li>
                        </ul>
                    </div>
                    <h5 class="modal-title" id="info-modal-title">Öz Nitelik Bilgisi</h5>
                    <button aria-label="Close" class="btn-close" data-bs-dismiss="modal" type="button"></button>
                </div>
                <div class="modal-body p-0 m-0" id="modal-dots-tabs">
                    <div class="" id="oznitelik">
                        <div class="nav-tabs-custom">
                            <nav>
                                <div class="nav nav-tabs" id="nav-tab" role="tablist">
                                    <button aria-controls="nav-oznitelik" aria-selected="true" class="nav-link active"
                                        data-bs-target="#nav-oznitelik" data-bs-toggle="tab" id="nav-oznitelik-tab"
                                        role="tab" type="button">Öznitelik Bilgisi</button>

                            </nav>
                            <div class="tab-content" id="nav-tabContent">
                                <div aria-labelledby="nav-oznitelik-tab" class="tab-pane fade show active p-3"
                                    id="nav-oznitelik" role="tabpanel" tabindex="0">
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
                                        <tr class="ada-parsel-row">
                                            <td>Ada</td>
                                            <td id="oznitelik:ada"></td>
                                        </tr>
                                        <tr class="ada-parsel-row">
                                            <td>Parsel</td>
                                            <td id="oznitelik:parsel"></td>
                                        </tr>
                                        <tr>
                                            <td>Tapu Alanı</td>
                                            <td id="oznitelik:tapualani"></td>
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
                                        <tr id="firmayaEkleRow" style="display: none;">
    <td>Firmaya Ekle (<span id="firm-name-label"></span>)</td>
    <td><input type="checkbox" id="firm-checkbox"></td>
</tr>
                                    </table>
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
                                <div class="nav nav-tabs" id="nav-tab" role="tablist">
                                    <button aria-controls="nav-koordinat" aria-selected="true" class="nav-link active"
                                        data-bs-target="#nav-koordinat" data-bs-toggle="tab" id="nav-koordinat-tab"
                                        role="tab" type="button">Koordinat Listesi</button>
                                    <button aria-controls="nav-uzunluk" aria-selected="true" class="nav-link"
                                        data-bs-target="#nav-uzunluk" data-bs-toggle="tab" id="nav-uzunluk-tab"
                                        role="tab" type="button">Kenar Uzunluklari</button>
                                </div>
                            </nav>
                            <div class="tab-content" id="nav-tabContent">
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
    <!-- Şirket düzenlemek için popup -->
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
                    <input type="text" class="form-control" id="newCompanyNameInput" placeholder="Şirket adı giriniz">
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
    <script src="tasarim/ui.js"></script>
    <script src="tasarim/form.api.js?v=<?php echo time(); ?>"></script>
    <script src="tasarim/map.js?ver=1.6"></script>
    <script src="tasarim/map.helper.js"></script>
    
    <script async
         src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAXNliOydb5zw06p7uBIp31tMpECoU6Tis&loading=async&callback=initMap&libraries=geometry&v=weekly"> 

    </script>
    



</body>

</html>
