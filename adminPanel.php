<?php
// Basit kimlik kontrolü: dashboard ile aynı session'ı kullanalım
session_start();
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header("Location: login.php");
    exit();
}
// Partner rolü admin paneline giremesin
if (!empty($_SESSION['user_role']) && $_SESSION['user_role'] === 'partner') {
    header("Location: talep/index.php");
    exit();
}
?>
<!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Panel</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <style>
        :root {
            --color-bg:#F5F5F7;
            --color-surface:#FFFFFF;
            --color-border:#E5E7EB;
            --color-text:#1F2933;
            --color-text-muted:#6B7280;
            --color-primary:#2563EB;
            --color-primary-dark:#1D4ED8;
            --color-secondary-bg:#FFFFFF;
            --color-secondary-border:#2563EB;
            --color-secondary-hover:#EFF6FF;
        }
        html, body { height: 100%; }
        body {
            background: var(--color-bg);
            color: var(--color-text);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
        }
        /* Tam boy esnek iskelet: iframe veya embed edilince alanın tamamını kullan */
        .app-shell {
            flex: 1 1 auto;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background: var(--color-bg);
        }
        .content {
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
            padding: 12px;
            display: flex;
            flex-direction: column;
            background: var(--color-bg);
        }
        .tab-content {
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column; /* dikeyde esne */
        }
        .tab-pane {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
            display: flex;
            flex-direction: column; /* içerik tüm yüksekliği kullansın */
        }
        .card-lite {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 14px;
            padding: 16px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.04);
        }
        .table-responsive {
            border: 1px solid var(--color-border);
            border-radius: 12px;
            background: var(--color-surface);
        }
        .table-responsive.tapu-scroll {
            max-height: calc(100vh - 240px);
            overflow: auto;
        }
        .table thead th {
            color: var(--color-text-muted);
            border-bottom-color: var(--color-border);
        }
        .table tbody td { color: var(--color-text); }
        /* Tapu detay görünümü */
        .tapu-grid-container {
            border: 1px solid var(--color-border);
            border-radius: 12px;
            background: var(--color-surface);
            box-shadow: 0 6px 18px rgba(0,0,0,0.04);
            padding: 12px;
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
        }
        .tapu-detail-grid {
            flex: 1 1 auto;
            min-height: 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 12px;
        }
        .tapu-detail-item {
            padding: 12px 14px;
            border: 1px solid var(--color-border);
            border-radius: 10px;
            background: linear-gradient(180deg, #fff, #f9fafb);
        }
        .tapu-detail-label {
            font-size: 11px;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: .3px;
            margin-bottom: 4px;
        }
        .tapu-detail-value {
            font-weight: 600;
            color: var(--color-text);
            word-break: break-word;
        }
        .admin-tabs {
            display: flex;
            gap: 6px;
            padding: 4px;
            border-radius: 12px;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            margin-bottom: 14px;
        }
        .admin-tabs .nav-link {
            flex: 1;
            text-align: center;
            border-radius: 10px;
            border: 1px solid transparent;
            color: var(--color-text);
            font-weight: 600;
            font-size: 13px;
            padding: 6px 10px;
        }
        .admin-tabs .nav-link.active {
            background: var(--color-secondary-hover);
            border-color: var(--color-secondary-border);
            color: var(--color-primary-dark);
            box-shadow: inset 0 0 0 1px var(--color-secondary-border);
        }
        .pill-label { font-size:12px; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.6px; }
        .form-control, .form-select {
            border-radius: 10px;
            border-color: var(--color-border);
            color: var(--color-text);
        }
        .form-control:focus, .form-select:focus {
            border-color: var(--color-secondary-border);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .kbd {
            background: var(--color-text);
            color: #fff;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 11px;
        }
        .btn-primary {
            background: var(--color-primary);
            border-color: var(--color-primary);
            box-shadow: none;
        }
        .btn-primary:hover {
            background: var(--color-primary-dark);
            border-color: var(--color-primary-dark);
        }
        .btn-outline-secondary {
            color: var(--color-text);
            border-color: var(--color-border);
        }
        .btn-outline-secondary:hover {
            background: var(--color-secondary-hover);
            color: var(--color-primary-dark);
            border-color: var(--color-secondary-border);
        }
        .notice-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2000;
            padding: 8px 16px;
            pointer-events: none;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: flex-start;
        }
        .notice-item {
            border-radius: 10px;
            padding: 8px 10px;
            font-size: 13px;
            pointer-events: auto;
            box-shadow: 0 6px 16px rgba(0,0,0,0.06);
            flex: 0 1 320px;
        }
        .notice-item.info { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }
        .notice-item.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .notice-item.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecdd3; }
    </style>
</head>
<body>
<div id="noticeBar" class="notice-bar"></div>
<div class="app-shell">
    <div class="content">
        <div class="admin-tabs nav nav-pills" id="adminTabs" role="tablist">
            <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tapuPane" type="button">Tapu Maliye</button>
            <button class="nav-link" data-bs-toggle="pill" data-bs-target="#basvuruPane" type="button">Başvurular</button>
            <button class="nav-link" data-bs-toggle="pill" data-bs-target="#sorguPane" type="button">Sorgu</button>
        </div>
        <div class="tab-content">
            <!-- Tapu Maliye -->
            <div class="tab-pane fade show active" id="tapuPane">
                <div class="d-flex flex-wrap justify-content-between align-items-start mb-3 gap-2">
                    <div class="d-flex flex-column gap-2">
                        
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            <div class="text-muted small">ID</div>
                            <input type="number" class="form-control form-control-sm" id="tapuIdSearch" min="1" style="width: 140px;">
                            <button class="btn btn-sm btn-primary" id="tapuIdSearchBtn">Getir</button>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-primary" id="tapuNewBtn">Yeni Arazi</button>
                                <button class="btn btn-sm btn-outline-secondary" id="tapuEditBtn" disabled>Düzenle</button>
                                <button class="btn btn-sm btn-success d-none" id="tapuSaveBtn">Kaydet</button>
                                <button class="btn btn-sm btn-outline-secondary d-none" id="tapuCancelBtn">İptal</button>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <select class="form-select form-select-sm" id="tkgmIl" style="width: 140px;">
                            <option value="">İl Seç</option>
                        </select>
                        <select class="form-select form-select-sm" id="tkgmIlce" style="width: 160px;">
                            <option value="">İlçe Seç</option>
                        </select>
                        <select class="form-select form-select-sm" id="tkgmMahalle" style="width: 170px;">
                            <option value="">Mahalle Seç</option>
                        </select>
                        <input type="number" class="form-control form-control-sm" id="tkgmAda" placeholder="Ada" min="0" style="width: 90px;">
                        <input type="number" class="form-control form-control-sm" id="tkgmParsel" placeholder="Parsel" min="0" style="width: 90px;">
                        <button class="btn btn-sm btn-outline-info" id="tkgmFetchBtn">Arazi Keşfet</button>
                        <div id="tkgmStatus" class="text-muted small ms-2"></div>
                    </div>
                </div>
                <div class="tapu-grid-container">
                    <div class="tapu-detail-grid" id="tapuDetailBody"></div>
                </div>
            </div>

            <!-- Başvurular -->
            <div class="tab-pane fade" id="basvuruPane">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <div class="pill-label">Başvurular</div>
                        <div class="text-muted small">Başvuru sayısı, tarihi, firma, konu</div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="basvuruRefreshBtn">Yenile</button>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                    <input type="number" min="1" class="form-control form-control-sm" id="basvuruIdSearch" placeholder="ID ile getir" style="width:160px;">
                    <button class="btn btn-sm btn-outline-primary" id="basvuruIdBtn">Getir</button>
                </div>
                <div class="tapu-detail-grid" id="basvuruDetail"></div>
            </div>

            <!-- Sorgu -->
            <div class="tab-pane fade" id="sorguPane">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <div class="pill-label">Sorgu</div>
                        <div class="text-muted small">Sorgulanan firma, konu, tarih, durum</div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="sorguRefreshBtn">Yenile</button>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                    <input type="number" min="1" class="form-control form-control-sm" id="sorguIdSearch" placeholder="ID ile getir" style="width:160px;">
                    <button class="btn btn-sm btn-outline-primary" id="sorguIdBtn">Getir</button>
                </div>
                <div class="tapu-detail-grid" id="sorguDetail"></div>
            </div>

        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="tasarim/ui.js?v=<?php echo time(); ?>"></script>
<script>
// Hafif JS iskeleti: veri yükleme/düzenleme endpointleri tanımlandıkça bağlanacak.
document.addEventListener('DOMContentLoaded', () => {
    const tables = ['basvuruTable','sorguTable'];
    tables.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); }
        });
    });

    // Tapu ID ile ara + düzenleme akışı
    const tapuIdInput = document.getElementById('tapuIdSearch');
    const tapuIdSearchBtn = document.getElementById('tapuIdSearchBtn');
    const tapuDetailBody = document.getElementById('tapuDetailBody');
    const tapuEditBtn = document.getElementById('tapuEditBtn');
    const tapuSaveBtn = document.getElementById('tapuSaveBtn');
    const tapuCancelBtn = document.getElementById('tapuCancelBtn');
    const tapuNewBtn = document.getElementById('tapuNewBtn');
    const tkgmIlSelect = document.getElementById('tkgmIl');
    const tkgmIlceSelect = document.getElementById('tkgmIlce');
    const tkgmMahalleSelect = document.getElementById('tkgmMahalle');
    const tkgmAdaInput = document.getElementById('tkgmAda');
    const tkgmParselInput = document.getElementById('tkgmParsel');
    const tkgmFetchBtn = document.getElementById('tkgmFetchBtn');
    const noticeBar = document.getElementById('noticeBar');
    const basvuruIdInput = document.getElementById('basvuruIdSearch');
    const basvuruIdBtn = document.getElementById('basvuruIdBtn');
    const basvuruDetail = document.getElementById('basvuruDetail');
    const sorguIdInput = document.getElementById('sorguIdSearch');
    const sorguIdBtn = document.getElementById('sorguIdBtn');
    const sorguDetail = document.getElementById('sorguDetail');
    let tapuRecord = null;
    let tapuOriginal = {};
    let tapuEditMode = false;
    let pendingConfirm = null;
    let tapuIsNew = false;
    let tapuDiffList = [];
    let parselUpdateBlocked = false;
    let parselUpdateReason = '';

    const escapeHtml = (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
    const toUpperTr = (val) => {
        if (typeof val !== 'string') return val;
        return val.toLocaleUpperCase('tr-TR');
    };
    // Popup için otomatik değişim kontrolü (manuel tetiklenecek)
    const runPopupTkgmCheck = async (mahalleId, adaVal, parselVal) => {
        const mid = parseInt(mahalleId, 10) || 0;
        const adaNum = parseInt(adaVal, 10) || 0;
        const parselNum = parseInt(parselVal, 10) || 0;
        if (!mid || adaNum < 0 || parselNum < 0) return;
        setTkgmStatus('Arazi değişim kontrolü yapılıyor...', 'info', true);
        try {
            // Mevcut kaydı al
            const exResp = await fetch(`api.php?action=find_tapu_by_location&mahalle_id=${encodeURIComponent(mid)}&ada=${encodeURIComponent(adaNum)}&parsel=${encodeURIComponent(parselNum)}`);
            const exJson = await exResp.json();
            if (!exJson?.success || !exJson.data) {
                setTkgmStatus('Mevcut kayıt bulunamadı, değişim kontrolü yapılmadı.', 'warning');
                pushNotice('warning', 'Mevcut kayıt bulunamadı, kontrol yapılmadı.', 8);
                return;
            }
            const existing = exJson.data;

            // TKGM verisini çek
            const tkResp = await fetch(`api.php?action=tkgm_parsel_proxy&mahalle_id=${encodeURIComponent(mid)}&ada=${encodeURIComponent(adaNum)}&parsel=${encodeURIComponent(parselNum)}`);
            const tkJson = await tkResp.json();
            if (!tkJson?.success || !tkJson.data) {
                setTkgmStatus('TKGM yanıtı alınamadı (değişim kontrolü).', 'warning');
                pushNotice('warning', 'TKGM yanıtı alınamadı, kontrol tamamlanamadı.', 8);
                return;
            }

            const tk = tkJson.data;
            const resolved = resolvePassiveTkgmFeature(tk);
            const props = resolved.props;
            const geometry = resolved.geometry ?? tk.geometry ?? null;
            const pasifList = resolved.list || [];
            const durumVal = props.durum ?? props.sorguDurumu;
            const isPasif = String(durumVal ?? '').trim() === '0';
            const existingArea = parseAreaVal(existing?.yuzolcumu || existing?.YuzolcumBilgisi || existing?.alan);
            const newArea = parseAreaVal(props.alan);
            const areaChanged = existingArea && newArea ? (Math.abs(newArea - existingArea) / existingArea > 0.10) : false;

            if (isPasif && pasifList.length > 1) {
                setTkgmStatus('Parsel pasif ve çoklu polygona bölünmüş. IT/uzman desteği gerekli.', 'warning');
                pushNotice('warning', 'Parsel pasif ve birden çok polygona bölünmüş. Güncellenmedi.', 10);
                return;
            }
            if (areaChanged) {
                setTkgmStatus('Parsel alanı %10+ değişmiş. IT/uzman desteği gerekli.', 'warning');
                pushNotice('warning', 'Parsel alanı %10’dan fazla değişmiş. Güncellenmedi.', 10);
                return;
            }

            const mapped = {
                Id: existing.Id,
                İlBilgisi: existing.il,
                İlceBilgisi: existing.ilce,
                MahalleBilgisi: existing.mahalle,
                AdaBilgisi: props.adaNo || existing.ada,
                ParselBilgisi: props.parselNo || existing.parsel,
                YuzolcumBilgisi: props.alan || existing.yuzolcumu,
                AnaTasinmazNitelik: toUpperTr(props.nitelik || existing.ana_tasinmaz_nitelik || ''),
                AnaTasinmazNitelik_1: toUpperTr(props.imarFonksiyon || existing.ana_tasinmaz_nitelik_1 || ''),
                AnaTasinmazNitelik_2: toUpperTr(props.AnaTasinmazNitelik_2 || existing.ana_tasinmaz_nitelik_2 || ''),
                AnaTasinmazNitelik_2_yedek: toUpperTr(props.AnaTasinmazNitelik_2_yedek || existing.ana_tasinmaz_nitelik_2_yedek || ''),
                mahalle_id: props.mahalleId || existing.mahalle_id,
                il_id: props.ilId || existing.il_id,
                ilce_id: props.ilceId || existing.ilce_id,
                polygon: geometry ? JSON.stringify(geometry) : existing.polygon,
                polygon_wkt: geometry ? polygonToWkt(geometry) : existing.polygon_wkt || '',
                polygon_geojson: geometry ? JSON.stringify(geometry) : existing.polygon_geojson || '',
                durum: durumVal ?? existing.durum
            };

            const upd = await fetch('api.php?action=update_tapu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: existing.Id, ...mapped })
            });
            const updJson = await upd.json();
            if (updJson?.success) {
                setTkgmStatus('Değişim yok veya güvenli. Kayıt güncellendi.', 'success');
                pushNotice('success', 'Parsel değişim kontrolü: Güncelleme uygulandı.', 8);
                await fetchById(existing.Id, true);
            } else {
                setTkgmStatus('Güncelleme uygulanamadı.', 'warning');
                pushNotice('warning', updJson?.message || 'Güncelleme uygulanamadı.', 8);
            }
        } catch (err) {
            setTkgmStatus('Değişim kontrolü sırasında hata.', 'warning');
            console.warn('runPopupTkgmCheck error', err);
        }
    };
    // Dışarıdan tetiklenebilmesi için globalde aç
    window.runPopupTkgmCheck = runPopupTkgmCheck;
    const maybeAutoCheckChange = (row) => {
        const id = getTapuId(row);
        if (!id || lastAutoCheckId === id) return;
        lastAutoCheckId = id;
        autoCheckAndUpdate(row);
    };
    const parseAreaVal = (val) => {
        if (val === null || val === undefined) return null;
        const s = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
        const num = parseFloat(s);
        return Number.isFinite(num) ? num : null;
    };
    const normalizeTurkishInsensitive = (val) => {
        if (val === null || val === undefined) return '';
        let s = String(val).trim().toLocaleLowerCase('tr-TR');
        s = s
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u');
        return s;
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

    const pushNotice = (type, text, autoCloseSeconds = 6, isHtml = false) => {
        const mapType = (t) => t === 'error' ? 'danger' : t;
        if (window.parent && typeof window.parent.TitleAlertMessage === 'function') {
            window.parent.TitleAlertMessage(text, mapType(type), autoCloseSeconds);
            return;
        }
        if (typeof window.TitleAlertMessage === 'function') {
            window.TitleAlertMessage(text, mapType(type), autoCloseSeconds);
            return;
        }
        if (!noticeBar) return;
        const div = document.createElement('div');
        div.className = `notice-item ${type}`;

        const content = document.createElement('div');
        content.innerHTML = isHtml ? text : escapeHtml(text);
        div.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn btn-sm btn-light ms-2';
        closeBtn.textContent = 'Tamam';
        closeBtn.addEventListener('click', () => {
            if (div.parentNode) div.parentNode.removeChild(div);
        });
        div.appendChild(closeBtn);

        noticeBar.prepend(div);
        const timeoutMs = autoCloseSeconds && autoCloseSeconds > 0 ? autoCloseSeconds * 1000 : 0;
        if (timeoutMs > 0) {
            setTimeout(() => {
                if (div.parentNode) div.parentNode.removeChild(div);
            }, timeoutMs);
        }
    };

    // Yardımcılar: select doldurma ve veri yükleme
    const populateSelect = (selectEl, items, placeholder) => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        selectEl.appendChild(opt);
        items.forEach(item => {
            const o = document.createElement('option');
            o.value = item.id;
            o.textContent = item.text;
            selectEl.appendChild(o);
        });
    };

    const tryFetch = async (paths) => {
        const origin = window.location.origin.replace(/\/$/, '');
        const stripLeadingSlash = (p) => p.replace(/^\//, '');
        for (const p of paths) {
            // Denenecek tam yollar: verilen path ve absolutize edilmiş hali
            const candidates = [p, `${origin}/${stripLeadingSlash(p)}`];
            for (const url of candidates) {
                try {
                    const resp = await fetch(url);
                    if (!resp.ok) continue;
                    return await resp.json();
                } catch (_) {
                    // diğer candidate'a geç
                }
            }
        }
        return null;
    };

    const loadIlList = async () => {
        if (!tkgmIlSelect) return;
        const data = await tryFetch([
            'il/illiste.json',
            '../il/illiste.json',
            '../../il/illiste.json',
            '/il/illiste.json',
            './il/illiste.json'
        ]);
        if (!data) {
            pushNotice('error', 'İl listesi alınamadı');
            return;
        }
        const items = (data.features || []).map(f => f.properties).filter(Boolean);
        populateSelect(tkgmIlSelect, items, 'İl Seç');
    };

    const loadIlceList = async (ilId) => {
        if (!tkgmIlceSelect) return;
        populateSelect(tkgmIlceSelect, [], 'İlçe Seç');
        populateSelect(tkgmMahalleSelect, [], 'Mahalle Seç');
        if (!ilId) return;
        const data = await tryFetch([
            `ilce/${ilId}.json`,
            `../ilce/${ilId}.json`,
            `../../ilce/${ilId}.json`,
            `/ilce/${ilId}.json`,
            `./ilce/${ilId}.json`
        ]);
        if (!data) {
            pushNotice('error', 'İlçe listesi alınamadı');
            return;
        }
        const items = (data.features || []).map(f => f.properties).filter(Boolean);
        populateSelect(tkgmIlceSelect, items, 'İlçe Seç');
    };

    const loadMahalleList = async (ilceId) => {
        if (!tkgmMahalleSelect) return;
        populateSelect(tkgmMahalleSelect, [], 'Mahalle Seç');
        if (!ilceId) return;
        const data = await tryFetch([
            `mahalle/${ilceId}.json`,
            `../mahalle/${ilceId}.json`,
            `../../mahalle/${ilceId}.json`,
            `/mahalle/${ilceId}.json`,
            `./mahalle/${ilceId}.json`
        ]);
        if (!data) {
            pushNotice('error', 'Mahalle listesi alınamadı');
            return;
        }
        const items = (data.features || []).map(f => f.properties).filter(Boolean);
        populateSelect(tkgmMahalleSelect, items, 'Mahalle Seç');
    };

    const setTapuState = (message, isMuted = true) => {
        if (!tapuDetailBody) return;
        tapuDiffList = [];
        tapuDetailBody.innerHTML = `
            <div class="tapu-detail-item text-center ${isMuted ? 'text-muted' : 'text-danger'} small py-3" style="grid-column: 1 / -1;">${message}</div>
        `;
        if (tapuEditBtn) tapuEditBtn.disabled = true;
        if (tapuSaveBtn) tapuSaveBtn.classList.add('d-none');
        if (tapuCancelBtn) tapuCancelBtn.classList.add('d-none');
        pushNotice(isMuted ? 'info' : 'error', message);
    };

    const TAPU_FIELDS = [
        { label: 'ID', keys: ['Id', 'id'], column: 'Id', type: 'int' },
        { label: 'İl', keys: ['il', 'İl', 'İlBilgisi', 'IlBilgisi', 'ilAd'], column: 'İlBilgisi', type: 'text', max: 255 },
        { label: 'İlçe', keys: ['ilce', 'İlçe', 'İlceBilgisi', 'IlceBilgisi', 'ilceAd'], column: 'İlceBilgisi', type: 'text', max: 255 },
        { label: 'Mahalle', keys: ['mahalle', 'Mahalle', 'MahalleBilgisi', 'mahalleAd'], column: 'MahalleBilgisi', type: 'text', max: 255 },
        { label: 'Ada', keys: ['ada', 'Ada', 'AdaBilgisi', 'adaNo'], column: 'AdaBilgisi', type: 'int' },
        { label: 'Parsel', keys: ['parsel', 'Parsel', 'ParselBilgisi', 'parselNo'], column: 'ParselBilgisi', type: 'int' },
        { label: 'Alan', keys: ['yuzolcumu', 'YuzolcumBilgisi', 'Yuzolcum', 'alan'], column: 'YuzolcumBilgisi', type: 'text', max: 255 },
        { label: 'A.T.N', keys: ['ana_tasinmaz_nitelik', 'AnaTasinmazNitelik', 'nitelik'], column: 'AnaTasinmazNitelik', type: 'text', max: 255 },
        { label: 'A.T.N_1', keys: ['ana_tasinmaz_nitelik_1', 'AnaTasinmazNitelik_1'], column: 'AnaTasinmazNitelik_1', type: 'text', max: 255 },
        { label: 'A.T.N_2', keys: ['ana_tasinmaz_nitelik_2', 'AnaTasinmazNitelik_2'], column: 'AnaTasinmazNitelik_2', type: 'text', max: 255 },
        { label: 'A.T.N_2 Yedek', keys: ['ana_tasinmaz_nitelik_2_yedek', 'AnaTasinmazNitelik_2_yedek'], column: 'AnaTasinmazNitelik_2_yedek', type: 'text', max: 255 },
        { label: 'Hisse', keys: ['hisse', 'Hisse'], column: 'Hisse', type: 'double' },
        { label: 'mahalle_id', keys: ['mahalle_id', 'mahalleId'], column: 'mahalle_id', type: 'int' },
        { label: 'il_id', keys: ['il_id', 'ilId'], column: 'il_id', type: 'int' },
        { label: 'ilce_id', keys: ['ilce_id', 'ilceId'], column: 'ilce_id', type: 'int' },
        { label: 'Polygon', keys: ['polygon', 'polygon_wkt', 'polygon_geojson', 'polygon_text'], column: 'polygon', type: 'textarea' },
        { label: 'Durum (DB)', keys: ['Durum', 'durum', 'tapu_durum', 'sorguDurumu'], column: 'Durum', type: 'select', options: ['', 'Uygun', 'Uygun değil'] },
        { label: 'Not Rating (0: Seçiniz, 1: Yarar, 2: Yaramaz)', keys: ['not_rating'], column: 'not_rating', type: 'int' },
        { label: 'Prolegal Not', keys: ['prolegal_not'], column: 'prolegal_not', type: 'text', max: 255 },
    ];

    const pickValue = (obj, keys) => {
        for (const k of keys) {
            if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
        }
        return '';
    };

    const normalizeForDiff = (val, type, column) => {
        if (val === null || val === undefined) return '';
        if (column === 'YuzolcumBilgisi') {
            // Binlik noktalarını kaldır, ondalık ayıracı virgül olarak normalize et
            let s = String(val).trim();
            s = s.replace(/\s+/g, '');
            // Virgül varsa onu ondalık kabul et
            if (s.includes(',')) {
                const parts = s.split(',');
                const intDigits = parts[0].replace(/[^\d]/g, '');
                const decDigits = (parts[1] || '').replace(/[^\d]/g, '').replace(/0+$/, '');
                return decDigits ? `${intDigits},${decDigits}` : intDigits;
            }
            // Nokta ondalık ise (son nokta ondalık varsayılır)
            if (s.includes('.')) {
                const pos = s.lastIndexOf('.');
                const intDigits = s.slice(0, pos).replace(/[^\d]/g, '');
                const decDigits = s.slice(pos + 1).replace(/[^\d]/g, '').replace(/0+$/, '');
                return decDigits ? `${intDigits},${decDigits}` : intDigits;
            }
            return s.replace(/[^\d]/g, '');
        }
        // Polygon karşılaştırmasında GeoJSON string'ini normalize et
        if (column === 'polygon' || column === 'polygon_wkt' || column === 'polygon_geojson') {
            try {
                const obj = typeof val === 'string' ? JSON.parse(val) : val;
                if (obj && typeof obj === 'object' && obj.type && obj.coordinates) {
                    return JSON.stringify(obj);
                }
            } catch (_) {
                // geçerli JSON değilse string olarak devam
            }
        }
        if (typeof val === 'string') {
            // Türkçe case ve diakritik farklarını yoksay
            return normalizeTurkishInsensitive(val);
        }
        return String(val).trim();
    };

    const getTapuId = (record) => pickValue(record || {}, ['Id', 'id']);

    const setSaveButtonLabel = (text) => {
        if (tapuSaveBtn && typeof text === 'string') {
            tapuSaveBtn.textContent = text;
        }
    };

    const fetchNewTapuId = async () => {
        try {
            const resp = await fetch('api.php?action=generate_tapu_id');
            const data = await resp.json();
            if (data.success && data.id) return data.id;
            pushNotice('warning', 'ID üretilemedi, lütfen manuel ID girin');
            return null;
        } catch (e) {
            pushNotice('warning', 'ID üretimi başarısız');
            return null;
        }
    };

    const setTapuInputValue = (col, val) => {
        const inp = document.querySelector(`.tapu-input[data-tapu-column="${col}"]`);
        if (!inp) return;
        const normalized = val === null || val === undefined ? '' : String(val);
        const upperColumns = ['AnaTasinmazNitelik', 'AnaTasinmazNitelik_1', 'AnaTasinmazNitelik_2', 'AnaTasinmazNitelik_2_yedek'];
        const shouldUpper = upperColumns.some(u => u === col);
        const result = shouldUpper ? toUpperTr(normalized) : normalized;
        inp.value = result;
    };

    const applyAtnSuggestion = (sug) => {
        if (!sug) return;
        setTapuInputValue('AnaTasinmazNitelik_1', sug.AnaTasinmazNitelik_1 || '');
        setTapuInputValue('AnaTasinmazNitelik_2', sug.AnaTasinmazNitelik_2 || '');
        setTapuInputValue('AnaTasinmazNitelik_2_yedek', sug.AnaTasinmazNitelik_2_yedek || '');
    };

    const clearAtnSuggestionSelect = () => {
        const old = document.getElementById('atnSuggestionContainer');
        if (old && old.parentNode) old.parentNode.removeChild(old);
    };

    const renderAtnSuggestionSelect = (suggestions) => {
        clearAtnSuggestionSelect();
        if (!suggestions || suggestions.length < 2) return;
        const targetInput = document.querySelector('.tapu-input[data-tapu-column="AnaTasinmazNitelik_1"]');
        if (!targetInput) return;
        const wrapper = targetInput.closest('.tapu-detail-item');
        if (!wrapper) return;
        const div = document.createElement('div');
        div.id = 'atnSuggestionContainer';
        div.className = 'mt-2';
        div.innerHTML = `
            <label class="tapu-detail-label">Diğer ATN kombinasyonları</label>
            <select class="form-select form-select-sm" id="atnSuggestionSelect">
                ${suggestions.map((s, idx) => {
                    const label = `${escapeHtml(s.AnaTasinmazNitelik_1 || '-')}/${escapeHtml(s.AnaTasinmazNitelik_2 || '-')}/${escapeHtml(s.AnaTasinmazNitelik_2_yedek || '-')}`;
                    const freq = s.freq ?? s.count ?? '';
                    return `<option value="${idx}">${label}${freq ? ` (${freq})` : ''}</option>`;
                }).join('')}
            </select>
        `;
        wrapper.appendChild(div);
        const sel = div.querySelector('#atnSuggestionSelect');
        sel.addEventListener('change', () => {
            const idx = parseInt(sel.value, 10);
            if (!Number.isNaN(idx) && suggestions[idx]) {
                applyAtnSuggestion(suggestions[idx]);
            }
        });
    };

    const fetchAtnSuggestions = async (anaVal) => {
        if (!anaVal) return;
        try {
            const resp = await fetch(`api.php?action=get_atn_suggestions&ana=${encodeURIComponent(anaVal)}`);
            const data = await resp.json();
            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                pushNotice('warning', 'A.T.N kombinasyonları otomatik doldurulamadı, lütfen durumu IT\'ye bildiriniz.', 8, true);
                return;
            }
            const suggestions = data.data;
            const top = suggestions[0];
            applyAtnSuggestion(top);
            const freq = top.freq ?? top.count ?? '';
            renderAtnSuggestionSelect(suggestions);
            pushNotice('info', `ATN otomatik dolduruldu (kaynak: ${escapeHtml(anaVal)}, frekans: ${freq}).`, 8, true);
        } catch (err) {
            console.warn('ATN suggestion fetch failed', err);
            pushNotice('warning', 'A.T.N kombinasyonları otomatik doldurulamadı, lütfen durumu IT\'ye bildiriniz.', 8, true);
        }
    };


    const setEditMode = (state) => {
        tapuEditMode = state;
        if (tapuEditBtn) tapuEditBtn.classList.toggle('d-none', state);
        if (tapuSaveBtn) tapuSaveBtn.classList.toggle('d-none', !state);
        if (tapuCancelBtn) tapuCancelBtn.classList.toggle('d-none', !state);
        const inputs = document.querySelectorAll('.tapu-input');
        inputs.forEach((inp) => {
            if (inp.dataset.tapuType === 'readonly') {
                inp.readOnly = true;
                inp.disabled = true;
            } else {
                inp.disabled = !state;
            }
        });
    };

    const renderTapuRow = (row, originalOverride = null) => {
        if (!tapuDetailBody) return;
        tapuRecord = row || {};
        tapuOriginal = {};

        const cards = TAPU_FIELDS.map((field) => {
            const value = pickValue(row, field.keys);
            let normalizedValue = (() => {
                if (field.column === 'not_rating' && (value === null || value === undefined || value === '')) return 0;
                if (field.column === 'Hisse' && (value === null || value === undefined || value === '')) return 1;
                return value;
            })();
            const isAtnField = field.column.startsWith('AnaTasinmazNitelik');
            if (isAtnField) {
                normalizedValue = toUpperTr(String(normalizedValue ?? ''));
            }

            const originalSrc = originalOverride || row || {};
            const originalRaw = pickValue(originalSrc, field.keys);
            let originalNormalized = (() => {
                if (field.column === 'not_rating' && (originalRaw === null || originalRaw === undefined || originalRaw === '')) return 0;
                if (field.column === 'Hisse' && (originalRaw === null || originalRaw === undefined || originalRaw === '')) return 1;
                return originalRaw;
            })();
            if (isAtnField) {
                originalNormalized = toUpperTr(String(originalNormalized ?? ''));
            }

            const displayValue = normalizedValue === null || normalizedValue === undefined || normalizedValue === '' ? '' : normalizedValue;
            tapuOriginal[field.column] = originalNormalized;
            const inputAttr = [];
            if (field.max) inputAttr.push(`maxlength="${field.max}"`);
            if (field.type === 'textarea') {
                const hint = field.column === 'polygon' ? '<div class="text-muted small mt-1">Düzenleme gerekiyorsa geçerli bir GeoJSON (Polygon/MultiPolygon) gönderin.</div>' : '';
                return `
                    <div class="tapu-detail-item">
                        <div class="tapu-detail-label">${field.label}</div>
                        <textarea class="form-control form-control-sm tapu-input" data-tapu-column="${field.column}" data-tapu-type="${field.type}" ${inputAttr.join(' ')} ${tapuEditMode ? '' : 'disabled'}>${escapeHtml(displayValue)}</textarea>
                        ${hint}
                    </div>
                `;
            }
            if (field.type === 'select') {
                const options = field.options || [];
                const optsHtml = options.map(opt => {
                    const selected = String(displayValue) === String(opt) ? 'selected' : '';
                    return `<option value="${escapeHtml(opt)}" ${selected}>${opt === '' ? 'Seçiniz' : escapeHtml(opt)}</option>`;
                }).join('');
                const hint = field.column === 'Durum' ? '<div class="text-muted small mt-1">Uygun / Uygun değil olarak kaydedilir.</div>' : '';
                return `
                    <div class="tapu-detail-item">
                        <div class="tapu-detail-label">${field.label}</div>
                        <select class="form-select form-select-sm tapu-input" data-tapu-column="${field.column}" data-tapu-type="${field.type}" ${tapuEditMode ? '' : 'disabled'}>
                            ${optsHtml}
                        </select>
                        ${hint}
                    </div>
                `;
            }
            const inputType = field.type === 'int' || field.type === 'double' ? 'number' : 'text';
            const step = field.type === 'double' ? 'any' : undefined;
            if (step) inputAttr.push(`step="${step}"`);
            if (field.type === 'readonly') inputAttr.push('readonly disabled');
            let hint = '';
            if (field.column === 'not_rating') {
                hint = '<div class="text-muted small mt-1">Varsayılan: 0 (Seçiniz), 1: Yarar, 2: Yaramaz. Bu alanı değiştirirsen Prolegal Notu da güncelle.</div>';
            } else if (field.column === 'Hisse') {
                hint = '<div class="text-muted small mt-1">Varsayılan: 1 (tam hisse). Hisse 1 girilmezse sorgu sekmesinde görünmez.</div>';
            } else if (field.column === 'prolegal_not') {
                hint = '<div class="text-muted small mt-1">Bu alanı değiştirirsen Not Rating’i de güncelle.</div>';
            }
            return `
                <div class="tapu-detail-item">
                    <div class="tapu-detail-label">${field.label}</div>
                    <input class="form-control form-control-sm tapu-input" data-tapu-column="${field.column}" data-tapu-type="${field.type}" type="${inputType}" ${inputAttr.join(' ')} value="${escapeHtml(displayValue)}" ${tapuEditMode ? '' : 'disabled'}>
                    ${hint}
                </div>
            `;
        });

        tapuDetailBody.innerHTML = cards.join('');
        // Önce butonları varsayılan hale getir
        if (tapuSaveBtn) tapuSaveBtn.classList.remove('d-none');
        if (tapuEditBtn) tapuEditBtn.disabled = false;

        if (parselUpdateBlocked) {
            const warnSplit = document.createElement('div');
            warnSplit.className = 'alert alert-warning mb-3';
            warnSplit.innerHTML = `<div><strong>Dikkat:</strong> ${escapeHtml(parselUpdateReason || 'Parsel birden çok polygona bölünmüş. Uzman kontrolüyle güncellenmeli.')}</div>`;
            tapuDetailBody.prepend(warnSplit);
            if (tapuEditBtn) tapuEditBtn.disabled = true;
            if (tapuSaveBtn) tapuSaveBtn.classList.add('d-none');
        }
        if (tapuDiffList && tapuDiffList.length > 0) {
            const warn = document.createElement('div');
            warn.className = 'alert alert-danger mb-3';
            warn.innerHTML = `
                <div><strong>İlgili arazi veritabanında mevcut.</strong> Aşağıdaki alanlar TKGM verisinde değişmiş görünüyor:</div>
                <ul class="mb-2">
                    ${tapuDiffList.map(d => `<li>${escapeHtml(d.label)}: <span class="text-danger">${escapeHtml(d.newVal ?? '')}</span> <span class="text-muted">(eski: ${escapeHtml(d.oldVal ?? '')})</span></li>`).join('')}
                </ul>
                <div>Yine de kaydetmek istiyor musunuz?</div>
            `;
            tapuDetailBody.prepend(warn);
        }
        if (tapuEditBtn) tapuEditBtn.disabled = !getTapuId(row);
        setSaveButtonLabel('Kaydet');
        setEditMode(false);
    };

    const fetchTapuById = async () => {
        if (!tapuIdInput) return;
        const raw = tapuIdInput.value.trim();
        const id = parseInt(raw, 10);

        if (!raw || Number.isNaN(id) || id <= 0) {
            setTapuState('Geçerli bir ID girin', false);
            return;
        }

        console.log('[Tapu] Fetch start ID=', id);
        parselUpdateBlocked = false;
        parselUpdateReason = '';
        setTapuState('Yükleniyor...', true);
        tapuIdSearchBtn && (tapuIdSearchBtn.disabled = true);

        try {
            const resp = await fetch(`api.php?action=get_tapu_full&id=${encodeURIComponent(id)}`);
            const respText = await resp.text();
            let data = null;
            try {
                data = JSON.parse(respText);
            } catch (parseErr) {
                setTapuState('Sunucudan geçersiz yanıt alındı', false);
                console.error('Tapu ID parse hatası:', parseErr, respText);
                return;
            }

            const record = data?.data || (Array.isArray(data) ? data[0]?.data || data[0] : null);

            if (record) {
                tapuDiffList = [];
                renderTapuRow(record);
                pushNotice('success', `Kayıt yüklendi (ID: ${id})`);
                tapuIsNew = false;
                // Diğer sekmelerde de aynı kaydı göster
                populateAuxDetails(record);
            } else {
                const msg = (data && data.message) ? data.message : 'Kayıt bulunamadı';
                setTapuState(msg, false);
            }
        } catch (err) {
            setTapuState('Hata oluştu: ' + (err?.message || 'Bilinmeyen hata'), false);
        } finally {
            tapuIdSearchBtn && (tapuIdSearchBtn.disabled = false);
        }
    };

    if (tapuIdSearchBtn) {
        tapuIdSearchBtn.addEventListener('click', fetchTapuById);
    }
    if (tapuIdInput) {
        tapuIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchTapuById();
            }
        });
    }

    if (tapuNewBtn) {
        tapuNewBtn.addEventListener('click', () => {
            tapuRecord = { not_rating: 0, Hisse: 1 };
            tapuOriginal = {};
            tapuIsNew = true;
            parselUpdateBlocked = false;
            parselUpdateReason = '';
            const blank = { not_rating: 0, Hisse: 1 };
            renderTapuRow(blank);
            setSaveButtonLabel('Kaydet');
            setEditMode(true);
            pushNotice('info', 'Yeni arazi ekleme modundasınız. Alanları doldurup Kaydet\'e basın.', false);
        });
    }

    // İl/İlçe/Mahalle seçimleri
    if (tkgmIlSelect) {
        tkgmIlSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            loadIlceList(val);
        });
    }
    if (tkgmIlceSelect) {
        tkgmIlceSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            loadMahalleList(val);
        });
    }
    if (tkgmMahalleSelect) {
        tkgmMahalleSelect.addEventListener('change', (e) => {
            const val = e.target.value;
        });
    }

    // TKGM arazi keşfet
    const tkgmStatusEl = document.getElementById('tkgmStatus');
    const setTkgmStatus = (msg, type = 'muted', loading = false) => {
        if (!tkgmStatusEl) return;
        const color = {
            muted: 'text-muted',
            info: 'text-info',
            success: 'text-success',
            warning: 'text-warning',
            danger: 'text-danger'
        }[type] || 'text-muted';
        tkgmStatusEl.className = `${color} small ms-2`;
        if (loading) {
            tkgmStatusEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${escapeHtml(msg || '')}`;
        } else {
            tkgmStatusEl.textContent = msg || '';
        }
    };

    const fetchTkgm = async () => {
        const mahalleId = parseInt((tkgmMahalleSelect?.value || '').trim(), 10);
        const ada = parseInt((tkgmAdaInput?.value || '').trim(), 10) || 0;
        const parsel = parseInt((tkgmParselInput?.value || '').trim(), 10) || 0;
        // Eski konum (pasif parselde yer değiştirme varsa tekrar aramak için saklıyoruz)
        const originalAda = ada;
        const originalParsel = parsel;
        const originalMahalle = mahalleId;
        if (!mahalleId || mahalleId <= 0 || parsel < 0 || ada < 0) {
            pushNotice('error', 'Mahalle ID, Ada, Parsel değerlerini kontrol edin');
            return;
        }
        // Proxy rotasyonu sadece limit/403/429 durumunda backend tarafından otomatik yapılır
        const proxyUrl = `api.php?action=tkgm_parsel_proxy&mahalle_id=${encodeURIComponent(mahalleId)}&ada=${encodeURIComponent(ada)}&parsel=${encodeURIComponent(parsel)}`;
        pushNotice('info', 'TKGM sorgusu gönderiliyor...', 3);
        setTkgmStatus('TKGM sorgusu gönderildi, yanıt bekleniyor...', 'info', true);
        if (tkgmFetchBtn) tkgmFetchBtn.disabled = true;
        let tkgmSuccess = false;
        let proxyRotated = false;
        const startTime = performance.now();
        let diffCount = null; // mevcut kayıtta kaç alanın değiştiğini izlemek için
        try {
            const resp = await fetch(proxyUrl);
            const data = await resp.json();
            if (!data.success || !data.data) {
                throw new Error(data.message || 'TKGM verisi alınamadı');
            }
            proxyRotated = data.proxy_rotated === 1 || data.proxy_rotated === '1';
            const proxyUsed = data.proxy_used || {};
            const proxyIpBefore = data.proxy_ip_before || '';
            const proxyIpAfter = data.proxy_ip_after || '';
            tkgmSuccess = true;
            const tk = data.data;
            const resolvedFeature = resolvePassiveTkgmFeature(tk);
            const props = resolvedFeature.props;
            const geometry = resolvedFeature.geometry ?? tk.geometry ?? null;
            const pasifFeatures = resolvedFeature.list || [];
            parselUpdateBlocked = false;
            parselUpdateReason = '';

            const durumVal = props.durum ?? props.sorguDurumu;
            // TKGM bazı alanlarda ID dönmeyebilir, seçili il/ilçe/mahalle değerlerini yedek olarak kullan
        const fallbackIl = tkgmIlSelect?.value ? parseInt(tkgmIlSelect.value, 10) || null : null;
        const fallbackIlce = tkgmIlceSelect?.value ? parseInt(tkgmIlceSelect.value, 10) || null : null;
        const fallbackMahalle = tkgmMahalleSelect?.value ? parseInt(tkgmMahalleSelect.value, 10) || null : null;
        const anaAtn = props.nitelik || props.AnaTasinmazNitelik || props.ana_tasinmaz_nitelik || props.AnaTasinmazNitelik_1 || '';
        const source = tapuRecord || {};
        const existingIl = pickValue(source, ['İlBilgisi', 'IlBilgisi', 'il']) || '';
        const existingIlce = pickValue(source, ['İlceBilgisi', 'IlceBilgisi', 'ilce']) || '';
        const existingMahalle = pickValue(source, ['MahalleBilgisi', 'mahalle']) || '';
        const existingAtn = pickValue(source, ['AnaTasinmazNitelik', 'ana_tasinmaz_nitelik']) || '';
        const existingAtn1 = pickValue(source, ['AnaTasinmazNitelik_1', 'ana_tasinmaz_nitelik_1']) || '';
        const existingAtn2 = pickValue(source, ['AnaTasinmazNitelik_2', 'ana_tasinmaz_nitelik_2']) || '';
        const existingAtn2Y = pickValue(source, ['AnaTasinmazNitelik_2_yedek', 'ana_tasinmaz_nitelik_2_yedek']) || '';
            const newIlRaw = props.ilAd || '';
            const newIlceRaw = props.ilceAd || '';
            const newMahalleRaw = props.mahalleAd || '';
            const ilSame = existingIl && normalizeTurkishInsensitive(existingIl) === normalizeTurkishInsensitive(newIlRaw);
            const ilceSame = existingIlce && normalizeTurkishInsensitive(existingIlce) === normalizeTurkishInsensitive(newIlceRaw);
            const mahalleSame = existingMahalle && normalizeTurkishInsensitive(existingMahalle) === normalizeTurkishInsensitive(newMahalleRaw);
            const mapped = {
                Id: props.id || '',
                İlBilgisi: ilSame ? existingIl : toUpperTr(newIlRaw),
                İlceBilgisi: ilceSame ? existingIlce : toUpperTr(newIlceRaw),
                MahalleBilgisi: mahalleSame ? existingMahalle : toUpperTr(newMahalleRaw),
                AdaBilgisi: props.adaNo || '',
                ParselBilgisi: props.parselNo || '',
                YuzolcumBilgisi: props.alan || '',
                AnaTasinmazNitelik: toUpperTr(anaAtn || '') || existingAtn,
                AnaTasinmazNitelik_1: toUpperTr(props.imarFonksiyon || anaAtn || existingAtn1),
                AnaTasinmazNitelik_2: toUpperTr(props.AnaTasinmazNitelik_2 || existingAtn2),
                AnaTasinmazNitelik_2_yedek: toUpperTr(props.AnaTasinmazNitelik_2_yedek || existingAtn2Y),
                Hisse: (props.hisse === null || props.hisse === undefined || props.hisse === '') ? 1 : props.hisse,
                mahalle_id: props.mahalleId || props.mahalle_id || fallbackMahalle || '',
                il_id: props.ilId || props.il_id || fallbackIl || '',
                ilce_id: props.ilceId || props.ilce_id || fallbackIlce || '',
                prolegal_not: props.prolegal_not || '',
                not_rating: props.not_rating ?? 0,
                polygon: geometry ? JSON.stringify(geometry) : ''
            };
            // Pasif parsel: tek polygona gitmişse yeni değerleri uygula
            if (pasifFeatures.length === 1) {
                const nf = pasifFeatures[0] || {};
                const np = nf.properties || {};
                mapped.AdaBilgisi = np.adaNo || mapped.AdaBilgisi;
                mapped.ParselBilgisi = np.parselNo || mapped.ParselBilgisi;
                mapped.mahalle_id = np.mahalleId || mapped.mahalle_id;
                mapped.il_id = np.ilId || mapped.il_id;
                mapped.ilce_id = np.ilceId || mapped.ilce_id;
                mapped.MahalleBilgisi = np.mahalleAd || mapped.MahalleBilgisi;
                mapped.İlceBilgisi = np.ilceAd || mapped.İlceBilgisi;
                mapped.İlBilgisi = np.ilAd || mapped.İlBilgisi;
                mapped.AnaTasinmazNitelik = np.nitelik || mapped.AnaTasinmazNitelik;
                mapped.AnaTasinmazNitelik_1 = mapped.AnaTasinmazNitelik_1 || np.nitelik || '';
                mapped.polygon = nf.geometry ? JSON.stringify(nf.geometry) : mapped.polygon;
                pushNotice('warning', 'TKGM: Parsel pasife alınmış, parsel bölünmemiş (tek parsel). Güncel bilgiler uygulandı.', 8);
            } else if (pasifFeatures.length > 1) {
                parselUpdateBlocked = true;
                parselUpdateReason = 'Bu parsel TKGM tarafında birden çok polygona bölünmüş. Uzman kontrolüyle güncellenmeli.';
                pushNotice('error', parselUpdateReason, 0);
            }
            // Veritabanında aynı konumda kayıt var mı?
            tapuDiffList = [];
            let existing = null;
            try {
                // Önce yeni konumla ara (pasif parsel tek polygona gitmişse yeni konum)
                const locMahalle = parseInt(mapped.mahalle_id || fallbackMahalle || 0, 10) || 0;
                const locAda = parseInt(mapped.AdaBilgisi || ada || 0, 10) || 0;
                const locParsel = parseInt(mapped.ParselBilgisi || parsel || 0, 10) || 0;
                const exResp = await fetch(`api.php?action=find_tapu_by_location&mahalle_id=${encodeURIComponent(locMahalle)}&ada=${encodeURIComponent(locAda)}&parsel=${encodeURIComponent(locParsel)}`);
                const exJson = await exResp.json();
                if (exJson?.success && exJson.data) {
                    existing = exJson.data;
                } else {
                    // Yeni konumda bulamazsak eski konumla dene (pasif parselde yer değiştirme için)
                    const exRespOld = await fetch(`api.php?action=find_tapu_by_location&mahalle_id=${encodeURIComponent(originalMahalle)}&ada=${encodeURIComponent(originalAda)}&parsel=${encodeURIComponent(originalParsel)}`);
                    const exJsonOld = await exRespOld.json();
                    if (exJsonOld?.success && exJsonOld.data) {
                        existing = exJsonOld.data;
                    }
                }
            } catch (e) {
                // sessiz geç
            }

            if (existing) {
                // ID üretme, mevcut ID’yi kullan
                mapped.Id = existing.Id;
                if (tapuIdInput) tapuIdInput.value = mapped.Id;
                // DB'deki il/ilçe/mahalle yazımını aynen koru (existing kaydın değerleri)
                mapped.İlBilgisi = existing.il || mapped.İlBilgisi;
                mapped.İlceBilgisi = existing.ilce || mapped.İlceBilgisi;
                mapped.MahalleBilgisi = existing.mahalle || mapped.MahalleBilgisi;
                mapped.il = existing.il || mapped.il;
                mapped.ilce = existing.ilce || mapped.ilce;
                mapped.mahalle = existing.mahalle || mapped.mahalle;
                // ATN alanlarını da mevcut kayıtla hizala (TKGM boş geldiyse diff çıkmasın)
                mapped.AnaTasinmazNitelik = existing.ana_tasinmaz_nitelik || mapped.AnaTasinmazNitelik;
                mapped.AnaTasinmazNitelik_1 = existing.ana_tasinmaz_nitelik_1 || mapped.AnaTasinmazNitelik_1;
                mapped.AnaTasinmazNitelik_2 = existing.ana_tasinmaz_nitelik_2 || mapped.AnaTasinmazNitelik_2;
                mapped.AnaTasinmazNitelik_2_yedek = existing.ana_tasinmaz_nitelik_2_yedek || mapped.AnaTasinmazNitelik_2_yedek;
                // Farkları hesapla
                const diffs = [];
                const existingSource = {
                    Id: existing.Id,
                    İlBilgisi: existing.il,
                    İlceBilgisi: existing.ilce,
                    MahalleBilgisi: existing.mahalle,
                    AdaBilgisi: existing.ada,
                    ParselBilgisi: existing.parsel,
                    YuzolcumBilgisi: existing.yuzolcumu,
                    AnaTasinmazNitelik: existing.ana_tasinmaz_nitelik,
                    AnaTasinmazNitelik_1: existing.ana_tasinmaz_nitelik_1,
                    AnaTasinmazNitelik_2: existing.ana_tasinmaz_nitelik_2,
                    AnaTasinmazNitelik_2_yedek: existing.ana_tasinmaz_nitelik_2_yedek,
                    Hisse: existing.hisse,
                    mahalle_id: existing.mahalle_id,
                    il_id: existing.il_id,
                    ilce_id: existing.ilce_id,
                    polygon: existing.polygon_geojson || existing.polygon_wkt || existing.polygon,
                    Durum: existing.durum,
                    prolegal_not: existing.prolegal_not,
                    not_rating: existing.not_rating,
                };
                TAPU_FIELDS.forEach((f) => {
                    const oldVal = pickValue(existingSource, f.keys);
                    const newVal = pickValue(mapped, f.keys);
                    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal).trim();
                    const newStr = newVal === null || newVal === undefined ? '' : String(newVal).trim();
                    const oldNorm = normalizeForDiff(oldVal, f.type, f.column);
                    const newNorm = normalizeForDiff(newVal, f.type, f.column);
                    if (oldNorm !== newNorm) {
                        diffs.push({ column: f.column, label: f.label, oldVal: oldVal, newVal: newVal });
                    }
                });
                tapuDiffList = diffs;
                tapuIsNew = false;
                tapuRecord = mapped;
                tapuOriginal = existingSource;
                renderTapuRow(mapped, existingSource);
                setSaveButtonLabel('Kaydet (Güncelle)');
                setEditMode(true);
                diffCount = diffs.length;
                if (diffs.length > 0) {
                    pushNotice('warning', 'İlgili arazi veritabanında mevcut; TKGM verisiyle bazı alanlar farklı. Kırmızı uyarıya bakın.', 10);
                } else {
                    pushNotice('success', 'TKGM yanıtı alındı: Arazi verileri birebir aynı.', 8);
                    setTkgmStatus('TKGM yanıtı alındı: Arazi verileri birebir aynı.', 'success');
                }
            } else {
                if (!mapped.Id) {
                    const newId = await fetchNewTapuId();
                    if (newId) {
                        mapped.Id = newId;
                        if (tapuIdInput) tapuIdInput.value = newId;
                        pushNotice('info', `Geçici ID atandı: ${newId}`, 0);
                    }
                } else if (tapuIdInput) {
                    tapuIdInput.value = mapped.Id;
                }
                tapuRecord = mapped;
                tapuOriginal = {};
                tapuIsNew = true;
                tapuDiffList = [];
                renderTapuRow(mapped);
                setSaveButtonLabel('Kaydet (TKGM)');
                setEditMode(true);
            }

            if (anaAtn) {
                fetchAtnSuggestions(anaAtn);
            }
            pushNotice('success', 'TKGM yanıtı alındı ve forma işlendi');
            if (proxyUsed && (proxyUsed.proxy_host || proxyUsed.proxy_session)) {
                const hostPart = proxyUsed.proxy_host ? `Host: ${escapeHtml(proxyUsed.proxy_host)}` : '';
                const sessionPart = proxyUsed.proxy_session ? `Session: ${escapeHtml(proxyUsed.proxy_session)}` : '';
                const joined = [hostPart, sessionPart].filter(Boolean).join(' | ');
                if (joined) {
                    pushNotice('info', `Kullanılan proxy ${joined}`, 6, true);
                }
            }
            if (proxyIpBefore && proxyIpAfter && proxyIpBefore !== proxyIpAfter) {
                pushNotice('info', `Proxy IP değişti: ${escapeHtml(proxyIpBefore)} → ${escapeHtml(proxyIpAfter)}`, 8, true);
            } else if (proxyIpBefore) {
                pushNotice('info', `Proxy IP: ${escapeHtml(proxyIpBefore)}`, 6, true);
            }
            if (durumVal !== undefined && durumVal !== null) {
                const isActive = String(durumVal) === '1';
                pushNotice(isActive ? 'success' : 'warning', isActive ? 'Parsel aktif (durum=1)' : 'Parsel pasif (durum=0)');
            }
        } catch (err) {
            console.warn('TKGM proxy başarısız:', err);
            pushNotice('error', 'TKGM verisi alınamadı: ' + (err?.message || 'Bilinmeyen hata'));
            setTkgmStatus('TKGM yanıtı alınamadı, lütfen tekrar deneyin.', 'warning');
        } finally {
            if (tkgmFetchBtn) tkgmFetchBtn.disabled = false;
            if (tkgmSuccess) {
                const elapsedMs = performance.now() - startTime;
                setTkgmStatus(`TKGM yanıtı alındı. (${Math.round(elapsedMs)} ms)`, 'success');
                if (proxyRotated) {
                    pushNotice('info', 'Kota/limit nedeniyle proxy IP yenilendi ve tekrar denendi. Bu işlem isteği yavaşlatabilir.', 8, true);
                    setTkgmStatus(`Proxy IP yenilendi, TKGM yanıtı alındı. (${Math.round(elapsedMs)} ms)`, 'info');
                }
                if (diffCount === 0) {
                    pushNotice('success', 'TKGM verileri mevcut kayıtla birebir aynı.', 8);
                } else if (diffCount > 0) {
                    pushNotice('warning', 'TKGM verileri mevcut kayıtla farklı; detay için kırmızı uyarıya bakın.', 8);
                }
            }
        }
    };

    if (tkgmFetchBtn) {
        tkgmFetchBtn.addEventListener('click', fetchTkgm);
    }
    [tkgmAdaInput, tkgmParselInput].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchTkgm();
            }
        });
    });

    // İlk yüklemede il listesi
    loadIlList();

        const collectChanges = (forceAll = false) => {
            const inputs = Array.from(document.querySelectorAll('.tapu-input'));
            const changes = {};
            let error = null;
            const changedLabels = [];

        for (const inp of inputs) {
            const col = inp.dataset.tapuColumn;
            const type = inp.dataset.tapuType || 'text';
            if (!forceAll && col === 'Id') continue;
            let val = inp.value;
            if (val !== null && typeof val === 'string') val = val.trim();
            if (val === '') val = null;

            // Alan (YuzolcumBilgisi) için uyarı: sayısal değilse bildir ve kaydetmeyi blokla
            if (col === 'YuzolcumBilgisi' && val !== null) {
                const normalized = String(val).replace(/\./g, '').replace(',', '.');
                if (normalized !== '' && isNaN(parseFloat(normalized))) {
                    error = 'Alan sayısal olmalı';
                    pushNotice('error', error);
                    break;
                }
            }

            if (type === 'int') {
                if (val !== null && isNaN(parseInt(val, 10))) {
                    error = `${col} sayısal olmalı`;
                    pushNotice('error', `${col} sayısal olmalı`);
                    break;
                }
                val = val === null ? null : parseInt(val, 10);
            } else if (type === 'double') {
                if (val !== null && isNaN(parseFloat(val))) {
                    error = `${col} sayısal olmalı`;
                    pushNotice('error', `${col} sayısal olmalı`);
                    break;
                }
                val = val === null ? null : parseFloat(val);
            }

            // not_rating (0/1/2) kontrolü
            if (col === 'not_rating' && val !== null && ![0, 1, 2].includes(Number(val))) {
                error = 'Not Rating sadece 0 (Seçiniz), 1 (Yarar) veya 2 (Yaramaz) olabilir';
                pushNotice('error', error);
                break;
            }

            const original = tapuOriginal[col];
            const originalStr = original === null || original === undefined ? '' : String(original);
            const valStr = val === null || val === undefined ? '' : String(val);
            if (forceAll || originalStr !== valStr) {
                changes[col] = val;
                const fieldMeta = TAPU_FIELDS.find(f => f.column === col);
                changedLabels.push(fieldMeta ? fieldMeta.label : col);
            }
        }

        // Karşılıklı bağımlılık: not_rating ve prolegal_not birlikte değişmeli
        const notRatingChanged = Object.prototype.hasOwnProperty.call(changes, 'not_rating');
        const prolegalNotChanged = Object.prototype.hasOwnProperty.call(changes, 'prolegal_not');
        if (notRatingChanged !== prolegalNotChanged) {
            error = 'Not Rating ile Prolegal Not birlikte güncellenmelidir.';
        }

        const upperKeys = ['AnaTasinmazNitelik', 'AnaTasinmazNitelik_1', 'AnaTasinmazNitelik_2', 'AnaTasinmazNitelik_2_yedek'];
        upperKeys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(changes, key) && typeof changes[key] === 'string') {
                changes[key] = toUpperTr(changes[key]);
            }
        });
        return { changes, error, changedLabels };
    };

    const renderDetailGrid = (container, items) => {
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="tapu-detail-item">
                <div class="tapu-detail-label">${escapeHtml(item.label)}</div>
                <div class="tapu-detail-value">${escapeHtml(item.value ?? '')}</div>
            </div>
        `).join('');
    };

    const populateAuxDetails = (row) => {
        if (!row) return;
        const detailSource = row.properties || row;
        const basvuruFields = [
            { label: 'ID', keys: ['Id','id'] },
            { label: 'Başvuru Türü', keys: ['basvuru_turu'] },
            { label: 'Başvuru Sayısı', keys: ['basvuru_sayısı'] },
            { label: 'Başvurulan Firma', keys: ['basvurulan_firma'] },
            { label: 'Başvuru Tarihi', keys: ['basvuru_tarihi'] }
        ];
        const sorguFields = [
            { label: 'ID', keys: ['Id','id'] },
            { label: 'Sorgulama Durumu', keys: ['sorgulama_durumu'] },
            { label: 'Sorgulanan Firma', keys: ['sorgulanan_firma','basvurulan_firma'] },
            { label: 'Konu', keys: ['konu'] }
        ];
        const mapItems = (fields) => fields.map(f => ({
            label: f.label,
            value: pickValue(detailSource, f.keys)
        }));
        renderDetailGrid(basvuruDetail, mapItems(basvuruFields));
        renderDetailGrid(sorguDetail, mapItems(sorguFields));
    };

    const hydrateAllViews = (row) => {
        if (!row) return;
        tapuIsNew = false;
        tapuRecord = row;
        tapuOriginal = {};
        renderTapuRow(row);
        setSaveButtonLabel('Kaydet');
        if (tapuIdInput && getTapuId(row)) tapuIdInput.value = getTapuId(row);
        populateAuxDetails(row);
    };

    const fetchById = async (id, silent = false) => {
        const url = `api.php?prolegalId=${encodeURIComponent(id)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            const record = Array.isArray(data) ? (data[0]?.data || data[0]) : data?.data || data;
            if (!record) throw new Error('Kayıt bulunamadı');
            hydrateAllViews(record);
            if (!silent) pushNotice('success', `Kayıt bulundu (ID: ${id})`);
        } catch (e) {
            const msg = e?.message || 'Kayıt bulunamadı';
            if (!silent) pushNotice('error', msg);
            if (basvuruDetail) basvuruDetail.innerHTML = `<div class="tapu-detail-item text-muted small">Kayıt bulunamadı</div>`;
            if (sorguDetail) sorguDetail.innerHTML = `<div class="tapu-detail-item text-muted small">Kayıt bulunamadı</div>`;
        }
    };

    const bindIdSearch = (inputEl, btnEl) => {
        if (!inputEl || !btnEl) return;
        const handler = () => {
            const raw = inputEl.value.trim();
            const id = parseInt(raw, 10);
            if (!raw || Number.isNaN(id) || id <= 0) {
                pushNotice('error', 'Geçerli bir ID girin');
                return;
            }
            fetchById(id);
        };
        btnEl.addEventListener('click', handler);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handler();
            }
        });
    };

    const saveTapu = async () => {
        if (!tapuRecord) {
            pushNotice('error', 'Önce bir kayıt yükleyin');
            return;
        }
        // ATN alanları boşsa kaydetme (güncel input değerlerini kontrol et)
        const atnFields = ['AnaTasinmazNitelik', 'AnaTasinmazNitelik_1', 'AnaTasinmazNitelik_2', 'AnaTasinmazNitelik_2_yedek'];
        for (const f of atnFields) {
            const inp = document.querySelector(`.tapu-input[data-tapu-column="${f}"]`);
            const val = inp ? String(inp.value || '').trim() : String(pickValue(tapuRecord, [f]) || '').trim();
            if (!val) {
                pushNotice('error', 'A.T.N alanları boş olamaz, kaydetmeden önce doldurun.');
                if (inp) inp.focus();
                return;
            }
        }
        const id = getTapuId(tapuRecord);
        const { changes, error, changedLabels } = collectChanges(tapuIsNew);
        if (error) {
            pushNotice('error', error);
            return;
        }
        if (!tapuIsNew && (!id || id <= 0)) {
            pushNotice('error', 'Geçersiz ID');
            return;
        }
        if (Object.keys(changes).length === 0) {
            pushNotice('info', 'Değişiklik yok');
            setEditMode(false);
            renderTapuRow(tapuRecord);
            return;
        }

        const highlighted = `<span style="color:#b91c1c;">${changedLabels.join(', ')}</span>`;
        const actionLabel = tapuIsNew ? 'eklencek' : 'güncellenecek';
        const confirmMsg = `<span style="font-size:12px;">Şu alanlar ${actionLabel}: ${highlighted}. Devam etmek istiyor musunuz?</span>`;
        if (!pendingConfirm || pendingConfirm.msg !== confirmMsg) {
            pendingConfirm = { msg: confirmMsg };
            if (tapuSaveBtn) tapuSaveBtn.textContent = 'Kaydet x2';
            pushNotice('warning', `${confirmMsg} <span style="font-size:12px;">Kaydet'e tekrar basarak onaylayın.</span>`, false, true);
            return;
        }
        if (tapuSaveBtn) tapuSaveBtn.textContent = 'Kaydet';
        pendingConfirm = null;

        tapuSaveBtn && (tapuSaveBtn.disabled = true);
        try {
            const endpoint = tapuIsNew ? 'api.php?action=create_tapu' : 'api.php?action=update_tapu';
            const bodyPayload = tapuIsNew ? { ...changes } : { id, ...changes };
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            const raw = await resp.text();
            let data = null;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                pushNotice('error', 'Sunucudan geçersiz yanıt alındı');
                console.error('update_tapu parse error', raw);
                return;
            }
            if (!data.success) {
                pushNotice('error', data.message || 'Güncelleme başarısız');
                return;
            }
            if (tapuIsNew) {
                const newId = data.id || id;
                pushNotice('success', `Kayıt eklendi (ID: ${newId})`, 0);
                if (newId) {
                    tapuIdInput.value = newId;
                    tapuIsNew = false;
                    await fetchTapuById();
                    return;
                }
            } else {
                tapuRecord = { ...tapuRecord, ...changes };
                renderTapuRow(tapuRecord);
                pushNotice('success', 'Güncellendi');
            }
        } catch (err) {
            pushNotice('error', 'Hata: ' + (err?.message || 'Bilinmeyen hata'));
        } finally {
            tapuSaveBtn && (tapuSaveBtn.disabled = false);
        }
    };

    if (tapuEditBtn) {
        tapuEditBtn.addEventListener('click', () => setEditMode(true));
    }
    if (tapuCancelBtn) {
        tapuCancelBtn.addEventListener('click', () => {
            if (tapuRecord) {
                renderTapuRow(tapuRecord);
            } else {
                setTapuState('Henüz veri yüklenmedi', true);
            }
        });
    }
    if (tapuSaveBtn) {
        tapuSaveBtn.addEventListener('click', saveTapu);
    }

    // Basvuru / Sorgu ID arama
    bindIdSearch(basvuruIdInput, basvuruIdBtn);
    bindIdSearch(sorguIdInput, sorguIdBtn);

    ['basvuruRefreshBtn','sorguRefreshBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => alert('Listeleme endpointi bağlanmadı.'));
    });
});
</script>
</body>
</html>
