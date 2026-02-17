// Toggle fonksiyonu dashboard.php'de dinamik olarak tanımlandı

// Global değişkenler
var currentPanel = null;
var currentParcelCenter = null;
var isMinimized = false;
var autoQueuedPanelIds = new Set();
var autoQueueInProgress = false;
// İmar API sonuç cache'i
var imarApiCache = {};
// TKGM sorgu zamanını tutan cache (1 saat, mem + localStorage)
const popupCheckCache = {};
const POPUP_CACHE_TTL_MS = 3600000; // 1 saat
const cacheKeyFor = (mid, ada, parsel) => `${mid}|${ada}|${parsel}`;
const readTkgmTimestamp = (key) => {
    const now = Date.now();
    const mem = popupCheckCache[key];
    if (mem && (now - mem.ts) < POPUP_CACHE_TTL_MS) return mem;
    try {
        const raw = localStorage.getItem('popup_tkgm_ts_' + key);
        if (!raw) return null;
        const ts = parseInt(raw, 10);
        if (Number.isFinite(ts) && (now - ts) < POPUP_CACHE_TTL_MS) {
            const hit = { ts };
            popupCheckCache[key] = hit;
            return hit;
        }
    } catch (_) {}
    return null;
};
const writeTkgmTimestamp = (key) => {
    const ts = Date.now();
    popupCheckCache[key] = { ts };
    try { localStorage.setItem('popup_tkgm_ts_' + key, String(ts)); } catch (_) {}
};
// HTML escape helper
const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
// Basit alan parse helper'ı
const parseAreaVal = (val) => {
    if (val === null || val === undefined) return null;
    const s = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : null;
};
// Alan gösterimi için: binlik ayırıcı noktaları temizle
const formatAreaDisplay = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\./g, '').trim();
};


// Alanı DB'ye gönderirken nokta ayırıcılarını temizle
const normalizeAreaForDb = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\./g, '').trim();
};

// Türkçe büyük harf helper
const toUpperTr = (val) => {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/i/g, 'İ')
        .replace(/ı/g, 'I')
        .replace(/ş/g, 'Ş')
        .replace(/ğ/g, 'Ğ')
        .replace(/ü/g, 'Ü')
        .replace(/ö/g, 'Ö')
        .replace(/ç/g, 'Ç')
        .toUpperCase();
};

// Türkçe insensitive normalize
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

// Popup içi durum göstergesi
const ensurePopupStatusEl = () => {
    let el = document.getElementById('popupTkgmStatus');
    if (el) return el;
    const modalBody = document.querySelector('#info-modal .modal-body') || document.querySelector('#info-modal');
    if (!modalBody) return null;
    el = document.createElement('div');
    el.id = 'popupTkgmStatus';
    el.className = 'alert alert-info py-2 px-3 mt-2';
    modalBody.prepend(el);
    return el;
};
const setPopupStatus = (msg, type = 'info', loading = false) => {
    const el = ensurePopupStatusEl();
    if (!el) return;
    const cls = {
        info: 'alert-info',
        success: 'alert-success',
        warning: 'alert-warning',
        danger: 'alert-danger',
        muted: 'alert-secondary'
    }[type] || 'alert-info';
    el.className = `alert py-2 px-3 mt-2 ${cls}`;
    const spinner = loading ? '<span class="spinner-border spinner-border-sm me-2"></span>' : '';
    el.innerHTML = `${spinner}${escapeHtml(msg || '')}`;
};

// Güncelleme başarısız olduğunda backend'e logla (sessizce)
const logPopupUpdateFail = async (reason, ctx = {}) => {
    try {
        const payload = {
            reason: reason,
            tapu_id: ctx.tapuId ?? null,
            mahalle_id: ctx.mahalleId ?? null,
            ada: ctx.ada ?? null,
            parsel: ctx.parsel ?? null,
            il: ctx.il ?? null,
            ilce: ctx.ilce ?? null,
            mahalle: ctx.mahalle ?? null
        };
        await fetch('api.php?action=log_popup_update_fail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn('logPopupUpdateFail hata', e);
    }
};

// Pasif parselde gittigiParselListe içinden ilk feature'ı çözümler
const resolvePassiveTkgmFeatureInline = (featureData) => {
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

async function runPopupTkgmCheckInline(properties) {
    try {
        const mid = properties?.mahalleId ?? properties?.mahalle_id ?? null;
        const adaNo = properties?.adaNo ?? properties?.ada ?? null;
        const parselNo = properties?.parselNo ?? properties?.parsel ?? null;
        if (!mid || adaNo === null || parselNo === null) return;
        let statusSet = false;
        setPopupStatus('Arazi değişim kontrolü yapılıyor...', 'info', true);
        const cacheKey = cacheKeyFor(mid, adaNo, parselNo);

        const processWithData = async (dbJson, tkJson) => {
            const db = dbJson.data;
            const tk = tkJson.data;
            const resolved = resolvePassiveTkgmFeatureInline(tk);
            const props = resolved.props || {};
            const geometry = resolved.geometry || tk.geometry || null;
            const pasifList = resolved.list || [];

            const durumVal = props?.durum ?? props?.sorguDurumu ?? '';
            const isPasif = String(durumVal).trim() === '0';

            // çoklu polygon kontrolü
            let multiPoly = false;
            if (tk?.type === 'FeatureCollection' && Array.isArray(tk.features) && tk.features.length > 1) {
                multiPoly = true;
            }
            if (pasifList.length > 1) multiPoly = true;

            const dbArea = parseAreaVal(db?.yuzolcumu || db?.YuzolcumBilgisi || db?.alan);
            const tkArea = parseAreaVal(props?.alan);
            const areaChanged = dbArea && tkArea ? (Math.abs(tkArea - dbArea) / dbArea > 0.10) : false;

            if (isPasif && multiPoly) {
                setPopupStatus('Parsel pasif ve çoklu polygona bölünmüş. IT/uzman desteği gerekli.', 'warning');
                statusSet = true;
                await logPopupUpdateFail('Pasif ve çoklu polygon', {
                    tapuId: db?.Id ?? db?.id,
                    mahalleId: mid,
                    ada: adaNo,
                    parsel: parselNo,
                    il: db?.il,
                    ilce: db?.ilce,
                    mahalle: db?.mahalle
                });
                return;
            }
            if (areaChanged) {
                setPopupStatus('Parsel alanı %10’dan fazla değişmiş. Güncelleme yapılmadı ve sisteme loglandı', 'warning');
                statusSet = true;
                await logPopupUpdateFail('Alan %10’dan fazla değişmiş', {
                    tapuId: db?.Id ?? db?.id,
                    mahalleId: mid,
                    ada: adaNo,
                    parsel: parselNo,
                    il: db?.il,
                    ilce: db?.ilce,
                    mahalle: db?.mahalle
                });
                return;
            }

            const diffs = [];
            const changedFields = [];
            const highlightField = (id, dbVal, tkVal, label) => {
                const el = document.getElementById(id);
                if (!el) return;
                const oldVal = dbVal ?? '';
                const newVal = tkVal ?? '';
                const normOld = normalizeTurkishInsensitive(oldVal);
                const normNew = normalizeTurkishInsensitive(newVal);
                // Özel ada: TKGM 0'ları boş dönebiliyor; bizimkisi 0 ise ve TK boş/0 ise farklı sayma
                let isDiff = normOld !== normNew;
                if (label === 'Ada') {
                    const isDbZero = normOld === '' || normOld === '0';
                    const isTkZero = normNew === '' || normNew === '0';
                    if (isDbZero && isTkZero) {
                        isDiff = false;
                    }
                }
                if (isDiff) {
                    diffs.push(label);
                    changedFields.push({ id, label, newVal: newVal });
                    el.innerHTML = `${escapeHtml(oldVal)} <span class="text-danger">(${escapeHtml(newVal)})</span>`;
                } else {
                    el.textContent = oldVal;
                }
            };

            highlightField('oznitelik:il', db.il, props.ilAd, 'İl');
            highlightField('oznitelik:ilce', db.ilce, props.ilceAd, 'İlçe');
            highlightField('oznitelik:mahalle', db.mahalle, props.mahalleAd, 'Mahalle');
            highlightField('oznitelik:ada', db.ada, props.adaNo, 'Ada');
            highlightField('oznitelik:parsel', db.parsel, props.parselNo, 'Parsel');
            // Alan: sayısal karşılaştır
            const areaEl = document.getElementById('oznitelik:tapualani');
            const dbAreaInline = parseAreaVal(db?.yuzolcumu || db?.YuzolcumBilgisi || db?.alan);
            const tkAreaInline = parseAreaVal(props?.alan);
            if (areaEl && dbAreaInline && tkAreaInline) {
                if (Math.abs(tkAreaInline - dbAreaInline) > 0.0001) {
                    diffs.push('Alan');
                    changedFields.push({ id: 'oznitelik:tapualani', label: 'Alan', newVal: props.alan || '' });
                    areaEl.innerHTML = `${escapeHtml(formatAreaDisplay(db.yuzolcumu || db.alan || ''))} <span class="text-danger">(${escapeHtml(formatAreaDisplay(props.alan || ''))})</span>`;
                } else {
                    areaEl.textContent = formatAreaDisplay(db.yuzolcumu || db.alan || '');
                }
            }
            highlightField('oznitelik:nitelik', db.ana_tasinmaz_nitelik, props.nitelik, 'A.T.N');

            // Güncelleme gerekiyorsa DB'yi güncelle
            if (diffs.length === 0) {
                setPopupStatus('TKGM kontrolü: veriler birebir aynı.', 'success');
                statusSet = true;
            } else {
                // DB güncelle payload'ı: farklıysa TKGM değerini, yoksa DB değerini kullan
                const nextIl = props.ilAd ? toUpperTr(props.ilAd) : db.il;
                const nextIlce = props.ilceAd ? toUpperTr(props.ilceAd) : db.ilce;
                const nextMahalle = props.mahalleAd ? toUpperTr(props.mahalleAd) : db.mahalle;
                const payload = {
                    id: db.Id || db.id,
                    İlBilgisi: nextIl,
                    İlceBilgisi: nextIlce,
                    MahalleBilgisi: nextMahalle,
                    AdaBilgisi: props.adaNo || db.ada,
                    ParselBilgisi: props.parselNo || db.parsel,
                    YuzolcumBilgisi: normalizeAreaForDb(props.alan || db.yuzolcumu),
                    AnaTasinmazNitelik: toUpperTr(props.nitelik || db.ana_tasinmaz_nitelik || ''),
                    AnaTasinmazNitelik_1: toUpperTr(props.imarFonksiyon || db.ana_tasinmaz_nitelik_1 || ''),
                    AnaTasinmazNitelik_2: toUpperTr(props.AnaTasinmazNitelik_2 || db.ana_tasinmaz_nitelik_2 || ''),
                    AnaTasinmazNitelik_2_yedek: toUpperTr(props.AnaTasinmazNitelik_2_yedek || db.ana_tasinmaz_nitelik_2_yedek || ''),
                    mahalle_id: props.mahalleId || db.mahalle_id,
                    il_id: props.ilId || db.il_id,
                    ilce_id: props.ilceId || db.ilce_id
                };
                if (geometry) {
                    payload.polygon = JSON.stringify(geometry);
                }

                try {
                    const updResp = await fetch('api.php?action=update_tapu', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const updJson = await updResp.json();
                    if (updJson?.success) {
                        const diffList = diffs.length ? ` (${diffs.join(', ')})` : '';
                        setPopupStatus(`TKGM verileriyle farklı alanlar güncellendi${diffList}.`, 'success');
                        statusSet = true;
                        // Popup alanlarını yeni değerlerle doldur (parantezsiz)
                        const setVal = (id, val) => {
                            const el = document.getElementById(id);
                            if (el) {
                                el.innerHTML = escapeHtml(val ?? '');
                            }
                        };
                        const finalAda = props.adaNo || db.ada;
                        const finalParsel = props.parselNo || db.parsel;
                        const finalArea = props.alan || db.yuzolcumu || '';
                        const finalNitelik = props.nitelik || db.ana_tasinmaz_nitelik || '';
                        setVal('oznitelik:il', nextIl);
                        setVal('oznitelik:ilce', nextIlce);
                        setVal('oznitelik:mahalle', nextMahalle);
                        setVal('oznitelik:ada', finalAda);
                        setVal('oznitelik:parsel', finalParsel);
                        setVal('oznitelik:tapualani', formatAreaDisplay(finalArea));
                        setVal('oznitelik:nitelik', finalNitelik);
                        // Güncellenen alanları kırmızı göster
                        changedFields.forEach(f => {
                            const el = document.getElementById(f.id);
                            if (el) {
                                el.innerHTML = `<span class="text-danger">${escapeHtml(f.newVal ?? '')}</span>`;
                            }
                        });
                    } else {
                        setPopupStatus(updJson?.message || 'Güncelleme uygulanamadı.', 'warning');
                        statusSet = true;
                        await logPopupUpdateFail(updJson?.message || 'Güncelleme uygulanamadı', {
                            tapuId: db?.Id ?? db?.id,
                            mahalleId: mid,
                            ada: adaNo,
                            parsel: parselNo,
                            il: db?.il,
                            ilce: db?.ilce,
                            mahalle: db?.mahalle
                        });
                    }
                } catch (e) {
                    console.warn('update_tapu popup hata', e);
                    setPopupStatus('Güncelleme sırasında hata oluştu.', 'warning');
                    statusSet = true;
                    await logPopupUpdateFail('Güncelleme sırasında hata: ' + (e?.message || e), {
                        tapuId: db?.Id ?? db?.id,
                        mahalleId: mid,
                        ada: adaNo,
                        parsel: parselNo,
                        il: db?.il,
                        ilce: db?.ilce,
                        mahalle: db?.mahalle
                    });
                }
            }
        };

        // DB kaydını al
        const dbResp = await fetch(`api.php?action=find_tapu_by_location&mahalle_id=${encodeURIComponent(mid)}&ada=${encodeURIComponent(adaNo)}&parsel=${encodeURIComponent(parselNo)}`);
        const dbJson = await dbResp.json();
        if (!dbJson?.success || !dbJson.data) {
            setPopupStatus('Mevcut kayıt bulunamadı, kontrol yapılamadı.', 'warning');
            statusSet = true;
            await logPopupUpdateFail('Mevcut kayıt bulunamadı', {
                mahalleId: mid,
                ada: adaNo,
                parsel: parselNo
            });
            return;
        }

        const cachedTs = readTkgmTimestamp(cacheKey);
        if (cachedTs) {
            setPopupStatus('Son 1 saat içinde bu parsel için TKGM kontrolü yapılmış; Veriler güncel.', 'info');
            return;
        }

        // TKGM verisini al
        const tkResp = await fetch(`api.php?action=tkgm_parsel_proxy&mahalle_id=${encodeURIComponent(mid)}&ada=${encodeURIComponent(adaNo)}&parsel=${encodeURIComponent(parselNo)}`);
        const tkJson = await tkResp.json();
        if (!tkJson?.success || !tkJson.data) {
            setPopupStatus('TKGM yanıtı alınamadı (kontrol yapılamadı)', 'warning');
            statusSet = true;
            await logPopupUpdateFail('TKGM yanıtı alınamadı', {
                tapuId: dbJson?.data?.Id ?? dbJson?.data?.id,
                mahalleId: mid,
                ada: adaNo,
                parsel: parselNo,
                il: dbJson?.data?.il,
                ilce: dbJson?.data?.ilce,
                mahalle: dbJson?.data?.mahalle
            });
            return;
        }

        writeTkgmTimestamp(cacheKey);

        await processWithData(dbJson, tkJson);
    } catch (err) {
        console.warn('runPopupTkgmCheckInline hata', err);
        setPopupStatus('TKGM kontrolü sırasında hata oluştu.', 'warning');
        await logPopupUpdateFail('Genel hata: ' + (err?.message || err), {
            mahalleId: properties?.mahalleId ?? properties?.mahalle_id ?? null,
            ada: properties?.adaNo ?? properties?.ada ?? null,
            parsel: properties?.parselNo ?? properties?.parsel ?? null
        });
    }
    // Eğer yukarıda spesifik bir durum set edilmediyse spinner'ı kapat
    setTimeout(() => {
        const el = document.getElementById('popupTkgmStatus');
        if (el && el.innerHTML.includes('spinner-border')) {
            setPopupStatus('Kontrol tamamlandı.', 'muted');
        }
    }, 0);
}

async function autoQueueCurrentPopupProperty() {
    if (typeof currentPanel !== 'object' || !currentPanel || !currentPanel.properties) return;
    const propertyIdRaw = currentPanel.properties.id ?? currentPanel.properties.Id ?? currentPanel.properties.prolegal_id ?? currentPanel.properties.ProlegalId ?? '';
    const propertyId = String(propertyIdRaw).trim();
    if (!propertyId || autoQueuedPanelIds.has(propertyId) || autoQueueInProgress) return;
    const mahalleId = currentPanel.properties.mahalleId ?? currentPanel.properties.mahalle_id ?? '';
    const ada = currentPanel.properties.adaNo ?? currentPanel.properties.ada ?? '';
    const parsel = currentPanel.properties.parselNo ?? currentPanel.properties.parsel ?? '';
    const payload = new URLSearchParams();
    payload.append('action', 'add_to_query_queue');
    payload.append('property_ids', propertyId);
    autoQueueInProgress = true;
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload.toString()
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const limitPattern = /limit/i;
        const limitHit = limitPattern.test(data?.message || '') || Array.isArray(data?.errors) && data.errors.some(err => limitPattern.test(err || ''));
        if (data?.success) {
            autoQueuedPanelIds.add(propertyId);
            if (typeof TitleAlertMessage === 'function') {
                TitleAlertMessage(data?.message || 'Mevcut parsel sorgu sırasına eklendi', 'success', 4);
            }
        } else if (limitHit) {
            autoQueuedPanelIds.add(propertyId);
            if (typeof TitleAlertMessage === 'function') {
                TitleAlertMessage(data?.message || 'Sorgu limiti doldu', 'warning', 6);
            }
        } else {
            const combined = Array.isArray(data?.errors) && data.errors.length
                ? data.errors.join('; ')
                : data?.message || 'Sorgu sırasına eklenemedi';
            if (typeof TitleAlertMessage === 'function') {
                TitleAlertMessage(combined, 'danger', 6);
            }
        }
    } catch (error) {
        console.error('Otomatik sorgu hatası:', error);
        if (typeof TitleAlertMessage === 'function') {
            TitleAlertMessage('Sorgu sırasına eklenemedi (ağ hatası)', 'danger', 6);
        }
    } finally {
        autoQueueInProgress = false;
    }
}

// Scroll senkronizasyonu için global değişken
var isScrolling = false;

// Scroll bar genişlik senkronizasyonu
function syncScrollBarWidths() {
    const topScrollBar = document.querySelector('#top-scroll-bar');
    const bottomScrollBar = document.querySelector('#main-table-container');
    const topScrollContent = topScrollBar?.querySelector('div');
    
    if (topScrollBar && bottomScrollBar && topScrollContent) {
        // Ana tablo'nun scroll genişliğini al
        const bottomScrollWidth = bottomScrollBar.scrollWidth;
        const bottomClientWidth = bottomScrollBar.clientWidth;
        
        // Üst scroll bar'ın içeriğinin genişliğini ana tablo ile aynı yap
        topScrollContent.style.minWidth = bottomScrollWidth + 'px';
        
        console.log("🔧 Scroll genişlikleri senkronize edildi:");
        console.log("- Ana tablo scroll genişliği:", bottomScrollWidth);
        console.log("- Ana tablo client genişliği:", bottomClientWidth);
        console.log("- Üst scroll bar içerik genişliği:", topScrollContent.style.minWidth);
        
        // Scroll pozisyonlarını senkronize et
        topScrollBar.scrollLeft = bottomScrollBar.scrollLeft;
    }
}

// Scroll senkronizasyonu fonksiyonu
function syncScrollBars() {
    const topScrollBar = document.querySelector('#top-scroll-bar');
    const bottomScrollBar = document.querySelector('#main-table-container');
    
    console.log("🔍 Scroll senkronizasyonu başlatılıyor...");
    console.log("🔍 Üst scroll bar:", topScrollBar);
    console.log("🔍 Ana tablo container:", bottomScrollBar);
    
    if (topScrollBar && bottomScrollBar) {
        console.log("✅ Scroll bar'lar bulundu, senkronizasyon aktif ediliyor");
        
        // Önce genişlikleri senkronize et
        syncScrollBarWidths();
        
        // Önceki event listener'ları temizle
        topScrollBar.removeEventListener('scroll', handleTopScroll);
        bottomScrollBar.removeEventListener('scroll', handleBottomScroll);
        
        // Üst scroll bar'dan alt scroll bar'a senkronizasyon
        function handleTopScroll() {
            if (!isScrolling) {
                isScrolling = true;
                bottomScrollBar.scrollLeft = topScrollBar.scrollLeft;
                console.log("🔍 Üst scroll bar hareket etti:", topScrollBar.scrollLeft);
                setTimeout(() => { isScrolling = false; }, 10);
            }
        }
        
        // Alt scroll bar'dan üst scroll bar'a senkronizasyon
        function handleBottomScroll() {
            if (!isScrolling) {
                isScrolling = true;
                topScrollBar.scrollLeft = bottomScrollBar.scrollLeft;
                console.log("🔍 Ana tablo scroll hareket etti:", bottomScrollBar.scrollLeft);
                setTimeout(() => { isScrolling = false; }, 10);
            }
        }
        
        // Event listener'ları ekle
        topScrollBar.addEventListener('scroll', handleTopScroll);
        bottomScrollBar.addEventListener('scroll', handleBottomScroll);
        
        console.log("✅ Scroll senkronizasyon event listener'ları eklendi");
    } else {
        console.log("❌ Scroll bar'lar bulunamadı - Top:", topScrollBar, "Bottom:", bottomScrollBar);
    }
}

// Sayfa yüklendiğinde scroll senkronizasyonunu başlat
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(syncScrollBars, 1000); // 1 saniye bekle ki tablo yüklensin
});

// Liste tab'ı aktif olduğunda scroll senkronizasyonunu başlat
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'nav-liste-tab') {
        console.log("🔍 Liste tab'ı tıklandı, scroll senkronizasyonu başlatılıyor...");
        setTimeout(syncScrollBars, 500); // Liste tab'ı aktif olduğunda scroll senkronizasyonunu başlat
    }
});

// Bootstrap tab change event'i için
document.addEventListener('shown.bs.tab', function(e) {
    if (e.target && e.target.id === 'nav-liste-tab') {
        console.log("🔍 Liste tab'ı gösterildi, scroll senkronizasyonu başlatılıyor...");
        setTimeout(syncScrollBars, 300);
    }
});

// Tablo verisi yüklendiğinde scroll senkronizasyonunu başlat
window.addEventListener('SETMAP_FIELD', function() {
    setTimeout(() => {
        syncScrollBars();
        // Veri yüklendikten sonra genişlikleri tekrar senkronize et
        setTimeout(syncScrollBarWidths, 200);
    }, 500);
});

// Window resize olduğunda genişlikleri yeniden senkronize et
window.addEventListener('resize', function() {
    setTimeout(syncScrollBarWidths, 100);
});

// Scroll test fonksiyonu - geliştirme amaçlı
window.testScrollFunctionality = function() {
    console.log("🧪 Scroll fonksiyonalitesi test ediliyor...");
    
    const topScrollBar = document.querySelector('#top-scroll-bar');
    const bottomScrollBar = document.querySelector('#main-table-container');
    
    console.log("🧪 Test sonuçları:");
    console.log("- Üst scroll bar:", topScrollBar ? "✅ Bulundu" : "❌ Bulunamadı");
    console.log("- Ana tablo container:", bottomScrollBar ? "✅ Bulundu" : "❌ Bulunamadı");
    
    if (topScrollBar && bottomScrollBar) {
        console.log("- Üst scroll bar scrollWidth:", topScrollBar.scrollWidth);
        console.log("- Üst scroll bar clientWidth:", topScrollBar.clientWidth);
        console.log("- Ana tablo scrollWidth:", bottomScrollBar.scrollWidth);
        console.log("- Ana tablo clientWidth:", bottomScrollBar.clientWidth);
        console.log("- Ana tablo scrollHeight:", bottomScrollBar.scrollHeight);
        console.log("- Ana tablo clientHeight:", bottomScrollBar.clientHeight);
        
        // Scroll test
        if (bottomScrollBar.scrollHeight > bottomScrollBar.clientHeight) {
            console.log("✅ Dikey scroll aktif - içerik yüksekliği:", bottomScrollBar.scrollHeight, "> container yüksekliği:", bottomScrollBar.clientHeight);
        } else {
            console.log("⚠️ Dikey scroll gerekli değil - içerik yüksekliği:", bottomScrollBar.scrollHeight, "<= container yüksekliği:", bottomScrollBar.clientHeight);
        }
        
        if (bottomScrollBar.scrollWidth > bottomScrollBar.clientWidth) {
            console.log("✅ Yatay scroll aktif - içerik genişliği:", bottomScrollBar.scrollWidth, "> container genişliği:", bottomScrollBar.clientWidth);
        } else {
            console.log("⚠️ Yatay scroll gerekli değil - içerik genişliği:", bottomScrollBar.scrollWidth, "<= container genişliği:", bottomScrollBar.clientWidth);
        }
    }
    
    // Senkronizasyon test
    syncScrollBars();
    
    // Genişlik senkronizasyon test
    setTimeout(() => {
        console.log("🧪 Genişlik senkronizasyonu test ediliyor...");
        syncScrollBarWidths();
    }, 100);
};

// --- createAndLinkBtn için global fonksiyon - DOSYANIN BAŞINDA ---
window.createCompanyAndLinkProperty = async function () {
    try {
        console.log("🚀 createCompanyAndLinkProperty START");

        const manualInput = document.getElementById('newCompanyManualInput');
        const companyName = manualInput?.value?.trim();
        if (!companyName) {
            alert("⚠️ Lütfen bir şirket adı girin.");
            console.log("⛔ companyName yok");
            return;
        }

        const propertyId = document.getElementById('oznitelik:id')?.textContent;
        if (!propertyId) {
            alert("⚠️ PropertyId bulunamadı.");
            console.log("⛔ propertyId yok");
            return;
        }

        // 1) Şirket oluştur
        console.log("📡 add_company POST:", { company_name: companyName });
        const fd = new FormData();
        fd.append('action', 'add_company');
        fd.append('company_name', companyName);

        const r1 = await fetch('api.php', { method: 'POST', body: fd });
        const j1 = await r1.json();
        console.log("📡 add_company RESULT:", j1);

        if (!j1?.success || !j1?.id) {
            alert("❌ Şirket eklenemedi");
            return;
        }
        const companyId = j1.id;

        // 2) Araziyi şirkete bağla
        if (typeof window.addPropertyToCompanyDirect === 'function') {
            console.log("📡 addPropertyToFirm POST:", { firmId: companyId, parcelKey: propertyId });
            await window.addPropertyToCompanyDirect(propertyId, companyId, companyName);
        } else {
            console.error("⛔ addPropertyToCompanyDirect globalde yok!");
            alert("❌ addPropertyToCompanyDirect bulunamadı");
            return;
        }

        // 3) UI temizliği
        manualInput.value = "";
        console.log("✅ BİTTİ: şirket kuruldu + arazi ilişkilendi");
    } catch (err) {
        console.error("💥 HATA createCompanyAndLinkProperty:", err);
        alert("❌ Hata: " + (err?.message || err));
    }
};

console.log("🔍 Global scope test (dosya başı):", typeof window.createCompanyAndLinkProperty);

// --- createAndLinkBtn event delegation - DOSYANIN BAŞINDA ---
document.addEventListener('click', function(e) {
    if (e.target.closest('#createAndLinkBtn')) {
        console.log("🟡 createAndLinkBtn CLICK (event delegation)");
        if (typeof window.createCompanyAndLinkProperty === 'function') {
            window.createCompanyAndLinkProperty();
        } else {
            console.error("⛔ createCompanyAndLinkProperty globalde yok!");
        }
    }
});

// Global variable to store auto-close timeout
let autoCloseTimeout = null;

// Modern Modal State
let modernModalState = {
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0,
    isMinimized: false,
    isMaximized: false,
    originalSize: { width: 800, height: 600, left: 0, top: 0 },
    currentResizeDirection: ''
};

// Simple minimize button event listener

/** modal dots menu constructor */


// Modal dots menu - güvenli erişim (opsiyonel element)
function initializeDotsMenu() {
    const dotsMenuElement = document.querySelector('#modal-dots-menu');
    if (dotsMenuElement) {
        const dotsMenu = dotsMenuElement.querySelectorAll('li a');
        dotsMenu.forEach(dotMenuAction);
    }
}

// DOM yüklendikten sonra başlat
document.addEventListener('DOMContentLoaded', initializeDotsMenu);

function dotMenuAction(item) {
    item.addEventListener('click', dotMenuClick);
}

function dotMenuClick() {
    dotsMenu.forEach(item => {
        if (item != this) {
            const b = document.querySelector("#modal-dots-tabs " + item.dataset.container);
            if (!b.classList.contains('d-none')) {
                b.classList.add('d-none');
            }

            item.classList.remove('active');
        }
    })
    const title = this.textContent;
    const target = this.dataset.container;
    const element = document.querySelector("#modal-dots-tabs " + target);
    element.classList.remove('d-none');
    element.style.display = 'block';
    if (!this.classList.contains('active')) {
        this.classList.add('active');
    }

    if (this.dataset.container == '#ortofoto') {
        ortofoto_update();
    }

    if (this.dataset.container == '#baglidetaylar') {
        baglidetaylar_update();
    }

    const titleElement = document.querySelector('#info-modal-title');
    if (titleElement) {
        titleElement.textContent = title;
    } else {
        console.warn('⚠️ #info-modal-title elementi bulunamadı');
    }
}





// Modal scroll temizleme fonksiyonu
function cleanModalInlineStyles() {
    const elements = [
        '#modal-dots-tabs',
        '.modern-tab-content', 
        '.modern-tab-pane',
        '.modern-scrollable-content',
        '#info-oznitelik'
    ];
    
    elements.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            el.style.removeProperty('height');
            el.style.removeProperty('max-height');
            el.style.removeProperty('overflow');
            el.style.removeProperty('overflow-y');
            el.style.removeProperty('overflow-x');
        }
    });
}

// Dev scroll logger (sadece __DEV_SCROLL_LOG true ise çalışır)
function logModalScrollHeights() {
    if (!window.__DEV_SCROLL_LOG) return;
    
    const selectors = ['.modal-body', '#modal-dots-tabs', '#info-oznitelik'];
    selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        console.log(sel, {
            clientHeight: el.clientHeight, 
            scrollHeight: el.scrollHeight,
            hasScroll: el.scrollHeight > el.clientHeight
        });
    });
}

function modal(selector, state) {
    const select = document.querySelector(selector);

    if (!select) {
        console.error(select, 'not found in dom[MODAL ERROR]');
        return;
    }

    const instance = bootstrap.Modal.getOrCreateInstance(
        select, {
            backdrop: true,
            keyboard: true
        }
    );

    if (state) {
        instance.show();
        // Initialize simple minimize after showing
        if (selector === '#info-modal') {
            console.log('🔧 Modal opening: #info-modal');
            // Modal açıldığında her zaman normal gelmesi için
            isMinimized = false;
            const modal = document.getElementById('info-modal-dialog');
            console.log('🔧 Modal element found:', modal);
            if (modal) {
                modal.classList.remove('minimized');
                modal.style.top = '';
                modal.style.left = '';
                modal.style.transform = '';
            }
            
            // Modal açıldıktan sonra inline style'ları temizle
            setTimeout(() => {
                cleanModalInlineStyles();
                logModalScrollHeights();
            }, 100);
            
            // Modal açıldığında sağ paneli otomatik açma - sadece toggle butonu ile açılsın
            setTimeout(() => {
                console.log('🔧 Initializing modal systems...');
                initializeSimpleMinimize();
                // Modern modal sistemini de initialize et
                initializeModernModal();
            }, 100);
        }
    } else {
        instance.hide();
        // Modal kapatıldığında küçük başlık çubuğunu da temizle
        if (selector === '#info-modal') {
            hideMinimizedBar();
            isMinimized = false;
            // Modal'ı normale döndür
            const modal = document.getElementById('info-modal-dialog');
            if (modal) {
                modal.classList.remove('minimized');
                modal.style.top = '';
                modal.style.left = '';
                modal.style.transform = '';
            }
            
            // Modal kapatıldığında sağ paneli otomatik kapatma - sadece toggle butonu ile kapatılsın
        }
    }
}

// ===== SIMPLE MINIMIZE FUNCTIONALITY =====
// isMinimized yukarıda tanımlandı

function initializeSimpleMinimize() {
    const modal = document.getElementById('info-modal-dialog');
    const header = document.getElementById('info-modal-header');
    
    if (!modal || !header) return;
    
    // Normal modal için sürükleme özelliği ekle
    enableModalDragging(modal, header);
}

// Modal sürükleme - eski sistem gibi basit yaklaşım
function enableModalDragging(modal, header) {
    if (!modal || !header) return;
    
    console.log('Enabling modal dragging...', modal, header);
    
    // Header'a cursor stili ekle - eski sistem gibi
    header.style.cursor = 'move';
    
    let isDragging = false;
    let offsetX, offsetY;
    
    // Header'dan sürükleme - eski sistem gibi
    header.addEventListener('mousedown', (e) => {
        console.log('Header mousedown - starting drag');
        isDragging = true;
        
        // Mouse ile modal arasındaki farkı al
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Global mouse event'leri
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            console.log('Dragging...', e.clientX, e.clientY);
            console.log('Modal before:', modal.style.position, modal.style.left, modal.style.top);
            
            // CSS !important kurallarını geçersiz kıl
            modal.style.setProperty('position', 'absolute', 'important');
            modal.style.setProperty('margin', '0', 'important');
            modal.style.setProperty('left', (e.clientX - offsetX) + 'px', 'important');
            modal.style.setProperty('top', (e.clientY - offsetY) + 'px', 'important');
            modal.style.setProperty('transform', 'none', 'important');
            
            console.log('Modal after:', modal.style.position, modal.style.left, modal.style.top);
            console.log('Modal computed style:', window.getComputedStyle(modal).position, window.getComputedStyle(modal).left, window.getComputedStyle(modal).top);
        };
        
        const handleMouseUp = () => {
            console.log('Mouse up - stopping drag');
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.preventDefault();
        e.stopPropagation();
    });
}

function toggleSimpleMinimize() {
    console.log('toggleSimpleMinimize called');
    const modal = document.getElementById('info-modal-dialog');
    
    if (!modal) {
        console.error('Modal not found!');
        return;
    }
    
    isMinimized = !isMinimized;
    console.log('isMinimized:', isMinimized);
    
    if (isMinimized) {
        // Modal'a minimized class'ı eklendi
        modal.classList.add('minimized');
        
        // En alta yapışık buton modunu etkinleştir
        modal.classList.add('bottom-button');
        
        // En alta yerleştir
        modal.style.bottom = '20px';
        modal.style.left = '50%';
        modal.style.top = 'auto';
        modal.style.transform = 'translateX(-50%)';
        
        // Sürükleme özelliğini devre dışı bırak (buton modunda)
        disableMinimizedDragging(modal);
        
        // Modal'ı fixed position yap
        modal.style.position = 'fixed';
        
        // En alta yapışık butona tıklama event listener ekle
        modal.addEventListener('click', function() {
            if (isMinimized && modal.classList.contains('bottom-button')) {
                toggleSimpleMinimize();
            }
        });
        
        // Backdrop'ları kaldır
        const allBackdrops = document.querySelectorAll('.modal-backdrop');
        allBackdrops.forEach(b => b.remove());
        
        // Body'den modal class'larını kaldır
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.style.pointerEvents = '';
        
        // Modal'ın backdrop'ını tamamen kaldır
        const modalElement = document.getElementById('info-modal');
        if (modalElement) {
            modalElement.classList.remove('show');
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
            modalElement.removeAttribute('role');
            modalElement.style.background = 'none';
            modalElement.style.backdropFilter = 'none';
            modalElement.style.pointerEvents = 'none';
        }
        
        // Tüm backdrop elementlerini kaldır
        setTimeout(() => {
            const remainingBackdrops = document.querySelectorAll('.modal-backdrop');
            remainingBackdrops.forEach(b => b.remove());
            
            // Body'yi tamamıyla serbest bırak
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
            document.body.classList.remove('modal-open');
        }, 100);
        
        btn.classList.add('active');
        btn.innerHTML = '<i class="bi bi-plus"></i>';
        btn.title = 'Büyüt';
        
        console.log('Modal minimized to toolbar size');
    } else {
        // Modal'dan minimized class'ını kaldır
        modal.classList.remove('minimized');
        modal.classList.remove('bottom-button');
        
        // Sürükleme özelliğini devre dışı bırak
        disableMinimizedDragging(modal);
        
        // Modal'ı merkeze geri yerleştir
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.bottom = '';
        modal.style.transform = 'translate(-50%, -50%)';
        
        // Modal'ı tekrar Bootstrap modal olarak ayarla
        const modalElement = document.getElementById('info-modal');
        if (modalElement) {
            modalElement.classList.add('show');
            modalElement.setAttribute('aria-modal', 'true');
            modalElement.setAttribute('role', 'dialog');
            modalElement.setAttribute('aria-hidden', 'false');
        }
        
        // Body'ye modal class'larını geri ekle
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        
        btn.classList.remove('active');
        btn.innerHTML = '<i class="bi bi-dash"></i>';
        btn.title = 'Küçült';
        
        console.log('Modal restored to normal size');
    }
}

function showMinimizedBar() {
    // Küçük başlık çubuğunu oluştur
    let minimizedBar = document.getElementById('minimized-bar');
    if (!minimizedBar) {
        minimizedBar = document.createElement('div');
        minimizedBar.id = 'minimized-bar';
        minimizedBar.className = 'minimized-bar';
        minimizedBar.innerHTML = `
            <div class="minimized-content">
                <span class="minimized-title">Öz Nitelik Bilgisi</span>
                <button class="minimized-btn" onclick="toggleSimpleMinimize()">
                    <i class="bi bi-plus"></i>
                </button>
            </div>
        `;
        document.body.appendChild(minimizedBar);
    }
    
    // Güçlü şekilde göster
    minimizedBar.style.display = 'block';
    minimizedBar.style.visibility = 'visible';
    minimizedBar.style.opacity = '1';
    minimizedBar.style.zIndex = '9999';
    
    console.log('Minimized bar shown:', minimizedBar);
}

function hideMinimizedBar() {
    const minimizedBar = document.getElementById('minimized-bar');
    if (minimizedBar) {
        minimizedBar.style.display = 'none';
    }
}

// ===== MINIMIZED DRAGGING FUNCTIONS =====
let minimizedDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
};

function enableMinimizedDragging(modal) {
    const header = modal.querySelector('.modal-header');
    if (!header) return;
    
    // Header'a sürüklenebilir sınıf (class) ekle
    header.classList.add('draggable-header');
    
    // Sürükleme event listener'larını ekle
    header.addEventListener('mousedown', startMinimizedDrag);
    
    // Global mouse event'leri - sadece bir kez ekle
    if (!window.minimizedDragListenersAdded) {
        document.addEventListener('mousemove', handleMinimizedDrag);
        document.addEventListener('mouseup', endMinimizedDrag);
        window.minimizedDragListenersAdded = true;
    }
}

function disableMinimizedDragging(modal) {
    const header = modal.querySelector('.modal-header');
    if (!header) return;
    
    // Header'dan sürüklenebilir class'ı kaldır
    header.classList.remove('draggable-header');
    
    // Sürükleme event listener'larını kaldır
    header.removeEventListener('mousedown', startMinimizedDrag);
    document.removeEventListener('mousemove', handleMinimizedDrag);
    document.removeEventListener('mouseup', endMinimizedDrag);
}

function startMinimizedDrag(e) {
    // Sadece minimize edilmiş modal'da çalışsın
    const modal = document.getElementById('info-modal-dialog');
    if (!modal.classList.contains('minimized')) return;
    
    
    minimizedDragState.isDragging = true;
    minimizedDragState.startX = e.clientX;
    minimizedDragState.startY = e.clientY;
    
    const rect = modal.getBoundingClientRect();
    minimizedDragState.startLeft = rect.left;
    minimizedDragState.startTop = rect.top;
    
    modal.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
}

function handleMinimizedDrag(e) {
    if (!minimizedDragState.isDragging) return;
    
    const modal = document.getElementById('info-modal-dialog');
    const deltaX = e.clientX - minimizedDragState.startX;
    const deltaY = e.clientY - minimizedDragState.startY;
    
    const newLeft = minimizedDragState.startLeft + deltaX;
    const newTop = minimizedDragState.startTop + deltaY;
    
    // Ekran sınırları içinde tutmalı
    const maxLeft = window.innerWidth - modal.offsetWidth;
    const maxTop = window.innerHeight - modal.offsetHeight;
    
    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
    
    modal.style.left = constrainedLeft + 'px';
    modal.style.top = constrainedTop + 'px';
    modal.style.transform = 'none';
}

function endMinimizedDrag() {
    if (!minimizedDragState.isDragging) return;
    
    const modal = document.getElementById('info-modal-dialog');
    minimizedDragState.isDragging = false;
    modal.style.cursor = 'grab';
    
    // Pozisyonu kaydet
    saveMinimizedPosition(modal.style.left, modal.style.top);
}

// ===== POSITION SAVE/LOAD FUNCTIONS =====
function saveMinimizedPosition(left, top) {
    const position = {
        left: left,
        top: top,
        timestamp: Date.now()
    };
    localStorage.setItem('minimizedModalPosition', JSON.stringify(position));
}

function loadMinimizedPosition() {
    try {
        const saved = localStorage.getItem('minimizedModalPosition');
        if (!saved) return null;
        
        const position = JSON.parse(saved);
        return {
            left: position.left,
            top: position.top
        };
    } catch (e) {
        console.error('Error loading minimized position:', e);
        return null;
    }
}

function initializeDraggableModal() {
    const modal = document.getElementById('info-modal-dialog');
    const header = document.getElementById('info-modal-header');
    const content = document.getElementById('info-modal-content');
    
    if (!modal || !header || !content) return;

    // Reset modal state to default (not minimized)
    modalState.isMinimized = false;
    modalState.isTransparent = false;
    modalState.isHidden = false;
    modalState.isPinned = false;
    modalState.isAlwaysTop = false;

    // Remove any existing state classes
    modal.classList.remove('modal-minimized', 'modal-transparent', 'modal-hidden', 'modal-pinned', 'modal-always-top');

    // Add resize handles
    // addResizeHandles(content); // Disabled - using modern resize handles

    // Add event listeners
    addModalEventListeners(modal, header, content);

    // Don't apply saved state on first open - start fresh
    console.log('Modal initialized in normal state');
}

function addResizeHandles(content) {
    const handles = [
        { class: 'resize-handle-n', cursor: 'n-resize' },
        { class: 'resize-handle-s', cursor: 's-resize' },
        { class: 'resize-handle-e', cursor: 'e-resize' },
        { class: 'resize-handle-w', cursor: 'w-resize' },
        { class: 'resize-handle-ne', cursor: 'ne-resize' },
        { class: 'resize-handle-nw', cursor: 'nw-resize' },
        { class: 'resize-handle-se', cursor: 'se-resize' },
        { class: 'resize-handle-sw', cursor: 'sw-resize' }
    ];

    handles.forEach(handle => {
        const handleEl = document.createElement('div');
        handleEl.className = `resize-handle ${handle.class}`;
        handleEl.style.cursor = handle.cursor;
        content.appendChild(handleEl);
    });
}

function addModalEventListeners(modal, header, content) {
    console.log('🔧 Adding modal event listeners...');
    console.log('🔧 Modal:', modal);
    console.log('🔧 Header:', header);
    console.log('🔧 Content:', content);
    
    // Resize handle'ları kontrol et
    const resizeHandles = modal.querySelectorAll('.modern-resize-handle');
    console.log('🔧 Resize handles found:', resizeHandles.length);
    resizeHandles.forEach((handle, index) => {
        console.log(`🔧 Handle ${index}:`, handle.className);
    });
    
    // Drag functionality - DISABLED
    // header.addEventListener('mousedown', (e) => {
    //     if (e.target.closest('.modal-controls') || e.target.closest('.btn-group')) return;
    //     
    //     modalState.isDragging = true;
    //     modalState.startX = e.clientX;
    //     modalState.startY = e.clientY;
    //     modalState.startLeft = parseInt(getComputedStyle(modal).left);
    //     modalState.startTop = parseInt(getComputedStyle(modal).top);
    //     
    //     modal.classList.add('dragging');
    //     e.preventDefault();
    // });

    // Resize functionality - DISABLED (using modern system)
    // modal.addEventListener('mousedown', (e) => {
    //     console.log('🔧 Mouse down event:', e.target.className);
    //     if (e.target.classList.contains('modern-resize-handle')) {
    //         console.log('🔧 Modern resize handle clicked:', e.target.className);
    //         modalState.isResizing = true;
    //         modalState.startX = e.clientX;
    //         modalState.startY = e.clientY;
    //         modalState.startWidth = parseInt(getComputedStyle(modal).width);
    //         modalState.startHeight = parseInt(getComputedStyle(modal).height);
    //         modalState.startLeft = parseInt(getComputedStyle(modal).left);
    //         modalState.startTop = parseInt(getComputedStyle(modal).top);
    //         
    //         // Resize direction'ı belirle
    //         modalState.resizeDirection = e.target.className.split(' ')[1]; // nw, ne, sw, se, n, s, w, e
    //         console.log('🔧 Resize direction:', modalState.resizeDirection);
    //         
    //         modal.classList.add('resizing');
    //         e.preventDefault();
    //     }
    // });

    // Global mouse events
    document.addEventListener('mousemove', (e) => {
        if (modalState.isDragging) {
            const deltaX = e.clientX - modalState.startX;
            const deltaY = e.clientY - modalState.startY;
            
            const newLeft = modalState.startLeft + deltaX;
            const newTop = modalState.startTop + deltaY;
            
            // Snap to edges
            const snapped = snapToEdges(newLeft, newTop, modal);
            if (!snapped) {
                modal.style.left = newLeft + 'px';
                modal.style.top = newTop + 'px';
                modal.style.transform = 'none';
            }
        }
        
        // Resize handling - DISABLED (using modern system)
        // if (modalState.isResizing) {
        //     console.log('🔧 Resizing...', modalState.isResizing);
        //     const deltaX = e.clientX - modalState.startX;
        //     const deltaY = e.clientY - modalState.startY;
        //     
        //     let newWidth = modalState.startWidth;
        //     let newHeight = modalState.startHeight;
        //     let newLeft = modalState.startLeft;
        //     let newTop = modalState.startTop;
        //     
        //     // Resize based on direction
        //     if (modalState.resizeDirection.includes('e')) {
        //         newWidth = Math.max(300, Math.min(1200, modalState.startWidth + deltaX));
        //     }
        //     if (modalState.resizeDirection.includes('w')) {
        //         newWidth = Math.max(300, Math.min(1200, modalState.startWidth - deltaX));
        //         newLeft = modalState.startLeft + deltaX;
        //     }
        //     if (modalState.resizeDirection.includes('s')) {
        //         newHeight = Math.max(200, Math.min(800, modalState.startHeight + deltaY));
        //     }
        //     if (modalState.resizeDirection.includes('n')) {
        //         newHeight = Math.max(200, Math.min(800, modalState.startHeight - deltaY));
        //         newTop = modalState.startTop + deltaY;
        //     }
        //     
        //     console.log('🔧 New dimensions:', { newWidth, newHeight, newLeft, newTop });
        //     
        //     modal.style.width = newWidth + 'px';
        //     modal.style.height = newHeight + 'px';
        //     modal.style.left = newLeft + 'px';
        //     modal.style.top = newTop + 'px';
        //     modal.style.transform = 'none';
        //     modal.style.position = 'fixed';
        // }
    });

    document.addEventListener('mouseup', () => {
        if (modalState.isDragging) { // Removed || modalState.isResizing
            modalState.isDragging = false;
            modal.classList.remove('dragging');
        }
        // modalState.isResizing = false; // Handled by modern system
        // modal.classList.remove('resizing'); // Handled by modern system
        saveModalState();
    });

    // Control buttons

    // Minimize edilen modal'ın header'ına tıklanabilir özellik
    header.addEventListener('click', (e) => {
        if (modal.classList.contains('modal-minimized') && !e.target.closest('.modal-controls')) {
            toggleMinimize();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('show')) {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                toggleMinimize();
            }
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                toggleResize();
            }
            if (e.key === ' ') {
                e.preventDefault();
                toggleHide();
            }
        }
    });
}

function snapToEdges(left, top, modal) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const modalWidth = parseInt(getComputedStyle(modal).width);
    const modalHeight = parseInt(getComputedStyle(modal).height);
    
    let snapped = false;
    
    // Snap to left edge
    if (left < 50) {
        modal.classList.add('modal-snapped-left');
        modal.classList.remove('modal-snapped-right');
        snapped = true;
    }
    // Snap to right edge
    else if (left > windowWidth - modalWidth - 50) {
        modal.classList.add('modal-snapped-right');
        modal.classList.remove('modal-snapped-left');
        snapped = true;
    }
    // Snap to top edge
    if (top < 50) {
        modal.classList.add('modal-snapped-top');
        modal.classList.remove('modal-snapped-bottom');
        snapped = true;
    }
    // Snap to bottom edge
    else if (top > windowHeight - modalHeight - 50) {
        modal.classList.add('modal-snapped-bottom');
        modal.classList.remove('modal-snapped-top');
        snapped = true;
    }
    
    return snapped;
}

function toggleMinimize() {
    const modal = document.getElementById('info-modal-dialog');
    
    modalState.isMinimized = !modalState.isMinimized;
    
    if (modalState.isMinimized) {
        modal.classList.add('modal-minimized');
        // Hızlı geçiş için transition'ı kaldır
        modal.style.transition = 'none';
        setTimeout(() => {
            modal.style.transition = '';
        }, 100);
    } else {
        modal.classList.remove('modal-minimized');
        // Hızlı geçiş için transition'ı kaldır
        modal.style.transition = 'none';
        setTimeout(() => {
            modal.style.transition = '';
        }, 100);
    }
    
    saveModalState();
}

function toggleTransparent() {
    const modal = document.getElementById('info-modal-dialog');
    const btn = document.getElementById('modal-transparent-btn');
    
    modalState.isTransparent = !modalState.isTransparent;
    
    if (modalState.isTransparent) {
        modal.classList.add('modal-transparent');
        btn.classList.add('active');
    } else {
        modal.classList.remove('modal-transparent');
        btn.classList.remove('active');
    }
    
    saveModalState();
}

function togglePin() {
    const modal = document.getElementById('info-modal-dialog');
    const btn = document.getElementById('modal-pin-btn');
    
    modalState.isPinned = !modalState.isPinned;
    
    if (modalState.isPinned) {
        modal.classList.add('modal-pinned');
        btn.classList.add('active');
    } else {
        modal.classList.remove('modal-pinned');
        btn.classList.remove('active');
    }
    
    saveModalState();
}

function toggleAlwaysTop() {
    const modal = document.getElementById('info-modal-dialog');
    const btn = document.getElementById('modal-always-top-btn');
    
    modalState.isAlwaysTop = !modalState.isAlwaysTop;
    
    if (modalState.isAlwaysTop) {
        modal.classList.add('modal-always-top');
        btn.classList.add('active');
    } else {
        modal.classList.remove('modal-always-top');
        btn.classList.remove('active');
    }
    
    saveModalState();
}

function toggleHide() {
    const modal = document.getElementById('info-modal-dialog');
    const btn = document.getElementById('modal-hide-btn');
    
    modalState.isHidden = !modalState.isHidden;
    
    if (modalState.isHidden) {
        modal.classList.add('modal-hidden');
        btn.classList.add('active');
    } else {
        modal.classList.remove('modal-hidden');
        btn.classList.remove('active');
    }
    
    saveModalState();
}

function toggleResize() {
    const modal = document.getElementById('info-modal-dialog');
    const currentWidth = parseInt(getComputedStyle(modal).width);
    const currentHeight = parseInt(getComputedStyle(modal).height);
    
    if (currentWidth < 600) {
        modal.style.width = '800px';
        modal.style.height = '600px';
    } else {
        modal.style.width = '400px';
        modal.style.height = '300px';
    }
    
    saveModalState();
}

function saveModalState() {
    const modal = document.getElementById('info-modal-dialog');
    if (!modal) return;
    
    const state = {
        position: {
            left: modal.style.left || '50%',
            top: modal.style.top || '50%',
            transform: modal.style.transform || 'translate(-50%, -50%)'
        },
        size: {
            width: modal.style.width || 'auto',
            height: modal.style.height || 'auto'
        },
        states: {
            minimized: modalState.isMinimized,
            transparent: modalState.isTransparent,
            pinned: modalState.isPinned,
            alwaysTop: modalState.isAlwaysTop,
            hidden: modalState.isHidden
        }
    };
    
    localStorage.setItem('modalState', JSON.stringify(state));
}

function loadModalState() {
    const saved = localStorage.getItem('modalState');
    if (!saved) return;
    
    try {
        const state = JSON.parse(saved);
        
        // Apply position and size
        if (state.position) {
            const modal = document.getElementById('info-modal-dialog');
            modal.style.left = state.position.left;
            modal.style.top = state.position.top;
            modal.style.transform = state.position.transform;
        }
        
        if (state.size) {
            const modal = document.getElementById('info-modal-dialog');
            if (state.size.width !== 'auto') modal.style.width = state.size.width;
            if (state.size.height !== 'auto') modal.style.height = state.size.height;
        }
        
        // Apply states
        if (state.states) {
            modalState.isMinimized = state.states.minimized || false;
            modalState.isTransparent = state.states.transparent || false;
            modalState.isPinned = state.states.pinned || false;
            modalState.isAlwaysTop = state.states.alwaysTop || false;
            modalState.isHidden = state.states.hidden || false;
        }
    } catch (e) {
        console.error('Error loading modal state:', e);
    }
}

function applyModalState() {
    const modal = document.getElementById('info-modal-dialog');
    if (!modal) return;
    
    if (modalState.isMinimized) {
        modal.classList.add('modal-minimized');
    }
    
    if (modalState.isTransparent) {
        modal.classList.add('modal-transparent');
        document.getElementById('modal-transparent-btn')?.classList.add('active');
    }
    
    if (modalState.isPinned) {
        modal.classList.add('modal-pinned');
        document.getElementById('modal-pin-btn')?.classList.add('active');
    }
    
    if (modalState.isAlwaysTop) {
        modal.classList.add('modal-always-top');
        document.getElementById('modal-always-top-btn')?.classList.add('active');
    }
    
    if (modalState.isHidden) {
        modal.classList.add('modal-hidden');
        document.getElementById('modal-hide-btn')?.classList.add('active');
    }
}


function viewPanel(view) {
    const panels = ['#oznitelik', '#koordinatlistesi', '#rota', '#ortofoto', '#baglidetaylar'];

    panels.forEach((p) => {
        if (view == p) {
            document.querySelector(p).classList.remove('d-none');
        } else {
            if (!document.querySelector(p).classList.contains('d-none')) {
                document.querySelector(p).classList.add('d-none');
            }
        }
    })
}
//modal("#modal-olcum", true);

// Değişkenler yukarıda tanımlandı

function setPanel(data) {
    const isFreshReload = data?.__freshLoaded === true;
    // Güncel kayıt varsa propertyData'dan al (modal yeniden açıldığında eski detayı göstermesin)
    try {
        const incomingId = data?.properties?.id;
        const dataStore = Array.isArray(window.propertyData)
            ? window.propertyData
            : (typeof propertyData !== 'undefined' && Array.isArray(propertyData) ? propertyData : null);
        if (incomingId && dataStore) {
            const latest = dataStore.find(item => item?.data?.properties?.id == incomingId);
            if (latest?.data?.properties) {
                data = {
                    ...data,
                    properties: {
                        ...data.properties,
                        ...latest.data.properties
                    }
                };
                console.log('🔄 setPanel verisi propertyData ile senkronize edildi:', incomingId);
            }
        }
    } catch (e) {
        console.warn('⚠️ setPanel senkronizasyon hatası:', e);
    }

    // Modal açıldığında ilgili kaydı backend'den tazele (sayfa yenilemeden güncel not/rating için)
    try {
        const prolegalId = data?.properties?.id;
        if (prolegalId && !isFreshReload) {
            const refreshUrl = `api.php?prolegalId=${encodeURIComponent(prolegalId)}&_=${Date.now()}`;
            fetch(refreshUrl, { cache: 'no-store' })
                .then(resp => resp.json())
                .then(json => {
                    const freshItem = Array.isArray(json)
                        ? json.find(it => it?.status === 200 && it?.data?.properties?.id == prolegalId)
                        : null;
                    if (freshItem?.data?.properties) {
                        // Global store'u güncelle
                        try {
                            const stores = [];
                            if (window.propertyData && Array.isArray(window.propertyData)) stores.push(window.propertyData);
                            if (typeof propertyData !== 'undefined' && Array.isArray(propertyData)) stores.push(propertyData);
                            stores.forEach(store => {
                                const match = store.find(item => item?.data?.properties?.id == prolegalId);
                                if (match?.data?.properties) {
                                    match.data.properties = { ...match.data.properties, ...freshItem.data.properties };
                                }
                            });
                        } catch (e) {
                            console.warn('⚠️ propertyData güncelleme hatası (fresh fetch):', e);
                        }

                        // UI'yı tazelenmiş veriyle tekrar kur, döngüden kaçınmak için flag ver
                        setPanel({
                            ...freshItem.data,
                            __freshLoaded: true
                        });
                        return;
                    }
                })
                .catch(err => console.warn('⚠️ Modal açılışında taze veri çekilemedi:', err));
        }
    } catch (e) {
        console.warn('⚠️ setPanel fresh fetch hatası:', e);
    }

    currentPanel = data;
    // Prolegal not textarea flag'ini sıfırla (modal açıldığında)
    window.isProlegalNoteInUse = false;
    
    // Modal açıldığında kaydetme butonlarını kontrol et ve şirket ilişkilerini yükle
    setTimeout(() => {
        console.log('🔧 Modal açıldı - Kaydetme butonları kontrol ediliyor...');
        const saveBtn = document.getElementById('saveProlegalDataBtn');
        
        console.log('🔍 Modal açıldıktan sonra saveBtn:', !!saveBtn);
        
        if (saveBtn) {
            console.log('✅ Modal içindeki saveBtn görünür:', saveBtn.offsetWidth > 0 && saveBtn.offsetHeight > 0);
        }
        
        // Modern modal sistemini initialize et
        console.log('🔧 setPanel - Initializing modern modal...');
        initializeModernModal();
        
        // Şirket ilişkilerini yükle
        if (!isFreshReload) {
            initializeCompanyRelations();
            setTimeout(() => {
                updateCompanyRelationFromFirmLabel();
            }, 100);
        }
        
        // Modal açıldığında şirket seçim modunu sıfırla
        resetCompanySelectionMode();
    }, 500);

    const list = {
        "oznitelik:id": data.properties.id,
        "oznitelik:il": data.properties.ilAd,
        "oznitelik:ilce": data.properties.ilceAd,
        "oznitelik:mahalle": data.properties.mahalleAd,
        "oznitelik:mahalleno": data.properties.mahalleId,
        "oznitelik:ada": data.properties.adaNo,
        "oznitelik:hisse": data.properties.hisse,
        "oznitelik:parsel": data.properties.parselNo,
        "oznitelik:tapualani": data.properties.alan,
        "oznitelik:nitelik": data.properties.nitelik,
        "oznitelik:mevkii": data.properties.mevkii,
        "oznitelik:zemintipi": data.properties.zeminKmdurum,
        "oznitelik:pafta": data.properties.pafta,
        "oznitelik-prolegal-not": data.properties.prolegal_not || '',
        "oznitelik:durum": data.properties.durum || data.properties.tapu_durum || '',
        "oznitelik:not_rating": (data.properties.not_rating !== null && data.properties.not_rating !== undefined) ? data.properties.not_rating : 0,
        "oznitelik:sorgu_durumu": data.properties.sorguDurumu || '',
        "oznitelik:basvuru_turu": data.properties.basvuru_turu || '',
        "oznitelik:basvuru_sayisi": data.properties.basvuru_sayısı || '',
        "oznitelik:basvurulan_firma": data.properties.basvurulan_firma || ''
    };

    console.log('🔍 setPanel - Gelen tüm data:', data);
    console.log('🔍 setPanel - data.properties:', data.properties);
    console.log('🔍 setPanel - Veri yükleniyor:', {
        'prolegal_not': data.properties.prolegal_not,
        'not_rating': data.properties.not_rating
    });
    
    // DEBUG: not_rating değerini detaylı kontrol et
    console.log('🔍 DEBUG not_rating:', {
        'raw': data.properties.not_rating,
        'type': typeof data.properties.not_rating,
        'isNull': data.properties.not_rating === null,
        'isUndefined': data.properties.not_rating === undefined,
        'isEmpty': data.properties.not_rating === '',
        'listValue': (data.properties.not_rating !== null && data.properties.not_rating !== undefined) ? data.properties.not_rating : ''
    });

    // TKGM değişim kontrolünü tetikle (popup)
    if (!isFreshReload) {
        runPopupTkgmCheckInline(data.properties);
    }

    for (let i of Object.keys(list)) {
        const element = document.getElementById(i);
        if (element) {
            console.log(`🔍 Element bulundu: ${i}, Değer: ${list[i]}`);
            if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.tagName === 'INPUT') {
                // Textarea için özel kontrol - kullanıcı yazıyorsa dokunma
                if (element.tagName === 'TEXTAREA') {
                    if (i === 'oznitelik-prolegal-not') {
                        // Prolegal not textarea'sı: sadece aktif düzenleme varsa dokunma
                        if (window.isProlegalNoteInUse) {
                            console.log('🚫 Prolegal not textarea kullanımda, değer değiştirilmiyor');
                            continue;
                        }
                    } else {
                        // Diğer textarea'lar için: kullanıcı yazıyorsa veya değer doluysa dokunma
                        if (document.activeElement === element || element.value.trim() !== '') {
                            console.log('🚫 Textarea kullanımda, değer değiştirilmiyor:', i);
                            continue;
                        }
                    }
                }
                
                // DEBUG: not_rating dropdown'ı için özel debug
                if (i === 'oznitelik:not_rating') {
                    console.log('🔍 DEBUG not_rating dropdown set ediliyor:', {
                        'elementId': i,
                        'listValue': list[i],
                        'elementValue': element.value,
                        'elementSelectedIndex': element.selectedIndex,
                        'elementOptions': Array.from(element.options).map(opt => ({value: opt.value, text: opt.text, selected: opt.selected}))
                    });
                }
                
                element.value = list[i];
            } else {
                element.textContent = list[i];
            }
        }
    }

    // Prolegal not görüntü alanını da backend verisine göre güncelle
    try {
        const noteText = document.getElementById('prolegalNoteText');
        if (noteText) {
            const noteValue = list['oznitelik-prolegal-not'] || '';
            if (noteValue && String(noteValue).trim() !== '') {
                noteText.innerHTML = `<span class="text-dark">${noteValue}</span>`;
            } else {
                noteText.innerHTML = '<span class="text-muted"></span>';
            }
        }
    } catch (e) {
        console.error('❌ Prolegal not display güncelleme hatası:', e);
    }

    // Property panel update event - aksiyon checkbox'larını senkronize etmek için
    try {
        document.dispatchEvent(new CustomEvent('PROPERTY_PANEL_UPDATED'));
    } catch (e) {
        console.error('PROPERTY_PANEL_UPDATED event dispatch error:', e);
    }

    // Her yeni parsel yüklendiğinde info modal sekmesini her zaman Tapu'ya döndür
    try {
        const tapuTabButton = document.getElementById('info-oznitelik-tab');
        const imarTabButton = document.getElementById('info-imar-tab');
        const sorguTabButton = document.getElementById('info-sorgu-tab');
        const veriTabButton = document.getElementById('info-veri-tab');

        const tapuPane = document.getElementById('info-oznitelik');
        const imarPane = document.getElementById('info-imar');
        const sorguPane = document.getElementById('info-sorgu');
        const veriPane = document.getElementById('info-veri');

        if (tapuTabButton && imarTabButton && sorguTabButton && tapuPane && imarPane && sorguPane) {
            tapuTabButton.classList.add('active');
            tapuTabButton.setAttribute('aria-selected', 'true');

            [imarTabButton, sorguTabButton, veriTabButton].forEach(btn => {
                if (!btn) return;
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });

            tapuPane.classList.add('show', 'active');
            tapuPane.setAttribute('aria-hidden', 'false');

            [imarPane, sorguPane, veriPane].forEach(p => {
                if (!p) return;
                p.classList.remove('show', 'active');
                p.setAttribute('aria-hidden', 'true');
            });
        }
    } catch (e) {
        console.error('❌ Info modal sekme reset hatası:', e);
    }

    // A/P butonu ile Ada/Parsel satırlarını gizle/göster
    try {
        const apToggleBtn = document.getElementById('apToggleBtn');
        const adaRow = document.getElementById('oznitelik:ada')?.closest('tr');
        const parselRow = document.getElementById('oznitelik:parsel')?.closest('tr');

        if (apToggleBtn && adaRow && parselRow) {
            // Varsayılan: Ada/Parsel satırları gizli
            adaRow.style.display = 'none';
            parselRow.style.display = 'none';
            apToggleBtn.classList.remove('ap-toggle-on');

            apToggleBtn.onclick = () => {
                const currentlyHidden = adaRow.style.display === 'none';
                const newDisplay = currentlyHidden ? '' : 'none';

                adaRow.style.display = newDisplay;
                parselRow.style.display = newDisplay;

                // Sadece kendi özel görünümünü yönet, Bootstrap tab .active ile karışmasın
                if (currentlyHidden) {
                    apToggleBtn.classList.add('ap-toggle-on');
                } else {
                    apToggleBtn.classList.remove('ap-toggle-on');
                }
            };
        }
    } catch (e) {
        console.error('❌ A/P toggle init hatası:', e);
    }

    // koordinat listesi


    try {
        const kld = document.querySelector('#koordinat-listesi-data');
        kld.innerHTML = '';
        let j = 1;
        const coordinates = data.geometry.coordinates;
        for (let i = 0; i < coordinates.length; i++) {
            const o = data.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

            for (let k = 0; k < o.length; k++) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${j}</td>
                    <td>${coordinates[i][k][0]}</td>
                    <td>${coordinates[i][k][1]}</td>
                `;
                kld.appendChild(tr);
                j++;
            }
        }
        const uld = document.querySelector('#uzunluk-listesi-data');
        uld.innerHTML = '';
        j = 1;
        for (let i = 0; i < coordinates.length; i++) {
            const o = data.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

            for (let k = 0; k < o.length - 1; k++) {

                const point1 = new google.maps.LatLng(coordinates[i][k][1], coordinates[i][k][0]);
                const point2 = new google.maps.LatLng(coordinates[i][k + 1][1], coordinates[i][k + 1][0]);
                const distance = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${j}</td>
                    <td>${distance.toFixed(2)}</td>
                `;
                uld.appendChild(tr);
                j++;
            }
        }



    } catch {

    }




    // ortofoto bilgisi

    // Parsel merkez koordinatlarını hesapla ve sakla
    try {
        const coordinates = data.geometry.coordinates;
        if (coordinates && coordinates.length > 0) {
            const polygon = data.geometry.type == "MultiPolygon" ? coordinates[0][0] : coordinates[0];
            const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
            currentParcelCenter = MAPHELPER.getCenter(triangleCoords);
            
            // Merkez koordinatlarını input'a yaz
            const coordinateInput = document.getElementById('coordinate-info-input');
            if (coordinateInput) {
                coordinateInput.value = `${currentParcelCenter.lat()} - ${currentParcelCenter.lng()}`;
                coordinateInput.setAttribute('title', `Parsel Merkezi: ${currentParcelCenter.lat()}, ${currentParcelCenter.lng()}`);
            }
            
            console.log('Parsel merkezi hesaplandı:', currentParcelCenter.lat(), currentParcelCenter.lng());
        }
    } catch (error) {
        console.error('Parsel merkezi hesaplanırken hata:', error);
    }

    // Prolegal notu display'ini güncelle
    const prolegalNoteText = document.getElementById('prolegalNoteText');
    if (prolegalNoteText && data.properties.prolegal_not) {
        prolegalNoteText.innerHTML = `<span class="text-dark">${data.properties.prolegal_not}</span>`;
    } else if (prolegalNoteText) {
        prolegalNoteText.innerHTML = '<span class="text-muted">Henüz not eklenmemiş</span>';
    }

    // Değerlendirme dropdown'ının value'sunu set et
    const degerlendirmeSelect = document.getElementById('oznitelik:not_rating');
    if (degerlendirmeSelect && data.properties.not_rating !== undefined && data.properties.not_rating !== null && data.properties.not_rating !== '') {
        degerlendirmeSelect.value = data.properties.not_rating;
        console.log('🔧 Değerlendirme dropdown set edildi:', data.properties.not_rating);
    } else if (degerlendirmeSelect) {
        // 0 değeri "Seçiniz..." seçeneğini temsil eder
        degerlendirmeSelect.value = '0';
        console.log('🔧 Değerlendirme dropdown sıfırlandı (Seçiniz... seçili)');
    }

    // Status Indicator'ları güncellEe
    updateStatusIndicators(data);

    // İmar detay bilgilerini yükle
    loadImarDetayData(data.properties.id);

    // Pop-up'taki Bootstrap tab sistemi otomatik çalışıyor
}


// İmar detay bilgilerini yükle
async function loadImarDetayData(tapuId) {
    try {
        if (!tapuId) {
            console.warn('⚠️ [DEBUG] İmar detay için tapuId yok, çağrı yapılmadı');
            return;
        }

        console.log('🏗️ [DEBUG] İmar detay (get_imar_detay) çağrılıyor - tapu_id:', tapuId);
        const resp = await fetch(`api.php?action=get_imar_detay&tapu_id=${encodeURIComponent(tapuId)}`, { cache: 'no-store' });
        const json = await resp.json();

        if (json && !json.error) {
            updateImarModalData(json);
        } else {
            console.warn('⚠️ [DEBUG] İmar detay yanıtı hata döndü:', json);
            updateImarModalData({ imar_detay: 'İmar detayı bulunamadı' });
        }

        // Harici İmar API'yi de paralel tetikle
        if (typeof window.fetchImarApiForCurrentParcel === 'function') {
            window.fetchImarApiForCurrentParcel('load_imar_detay');
        }
    } catch (error) {
        console.error('❌ [DEBUG] İmar detay yüklenirken hata:', error);
        updateImarModalData({ imar_detay: 'İmar detayı alınamadı' });
    }
}

// Modal'daki imar bilgilerini güncelle
function updateImarModalData(imarDetay) {
    console.log('🔧 [DEBUG] Modal imar bilgileri güncelleniyor:', imarDetay);
    
    // Sadece imar_detay değerini güncelle
    const imarDetayElement = document.getElementById('imar:imar_detay');
    if (imarDetayElement) {
        const imarDetayValue = imarDetay.imar_detay || 'İmar sorgusu yapılmadı';
        // \n karakterlerini <br> tag'larına çevir ve HTML olarak ekle
        const formattedValue = imarDetayValue.replace(/\n/g, '<br>');
        imarDetayElement.innerHTML = formattedValue;
        console.log(`✅ [DEBUG] imar:imar_detay güncellendi: ${imarDetayValue}`);
    } else {
        console.warn(`⚠️ [DEBUG] imar:imar_detay element bulunamadı`);
    }
}

// Status indicator'ları güncelle
function updateStatusIndicators(data) {
    console.log('🎨 Status indicator\'lar güncelleniyor:', data.properties);
    
    // Sorgu durumu indicator'ını güncelle
    const sorguStatusIndicator = document.getElementById('sorgu-status-indicator');
    const sorguDurumu = data.properties.sorguDurumu || data.properties.sorgulama_durumu || '';
    
    if (sorguStatusIndicator) {
        // Mevcut tüm status class'larını temizle
        sorguStatusIndicator.className = 'status-indicator';
        
        // Duruma göre class ekle
        if (sorguDurumu.toLowerCase().includes('sorguda')) {
            sorguStatusIndicator.classList.add('sorguda');
        } else if (sorguDurumu.toLowerCase().includes('sırada')) {
            sorguStatusIndicator.classList.add('sirada');
        } else if (sorguDurumu.toLowerCase().includes('sorgulanmadı') || sorguDurumu.toLowerCase().includes('sorgulanmadi')) {
            sorguStatusIndicator.classList.add('sorgulanmadi');
        } else {
            sorguStatusIndicator.classList.add('belirtilmemis');
        }
        
        console.log('🔍 Sorgu status indicator güncellendi:', sorguDurumu, '->', sorguStatusIndicator.className);
    }
    
    // Başvuru durumu indicator'ını güncelle
    const basvuruStatusIndicator = document.getElementById('basvuru-status-indicator');
    const basvuruTuru = data.properties.basvuru_turu || '';
    
    if (basvuruStatusIndicator) {
        // Mevcut tüm status class'larını temizle
        basvuruStatusIndicator.className = 'status-indicator';
        
        // Duruma göre class ekle
        if (basvuruTuru.toLowerCase().includes('küçük') || basvuruTuru.toLowerCase().includes('kucuk')) {
            basvuruStatusIndicator.classList.add('kucuk');
        } else if (basvuruTuru.toLowerCase().includes('büyük') || basvuruTuru.toLowerCase().includes('buyuk')) {
            basvuruStatusIndicator.classList.add('buyuk');
        } else {
            basvuruStatusIndicator.classList.add('belirtilmemis');
        }
        
        console.log('🔍 Başvuru status indicator güncellendi:', basvuruTuru, '->', basvuruStatusIndicator.className);
    }
    
    // Başvuru türü text'ini güncelle
    const basvuruTuruElement = document.getElementById('oznitelik:basvuru_turu');
    if (basvuruTuruElement) {
        if (basvuruTuru.toLowerCase().includes('küçük') || basvuruTuru.toLowerCase().includes('kucuk')) {
            basvuruTuruElement.textContent = 'Müşterisiz Başvuru';
        } else if (basvuruTuru.toLowerCase().includes('büyük') || basvuruTuru.toLowerCase().includes('buyuk')) {
            basvuruTuruElement.textContent = 'Müşterili Başvuru';
        } else if (basvuruTuru) {
            basvuruTuruElement.textContent = basvuruTuru;
        } else {
            basvuruTuruElement.textContent = 'Belirtilmemiş';
        }
    }
    
    // Sorgu durumu text'ini güncelle
    const sorguDurumuElement = document.getElementById('oznitelik:sorgu_durumu');
    if (sorguDurumuElement) {
        if (sorguDurumu.toLowerCase().includes('sorguda')) {
            sorguDurumuElement.textContent = 'Sorguda';
        } else if (sorguDurumu.toLowerCase().includes('sırada')) {
            sorguDurumuElement.textContent = 'Sırada';
        } else if (sorguDurumu.toLowerCase().includes('sorgulanmadı') || sorguDurumu.toLowerCase().includes('sorgulanmadi')) {
            sorguDurumuElement.textContent = 'Sorgulanmadı';
        } else if (sorguDurumu) {
            sorguDurumuElement.textContent = sorguDurumu;
        } else {
            sorguDurumuElement.textContent = 'Belirtilmemiş';
        }
    }
}

async function ortofoto_update() {
    if (!currentPanel) return;

    const triangleCoords = (currentPanel.geometry.type == 'MultiPolygon' ? currentPanel.geometry.coordinates[0][0] : currentPanel.geometry.coordinates[0]);
    const data = triangleCoords.map(p => ({ lat: p[1], lng: p[0] }));
    const center = MAPHELPER.getCenter(data);

    const ortofoto = document.getElementById('ortofoto-listesi-data');
    ortofoto.innerHTML = "";

    fetch(`${API_URL}?type=ortofoto&enlem=${center.lat()}&boylam=${center.lng()}`)
        .then(data => data.json())
        .then(response => {

            if (response.status == 200) {
                response.data.features.forEach((feature) => {

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td>${feature.properties.uretimTarih}</td>
                    <td>${feature.properties.uretenKurum}</td>
                    <td>${feature.properties.ad}</td>
                    <td>${feature.properties.olcek}</td>
                `;
                    ortofoto.appendChild(tr);
                });
            }
        });

}

function baglidetaylar_update() {
    if (!currentPanel) return;

    const triangleCoords = (currentPanel.geometry.type == 'MultiPolygon' ? currentPanel.geometry.coordinates[0][0] : currentPanel.geometry.coordinates[0]);
    const data = triangleCoords.map(p => ({ lat: p[1], lng: p[0] }));
    const center = MAPHELPER.getCenter(data);

    const baglidetaylar = document.getElementById('baglidetaylar-listesi-data');
    baglidetaylar.innerHTML = "";

    const mahalle_id = currentPanel.properties.mahalleId;
    const ada = currentPanel.properties.adaNo;
    const parsel = currentPanel.properties.parselNo;

    fetch(`${API_URL}?type=baglidetaylar&mahalle_id=${mahalle_id}&ada=${ada}&parsel=${parsel}`)
        .then(data => data.json())
        .then(response => {

            if (response.status == 200) {
                response.data.features.forEach((feature) => {

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td>${feature.properties.tip}</td>
                    <td>${feature.properties.alan}</td>
                `;
                    baglidetaylar.appendChild(tr);
                });
            }
        });
}

// Rota butonu - güvenli erişim
const rotaBtn = document.querySelector('#rota-btn');
if (rotaBtn) {
    rotaBtn.addEventListener('click', function() {

    if (!currentPanel) return;

    const triangleCoords = (currentPanel.geometry.type == 'MultiPolygon' ? currentPanel.geometry.coordinates[0][0] : currentPanel.geometry.coordinates[0]);
    const data = triangleCoords.map(p => ({ lat: p[1], lng: p[0] }));
    const center = MAPHELPER.getCenter(data);

    const type = document.querySelector('input[name=rota]:checked').value;

    const short = {
        google: 'https://www.google.com.tr/maps/dir//({0},{1})/',
        yandex: 'http://maps.yandex.com/?rtext=~{0},{1}&rtm=atm&source=route&l=map',
        bing: 'http://bing.com/maps/default.aspx?rtp=~pos.{0}_{1}'
    }

    const url = short[type].replace('{0}', center.lat()).replace('{1}', center.lng());

    window.open(url, '_blank');

    });
}

// İndirme butonu - güvenli erişim
const indirmeBtn = document.querySelector('#indirme-btn');
if (indirmeBtn) {
    indirmeBtn.addEventListener('click', function() {

    if (!currentPanel) return;

    let type = document.querySelector('input[name=indirme]:checked').value;
    let url = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel/download/{mahalle_id}/{ada}/{parsel}/{type}";

    url = url.replace(
            "{mahalle_id}", currentPanel.properties.mahalleId
        ).replace('{ada}', currentPanel.properties.adaNo)
        .replace('{parsel}', currentPanel.properties.parselNo)
        .replace('{type}', type);



    const a = document.createElement('a')
    a.href = url
    a.target = "_blank";
    a.download = currentPanel.properties.mahalleId + '.' + type;
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    });
}

// Printer butonu - güvenli erişim
const printerBtn = document.querySelector('#printer-btn');
if (printerBtn) {
    printerBtn.addEventListener('click', function() {
    const item = document.querySelector('input[name=yazdir]:checked').value;

    if (!item || !SearchMapItems[item]) {
        TitleAlertMessage("Bir sorun oluştu!", "danger");
        return;
    }

    modal('#modal-yazdir', false);

    TitleAlertMessage('Yükleniyor', 'info', false);

    const printItem = SearchMapItems[item].data;
    //POLYGON ((30.78352 37.20057, 30.78348 37.20054, 30.7834 37.20045, 30.78329 37.20048, 30.78294 37.20062, 30.78292 37.2006, 30.78287 37.20061, 30.78297 37.20043, 30.78309 37.20025, 30.78322 37.20017, 30.78331 37.20016, 30.78366 37.20015, 30.78389 37.20012, 30.78399 37.20023, 30.78384 37.2003, 30.78371 37.20069, 30.78368 37.20085, 30.78371 37.20088, 30.78364 37.20095, 30.7836 37.201, 30.78347 37.201, 30.78342 37.20106, 30.78323 37.20101, 30.78324 37.20098, 30.78341 37.20078, 30.78352 37.20057))
    let geom = '';

    for (let i = 0; i < printItem.geometry.coordinates.length; i++) {
        geom += '(';
        const d = printItem.geometry.type == 'Polygon' ? printItem.geometry.coordinates[i] : printItem.geometry.coordinates[i][0];
        for (let k = 0; k < d.length; k++) {
            let x = d[k];

            geom += `${x[0]} ${x[1]}`;

            if (printItem.geometry.coordinates[i].length - 1 != k) {
                geom += ', ';
            }
        }
        geom += ')';

        if (printItem.geometry.coordinates.length - 1 != i) {
            geom += ', ';
        }
    }

    let formData = new FormData();
    formData.append('obj_id', `${printItem.properties.mahalleAd}-${printItem.properties.adaNo}/${printItem.properties.parselNo}`);
    formData.append('map_width', '550');
    formData.append('map_height', '550');
    formData.append('geom', `${printItem.geometry.type.toUpperCase()} (${geom})`);
    formData.append('fill_color', '255,255,0,50');
    formData.append('stroke_color', '255,255,0,255');
    formData.append('stroke_with', '2');

    fetch(`${API_URL}?type=download`, {
            method: "POST",
            body: formData,
        })
        .then(data => data.json())
        .then(async result => {
            // resmi al ve yazdır

            TitleAlertMessage('Hazırlanıyor ' + `(${result?.data?.image?.length})`, 'info');

            const printerHtml = await fetch("yazdir_static.html").then(data => data.text());
            const rep = {
                il: printItem.properties.ilAd,
                ilce: printItem.properties.ilceAd,
                mahalle: printItem.properties.mahalleAd,
                ada: printItem.properties.adaNo,
                parsel: printItem.properties.parselNo,
                tapualani: printItem.properties.alan,
                nitelik: printItem.properties.nitelik,
                mevkii: printItem.properties.mevkii,
                pafta: printItem.properties.pafta,
                image: "data: image/ png; base64, " + result.data.image
            }
            let replacedHtml = printerHtml;
            for (let key of Object.keys(rep)) {
                replacedHtml = replacedHtml.replace('{' + key + '}', rep[key]);
            }

            const div = document.createElement('div');
            div.className = 'printable';
            div.innerHTML = replacedHtml;
            document.body.appendChild(div);
            let defaultDisplay = document.querySelector('.noPrint').style.display;
            document.querySelector('.noPrint').style.display = 'none';
            setTimeout(() => {
                window.print();
            }, 100);

            if (!MAPHELPER.isMobile) {
                window.onafterprint = function() {
                    document.querySelector('.noPrint').style.display = defaultDisplay;
                    document.body.removeChild(div);
                }
            } else {
                setTimeout(() => {
                    document.querySelector('.noPrint').style.display = defaultDisplay;
                    document.body.removeChild(div);
                }, 5000)
            }

            /*
  
        setTimeout(() => {
         
            var yeniPencere = window.open('yazdir.html', '_blank');
            yeniPencere.onload = function () {
                yeniPencere.document.body.querySelector('#il').textContent = printItem.properties.ilAd;
                yeniPencere.document.body.querySelector('#ilce').textContent = printItem.properties.ilceAd;
                yeniPencere.document.body.querySelector('#mahalle').textContent = printItem.properties.mahalleAd;
                yeniPencere.document.body.querySelector('#ada').textContent = printItem.properties.adaNo;
                yeniPencere.document.body.querySelector('#parsel').textContent = printItem.properties.parselNo;

                yeniPencere.document.body.querySelector('#tapualani').textContent = printItem.properties.alan;
                yeniPencere.document.body.querySelector('#nitelik').textContent = printItem.properties.nitelik;
                yeniPencere.document.body.querySelector('#mevkii').textContent = printItem.properties.mevkii;
                yeniPencere.document.body.querySelector('#pafta').textContent = printItem.properties.pafta;
                yeniPencere.document.body.querySelector('#image').src = "data:image/png;base64," + result.data.image;
         
                yeniPencere.document.close();
                const orjinal = window.
                yeniPencere.focus();
                yeniPencere.print();
                yeniPencere.close();
            };
        },150)
      */


        }).catch((e) => {
            TitleAlertMessage('Bir sorun oluştu.' + e.message, 'danger', false);
        });

    console.log(printItem)

    });
}

function printItems() {
    console.log(SearchMapItems)
    const printerData = document.querySelector('#printer-data');
    if (printerData) {
        printerData.innerHTML = "";
    }
    Object.keys(SearchMapItems).forEach((key, i) => {
        const data = SearchMapItems[key].data;
        const id = Date.now() + '-' + i;
        const html = `
            <tr>
                <td class="yazdir-field">
                    <label for="${id}">
                        <div>${data.properties.mahalleAd}, ${data.properties.adaNo} ada, ${data.properties.parselNo} parsel
                        </div>
                        <div>${data.properties.ozet}, ${data.properties.alan}
                        </div>
                    </label>

                </td>
                <td style="height:73px;line-height: 73px;text-align: center;">
                    <input type="radio" checked name="yazdir" id="${id}" value="${key}">
                </td>
            </tr>
        `;
        if (printerData) {
            printerData.innerHTML += html;
        }
    })
}

// alert

function TitleAlertMessage(message, type = 'info', autoCloseSeconds) {
    const mbox = document.querySelector('.messagebox');
    if (!mbox) {
        console.error('Messagebox not found');
        return;
    }

    // Clear any existing timeout
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }

    const types = ['success', 'danger', 'info', 'warning'];
    mbox.querySelector('#message').innerHTML = message;
    
    if (!mbox.classList.contains('opened')) {
        mbox.classList.add('opened');
    }
    
    types.forEach((t) => {
        mbox.classList.remove(t);
    });
    
    if (!mbox.classList.contains(type)) {
        mbox.classList.add(type);
    }

    // Varsayılan otomatik kapanma davranışı:
    // - success / info: birkaç saniye sonra kendiliğinden kapanır
    // - danger / warning: kullanıcı "Tamam" (veya kapat) diyene kadar açık kalır
    if (typeof autoCloseSeconds === 'undefined') {
        if (type === 'success' || type === 'info') {
            autoCloseSeconds = 4;
        } else {
            autoCloseSeconds = false;
        }
    }

    if (autoCloseSeconds !== false && autoCloseSeconds > -1) {
        autoCloseTimeout = setTimeout(() => {
            mbox.classList.remove('opened');
            autoCloseTimeout = null;
        }, autoCloseSeconds * 1000);
    }
}


document.querySelector('#messagebox .close').addEventListener('click', closeAlertMessage);
const messageboxOkBtn = document.querySelector('#messagebox .messagebox-ok');
if (messageboxOkBtn) {
    messageboxOkBtn.addEventListener('click', closeAlertMessage);
}

function closeAlertMessage() {
    document.querySelector('.messagebox').classList.remove('opened');
}

// Global alert override: tüm alert() çağrılarını merkezi mesaj kutusuna yönlendir
if (!window.__APP_ALERT_OVERRIDDEN__) {
    window.__APP_ALERT_OVERRIDDEN__ = true;
    window.alert = function(message) {
        const msg = String(message || '').trim();
        let type = 'danger';

        // Mesaj içeriğine göre tahmini tip belirle
        if (msg.startsWith('✅') || msg.toLowerCase().includes('başarıyla') || msg.toLowerCase().includes('başarıyla')) {
            type = 'success';
        } else if (msg.startsWith('⚠️')) {
            type = 'warning';
        } else if (msg.startsWith('ℹ️') || msg.startsWith('ⓘ')) {
            type = 'info';
        }

        TitleAlertMessage(msg, type);
    };
}


// ===== MODERN MODAL FUNCTIONALITY =====

// Initialize Modern Modal
function initializeModernModal() {
    console.log('🔧 initializeModernModal called');
    const modal = document.getElementById('info-modal-dialog');
    if (!modal) {
        console.log('❌ Modal not found: info-modal-dialog');
        return;
    }
    
    console.log('🔧 Modal found:', modal);

    // Add event listeners
    addModernModalEventListeners(modal);
    
    // Initialize resize handles
    initializeResizeHandles(modal);
    
    // Test: Manual check for resize handles
    setTimeout(() => {
        console.log('🔧 Manual test - checking resize handles...');
        const testHandles = modal.querySelectorAll('.modern-resize-handle');
        console.log('🔧 Manual test - found handles:', testHandles.length);
        testHandles.forEach((handle, index) => {
            console.log(`🔧 Manual test - handle ${index}:`, handle.className, 'visible:', handle.offsetWidth > 0);
        });
    }, 200);
    
    console.log('✅ Modern modal initialized');
}

// Add Event Listeners
function addModernModalEventListeners(modal) {
    console.log('🔧 addModernModalEventListeners called');
    const header = modal.querySelector('.modern-modal-header');
    const closeBtn = modal.querySelector('.modern-modal-close');

    console.log('🔧 Header found:', header);
    console.log('🔧 Close button found:', closeBtn);

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
        console.log('🔧 Close button event listener added');
    }

    // Drag functionality
    if (header) {
        header.addEventListener('mousedown', startDrag);
        console.log('🔧 Header drag event listener added');
    }

    // Global mouse events for dragging only - only add if not already added
    if (!document.modernModalEventsAdded) {
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);
        document.modernModalEventsAdded = true;
        console.log('🔧 Global drag event listeners added');
    }
}

// Initialize Resize Handles
function initializeResizeHandles(modal) {
    const handles = modal.querySelectorAll('.modern-resize-handle');
    console.log('🔧 Initializing resize handles:', handles.length);
    console.log('🔧 Modal element:', modal);
    console.log('🔧 Modal HTML:', modal.outerHTML.substring(0, 500) + '...');
    
    if (handles.length === 0) {
        console.log('❌ No resize handles found in modal!');
        // Try to find them in the entire document
        const allHandles = document.querySelectorAll('.modern-resize-handle');
        console.log('🔧 All resize handles in document:', allHandles.length);
        return;
    }
    
    handles.forEach((handle, index) => {
        console.log(`🔧 Handle ${index}:`, handle.className, handle);
        handle.addEventListener('mousedown', (e) => {
            console.log('🔧 Resize handle clicked:', handle.className);
            e.preventDefault();
            e.stopPropagation();
            startResize(e, modal, handle.className.split(' ')[1]);
        });
        console.log(`🔧 Event listener added to handle ${index}`);
    });
    
    console.log('✅ All resize handles initialized');
}

// Drag Functions
function startDrag(e) {
    if (e.target.closest('.modern-modal-controls') || 
        e.target.closest('.btn-group') || 
        e.target.closest('.modern-modal-close')) {
        return;
    }

    modernModalState.isDragging = true;
    modernModalState.startX = e.clientX;
    modernModalState.startY = e.clientY;
    
    const modal = document.getElementById('info-modal-dialog');
    const rect = modal.getBoundingClientRect();
    modernModalState.startLeft = rect.left;
    modernModalState.startTop = rect.top;
    
    modal.classList.add('dragging');
    e.preventDefault();
}

function handleDrag(e) {
    if (!modernModalState.isDragging) return;

    const modal = document.getElementById('info-modal-dialog');
    const deltaX = e.clientX - modernModalState.startX;
    const deltaY = e.clientY - modernModalState.startY;
    
    let newLeft = modernModalState.startLeft + deltaX;
    let newTop = modernModalState.startTop + deltaY;
    
    // Boundary checks
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const modalRect = modal.getBoundingClientRect();
    
    newLeft = Math.max(0, Math.min(newLeft, windowWidth - modalRect.width));
    newTop = Math.max(0, Math.min(newTop, windowHeight - modalRect.height));
    
    modal.style.left = newLeft + 'px';
    modal.style.top = newTop + 'px';
    modal.style.transform = 'none';
}

function endDrag() {
    if (!modernModalState.isDragging) return;
    
    modernModalState.isDragging = false;
    const modal = document.getElementById('info-modal-dialog');
    modal.classList.remove('dragging');
}

// Resize Functions
function startResize(e, modal, direction) {
    console.log('🔧 Starting resize with direction:', direction);
    modernModalState.isResizing = true;
    modernModalState.currentResizeDirection = direction;
    modernModalState.startX = e.clientX;
    modernModalState.startY = e.clientY;
    
    const rect = modal.getBoundingClientRect();
    modernModalState.startWidth = rect.width;
    modernModalState.startHeight = rect.height;
    
    // Modal'ın mevcut pozisyonunu kullan
    // getBoundingClientRect() modal'ın şu anki gerçek pozisyonunu veriyor
    // Bu pozisyon sürükleme sonrası pozisyon da olabilir
    modernModalState.startLeft = rect.left;
    modernModalState.startTop = rect.top;
    
    console.log('🔧 Initial dimensions:', {
        width: modernModalState.startWidth,
        height: modernModalState.startHeight,
        left: modernModalState.startLeft,
        top: modernModalState.startTop
    });
    
    // Resize başladığında modal'ın pozisyonunu sabitle
    modal.style.setProperty('position', 'fixed', 'important');
    
    modal.classList.add('resizing');
    
    // Prevent default davranış
    e.preventDefault();
    e.stopPropagation();
    
    // Add global event listeners for resize
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', endResize);
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getResizeCursor(direction);
}

function handleResize(e) {
    if (!modernModalState.isResizing) return;

    const modal = document.getElementById('info-modal-dialog');
    if (!modal) return;
    
    const deltaX = e.clientX - modernModalState.startX;
    const deltaY = e.clientY - modernModalState.startY;
    
    let newWidth = modernModalState.startWidth;
    let newHeight = modernModalState.startHeight;
    let newLeft = modernModalState.startLeft;
    let newTop = modernModalState.startTop;
    
    const direction = modernModalState.currentResizeDirection;
    
    // OPTIMIZED RESIZE - Smooth and responsive
    if (direction.includes('e')) {
        newWidth = Math.max(400, Math.min(1400, modernModalState.startWidth + deltaX));
    }
    if (direction.includes('w')) {
        newWidth = Math.max(400, Math.min(1400, modernModalState.startWidth - deltaX));
        newLeft = modernModalState.startLeft + deltaX;
    }
    if (direction.includes('s')) {
        newHeight = Math.max(300, Math.min(900, modernModalState.startHeight + deltaY));
    }
    if (direction.includes('n')) {
        newHeight = Math.max(300, Math.min(900, modernModalState.startHeight - deltaY));
        newTop = modernModalState.startTop + deltaY;
    }
    
    // SMOOTH RESIZE - Tek seferde uygula
    modal.style.cssText = `
        width: ${newWidth}px !important;
        height: ${newHeight}px !important;
        left: ${newLeft}px !important;
        top: ${newTop}px !important;
        transform: none !important;
        position: fixed !important;
        margin: 0 !important;
        transition: none !important;
    `;
    
    // Prevent text selection during resize
    e.preventDefault();
}

function endResize() {
    if (!modernModalState.isResizing) return;
    
    modernModalState.isResizing = false;
    const modal = document.getElementById('info-modal-dialog');
    if (modal) {
        modal.classList.remove('resizing');
        // Smooth transition geri ekle
        modal.style.transition = 'all 0.2s ease';
    }
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', endResize);
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Cleanup after a short delay
    setTimeout(() => {
        if (modal) {
            modal.style.transition = '';
        }
    }, 200);
}

// Helper function to get resize cursor
function getResizeCursor(direction) {
    switch(direction) {
        case 'nw': return 'nw-resize';
        case 'ne': return 'ne-resize';
        case 'sw': return 'sw-resize';
        case 'se': return 'se-resize';
        case 'n': return 'n-resize';
        case 's': return 's-resize';
        case 'w': return 'w-resize';
        case 'e': return 'e-resize';
        default: return 'default';
    }
}

// Minimize/Maximize Functions
function toggleMinimize(modal) {
    if (modernModalState.isMinimized) {
        restoreModal(modal);
    } else {
        minimizeModal(modal);
    }
}

function minimizeModal(modal) {
    modernModalState.isMinimized = true;
    modal.classList.add('minimized');
    
    // Store original position for restore
    const rect = modal.getBoundingClientRect();
    modernModalState.originalSize = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
    };
    
    // Position at bottom right
    modal.style.left = 'auto';
    modal.style.top = 'auto';
    modal.style.right = '20px';
    modal.style.bottom = '20px';
    modal.style.transform = 'none';
    
    console.log('📦 Modal minimized');
}

function restoreModal(modal) {
    modernModalState.isMinimized = false;
    modal.classList.remove('minimized');
    
    // Restore original position
    modal.style.left = modernModalState.originalSize.left + 'px';
    modal.style.top = modernModalState.originalSize.top + 'px';
    modal.style.right = 'auto';
    modal.style.bottom = 'auto';
    modal.style.width = modernModalState.originalSize.width + 'px';
    modal.style.height = modernModalState.originalSize.height + 'px';
    modal.style.transform = 'none';
    
    console.log('📦 Modal restored');
}

function toggleMaximize(modal) {
    if (modernModalState.isMaximized) {
        restoreModal(modal);
        modernModalState.isMaximized = false;
    } else {
        maximizeModal(modal);
        modernModalState.isMaximized = true;
    }
}

function maximizeModal(modal) {
    // Store current size for restore
    const rect = modal.getBoundingClientRect();
    modernModalState.originalSize = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
    };
    
    // Maximize to full screen
    modal.style.left = '0px';
    modal.style.top = '0px';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.transform = 'none';
    
    console.log('🔍 Modal maximized');
}

function closeModal() {
    const modal = document.getElementById('info-modal');
    const instance = bootstrap.Modal.getInstance(modal);
    if (instance) {
        instance.hide();
    }
}

// Initialize when DOM is ready - Bu blok ana DOMContentLoaded'a taşındı

// Re-initialize when modal is shown
document.addEventListener('shown.bs.modal', function(e) {
    console.log('🔧 Bootstrap modal shown event:', e.target.id);
    if (e.target.id === 'info-modal') {
        console.log('🔧 Info modal shown, initializing...');
        setTimeout(() => {
            console.log('🔧 Bootstrap modal timeout - initializing modern modal');
            initializeModernModal();
            // Sorgu ve Başvuru verilerini yükle
            const propertyId = document.getElementById('oznitelik:id')?.textContent;
            if (propertyId) {
                loadSorguBasvuruData(propertyId);
            }
        }, 100);
    }
});

// İmar sekmesine tıklandığında imar detay bilgilerini yükle
document.addEventListener('shown.bs.tab', function(e) {
    console.log('🔧 Bootstrap tab shown event:', e.target.id);
    if (e.target.id === 'info-imar-tab') {
        console.log('🏗️ [DEBUG] İmar sekmesi açıldı, imar detay bilgileri yükleniyor...');
        
        // Taşınmaz ID'sini al
        const propertyId = document.getElementById('oznitelik:id')?.textContent;
        if (propertyId) {
            console.log('🔍 [DEBUG] Property ID bulundu:', propertyId);
            loadImarDetayData(propertyId);
            if (typeof window.fetchImarApiForCurrentParcel === 'function') {
                window.fetchImarApiForCurrentParcel();
            }
        } else {
            console.warn('⚠️ [DEBUG] Property ID bulunamadı');
        }
    }
});

// Şirket ilişkilerini otomatik yükle (pop-up açıldığında)
function initializeCompanyRelations() {
    const propertyId = document.getElementById('oznitelik:id')?.textContent;
    
    if (propertyId) {
        console.log('🔄 Şirket ilişkileri yükleniyor...', propertyId);
        loadPropertyCompanyRelations(propertyId);
        loadCompaniesForSearch();
        
        // Popup'taki şirket arama input'una event listener ekle
        const searchInput = document.getElementById('newCompanySearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                searchCompanies(e.target.value);
            });
        }
        
        // Prolegal notu düzenleme fonksiyonlarını başlat
        initializeProlegalNoteEditing();
    }
}

// Sorgu yönetimi - Seçilen araziyi sağ sidebar'a gönder
function sendSelectedPropertyToQueryManagement(propertyData) {
    console.log('🔄 Seçilen arazi sorgu yönetimine gönderiliyor:', propertyData);
    
    // Sağ sidebar'daki sorgu yönetimi tabını aktif et
    const queryTab = document.querySelector('[data-tab="general"]');
    if (queryTab) {
        queryTab.click();
    }
    
    // Seçilen arazi bilgilerini göster
    document.getElementById('selectedPropertyId').textContent = propertyData.id || '-';
    document.getElementById('selectedPropertyIl').textContent = propertyData.ilAd || '-';
    document.getElementById('selectedPropertyIlce').textContent = propertyData.ilceAd || '-';
    document.getElementById('selectedPropertyMahalle').textContent = propertyData.mahalleAd || '-';
    document.getElementById('selectedPropertyAda').textContent = propertyData.adaNo || '-';
    document.getElementById('selectedPropertyParsel').textContent = propertyData.parselNo || '-';
    
    // Bilgi panelini göster
    document.getElementById('selectedPropertyInfo').style.display = 'block';
    document.getElementById('statusUpdateForm').style.display = 'block';
    
    // Mevcut durumları yükle
    loadCurrentStatuses(propertyData.id);
}

// Sol sidebar'dan seçilen arazileri sorgu yönetimine gönder
function sendSelectedPropertiesToQueryManagement() {
    const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Lütfen en az bir arazi seçiniz!');
        return;
    }
    
    if (selectedCheckboxes.length > 1) {
        alert('Lütfen sadece bir arazi seçiniz!');
        return;
    }
    
    const selectedRow = selectedCheckboxes[0].closest('tr');
    const propertyData = {
        id: selectedRow.querySelector('td:nth-child(2)').textContent,
        ilAd: selectedRow.querySelector('td:nth-child(3)').textContent,
        ilceAd: selectedRow.querySelector('td:nth-child(4)').textContent,
        mahalleAd: selectedRow.querySelector('td:nth-child(5)').textContent,
        adaNo: selectedRow.querySelector('td:nth-child(6)').textContent.split('/')[0],
        parselNo: selectedRow.querySelector('td:nth-child(6)').textContent.split('/')[1]
    };
    
    sendSelectedPropertyToQueryManagement(propertyData);
}

// Mevcut durumları yükle
async function loadCurrentStatuses(propertyId) {
    try {
        const response = await fetch(`api.php?action=get_property_status&property_id=${propertyId}`);
        const result = await response.json();
        
        if (result.success) {
            // Uygunluk durumu
            const uygunlukSelect = document.getElementById('updateUygunlukDurumu');
            if (uygunlukSelect) {
                uygunlukSelect.value = result.uygunluk_durumu || 'Sorgulanmadı';
            }
            
            // Sorgulama durumu
            const sorgulamaSelect = document.getElementById('updateSorgulamaDurumu');
            if (sorgulamaSelect) {
                sorgulamaSelect.value = result.sorgulama_durumu || 'Sorgulanmadı';
            }
            
            // Başvuru durumu
            const basvuruSelect = document.getElementById('updateBasvuruDurumu');
            if (basvuruSelect) {
                basvuruSelect.value = result.basvuru_durumu || 'Küçük';
            }
        }
    } catch (error) {
        console.error('❌ Durumlar yüklenirken hata:', error);
    }
}

// Sorgu kayıtlarını yükleeeeeeeeeee
async function loadQueryRecords() {
    console.log('🔄 Sorgu kayıtları yükleniyor...');
    
    try {
        const response = await fetch('api.php?action=get_query_records');
        const result = await response.json();
        
        if (result.success) {
            displayQueryRecords(result.records);
            console.log('✅ Sorgu kayıtları yüklendi:', result.records.length);
        } else {
            console.log('❌ Sorgu kayıtları yüklenemedi:', result.message);
            displayQueryRecords([]);
        }
    } catch (error) {
        console.error('❌ Sorgu kayıtları yüklenirken hata:', error);
        displayQueryRecords([]);
    }
}

// Sorgu kayıtlarını tabloda göster
function displayQueryRecords(records) {
    const tbody = document.getElementById('queryRecordsTableBody');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i> Sorgu sırasında kayıt bulunamadı
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input query-record-checkbox" value="${record.id}">
            </td>
            <td>${record.id}</td>
            <td>${record.ilAd || '-'}</td>
            <td>${record.ilceAd || '-'}</td>
            <td>${record.mahalleAd || '-'}</td>
            <td>${record.adaNo || '-'}</td>
            <td>${record.parselNo || '-'}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(record.durum)}">${record.durum || 'Sorgulanmadı'}</span>
            </td>
            <td>
                <span class="badge ${getQueryStatusBadgeClass(record.sorgulama_durumu)}">${record.sorgulama_durumu || 'Sorgulanmadı'}</span>
            </td>
            <td>
                <span class="badge ${getApplicationStatusBadgeClass(record.basvuru_turu)}">${getApplicationStatusText(record.basvuru_turu)}</span>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Checkbox event listener'ları ekle
    addQueryRecordCheckboxListeners();
}

// Durum badge sınıflarını belirle
function getStatusBadgeClass(status) {
    switch(status) {
        case 'Uygun': return 'bg-success';
        case 'Uygun değil': return 'bg-danger';
        case 'Sorguda': return 'bg-warning';
        case 'Sırada': return 'bg-secondary';
        default: return 'bg-light text-dark';
    }
}

function getQueryStatusBadgeClass(status) {
    switch(status) {
        case 'Sorguda': return 'bg-warning';
        case 'Sırada': return 'bg-info';
        case 'Sorgulanmadı': return 'bg-light text-dark';
        default: return 'bg-light text-dark';
    }
}

function getApplicationStatusBadgeClass(status) {
    switch(status) {
        case 'Küçük': return 'bg-primary';
        case 'Büyük': return 'bg-success';
        default: return 'bg-light text-dark';
    }
}

function getApplicationStatusText(status) {
    switch(status) {
        case 'Küçük': return 'Müşterisiz';
        case 'Büyük': return 'Müşterili';
        default: return 'Belirtilmemiş';
    }
}

// Sorgu kayıtları checkbox event listener'ları
function addQueryRecordCheckboxListeners() {
    // Tümünü seç/seçme
    const selectAllCheckbox = document.getElementById('selectAllQueryRecords');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.query-record-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateSendToQueryButton();
        });
    }
    
    // Bireysel checkbox'lar
    const checkboxes = document.querySelectorAll('.query-record-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSendToQueryButton();
            updateSelectAllCheckbox();
        });
    });
}

// Sorguya gönder butonunu güncelle
function updateSendToQueryButton() {
    const selectedCheckboxes = document.querySelectorAll('.query-record-checkbox:checked');
    const sendBtn = document.getElementById('sendSelectedToQueryBtn');
    const exportBtn = document.getElementById('exportQueryRecordsBtn');
    
    if (sendBtn) {
        if (selectedCheckboxes.length > 0) {
            sendBtn.disabled = false;
            sendBtn.textContent = `Seçilenleri Sorguya Gönder (${selectedCheckboxes.length})`;
        } else {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Seçilenleri Sorguya Gönder';
        }
    }
    
    if (exportBtn) {
        if (selectedCheckboxes.length > 0) {
            exportBtn.disabled = false;
            exportBtn.textContent = `Seçilenleri Excel'e İndir (${selectedCheckboxes.length})`;
        } else {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Seçilenleri Excel\'e İndir';
        }
    }
}

// Tümünü seç checkbox'ını güncelle
function updateSelectAllCheckbox() {
    const allCheckboxes = document.querySelectorAll('.query-record-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.query-record-checkbox:checked');
    const selectAllCheckbox = document.getElementById('selectAllQueryRecords');
    
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        if (checkedCheckboxes.length === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}

// Sorgu geçmişini yükle
async function loadQueryHistory() {
    console.log('🔄 Sorgu geçmişi yükleniyor...');
    
    try {
        const response = await fetch('api.php?action=get_query_history');
        
        // Response'u text olarak al ve JSON parse etmeden önce kontrol et
        const responseText = await response.text();
        console.log('📡 API Response:', responseText.substring(0, 200) + '...');
        
        // HTML hata mesajı kontrolü
        if (responseText.includes('<br />') || responseText.includes('<b>')) {
            console.error('❌ API HTML hata mesajı döndürüyor:', responseText);
            displayQueryHistory([]);
            return;
        }
        
        // JSON parse et
        const result = JSON.parse(responseText);
        
        if (result.success) {
            displayQueryHistory(result.history);
            console.log('✅ Sorgu geçmişi yüklendi:', result.history.length);
        } else {
            console.log('❌ Sorgu geçmişi yüklenemedi:', result.message);
            displayQueryHistory([]);
        }
    } catch (error) {
        console.error('❌ Sorgu geçmişi yüklenirken hata:', error);
        displayQueryHistory([]);
    }
}

// Sorgu geçmişini tabloda göster
function displayQueryHistory(history) {
    const tbody = document.getElementById('queryHistoryTableBody');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    <i class="fas fa-info-circle"></i> Henüz sorgu geçmişi yok
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    history.forEach(record => {
        const row = document.createElement('tr');
        const sentDate = new Date(record.sent_at);
        const formattedDate = sentDate.toLocaleDateString('tr-TR') + ' ' + sentDate.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
                <strong>ID:</strong> ${record.property_id}<br>
                <small class="text-muted">${record.ilAd || '-'} / ${record.ilceAd || '-'} / ${record.mahalleAd || '-'}</small><br>
                <small class="text-muted">Ada: ${record.adaNo || '-'} Parsel: ${record.parselNo || '-'}</small>
            </td>
            <td>
                <span class="badge ${getHistoryStatusBadgeClass(record.status)}">${record.status}</span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="markAsSuitable(${record.property_id}, 'Uygun')">
                    <i class="fas fa-check"></i> Uygun
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="markAsSuitable(${record.property_id}, 'Uygun değil')">
                    <i class="fas fa-times"></i> Uygun Değil
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Geçmiş durum badge sınıfını belirle
function getHistoryStatusBadgeClass(status) {
    switch(status) {
        case 'Gönderildi': return 'bg-warning';
        case 'Uygun': return 'bg-success';
        case 'Uygun değil': return 'bg-danger';
        default: return 'bg-light text-dark';
    }
}

// Uygunluk durumunu işaretle
async function markAsSuitable(propertyId, status) {
    if (!confirm(`Bu kaydı "${status}" olarak işaretlemek istediğinize emin misiniz?`)) {
        return;
    }
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=mark_as_suitable&property_id=${propertyId}&status=${encodeURIComponent(status)}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Kayıt "${status}" olarak işaretlendi!`);
            loadQueryHistory(); // Geçmişi yenile
        } else {
            alert('Hata: ' + (result.message || 'Durum güncellenemedi.'));
        }
    } catch (error) {
        console.error('❌ Durum işaretleme hatası:', error);
        alert('Hata: Durum güncellenemedi.');
    }
}

// Modal açıldığında şirket seçim modunu sıfırla
function resetCompanySelectionMode() {
    console.log('🔄 Modal açıldı - Şirket seçim modu sıfırlanıyor...');
    
    const selectElement = document.getElementById('newCompanySearch');
    const inputElement = document.getElementById('newCompanyManualInput');
    const toggleBtn = document.getElementById('toggleManualInput');
    const addToSelectedBtn = document.getElementById('addToSelectedCompanyBtn');
    const createAndAddBtn = document.getElementById('createAndAddToCompanyBtn');
    
    if (selectElement && inputElement && toggleBtn && addToSelectedBtn && createAndAddBtn) {
        // Select'i göster, input'u gizle
        selectElement.style.display = 'block';
        inputElement.style.display = 'none';
        inputElement.value = '';
        
        // Toggle butonunu sıfırla
        toggleBtn.innerHTML = '<i class="fas fa-plus"></i> Yeni Şirket Oluştur';
        
        // Select'i sıfırla
        selectElement.value = '';
        
        // Data attribute'larını temizle
        selectElement.removeAttribute('data-selectedCompanyId');
        inputElement.removeAttribute('data-selectedCompanyId');
        addToSelectedBtn.removeAttribute('data-companyId');
        addToSelectedBtn.removeAttribute('data-companyName');
        
        // İkinci butonu da temizle
        const addToSelectedBtn2 = document.getElementById('addToSelectedCompanyBtn2');
        if (addToSelectedBtn2) {
            addToSelectedBtn2.removeAttribute('data-companyId');
            addToSelectedBtn2.removeAttribute('data-companyName');
        }
        
        // Şirket ilişkisi alanlarını temizle
        const firmNameLabel = document.getElementById('firm-name-label');
        const relationCell = document.getElementById('oznitelik:sirket_iliskisi');
        const relationLabel = document.getElementById('firm-relation-label');
        const firmCheckbox = document.getElementById('firm-checkbox');
        
        if (firmNameLabel) {
            firmNameLabel.textContent = '';
            firmNameLabel.innerHTML = '';
        }
        
        if (relationLabel) {
            relationLabel.innerHTML = '';
        }
        
        if (firmCheckbox) {
            firmCheckbox.checked = false;
        }
        
        // Şirkete Ekle butonunu göster (ama data attribute'ları temizli)
        addToSelectedBtn.style.display = 'inline-block';
        createAndAddBtn.style.display = 'none';
        
        console.log('✅ Şirket seçim modu tamamen sıfırlandı - Tüm alanlar temizlendi');
    }
}

// Manuel input toggle
function toggleManualInput() {
    const selectElement = document.getElementById('newCompanySearch');
    const inputElement = document.getElementById('newCompanyManualInput');
    const toggleBtn = document.getElementById('toggleManualInput');
    const addToSelectedBtn = document.getElementById('addToSelectedCompanyBtn');
    const createAndAddBtn = document.getElementById('createAndAddToCompanyBtn');
    
    if (inputElement.style.display === 'none') {
        // Manuel input'u göster
        inputElement.style.display = 'block';
        selectElement.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-list"></i> Şirket Listesinden Seç';
        inputElement.focus();
        
        // Diğer butonları gizle
        if (addToSelectedBtn) addToSelectedBtn.style.display = 'none';
        if (createAndAddBtn) createAndAddBtn.style.display = 'none';
        
        // Select'i sıfırla
        selectElement.value = '';
        
        // Event listener'lar DOMContentLoaded'da zaten ekleniyor - burada ekleme yapmıyoruz
    } else {
        // Manuel input'u gizle
        inputElement.style.display = 'none';
        selectElement.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-plus"></i> Yeni Şirket Oluştur';
        inputElement.value = '';
        
        // Şirkete Ekle butonunu her zaman göster, sadece createAndAddBtn'ı gizle
        if (addToSelectedBtn) addToSelectedBtn.style.display = 'inline-block';
        if (createAndAddBtn) createAndAddBtn.style.display = 'none';
    }
}

// Şirket seçimi handle et - Buton göster
function handleCompanySelection() {
    console.log('🔍 handleCompanySelection çağrıldı');
    
    const selectElement = document.getElementById('newCompanySearch');
    const selectedCompanyId = selectElement.value;
    const addToSelectedBtn = document.getElementById('addToSelectedCompanyBtn');
    const createAndAddBtn = document.getElementById('createAndAddToCompanyBtn');
    const manualInput = document.getElementById('newCompanyManualInput');
    
    console.log('📋 Elementler bulundu:', {
        selectElement: !!selectElement,
        selectedCompanyId: selectedCompanyId,
        addToSelectedBtn: !!addToSelectedBtn,
        createAndAddBtn: !!createAndAddBtn,
        manualInput: !!manualInput
    });
    
    // Şirkete Ekle butonunu her zaman göster
    if (addToSelectedBtn) {
        addToSelectedBtn.style.display = 'inline-block';
        console.log('🔘 addToSelectedBtn her zaman görünür yapıldı');
    }
    if (createAndAddBtn) {
        createAndAddBtn.style.display = 'none';
        console.log('🔘 createAndAddBtn gizlendi');
    }
    
    if (selectedCompanyId) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const companyName = selectedOption.textContent.split(' (ID:')[0]; // ID kısmını kaldır
        
        console.log('✅ Şirket seçildi:', {
            companyName: companyName,
            selectedCompanyId: selectedCompanyId,
            fullText: selectedOption.textContent
        });
        
        // Şirkete Ekle butonunu göster
        if (addToSelectedBtn) {
            addToSelectedBtn.style.display = 'inline-block';
            addToSelectedBtn.dataset.companyId = selectedCompanyId;
            addToSelectedBtn.dataset.companyName = companyName;
            
            console.log('🔘 addToSelectedBtn gösterildi ve data attribute\'ları set edildi:', {
                companyId: addToSelectedBtn.dataset.companyId,
                companyName: addToSelectedBtn.dataset.companyName
            });
        } else {
            console.log('❌ addToSelectedBtn bulunamadı!');
        }
        
        // İkinci buton için de aynı işlemi yap
        const addToSelectedBtn2 = document.getElementById('addToSelectedCompanyBtn2');
        if (addToSelectedBtn2) {
            addToSelectedBtn2.style.display = 'inline-block';
            addToSelectedBtn2.dataset.companyId = selectedCompanyId;
            addToSelectedBtn2.dataset.companyName = companyName;
            
            console.log('🔘 addToSelectedBtn2 gösterildi ve data attribute\'ları set edildi:', {
                companyId: addToSelectedBtn2.dataset.companyId,
                companyName: addToSelectedBtn2.dataset.companyName
            });
        } else {
            console.log('❌ addToSelectedBtn2 bulunamadı!');
        }
    } else {
        console.log('⚠️ selectedCompanyId boş');
    }
}

// Arazinin mevcut şirket ilişkilerini yükle
async function loadPropertyCompanyRelations(propertyId) {
    console.log('🔄 Arazinin şirket ilişkileri yükleniyor...', propertyId);
    
    if (!propertyId) {
        console.log('❌ Property ID bulunamadı!');
        displayExistingCompanies([]);
        return;
    }
    
    console.log('🔍 API çağrısı yapılıyor...');
    
    try {
        const url = `api.php?action=get_property_companies&property_id=${propertyId}`;
        console.log('📡 API URL:', url);
        
        const response = await fetch(url);
        console.log('📡 API yanıtı:', response);
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📡 Raw response:', responseText);
        
        // Boş yanıt kontrolü
        if (!responseText || responseText.trim() === '') {
            console.log('⚠️ API boş yanıt döndürdü');
            displayExistingCompanies([]);
            return;
        }
        
        // HTML hatası kontrolü
        if (responseText.includes('<br />') || responseText.includes('<b>')) {
            throw new Error('API HTML hatası döndürüyor: ' + responseText.substring(0, 100));
        }
        
        const result = JSON.parse(responseText);
        console.log('🏢 Şirket ilişkileri:', result);
        
        if (result.success) {
            displayExistingCompanies(result.companies || []);
        } else {
            console.log('❌ API başarısız:', result.message);
            displayExistingCompanies([]);
        }
        
    } catch (error) {
        console.error('❌ Şirket ilişkileri yüklenirken hata:', error);
        console.log('❌ Hata detayı:', error.message);
        displayExistingCompanies([]);
    }
}

// Mevcut şirketleri göster
function displayExistingCompanies(companies) {
    console.log('🔄 displayExistingCompanies çağrıldı:', companies);
    
    // Alt taraftaki "Mevcut Şirket İlişkileri" bölümü kaldırıldı.
    // Sadece üstteki Şirket İlişkisi satırı (updateCompanyRelationRow) kullanılacak.
    updateCompanyRelationRow(companies);
}

// Şirket silme butonları için event delegation - Modal içinde
// Alt taraftaki şirket ilişkileri listesi kaldırıldığı için,
// modal içi remove-company-btn event delegation da iptal edildi.

// Şirket İlişkisi satırını güncelle
function updateCompanyRelationRow(companies) {
    console.log('🔄 updateCompanyRelationRow çağrıldı:', companies);
    
    const relationCell = document.getElementById('oznitelik:sirket_iliskisi');
    const textSpan = document.getElementById('company-relations-text');
    
    if (!relationCell) {
        console.log('❌ oznitelik:sirket_iliskisi element bulunamadı!');
        return;
    }
    
    console.log('✅ oznitelik:sirket_iliskisi element bulundu');
    
    if (!companies || companies.length === 0) {
        if (textSpan) {
            textSpan.innerHTML = '';
        } else {
            relationCell.innerHTML = '';
        }
        return;
    }
    
    const safeNames = companies
        .map(c => (c && c.name ? c.name : ''))
        .filter(Boolean);
    
    const html = `
        <span class="text-success">
            <i class="fas fa-building me-1"></i>
            <strong>${safeNames.join(', ')}</strong>
        </span>
    `;

    if (textSpan) {
        textSpan.innerHTML = html;
    } else {
        relationCell.innerHTML = html;
    }
}

// Şirket İlişkisi satırını firm-name-label'dan güncelle
// NOT: Bu fonksiyon, sadece gerçekten ilişkili şirketler için kullanılır.
// Genel "seçili şirket" durumunu popup'a yansıtmaz; ilişkiler backend'den gelen liste ile güncellenir.
function updateCompanyRelationFromFirmLabel() {
    console.log('ℹ️ updateCompanyRelationFromFirmLabel çağrıldı (artık ilişkileri tek başına belirlemiyor).');
    // İlişki satırı asıl olarak loadPropertyCompanyRelations -> updateCompanyRelationRow ile güncelleniyor.
    // Burada ekstra bir güncelleme yapılmıyor ki, seçili şirket tüm parsellerde ilişki gibi görünmesin.
}

// Şirketleri arama için yükle
async function loadCompaniesForSearch() {
    console.log('🔄 Şirketler arama için yükleniyor...');
    try {
        // Önce global storage'dan kontrol et
        if (window.allCompanies && window.allCompanies.length > 0) {
            console.log('✅ Şirketler zaten yüklü:', window.allCompanies.length, 'şirket');
            populateCompanyDropdown(window.allCompanies);
            return;
        }
        
        const response = await fetch('api.php?action=get_companies_summary');
        console.log('📡 API yanıtı:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📡 Raw response:', responseText);
        
        // Boş yanıt kontrolü
        if (!responseText || responseText.trim() === '') {
            console.log('⚠️ API boş yanıt döndürdü');
            window.allCompanies = [];
            return;
        }
        
        // HTML hatası kontrolü
        if (responseText.includes('<br />') || responseText.includes('<b>')) {
            throw new Error('API HTML hatası döndürüyor: ' + responseText.substring(0, 100));
        }
        
        const companies = JSON.parse(responseText);
        console.log('🏢 Şirketler:', companies);
        
        // Şirketleri global değişkende sakla
        window.allCompanies = companies;
        
        // Dropdown'ı doldur
        populateCompanyDropdown(companies);
        
        console.log('✅ Şirketler yüklendi ve saklandı');
    } catch (error) {
        console.error('❌ Şirketler yüklenirken hata:', error);
        console.log('❌ Hata detayı:', error.message);
        // Hata durumunda boş array kullan
        window.allCompanies = [];
    }
}

// Şirket dropdown'unu doldur
function populateCompanyDropdown(companies) {
    const selectElement = document.getElementById('newCompanySearch');
    if (!selectElement) {
        console.log('❌ newCompanySearch select bulunamadı!');
        return;
    }
    
    // Mevcut seçenekleri temizle (ilk seçenek hariç)
    selectElement.innerHTML = '<option value="">Şirket seçiniz veya yeni şirket oluşturun...</option>';
    
    // Şirketleri ekle
    if (companies && companies.length > 0) {
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name || company.company_name;
            selectElement.appendChild(option);
        });
        console.log('✅ Şirketler dropdown\'a eklendi:', companies.length, 'şirket');
    } else {
        console.log('⚠️ Şirket listesi boş');
    }
}

// Mevcut Prolegal ID'yi al
function getCurrentProlegalId() {
    console.log('🔍 Prolegal ID aranıyor...');
    
    // 1. Modal içindeki ID elementini bul
    const idElement = document.getElementById('oznitelik:id');
    if (idElement && idElement.value) {
        console.log('✅ Modal içinden ID bulundu:', idElement.value);
        return idElement.value;
    }
    
    // 2. currentPanel global değişkeninden al
    if (window.currentPanel && window.currentPanel.properties) {
        const id = window.currentPanel.properties.id;
        console.log('✅ currentPanel\'den ID bulundu:', id);
        return id;
    }
    
    // 3. Modal içindeki diğer ID elementlerini kontrol et
    const altIdElement = document.querySelector('[id*="id"], [id*="Id"]');
    if (altIdElement && altIdElement.textContent) {
        const id = altIdElement.textContent.trim();
        console.log('✅ Alternatif ID elementinden bulundu:', id);
        return id;
    }
    
    console.log('❌ Prolegal ID bulunamadı');
    return null;
}

// Prolegal notu düzenleme fonksiyonları
function initializeProlegalNoteEditing() {
    const editBtn = document.getElementById('editProlegalNoteBtn');
    const saveBtn = document.getElementById('saveProlegalNoteBtn');
    const cancelBtn = document.getElementById('cancelProlegalNoteBtn');
    const displayDiv = document.getElementById('prolegalNoteDisplay');
    const editDiv = document.getElementById('prolegalNoteEdit');
    const noteText = document.getElementById('prolegalNoteText');
    const textarea = document.getElementById('oznitelik-prolegal-not');
    
    // Textarea kullanım flag'i
    let isTextareaInUse = false;
    
    if (!editBtn || !saveBtn || !cancelBtn || !displayDiv || !editDiv || !noteText || !textarea) {
        console.log('❌ Prolegal notu elementleri bulunamadı!');
        return;
    }
    
    // Değerlendirme dropdown'ına event listener ekle
    const degerlendirmeSelect = document.getElementById('oznitelik:not_rating');
    if (degerlendirmeSelect) {
        degerlendirmeSelect.addEventListener('change', function() {
            console.log('🔄 Değerlendirme değişti:', this.value);
            // Kaydetme butonunu kontrol et
            updateSaveButtonState();
        });
    }
    
    // Kaydetme butonunun durumunu güncelle
    function updateSaveButtonState() {
        const degerlendirme = document.getElementById('oznitelik:not_rating')?.value;
        const notContent = textarea?.value?.trim() || '';
        const hasNote = notContent.length > 0;
        const hasRating = degerlendirme && degerlendirme !== '';
        
        console.log('🔍 Buton durumu kontrol:', { hasNote, hasRating, degerlendirme, notLen: notContent.length });
        
        if (hasNote && hasRating) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
            console.log('✅ Kaydetme butonu aktif edildi');
        } else {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
            console.log('❌ Kaydetme butonu deaktif - Not:', hasNote, 'Rating:', hasRating);
        }
    }
    
    // Textarea event listener'ları - Debounce ile performans
    let inputTimeout;
    textarea.addEventListener('input', function() {
        clearTimeout(inputTimeout);
        isTextareaInUse = true;
        window.isProlegalNoteInUse = true;
        
        // Kaydetme butonunun durumunu güncelle
        updateSaveButtonState();
        
        // Debounce: 300ms sonra flag'i güncelle
        inputTimeout = setTimeout(() => {
            // Input bitti, flag'i güncelle
        }, 300);
    });
    
    // Focus/blur sadece gerekli olduğunda
    let focusTimeout;
    textarea.addEventListener('focus', function() {
        clearTimeout(focusTimeout);
        isTextareaInUse = true;
        window.isProlegalNoteInUse = true;
    });
    
    textarea.addEventListener('blur', function() {
        // Blur'da hemen değil, biraz bekle
        focusTimeout = setTimeout(() => {
            isTextareaInUse = false;
            window.isProlegalNoteInUse = false;
        }, 500); // 100ms'den 500ms'ye çıkardık
    });

    // Düzenle butonuna tıklama
    editBtn.addEventListener('click', function() {
        displayDiv.classList.add('d-none');
        editDiv.classList.remove('d-none');
        textarea.focus();
    });
    
    // Kaydet butonuna tıklama
    saveBtn.addEventListener('click', async function() {
        // Çift tıklamayı engelle
        if (saveBtn.disabled) {
            console.log('🚫 Kaydet butonu zaten işleniyor, atlanıyor');
            return;
        }
        
        saveBtn.disabled = true;
        console.clear();
        console.log('[SAVE] click', new Date().toISOString());
        
        // Textarea'yı güvenli şekilde al
        const textarea = document.getElementById('oznitelik:prolegal_not') 
                      || document.getElementById('oznitelik-prolegal-not');
        const noteContent = textarea?.value?.trim() ?? '';
        const prolegalId = getCurrentProlegalId();
        
        console.log({ prolegalId, noteLen: noteContent.length, notePreview: noteContent.slice(0,50) });
        
        if (!prolegalId) { 
            console.error('❌ Prolegal ID yok'); 
            alert('Prolegal ID bulunamadı!');
            return; 
        }
        
        // Validasyon: Değerlendirme seçilmiş mi? (0 = Seçiniz, geçerli)
        const degerlendirme = document.getElementById('oznitelik:not_rating')?.value;
        if (!degerlendirme) {
            alert('Değerlendirme seçilmelidir!');
            return;
        }
        
        if (!noteContent) { 
            alert('Prolegal notu boş olamaz!');
            return;
        }
        
        try {
            // API'ye kaydet - URL-encoded format (hem not hem değerlendirme)
            const body = new URLSearchParams({
                action: 'save_prolegal_note',
                prolegal_id: prolegalId,
                prolegal_not: noteContent,
                not_rating: degerlendirme
            });
            console.log('📤 API Request body:', body.toString());
            
            const response = await fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body
            });
            
            console.log('📡 HTTP', response.status, response.statusText);
            
            // Response'u güvenli parse et
            let result;
            try {
                const responseText = await response.text();
                console.log('📡 BODY', responseText);
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ JSON Parse Error:', parseError);
                result = { success: false, message: 'Response parse hatası' };
            }
            
            console.log('📡 Response data:', result);
            
            // Debug bilgilerini yazdır
            if (result.debug) {
                console.log('🔍 DEBUG INFO:');
                console.log('  - Prolegal ID:', result.debug.prolegalId);
                console.log('  - Prolegal Note:', result.debug.prolegalNote);
                console.log('  - Not Rating:', result.debug.notRating);
                console.log('  - Current Data:', result.debug.currentData);
                console.log('  - SQL Query:', result.debug.sql);
            }
            
            if (result.success) {
                // UI'yi güncelle
                if (noteContent) {
                    noteText.innerHTML = `<span class="text-dark">${noteContent}</span>`;
                } else {
                    noteText.innerHTML = '<span class="text-muted"></span>';
                }
                
                // Textarea ve dropdown'ı yeni değerle senkronize et
                if (textarea) {
                    textarea.value = noteContent;
                }
                const ratingSelect = document.getElementById('oznitelik:not_rating');
                if (ratingSelect) {
                    ratingSelect.value = degerlendirme;
                }
                
                // Mevcut liste verisini de güncelle ki modal yeniden açıldığında not görünsün
                try {
                    const stores = [];
                    if (window.propertyData && Array.isArray(window.propertyData)) stores.push(window.propertyData);
                    if (typeof propertyData !== 'undefined' && Array.isArray(propertyData)) stores.push(propertyData);
                    stores.forEach(store => {
                        const match = store.find(item => item?.data?.properties?.id == prolegalId);
                        if (match?.data?.properties) {
                            match.data.properties.prolegal_not = noteContent;
                            match.data.properties.not_rating = degerlendirme;
                        }
                    });
                } catch (e) {
                    console.warn('⚠️ propertyData senkronizasyonu başarısız:', e);
                }
                
                displayDiv.classList.remove('d-none');
                editDiv.classList.add('d-none');
                
                console.log('✅ Prolegal notu kaydedildi');
                console.log('📊 Affected rows:', result.affected_rows);
                
                // Başarı toast göster
                if (result.affected_rows > 0) {
                    console.log('🎉 Veritabanında güncelleme yapıldı');
                } else {
                    console.warn('⚠️ Veritabanında değişiklik yapılmadı (affected_rows=0)');
                }
            } else {
                console.error('❌ Backend hatası:', result);
                alert('Hata: ' + (result.message || 'Not kaydedilemedi'));
            }
        } catch (error) {
            console.error('❌ Prolegal notu kaydetme hatası:', error);
            alert('Hata: Not kaydedilemedi');
        } finally {
            // Butonu tekrar aktif et
            saveBtn.disabled = false;
        }
    });
    
    // İptal butonuna tıklama
    cancelBtn.addEventListener('click', function() {
        // Orijinal değeri geri yükle
        const originalNote = noteText.textContent;
        if (originalNote === '' || originalNote.trim() === '') {
            textarea.value = '';
        } else {
            textarea.value = originalNote;
        }
        
        displayDiv.classList.remove('d-none');
        editDiv.classList.add('d-none');
    });
    
    console.log('✅ Prolegal notu düzenleme fonksiyonları yüklendi');
}


// Şirket arama fonksiyonu - YENİ
function searchCompanies(searchTerm) {
    const dropdown = document.getElementById('companySearchDropdown');
    const newCompanyOption = document.getElementById('createNewCompanyOption');
    const newCompanyName = document.getElementById('newCompanyNameDisplay');
    
    if (!dropdown) {
        console.log('❌ companySearchDropdown bulunamadı!');
        return;
    }
    
    if (!searchTerm || searchTerm.length < 2) {
        dropdown.style.display = 'none';
        if (newCompanyOption) newCompanyOption.style.display = 'none';
        return;
    }
    
    // Şirketleri filtrele
    const filteredCompanies = window.allCompanies.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Dropdown'ı temizle
    dropdown.innerHTML = '';
    
    if (filteredCompanies.length > 0) {
        // Filtrelenmiş şirketleri ekle
        filteredCompanies.forEach(company => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<i class="fas fa-building"></i> ${company.name} <small class="text-muted">(ID: ${company.id})</small>`;
            item.dataset.companyId = company.id;
            item.dataset.companyName = company.name;
            
            item.addEventListener('click', function() {
                selectCompanyForAddition(company.id, company.name);
            });
            
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
    
    // Yeni şirket seçeneğini kontrol et
    if (newCompanyOption && newCompanyName) {
        const exactMatch = window.allCompanies.find(company => 
            company.name.toLowerCase() === searchTerm.toLowerCase()
        );
        
        if (!exactMatch && searchTerm.length >= 2) {
            newCompanyName.textContent = searchTerm;
            newCompanyOption.style.display = 'block';
        } else {
            newCompanyOption.style.display = 'none';
        }
    }
}

// Şirket seçme fonksiyonu - YENİ
function selectCompanyForAddition(companyId, companyName) {
    const input = document.getElementById('newCompanySearch');
    const dropdown = document.getElementById('companySearchDropdown');
    const newCompanyOption = document.getElementById('createNewCompanyOption');
    
    if (!input) {
        console.log('❌ newCompanySearch input bulunamadı!');
        return;
    }
    
    input.value = companyName;
    input.dataset.selectedCompanyId = companyId;
    
    if (dropdown) dropdown.style.display = 'none';
    if (newCompanyOption) newCompanyOption.style.display = 'none';
    
    // Onay mesajını göster
    showConfirmationMessage(companyName);
    
    console.log('✅ Şirket seçildi:', companyName, 'ID:', companyId);
}

// Onay mesajını göster
function showConfirmationMessage(companyName) {
    const propertyId = document.getElementById('oznitelik:id')?.textContent;
    const propertyAda = document.getElementById('oznitelik:ada')?.textContent;
    const propertyParsel = document.getElementById('oznitelik:parsel')?.textContent;
    
    const confirmationText = document.getElementById('confirmationText');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmBtn = document.getElementById('confirmAddToCompanyBtn');
    
    if (confirmationText && confirmationMessage && confirmBtn) {
        confirmationText.textContent = `Bu araziyi "${companyName}" şirketine eklemek istediğinize emin misiniz?`;
        confirmationMessage.style.display = 'block';
        confirmBtn.style.display = 'block';
        
        // Onay butonuna event listener ekle
        confirmBtn.onclick = function() {
            addPropertyToCompany(propertyId, companyName);
        };
    } else {
        console.log('❌ Onay mesajı elementleri bulunamadı!');
    }
}

// Araziyi şirkete ekle
async function addPropertyToCompany(propertyId, companyName) {
    console.log('🔄 Araziyi şirkete ekleniyor...', propertyId, companyName);
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_property_to_company',
                property_id: propertyId,
                company_name: companyName
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Arazi başarıyla şirkete eklendi!');
            
            // Şirket ilişkilerini yeniden yükle
            loadPropertyCompanyRelations(propertyId);
            
            // Onay mesajını gizle
            const confirmationMessage = document.getElementById('confirmationMessage');
            const confirmBtn = document.getElementById('confirmAddToCompanyBtn');
            if (confirmationMessage) confirmationMessage.style.display = 'none';
            if (confirmBtn) confirmBtn.style.display = 'none';
            
            // Input'u temizle
            const input = document.getElementById('newCompanySearch');
            if (input) input.value = '';
            
        } else {
            alert('Hata: ' + result.message);
        }
        
    } catch (error) {
        console.error('❌ Arazi eklenirken hata:', error);
        alert('Arazi eklenirken hata oluştu!');
    }
}

// Şirket ilişkisini kaldır
async function removeCompanyRelation(companyId, companyName) {
    console.log('🗑️ removeCompanyRelation çağrıldı:', { companyId, companyName });
    
    if (!confirm(`"${companyName}" şirketi ile olan ilişkiyi kaldırmak istediğinize emin misiniz?`)) {
        console.log('❌ Kullanıcı silme işlemini iptal etti');
        return;
    }
    
    const propertyId = document.getElementById('oznitelik:id')?.textContent;
    if (!propertyId) {
        alert('Arazi ID bulunamadı!');
        return;
    }
    
    console.log('✅ Property ID bulundu:', propertyId);
    
    try {
        console.log('📡 API çağrısı yapılıyor...');
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=remove_property_from_company&property_id=${propertyId}&company_id=${companyId}`
        });
        
        console.log('📡 API yanıtı:', response.status);
        const result = await response.json();
        console.log('📡 API sonucu:', result);
        
        if (result.success) {
            alert(`"${companyName}" şirketi ile olan ilişki kaldırıldı!`);
            console.log('🔄 Şirket ilişkileri yeniden yükleniyor...', propertyId);
            // Listeyi yenile
            loadPropertyCompanyRelations(propertyId);
        } else {
            alert('Hata: ' + (result.message || 'İlişki kaldırılamadı.'));
        }
    } catch (error) {
        console.error('❌ İlişki kaldırma hatası:', error);
        alert('Hata: İlişki kaldırılamadı.');
    }
}

// Yeni şirket oluşturma fonksiyonu
async function createNewCompany(companyName) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=create_company&company_name=${encodeURIComponent(companyName)}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Yeni şirket oluşturuldu:', result.company);
            selectCompany(result.company.id, result.company.name);
            alert(`Yeni şirket "${companyName}" başarıyla oluşturuldu!`);
        } else {
            alert('Hata: ' + (result.message || 'Şirket oluşturulamadı.'));
        }
    } catch (error) {
        console.error('❌ Şirket oluşturma hatası:', error);
        alert('Hata: Şirket oluşturulamadı.');
    }
}

// Manuel input event handler - OPTIMIZED
document.addEventListener('DOMContentLoaded', function() {
    const manualInput = document.getElementById('newCompanyManualInput');
    if (manualInput && !manualInput.hasAttribute('data-global-listener-added')) {
        manualInput.setAttribute('data-global-listener-added', 'true');
        
        // OPTIMIZED INPUT EVENT
        let inputTimeout;
        manualInput.addEventListener('input', function() {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                // Minimal DOM query - sadece gerekli butonları kontrol et
                const createAndAddBtn = document.getElementById('createAndAddToCompanyBtn');
                if (createAndAddBtn) {
                    const hasValue = this.value.trim().length > 0;
                    createAndAddBtn.hidden = !hasValue;
                    if (hasValue) {
                        createAndAddBtn.dataset.companyName = this.value.trim();
                    }
                }
            }, 300); // Daha kısa debounce - daha responsive
        }, { passive: true });
    }
    
    // Durum güncelleme butonu
    const updateStatusBtn = document.getElementById('updateStatusBtn');
    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', async function() {
            const propertyId = document.getElementById('selectedPropertyId').textContent;
            const uygunlukDurumu = document.getElementById('updateUygunlukDurumu').value;
            const sorgulamaDurumu = document.getElementById('updateSorgulamaDurumu').value;
            const basvuruDurumu = document.getElementById('updateBasvuruDurumu').value;
            
            if (!propertyId || propertyId === '-') {
                alert('Lütfen bir arazi seçiniz!');
                return;
            }
            
            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=update_property_status&property_id=${propertyId}&uygunluk_durumu=${encodeURIComponent(uygunlukDurumu)}&sorgulama_durumu=${encodeURIComponent(sorgulamaDurumu)}&basvuru_durumu=${encodeURIComponent(basvuruDurumu)}`
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Durumlar başarıyla güncellendi!');
                    // Sol sidebar'daki listeyi yenile
                    if (typeof refreshPropertyList === 'function') {
                        refreshPropertyList();
                    }
                } else {
                    alert('Hata: ' + (result.message || 'Durumlar güncellenemedi.'));
                }
            } catch (error) {
                console.error('❌ Durum güncelleme hatası:', error);
                alert('Hata: Durumlar güncellenemedi.');
            }
        });
    }
    
    // Sorgu kayıtlarını yükle butonu
    const loadQueryRecordsBtn = document.getElementById('loadQueryRecordsBtn');
    if (loadQueryRecordsBtn) {
        loadQueryRecordsBtn.addEventListener('click', function() {
            loadQueryRecords();
        });
    }
    
    // Sorguya gönder butonu (sağ sidebar)
    const sendSelectedToQueryBtn = document.getElementById('sendSelectedToQueryBtn');
    if (sendSelectedToQueryBtn) {
        sendSelectedToQueryBtn.addEventListener('click', async function() {
            const selectedCheckboxes = document.querySelectorAll('.query-record-checkbox:checked');
            const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            
            if (selectedIds.length === 0) {
                alert('Lütfen en az bir kayıt seçiniz!');
                return;
            }
            
            if (!confirm(`${selectedIds.length} kayıt sorguya gönderilecek. Emin misiniz?`)) {
                return;
            }
            
            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=send_to_query&property_ids=${selectedIds.join(',')}`
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(`${selectedIds.length} kayıt başarıyla sorguya gönderildi!`);
                    loadQueryRecords(); // Listeyi yenile
                    loadQueryHistory(); // Geçmişi yenile
                } else {
                    alert('Hata: ' + (result.message || 'Kayıtlar sorguya gönderilemedi.'));
                }
            } catch (error) {
                console.error('❌ Sorguya gönderme hatası:', error);
                alert('Hata: Kayıtlar sorguya gönderilemedi.');
            }
        });
    }
    
    // Sol sidebar'dan sorgu yönetimine gönder butonu
    const sendToQueryManagementBtn = document.getElementById('sendToQueryManagementBtn');
    if (sendToQueryManagementBtn) {
        sendToQueryManagementBtn.addEventListener('click', function() {
            sendSelectedPropertiesToQueryManagement();
        });
    }
    
    // Sol sidebar liste tabındaki sorguya gönder butonu
    const sendToListQueryBtn = document.getElementById('sendToListQueryBtn');
    if (sendToListQueryBtn) {
        sendToListQueryBtn.addEventListener('click', async function() {
            const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
            
            if (selectedCheckboxes.length === 0) {
                alert('Lütfen en az bir arazi seçiniz!');
                return;
            }
            
            const selectedIds = Array.from(selectedCheckboxes).map(cb => {
                const row = cb.closest('tr');
                return row.querySelector('td:nth-child(2)').textContent; // Prolegal ID
            });
            
            if (!confirm(`${selectedIds.length} kayıt sorguya gönderilecek. Emin misiniz?`)) {
                return;
            }
            
            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=send_to_query&property_ids=${selectedIds.join(',')}`
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(`${selectedIds.length} kayıt başarıyla sorguya gönderildi!`);
                    // Sol sidebar'daki listeyi yenile
                    if (typeof refreshPropertyList === 'function') {
                        refreshPropertyList();
                    }
                } else {
                    alert('Hata: ' + (result.message || 'Kayıtlar sorguya gönderilemedi.'));
                }
            } catch (error) {
                console.error('❌ Sorguya gönderme hatası:', error);
                alert('Hata: Kayıtlar sorguya gönderilemedi.');
            }
        });
    }
    
    // Excel export butonu (sağ sidebar)
    const exportQueryRecordsBtn = document.getElementById('exportQueryRecordsBtn');
    if (exportQueryRecordsBtn) {
        exportQueryRecordsBtn.addEventListener('click', function() {
            const selectedCheckboxes = document.querySelectorAll('.query-record-checkbox:checked');
            const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            
            if (selectedIds.length === 0) {
                alert('Lütfen en az bir kayıt seçiniz!');
                return;
            }
            
            // Excel export için URL oluştur
            const exportUrl = `export_excel.php?action=export_query_records&ids=${selectedIds.join(',')}`;
            window.open(exportUrl, '_blank');
        });
    }
    
    // Sorgu yönetimi tabı şifre kontrolü ile korunuyor (assets/app.js'de)
});

// Şirkete ekleme onay butonu - YENİ
const confirmAddToCompanyBtn = document.getElementById('confirmAddToCompanyBtn');
if (confirmAddToCompanyBtn) {
    confirmAddToCompanyBtn.addEventListener('click', async function() {
        const propertyId = document.getElementById('oznitelik:id').textContent;
        const selectElement = document.getElementById('newCompanySearch');
        const manualInput = document.getElementById('newCompanyManualInput');
        
        let companyId, companyName;
        
        // Manuel input mu dropdown mu kontrol et
        if (manualInput.style.display !== 'none' && manualInput.value.trim()) {
            // Manuel input kullanılıyor
            companyName = manualInput.value.trim();
            companyId = 'new'; // Yeni şirket işareti
        } else if (selectElement.value) {
            // Dropdown kullanılıyor
            companyId = selectElement.value;
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            companyName = selectedOption.textContent.split(' (ID:')[0];
        } else {
            alert('Lütfen bir şirket seçiniz veya yeni şirket adı giriniz!');
            return;
        }
        
        if (!propertyId) {
            alert('Arazi bilgileri bulunamadı!');
            return;
        }
        
        try {
            let response;
            
            if (companyId === 'new') {
                // Yeni şirket oluştur
                response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=create_company&company_name=${encodeURIComponent(companyName)}`
                });
                
                const createResult = await response.json();
                
                if (createResult.success) {
                    companyId = createResult.company.id;
                    companyName = createResult.company.name;
                    alert(`Yeni şirket "${companyName}" oluşturuldu!`);
                } else {
                    alert('Hata: ' + (createResult.message || 'Şirket oluşturulamadı.'));
                    return;
                }
            }
            
            // Araziyi şirkete ekle
            response = await fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=add_property_to_company&property_id=${propertyId}&company_id=${companyId}`
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`Arazi başarıyla "${companyName}" şirketine eklendi!`);
                
                // Listeyi yenile
                loadPropertyCompanyRelations(propertyId);
                
                // Formu temizle
                selectElement.value = '';
                selectElement.dataset.selectedCompanyId = '';
                manualInput.value = '';
                manualInput.dataset.selectedCompanyId = '';
                document.getElementById('confirmationMessage').style.display = 'none';
                document.getElementById('confirmAddToCompanyBtn').style.display = 'none';
                
            } else {
                alert('Hata: ' + (result.message || 'Arazi şirkete eklenemedi.'));
            }
        } catch (error) {
            console.error('Şirkete ekleme hatası:', error);
            alert('Hata: Arazi şirkete eklenemedi.');
        }
    });
}

// Durum filtreleme butonları için event handler'lar
function initializeButtons() {
    console.log('🔧 Durum filtreleme butonları initializeButtons çalıştı');
    console.log('🔧 initializeButtons timestamp:', new Date().toISOString());
    
    // Uygun Olmayanlar butonu - ANA EVENT LISTENER
    console.log('🔧 Uygun Olmayanlar butonu ANA EVENT LISTENER ekleniyor...');
    const btnUygunOlmayanlar = document.getElementById('btnUygunOlmayanlar');
    console.log('🔍 btnUygunOlmayanlar butonu:', btnUygunOlmayanlar);
    
    if (btnUygunOlmayanlar) {
        console.log('✅ btnUygunOlmayanlar bulundu, ANA EVENT LISTENER ekleniyor...');
        
        // Sol frame mantığıyla aynı - loadStatusFilter kullan
        btnUygunOlmayanlar.addEventListener('click', async function() {
            console.log('🚨 Uygun Olmayanlar butonuna tıklandı!');
            setActiveButton(this);
            await loadStatusFilter('Uygun Değil', 'Uygun Olmayanlar');
        });
        
        console.log('✅ btnUygunOlmayanlar ANA EVENT LISTENER eklendi');
    } else {
        console.log('❌ btnUygunOlmayanlar butonu bulunamadı!');
    }
    
    
    // Kaydetme butonlarına event listener ekle
    console.log('🔧 DOM Content Loaded - Kaydetme butonları aranıyor...');
    
    const saveBtn = document.getElementById('saveProlegalDataBtn');
    
    console.log('🔍 saveBtn bulundu:', !!saveBtn);
    
    if (saveBtn) {
        console.log('✅ saveBtn event listener eklendi');
        saveBtn.addEventListener('click', saveProlegalData);
    } else {
        console.log('❌ saveBtn bulunamadı!');
    }
    
    // Sorgu yönetimi fonksiyonlarını başlat
    setupDropdownListeners();
    setupQueryManagementListeners();
}

// Test fonksiyonu kaldırıldı - sadece ana fonksiyon kalacak

// Sağ frame için liste güncelleme fonksiyonu
function updateListForRightFrame(data) {
    console.log('🔄 updateListForRightFrame çağrıldı, veri sayısı:', data.length);
    
    const tbody = document.getElementById('queryQueueTableBody');
    if (!tbody) {
        console.error('❌ queryQueueTableBody bulunamadı');
        return;
    }
    
    // Tabloyu temizle
    tbody.innerHTML = '';
    
    // Her veri için satır oluştur
    data.forEach((item, index) => {
        if (item.status === 200 && item.data && item.data.properties) {
            const props = item.data.properties;
            const requestIdFromProps = props.request_id || props.requestId || props.req_id || props.requestid;
            const row = document.createElement('tr');
            row.setAttribute('data-key', `${props.mahalleId}/${props.adaNo}/${props.parselNo}`);
            
            // Checkbox
            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input property-checkbox';
            checkbox.setAttribute('data-id', props.id);
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
            
            // Prolegal Taşınmaz No
            const idCell = document.createElement('td');
            if (requestIdFromProps) {
                idCell.innerHTML = `${props.id || ''}<br><span class="badge bg-primary" style="font-size:11px;">Talep #${requestIdFromProps}</span>`;
            } else {
                idCell.textContent = props.id;
            }
            row.appendChild(idCell);
            
            // İl
            const ilCell = document.createElement('td');
            ilCell.textContent = props.ilAd || '';
            row.appendChild(ilCell);
            
            // İlçe
            const ilceCell = document.createElement('td');
            ilceCell.textContent = props.ilceAd || '';
            row.appendChild(ilceCell);
            
            // Mahalle
            const mahalleCell = document.createElement('td');
            mahalleCell.textContent = props.mahalleAd || '';
            row.appendChild(mahalleCell);
            
            // Ada
            const adaCell = document.createElement('td');
            adaCell.textContent = props.adaNo || '';
            row.appendChild(adaCell);
            
            // Parsel
            const parselCell = document.createElement('td');
            parselCell.textContent = props.parselNo || '';
            row.appendChild(parselCell);
            
            // Alan
            const alanCell = document.createElement('td');
            alanCell.textContent = props.alan || '';
            row.appendChild(alanCell);
            
            // Nitelik
            const nitelikCell = document.createElement('td');
            nitelikCell.textContent = props.nitelik || '';
            row.appendChild(nitelikCell);
            
            // İmar Fonksiyonu
            const imarCell = document.createElement('td');
            imarCell.textContent = props.imarFonksiyon || '';
            row.appendChild(imarCell);
            
            // Uygunluk Durumu
            const durumCell = document.createElement('td');
            durumCell.textContent = props.durum || '';
            row.appendChild(durumCell);
            
            // Sorgu Durumu
            const sorguCell = document.createElement('td');
            sorguCell.textContent = props.sorguDurumu || '';
            row.appendChild(sorguCell);
            
            // Başvurulan Firma
            const firmaCell = document.createElement('td');
            firmaCell.textContent = props.basvurulan_firma || '';
            row.appendChild(firmaCell);
            
            // İşlemler
            const islemlerCell = document.createElement('td');
            islemlerCell.innerHTML = '<button class="btn btn-sm btn-outline-primary">Düzenle</button>';
            row.appendChild(islemlerCell);
            
            tbody.appendChild(row);
        }
    });
    
    // Tabloyu göster
    displayQueryQueue();
    
    console.log('✅ Sağ frame tablosu güncellendi, satır sayısı:', tbody.children.length);
}

// Sol sidebar'dan sağ frame'e sonuçları kopyalama fonksiyonu
function copyResultsToRightFrame() {
    console.log('🔄 copyResultsToRightFrame çağrıldı');
    
    // Sol sidebar'daki sonuç tablosunu bul
    const leftResultTable = document.getElementById('result-list');
    if (!leftResultTable) {
        console.log('❌ Sol sidebar result-list bulunamadı');
        showQueryQueueEmpty();
        return;
    }
    
    // Sol sidebar'daki satırları al
    const leftRows = leftResultTable.querySelectorAll('tr');
    console.log('📊 Sol sidebar\'da bulunan satır sayısı:', leftRows.length);
    
    if (leftRows.length === 0) {
        console.log('ℹ️ Sol sidebar\'da sonuç bulunamadı');
        showQueryQueueEmpty();
        return;
    }
    
    // Sağ frame'deki query queue tablosunu bul
    const rightFrameTable = document.getElementById('queryQueueTable');
    const rightFrameTableBody = document.getElementById('queryQueueTableBody');
    
    if (!rightFrameTable || !rightFrameTableBody) {
        console.error('❌ Sağ frame tablosu bulunamadı!');
        return;
    }
    
    // Önce mevcut içeriği temizle
    rightFrameTableBody.innerHTML = '';
    rightFrameTable.style.display = 'block';
    
    // Sol sidebar'daki her satırı sağ frame'e kopyala
    leftRows.forEach((leftRow, index) => {
        try {
            const rightRow = document.createElement('tr');
            
            // Sol sidebar'daki satırın data-key'ini al
            const dataKey = leftRow.getAttribute('data-key');
            if (dataKey) {
                rightRow.setAttribute('data-key', dataKey);
            }
            
            // Sol sidebar'daki satırın içeriğini kopyala ve sağ frame formatına uyarla
            const leftCells = leftRow.querySelectorAll('td');
            let cellIndex = 0;
            
            // Checkbox sütunu
            const checkboxCell = document.createElement('td');
            const leftCheckbox = leftCells[cellIndex]?.querySelector('input[type="checkbox"]');
            if (leftCheckbox) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input query-queue-checkbox';
                checkbox.setAttribute('data-id', leftCheckbox.getAttribute('data-id') || '');
                checkboxCell.appendChild(checkbox);
            }
            rightRow.appendChild(checkboxCell);
            cellIndex++;
            
            // Prolegal Taşınmaz No
            const idCell = document.createElement('td');
            idCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(idCell);
            cellIndex++;
            
            // İl
            const ilCell = document.createElement('td');
            ilCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(ilCell);
            cellIndex++;
            
            // İlçe
            const ilceCell = document.createElement('td');
            ilceCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(ilceCell);
            cellIndex++;
            
            // Mahalle
            const mahalleCell = document.createElement('td');
            mahalleCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(mahalleCell);
            cellIndex++;
            
            // Ada
            const adaCell = document.createElement('td');
            adaCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(adaCell);
            cellIndex++;
            
            // Parsel
            const parselCell = document.createElement('td');
            parselCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(parselCell);
            cellIndex++;
            
            // Alan
            const alanCell = document.createElement('td');
            alanCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(alanCell);
            cellIndex++;
            
            // Nitelik
            const nitelikCell = document.createElement('td');
            nitelikCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(nitelikCell);
            cellIndex++;
            
            // İmar Fonksiyonu
            const imarFonksiyonCell = document.createElement('td');
            imarFonksiyonCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(imarFonksiyonCell);
            cellIndex++;
            
            // Uygunluk Durumu - Dropdown olarak
            const durumCell = document.createElement('td');
            const durumSelect = document.createElement('select');
            durumSelect.className = 'form-select form-select-sm';
            durumSelect.setAttribute('data-field', 'durum');
            durumSelect.setAttribute('data-id', leftCheckbox?.getAttribute('data-id') || '');
            durumSelect.style.minWidth = '120px';
            
            const durumOptions = ['', 'Uygun', 'Uygun değil'];
            durumOptions.forEach(optionValue => {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue || 'Seçiniz';
                if (optionValue === (leftCells[cellIndex]?.textContent || '').trim()) {
                    option.selected = true;
                }
                durumSelect.appendChild(option);
            });
            durumCell.appendChild(durumSelect);
            rightRow.appendChild(durumCell);
            cellIndex++;
            
            // Sorgu Durumu - Dropdown olarak
            const sorguDurumCell = document.createElement('td');
            const sorguDurumSelect = document.createElement('select');
            sorguDurumSelect.className = 'form-select form-select-sm';
            sorguDurumSelect.setAttribute('data-field', 'sorgulama_durumu');
            sorguDurumSelect.setAttribute('data-id', leftCheckbox?.getAttribute('data-id') || '');
            sorguDurumSelect.style.minWidth = '120px';
            
            const sorguDurumOptions = ['', 'Sırada', 'Sorguda', 'Sorgulandı'];
            sorguDurumOptions.forEach(optionValue => {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue || 'Seçiniz';
                if (optionValue === (leftCells[cellIndex]?.textContent || '').trim()) {
                    option.selected = true;
                }
                sorguDurumSelect.appendChild(option);
            });
            sorguDurumCell.appendChild(sorguDurumSelect);
            rightRow.appendChild(sorguDurumCell);
            cellIndex++;
            
            // Başvurulan Firma
            const basvurulanFirmaCell = document.createElement('td');
            basvurulanFirmaCell.textContent = leftCells[cellIndex]?.textContent || '';
            rightRow.appendChild(basvurulanFirmaCell);
            cellIndex++;
            
            // İşlemler sütunu
            const islemlerCell = document.createElement('td');
            const updateButton = document.createElement('button');
            updateButton.className = 'btn btn-sm btn-success';
            updateButton.setAttribute('onclick', `updateRecordStatus('${leftCheckbox?.getAttribute('data-id') || ''}')`);
            updateButton.setAttribute('title', 'Güncelle');
            updateButton.innerHTML = '<i class="fas fa-save"></i>';
            islemlerCell.appendChild(updateButton);
            rightRow.appendChild(islemlerCell);
            
            rightFrameTableBody.appendChild(rightRow);
            
        } catch (error) {
            console.error('Satır kopyalanırken hata:', error, leftRow);
        }
    });
    
    console.log('✅ Sol sidebar sonuçları sağ frame\'e kopyalandı, satır sayısı:', rightFrameTableBody.children.length);
    
    // Checkbox'lar için event listener'lar ekle
    rightFrameTableBody.querySelectorAll('.query-queue-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (typeof updateSelectedQueryQueueProperties === 'function') {
                updateSelectedQueryQueueProperties();
            }
        });
    });
    
    // Loading ekranını gizle
    const loadingElement = document.getElementById('queryQueueLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

    // Sol sidebar'daki updateList fonksiyonunun sağ frame versiyonu
    async function updateListForRightFrame(data) {
    console.log('🔄 updateListForRightFrame çağrıldı');
    console.log('📊 Gelen veri:', data);
    console.log('📊 Veri uzunluğu:', data ? data.length : 'undefined');
    
    // Sağ frame'deki query queue tablosunu bul
    const rightFrameTable = document.getElementById('queryQueueTable');
    const rightFrameTableBody = document.getElementById('queryQueueTableBody');
    
    if (!rightFrameTable || !rightFrameTableBody) {
        console.error('❌ Sağ frame tablosu bulunamadı!');
        return;
    }
    
    // Önce mevcut içeriği temizle
    rightFrameTableBody.innerHTML = '';
    rightFrameTable.style.display = 'block';
    
    // Varsayılan sıralama: İl -> İlçe -> Mahalle -> Ada/Parsel (sol sidebar'daki mantığın aynısı)
    const sortedData = data.sort((a, b) => {
        try {
            // Güvenli veri erişimi
            const aProps = a.data?.properties || a.properties || a;
            const bProps = b.data?.properties || b.properties || b;
            
            const aIl = aProps.ilAd || aProps.il || '';
            const bIl = bProps.ilAd || bProps.il || '';
            
            if (aIl !== bIl) return aIl.localeCompare(bIl);
            
            const aIlce = aProps.ilceAd || aProps.ilce || '';
            const bIlce = bProps.ilceAd || bProps.ilce || '';
            
            if (aIlce !== bIlce) return aIlce.localeCompare(bIlce);
            
            const aMahalle = aProps.mahalleAd || aProps.mahalle || '';
            const bMahalle = bProps.mahalleAd || bProps.mahalle || '';
            
            if (aMahalle !== bMahalle) return aMahalle.localeCompare(bMahalle);
            
            const aAda = aProps.adaNo || aProps.ada || aProps.AdaBilgisi || '';
            const bAda = bProps.adaNo || bProps.ada || bProps.AdaBilgisi || '';
            
            if (aAda !== bAda) return aAda.localeCompare(bAda);
            
            const aParsel = aProps.parselNo || aProps.parsel || aProps.ParselBilgisi || '';
            const bParsel = bProps.parselNo || bProps.parsel || bProps.ParselBilgisi || '';
            
            return aParsel.localeCompare(bParsel);
        } catch (error) {
            console.error('Sıralama hatası:', error, a, b);
            return 0;
        }
    });

    // request_parcels eşleşmesi için parcel_id listesi çıkar (tapu_maliye Id)
    const parcelIds = Array.from(new Set(sortedData.map(item => {
        const p = item.data?.properties || item.properties || item;
        return p.id ? parseInt(p.id, 10) : null;
    }).filter(Boolean)));

    let parcelMap = {};
    if (parcelIds.length) {
        try {
            const resp = await fetch('api.php?action=list_request_parcels_by_parcel_ids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parcel_ids: parcelIds })
            });
            const json = await resp.json();
            if (json.success && Array.isArray(json.data)) {
                parcelMap = json.data.reduce((acc, row) => {
                    const pid = parseInt(row.parcel_id, 10);
                    if (pid) acc[pid] = row;
                    return acc;
                }, {});
            }
        } catch (err) {
            console.error('❌ request_parcels eşleşme sorgusu hatası:', err);
        }
    }

    // Sol sidebar'daki updateList mantığının sağ frame versiyonu
    sortedData.forEach(item => {
        try {
            const row = document.createElement('tr');
            
            // Veri yapısını kontrol et ve güvenli erişim sağla (sol sidebar'daki mantığın aynısı)
            const properties = item.data?.properties || item.properties || item;
            const mahalleId = properties.mahalleId || properties.mahalle_id || '';
            const adaNo = properties.adaNo || properties.ada || properties.AdaBilgisi || '';
            const parselNo = properties.parselNo || properties.parsel || properties.ParselBilgisi || '';
            
            // Mahalle ID, Ada, Parsel bilgilerinden key oluşturuluyor
            const key = `${mahalleId}/${adaNo}/${parselNo}`;
            
            row.setAttribute('data-key', key);
            
            // Ada ve Parsel'i ayrı ayrı al
            const ada = adaNo;
            const parsel = parselNo;
            
            // Sol sidebar'daki updateList mantığının sağ frame versiyonu
            const parcelId = properties.id ? parseInt(properties.id, 10) : null;
            const match = parcelId ? parcelMap[parcelId] : null;
            const reqId = match?.request_id || properties.request_id || properties.requestId || properties.req_id || properties.requestid;

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="form-check-input query-queue-checkbox" data-id="${properties.id || ''}">
                </td>
                <td>${properties.id || ''}${reqId ? `<br><span class="badge bg-primary" style="font-size:11px;">Talep #${reqId}</span>` : ''}</td>
                <td>${properties.ilAd || properties.il || ''}</td>
                <td>${properties.ilceAd || properties.ilce || ''}</td>
                <td>${properties.mahalleAd || properties.mahalle || ''}</td>
                <td>${ada}</td>
                <td>${parsel}</td>
                <td>${properties.alan || properties.YuzolcumBilgisi || ''}</td>
                <td>${properties.nitelik || properties.AnaTasinmazNitelik || ''}</td>
                <td>${properties.imarFonksiyon || properties.fonksiyon || ''}</td>
                <td>
                    <select class="form-select form-select-sm" data-field="durum" data-id="${properties.id || ''}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Uygun" ${(properties.durum || properties.Durum || properties.tapu_durum || '') === 'Uygun' ? 'selected' : ''}>Uygun</option>
                        <option value="Uygun değil" ${(properties.durum || properties.Durum || properties.tapu_durum || '') === 'Uygun değil' ? 'selected' : ''}>Uygun değil</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm" data-field="sorgulama_durumu" data-id="${properties.id || ''}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Sırada" ${(properties.sorguDurumu || properties.sorgulama_durumu || '') === 'Sırada' ? 'selected' : ''}>Sırada</option>
                        <option value="Sorguda" ${(properties.sorguDurumu || properties.sorgulama_durumu || '') === 'Sorguda' ? 'selected' : ''}>Sorguda</option>
                        <option value="Sorgulandı" ${(properties.sorguDurumu || properties.sorgulama_durumu || '') === 'Sorgulandı' ? 'selected' : ''}>Sorgulandı</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm" data-field="basvuru_turu" data-id="${properties.id || ''}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Küçük" ${(properties.basvuru_turu || '') === 'Küçük' ? 'selected' : ''}>Müşterisiz</option>
                        <option value="Büyük" ${(properties.basvuru_turu || '') === 'Büyük' ? 'selected' : ''}>Müşterili</option>
                    </select>
                </td>
                <td>${properties.basvurulan_firma || ''}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="updateRecordStatus('${properties.id || ''}')" title="Güncelle">
                        <i class="fas fa-save"></i>
                    </button>
                </td>
            `;
            rightFrameTableBody.appendChild(row);
        } catch (error) {
            console.error('Satır oluşturulurken hata:', error, item);
        }
    });
    
    console.log('✅ Sağ frame tablosuna eklenen satır sayısı:', rightFrameTableBody.children.length);
    
    // Checkbox'lar için event listener'lar ekle (sol sidebar'daki mantığın aynısı)
    rightFrameTableBody.querySelectorAll('.query-queue-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // updateSelectedProperties benzeri fonksiyon çağır
            if (typeof updateSelectedQueryQueueProperties === 'function') {
                updateSelectedQueryQueueProperties();
            }
        });
    });
    
    // Loading ekranını gizle
    const loadingElement = document.getElementById('queryQueueLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Sol sidebar sonuçlarını sağ frame'e kopyalama fonksiyon
function copyResultsToRightFrame() {
    console.log('🔄 Sol sidebar sonuçları sağ frame\'e kopyalanıyor...');
    
    // Sol sidebar'daki sonuç tablosunu bul
    const leftSidebarTable = document.querySelector('#result-list');
    if (!leftSidebarTable) {
        console.log('❌ Sol sidebar sonuç tablosu bulunamadı');
        return;
    }
    
    console.log('✅ Sol sidebar sonuç tablosu bulundu');
    
    // Sol sidebar'daki tüm satırları al
    const leftSidebarRows = leftSidebarTable.querySelectorAll('tr');
    console.log('📊 Sol sidebar satır sayısı:', leftSidebarRows.length);
    
    if (leftSidebarRows.length === 0) {
        console.log('❌ Sol sidebar\'da sonuç bulunamadı');
        return;
    }
    
    // Sağ frame'deki query queue tablosunu bul
    const rightFrameTable = document.getElementById('queryQueueTable');
    const rightFrameTableBody = document.getElementById('queryQueueTableBody');
    
    if (!rightFrameTable || !rightFrameTableBody) {
        console.log('❌ Sağ frame tablosu bulunamadı');
        return;
    }
    
    console.log('✅ Sağ frame tablosu bulundu');
    
    // Sol sidebar sonuçlarını sağ frame'e kopyala
    let rightFrameHTML = '';
    
    leftSidebarRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 13) { // En az 13 sütun olmalı
            const prolegalId = cells[1].textContent.trim();
            const il = cells[2].textContent.trim();
            const ilce = cells[3].textContent.trim();
            const mahalle = cells[4].textContent.trim();
            const ada = cells[5].textContent.trim();
            const parsel = cells[6].textContent.trim();
            const alan = cells[7].textContent.trim();
            const nitelik = cells[8].textContent.trim();
            const imarFonksiyon = cells[9].textContent.trim();
            const durum = cells[10].textContent.trim();
            const sorguDurumu = cells[11].textContent.trim();
            const basvuruTuru = cells[12].textContent.trim();
            const basvurulanFirma = cells[13] ? cells[13].textContent.trim() : '';
            
            rightFrameHTML += `
                <tr>
                    <td>
                        <input type="checkbox" class="form-check-input query-queue-checkbox" data-id="${prolegalId}">
                    </td>
                    <td>${prolegalId}</td>
                    <td>${il}</td>
                    <td>${ilce}</td>
                    <td>${mahalle}</td>
                    <td>${ada}</td>
                    <td>${parsel}</td>
                    <td>${alan}</td>
                    <td>${nitelik}</td>
                    <td>${imarFonksiyon}</td>
                    <td>
                        <select class="form-select form-select-sm" data-field="durum" data-id="${prolegalId}" style="min-width: 120px;">
                            <option value="">Seçiniz</option>
                            <option value="Uygun" ${durum === 'Uygun' ? 'selected' : ''}>Uygun</option>
                            <option value="Uygun değil" ${durum === 'Uygun değil' ? 'selected' : ''}>Uygun değil</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select form-select-sm" data-field="sorgulama_durumu" data-id="${prolegalId}" style="min-width: 120px;">
                            <option value="">Seçiniz</option>
                            <option value="Sırada" ${sorguDurumu === 'Sırada' ? 'selected' : ''}>Sırada</option>
                            <option value="Sorguda" ${sorguDurumu === 'Sorguda' ? 'selected' : ''}>Sorguda</option>
                            <option value="Sorgulandı" ${sorguDurumu === 'Sorgulandı' ? 'selected' : ''}>Sorgulandı</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select form-select-sm" data-field="basvuru_turu" data-id="${prolegalId}" style="min-width: 120px;">
                            <option value="">Seçiniz</option>
                            <option value="Küçük" ${basvuruTuru === 'Küçük' ? 'selected' : ''}>Müşterisiz</option>
                            <option value="Büyük" ${basvuruTuru === 'Büyük' ? 'selected' : ''}>Müşterili</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="updateRecordStatus('${prolegalId}')" title="Güncelle">
                            <i class="fas fa-save"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    });
    
    // Sağ frame tablosunu doldur
    rightFrameTableBody.innerHTML = rightFrameHTML;
    rightFrameTable.style.display = 'block';
    
    console.log('✅ Sol sidebar sonuçları sağ frame\'e kopyalandı');
    console.log('📊 Kopyalanan satır sayısı:', leftSidebarRows.length);
    
    // Checkbox event listener'larını ekle
    addQueryQueueCheckboxListeners();
}

// Direkt API çağrısı ile Uygun Olmayanlar yükleme fonksiyonu
async function loadUygunOlmayanlarDirectly() {
    console.log('🔄 Direkt API çağrısı ile Uygun Olmayanlar yükleniyor...');
    
    try {
        // API çağrısı yap
        const queryParams = new URLSearchParams({
            durum: 'Uygun değil'
        });
        
        const url = `api.php?${queryParams.toString()}`;
        console.log('📤 GET request URL:', url);
        
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json" }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        console.log('📡 API Yanıtı:', jsonResponse);
        
        if (Array.isArray(jsonResponse) && jsonResponse.length > 0) {
            console.log('✅ Uygun Olmayanlar başarıyla yüklendi, kayıt sayısı:', jsonResponse.length);
            
            // API'den gelen veriyi sağ frame formatına çevir
            const formattedData = jsonResponse.map(item => {
                return {
                    id: item.id || item.Id,
                    il: item.il || item.Il || '-',
                    ilce: item.ilce || item.Ilce || '-',
                    mahalle: item.mahalle || item.Mahalle || '-',
                    ada: item.ada || item.Ada || '-',
                    parsel: item.parsel || item.Parsel || '-',
                    alan: item.alan || item.Alan || '-',
                    nitelik: item.nitelik || item.Nitelik || '-',
                    imarFonksiyon: item.imarFonksiyon || item.ImarFonksiyon || '-',
                    durum: item.durum || item.Durum || '-',
                    sorguDurumu: item.sorguDurumu || item.SorguDurumu || '-',
                    basvuruTuru: item.basvuru_turu || item.BasvuruTuru || '-',
                    basvurulanFirma: item.basvurulan_firma || item.BasvurulanFirma || '-'
                };
            });
            
            // Sağ frame'e sonuçları göster
            displayQueryQueueDirectly(formattedData);
        } else {
            console.log('ℹ️ Uygun Olmayanlar için kayıt bulunamadı');
            showQueryQueueEmpty();
        }
    } catch (error) {
        console.error('❌ Uygun Olmayanlar yüklenirken hata:', error);
        showQueryQueueEmpty();
    }
}

// Direkt sonuçları sağ frame'e gösterme fonksiyonu
function displayQueryQueueDirectly(records) {
    console.log('📊 Direkt sonuçlar sağ frame\'e gösteriliyor:', records);
    
    // Sağ frame'deki query queue tablosunu bul
    const rightFrameTable = document.getElementById('queryQueueTable');
    const rightFrameTableBody = document.getElementById('queryQueueTableBody');
    
    if (!rightFrameTable || !rightFrameTableBody) {
        console.log('❌ Sağ frame tablosu bulunamadı');
        return;
    }
    
    console.log('✅ Sağ frame tablosu bulundu');
    
    // Sonuçları sağ frame'e kopyala
    let rightFrameHTML = '';
    
    records.forEach((record, index) => {
        rightFrameHTML += `
            <tr>
                <td>
                    <input type="checkbox" class="form-check-input query-queue-checkbox" data-id="${record.id}">
                </td>
                <td>${record.id}</td>
                <td>${record.il}</td>
                <td>${record.ilce}</td>
                <td>${record.mahalle}</td>
                <td>${record.ada}</td>
                <td>${record.parsel}</td>
                <td>${record.alan}</td>
                <td>${record.nitelik}</td>
                <td>${record.imarFonksiyon}</td>
                <td>${record.konu || '-'}</td>
                <td>
                    <select class="form-select form-select-sm" data-field="durum" data-id="${record.id}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Uygun" ${record.durum === 'Uygun' ? 'selected' : ''}>Uygun</option>
                        <option value="Uygun değil" ${record.durum === 'Uygun değil' ? 'selected' : ''}>Uygun değil</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm" data-field="sorgulama_durumu" data-id="${record.id}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Sırada" ${record.sorguDurumu === 'Sırada' ? 'selected' : ''}>Sırada</option>
                        <option value="Sorguda" ${record.sorguDurumu === 'Sorguda' ? 'selected' : ''}>Sorguda</option>
                        <option value="Sorgulandı" ${record.sorguDurumu === 'Sorgulandı' ? 'selected' : ''}>Sorgulandı</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm" data-field="basvuru_turu" data-id="${record.id}" style="min-width: 120px;">
                        <option value="">Seçiniz</option>
                        <option value="Küçük" ${record.basvuruTuru === 'Küçük' ? 'selected' : ''}>Müşterisiz</option>
                        <option value="Büyük" ${record.basvuruTuru === 'Büyük' ? 'selected' : ''}>Müşterili</option>
                    </select>
                </td>
                <td>${record.basvurulanFirma}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="updateRecordStatus('${record.id}')" title="Güncelle">
                        <i class="fas fa-save"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    // Sağ frame tablosunu doldur
    rightFrameTableBody.innerHTML = rightFrameHTML;
    rightFrameTable.style.display = 'block';
    
    console.log('✅ Direkt sonuçlar sağ frame\'e kopyalandı');
    console.log('📊 Kopyalanan satır sayısı:', records.length);
    
    // Checkbox event listener'larını ekle
    addQueryQueueCheckboxListeners();
}

    // Durum filtreleme butonlarına tıklama event'i ekle
    const durumFilterButtons = document.querySelectorAll('.durum-filter-btn');
    
    durumFilterButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Bu butonun ait olduğu label'ı bul
            const label = this.closest('label');
            if (label) {
                // Label'a ait checkbox'ı bul
                const checkbox = document.getElementById(label.getAttribute('for'));
                if (checkbox) {
                    // Checkbox'ı toggle et
                    checkbox.checked = !checkbox.checked;
                    
                    // Debug log
                    console.log('🎯 Durum filtresi tıklandı:', checkbox.id, 'Durum:', checkbox.checked);
                    
                    // Checkbox değişikliği event'ini tetikle
                    checkbox.dispatchEvent(new Event('change'));
                }
            }
        });
    });
    
    // Not rating filtreleme butonları için de aynı işlemi yap
    const notRatingFilterButtons = document.querySelectorAll('.not-rating-filter-btn');
    
    notRatingFilterButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Bu butonun ait olduğu label'ı bul
            const label = this.closest('label');
            if (label) {
                // Label'a ait checkbox'ı bul
                const checkbox = document.getElementById(label.getAttribute('for'));
                if (checkbox) {
                    // Checkbox'ı toggle et
                    checkbox.checked = !checkbox.checked;
                    
                    // Debug log
                    console.log('⭐ Not rating filtresi tıklandı:', checkbox.id, 'Durum:', checkbox.checked);
                    
                    // Checkbox değişikliği event'ini tetikle
                    checkbox.dispatchEvent(new Event('change'));
                }
            }
    });
});

// Şirket arama fonksiyonu (Modal için) - OPTİMİZE
document.addEventListener('DOMContentLoaded', function() {
    const modalSearchInput = document.getElementById('companySearchInputModal');
    if (modalSearchInput) {
        let searchTimeout;

        modalSearchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const searchTerm = this.value.trim().toLowerCase();

            // Debounce ile performans artır
            searchTimeout = setTimeout(() => {
        if (searchTerm === '') {
                    // Boşsa tüm şirketleri göster
            displayCompaniesForModal(window.allCompaniesModal || []);
        } else {
                    // Case-insensitive filtreleme
            const filteredCompanies = (window.allCompaniesModal || []).filter(company => 
                        (company.company_name || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
            displayCompaniesForModal(filteredCompanies);
        }
            }, 300); // 300ms bekleme süresi
        });
    }
});

// Şirketleri modal için yükle fonksiyonu
async function loadCompaniesForSelection() {
    console.log('Şirketler yükleniyor...');
    
    try {
        const response = await fetch('api.php?action=get_companies_summary');
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const companies = await response.json();
        console.log('API Response data:', companies);
        
        // Store companies globally for modal
        window.allCompaniesModal = companies;
        
        // Display companies in modal table
        displayCompaniesForModal(companies);
        
        console.log('Şirketler modal için yüklendi:', companies.length);
    } catch (error) {
        console.error('Şirketler yüklenirken hata:', error);
        const tableBody = document.getElementById('companyTableBodyModal');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Hata: Şirketler yüklenemedi - ' + error.message + '</td></tr>';
        }
    }
}

// Modal için şirketleri göster
function displayCompaniesForModal(companies) {
    console.log('displayCompaniesForModal called with:', companies);
    
    const tableBody = document.getElementById('companyTableBodyModal');
    if (!tableBody) {
        console.error('companyTableBodyModal not found!');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (!companies || companies.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Şirket bulunamadı</td></tr>';
        return;
    }
    
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="checkbox-column">
                <input type="radio" name="selectedCompany" value="${company.id}" class="form-check-input">
            </td>
            <td class="id-column">${company.id}</td>
            <td class="name-column">${company.company_name}</td>
            <td class="count-column">${company.property_count || 0}</td>
        `;
        tableBody.appendChild(row);
    });
    
    console.log('Companies displayed in modal table');
}

// Kaydet butonu event listener
document.addEventListener('click', function(e) {
    if (e.target.id === 'saveToCompanyBtn') {
        const selectedCompanyRadio = document.querySelector('input[name="selectedCompany"]:checked');
        
        if (!selectedCompanyRadio) {
            alert('Lütfen bir şirket seçin.');
            return;
        }
        
        const selectedCompanyId = selectedCompanyRadio.value;
        const selectedCompanyName = selectedCompanyRadio.closest('tr').querySelector('.name-column').textContent;
        
        // Mevcut arazi bilgilerini al
        const propertyData = getCurrentPropertyData();
        if (!propertyData) {
            alert('Arazi bilgileri alınamadı.');
            return;
        }
        
        // Şirkete arazi ekle
        addPropertyToCompany(selectedCompanyId, propertyData, selectedCompanyName);
    }
});

// Mevcut arazi bilgilerini al
function getCurrentPropertyData() {
    if (!currentPanel) return null;
    
    return {
        id: currentPanel.properties.id,
        il: currentPanel.properties.ilAd,
        ilce: currentPanel.properties.ilceAd,
        mahalle: currentPanel.properties.mahalleAd,
        ada: currentPanel.properties.adaNo,
        parsel: currentPanel.properties.parselNo,
        nitelik: currentPanel.properties.nitelik,
        alan: currentPanel.properties.alan
    };
}

// Şirkete arazi ekle
async function addPropertyToCompany(companyId, propertyData, companyName) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_property_to_company',
                company_id: companyId,
                property_data: propertyData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Arazi ${companyName} şirketine başarıyla eklendi.`);
            
            // Modal'ı kapat
            const companyModal = bootstrap.Modal.getInstance(document.getElementById('companySelectionModal'));
            companyModal.hide();
        } else {
            alert('Hata: ' + result.message);
        }
    } catch (error) {
        console.error('Şirkete arazi eklenirken hata:', error);
        alert('Hata: Arazi şirkete eklenemedi.');
    }
}

// Direkt şirkete arazi ekleme fonksiyonu (otomatik atama için)
async function addPropertyToCompanyDirect(propertyId, companyId, companyName) {
    console.log('🔄 addPropertyToCompanyDirect çağrıldı:', {
        propertyId: propertyId,
        companyId: companyId,
        companyName: companyName
    });
    
    try {
        // addPropertyToFirm mantığını kullan (JSON POST)
        const response = await fetch('api.php?action=addPropertyToFirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firmId: companyId,
                parcelKey: propertyId
            })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', response.headers);
        
        // Response'u text olarak al ve kontrol et
        const responseText = await response.text();
        console.log('📡 Response text:', responseText);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('API\'den boş yanıt alındı');
        }
        
        const result = JSON.parse(responseText);
        console.log('📡 Response data:', result);
        
        if (result.success) {
            console.log(`✅ Arazi başarıyla "${companyName}" şirketine eklendi!`);
            if (typeof TitleAlertMessage === 'function') {
                TitleAlertMessage(`✅ Arazi başarıyla "${companyName}" şirketine eklendi!`, 'success');
            }
            
            // Şirket ilişkilerini yeniden yükle
            console.log('🔄 Şirket ilişkileri yeniden yükleniyor...', propertyId);
            loadPropertyCompanyRelations(propertyId);
            
            // Dropdown'ı sıfırla
            const dropdown = document.getElementById('newCompanySearch');
            if (dropdown) {
                dropdown.value = '';
                console.log('✅ Dropdown sıfırlandı');
            }
        } else {
            console.log('❌ API Error:', result.message);
            const msg = result.message || 'Arazi şirkete eklenemedi';
            
            // Aynı şirketi iki kere ekleme girişimi için özel uyarı
            if (msg.includes('Bu arazi zaten bu şirkete ekli')) {
                if (typeof TitleAlertMessage === 'function') {
                    TitleAlertMessage('⚠️ Bu arazi zaten bu şirkete ekli.', 'warning');
                }
            } else {
                if (typeof TitleAlertMessage === 'function') {
                    TitleAlertMessage('❌ Hata: ' + msg, 'danger');
                }
            }
        }
    } catch (error) {
        console.error('❌ Şirkete arazi eklenirken hata:', error);
        if (typeof TitleAlertMessage === 'function') {
            TitleAlertMessage('❌ Hata: ' + error.message, 'danger');
        }
        throw error;
    }
}

// Prolegal verilerini kaydetme fonksiyonu
async function saveProlegalData() {
    // Doğru element ID'lerini kullan
    const prolegalNotElement = document.getElementById('oznitelik-prolegal-not');
    const prolegalNot = prolegalNotElement ? prolegalNotElement.value : '';
    
    // Prolegal notu display'den al (eğer textarea gizliyse)
    const prolegalNoteText = document.getElementById('prolegalNoteText');
    const prolegalNoteFromDisplay = prolegalNoteText ? prolegalNoteText.textContent.trim() : '';
    
    // Hangi prolegal notu kullanılacak?
    const finalProlegalNot = prolegalNot || prolegalNoteFromDisplay;
    
    const durum = document.getElementById('oznitelik:durum')?.value || '';
    const prolegalDegerlendirme = document.getElementById('oznitelik:not_rating')?.value || '';
    const prolegalId = document.getElementById('oznitelik:id')?.textContent;
    
    // Validasyon: Her ikisi de dolu olmalı
    if (!finalProlegalNot.trim()) {
        alert('Prolegal notu boş olamaz!');
        return;
    }
    
    if (!prolegalDegerlendirme) {
        alert('Değerlendirme seçilmelidir!');
        return;
    }
    
    if (!prolegalId) {
        alert('Prolegal ID bulunamadı!');
        return;
    }
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=save_prolegal_data&prolegal_id=${prolegalId}&prolegal_not=${encodeURIComponent(finalProlegalNot)}&durum=${encodeURIComponent(durum)}&not_rating=${encodeURIComponent(prolegalDegerlendirme)}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Prolegal verileri başarıyla kaydedildi!');
        } else {
            alert('Hata: ' + (result.message || 'Veriler kaydedilemedi'));
        }
    } catch (error) {
        console.error('Prolegal verileri kaydedilirken hata:', error);
        alert('Hata: Veriler kaydedilemedi.');
    }
}

// JavaScript dosyası yüklendi mi test et
// alert('ui.js dosyası yüklendi!'); // KALDIRILDI - çakışma yaratıyor

// Kaydetme butonlarına event listener ekle - MOVED TO MAIN DOMContentLoaded

// Sayfa yüklendiğinde de çalıştır (DOMContentLoaded çalışmazsa)
window.addEventListener('load', function() {
    
    // Window Load event'inde Uygun Olmayanlar butonu testleri kaldırıldı - ana DOMContentLoaded'da var
    setTimeout(function() {
        setupDropdownListeners();
        setupQueryManagementListeners();
    }, 2000);
});

// Test fonksiyonu - global olarak erişilebilir
window.testJavaScript = function() {
    console.log('🧪 JavaScript test fonksiyonu çalışıyor!');
    alert('JavaScript çalışıyor! Console\'u kontrol edin.');
    
    // Butonları test et
    const sendBtn = document.getElementById('sendToListQueryBtn');
    const updateBtn = document.getElementById('updateSelectedStatusBtn');
    const testBtn = document.getElementById('testJsBtn');
    
    console.log('🔍 Butonlar:', {
        sendBtn: !!sendBtn,
        updateBtn: !!updateBtn,
        testBtn: !!testBtn
    });
    
    // Sağ sidebar'ı test et
    const rightMenu = document.getElementById('rightMenu');
    const generalTab = document.querySelector('[data-tab="general"]');
    const generalTabPane = document.getElementById('general-tab');
    
    console.log('🔍 Sağ sidebar elementleri:', {
        rightMenu: !!rightMenu,
        generalTab: !!generalTab,
        generalTabPane: !!generalTabPane
    });
    
    // Dropdown'ları test et
    const dropdowns = [
        'basvuruDurumuDropdown',
        'prolegalDegerlendirmeDropdown',
        'sorguDurumuDropdown',
        'uygunlukDurumuDropdown'
    ];
    
    dropdowns.forEach(id => {
        const dropdown = document.getElementById(id);
        console.log(`🔍 ${id}:`, !!dropdown);
    });
    
    alert('Test tamamlandı! Console\'da detayları görebilirsiniz.');
};

// Dropdown event listener'larını kur
function setupDropdownListeners() {
    console.log('🔧 Dropdown event listener\'ları kuruluyor...');
    
    // Başvuru Durumu dropdown
    const basvuruDropdown = document.getElementById('basvuruDurumuDropdown');
    if (basvuruDropdown) {
        const dropdownMenu = basvuruDropdown.parentElement.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.addEventListener('click', function(e) {
                if (e.target.classList.contains('dropdown-item')) {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    const text = e.target.textContent;
                    basvuruDropdown.innerHTML = `<i class="fas fa-file-alt"></i> ${text}`;
                    basvuruDropdown.dataset.selectedValue = value;
                    console.log('✅ Başvuru durumu seçildi:', value, text);
                }
            });
            console.log('✅ Başvuru durumu dropdown listener eklendi');
        } else {
            console.log('❌ Başvuru durumu dropdown menu bulunamadı');
        }
    } else {
        console.log('❌ Başvuru durumu dropdown bulunamadı');
    }
    
    // Prolegal Değerlendirmesi dropdown
    const prolegalDegerlendirmeDropdown = document.getElementById('prolegalDegerlendirmeDropdown');
    if (prolegalDegerlendirmeDropdown) {
        const dropdownMenu = prolegalDegerlendirmeDropdown.parentElement.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.addEventListener('click', function(e) {
                if (e.target.classList.contains('dropdown-item')) {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    const text = e.target.textContent;
                    prolegalDegerlendirmeDropdown.innerHTML = `<i class="fas fa-star"></i> ${text}`;
                    prolegalDegerlendirmeDropdown.dataset.selectedValue = value;
                    console.log('✅ Prolegal değerlendirme seçildi:', value, text);
                }
            });
            console.log('✅ Prolegal değerlendirme dropdown listener eklendi');
        } else {
            console.log('❌ Prolegal değerlendirme dropdown menu bulunamadı');
        }
    } else {
        console.log('❌ Prolegal değerlendirme dropdown bulunamadı');
    }
    
    // Sorgu Durumu dropdown
    const sorguDurumuDropdown = document.getElementById('sorguDurumuDropdown');
    if (sorguDurumuDropdown) {
        const dropdownMenu = sorguDurumuDropdown.parentElement.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.addEventListener('click', function(e) {
                if (e.target.classList.contains('dropdown-item')) {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    const text = e.target.textContent;
                    sorguDurumuDropdown.innerHTML = `<i class="fas fa-search"></i> ${text}`;
                    sorguDurumuDropdown.dataset.selectedValue = value;
                    console.log('✅ Sorgu durumu seçildi:', value, text);
                }
            });
            console.log('✅ Sorgu durumu dropdown listener eklendi');
        } else {
            console.log('❌ Sorgu durumu dropdown menu bulunamadı');
        }
    } else {
        console.log('❌ Sorgu durumu dropdown bulunamadı');
    }
    
    // Uygunluk Durumu dropdown
    const uygunlukDurumuDropdown = document.getElementById('uygunlukDurumuDropdown');
    if (uygunlukDurumuDropdown) {
        const dropdownMenu = uygunlukDurumuDropdown.parentElement.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.addEventListener('click', function(e) {
                if (e.target.classList.contains('dropdown-item')) {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    const text = e.target.textContent;
                    uygunlukDurumuDropdown.innerHTML = `<i class="fas fa-check-circle"></i> ${text}`;
                    uygunlukDurumuDropdown.dataset.selectedValue = value;
                    console.log('✅ Uygunluk durumu seçildi:', value, text);
                }
            });
            console.log('✅ Uygunluk durumu dropdown listener eklendi');
        } else {
            console.log('❌ Uygunluk durumu dropdown menu bulunamadı');
        }
    } else {
        console.log('❌ Uygunluk durumu dropdown bulunamadı');
    }
}

// Sorgu yönetimi event listener'larını kur
function setupQueryManagementListeners() {
    
    // Sol sidebar liste tabındaki sorgu yönetimine gönder butonu
    const sendToListQueryBtn = document.getElementById('sendToListQueryBtn');
    console.log('🔍 sendToListQueryBtn bulundu:', !!sendToListQueryBtn);
    
    if (sendToListQueryBtn) {
        console.log('✅ sendToListQueryBtn event listener ekleniyor...');
        sendToListQueryBtn.addEventListener('click', function() {
            console.log('🖱️ sendToListQueryBtn tıklandı!');
            
            const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
            console.log('📋 Seçili checkbox sayısı:', selectedCheckboxes.length);
            
            // Alternatif yöntemle seçili checkbox'ları bul
            const allCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]');
            const selectedCheckboxesAlt = Array.from(allCheckboxes).filter(cb => cb.checked);
            console.log('📋 Alternatif yöntemle seçili checkbox sayısı:', selectedCheckboxesAlt.length);
            
            // Alternatif yöntemi kullan
            const finalSelectedCheckboxes = selectedCheckboxesAlt.length > 0 ? selectedCheckboxesAlt : selectedCheckboxes;
            
            if (finalSelectedCheckboxes.length === 0) {
                alert('Lütfen en az bir arazi seçiniz!');
                return;
            }
            
            if (selectedCheckboxes.length > 1) {
                alert('Lütfen sadece bir arazi seçiniz!');
                return;
            }
            
            // Sağ sidebar'daki sorgu yönetimi tabını aktif et
            const queryTab = document.querySelector('[data-tab="general"]');
            console.log('🔍 Sorgu yönetimi tab bulundu:', !!queryTab);
            
            if (queryTab) {
                console.log('🔄 Tab değiştirme işlemi başlatılıyor...');
                
                // Önce diğer tab'ları deaktif et
                document.querySelectorAll('#rightMenu .nav-link').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('#rightMenu .tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                
                // Sorgu yönetimi tabını aktif et
                queryTab.classList.add('active');
                const generalTabPane = document.getElementById('general-tab');
                console.log('🔍 general-tab pane bulundu:', !!generalTabPane);
                
                if (generalTabPane) {
                    generalTabPane.classList.add('active');
                    console.log('✅ Sorgu yönetimi tabı aktif edildi');
                } else {
                    console.log('❌ general-tab pane bulunamadı');
                }
            } else {
                console.log('❌ Sorgu yönetimi tabı bulunamadı');
            }
        });
        console.log('✅ sendToListQueryBtn event listener eklendi');
    } else {
        console.log('❌ sendToListQueryBtn bulunamadı!');
    }
    
    // Seçilenleri güncelle butonu
    const updateSelectedStatusBtn = document.getElementById('updateSelectedStatusBtn');
    console.log('🔍 updateSelectedStatusBtn bulundu:', !!updateSelectedStatusBtn);
    
    if (updateSelectedStatusBtn) {
        console.log('✅ updateSelectedStatusBtn event listener ekleniyor...');
        updateSelectedStatusBtn.addEventListener('click', updateSelectedPropertiesStatus);
        console.log('✅ updateSelectedStatusBtn event listener eklendi');
    } else {
        console.log('❌ updateSelectedStatusBtn bulunamadı!');
    }
    
    console.log('✅ setupQueryManagementListeners tamamlandı');
}

// Seçilen arazilerin durumlarını güncelle
async function updateSelectedPropertiesStatus() {
    console.log('🔄 Durum güncelleme başlatılıyor...');
    
    const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
    console.log('📋 Seçili checkbox sayısı:', selectedCheckboxes.length);
    
    if (selectedCheckboxes.length === 0) {
        alert('Lütfen en az bir arazi seçiniz!');
        return;
    }
    
    const selectedIds = Array.from(selectedCheckboxes).map(cb => {
        const row = cb.closest('tr');
        const id = row.querySelector('td:nth-child(2)').textContent; // Prolegal ID
        console.log('🆔 Seçilen ID:', id);
        return id;
    });
    
    // Seçilen değerleri all
    const basvuruDurumu = document.getElementById('basvuruDurumuDropdown')?.dataset.selectedValue;
    const prolegalDegerlendirme = document.getElementById('prolegalDegerlendirmeDropdown')?.dataset.selectedValue;
    const sorguDurumu = document.getElementById('sorguDurumuDropdown')?.dataset.selectedValue;
    const uygunlukDurumu = document.getElementById('uygunlukDurumuDropdown')?.dataset.selectedValue;
    
    console.log('📊 Seçilen değerler:', {
        basvuruDurumu,
        prolegalDegerlendirme,
        sorguDurumu,
        uygunlukDurumu
    });
    
    if (!basvuruDurumu && !prolegalDegerlendirme && !sorguDurumu && !uygunlukDurumu) {
        alert('Lütfen en az bir durum seçiniz!');
        return;
    }
    
    if (!confirm(`${selectedIds.length} arazinin durumları güncellenecek. Emin misiniz?`)) {
        return;
    }
    
    // Loading göster
    const updateBtn = document.getElementById('updateSelectedStatusBtn');
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Güncelleniyor...';
    updateBtn.disabled = true;
    
    try {
        const requestBody = `action=update_multiple_property_status&property_ids=${selectedIds.join(',')}&basvuru_durumu=${encodeURIComponent(basvuruDurumu || '')}&prolegal_degerlendirme=${encodeURIComponent(prolegalDegerlendirme || '')}&sorgulama_durumu=${encodeURIComponent(sorguDurumu || '')}&uygunluk_durumu=${encodeURIComponent(uygunlukDurumu || '')}`;
        
        console.log('📡 API isteği gönderiliyor:', requestBody);
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: requestBody
        });
        
        console.log('📡 API yanıtı:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📡 Raw response:', responseText);
        
        // HTML hatası kontrolü
        if (responseText.includes('<br />') || responseText.includes('<b>')) {
            throw new Error('API HTML hatası döndürüyor: ' + responseText.substring(0, 100));
        }
        
        const result = JSON.parse(responseText);
        console.log('📊 API sonucu:', result);
        
        if (result.success) {
            // Başarı mesajı
            alert(`✅ ${selectedIds.length} arazi başarıyla güncellendi!\n\nGüncellenen durumlar:\n${getUpdatedStatusesText(basvuruDurumu, prolegalDegerlendirme, sorguDurumu, uygunlukDurumu)}`);
            
            // Dropdown'ları sıfırla
            resetDropdowns();
            
            // Sol sidebar'daki listeyi yenile
            if (typeof refreshPropertyList === 'function') {
                refreshPropertyList();
            }
        } else {
            alert('❌ Hata: ' + (result.message || 'Araziler güncellenemedi.'));
        }
    } catch (error) {
        console.error('❌ Durum güncelleme hatası:', error);
        alert('❌ Hata: Araziler güncellenemedi.\n\nHata detayı: ' + error.message);
    } finally {
        // Loading'i kaldır
        updateBtn.innerHTML = originalText;
        updateBtn.disabled = false;
    }
}

// Güncellenen durumları metin olarak döndür
function getUpdatedStatusesText(basvuruDurumu, prolegalDegerlendirme, sorguDurumu, uygunlukDurumu) {
    const updates = [];
    
    if (basvuruDurumu) {
        const text = basvuruDurumu === 'Küçük' ? 'Küçük Başvuru (Müşterisiz)' : 'Büyük Başvuru (Müşterili)';
        updates.push(`• Başvuru Durumu: ${text}`);
    }
    
    if (prolegalDegerlendirme) {
        const text = prolegalDegerlendirme === '1' ? 'Olumlu' : 'Olumsuz';
        updates.push(`• Prolegal Değerlendirmesi: ${text}`);
    }
    
    if (sorguDurumu) {
        updates.push(`• Sorgu Durumu: ${sorguDurumu}`);
    }
    
    if (uygunlukDurumu) {
        updates.push(`• Uygunluk Durumu: ${uygunlukDurumu}`);
    }
    
    return updates.join('\n');
}

// Dropdown'ları sıfırla
function resetDropdowns() {
    const dropdowns = [
        'basvuruDurumuDropdown',
        'prolegalDegerlendirmeDropdown', 
        'sorguDurumuDropdown',
        'uygunlukDurumuDropdown'
    ];
    
    dropdowns.forEach(id => {
        const dropdown = document.getElementById(id);
        if (dropdown) {
            dropdown.innerHTML = dropdown.innerHTML.split('>')[0] + '> ' + dropdown.innerHTML.split('>')[1].split('<')[0] + ' Seçin';
            delete dropdown.dataset.selectedValue;
        }
    });
}

// Şirkete Ekle butonu event listener
document.addEventListener('click', function(e) {
    console.log('🖱️ Click event:', e.target.id, e.target);
    
    if (e.target.id === 'addToSelectedCompanyBtn' || e.target.id === 'addToSelectedCompanyBtn2') {
        console.log('🎯 addToSelectedCompanyBtn tıklandı!');
        
        const propertyId = document.getElementById('oznitelik:id')?.textContent;
        const companyId = e.target.dataset.companyId;
        const companyName = e.target.dataset.companyName;
        
        console.log('📋 Buton tıklama verileri:', {
            propertyId: propertyId,
            companyId: companyId,
            companyName: companyName,
            targetId: e.target.id,
            targetDataset: e.target.dataset
        });
        
        if (!propertyId) {
            console.log('❌ Arazi bilgileri bulunamadı!');
            alert('Arazi bilgileri bulunamadı!');
            return;
        }
        
        if (!companyId) {
            console.log('❌ Şirket bilgileri bulunamadı!');
            alert('Şirket bilgileri bulunamadı!');
            return;
        }
        
        console.log('✅ Tüm veriler mevcut, addPropertyToCompanyDirect çağrılıyor...');
        // Şirkete arazi ekle
        addPropertyToCompanyDirect(propertyId, companyId, companyName);
    }
    
    // Şirketi Yarat & Şirkete Ekle butonu
    if (e.target.id === 'createAndAddToCompanyBtn') {
        console.log('🎯 createAndAddToCompanyBtn tıklandı!');
        
        const propertyId = document.getElementById('oznitelik:id')?.textContent;
        const companyName = e.target.dataset.companyName;
        
        console.log('📋 Buton tıklama verileri:', {
            propertyId: propertyId,
            companyName: companyName,
            targetId: e.target.id,
            targetDataset: e.target.dataset
        });
        
        if (!propertyId) {
            console.log('❌ Arazi bilgileri bulunamadı!');
            alert('Arazi bilgileri bulunamadı!');
            return;
        }
        
        if (!companyName) {
            console.log('❌ Şirket adı bulunamadı!');
            alert('Şirket adı bulunamadı! Lütfen önce şirket adını yazın.');
            return;
        }
        
        console.log('✅ Tüm veriler mevcut, createCompanyAndAddProperty çağrılıyor...');
        // Yeni şirket oluştur ve de arazi ekle
        createCompanyAndAddProperty(propertyId, companyName);
    }
});

// Yeni şirket oluştur ve arazi ekle
window.createCompanyAndAddProperty = async function(propertyId, companyName) {
    try {
        console.log('🔄 Şirket oluşturma ve arazi bağlama işlemi başlatılıyor...');
        
        // 1. ADIM: Şirket oluştur
        console.log('📝 Şirket oluşturuluyor...');
        const formData = new FormData();
        formData.append('action', 'add_company');
        formData.append('company_name', companyName);

        const createResponse = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const createResult = await createResponse.json();
        console.log('🔍 Company creation API response:', createResult);

        if (!createResult.success) {
            throw new Error(createResult.message || 'Şirket oluşturulamadı');
        }

        const companyId = createResult.id;
        console.log(`✅ Şirket oluşturuldu: ${companyName}, ID: ${companyId}`);
        
        // 2. ADIM: Araziyi şirkete bağla
        console.log('🔗 Arazi şirkete bağlanıyor...');
        await addPropertyToCompanyDirect(propertyId, companyId, companyName);
        
        // 3. ADIM: Başarı mesajı
        console.log(`✅ İşlem tamamlandı: Şirket oluşturuldu ve arazi bağlandı!`);
        alert(`✅ "${companyName}" şirketi oluşturuldu ve arazi başarıyla bağlandı!`);
        
    } catch (error) {
        console.error('❌ İşlem sırasında hata:', error);
        alert('❌ Hata: ' + error.message);
    }
}

// İlk fonksiyon kaldırıldı - sadece dosyanın sonundaki kullanılacak

// Eski event delegation kaldırıldı - yeni delegation dosyanın sonunda

// Sorgu sırasına ekle functions
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DOMContentLoaded çalıştı - Sorgu sırasına ekle event listener\'ları kuruluyor...');
    
    // Sorgu sırasına ekle butonu
    const sendToQueryBtn = document.getElementById('sendToQueryBtn');
    if (sendToQueryBtn) {
        console.log('✅ sendToQueryBtn bulundu, event listener ekleniyor...');
        sendToQueryBtn.addEventListener('click', function() {
            console.log('🚀 Sorgu sırasına ekle butonuna tıklandı!');
            
            // Tüm checkbox'ları kontrol et
            const allCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]');
            console.log('📋 Toplam checkbox sayısı:', allCheckboxes.length);
            
            // Seçili checkbox'ları bul
            const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
            console.log('📋 Seçili checkbox sayısı:', selectedCheckboxes.length);
            
            // Alternatif yöntemle seçili checkbox'ları bul
            const selectedCheckboxesAlt = Array.from(allCheckboxes).filter(cb => cb.checked);
            console.log('📋 Alternatif yöntemle seçili checkbox sayısı:', selectedCheckboxesAlt.length);
            
            // Alternatif yöntemi kullan
            const finalSelectedCheckboxes = selectedCheckboxesAlt.length > 0 ? selectedCheckboxesAlt : selectedCheckboxes;
            
            if (finalSelectedCheckboxes.length === 0) {
                alert('Lütfen en az bir arazi seçiniz!');
                return;
            }
            
            const selectedIds = Array.from(finalSelectedCheckboxes).map(cb => {
                const row = cb.closest('tr');
                const idCell = row.querySelector('td:nth-child(2)'); // Prolegal ID
                const id = idCell ? idCell.textContent.trim() : null;
                console.log('🆔 Seçili ID:', id);
                return id;
            }).filter(id => id); // null değerleri filtrele
            
            console.log('📝 Seçili ID\'ler:', selectedIds);
            
            if (selectedIds.length === 0) {
                alert('Seçili arazilerin ID\'leri bulunamadı!');
                return;
            }
            
            addToQueryQueue(selectedIds);
        });
    } else {
        console.log('❌ sendToQueryBtn bulunamadı!');
    }
    
    
    
    // Seçilenleri sorguya gönder butonu
    const sendSelectedToQueryBtn = document.getElementById('sendSelectedToQueryBtn');
    if (sendSelectedToQueryBtn) {
        sendSelectedToQueryBtn.addEventListener('click', function() {
            sendSelectedToQuery();
        });
    }
    
    // Tümünü sorguya gönder butonu
    const sendAllToQueryBtn = document.getElementById('sendAllToQueryBtn');
    if (sendAllToQueryBtn) {
        sendAllToQueryBtn.addEventListener('click', function() {
            sendAllToQuery();
        });
    }
    
    // Tümünü seç checkbox
    const selectAllQueryQueue = document.getElementById('selectAllQueryQueue');
    if (selectAllQueryQueue) {
        selectAllQueryQueue.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#queryQueueTableBody input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = this.checked);
            updateQueryQueueButtons();
        });
    }
});

// Sorgu sırasına ekle
async function addToQueryQueue(propertyIds) {
    console.log('🚀 addToQueryQueue çağrıldı, ID\'ler:', propertyIds);
    
    // Kullanıcıdan konu alanını al
    const konu = prompt(`Sorgu sırasına eklenen ${propertyIds.length} kayıt için konu giriniz:`, '');
    
    if (konu === null) {
        // Kullanıcı iptal etti
        console.log('❌ Kullanıcı konu girişini iptal etti');
        return;
    }
    
    if (konu.trim() === '') {
        alert('⚠️ Konu alanı boş bırakılamaz!\n\nKonu seçmeden kaydedilemez.');
        return;
    }
    
    try {
        // Sol sidebar'da seçili şirket varsa company_id / company_name ekle
        const companyId = window.selectedLeftQueryCompanyId || '';
        const companyName = window.selectedLeftQueryCompanyName || '';

        let requestBody = `action=add_to_query_queue&property_ids=${propertyIds.join(',')}&konu=${encodeURIComponent(konu.trim())}`;
        if (companyId) {
            requestBody += `&company_id=${encodeURIComponent(companyId)}&company_name=${encodeURIComponent(companyName)}`;
        }

        console.log('📤 Gönderilen veri:', requestBody);
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: requestBody
        });
        
        console.log('📡 Response status:', response.status);
        
        const responseText = await response.text();
        console.log('📡 Raw response:', responseText);
        
        const result = JSON.parse(responseText);
        console.log('📡 Parsed response:', result);
        
        if (result.success) {
            alert(`✅ ${result.added_count || propertyIds.length} kayıt sorgu sırasına eklendi!`);
            console.log('✅ Sorgu sırasına ekleme başarılı');

            // Anlık olarak Liste ve Şirketler sekmesindeki Sorgu Durumu kolonlarını güncelle
            try {
                propertyIds.forEach(id => {
                    const idStr = String(id).trim();

                    // Sol LISTE tablosu (#result-list)
                    const listRows = document.querySelectorAll('#result-list tr');
                    listRows.forEach(row => {
                        const cells = row.cells;
                        if (!cells || cells.length < 13) return;
                        const rowId = cells[2].textContent.trim(); // 3. sütun: Prolegal ID
                        if (rowId === idStr) {
                            // 13. sütun: Sorgu Durumu
                            cells[12].textContent = 'Sırada';
                        }
                    });

                    // Şirketler sekmesi tablosu (#company-property-list)
                    const companyRows = document.querySelectorAll('#company-property-list tr');
                    companyRows.forEach(row => {
                        const cells = row.cells;
                        if (!cells || cells.length < 13) return;
                        const rowId = cells[2].textContent.trim(); // 3. sütun: Prolegal ID
                        if (rowId === idStr) {
                            // 13. sütun: Sorgu Durumu
                            cells[12].textContent = 'Sırada';
                        }
                    });
                });
            } catch (e) {
                console.error('❌ Sorgu durumu sütununu anlık güncellerken hata:', e);
            }
        } else {
            console.log('🚨 HATA DURUMU - result.success:', result.success);
            console.log('🚨 HATA DURUMU - result.message:', result.message);
            console.log('🚨 HATA DURUMU - result.errors:', result.errors);
            
            // Detaylı hata mesajlarını göster
            let errorMessage = result.message || 'Kayıtlar sorgu sırasına eklenemedi.';
            
            // Eğer errors array'i varsa, detaylı hataları ekle
            if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                console.log('🚨 ERRORS ARRAY BULUNDU, detaylı hatalar ekleniyor...');
                errorMessage += '\n\nDetaylı Hatalar:';
                result.errors.forEach((error, index) => {
                    errorMessage += `\n${index + 1}. ${error}`;
                });
                console.log('🚨 FINAL ERROR MESSAGE:', errorMessage);
            } else {
                console.log('🚨 ERRORS ARRAY BULUNAMADI');
            }
            
            console.log('🚨 ALERT GÖSTERİLİYOR...');
            alert('❌ Hata: ' + errorMessage);
            console.error('❌ Sorgu sırasına ekleme hatası:', result.message, result.errors);
        }
    } catch (error) {
        console.error('❌ Sorgu sırasına ekleme hatası:', error);
        alert('❌ Hata: Kayıtlar sorgu sırasına eklenemedi. Hata: ' + error.message);
    }
}

// Sorgu sırasındaki kayıtları yükle (Kontrol sekmesindeki Sırada checkbox + Sorgula mantığı)
async function loadQueryQueue() {
    console.log('🚀 loadQueryQueue çağrıldı - Kontrol sekmesi Sırada checkbox + Sorgula mantığı');
    
    // DOM elementlerinin hazır olduğundan emin ol
    const queryQueueTable = document.getElementById('queryQueueTable');
    const queryQueueTableBody = document.getElementById('queryQueueTableBody');
    const queryQueueLoading = document.getElementById('queryQueueLoading');
    const rightMenu = document.getElementById('rightMenu');
    const generalTabButton = rightMenu ? rightMenu.querySelector('[data-tab="general"]') : null;
    const isRightSidebarGeneralActive = generalTabButton ? generalTabButton.classList.contains('active') : false;
    
    console.log('🔍 [DEBUG] loadQueryQueue DOM elementleri kontrol:', {
        queryQueueTable: !!queryQueueTable,
        queryQueueTableBody: !!queryQueueTableBody,
        queryQueueLoading: !!queryQueueLoading,
        isRightSidebarGeneralActive
    });
    
    // Eğer elementler yoksa, tab'a tıklama event'ini tetikle
    if (!queryQueueTable || !queryQueueTableBody) {
        console.log('⚠️ [DEBUG] DOM elementleri bulunamadı, sorgu yönetimi tab\'ı görünür değilken yükleme atlandı.');
        if (isRightSidebarGeneralActive) {
            console.log('⚠️ [DEBUG] Sağ sidebar "general" tab aktif fakat öğeler eksik, kısa süre sonra tekrar denenecek.');
            setTimeout(() => {
                if (generalTabButton && generalTabButton.classList.contains('active')) {
                    loadQueryQueue();
                }
            }, 200);
        }
        return;
    }
    
    // Loading ekranını göster
    showQueryQueueLoading();
    
    try {
        // Sorgudurumu tablosundaki sorgulama_durumu kolonuna bak
        const queryParams = new URLSearchParams({
            sorgulama_durumu: encodeURIComponent('Sırada') // sorgudurumu tablosundaki sorgulama_durumu kolonu
        });
        
        const url = `api.php?${queryParams.toString()}`;
        console.log('📤 GET request URL:', url);
        
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json" }
        });
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        console.log('📡 API Yanıtı:', jsonResponse);
        
        if (Array.isArray(jsonResponse) && jsonResponse.length > 0) {
            console.log('✅ Sorgu sırası başarıyla yüklendi, kayıt sayısı:', jsonResponse.length);
            // API'den gelen veriyi displayQueryQueue formatına çevir
            const formattedData = jsonResponse.map(item => ({
                id: item.data?.properties?.id || item.id,
                il: item.data?.properties?.ilAd || item.ilAd,
                ilce: item.data?.properties?.ilceAd || item.ilceAd,
                mahalle: item.data?.properties?.mahalleAd || item.mahalleAd,
                nitelik: item.data?.properties?.nitelik || item.nitelik,
                alan: item.data?.properties?.alan || item.alan,
                konu: item.data?.properties?.konu || item.konu || '',
                sorgulama_durumu: 'Sırada'
            }));
            displayQueryQueue(formattedData);
        } else {
            console.log('ℹ️ Sorgu sırasında kayıt bulunamadı');
            showQueryQueueEmpty();
        }
    } catch (error) {
        console.error('❌ Sorgu sırası yüklenirken hata:', error);
        showQueryQueueEmpty();
    }
}

// Sağ frame sorgu tab'ındaki yeni butonlar için fonksiyonlar
async function loadSirayaEklenenler() {
    console.log('🕐 Sıraya eklenenler yükleniyor...');
    await loadStatusFilter('Sırada', 'Sıraya Eklenenler');
}

async function loadSorgudakiler() {
    console.log('🔍 Sorgudakiler yükleniyor...');
    await loadStatusFilter('Sorguda', 'Sorgudakiler');
}

async function loadSorgulandilar() {
    console.log('🔍 Sorgulandılar yükleniyor...');
    await loadStatusFilter('Sorgulandı', 'Sorgulandılar');
}

async function loadUygunlar() {
    console.log('✅ Uygunlar yükleniyor...');
    await loadStatusFilter('Uygun', 'Uygunlar');
}

async function loadUygunOlmayanlar() {
    console.log('❌ Uygun olmayanlar yükleniyor...');
    console.log('🔍 tapu_maliye tablosundan durum = "Uygun Değil" olan kayıtlar getiriliyor...');
    await loadStatusFilter('Uygun Değil', 'Uygun Olmayanlar');
}

async function loadBasvuruDurumlari() {
    console.log('📋 Başvuru durumları yükleniyor...');
    await loadStatusFilter('basvuru', 'Başvuru Durumları');
}

// Genel durum filtreleme fonksiyonu
async function loadStatusFilter(filterType, displayName) {
    console.log(`🚀 ${displayName} yükleniyor - Filtre: ${filterType}`);
    
    // Loading ekranını göster
    showQueryQueueLoading();
    
    try {
        let queryParams;
        
        if (filterType === 'basvuru') {
            // Başvuru durumları için özel sorgu
            queryParams = new URLSearchParams({
                basvuruDurumu: 'Küçük,Büyük' // Hem müşterisiz hem müşterili başvurular
            });
        } else if (filterType === 'Sırada' || filterType === 'Sorguda' || filterType === 'Sorgulandı') {
            // Sorgu durumu filtreleme
            queryParams = new URLSearchParams({
                sorgulama_durumu: encodeURIComponent(filterType)
            });
        } else {
            // Uygunluk durumu filtreleme
            console.log('🔍 Uygunluk durumu filtreleme:', filterType);
            if (filterType === 'Uygun Değil') {
                console.log('❌ tapu_maliye tablosundan durum = "Uygun Değil" sorgusu yapılıyor...');
            }
            queryParams = new URLSearchParams({
                durum: encodeURIComponent(filterType)
            });
        }
        
        const url = `api.php?${queryParams.toString()}`;
        console.log('📤 GET request URL:', url);
        
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json" }
        });
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        console.log('📡 API Yanıtı:', jsonResponse);
        
        // API yanıt formatını kontrol et
        let actualData = jsonResponse;
        if (Array.isArray(jsonResponse) && jsonResponse.length > 0 && jsonResponse[0].data === null) {
            console.log('⚠️ API yanıtı hata formatında:', jsonResponse[0]);
            actualData = [];
        }
        
        if (Array.isArray(actualData) && actualData.length > 0) {
            console.log(`✅ ${displayName} başarıyla yüklendi, kayıt sayısı:`, actualData.length);
            if (filterType === 'Uygun değil') {
                console.log('❌ Uygun olmayan kayıtlar bulundu:', actualData.length, 'adet');
                console.log('📋 İlk kayıt örneği:', actualData[0]);
            }
            
            // API'den gelen veriyi displayQueryQueue formatına çevir
            const formattedData = actualData.map(item => {
                const props = item.data?.properties || item.properties || item;
                return {
                    id: props.id || item.id,
                    il: props.ilAd || props.il || '-',
                    ilce: props.ilceAd || props.ilce || '-',
                    mahalle: props.mahalleAd || props.mahalle || '-',
                    nitelik: props.nitelik || '-',
                    alan: props.alan || '-',
                    sorgulama_durumu: props.sorguDurumu || props.sorgulama_durumu || props.durum || '-',
                    basvuru_turu: props.basvuru_turu || '-',
                    durum: props.durum || '-'
                };
            });
            displayQueryQueue(formattedData);
        } else {
            console.log(`ℹ️ ${displayName} için kayıt bulunamadı`);
            showQueryQueueEmpty();
        }
    } catch (error) {
        console.error(`❌ ${displayName} yüklenirken hata:`, error);
        showQueryQueueEmpty();
    }
}

// Loading ekranını göster
function showQueryQueueLoading() {
    console.log('🔄 Loading ekranı gösteriliyor...');
    
    const loading = document.getElementById('queryQueueLoading');
    const table = document.getElementById('queryQueueTable');
    const empty = document.getElementById('queryQueueEmpty');
    const actions = document.getElementById('queryQueueActions');
    
    if (loading) {
        loading.style.display = 'block';
        console.log('✅ Loading ekranı gösterildi');
    } else {
        console.log('❌ queryQueueLoading elementi bulunamadı');
    }
    
    if (table) {
        table.style.display = 'none';
    }
    
    if (empty) {
        empty.style.display = 'none';
    }
    
    if (actions) {
        actions.style.display = 'none';
    }
}

// Sorgu sırasını göster
function displayQueryQueue(records) {
    console.log('📊 Sorgu sırası kayıtları:', records);
    
    const loading = document.getElementById('queryQueueLoading');
    const table = document.getElementById('queryQueueTable');
    const empty = document.getElementById('queryQueueEmpty');
    const actions = document.getElementById('queryQueueActions');
    const tbody = document.getElementById('queryQueueTableBody');
    
    // Loading'i gizle
    if (loading) {
    loading.style.display = 'none';
        console.log('✅ Loading ekranı gizlendi');
    } else {
        console.log('❌ queryQueueLoading elementi bulunamadı');
    }
    
    if (records.length === 0) {
        showQueryQueueEmpty();
        return;
    }
    
    // Tabloyu göster
    if (table) {
    table.style.display = 'block';
        console.log('✅ Tablo gösterildi');
    } else {
        console.log('❌ queryQueueTable elementi bulunamadı');
    }
    
    if (actions) {
    actions.style.display = 'flex';
        console.log('✅ Actions gösterildi');
    } else {
        console.log('❌ queryQueueActions elementi bulunamadı');
    }
    
    // Tabloyu doldur
    if (tbody) {
        console.log('📝 Tablo dolduruluyor...', records.length, 'kayıt');
    tbody.innerHTML = records.map(record => `
        <tr>
            <td>
                <input type="checkbox" class="form-check-input query-queue-checkbox" data-id="${record.id}">
            </td>
            <td>${record.id}</td>
            <td>${record.il || '-'}</td>
            <td>${record.ilce || '-'}</td>
            <td>${record.mahalle || '-'}</td>
            <td>${record.nitelik || '-'}</td>
            <td>${record.alan ? record.alan.toLocaleString() : '-'}</td>
            <td>${record.konu || '-'}</td>
            <td>
                <select class="form-select form-select-sm" data-field="sorgulama_durumu" data-id="${record.id}" style="min-width: 120px;">
                    <option value="Sırada" ${record.sorgulama_durumu === 'Sırada' ? 'selected' : ''}>Sırada</option>
                    <option value="Sorguda" ${record.sorgulama_durumu === 'Sorguda' ? 'selected' : ''}>Sorguda</option>
                    <option value="Sorgulandı" ${record.sorgulama_durumu === 'Sorgulandı' ? 'selected' : ''}>Sorgulandı</option>
                </select>
            </td>
            <td>
                <select class="form-select form-select-sm" data-field="basvuru_turu" data-id="${record.id}" style="min-width: 120px;">
                    <option value="">Seçiniz</option>
                    <option value="Küçük" ${record.basvuru_turu === 'Küçük' ? 'selected' : ''}>Müşterisiz</option>
                    <option value="Büyük" ${record.basvuru_turu === 'Büyük' ? 'selected' : ''}>Müşterili</option>
                </select>
            </td>
            <td>
                <select class="form-select form-select-sm" data-field="durum" data-id="${record.id}" style="min-width: 120px;">
                    <option value="">Seçiniz</option>
                    <option value="Uygun" ${record.durum === 'Uygun' ? 'selected' : ''}>Uygun</option>
                    <option value="Uygun değil" ${record.durum === 'Uygun değil' ? 'selected' : ''}>Uygun değil</option>
                </select>
            </td>
            <td>
                <button class="btn btn-sm btn-success" onclick="updateRecordStatus('${record.id}')" title="Güncelle">
                    <i class="fas fa-save"></i>
                </button>
            </td>
        </tr>
    `).join('');
        console.log('✅ Tablo dolduruldu');
    } else {
        console.log('❌ queryQueueTableBody elementi bulunamadı');
    }
    
    // Checkbox event listener'larını ekle
    addQueryQueueCheckboxListeners();
}

// Kayıt durumunu güncelleme fonksiyonu
async function updateRecordStatus(recordId) {
    console.log('🔄 Kayıt durumu güncelleniyor:', recordId);
    
    // Satırı bul
    const row = document.querySelector(`tr input[data-id="${recordId}"]`).closest('tr');
    if (!row) {
        console.error('❌ Satır bulunamadı:', recordId);
        return;
    }
    
    // Form verilerini topla
    const sorgulamaDurumu = row.querySelector('select[data-field="sorgulama_durumu"]').value;
    const basvuruTuru = row.querySelector('select[data-field="basvuru_turu"]').value;
    const durum = row.querySelector('select[data-field="durum"]').value;
    
    console.log('📝 Güncellenecek veriler:', {
        recordId,
        sorgulamaDurumu,
        basvuruTuru,
        durum
    });
    
    try {
        // API'ye güncelleme isteği gönder
        const updateData = {
            id: recordId,
            sorgulama_durumu: sorgulamaDurumu,
            basvuru_turu: basvuruTuru,
            durum: durum
        };
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_record_status',
                data: updateData
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Güncelleme sonucu:', result);
        
        if (result.success) {
            // Başarı mesajı göster
            alert('✅ Kayıt başarıyla güncellendi!');
            
            // Tabloyu yenile
            const activeButton = getActiveStatusButton();
            if (activeButton) {
                activeButton.click();
            }
        } else {
            alert('❌ Güncelleme başarısız: ' + (result.message || 'Bilinmeyen hata'));
        }
        
    } catch (error) {
        console.error('❌ Güncelleme hatası:', error);
        alert('❌ Güncelleme sırasında hata oluştu: ' + error.message);
    }
}

// Aktif durum butonunu bul
function getActiveStatusButton() {
    const buttons = [
        'btnUygunOlmayanlar'
    ];
    
    for (const buttonId of buttons) {
        const button = document.getElementById(buttonId);
        if (button && button.classList.contains('active')) {
            return button;
        }
    }
    
    return null;
}

// Aktif buton yönetimi
function setActiveButton(activeButton) {
    // Tüm durum butonlarından active class'ını kaldır
    const allButtons = [
        'btnUygunOlmayanlar'
    ];
    
    allButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.remove('active');
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        }
    });
    
    // Tıklanan butonu aktif yap
    if (activeButton) {
        activeButton.classList.add('active');
        activeButton.classList.remove('btn-outline-primary');
        activeButton.classList.add('btn-primary');
    }
}

// Boş durumu göster
function showQueryQueueEmpty() {
    console.log('📭 Boş durum gösteriliyor...');
    
    const loading = document.getElementById('queryQueueLoading');
    const table = document.getElementById('queryQueueTable');
    const empty = document.getElementById('queryQueueEmpty');
    const actions = document.getElementById('queryQueueActions');
    
    if (loading) {
        loading.style.display = 'none';
    }
    
    if (table) {
        table.style.display = 'none';
    }
    
    if (empty) {
        empty.style.display = 'block';
        console.log('✅ Boş durum gösterildi');
    } else {
        console.log('❌ queryQueueEmpty elementi bulunamadı');
    }
    
    if (actions) {
        actions.style.display = 'none';
    }
}

// Sorgu durumu badge class'ını al
function getQueryStatusBadgeClass(status) {
    switch (status) {
        case 'Sırada': return 'bg-warning';
        case 'Sorguda': return 'bg-info';
        case 'Sorgulanmadı': return 'bg-secondary';
        default: return 'bg-secondary';
    }
}

// Checkbox event listener'larını ekle
function addQueryQueueCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.query-queue-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateQueryQueueButtons);
    });
}

// Butonları güncelle
function updateQueryQueueButtons() {
    const selectedCheckboxes = document.querySelectorAll('.query-queue-checkbox:checked');
    const sendSelectedBtn = document.getElementById('sendSelectedToQueryBtn');
    
    if (sendSelectedBtn) {
        sendSelectedBtn.disabled = selectedCheckboxes.length === 0;
    }
}

// Seçilenleri sorguya gönder
async function sendSelectedToQuery() {
    const selectedCheckboxes = document.querySelectorAll('.query-queue-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Lütfen en az bir kayıt seçiniz!');
        return;
    }
    
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=send_to_query&property_ids=${selectedIds.join(',')}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ ${selectedIds.length} kayıt sorguya gönderildi!`);
            loadQueryQueue(); // Listeyi yenile
        } else {
            alert('❌ Hata: ' + (result.message || 'Kayıtlar sorguya gönderilemedi.'));
        }
    } catch (error) {
        console.error('❌ Sorguya gönderme hatası:', error);
        alert('❌ Hata: Kayıtlar sorguya gönderilemedi.');
    }
}

// Tümünü sorguya gönder
async function sendAllToQuery() {
    const allCheckboxes = document.querySelectorAll('.query-queue-checkbox');
    
    if (allCheckboxes.length === 0) {
        alert('Gönderilecek kayıt bulunmuyor!');
        return;
    }
    
    const allIds = Array.from(allCheckboxes).map(cb => cb.dataset.id);
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=send_to_query&property_ids=${allIds.join(',')}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ ${allIds.length} kayıt sorguya gönderildi!`);
            loadQueryQueue(); // Listeyi yenile
        } else {
            alert('❌ Hata: ' + (result.message || 'Kayıtlar sorguya gönderilemedi.'));
        }
    } catch (error) {
        console.error('❌ Sorguya gönderme hatası:', error);
        alert('❌ Hata: Kayıtlar sorguya gönderilemedi.');
    }
}

// Global click router - bazı özel butonlar
document.addEventListener('click', function(e) {
    console.log('🖱️ Click detected on:', e.target.id, e.target);
    
    // Şirketler sekmesi: Şirketleri listele/gizle toggle
    const toggleBtn = e.target.closest('#companyTabToggle');
    if (toggleBtn && typeof window.toggleCompanyListPanel === 'function') {
        window.toggleCompanyListPanel();
        return;
    }
    
    // Şirketi Yarat & Şirkete Ekle butonu
    if (e.target.id === 'createAndAddToCompanyBtn') {
        console.log('🎯 createAndAddToCompanyBtn tıklandı!');
        
        const propertyId = document.getElementById('oznitelik:id')?.textContent;
        const companyName = e.target.dataset.companyName;
        
        console.log('📋 Buton tıklama verileri:', {
            propertyId: propertyId,
            companyName: companyName,
            targetId: e.target.id,
            targetDataset: e.target.dataset,
            buttonDisplay: e.target.style.display,
            buttonVisible: e.target.offsetParent !== null
        });
        
        if (!propertyId) {
            console.log('❌ Arazi bilgileri bulunamadı!');
            alert('Arazi bilgileri bulunamadı!');
            return;
        }
        
        if (!companyName) {
            console.log('❌ Şirket adı bulunamadı!');
            alert('Şirket adı bulunamadı! Lütfen önce şirket adını yazın.');
            return;
        }
        
        console.log('✅ Tüm veriler mevcut, createCompanyAndAddProperty çağrılıyor...');
        // Yeni şirket oluştur ve de arazi ekle
        createCompanyAndAddProperty(propertyId, companyName);
    }
});

// Duplicate fonksiyon kaldırıldı - sadece ilk tanım kullanılacak

// Debug: Buton durumunu kontrol et
function checkButtonStatus() {
    const button = document.getElementById('createAndAddToCompanyBtn');
    if (button) {
        console.log('🔍 Buton durumu:', {
            exists: true,
            display: button.style.display,
            visibility: button.style.visibility,
            disabled: button.disabled,
            companyName: button.dataset.companyName
        });
        } else {
        console.log('❌ Buton bulunamadı!');
    }
}

// Sayfa yüklendiğinde buton durumunu kontrol et
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkButtonStatus, 1000);
});


// Sorgu ve Başvuru Durumu verilerini yükle
async function loadSorguBasvuruData(propertyId) {
    console.log('🔍 Sorgu ve Başvuru verileri yükleniyor:', propertyId);
    
    try {
        // Sorgu durumu verilerini al
        const sorguResponse = await fetch(`api.php?action=get_sorgu_durumu&property_id=${propertyId}`);
        const sorguData = await sorguResponse.json();
        
        // Başvuru durumu verilerini al
        const basvuruResponse = await fetch(`api.php?action=get_basvuru_durumu&property_id=${propertyId}`);
        const basvuruData = await basvuruResponse.json();
        
        // Sorgu durumu bilgilerini güncelle
        updateSorguDurumu(sorguData);
        
        // Başvuru durumu bilgilerini güncelle
        updateBasvuruDurumu(basvuruData);
        
    } catch (error) {
        console.error('❌ Sorgu ve Başvuru verileri yüklenirken hata:', error);
    }
}

// Delegation ile buton click yakalama
document.addEventListener('click', function(e) {
    const target = e.target.closest('#createAndLinkBtn');
    if (target) {
        console.log("⚡ Force delegation: createAndLinkBtn tıklandı!");
        e.stopImmediatePropagation(); // diğer listener’ları durdur
        e.preventDefault(); // engelleniyorsa iptal et
        createCompanyAndLinkProperty();
    }
}, true); // ✅ capture mode

// Sarı buton (createAndLinkBtn) için listener
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('createAndLinkBtn');
    if (btn) {
        btn.onclick = () => {
            console.log("🚀 createAndLinkBtn onclick tetiklendi!");
            createCompanyAndLinkProperty();
        };
    }
});
// Sarı buton için delegasyon
document.addEventListener('click', function(e) {
    const target = e.target.closest('#createAndLinkBtn');
    if (target) {
        console.log("🚀 Delegation ile createAndLinkBtn tıklandı!");
        createCompanyAndLinkProperty();
    }
}, true);

// Sorgu durumu bilgilerini güncelle
function updateSorguDurumu(data) {
    console.log('📊 Sorgu durumu verisi:', data);
    
    // Sorgu durumu bilgilerini güncelle - güvenli erişim
    const sorguDurumEl = document.getElementById('oznitelik:sorgu_durumu');
    if (sorguDurumEl) {
        sorguDurumEl.textContent = data.sorgulama_durumu || '-';
    }
    
    const sorguTarihEl = document.getElementById('oznitelik:sorgu_tarihi');
    if (sorguTarihEl) {
        sorguTarihEl.textContent = data.sorgu_tarihi || '-';
    }
    
    const sorguSonucEl = document.getElementById('oznitelik:sorgu_sonucu');
    if (sorguSonucEl) {
        sorguSonucEl.textContent = data.sorgu_sonucu || '-';
    }
    
    const sorguGuncellemeEl = document.getElementById('oznitelik:son_guncelleme');
    if (sorguGuncellemeEl) {
        sorguGuncellemeEl.textContent = data.son_guncelleme || '-';
    }
    
    // Firma bilgisini güncelle
    const sorguFirmaEl = document.getElementById('oznitelik:sorgulanan_firma');
    if (sorguFirmaEl) {
        sorguFirmaEl.textContent = data.sorgulanan_firma || '-';
    }
    
    // Konu bilgisini güncelle
    const sorguKonuEl = document.getElementById('oznitelik:sorgu_konu');
    if (sorguKonuEl) {
        sorguKonuEl.textContent = data.konu || '-';
    }
}

// Başvuru durumu bilgilerini güncelle
function updateBasvuruDurumu(data) {
    console.log('📊 Başvuru durumu verisi:', data);
    
    // Başvuru durumu bilgilerini güncelle - güvenli erişim
    const basvuruDurumEl = document.getElementById('oznitelik:basvuru_durumu');
    if (basvuruDurumEl) {
        basvuruDurumEl.textContent = data.basvuru_durumu || '-';
    }
    
    const basvuruTarihEl = document.getElementById('oznitelik:basvuru_tarihi');
    if (basvuruTarihEl) {
        basvuruTarihEl.textContent = data.basvuru_tarihi || '-';
    }
    
    const basvuruSayiEl = document.getElementById('oznitelik:basvuru_sayisi');
    if (basvuruSayiEl) {
        basvuruSayiEl.textContent = data.basvuru_sayisi || '-';
    }
    
    const basvuruFirmaEl = document.getElementById('oznitelik:ilgili_firma');
    if (basvuruFirmaEl) {
        basvuruFirmaEl.textContent = data.ilgili_firma || '-';
    }
    
    // Başvuru konu bilgisini güncelle
    const basvuruKonuEl = document.getElementById('oznitelik:basvuru_konu');
    if (basvuruKonuEl) {
        basvuruKonuEl.textContent = data.konu || '-';
    }
}

// Execute immediately and also on DOMContentLoadeddd
console.log('🚀 ui.js dosyası yüklendi - initializeButtons çağrılıyor...');

// Immediate call - DOMContentLoaded'a güvenmiyoruz çünkü form.api.js eziyorrrr
setTimeout(() => {
    console.log('⏰ setTimeout ile initializeButtons çağrılıyor...');
    initializeButtons();
}, 1000); // 100ms -> 1000ms (1 saniye)

// DOMContentLoaded listener - backup
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOMContentLoaded - initializeButtons çağrılıyor...');
    initializeButtons();
});

// Yeni şirket oluştur + araziye bağla fonksiyonu
window.createCompanyAndLinkProperty = async function() {
    console.log("🚀 createCompanyAndLinkProperty başladı");

    const manualCompanyInput = document.getElementById('newCompanyManualInput');
    const companyName = manualCompanyInput?.value.trim();
    if (!companyName) {
        alert("⚠️ Lütfen şirket adı girin.");
        return;
    }

    try {
        // 1. Şirket oluştur
        const formData = new FormData();
        formData.append('action', 'add_company');
        formData.append('company_name', companyName);

        console.log("📡 add_company isteği gönderiliyor...");
        const response = await fetch('api.php', { method: 'POST', body: formData });
        const result = await response.json();
        console.log("📡 add_company result:", result);

        if (!result.success) {
            alert("❌ Şirket eklenemedi!");
            return;
        }

        const companyId = result.id;
        const propertyId = document.getElementById('oznitelik:id')?.textContent;

        // 2. Araziyi şirkete bağla
        console.log("📡 addPropertyToFirm isteği gönderiliyor:", { firmId: companyId, parcelKey: propertyId });
        const response2 = await fetch('api.php?action=addPropertyToFirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firmId: companyId, parcelKey: propertyId })
        });

        const result2 = await response2.json();
        console.log("📡 addPropertyToFirm result:", result2);

        if (result2.success) {
            alert(`✅ "${companyName}" şirketi oluşturuldu ve arazi ilişkilendirildi.`);
            loadPropertyCompanyRelations(propertyId);
            manualCompanyInput.value = "";
        } else {
            alert("❌ Arazi şirkete eklenemedi: " + (result2.message || ""));
        }
    } catch (err) {
        console.error("❌ Hata:", err);
        alert("❌ Hata: " + err.message);
    }
}

// Buton listener bağlama
document.addEventListener('DOMContentLoaded', function() {
    const createAndAddBtn = document.getElementById('createAndAddToCompanyBtn');
    if (createAndAddBtn) {
        createAndAddBtn.addEventListener('click', function() {
            console.log("⚡ createAndAddToCompanyBtn tıklandı!");
            createCompanyAndLinkProperty();
        });
    }
});

// Eski event delegation kaldırıldı - yeni delegation dosyanın en altında

// Global scope test
console.log("🔍 Global scope test:", typeof window.createCompanyAndLinkProperty);

// Yeni şirket oluştur + araziye bağla fonksiyonu
window.createCompanyAndLinkProperty = async function() {
    console.log("🚀 createCompanyAndLinkProperty başladı");

    const manualCompanyInput = document.getElementById('newCompanyManualInput');
    const companyName = manualCompanyInput?.value.trim();
    if (!companyName) {
        alert("⚠️ Lütfen şirket adı girin.");
        return;
    }

    try {
        // 1. Şirket oluştur
        const formData = new FormData();
        formData.append('action', 'add_company');
        formData.append('company_name', companyName);

        console.log("📡 add_company isteği gönderiliyor...");
        const response = await fetch('api.php', { method: 'POST', body: formData });
        const result = await response.json();
        console.log("📡 add_company result:", result);

        if (!result.success) {
            alert("❌ Şirket eklenemedi!");
            return;
        }

        const companyId = result.id;
        const propertyId = document.getElementById('oznitelik:id')?.textContent;

        // 2. Araziyi şirkete bağla
        console.log("📡 addPropertyToFirm isteği gönderiliyor:", { firmId: companyId, parcelKey: propertyId });
        const response2 = await fetch('api.php?action=addPropertyToFirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firmId: companyId, parcelKey: propertyId })
        });

        const result2 = await response2.json();
        console.log("📡 addPropertyToFirm result:", result2);

        if (result2.success) {
            alert(`✅ "${companyName}" şirketi oluşturuldu ve arazi ilişkilendirildi.`);
            loadPropertyCompanyRelations(propertyId);
            manualCompanyInput.value = "";
        } else {
            alert("❌ Arazi şirkete eklenemedi: " + (result2.message || ""));
        }
    } catch (err) {
        console.error("❌ Hata:", err);
        alert("❌ Hata: " + err.message);
    }
};

// createAndLinkBtn için event delegation - DOSYANIN EN ALTI
document.addEventListener('click', function(e) {
    if (e.target.id === 'createAndLinkBtn' || e.target.closest('#createAndLinkBtn')) {
        console.log('🎯 createAndLinkBtn tıklandı!');
        window.createCompanyAndLinkProperty();
    }
}, { passive: true });

// Duplicate fonksiyon kaldırıldı - sadece yukarıdaki kullanılacak

// Debug için global scope test
console.log("✅ Global check:", typeof window.createCompanyAndLinkProperty);

// Duplicate fonksiyon kaldırıldı - sadece dosyanın başındaki kullanılacak
