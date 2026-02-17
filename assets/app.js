// Sorgu Yönetimi Şifre Kontrolü - EN ÜSTTE YÜKLE
let queryManagementAuthenticated = false;
let pendingRightMenuOpen = false;
// Şifre: 123qweasdZ* (obfuscated)
const QUERY_MANAGEMENT_PASSWORD = String.fromCharCode(49, 50, 51, 113, 119, 101, 97, 115, 100, 90, 42);

// Sorgu yönetimi tab'ına tıklandığında şifre kontrolü - EN YÜKSEK ÖNCELİK
document.addEventListener('click', function(e) {
    if (e.target.getAttribute('data-tab') === 'general') {
        console.log('🔒 Sorgu yönetimi tab\'ına tıklandı, şifre kontrolü yapılıyor...');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        if (!queryManagementAuthenticated) {
            console.log('🔒 Şifre gerekli, modal açılıyor...');
            pendingRightMenuOpen = true;
            // Şifre modal'ını göster
            const modal = new bootstrap.Modal(document.getElementById('queryManagementPasswordModal'));
            modal.show();
        } else {
            console.log('✅ Zaten giriş yapılmış, tab aktif ediliyor...');
            // Zaten giriş yapılmış, tab'ı aktif et
            activateQueryManagementTab();
            openRightMenu();
        }
        return false;
    }
}, true); // capture phase'de çalıştır

// Şifre modal'ındaki giriş işlemi (buton + Enter)
function handleQueryManagementLogin() {
    const passwordInput = document.getElementById('queryManagementPassword');
    if (!passwordInput) return;
    
    const enteredPassword = passwordInput.value;
    
if (enteredPassword === QUERY_MANAGEMENT_PASSWORD) {
        queryManagementAuthenticated = true;
        pendingRightMenuOpen = false;
        
        const modalEl = document.getElementById('queryManagementPasswordModal');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
        
        passwordInput.value = '';
        
        // Sorgu yönetimi tabını ve sağ sidebar'ı aç
        activateQueryManagementTab();
        openRightMenu();
    } else {
        TitleAlertMessage('❌ Yanlış şifre! Lütfen tekrar deneyin.', 'danger');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function openRightMenu() {
    const rightMenu = document.getElementById('rightMenu');
    if (!rightMenu) return;
    rightMenu.classList.remove('d-none');
    rightMenu.classList.add('visible');
    rightMenu.style.transition = 'right 0.3s ease-in-out, width 0.3s ease-in-out';
}

// Giriş butonu click
document.addEventListener('click', function(e) {
    if (e.target.id === 'queryManagementPasswordSubmit') {
        handleQueryManagementLogin();
    }
});

document.addEventListener('DOMContentLoaded', initInfoModalTabs);

// Fallback: info modal tab tıklamalarını yakala (event delegation)
document.addEventListener('click', function(e) {
    const btn = e.target.closest('#info-nav-tab .segment-button');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const targetId = (btn.getAttribute('data-bs-target') || '').replace('#', '');
    activateInfoModalTab(targetId);
});

function activateInfoModalTab(targetId) {
    const tabContainer = document.getElementById('info-nav-tab');
    const paneContainer = document.getElementById('info-nav-tabContent');
    if (!tabContainer || !paneContainer || !targetId) return;

    const buttons = Array.from(tabContainer.querySelectorAll('.segment-button'));
    const panes = Array.from(paneContainer.querySelectorAll('.tab-pane'));

    buttons.forEach(btn => {
        const btnTarget = (btn.getAttribute('data-bs-target') || '').replace('#', '');
        const isActive = btnTarget === targetId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panes.forEach(pane => {
        const isActive = pane.id === targetId;
        pane.classList.toggle('show', isActive);
        pane.classList.toggle('active', isActive);
        pane.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
}

// Info modal içindeki segment tablarını manuel yönet (Bootstrap nav-link yapısı yok)
function initInfoModalTabs() {
    const tabContainer = document.getElementById('info-nav-tab');
    const paneContainer = document.getElementById('info-nav-tabContent');
    if (!tabContainer || !paneContainer) return;

    // İlk yüklemede aktif butona göre pane'i göster
    const buttons = Array.from(tabContainer.querySelectorAll('.segment-button'));
    const initiallyActive = buttons.find(btn => btn.classList.contains('active')) || buttons[0];
    const initialTarget = initiallyActive ? (initiallyActive.getAttribute('data-bs-target') || '').replace('#', '') : '';
    if (initialTarget) {
        activateInfoModalTab(initialTarget);
    }
}

// Enter ile login
document.addEventListener('keydown', function(e) {
    const modalEl = document.getElementById('queryManagementPasswordModal');
    if (!modalEl) return;
    
    const isOpen = modalEl.classList.contains('show');
    if (!isOpen) return;
    
    if (e.key === 'Enter') {
        e.preventDefault();
        handleQueryManagementLogin();
    }
});

// Sorgu yönetimi tab'ını aktif etme fonksiyonu
function activateQueryManagementTab() {
    console.log('🔄 Sorgu yönetimi tab\'ı aktif ediliyor...');
    
    // Sol sidebar'ın görünür olduğundan emin ol
    const leftSidebarWrapper = document.getElementById('left-sidebar-wrapper');
    if (leftSidebarWrapper) {
        console.log('🔍 [DEBUG] Sol sidebar mevcut durumu:', {
            hasVisibleClass: leftSidebarWrapper.classList.contains('visible'),
            classList: leftSidebarWrapper.classList.toString(),
            style: leftSidebarWrapper.style.cssText
        });
        
        leftSidebarWrapper.classList.add('visible');
        console.log('✅ Sol sidebar görünür yapıldı');
        
        console.log('🔍 [DEBUG] Sol sidebar yeni durumu:', {
            hasVisibleClass: leftSidebarWrapper.classList.contains('visible'),
            classList: leftSidebarWrapper.classList.toString(),
            style: leftSidebarWrapper.style.cssText
        });
    }
    
    // Sağ menüde yalnızca Sorgu Yönetimi kullanılıyor
    // Diğer tabları (varsa) pasifleştir
    document.querySelectorAll('#rightMenu .nav-link').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('#rightMenu .tab-pane').forEach(pane => {
        pane.classList.remove('active', 'show');
        pane.setAttribute('aria-hidden', 'true');
    });
    
    // Sorgu yönetimi panelini aktif et
    const queryTabPane = document.getElementById('general-tab');
    if (queryTabPane) {
        queryTabPane.classList.add('active', 'show');
        queryTabPane.setAttribute('aria-hidden', 'false');
        console.log('✅ Sorgu yönetimi paneli aktif edildi');
        
        // Veri yükleme
        setTimeout(() => {
            console.log('🔍 [DEBUG] Panel görünür kabul edildi, veri yükleme başlatılıyor...');
            if (typeof loadQueryQueue === 'function') {
                loadQueryQueue();
            }
            if (typeof loadQueryResults === 'function') {
                loadQueryResults();
            }
            if (typeof loadQueryHistory === 'function') {
                loadQueryHistory();
            }
        }, 100);
    } else {
        console.log('❌ Sorgu yönetimi paneli (general-tab) bulunamadı');
    }
}

// Sayfa yenilendiğinde authentication durumunu sıfırla
window.addEventListener('beforeunload', function() {
    queryManagementAuthenticated = false;
});

const API_BASE = "./";
let editModal ="";
let copyModal ="";
    const API_URL = API_BASE + "api.php";
    window.sharedCompanyFilterName = '';
    window.sharedDateFilter = { from: null, to: null };
    // Sekme bazlı filtre durumları (sorgu, sonuç, başvuru)
    const TAB_FILTER_DEFAULT = () => ({
        il: '',
        ada: '',
        parsel: '',
        company: '',
        dateValue: '',
        dateRange: { from: null, to: null }
    });
    const TAB_FILTER_KEYS = {
        'query-pane': 'query-pane',
        'queue': 'query-pane',
        'query-result-pane': 'query-result-pane',
        'result': 'query-result-pane',
        'application-pane': 'application-pane',
        'application': 'application-pane'
    };
    const tabFilters = {
        'query-pane': TAB_FILTER_DEFAULT(),
        'query-result-pane': TAB_FILTER_DEFAULT(),
        'application-pane': TAB_FILTER_DEFAULT()
    };

    function getTabKey(target) {
        return TAB_FILTER_KEYS[target] || 'query-pane';
    }

    function getTabState(target) {
        const key = getTabKey(target);
        if (!tabFilters[key]) tabFilters[key] = TAB_FILTER_DEFAULT();
        return tabFilters[key];
    }

    function getActiveTabId() {
        const activePane = document.querySelector('#rightMenu .query-pane.active');
        return activePane ? activePane.id : 'query-pane';
    }

    function syncInputsToTab(tabId) {
        const state = getTabState(tabId);
        const ilInput = document.getElementById('queryFilterIl');
        const adaInput = document.getElementById('queryFilterAda');
        const parselInput = document.getElementById('queryFilterParsel');
        const companyInput = document.getElementById('sharedCompanyFilter');
        const dateInput = document.getElementById('queryDateRange');
        if (ilInput) ilInput.value = state.il || '';
        if (adaInput) adaInput.value = state.ada || '';
        if (parselInput) parselInput.value = state.parsel || '';
        if (companyInput) companyInput.value = state.company || '';
        if (dateInput) dateInput.value = state.dateValue || '';
        window.sharedCompanyFilterName = state.company || '';
        window.rightSidebarCompanyFilterName = state.company || '';
        window.sharedDateFilter = state.dateRange || { from: null, to: null };
    }

    function saveInputsForActiveTab() {
        const tabId = getActiveTabId();
        const state = getTabState(tabId);
        const ilInput = document.getElementById('queryFilterIl');
        const adaInput = document.getElementById('queryFilterAda');
        const parselInput = document.getElementById('queryFilterParsel');
        const companyInput = document.getElementById('sharedCompanyFilter');
        const dateInput = document.getElementById('queryDateRange');
        state.il = ilInput ? ilInput.value.trim() : '';
        state.ada = adaInput ? adaInput.value.trim() : '';
        state.parsel = parselInput ? parselInput.value.trim() : '';
        state.company = companyInput ? companyInput.value.trim() : '';
        state.dateValue = dateInput ? dateInput.value.trim() : '';
        state.dateRange = window.sharedDateFilter || { from: null, to: null };
    }

    function setTabDateRange(tabId, dateValue, parsedRange) {
        const state = getTabState(tabId);
        state.dateValue = dateValue || '';
        state.dateRange = parsedRange || parseDateRangeValue(dateValue || '');
    }

    const IL_DATA = API_BASE + "il/illiste.json";
    const ILCE_DATA = (ilce) => `${API_BASE}ilce/${ilce}.json`;
    const MAHALLE_DATA = (mahalle) => `${API_BASE}mahalle/${mahalle}.json`;

    const getJSON = async (url) => await fetch(url).then(data => data.json());

    // Header loading bar helpers
    function setHeaderLoading(active) {
        const bar = document.getElementById('headerLoadingBar');
        if (!bar) return;
        if (active) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    }

    window.startHeaderLoading = () => setHeaderLoading(true);
    window.stopHeaderLoading = () => setHeaderLoading(false);

    function toggleParselVisibility(visible) {
        Object.values(SearchMapItems).forEach(item => {
            item.polygon.setVisible(visible);
            item.marker.setVisible(visible);
        });
    }

    // Dış sekmeler için referanslar (Teknik / 3D / TKGM) - aynı sekmeyi yeniden kullan
    const TAPUSOR_WINDOW_NAME = 'tapusor_window';
    const EARTH_WINDOW_NAME = 'earth_window';
    const TKGM_WINDOW_NAME = 'tkgm_window';
    let tapusorWindow = null;
    let earthWindow = null;
    let tkgmWindow = null;

    const geoJsonToKml = (geometry) => {
        if (!geometry || !geometry.type || !geometry.coordinates) return null;
        const buildPolygon = (coords) => {
            const closed = coords.length ? [...coords, coords[0]] : coords;
            const ring = closed.map(p => `${p[0]},${p[1]},0`).join(' ');
            return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        };
        let polygons = [];
        if (geometry.type === 'Polygon') {
            polygons.push(buildPolygon(geometry.coordinates[0] || geometry.coordinates));
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(poly => {
                if (Array.isArray(poly) && poly[0]) polygons.push(buildPolygon(poly[0]));
            });
        } else {
            return null;
        }
        const polyXml = polygons.length > 1 ? `<MultiGeometry>${polygons.join('')}</MultiGeometry>` : polygons.join('');
        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>Parsel</name>
    <Style>
      <LineStyle><color>ff0000ff</color><width>2</width></LineStyle>
      <PolyStyle><color>4dff0000</color></PolyStyle>
    </Style>
    ${polyXml}
    </Placemark>
</kml>`;
    };

    const buildKmlEarthUrl = (geometry, center) => {
        if (!geometry) return null;
        const kml = geoJsonToKml(geometry);
        if (!kml) return null;
        try {
            const b64 = btoa(unescape(encodeURIComponent(kml)));
            const loc = center ? `@${center.lat},${center.lng},300a,600d,35y,350h,60t,0r/` : '';
            const kmlUrl = `${window.location.origin}/api.php?action=serve_kml&kml=${encodeURIComponent(b64)}`;
            return `https://earth.google.com/web/${loc}data=KML?url=${encodeURIComponent(kmlUrl)}`;
        } catch (e) {
            console.warn('KML Blob oluşturulamadı', e);
            return null;
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        // Menü aç/kapa işlevi - Optimized
        const menuToggle = document.getElementById('menuToggle');
        const rightMenu = document.getElementById('rightMenu');
        const expandBtn = document.getElementById('rightMenuExpandBtn');
        let manualFullscreen = false;
        let prevWidth = '';
        let prevMaxWidth = '';
        let initialWidth = '';
        const defaultWidthPx = rightMenu ? (rightMenu.getBoundingClientRect().width + 'px') : '';
        let lastManualWidth = '';
        
        const setRightMenuFullscreen = (state, isManual = false) => {
            if (!rightMenu) return;
            if (!initialWidth) {
                initialWidth = rightMenu.style.width || defaultWidthPx;
            }
            rightMenu.classList.toggle('fullscreen', state);
            if (state) {
                // Inline genişliği hatırlayıp tam ekrana aç
                prevWidth = rightMenu.style.width;
                prevMaxWidth = rightMenu.style.maxWidth;
                rightMenu.style.width = '100vw';
                rightMenu.style.maxWidth = '100vw';
            } else {
                // Önceki genişliği geri yükle
                rightMenu.classList.remove('fullscreen');
                rightMenu.style.width = lastManualWidth || prevWidth || initialWidth || defaultWidthPx || '';
                rightMenu.style.maxWidth = prevMaxWidth || '';
            }
            document.body.classList.toggle('fullscreen-viewport', state);
            if (expandBtn) {
                expandBtn.innerHTML = state ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
            }
            if (isManual) {
                manualFullscreen = state;
            }
        };
        console.log('Toggle button found:', menuToggle); // Debug için
        
        if (menuToggle) {
            menuToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle clicked'); // Debug için

                // Kapatma
                if (rightMenu && rightMenu.classList.contains('visible')) {
                    console.log('Closing menu'); // Debug için
                    rightMenu.classList.remove('visible');
                    rightMenu.classList.remove('company-mode');
                    rightMenu.style.width = '';
                    rightMenu.style.transition = 'right 0.3s ease-in-out, width 0.3s ease-in-out';
                    return;
                }
                
                // Açma: sadece menüyü göster (şifre kontrolü popup açılışında yapılır)
                console.log('Opening menu'); // Debug için
                if (!queryManagementAuthenticated) {
                    pendingRightMenuOpen = true;
                    const modal = new bootstrap.Modal(document.getElementById('queryManagementPasswordModal'));
                    modal.show();
                    return;
                }
                activateQueryManagementTab();
                openRightMenu();
            });
        } else {
            console.error('Toggle button not found!');
        }
        
        // Sağ sidebar segment tab sistemi (Sorgu & Uygunluk / Başvurular)
        const rightSidebar = document.getElementById('rightMenu');
        if (rightSidebar) {
            const segmentButtons = rightSidebar.querySelectorAll('.segment-button');
            const panes = rightSidebar.querySelectorAll('.query-pane');
            const sharedFilters = document.getElementById('sharedFilters');
            const queryStatusMessage = document.getElementById('queryStatusMessage');
            const adminOverlay = document.getElementById('adminPanelOverlay');
            const adminClose = document.getElementById('adminOverlayClose');
            const adminPanelIframe = document.getElementById('adminPanelIframe');
            const adminPane = document.getElementById('data-update-pane');

            // Admin paneli sağ sekmede göster; tam ekran için mevcut expand butonu kullanılacak
            const ensureAdminPanelInline = () => {
                if (!adminPane) return;
                const container = adminPane.querySelector('.query-list-container') || adminPane;
                let inlineFrame = container.querySelector('#adminPanelInlineIframe');
                if (!inlineFrame) {
                    container.innerHTML = '';
                    inlineFrame = document.createElement('iframe');
                    inlineFrame.id = 'adminPanelInlineIframe';
                    inlineFrame.src = 'adminPanel.php';
                    inlineFrame.style.width = '100%';
                    inlineFrame.style.height = '100%';
                    inlineFrame.style.border = 'none';
                    container.appendChild(inlineFrame);
                }
            };

            const openAdminPanelOverlay = () => {
                if (adminOverlay) {
                    adminOverlay.style.display = 'block';
                }
                if (adminPanelIframe) {
                    adminPanelIframe.src = 'adminPanel.php';
                }
            };

            const closeAdminPanelOverlay = () => {
                if (adminOverlay) {
                    adminOverlay.style.display = 'none';
                }
            };

            segmentButtons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const targetId = this.getAttribute('data-target');

            // Mevcut sekmenin filtrelerini kaydet
            saveInputsForActiveTab();

            segmentButtons.forEach(b => b.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            this.classList.add('active');
            const targetPane = rightSidebar.querySelector('#' + targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            // Sekme değişiminde o sekmenin filtrelerini inputlara geri yükle ve sadece o sekmeyi filtrele
            syncInputsToTab(targetId);
            applyFiltersForTarget(targetId);
                    
                    // Sorgu Sonucu sekmesine geçildiğinde otomatik olarak "Sorguda" kayıtlarını çek
                    if (targetId === 'query-result-pane') {
                        loadSorgudaResults(true);
                    }

                    // Admin panelde filtre çubuğunu gizle, diğer sekmelerde göster
                    if (sharedFilters) {
                        if (targetId === 'data-update-pane') {
                            sharedFilters.style.display = 'none';
                        } else {
                            sharedFilters.style.display = '';
                        }
                    }

                    // "Sorgudakiler" mesajı sadece Başvurular tabında görünsün
                    if (queryStatusMessage) {
                        queryStatusMessage.style.display = targetId === 'application-pane' ? '' : 'none';
                    }

                    // Admin overlay toggle
                    if (targetId === 'data-update-pane') {
                        ensureAdminPanelInline();
                        closeAdminPanelOverlay();
                        // Admin panel açılır açılmaz tam ekran yap
                        setRightMenuFullscreen(true, true);
                    } else {
                        closeAdminPanelOverlay();
                    }
                });
            });

            if (adminClose && adminOverlay) {
                adminClose.addEventListener('click', () => {
                    closeAdminPanelOverlay();
                });
            }

            // İlk yüklemede aktif sekmeye göre mesajı ayarla
            const activeBtn = Array.from(segmentButtons).find(b => b.classList.contains('active'));
            if (queryStatusMessage) {
                const initialTarget = activeBtn ? activeBtn.getAttribute('data-target') : '';
                queryStatusMessage.style.display = initialTarget === 'application-pane' ? '' : 'none';
            }
        }

        // Manuel tam ekran toggle (expand butonu)
        if (expandBtn && rightMenu) {
            expandBtn.addEventListener('click', function() {
                const nextState = !rightMenu.classList.contains('fullscreen');
                setRightMenuFullscreen(nextState, true);
            });
        }

        // Sağ sidebar resize fonksiyonalitesi - Optimized
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let animationFrame = null;
        
        if (rightMenu) {
            // Mouse down event for resize handle
            rightMenu.addEventListener('mousedown', function(e) {
                const rect = rightMenu.getBoundingClientRect();
                const handleWidth = 15; // Resize handle genişliği artırıldı
                
                if (e.clientX >= rect.left && e.clientX <= rect.left + handleWidth) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = rightMenu.offsetWidth;
                    rightMenu.classList.add('resizing');
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            
            // Optimized mouse move with requestAnimationFrame
            function handleMouseMove(e) {
                if (!isResizing) return;

                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                animationFrame = requestAnimationFrame(() => {
                    const deltaX = startX - e.clientX; // Sağdan sola doğru
                    const newWidth = startWidth + deltaX;
                    const minWidth = 260;
                    // Sağ sidebar'ın ekran genişliğinin neredeyse tamamına kadar büyümesine izin ver
                    const maxWidth = window.innerWidth - 40; // Sağda küçük bir boşluk bırak
                    
                    if (newWidth >= minWidth && newWidth <= maxWidth) {
                        rightMenu.style.width = newWidth + 'px';
                        rightMenu.style.transition = 'none'; // Geçiş animasyonunu kapat

                        // Toggle buton konumunu güncelle
                        const toggleBtn = document.getElementById('menuToggle');
                        if (toggleBtn) {
                            toggleBtn.style.right = newWidth + 'px';
                        }
                    }
                });
            }
            
            // Mouse move event for resizing (fullscreen dahil)
            document.addEventListener('mousemove', handleMouseMove, { passive: false });
            
            // Mouse up event to stop resizing
            function stopResizing() {
                if (isResizing) {
                    isResizing = false;
                    rightMenu.classList.remove('resizing');
                    rightMenu.style.transition = 'right 0.3s ease-in-out, width 0.3s ease-in-out'; // Geçiş animasyonunu geri aç
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    lastManualWidth = rightMenu.style.width || (rightMenu.getBoundingClientRect().width + 'px');
                    
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                        animationFrame = null;
                    }
                }
            }
            
            document.addEventListener('mouseup', stopResizing);
            document.addEventListener('mouseleave', stopResizing); // Mouse pencereden çıkarsa da durdur
        }
        
        const parselSwitch = document.getElementById('parselSwitch');
        const imarSwitch = document.getElementById('imarSwitch');

        // Toggle butonuna tıklama olayını dinler ve durumu günceller
        if (parselSwitch) {
        parselSwitch.addEventListener('change', function() {
            updateParselVisibility();
        });
        }

        if (imarSwitch) {
            imarSwitch.addEventListener('change', function() {
                updateImarVisibility();
            });
        }
    });

    window.checkToggleState = function() {
        const isParselVisible = localStorage.getItem('parselVisibility') === 'visible';
        const parselSwitch = document.getElementById('parselSwitch');
        parselSwitch.checked = isParselVisible;

        if (isParselVisible) {
            showParsel();
            showCadaRows();
            hideCparselRows();
        } else {
            hideParsel();
            hideCadaRows();
            hideCparselRows();
        }
    };

    // İmar fonksiyonları görünürlüğünü toggle durumuna göre güncelleyen fonksiyon
    function updateImarVisibility() {
        const imarSwitch = document.getElementById('imarSwitch');

        if (imarSwitch.checked) {
            localStorage.setItem('imarVisibility', 'visible');
            showImarFunctions();
        } else {
            localStorage.setItem('imarVisibility', 'hidden');
            hideImarFunctions();
            
            // İmar fonksiyon seçimlerini temizle
            clearImarSelections();
        }
    }

// İmar fonksiyonlarını göster
function showImarFunctions() {
        const anaFonksiyonContainer = document.querySelector('#anaFonksiyonCheckboxes').closest('.mb-3');
        const altFonksiyonContainer = document.querySelector('#altFonksiyonCheckboxes').closest('.mb-3');
        
        if (anaFonksiyonContainer) anaFonksiyonContainer.style.display = '';
        if (altFonksiyonContainer) altFonksiyonContainer.style.display = '';
        
        // Seçili bölgeye göre imar fonksiyonlarını yükle ve seçili yap
        loadAndSelectImarFunctions();
    }

    // İmar fonksiyonlarını gizle
    function hideImarFunctions() {
        const anaFonksiyonContainer = document.querySelector('#anaFonksiyonCheckboxes').closest('.mb-3');
        const altFonksiyonContainer = document.querySelector('#altFonksiyonCheckboxes').closest('.mb-3');
        
        if (anaFonksiyonContainer) anaFonksiyonContainer.style.display = 'none';
        if (altFonksiyonContainer) altFonksiyonContainer.style.display = 'none';
    }

    // İmar fonksiyon seçimlerini temizle
    function clearImarSelections() {
        const anaCheckboxes = document.querySelectorAll('#anaFonksiyonCheckboxes input[type="checkbox"]');
        const altCheckboxes = document.querySelectorAll('#altFonksiyonCheckboxes input[type="checkbox"]');
        
        anaCheckboxes.forEach(checkbox => checkbox.checked = false);
        altCheckboxes.forEach(checkbox => checkbox.checked = false);
    }

    // Seçili bölgeye göre imar fonksiyonlarını yükle ve seçili yap
    function loadAndSelectImarFunctions() {
        const il = document.getElementById('select-il').value;
        const selectedIlceler = Array.from(document.querySelectorAll('.ilce-checkbox:checked')).map(cb => cb.value);
        const selectedMahalleler = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);
        
        if (!il) {
            console.log("🔍 İl seçilmediği için imar fonksiyonları yüklenmiyor");
            return;
        }
        
        console.log("🔍 İmar fonksiyonları yükleniyor: il=" + il + ", ilce=" + selectedIlceler.join(',') + ", mahalle=" + selectedMahalleler.join(','));
        
        // Ana fonksiyonları yükle
        loadAnaFonksiyonlar(il, selectedIlceler, selectedMahalleler);
        
        // Alt fonksiyonları yükle
        loadAltFonksiyonlar(il, selectedIlceler, selectedMahalleler);
    }
    
    // Ana fonksiyonları yükle
    function loadAnaFonksiyonlar(il, ilceler, mahalleler) {
        const queryParams = new URLSearchParams();
        queryParams.append('action', 'get_ana_fonksiyonlar');
        queryParams.append('il', il);
        if (ilceler.length > 0) queryParams.append('ilce', ilceler.join(','));
        if (mahalleler.length > 0) queryParams.append('mahalle', mahalleler.join(','));
        
        fetch(`api.php?${queryParams.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    console.log("🔍 Ana fonksiyonlar yüklendi:", data.data);
                    updateAnaFonksiyonCheckboxes(data.data);
                }
            })
            .catch(error => console.error("Ana fonksiyonlar yüklenirken hata:", error));
    }
    
    // Alt fonksiyonları yükle
    function loadAltFonksiyonlar(il, ilceler, mahalleler) {
        const queryParams = new URLSearchParams();
        queryParams.append('action', 'get_alt_fonksiyonlar');
        queryParams.append('il', il);
        if (ilceler.length > 0) queryParams.append('ilce', ilceler.join(','));
        if (mahalleler.length > 0) queryParams.append('mahalle', mahalleler.join(','));
        
        fetch(`api.php?${queryParams.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    console.log("🔍 Alt fonksiyonlar yüklendi:", data.data);
                    updateAltFonksiyonCheckboxes(data.data);
                }
            })
            .catch(error => console.error("Alt fonksiyonlar yüklenirken hata:", error));
    }
    
    // Ana fonksiyon checkbox'larını güncelle ve seçili yap
    function updateAnaFonksiyonCheckboxes(fonksiyonlar) {
        const container = document.getElementById('anaFonksiyonCheckboxes');
        if (!container) return;
        
        // Mevcut checkbox'ları temizle
        container.innerHTML = '';
        
        // Yeni checkbox'ları oluştur ve seçili yap
        fonksiyonlar.forEach(fonksiyon => {
            const div = document.createElement('div');
            div.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input ana-fonksiyon-checkbox';
            checkbox.value = fonksiyon;
            checkbox.id = `ana-${fonksiyon.replace(/\s+/g, '-')}`;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = checkbox.id;
            label.textContent = fonksiyon;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
            
            // Checkbox'lar seçili gelmeyecek - sadece görünür olacak
            console.log("🔍 Ana fonksiyon checkbox oluşturuldu:", fonksiyon);
        });
    }
    
    // Alt fonksiyon checkbox'larını güncelle ve seçili yap
    function updateAltFonksiyonCheckboxes(fonksiyonlar) {
        const container = document.getElementById('altFonksiyonCheckboxes');
        if (!container) return;
        
        // Mevcut checkbox'ları temizle
        container.innerHTML = '';
        
        // Yeni checkbox'ları oluştur ve seçili yap
        fonksiyonlar.forEach(fonksiyon => {
            const div = document.createElement('div');
            div.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input alt-fonksiyon-checkbox';
            checkbox.value = fonksiyon;
            checkbox.id = `alt-${fonksiyon.replace(/\s+/g, '-')}`;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = checkbox.id;
            label.textContent = fonksiyon;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
            
            // Checkbox'lar seçili gelmeyecek - sadece görünür olacak
            console.log("🔍 Alt fonksiyon checkbox oluşturuldu:", fonksiyon);
        });
    }

    // İmar switch durumunu kontrol et
    window.checkImarToggleState = function() {
        const isImarVisible = localStorage.getItem('imarVisibility') === 'visible';
        const imarSwitch = document.getElementById('imarSwitch');
        
        if (imarSwitch) {
            imarSwitch.checked = isImarVisible;
            
            if (isImarVisible) {
                showImarFunctions();
            } else {
                hideImarFunctions();
            }
        }
    };

    // Benzer şekilde, diğer fonksiyonları da global scope'a taşıyabilirsiniz:
    window.showParsel = function() {
        Object.keys(window.SearchMapItems).forEach(key => {
            if (window.SearchMapItems[key].textMarker) {
                window.SearchMapItems[key].textMarker.setMap(window.myMap);
            }
        });
    };

    window.hideParsel = function() {
        Object.keys(window.SearchMapItems).forEach(key => {
            if (window.SearchMapItems[key].textMarker) {
                window.SearchMapItems[key].textMarker.setMap(null);
            }
        });
    };

    function showParselRows() {
        const rows = document.querySelectorAll('.ada-parsel-row');
        rows.forEach(row => {
            if (row && row.style) {
                row.style.setProperty('display', 'table-row', 'important');
            }
        });
    }

    function hideParselRows() {
        const rows = document.querySelectorAll('.ada-parsel-row');
        rows.forEach(row => {
            if (row && row.style) {
                row.style.setProperty('display', 'none', 'important');
            }
        });
    }

     function showCadaRows() {
        const rows = document.querySelectorAll('.input-ada');
        rows.forEach(row => {
            row.style.display = '';
        });
        const rows2 = document.querySelectorAll('.input-parsel');
        rows2.forEach(row => {
            row.style.display = '';
        });
    }

    function hideCadaRows() {
        const rows = document.querySelectorAll('.input-ada');
        rows.forEach(row => {
            row.style.display = 'none';
        });
    }
    function hideCparselRows() {
        // Sadece tablo satırlarını gizle, input alanlarını değil
        const rows = document.querySelectorAll('tr.input-parsel, .input-parsel:not(#ada-parsel-container-2)');
        rows.forEach(row => {
            row.style.display = 'none';
        });
    }
    
    // Sorgu sırasına ekle butonu event listener
    const addToQueueBtn = document.getElementById('addToQueueBtn');
    if (addToQueueBtn) {
        addToQueueBtn.addEventListener('click', function(e) {
            console.log('🔘 Sorgu sırasına ekle butonu tıklandı!');
            e.preventDefault();
            openBatchQueueModal();
        });
        console.log('✅ Sorgu sırasına ekle butonu event listener eklendi');
    } else {
        console.log('❌ addToQueueBtn bulunamadı!');
    }
    
    // Bölgeyi tara butonu için filtre ayarlama fonksiyonu (mevcut fonksiyonla uyumlu)
    window.setDefaultFiltersForScan = function() {
        console.log('🔄 Bölgeyi tara için varsayılan filtreler ayarlanıyor...');
        
        // Tür Seçimi: Uygun Araziler (value="0")
        const turSecimiSelect = document.getElementById('turSecimi');
        if (turSecimiSelect) {
            turSecimiSelect.value = '0';
            console.log('✅ Tür Seçimi: Uygun Araziler seçildi');
        }
        
        // Hisse Durumu: Tam (value="0")
        const hisseDurumuSelect = document.getElementById('hisseDurumu');
        if (hisseDurumuSelect) {
            hisseDurumuSelect.value = '0';
            console.log('✅ Hisse Durumu: Tam seçildi');
        }
        
        // Sorgulama Durumu: Hepsi seç
        const sorgulamaDurumuSelect = document.getElementById('sorgulamaDurumu');
        if (sorgulamaDurumuSelect) {
            sorgulamaDurumuSelect.value = 'Hepsi';
            console.log('✅ Sorgulama Durumu: Hepsi seçildi');
        }
        
        console.log('✅ Bölgeyi tara filtreleri ayarlandı!');
    };
    
    
    // Batch modal açma fonksiyonu
    function openBatchQueueModal() {
        console.log('🔄 Batch queue modal açılıyor...');
        
        // Seçili arazileri al
        const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
        console.log('🔍 Seçili arazi sayısı:', selectedCheckboxes.length);
        
        if (selectedCheckboxes.length === 0) {
            TitleAlertMessage('⚠️ Lütfen sorgu sırasına eklemek için en az bir arazi seçin!', 'warning');
            return;
        }
        
        // Modal'ı aç
        const modalElement = document.getElementById('batchQueueModal');
        console.log('🔍 Modal element:', modalElement);
        
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            console.log('✅ Modal açıldı');
        } else {
            console.log('❌ batchQueueModal bulunamadı!');
        }
        
        // Seçili arazileri modal'a yükle
        loadSelectedPropertiesToModal(selectedCheckboxes);
    }
    
    // Seçili arazileri modal'a yükle
    function loadSelectedPropertiesToModal(selectedCheckboxes) {
        console.log('🔄 Seçili araziler modal\'a yükleniyor...');
        
        const batchQueueList = document.getElementById('batchQueueList');
        if (!batchQueueList) {
            console.log('❌ batchQueueList bulunamadı!');
            return;
        }
        
        let html = '<div class="list-group">';
        
        selectedCheckboxes.forEach((checkbox, index) => {
            const row = checkbox.closest('tr');
            const idCell = row.querySelector('td:nth-child(3)'); // ID sütunu
            const ilCell = row.querySelector('td:nth-child(4)'); // İl sütunu
            const ilceCell = row.querySelector('td:nth-child(5)'); // İlçe sütunu
            const mahalleCell = row.querySelector('td:nth-child(6)'); // Mahalle sütunu
            const adaCell = row.querySelector('td:nth-child(7)'); // Ada sütunu
            const parselCell = row.querySelector('td:nth-child(8)'); // Parsel sütunu
            
            const propertyId = idCell ? idCell.textContent.trim() : '';
            const il = ilCell ? ilCell.textContent.trim() : '';
            const ilce = ilceCell ? ilceCell.textContent.trim() : '';
            const mahalle = mahalleCell ? mahalleCell.textContent.trim() : '';
            const ada = adaCell ? adaCell.textContent.trim() : '';
            const parsel = parselCell ? parselCell.textContent.trim() : '';
            
            html += `
                <div class="list-group-item">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h6 class="mb-1">${il} - ${ilce} - ${mahalle}</h6>
                            <small class="text-muted">Ada: ${ada}, Parsel: ${parsel} (ID: ${propertyId})</small>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-2">
                                <select class="form-select form-select-sm company-select" data-property-id="${propertyId}">
                                    <option value="">Şirket Seçiniz...</option>
                                    <!-- Şirketler buraya yüklenecek -->
                                </select>
                            </div>
                            <div>
                                <input type="text" class="form-control form-control-sm konu-input" 
                                       data-property-id="${propertyId}" 
                                       placeholder="Konu giriniz..." 
                                       required>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        batchQueueList.innerHTML = html;
        
        // Şirket listesini yükle
        loadCompaniesToBatchModal();
        
        console.log('✅ Seçili araziler modal\'a yüklendi');
    }
    
    // Şirket listesini batch modal'a yükle
    async function loadCompaniesToBatchModal() {
        console.log('🔄 Şirket listesi batch modal\'a yükleniyor...');
        
        try {
            const response = await fetch('api.php?action=get_companies_summary');
            const companies = await response.json();
            
            const companySelects = document.querySelectorAll('.company-select');
            companySelects.forEach(select => {
                companies.forEach(company => {
                    const option = document.createElement('option');
                    option.value = company.id;
                    option.textContent = company.company_name;
                    select.appendChild(option);
                });
            });
            
            console.log('✅ Şirket listesi yüklendi');
        } catch (error) {
            console.error('❌ Şirket listesi yükleme hatası:', error);
        }
    }
    
    // Toplu ekle butonu event listener - Modal açıldığında ekle
    document.addEventListener('DOMContentLoaded', function() {
        // Modal açıldığında event listener ekle
        const batchQueueModal = document.getElementById('batchQueueModal');
        if (batchQueueModal) {
            batchQueueModal.addEventListener('shown.bs.modal', function() {
                console.log('🔄 Batch queue modal açıldı, event listener ekleniyor...');
                
                const batchAddToQueueBtn = document.getElementById('batchAddToQueueBtn');
                if (batchAddToQueueBtn) {
                    // Önceki event listener'ı kaldır
                    batchAddToQueueBtn.removeEventListener('click', handleBatchAddToQueue);
                    
                    // Yeni event listener ekle
                    batchAddToQueueBtn.addEventListener('click', handleBatchAddToQueue);
                    console.log('✅ Toplu ekle butonu event listener eklendi');
                    
                    // Debug: Buton elementini kontrol et
                    console.log('🔍 Batch add button element:', batchAddToQueueBtn);
                    console.log('🔍 Button text:', batchAddToQueueBtn.textContent);
                    console.log('🔍 Button class:', batchAddToQueueBtn.className);
                } else {
                    console.log('❌ batchAddToQueueBtn bulunamadı!');
                }
            });
        }
    });
    
    // Event handler fonksiyonu
    function handleBatchAddToQueue() {
        console.log('🔘 Toplu ekle butonu tıklandı!');
        batchAddToQueue();
    }
    
    // Toplu sorgu sırasına ekleme
    async function batchAddToQueue() {
        console.log('🔄 Toplu sorgu sırasına ekleme başlatılıyor...');
        
        const companySelects = document.querySelectorAll('.company-select');
        const konuInputs = document.querySelectorAll('.konu-input');
        const batchData = [];
        
        // Her arazi için şirket seçimini ve konu alanını kontrol et
        companySelects.forEach(select => {
            const propertyId = select.getAttribute('data-property-id');
            const companyId = select.value;
            
            // Aynı property_id'ye sahip konu input'unu bul
            const konuInput = document.querySelector(`.konu-input[data-property-id="${propertyId}"]`);
            const konu = konuInput ? konuInput.value.trim() : '';
            
            if (!companyId) {
                TitleAlertMessage(`⚠️ Şirket seçimi yapılmalıdır!<br><br>Arazi ID: ${propertyId}<br>Şirket seçmeden kaydedilemez.`, 'warning');
                return;
            }
            
            if (!konu) {
                TitleAlertMessage(`⚠️ Konu alanı boş bırakılamaz!<br><br>Arazi ID: ${propertyId}<br>Konu seçmeden kaydedilemez.`, 'warning');
                return;
            }
            
            batchData.push({
                property_id: propertyId,
                company_id: companyId,
                konu: konu
            });
        });
        
        if (batchData.length === 0) {
            TitleAlertMessage('⚠️ Eklenecek arazi bulunamadı!', 'warning');
            return;
        }
        
        console.log('📋 Batch data:', batchData);
        
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=batch_add_to_queue&batch_data=${JSON.stringify(batchData)}`
            });
            
            const result = await response.json();
            console.log('📡 API yanıtı:', result);
            
            if (result.success) {
                TitleAlertMessage(`${result.success_count} arazi sorgu sırasına eklendi!`, 'success');
                
                // Modal'ı kapat
                const modal = bootstrap.Modal.getInstance(document.getElementById('batchQueueModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Checkbox'ları temizle
                document.querySelectorAll('#result-list input[type="checkbox"]:checked').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Sağ sidebar'ı aç ve sorgu yönetimi tab'ına geç
                openRightSidebarAndShowQueue();
                
                // Sorgu sırasını yenile
                loadQueueList();
                
            } else {
                // Detaylı hata mesajlarını göster
                let errorMessage = result.message || 'Araziler sorgu sırasına eklenemedi.';
                
                // Eğer errors array'i varsa, detaylı hataları ekle
                if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                    errorMessage += '\n\nDetaylı Hatalar:';
                    result.errors.forEach((error, index) => {
                        errorMessage += `\n${index + 1}. ${error}`;
                    });
                }
                
                TitleAlertMessage('❌ Hata: ' + errorMessage, 'danger');
                console.error('❌ Toplu ekleme hatası:', result.message, result.errors);
            }
            
        } catch (error) {
            console.error('❌ Toplu ekleme hatası:', error);
            TitleAlertMessage('❌ Araziler sorgu sırasına eklenirken bir hata oluştu.', 'danger');
        }
    }
    document.addEventListener("DOMContentLoaded", function() {
  updateParselVisibility();
}); 

    // Parsel görünürlüğünü toggle durumuna göre güncelleyen fonksiyon
    function updateParselVisibility() {
        const parselSwitch = document.getElementById('parselSwitch');

        if (parselSwitch.checked) {
            localStorage.setItem('parselVisibility', 'visible');
            showParsel();
            showCadaRows();
        } else {
            localStorage.setItem('parselVisibility', 'hidden');
            hideParsel();
            hideCadaRows();
            hideCparselRows();
            
            // Ada parsel inputlarını temizle
            const inputAda = document.getElementById('input-ada');
            const inputParsel = document.getElementById('input-parsel');
            if (inputAda) inputAda.value = '';
            if (inputParsel) inputParsel.value = '';
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Arazi büyüklüğü artık min-max input sistemi kullanıyorrrr

        
        const tasinmazDetayData = [
    {
        value: "ARAZİ",
        label: "ARAZİ"
    },
    {
        value: "ÇALILIK",
        label: "ÇALILIK"
    },
    {
        value: "FUNDALIK",
        label: "FUNDALIK"
    },
    {
        value: "HAM TOPRAK",
        label: "HAM TOPRAK"
    },
    {
        value: "KUMLUK",
        label: "KUMLUK"
    },
    {
        value: "SAZLIK",
        label: "SAZLIK"
    },
    {
        value: "TAŞLIK/KAYALIK",
        label: "TAŞLIK / KAYALIK"
    }
   
];


       function renderCheckboxes(container, data) {
    container.innerHTML = '';
    data.forEach(item => {
        // ARAZİ veya TARLA kontrolü (büyük/küçük harf duyarsız)
        const isAraziOrTarla = item.label.toUpperCase().includes('ARAZI') || 
                              item.label.toUpperCase().includes('TARLA');

        const checkboxCard = document.createElement('div');
        checkboxCard.classList.add('checkbox-card');
        
        // checked özelliğini düzgün şekilde ekleyelim
        const checkedAttribute = isAraziOrTarla ? '' : 'checked="checked"';
        
        checkboxCard.innerHTML = `
            <input type="checkbox" id="${item.value}" value="${item.value}" ${checkedAttribute}>
            <label for="${item.value}">${item.label}</label>
        `;
        container.appendChild(checkboxCard);
    });
}

        function handleSearch(searchInput, container, data) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const filteredData = data.filter(item =>
                    item.label.toLowerCase().includes(searchTerm)
                );
                renderCheckboxes(container, filteredData);
            });
        }

        function handleSelectAll(button, container) {
            button.addEventListener('click', function() {
                container.querySelectorAll('input[type="checkbox"]')
                    .forEach(checkbox => checkbox.checked = true);
            });
        }

        function handleClear(button, container) {
            button.addEventListener('click', function() {
                container.querySelectorAll('input[type="checkbox"]')
                    .forEach(checkbox => checkbox.checked = false);
            });
        }

        // Arazi Büyüklüğü artık min-max input sistemi kullanıyor

        
        // İlçe için "Hepsini Seç" ve "Tümünü Temizle" butonları
    const ilceContainer = document.getElementById('ilce-container');
    const selectAllIlce = document.getElementById('selectAllIlce');
    const clearIlce = document.getElementById('clearIlce');
   
    handleSelectAll(selectAllIlce, ilceContainer);
    handleClear(clearIlce, ilceContainer);
    
    // Mahalle için "Hepsini Seç" ve "Tümünü Temizle" butonları
    const mahalleContainer = document.getElementById('mahalle-container');
    const selectAllMahalle = document.getElementById('selectAllMahalle');
    const clearMahalle = document.getElementById('clearMahalle');

    handleSelectAll(selectAllMahalle, mahalleContainer);
    handleClear(clearMahalle, mahalleContainer);

        // Arazi büyüklüğü temizle butonu
        const clearAraziBuyuklugu = document.getElementById('clearAraziBuyuklugu');
        if (clearAraziBuyuklugu) {
            clearAraziBuyuklugu.addEventListener('click', function() {
                const araziMinInput = document.getElementById('araziMin');
                const araziMaxInput = document.getElementById('araziMax');
                if (araziMinInput) araziMinInput.value = '0'; // Default değer
                if (araziMaxInput) araziMaxInput.value = '600000'; // Default değer
                fetchTasinmazDetay();
            });
        }

        // Taşınmaz Detay - Statik veriler kaldırıldı, sadece API'den gelen veriler kullanılacak
        const tasinmazDetayCheckboxes = document.getElementById('tasinmazDetayCheckboxes');
        const tasinmazDetaySearch = document.getElementById('tasinmazDetaySearch');
        const selectAllTasinmazDetay = document.getElementById('selectAllTasinmazDetay');
        const clearTasinmazDetay = document.getElementById('clearTasinmazDetay');

        // Statik renderCheckboxes çağrısı kaldırıldı - sadece API'den gelen veriler kullanılacak
        // handleSearch, handleSelectAll, handleClear fonksiyonları da API verileriyle çalışacak
    });

    
    

document.addEventListener('DOMContentLoaded', function() {
    // Sağ sidebar açıldığında sorgu sırasını otomatik yükle (Sorgu Sırasında)
    const queryTabBtn = document.querySelector('[data-target="query-pane"]');
    if (queryTabBtn) {
        queryTabBtn.addEventListener('click', () => {
            loadQueueList();
        });
        // Sayfa ilk yüklemede tab aktifleştirilmişse de listeyi çek
        if (queryTabBtn.classList.contains('active')) {
            loadQueueList();
        }
    } else {
        // Fallback: kısa gecikme ile yükle
        setTimeout(loadQueueList, 500);
    }
    const applicationTabBtn = document.querySelector('[data-target="application-pane"]');
    if (applicationTabBtn) {
        applicationTabBtn.addEventListener('click', () => loadApplicationsByLocation(true, true, true));
        if (applicationTabBtn.classList.contains('active')) {
            loadApplicationsByLocation(true, true, true);
        }
    }
    const selectAllIlce = document.getElementById('selectAllIlce');
    const clearIlce = document.getElementById('clearIlce');

    if (selectAllIlce) {
        selectAllIlce.addEventListener('click', function() {
            const ilceCheckboxes = document.querySelectorAll('.ilce-checkbox');
            ilceCheckboxes.forEach(cb => {
                if (!cb.checked) {
                    cb.checked = true;
                    // Form.api.js içindeki ilce-checkbox change handler'ını tetikle
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    }

    if (clearIlce) {
        clearIlce.addEventListener('click', function() {
            const ilceCheckboxes = document.querySelectorAll('.ilce-checkbox');
            ilceCheckboxes.forEach(cb => {
                if (cb.checked) {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Form elemanlarını seçin
    const ilSelect = document.getElementById('select-il');
    const ilceContainer = document.getElementById('ilce-container');
    const mahalleContainer = document.getElementById('mahalle-container');
    const adaInput = document.getElementById('input-ada');
    const parselInput = document.getElementById('input-parsel');
    const turSecimiSelect = document.getElementById('turSecimi');
    // Arazi büyüklüğü artık min-max input sistemi kullanıyor
    const hisseDurumuSelect = document.getElementById('hisseDurumu');
    const sorgulamaDurumuSelect = document.getElementById('sorgulamaDurumu');

    // Taşınmaz Detay konteyneri
    const tasinmazDetayContainer = document.getElementById('tasinmazDetayCheckboxes');
    
    // Global taşınmaz detay verisi (API'den gelen veriler burada saklanacak)
    let currentTasinmazDetayData = [];

    // API'den Taşınmaz Detay verilerini getiren fonksiyon
    async function fetchTasinmazDetay() {
        console.log('🔍 fetchTasinmazDetay çağrıldı');
        
        // Form elemanlarından seçilen değerleri alın
        const selectedIl = ilSelect.value;
        const selectedIlce = Array.from(ilceContainer.querySelectorAll('input:checked')).map(input => input.value).join(',');
        const selectedMahalle = Array.from(mahalleContainer.querySelectorAll('input:checked')).map(input => input.value).join(',');
        const selectedAda = adaInput.value;
        const selectedParsel = parselInput.value;
        const selectedTurSecimi = turSecimiSelect.value;
        const selectedHisseDurumu = hisseDurumuSelect.value;
        const selectedSorgulamaDurumu = sorgulamaDurumuSelect.value;

        // Arazi büyüklüğü input'larını al
        const araziMinInput = document.getElementById('araziMin');
        const araziMaxInput = document.getElementById('araziMax');
        
        // Arazi büyüklüğü değerlerini al ve boşsa default değerleri ata
        const selectedAraziMin = araziMinInput ? (araziMinInput.value || '0') : '0';
        const selectedAraziMax = araziMaxInput ? araziMaxInput.value : '600000';

        console.log('📊 Seçilen değerler:', {
            il: selectedIl,
            ilce: selectedIlce,
            mahalle: selectedMahalle,
            ada: selectedAda,
            parsel: selectedParsel,
            turSecimi: selectedTurSecimi,
            hisseDurumu: selectedHisseDurumu,
            sorgulamaDurumu: selectedSorgulamaDurumu,
            araziMin: selectedAraziMin,
            araziMax: selectedAraziMax
        });

        // API'ye GET isteği gönderin
        try {
            const apiUrl = `dinamik.php?type=tasinmazDetay&il=${selectedIl}&ilce=${encodeURIComponent(selectedIlce)}&mahalle=${encodeURIComponent(selectedMahalle)}&turSecimi=${selectedTurSecimi}&hisseDurumu=${selectedHisseDurumu}&sorgulamaDurumu=${encodeURIComponent(selectedSorgulamaDurumu)}`;
            console.log('🌐 API URL:', apiUrl);
            
            const response = await fetch(apiUrl);
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error("API isteğinde bir hata oluştu");
            }

            const data = await response.json();
            console.log('📦 Gelen veri:', data);
            console.log('📦 Veri tipi:', typeof data);
            console.log('📦 Veri uzunluğu:', Array.isArray(data) ? data.length : 'Array değil');

            // Gelen verileri "Taşınmaz Detay" checkbox'larına ekleyin
            if (data && Array.isArray(data) && data.length > 0) {
                console.log('✅ Veri bulundu, checkbox\'lar render ediliyor');
                console.log('📋 İlk veri örneği:', data[0]);
                // Global veriyi güncelle
                currentTasinmazDetayData = data;
                renderCheckboxes(tasinmazDetayContainer, data);
            } else {
                console.log('❌ Veri bulunamadı veya geçersiz format');
                console.log('❌ Data:', data);
                console.log('❌ Is Array:', Array.isArray(data));
                console.log('❌ Length:', Array.isArray(data) ? data.length : 'N/A');
                currentTasinmazDetayData = [];
                tasinmazDetayContainer.innerHTML = "<p>Sonuç bulunamadı.</p>";
            }
        } catch (error) {
            console.error("❌ Taşınmaz Detay verisi alınırken hata oluştu:", error);
            tasinmazDetayContainer.innerHTML = "<p>Veri alınamadı.</p>";
        }
    }
    
    

    // Taşınmaz Detay kutucuklarını oluşturmak için yardımcı fonksiyon
   function renderCheckboxes(container, data) {
    console.log('🎨 renderCheckboxes çağrıldı, veri:', data);
    console.log('📦 Container:', container);
    
    if (!container) {
        console.error('❌ Container bulunamadı!');
        return;
    }
    
    container.innerHTML = '';
    console.log('🧹 Container temizlendi');
    
    data.forEach((item, index) => {
        console.log(`📋 İtem ${index}:`, item);
        
        // ARAZİ veya TARLA kontrolü (büyük/küçük harf duyarsız)
        const isAraziOrTarla = item.label.toUpperCase().includes('ARSA') || 
                              item.label.toUpperCase().includes('TARLA');

        const checkboxCard = document.createElement('div');
        checkboxCard.classList.add('checkbox-card');
        
        // checked özelliğini düzgün şekilde ekleyelim - tüm checkbox'lar seçili olsun
        const checkedAttribute = 'checked="checked"';
        
        checkboxCard.innerHTML = `
            <input type="checkbox" id="${item.value}" value="${item.value}" ${checkedAttribute}>
            <label for="${item.value}">${item.label}</label>
        `;
        container.appendChild(checkboxCard);
        console.log(`✅ Checkbox ${index} eklendi:`, item.label);
    });
    
    console.log('🎉 Tüm checkbox\'lar eklendi, toplam:', data.length);
}

    // Sayfa yüklendiğinde taşınmaz detaylarını yükleme - sadece il/ilçe/mahalle seçildiğinde yüklenecek
    // fetchTasinmazDetay();

    // Form elemanlarına değişiklikleri dinleyecek event listener'lar ekleyin
    ilSelect.addEventListener('change', fetchTasinmazDetay);
    ilceContainer.addEventListener('change', fetchTasinmazDetay);
    mahalleContainer.addEventListener('change', fetchTasinmazDetay);
    // Ada ve parsel input'larından input event listener'ları kaldırıldı
    // Sadece Sorgula butonuna basınca sorgu atılacak
    turSecimiSelect.addEventListener('change', fetchTasinmazDetay);
    hisseDurumuSelect.addEventListener('change', fetchTasinmazDetay);
    sorgulamaDurumuSelect.addEventListener('change', fetchTasinmazDetay);    
    // Arazi büyüklüğü input'ları için event listener'lar
    const araziMinInput = document.getElementById('araziMin');
    const araziMaxInput = document.getElementById('araziMax');
    
    if (araziMinInput) {
        araziMinInput.addEventListener('input', fetchTasinmazDetay);
    }
    if (araziMaxInput) {
        araziMaxInput.addEventListener('input', fetchTasinmazDetay);
    }

    // Taşınmaz Detay için event listener'lar
    const tasinmazDetaySearch = document.getElementById('tasinmazDetaySearch');
    const selectAllTasinmazDetay = document.getElementById('selectAllTasinmazDetay');
    const clearTasinmazDetay = document.getElementById('clearTasinmazDetay');

    // Arama fonksiyonu - global veriyle çalışır
    if (tasinmazDetaySearch) {
        tasinmazDetaySearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const filteredData = currentTasinmazDetayData.filter(item =>
                item.label.toLowerCase().includes(searchTerm)
            );
            renderCheckboxes(tasinmazDetayContainer, filteredData);
        });
    }

    // Hepsini Seç butonu
    if (selectAllTasinmazDetay) {
        selectAllTasinmazDetay.addEventListener('click', function() {
            // Tüm veriyi (filtrelenmemiş) seç
            renderCheckboxes(tasinmazDetayContainer, currentTasinmazDetayData);
            // Sonra tüm checkbox'ları seç
            tasinmazDetayContainer.querySelectorAll('input[type="checkbox"]')
                .forEach(checkbox => checkbox.checked = true);
        });
    }

    // Tümünü Temizle butonu
    if (clearTasinmazDetay) {
        clearTasinmazDetay.addEventListener('click', function() {
            tasinmazDetayContainer.querySelectorAll('input[type="checkbox"]')
                .forEach(checkbox => checkbox.checked = false);
        });
    }
    
    // Sayfa yüklendiğinde Sorgulama Durumu dropdown'ını "Hepsi" olarak ayarla
    if (sorgulamaDurumuSelect) {
        sorgulamaDurumuSelect.value = 'Hepsi';
        console.log('✅ Sorgulama Durumu: Hepsi seçildi');
    }
});
let veriyukle = [];

// Fetch the list of properties for the selected company
async function fetchCompanyProperties(companyId) {
    try {
        const response = await fetch(`api.php?action=get_company_properties&company_id=${companyId}`);
        if (!response.ok) {
            throw new Error("API request failed with status " + response.status);
        }

        const properties = await response.json();
        updateCompanyManagement(properties);
        return properties;
    } catch (error) {
        console.error("Error fetching company properties:", error);
        
        // Request-URI Too Long hatasını yakala
        if (error.message.includes('Request-URI Too Long') || error.message.includes('414') || error.message.includes('URI Too Long')) {
            TitleAlertMessage('⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın.', 'danger', 10);
        }
        
        return [];
    }
}

// Function to fetch and display companies for management screen
async function fetchCompaniesForManagement() {
    try {
        const response = await fetch('api.php?action=get_companies_summary');
        if (!response.ok) {
            throw new Error("API request failed with status " + response.status);
        }

        const companies = await response.json();
        const tableBody = document.getElementById('companyManagementTableBody');
        
        if (!tableBody) return;

        // Clear the table body
        tableBody.innerHTML = '';

        // Check if there are any companies returned
        if (companies.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Şirket bulunamadı.</td></tr>';
            return;
        }

        // Display each company in the table
        companies.forEach(company => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${company.id}</td>
                <td>${company.company_name}</td>
                <td>${company.property_count}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-primary edit-company-btn" data-company-id="${company.id}" data-company-name="${company.company_name}" title="Düzenle">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-info copy-company-btn" data-company-id="${company.id}" title="Kopyala">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-company-btn" data-company-id="${company.id}" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for management buttons
        addManagementEventListeners();
    } catch (error) {
        console.error("Error fetching companies for management:", error);
    }
}

// Add event listeners for management buttons
function addManagementEventListeners() {
    // Edit company buttons
    document.querySelectorAll('.edit-company-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyId = e.target.closest('.edit-company-btn').dataset.companyId;
            const companyName = e.target.closest('.edit-company-btn').dataset.companyName;
            editCompany(companyId, companyName);
        });
    });

    // Copy company buttons
    document.querySelectorAll('.copy-company-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyId = e.target.closest('.copy-company-btn').dataset.companyId;
            copyCompany(companyId);
        });
    });

    // Delete company buttons
    document.querySelectorAll('.delete-company-btn').forEach(btn => {
        console.log('🔧 Delete company button event listener ekleniyor:', btn);
        btn.addEventListener('click', (e) => {
            console.log('🗑️ Delete company button tıklandı!');
            const companyId = e.target.closest('.delete-company-btn').dataset.companyId;
            console.log('🔍 Company ID:', companyId);
            deleteCompany(companyId);
        });
    });
}

// Function to fetch companies for viewing (search only)
async function fetchCompaniesForViewing() {
    try {
        const response = await fetch('api.php?action=get_companies_summary');
        if (!response.ok) {
            throw new Error("API request failed with status " + response.status);
        }

        const companies = await response.json();
        const tableBody = document.getElementById('companyTableBody');
        
        if (!tableBody) return;

        // Store companies globally for search
        window.allCompanies = companies;
        
        // Display all companies initially
        displayCompaniesForViewing(companies);
    } catch (error) {
        console.error("Error fetching companies for viewing:", error);
    }
}

// Function to display companies in viewing table
function displayCompaniesForViewing(companies) {
    const tableBody = document.getElementById('companyTableBody');
    if (!tableBody) return;

    // Clear the table body
    tableBody.innerHTML = '';

    // Check if there are any companies returned
    if (companies.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Şirket bulunamadı.</td></tr>';
        return;
    }

    // Display each company in the table
    companies.forEach(company => {
        const row = document.createElement('tr');
        
        // Checkbox cell
        const checkboxCell = document.createElement('td');
        checkboxCell.style.textAlign = 'center';
        checkboxCell.style.verticalAlign = 'middle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'company-checkbox';
        checkbox.className = 'company-checkbox';
        checkbox.setAttribute('data-firmName', company.company_name);
        checkbox.value = company.id;
        checkbox.style.display = 'block';
        checkbox.style.visibility = 'visible';
        checkbox.style.opacity = '1';
        checkbox.style.width = '18px';
        checkbox.style.height = '18px';
        checkbox.style.margin = '0 auto';
        checkbox.style.cursor = 'pointer';
        
        checkboxCell.appendChild(checkbox);
        
        // ID cell
        const idCell = document.createElement('td');
        idCell.textContent = company.id;
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = company.company_name;
        
        // Count cell
        const countCell = document.createElement('td');
        countCell.textContent = company.property_count;
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = '<span class="text-muted">Sadece görüntüleme</span>';
        
        // Append all cells to row
        row.appendChild(checkboxCell);
        row.appendChild(idCell);
        row.appendChild(nameCell);
        row.appendChild(countCell);
        row.appendChild(actionsCell);
        
        tableBody.appendChild(row);
        
        console.log('✅ Viewing Checkbox oluşturuldu:', checkbox);
    });
    
    // ZORLA CHECKBOX'LARI GÖRÜNÜR YAP
    setTimeout(() => {
        document.querySelectorAll('.company-checkbox').forEach(checkbox => {
            checkbox.style.display = 'block';
            checkbox.style.visibility = 'visible';
            checkbox.style.opacity = '1';
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.margin = '0 auto';
            checkbox.style.cursor = 'pointer';
            console.log('🔧 Checkbox zorla görünür yapıldı:', checkbox);
        });
    }, 100);
    
    // Add event listeners for checkboxes
    document.querySelectorAll('.company-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Uncheck all other checkboxes
                document.querySelectorAll('.company-checkbox').forEach(otherCheckbox => {
                    if (otherCheckbox !== e.target) {
                        otherCheckbox.checked = false;
                    }
                });

                const selectedCompanyId = e.target.value;
                const response = await fetchCompanyProperties(selectedCompanyId);
                const properties = response;
                veriyukle = response;
                updateCompanyManagement(response);

                // Highlight checkboxes for properties already associated with this company
                properties.forEach(response => {
                    const propertyCheckbox = document.querySelector(`input[data-parcel-key="${response.data.properties.id}"]`);
                    if (propertyCheckbox) {
                        propertyCheckbox.checked = true;
                    }
                });
            } else {
                // Liste sekmesine geç
                document.getElementById('nav-liste-tab').click();
            }
        });
    });
}

// DEBUG: Checkbox'ları manuel olarak görünür yap
function debugShowCheckboxes() {
    console.log('🔍 DEBUG: Checkbox arama başlatılıyor...');
    
    // Tüm checkbox'ları bul
    const checkboxes = document.querySelectorAll('.company-checkbox');
    console.log('🔍 Bulunan checkbox sayısı:', checkboxes.length);
    
    if (checkboxes.length === 0) {
        console.log('❌ Hiç checkbox bulunamadı!');
        
        // Manuel olarak checkbox oluştur
        const tableBody = document.getElementById('companyTableBody');
        if (tableBody) {
            console.log('🔧 Manuel checkbox oluşturma başlatılıyor...');
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach((row, index) => {
                if (index > 0) { // Header'ı atla
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell) {
                        firstCell.innerHTML = '';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'company-checkbox';
                        checkbox.value = index;
                        checkbox.style.display = 'block';
                        checkbox.style.visibility = 'visible';
                        checkbox.style.opacity = '1';
                        checkbox.style.width = '18px';
                        checkbox.style.height = '18px';
                        checkbox.style.margin = '0 auto';
                        checkbox.style.cursor = 'pointer';
                        firstCell.appendChild(checkbox);
                        console.log('✅ Manuel checkbox oluşturuldu:', checkbox);
                    }
                }
            });
        }
    } else {
        console.log('✅ Checkbox\'lar bulundu, görünür yapılıyor...');
        checkboxes.forEach(checkbox => {
            checkbox.style.display = 'block';
            checkbox.style.visibility = 'visible';
            checkbox.style.opacity = '1';
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.margin = '0 auto';
            checkbox.style.cursor = 'pointer';
            console.log('🔧 Checkbox zorla görünür yapıldı:', checkbox);
        });
    }
}

// DEBUG: Sayfa yüklendiğinde çalıştır
setTimeout(debugShowCheckboxes, 2000);

// Initialize company search functionality
function initializeCompanySearch() {
    const searchInput = document.getElementById('companySearchInput');
    if (!searchInput) return;

    // Clear search input when entering
    searchInput.value = '';

    // Add search event listener
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        if (searchTerm === '') {
            // Show all companies if search is empty
            displayCompaniesForViewing(window.allCompanies || []);
        } else {
            // Filter companies with case-insensitive search
            const filteredCompanies = (window.allCompanies || []).filter(company => 
                company.company_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            displayCompaniesForViewing(filteredCompanies);
        }
        
        // Re-initialize sorting after search
        setTimeout(() => {
            initializeTableSorting();
        }, 100);
    });
}

// Initialize table sorting functionality
function initializeTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sortField = this.dataset.sort;
            const currentSort = this.classList.contains('sort-asc') ? 'asc' : 
                               this.classList.contains('sort-desc') ? 'desc' : 'none';
            
            // Remove sort classes from all headers
            sortableHeaders.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            
            // Determine new sort direction
            let newSort = 'asc';
            if (currentSort === 'asc') {
                newSort = 'desc';
            }
            
            // Add appropriate class
            this.classList.add(newSort === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Sort the companies
            sortCompanies(sortField, newSort);
        });
    });
}

// Sort companies based on field and direction
function sortCompanies(field, direction) {
    if (!window.allCompanies) return;
    
    const sortedCompanies = [...window.allCompanies].sort((a, b) => {
        let valueA, valueB;
        
        if (field === 'id') {
            valueA = parseInt(a.id);
            valueB = parseInt(b.id);
        } else if (field === 'name') {
            valueA = a.company_name.toLowerCase();
            valueB = b.company_name.toLowerCase();
        }
        
        if (direction === 'asc') {
            return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
            return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
        }
    });
    
    // Update global storage
    window.allCompanies = sortedCompanies;
    
    // Re-display the sorted companies
    displayCompaniesForViewing(sortedCompanies);
}

// Populate company select dropdown
async function populateCompanySelect() {
    const companySelect = document.getElementById('companySelect');
    if (!companySelect) return;

    // Clear existing options
    companySelect.innerHTML = '<option value="">Şirket ...</option>';

    try {
        // Fetch companies directly if not available in global storage
        let companies = window.allCompanies;
        if (!companies || companies.length === 0) {
            const response = await fetch('api.php?action=get_companies_summary');
            if (response.ok) {
                companies = await response.json();
                // Store in global storage for future use
                window.allCompanies = companies;
            }
        }

        // Add companies to dropdown
        if (companies && companies.length > 0) {
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.company_name;
                companySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error populating company select:", error);
    }
}

// Function to fetch and display the list of companies in the table
async function fetchCompanies() {
    console.log('🔄 fetchCompanies fonksiyonu çağrıldı');
    
    try {
        console.log('📡 API çağrısı yapılıyor: get_companies_summary');
        const response = await fetch('api.php?action=get_companies_summary');
        if (!response.ok) {
            throw new Error("API request failed with status " + response.status);
        }

        const companies = await response.json();
        console.log('📊 Gelen şirket sayısı:', companies.length);
        console.log('📊 API Response (ilk 3 şirket):', companies.slice(0, 3));

        // Get companyTableBody element
        const companyTableBody = document.getElementById('companyTableBody');
        console.log('🔍 companyTableBody element:', companyTableBody);
        
        if (!companyTableBody) {
            console.log('❌ companyTableBody element bulunamadı!');
            return;
        }

        console.log('🧹 Tablo temizleniyor...');
        // Clear the table body - ZORLA TEMİZLE
        while (companyTableBody.firstChild) {
            companyTableBody.removeChild(companyTableBody.firstChild);
        }
        console.log('✅ Tablo zorla temizlendi, satır sayısı:', companyTableBody.children.length);

        // Check if there are any companies returned
        if (companies.length === 0) {
            companyTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Şirket bulunamadı.</td></tr>';
            return;
        }

        // Display each company in the table
        companies.forEach(company => {
            const row = document.createElement('tr');
            
            // Checkbox cell
            const checkboxCell = document.createElement('td');
            checkboxCell.style.textAlign = 'center';
            checkboxCell.style.verticalAlign = 'middle';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'company-checkbox';
            checkbox.className = 'company-checkbox';
            checkbox.setAttribute('data-firmName', company.company_name);
            checkbox.value = company.id;
            checkbox.style.display = 'block';
            checkbox.style.visibility = 'visible';
            checkbox.style.opacity = '1';
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.margin = '0 auto';
            checkbox.style.cursor = 'pointer';
            
            checkboxCell.appendChild(checkbox);
            
            // ID cell
            const idCell = document.createElement('td');
            idCell.textContent = company.id;
            
            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = company.company_name;
            
            // Count cell
            const countCell = document.createElement('td');
            countCell.textContent = company.property_count;
            
            // Actions cell
            const actionsCell = document.createElement('td');
            console.log('🔧 Delete button oluşturuluyor - Company ID:', company.id, 'Company Name:', company.company_name);
            actionsCell.innerHTML = `
                <button style="margin-bottom:6px;" class="btn btn-danger btn-sm delete-btn" data-id="${company.id}"><i class="fas fa-trash"></i></button>
                <button style="margin-bottom:6px;" class="btn btn-sm btn-primary edit-btn" data-company-id="${company.id}" data-company-name="${company.company_name}">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button style="margin-bottom:6px;" class="btn btn-info btn-sm copy-btn" data-id="${company.id}">
                    <i class="fas fa-copy"></i>
                </button>
            `;
            
            // Append all cells to row
            row.appendChild(checkboxCell);
            row.appendChild(idCell);
            row.appendChild(nameCell);
            row.appendChild(countCell);
            row.appendChild(actionsCell);
            
            companyTableBody.appendChild(row);
            
            // console.log('✅ Checkbox oluşturuldu:', checkbox); // Log'u kaldırdık - çok fazla log oluşturuyordu
        });
        
        // ZORLA CHECKBOX'LARI GÖRÜNÜR YAP
        setTimeout(() => {
            document.querySelectorAll('.company-checkbox').forEach(checkbox => {
                checkbox.style.display = 'block';
                checkbox.style.visibility = 'visible';
                checkbox.style.opacity = '1';
                checkbox.style.width = '18px';
                checkbox.style.height = '18px';
                checkbox.style.margin = '0 auto';
                checkbox.style.cursor = 'pointer';
                // console.log('🔧 Checkbox zorla görünür yapıldı:', checkbox); // Log'u kaldırdık - çok fazla log oluşturuyordu
            });
        }, 100);
        
        // Şirket seçimi dropdown'unu doldur
        const companySelect = document.getElementById('companySelect');
        if (companySelect) {
            companySelect.innerHTML = '<option value="">Şirket Seçin</option>';
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.company_name;
                companySelect.appendChild(option);
            });
        }

        // Add event listeners for checkboxes
        document.querySelectorAll('.company-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    // Uncheck all other checkboxes
                    document.querySelectorAll('.company-checkbox').forEach(otherCheckbox => {
                        if (otherCheckbox !== e.target) {
                            otherCheckbox.checked = false;
                        }
                    });

                    const selectedCompanyId = e.target.value;
                    const response = await fetchCompanyProperties(selectedCompanyId);
                    const properties = response;
                    veriyukle = response;
                    updateCompanyManagement(response);

                    // "Talebe Ekle" butonunu görünür yap
                    const companyAddToRequestBtn = document.getElementById('companyAddToRequestBtn');
                    if (companyAddToRequestBtn) {
                        companyAddToRequestBtn.style.display = 'inline-block';
                        // Event listener'ı kontrol et
                        if (typeof window.setupCompanyAddToRequestBtn === 'function') {
                            window.setupCompanyAddToRequestBtn();
                        }
                    }

                    // Highlight checkboxes for properties already associated with this company
properties.forEach(response => {

    const propertyCheckbox = document.querySelector(`input[data-parcel-key="${response.data.properties.id}"]`);
    if (propertyCheckbox) {
        propertyCheckbox.checked = true;
    }
});
                }
                else{
                    // Liste sekmesine geç
                    document.getElementById('nav-liste-tab').click();
                }
                
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            // console.log('🔧 Delete button event listener ekleniyor:', button); // Log'u kaldırdık - çok fazla log oluşturuyordu
            button.addEventListener('click', async (e) => {
                console.log('🗑️ Delete button tıklandı!');
                const companyId = e.target.getAttribute('data-id');
                console.log('🔍 Company ID:', companyId);
                
                await deleteCompany(companyId);
                fetchCompanies(); // Refresh the table after deletion
                 document.getElementById('nav-company-management-tab').style.display ="none";
                // Liste sekmesine geç
                 document.getElementById('nav-liste-tab').click();
            });
        });

        // Add event listeners for delete-company-btn (Management tab)
        document.querySelectorAll('.delete-company-btn').forEach(button => {
            console.log('🔧 Delete company button event listener ekleniyor:', button);
            button.addEventListener('click', async (e) => {
                console.log('🗑️ Delete company button tıklandı!');
                const companyId = e.target.closest('.delete-company-btn').dataset.companyId;
                console.log('🔍 Company ID:', companyId);
                
                await deleteCompany(companyId);
                fetchCompaniesForManagement(); // Refresh the management table after deletion
            });
        });
        
        // Editable table özelliği - şirket adını düzenleme
        document.querySelectorAll('td:nth-child(3)').forEach(cell => {
            cell.addEventListener('dblclick', function() {
                const currentText = this.textContent;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                input.className = 'form-control form-control-sm';
                
                this.innerHTML = '';
                this.appendChild(input);
                input.focus();
                input.select();
                
                const saveEdit = () => {
                    const newValue = input.value.trim();
                    if (newValue && newValue !== currentText) {
                        // Şirket ID'sini bul
                        const row = this.closest('tr');
                        const companyId = row.querySelector('.company-checkbox').value;
                        
                        // API'ye güncelleme isteği gönder
                        updateCompanyName(companyId, newValue);
                    }
                    this.textContent = newValue || currentText;
                };
                
                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        saveEdit();
                    }
                });
            });
        });

        
            document.querySelectorAll('.copy-btn').forEach(button => {
              button.addEventListener('click', function() {
                  console.log("Düzenleme butonuna tıklandı.");
                  const companyId = this.getAttribute('data-id');
                  
                  document.getElementById('copyCompanyId').value = companyId;
                  
                  copyModal = new bootstrap.Modal(document.getElementById('copyCompanyModal'));
                  copyModal.show();
              });
          });

           document.querySelectorAll('.edit-btn').forEach(button => {
              button.addEventListener('click', function() {
                  console.log("Düzenleme butonuna tıklandı.");
                  const companyId = this.getAttribute('data-company-id');
                  const companyName = this.getAttribute('data-company-name');
                  
                  document.getElementById('editCompanyId').value = companyId;
                  document.getElementById('editCompanyName').value = companyName;
                  
                  editModal = new bootstrap.Modal(document.getElementById('editCompanyModal'));
                  editModal.show();
              });
          });

    } catch (error) {
        console.error("❌ Error fetching companies:", error);
        
        // Request-URI Too Long hatasını yakala
        if (error.message.includes('Request-URI Too Long') || error.message.includes('414') || error.message.includes('URI Too Long')) {
            TitleAlertMessage('⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın.', 'danger', 10);
        }
        
        const companyTableBody = document.getElementById('companyTableBody');
        if (companyTableBody) {
        companyTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Şirket bilgileri yüklenirken bir hata oluştu.</td></tr>';
    }
    }
    
        console.log('✅ fetchCompanies fonksiyonu tamamlandı');
        
        // UI'ı zorla güncelle
        setTimeout(() => {
            console.log('🔄 UI zorla güncelleniyor...');
            const finalTableBody = document.getElementById('companyTableBody');
            if (finalTableBody) {
                console.log('✅ Final satır sayısı:', finalTableBody.children.length);
            }
        }, 100);
}


document.addEventListener('DOMContentLoaded', function () {
    // Get references to elements
    const companyTableBody = document.getElementById('companyTableBody');
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const newCompanyNameInput = document.getElementById('newCompanyName');

    // Merkez şirket yönetim tabı elemanları varsa, sadece o kısma özel kodu çalıştır
    if (companyTableBody && addCompanyBtn && newCompanyNameInput) {
        // Function to add a new company from company management
        async function addCompany() {
            const companyName = newCompanyNameInput.value.trim();
            if (companyName === "") {
                TitleAlertMessage('⚠️ Lütfen bir şirket adı girin.', 'warning');
                return;
            }

            try {
                const formData = new FormData();
                formData.append('action', 'add_company');
                formData.append('company_name', companyName);

                const response = await fetch('api.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                console.log('🔍 Company creation API response:', result);

                if (result.success) {
                    TitleAlertMessage('✅ Şirket başarıyla eklendi.', 'success');
                    newCompanyNameInput.value = ""; // Clear input field after adding
                    
                    // Açıklama alanını da temiz
                    const companyDescriptionInput = document.getElementById('companyDescription');
                    if (companyDescriptionInput) {
                        companyDescriptionInput.value = "";
                        companyDescriptionInput.placeholder = "Şirket açıklaması...";
                    }
                    
                    fetchCompanies(); // Refresh the main table
                    fetchCompaniesForManagement(); // Refresh the management table
                } else {
                    TitleAlertMessage('❌ Şirket eklenemedi.', 'danger');
                }
            } catch (error) {
                console.error("Error adding company:", error);
                TitleAlertMessage('❌ Şirket eklenirken bir hata oluştu.', 'danger');
            }
        }

        // Add event listener to the Add button
        addCompanyBtn.addEventListener('click', addCompany);

        // Fetch companies when the page loads (merkez yönetim tabı)
        fetchCompanies();
        
        // Şirket-Arazi ilişki fonksiyonları
        const addRelationBtn = document.getElementById('addRelationBtn');
        const removeRelationBtn = document.getElementById('removeRelationBtn');
        const companySelect = document.getElementById('companySelect');
        const parcelIdInput = document.getElementById('parcelIdInput');
        
        if (addRelationBtn) {
            addRelationBtn.addEventListener('click', async function() {
                const companyId = companySelect.value;
                const parcelId = parcelIdInput.value;
                
                if (!companyId || !parcelId) {
                    TitleAlertMessage('⚠️ Lütfen şirket ve parsel ID seçin.', 'warning');
                    return;
                }
                
                try {
                    const response = await fetch('api.php?action=addPropertyToFirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firmId: companyId, parcelKey: parcelId })
                    });
                    
                const result = await response.json();
                if (result.success) {
                    TitleAlertMessage('✅ İlişki başarıyla eklendi.', 'success');
                        parcelIdInput.value = '';
                        fetchCompanies(); // Tabloyu yenile
                } else {
                    TitleAlertMessage('❌ İlişki eklenemedi: ' + (result.message || 'Bilinmeyen hata'), 'danger');
                }
            } catch (error) {
                console.error('Error adding relation:', error);
                TitleAlertMessage('❌ İlişki eklenirken hata oluştu.', 'danger');
            }
            });
        }
        
        // Şirket İlişkisi satırını firm-name-label'dan güncelle
        function updateCompanyRelationFromFirmLabel() {
            const firmNameLabel = document.getElementById('firm-name-label');
            const relationCell = document.getElementById('oznitelik:sirket_iliskisi');
            
            if (!relationCell) {
                console.log('❌ oznitelik:sirket_iliskisi element bulunamadı!');
                return;
            }
            
            const relationLabel = document.getElementById('firm-relation-label');
            
            if (firmNameLabel && firmNameLabel.textContent.trim()) {
                // Şirket adı varsa satırda göster
                if (relationLabel) {
                    relationLabel.innerHTML = `
                        <span class="text-success">
                            <i class="fas fa-building me-1"></i>
                            <strong>${firmNameLabel.textContent.trim()}</strong>
                        </span>
                    `;
                }
            } else if (relationLabel) {
                // Şirket ilişkisi yoksa metni temizle (checkbox satırı görünmeye devam eder)
                relationLabel.innerHTML = '';
            }
        }
        
        if (removeRelationBtn) {
            removeRelationBtn.addEventListener('click', async function() {
                const companyId = companySelect.value;
                const parcelId = parcelIdInput.value;
                
                if (!companyId || !parcelId) {
                    TitleAlertMessage('⚠️ Lütfen şirket ve parsel ID seçin.', 'warning');
                    return;
                }
                
                try {
                    const response = await fetch('api.php?action=removePropertyFromFirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firmId: companyId, parcelKey: parcelId })
                    });
                    
                const result = await response.json();
                if (result.success) {
                    TitleAlertMessage('✅ İlişki başarıyla silindi.', 'success');
                        parcelIdInput.value = '';
                        fetchCompanies(); // Tabloyu yenile
                } else {
                    TitleAlertMessage('❌ İlişki silinemedi: ' + (result.message || 'Bilinmeyen hata'), 'danger');
                }
            } catch (error) {
                console.error('Error removing relation:', error);
                TitleAlertMessage('❌ İlişki silinirken hata oluştu.', 'danger');
            }
            });
        }
        
        // Şirket seçimi değiştiğinde
        if (companySelect) {
            companySelect.addEventListener('change', function() {
                console.log('Selected company:', this.value);
            });
        }
    }

    // Şirketler sekmesi (sol sidebar) için minimal liste
    const companyTabList = document.getElementById('companyTabList');
    const companyTabPanel = document.getElementById('companyTabPanel');
    const companyTabSearch = document.getElementById('companyTabSearch');
    const companyTabAddBtn = document.getElementById('companyTabAddBtn');
    const companyTabToggle = document.getElementById('companyTabToggle');
    const companyTabToggleIcon = document.getElementById('companyTabToggleIcon');

    async function loadCompaniesForCompanyTab() {
        try {
            console.log('🏢 Şirketler sekmesi için şirket listesi yükleniyor...');
            const res = await fetch('api.php?action=get_companies_summary');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const companies = await res.json();
            window.allCompanies = companies;
            console.log('🏢 Gelen şirket sayısı (company tab):', companies.length);
            renderCompanyTabList(companies);
            // Global olarak erişilebilir olsun (ör: addPropertyToFirm sonrası çağırmak için)
            window.loadCompaniesForCompanyTab = loadCompaniesForCompanyTab;
        } catch (err) {
            console.error('❌ Şirket listesi yüklenemedi (company tab):', err);
        }
    }

    function renderCompanyTabList(companies) {
        if (!companyTabList) return;
        companyTabList.innerHTML = '';

        companies.forEach(company => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex align-items-center justify-content-between company-tab-item';
            item.dataset.companyId = company.id;
            item.dataset.companyName = company.company_name;

            item.innerHTML = `
                <div class="d-flex align-items-center flex-grow-1">
                    <input type="checkbox" class="form-check-input me-2 company-tab-checkbox" value="${company.id}">
                    <span class="small fw-semibold text-truncate">${company.company_name}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-light text-muted border-0">${company.property_count || 0}</span>
                    <button type="button" class="btn btn-link btn-sm p-0 text-muted company-tab-edit" title="Düzenle">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="btn btn-link btn-sm p-0 text-danger company-tab-delete" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            companyTabList.appendChild(item);

            // Varsayılan seçili şirketi yansıt (global selection)
            if (window.selectedLeftQueryCompanyId && String(window.selectedLeftQueryCompanyId) === String(company.id)) {
                item.classList.add('active');
                const checkbox = item.querySelector('.company-tab-checkbox');
                if (checkbox) checkbox.checked = true;
            }
        });

        // Satıra tıklayınca şirketi seç ve arazileri yükle
        companyTabList.querySelectorAll('.company-tab-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.company-tab-edit') || e.target.closest('.company-tab-delete')) {
                    return;
                }
                const id = item.dataset.companyId;
                const name = item.dataset.companyName;

                // Checkbox yönetimi (tek seçim)
                companyTabList.querySelectorAll('.company-tab-checkbox').forEach(cb => {
                    cb.checked = (cb.value === id);
                });
                companyTabList.querySelectorAll('.company-tab-item').forEach(row => row.classList.remove('active'));
                item.classList.add('active');

                // Header'daki global şirket adı
                const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
                if (headerCompanyEl) {
                    headerCompanyEl.textContent = name || '';
                }

                // Global seçili şirket bilgisini güncelle (pop-up Firmaya Ekle satırı için)
                window.selectedLeftQueryCompanyId = id;
                window.selectedLeftQueryCompanyName = name;

                // Şirkete ait arazileri yükle
                await fetchCompanyProperties(id);

                // Seçim yapıldıktan sonra liste panelini gizle
                if (typeof window.toggleCompanyListPanel === 'function') {
                    window.toggleCompanyListPanel();
                }
            });
        });

        // Düzenle / Sil aksiyonları
        companyTabList.querySelectorAll('.company-tab-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.company-tab-item');
                if (!item) return;
                const id = item.dataset.companyId;
                const name = item.dataset.companyName;
                if (typeof editCompany === 'function') {
                    editCompany(id, name);
                } else {
                    const newName = prompt('Yeni şirket adı:', name);
                    if (newName && newName.trim()) {
                        updateCompanyName(id, newName.trim());
                    }
                }
            });
        });

        companyTabList.querySelectorAll('.company-tab-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.target.closest('.company-tab-item');
                if (!item) return;
                const id = item.dataset.companyId;
                const name = item.dataset.companyName;
                if (!confirm(`'${name}' şirketini silmek istediğine emin misin?`)) return;
                await deleteCompany(id);
                // Listeyi yenile
                loadCompaniesForCompanyTab();
            });
        });
    }

        if (companyTabList) {
        // Şirketler tabı ilk açıldığında arka planda listeyi hazırla
        loadCompaniesForCompanyTab();

        // Tab her aktif olduğunda listeyi tazele (minimal ama güncel)
        const companyTabButton = document.getElementById('nav-company-management-tab');
        if (companyTabButton && typeof bootstrap !== 'undefined') {
            companyTabButton.addEventListener('shown.bs.tab', () => {
                loadCompaniesForCompanyTab();
            });
        }

        // Paneli aç/kapat için global fonksiyon (ui.js click router'ı burayı çağıracak)
        if (companyTabToggle && companyTabPanel) {
            // İlk durumda inline display:none varsa kaldır, sadece sınıflarla yönetelim
            if (companyTabPanel.style.display === 'none') {
                companyTabPanel.style.display = 'block';
            }

            window.toggleCompanyListPanel = async function() {
                const isOpen = companyTabPanel.classList.contains('open');
                const labelSpan = companyTabToggle.querySelector('.company-tab-toggle-label');

                if (isOpen) {
                    // Kapat animasyonu
                    companyTabPanel.classList.remove('open');
                    if (companyTabToggleIcon) companyTabToggleIcon.textContent = '▼';
                    if (labelSpan) labelSpan.textContent = 'Şirketleri listele';
                    return;
                }

                // Aç animasyonu
                companyTabPanel.classList.add('open');
                if (companyTabToggleIcon) companyTabToggleIcon.textContent = '▲';
                if (labelSpan) labelSpan.textContent = 'Şirketleri gizle';

                // Panel açıldığında şirket listesini tazele
                await loadCompaniesForCompanyTab();
                if (companyTabSearch) {
                    companyTabSearch.focus();
                }
            };
        }

        if (companyTabSearch) {
            companyTabSearch.addEventListener('input', () => {
                const term = companyTabSearch.value.toLowerCase();
                const companies = (window.allCompanies || []).filter(c =>
                    (c.company_name || '').toLowerCase().includes(term)
                );
                renderCompanyTabList(companies);
            });
        }

        if (companyTabAddBtn) {
            companyTabAddBtn.addEventListener('click', async () => {
                try {
                    // Önce paneli aç ve arama alanına odaklan
                    if (typeof window.toggleCompanyListPanel === 'function' && companyTabPanel && !companyTabPanel.classList.contains('open')) {
                        await window.toggleCompanyListPanel();
                    }
                    if (companyTabSearch) {
                        companyTabSearch.focus();
                    }

                    const raw = (companyTabSearch?.value || '').trim();
                    if (!raw) {
                        // İsim yazılmamışsa sadece odağı ver, işlem yapma
                        return;
                    }

                    // Eğer yazılan isim zaten listede varsa, sadece onu seç
                    const existingItem = Array.from(companyTabList.querySelectorAll('.company-tab-item'))
                        .find(item => (item.dataset.companyName || '').toLowerCase() === raw.toLowerCase());
                    if (existingItem) {
                        const id = existingItem.dataset.companyId;
                        const name = existingItem.dataset.companyName;

                        // Satırı aktif yap
                        companyTabList.querySelectorAll('.company-tab-item').forEach(row => row.classList.remove('active'));
                        existingItem.classList.add('active');
                        companyTabList.querySelectorAll('.company-tab-checkbox').forEach(cb => {
                            cb.checked = (cb.value === id);
                        });

                        // Header'daki global şirket adı
                        const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
                        if (headerCompanyEl) {
                            headerCompanyEl.textContent = name || '';
                        }

                        if (id) {
                            await fetchCompanyProperties(id);
                        }
                        return;
                    }

                    // Yeni şirket oluştur
                    const formData = new FormData();
                    formData.append('action', 'add_company');
                    formData.append('company_name', raw);
                    const res = await fetch('api.php', { method: 'POST', body: formData });
                    const result = await res.json();
                    if (!result.success || !result.id) {
                        TitleAlertMessage('❌ Şirket eklenemedi.', 'danger');
                        return;
                    }

                    const newId = result.id;

                    // Global listeyi güncelle
                    if (!Array.isArray(window.allCompanies)) {
                        window.allCompanies = [];
                    }
                    window.allCompanies.push({
                        id: newId,
                        company_name: raw,
                        property_count: 0
                    });

                    // Listeyi yeniden çiz ve yeni şirketi seç
                    await loadCompaniesForCompanyTab();
                    if (companyTabSearch) {
                        companyTabSearch.value = raw;
                    }

                    // Yeni şirket satırını bul
                    const newItem = Array.from(companyTabList.querySelectorAll('.company-tab-item'))
                        .find(item => item.dataset.companyId == newId);
                    if (newItem) {
                        companyTabList.querySelectorAll('.company-tab-item').forEach(row => row.classList.remove('active'));
                        newItem.classList.add('active');
                        const cb = newItem.querySelector('.company-tab-checkbox');
                        if (cb) cb.checked = true;
                    }

                    const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
                    if (headerCompanyEl) {
                        headerCompanyEl.textContent = raw;
                    }

                    TitleAlertMessage('✅ Şirket oluşturuldu ve seçildi.', 'success');
                } catch (err) {
                    console.error('❌ Şirket eklenirken hata:', err);
                    TitleAlertMessage('❌ Şirket eklenirken bir hata oluştu.', 'danger');
                }
            });
        }
    }
});
async function deleteCompany(companyId) {
    console.log('🗑️ deleteCompany fonksiyonu çağrıldı:', companyId);
    
    if (!companyId) {
        console.error('❌ Company ID bulunamadı!');
        TitleAlertMessage('❌ Şirket ID bulunamadı!', 'danger');
        return;
    }
    
    try {
        console.log('🔍 Şirket property count kontrol ediliyor...');
        
        // Şirketin mevcut gayrimenkul sayısını kontrol et
        const countResponse = await fetch(`api.php?action=get_property_count&company_id=${companyId}`, {
            method: 'GET'
        });
        
        // Response'u text olarak al ve kontrol et
        const countResponseText = await countResponse.text();
        console.log('📊 Property count raw response:', countResponseText);
        
        if (!countResponseText || countResponseText.trim() === '') {
            console.log('⚠️ Property count API\'den boş yanıt alındı - MySQL bağlantı hatası olabilir');
            // MySQL bağlantı hatası durumunda direkt silme işlemini yap
            console.log('🚀 MySQL bağlantı hatası nedeniyle direkt silme işlemi yapılıyor...');
        } else {
            const countResult = JSON.parse(countResponseText);
            console.log('📊 Property count sonucu:', countResult);
        
        if (countResult.success) {
            const propertyCount = countResult.property_count;

            // Eğer gayrimenkul varsa kullanıcıya uyarı göster
            if (propertyCount > 0) {
                    console.log(`⚠️ Şirkette ${propertyCount} gayrimenkul var, kullanıcıya onay soruluyor...`);
                const confirmation = confirm(`Seçilen şirkette ${propertyCount} kadar gayrimenkul mevcut. Silmek istediğine emin misin?`);
                if (!confirmation) {
                        console.log('❌ Kullanıcı silme işlemini iptal etti');
                    return; // Kullanıcı iptal ettiyse fonksiyondan çık
                    }
                }
            }
        }

        console.log('🚀 Şirket silme API çağrısı başlatılıyor...');

        // FormData'yı burada oluştur
        const formData = new FormData();
        formData.append('action', 'delete_company');
        formData.append('company_id', companyId);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        // Response'u text olarak al ve kontrol et
        const responseText = await response.text();
        console.log('📡 Delete company raw response:', responseText);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('API\'den boş yanıt alındı - MySQL bağlantı hatası olabilir');
        }
        
        const result = JSON.parse(responseText);
        console.log('📡 API yanıtı:', result);

        if (result.success) {
            console.log('✅ Şirket başarıyla silindi');
            
            // DOM'dan satırı anlık olarak kaldır
            const rowToRemove = document.querySelector(`tr[data-company-id="${companyId}"]`);
            if (rowToRemove) {
                rowToRemove.remove();
                console.log('✅ Satır DOM\'dan anlık olarak kaldırıldı');
            } else {
                // Eğer data-company-id attribute'u yoksa, company ID'ye göre arama yap
                const allRows = document.querySelectorAll('#companyManagementTableBody tr');
                for (let row of allRows) {
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell && firstCell.textContent.trim() === companyId.toString()) {
                        row.remove();
                        console.log('✅ Satır company ID ile bulunup DOM\'dan kaldırıldı');
                        break;
                    }
                }
            }
            
            TitleAlertMessage('✅ Şirket başarıyla silindi.', 'success');
        } else {
            console.log('❌ Şirket silinemedi:', result.message);
            TitleAlertMessage('❌ Şirket silinemedi.', 'danger');
        }
    } catch (error) {
        console.error("❌ Error deleting company:", error);
        TitleAlertMessage('❌ Şirket silinirken bir hata oluştu.', 'danger');
    }
}

// Şirket adı güncelleme fonksiyonu
async function updateCompanyName(companyId, newName) {
    try {
        const formData = new FormData();
        formData.append('action', 'update_company');
        formData.append('company_id', companyId);
        formData.append('company_name', newName);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            console.log('Şirket adı başarıyla güncellendi');
            // Merkez yönetim dropdown'unu güncelle
            const companySelect = document.getElementById('companySelect');
            if (companySelect) {
                const option = companySelect.querySelector(`option[value="${companyId}"]`);
                if (option) {
                    option.textContent = newName;
                }
            }

            // Global şirket cache'ini güncelle
            if (Array.isArray(window.allCompanies)) {
                const idx = window.allCompanies.findIndex(c => String(c.id) === String(companyId));
                if (idx !== -1) {
                    window.allCompanies[idx].company_name = newName;
                }
            }

            // Sol sidebar Şirketler sekmesi listesini yenile
            if (typeof window.loadCompaniesForCompanyTab === 'function') {
                window.loadCompaniesForCompanyTab();
            }

            // Sol sorgu tabındaki datalist bir dahaki kullanımda taze yüklensin
            window.allCompanies = null;
        } else {
            TitleAlertMessage('❌ Şirket adı güncellenemedi.', 'danger');
        }
    } catch (error) {
        console.error("Error updating company name:", error);
        TitleAlertMessage('❌ Şirket adı güncellenirken bir hata oluştu.', 'danger');
    }
}
function addPropertyToFirm(parcelKey, firmId) {
    // Send a request to your API to add the property to the firm
    fetch(`${API_URL}?action=addPropertyToFirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, parcelKey })
    })
    .then(response => response.json())
    .then(async (data) => {
        if (data.success) {
            TitleAlertMessage('✅ Gayrimenkul firmaya eklendi.', 'success');

            // Şirketler sekmesindeki listeyi güncelle
            if (window.selectedLeftQueryCompanyId && String(window.selectedLeftQueryCompanyId) === String(firmId)) {
                fetchCompanyProperties(firmId);
            }

            // Pop-up içindeki şirket ilişkileri satırını anlık güncelle
            if (typeof loadPropertyCompanyRelations === 'function') {
                const propertyId = document.getElementById('oznitelik:id')?.textContent;
                if (propertyId) {
                    loadPropertyCompanyRelations(propertyId);
                }
            }

            // Sol sidebar şirket listesi (company tab) sayacını tazele
            if (typeof window.loadCompaniesForCompanyTab === 'function') {
                window.loadCompaniesForCompanyTab();
            }
        } else {
            TitleAlertMessage('❌ Bir hata oluştu.', 'danger');
        }
    });

}

function removePropertyFromFirm(parcelKey, firmId) {
    fetch(`${API_URL}?action=removePropertyFromFirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, parcelKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            TitleAlertMessage('✅ Gayrimenkul firmadan çıkarıldı.', 'success');

            // Şirketler sekmesindeki listeyi güncelle
            if (window.selectedLeftQueryCompanyId && String(window.selectedLeftQueryCompanyId) === String(firmId)) {
                fetchCompanyProperties(firmId);
            }

            // Pop-up içindeki şirket ilişkileri satırını anlık güncelle
            if (typeof loadPropertyCompanyRelations === 'function') {
                const propertyId = document.getElementById('oznitelik:id')?.textContent;
                if (propertyId) {
                    loadPropertyCompanyRelations(propertyId);
                }
            }

            // Sol sidebar şirket listesi (company tab) sayacını tazele
            if (typeof window.loadCompaniesForCompanyTab === 'function') {
                window.loadCompaniesForCompanyTab();
            }
        } else {
            TitleAlertMessage('❌ Bir hata oluştu.', 'danger');
        }
    });
}

// Poligonu haritadan kaldırma fonksiyonu
function removePolygonFromMap(parcelKey) {
    if (SearchMapItems[parcelKey] && SearchMapItems[parcelKey].polygon) {
        SearchMapItems[parcelKey].polygon.setMap(null); // Poligonu haritadan kaldır
        delete SearchMapItems[parcelKey]; // SearchMapItems içinden de kaldır
    }
}


function updateFirmayaEkleCheckbox(parcelKey) {
    // Öncelik: sol sidebar'da seçili şirket (datalist)
    let selectedFirmId = window.selectedLeftQueryCompanyId || null;
    let selectedFirmName = window.selectedLeftQueryCompanyName || '';

    // Eğer sol tarafta seçili şirket yoksa, şirket yönetimi tabındaki checkbox'tan al
    if (!selectedFirmId || !selectedFirmName || selectedFirmName.trim() === '----') {
        const selectedFirmCheckbox = document.querySelector('input.company-checkbox:checked');
        selectedFirmId = selectedFirmCheckbox?.value || null;
        selectedFirmName = selectedFirmCheckbox?.dataset.firmname || '';
    }

    const firmCheckbox = document.getElementById('firm-checkbox');

    if (!firmCheckbox) {
        console.log('❌ firm-checkbox bulunamadı!');
        return;
    }

    // Checkbox her durumda aktif; ancak seçili şirket yoksa firmId set edilmeyecek
    firmCheckbox.disabled = false;
    firmCheckbox.dataset.parcelKey = parcelKey;
    if (selectedFirmId && selectedFirmName && selectedFirmName.trim() !== '----') {
        firmCheckbox.dataset.firmId = selectedFirmId;
    } else {
        delete firmCheckbox.dataset.firmId;
    }

    // Geçerli bir şirket varsa ilişkiyi kontrol et
    if (selectedFirmId && selectedFirmName && selectedFirmName.trim() !== '----') {
        fetchCompanyProperties(selectedFirmId).then(companyFeatures => {
            const isAssociated = Array.isArray(companyFeatures)
                && companyFeatures.some(featureData => featureData.data?.properties?.id === parcelKey);
            firmCheckbox.checked = isAssociated;
        }).catch(err => {
            console.error('❌ FirmayaEkle checkbox ilişki kontrolü hatası:', err);
        });
    } else {
        firmCheckbox.checked = false;
    }
}

// Firmaya Ekle satırındaki checkbox için event delegation ile listener ekle
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'firm-checkbox') {
        const firmId = e.target.dataset.firmId;
        const parcelKey = e.target.dataset.parcelKey;

        if (!firmId) {
            // Şirket seçili değilken tıklanırsa uyarı göster
            if (typeof TitleAlertMessage === 'function') {
                TitleAlertMessage('Önce bir şirket seçiniz.', 'warning');
            }
            e.target.checked = false;
            return;
        }
        if (!parcelKey) return;

        if (e.target.checked) {
            addPropertyToFirm(parcelKey, firmId);
        } else {
            removePropertyFromFirm(parcelKey, firmId);
        }
        }
    });

    // Şirket seçimi değiştiğinde, bir parsel seçiliyse Firmaya Ekle satırını güncelle
    document.querySelectorAll('input.company-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (window.currentParcelKey) {
                updateFirmayaEkleCheckbox(window.currentParcelKey);
            }
        });
    });

    // Şirkete ait araziler tablosu için seçim ve sorgu sırasına ekleme
    const companySelectAll = document.getElementById('companySelectAllProperties');
    const companyTableBody = document.getElementById('company-property-list');
    const companySelectedCountEl = document.getElementById('companySelectedCount');
    const companyAddToQueueBtn = document.getElementById('companyAddToQueueBtn');
    const companyExportExcelBtn = document.getElementById('companyExportExcelBtn');

    function updateCompanySelectedCount() {
        if (!companyTableBody || !companySelectedCountEl) return;
        const selected = companyTableBody.querySelectorAll('.company-property-checkbox:checked');
        companySelectedCountEl.textContent = `${selected.length} seçili`;
    }

    if (companySelectAll && companyTableBody) {
        companySelectAll.addEventListener('change', function() {
            const checkboxes = companyTableBody.querySelectorAll('.company-property-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = companySelectAll.checked;
            });
            updateCompanySelectedCount();
            
            // "Talebe Ekle" butonunu görünür yap (en az bir checkbox seçiliyse)
            const companyAddToRequestBtn = document.getElementById('companyAddToRequestBtn');
            if (companyAddToRequestBtn) {
                const selectedCheckboxes = companyTableBody.querySelectorAll('.company-property-checkbox:checked');
                if (selectedCheckboxes.length > 0) {
                    companyAddToRequestBtn.style.display = 'inline-block';
                    // Event listener'ı kontrol et
                    if (typeof window.setupCompanyAddToRequestBtn === 'function') {
                        window.setupCompanyAddToRequestBtn();
                    }
                }
            }
        });
    }

    if (companyTableBody) {
        companyTableBody.addEventListener('change', function(e) {
            if (e.target && e.target.classList.contains('company-property-checkbox')) {
                // Scroll pozisyonunu koru - layout değişikliğinden önce kaydet
                const companyTableContainer = document.getElementById('company-table-container');
                const navCompanyManagement = document.getElementById('nav-company-management');
                const scrollTop = companyTableContainer ? companyTableContainer.scrollTop : (navCompanyManagement ? navCompanyManagement.scrollTop : 0);
                
                updateCompanySelectedCount();
                // Eğer hepsi işaretli ise üst checkbox'ı da güncelle
                if (companySelectAll) {
                    const all = companyTableBody.querySelectorAll('.company-property-checkbox');
                    const checked = companyTableBody.querySelectorAll('.company-property-checkbox:checked');
                    companySelectAll.checked = all.length > 0 && all.length === checked.length;
                }
                
                // "Talebe Ekle" butonunu görünür yap (en az bir checkbox seçiliyse)
                const companyAddToRequestBtn = document.getElementById('companyAddToRequestBtn');
                if (companyAddToRequestBtn) {
                    const selectedCheckboxes = companyTableBody.querySelectorAll('.company-property-checkbox:checked');
                    if (selectedCheckboxes.length > 0) {
                        companyAddToRequestBtn.style.display = 'inline-block';
                        // Event listener'ı kontrol et
                        if (typeof window.setupCompanyAddToRequestBtn === 'function') {
                            window.setupCompanyAddToRequestBtn();
                        }
                    }
                }
                
                // Scroll pozisyonunu geri yükle - layout değişikliğinden sonra
                setTimeout(() => {
                    if (companyTableContainer) {
                        companyTableContainer.scrollTop = scrollTop;
                    } else if (navCompanyManagement) {
                        navCompanyManagement.scrollTop = scrollTop;
                    }
                }, 0);
            }
        });
    }

    if (companyAddToQueueBtn && companyTableBody) {
        companyAddToQueueBtn.addEventListener('click', function() {
            const selectedCheckboxes = companyTableBody.querySelectorAll('.company-property-checkbox:checked');
            if (selectedCheckboxes.length === 0) {
                TitleAlertMessage('⚠️ Lütfen sorgu sırasına eklemek için en az bir arazi seçin.', 'warning');
                return;
            }

            const propertyIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.propertyId).filter(Boolean);
            if (propertyIds.length === 0) {
                TitleAlertMessage('⚠️ Geçerli Prolegal ID bulunamadı.', 'warning');
                return;
            }

            // Mevcut addToQueryQueue fonksiyonunu kullan
            if (typeof addToQueryQueue === 'function') {
                addToQueryQueue(propertyIds);
            } else {
                TitleAlertMessage('❌ Sorgu sırasına ekleme fonksiyonu bulunamadı.', 'danger');
            }
        });
    }

    // Şirketler tabı – Excel'e indir
    if (companyExportExcelBtn && companyTableBody) {
        companyExportExcelBtn.addEventListener('click', function() {
            const rows = companyTableBody.querySelectorAll('tr');
            if (!rows.length) {
                if (typeof TitleAlertMessage === 'function') {
                    TitleAlertMessage('⚠️ İndirilecek arazi bulunamadı.', 'warning');
                }
                return;
            }

            const companyName =
                window.selectedLeftQueryCompanyName ||
                (document.getElementById('globalSelectedCompanyName')?.textContent || '');

            const exportData = Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                // Kolon sırası: [0]=checkbox, [1]=sıra, [2]=ID, [3]=İl, [4]=İlçe, [5]=Mahalle, [6]=Ada, [7]=Parsel
                const id      = (cells[2]?.textContent || '').trim();
                const il      = (cells[3]?.textContent || '').trim();
                const ilce    = (cells[4]?.textContent || '').trim();
                const mahalle = (cells[5]?.textContent || '').trim();
                const ada     = (cells[6]?.textContent || '').trim();
                const parsel  = (cells[7]?.textContent || '').trim();

                return {
                    id,
                    il,
                    ilce,
                    mahalle,
                    ada,
                    parsel,
                    company: companyName || '',
                };
            });

            if (!exportData.length) {
                if (typeof TitleAlertMessage === 'function') {
                    TitleAlertMessage('⚠️ İndirilecek veri bulunamadı.', 'warning');
                }
                return;
            }

            const jsonData = JSON.stringify(exportData);
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'export_company_excel.php';
            form.target = '_blank';

            const dataInput = document.createElement('input');
            dataInput.type = 'hidden';
            dataInput.name = 'data';
            dataInput.value = jsonData;

            const filenameInput = document.createElement('input');
            filenameInput.type = 'hidden';
            filenameInput.name = 'filename';
            const today = new Date().toISOString().slice(0, 10);

            // Şirket adını dosya adına ekle (boşluk ve özel karakterleri sadeleştir)
            let safeCompany = (companyName || '').toString().trim().toLowerCase();
            safeCompany = safeCompany
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ş/g, 's')
                .replace(/ü/g, 'u')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'sirket';

            filenameInput.value = `${safeCompany}_arazileri_${today}.xlsx`;

            form.appendChild(dataInput);
            form.appendChild(filenameInput);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        });
    }

    // Şirkete ait araziler tablosu için kolon bazlı sıralama
    (function initCompanyPropertySorting() {
        const container = document.getElementById('company-table-container');
        if (!container) return;
        const headers = container.querySelectorAll('th.sortable');
        headers.forEach(th => {
            th.addEventListener('click', function() {
                const key = th.dataset.sortKey;
                if (!key || !Array.isArray(companyPropertyData)) return;

                // Yönü toggle et
                let direction = 'asc';
                if (th.classList.contains('sort-asc')) {
                    direction = 'desc';
                }

                // Tüm header'lardan sort sınıflarını kaldır
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');

                companyPropertyData.sort((a, b) => {
                    const pA = a?.data?.properties || {};
                    const pB = b?.data?.properties || {};
                    let va, vb;
                    switch (key) {
                        case 'id':
                            va = Number(pA.id || 0);
                            vb = Number(pB.id || 0);
                            break;
                        case 'il':
                            va = (pA.ilAd || '').toString().toLowerCase();
                            vb = (pB.ilAd || '').toString().toLowerCase();
                            break;
                        case 'ilce':
                            va = (pA.ilceAd || '').toString().toLowerCase();
                            vb = (pB.ilceAd || '').toString().toLowerCase();
                            break;
                        case 'mahalle':
                            va = (pA.mahalleAd || '').toString().toLowerCase();
                            vb = (pB.mahalleAd || '').toString().toLowerCase();
                            break;
                        case 'ada':
                            va = Number(pA.adaNo || 0);
                            vb = Number(pB.adaNo || 0);
                            break;
                        case 'parsel':
                            va = Number(pA.parselNo || 0);
                            vb = Number(pB.parselNo || 0);
                            break;
                        case 'alan':
                            va = Number((pA.alan || '0').toString().replace(/\./g, '').replace(',', '.'));
                            vb = Number((pB.alan || '0').toString().replace(/\./g, '').replace(',', '.'));
                            break;
                        case 'nitelik':
                            va = (pA.nitelik || '').toString().toLowerCase();
                            vb = (pB.nitelik || '').toString().toLowerCase();
                            break;
                        case 'imarFonksiyon':
                            va = (pA.imarFonksiyon || '').toString().toLowerCase();
                            vb = (pB.imarFonksiyon || '').toString().toLowerCase();
                            break;
                        case 'uygunluk':
                            va = (pA.durum || '').toString().toLowerCase();
                            vb = (pB.durum || '').toString().toLowerCase();
                            break;
                        case 'sorgu':
                            va = (pA.sorguDurumu || '').toString().toLowerCase();
                            vb = (pB.sorguDurumu || '').toString().toLowerCase();
                            break;
                        case 'basvuru':
                            va = (pA.basvuru_turu || '').toString().toLowerCase();
                            vb = (pB.basvuru_turu || '').toString().toLowerCase();
                            break;
                        case 'firma':
                            va = (pA.basvurulan_firma || '').toString().toLowerCase();
                            vb = (pB.basvurulan_firma || '').toString().toLowerCase();
                            break;
                        default:
                            va = '';
                            vb = '';
                    }

                    if (typeof va === 'number' && typeof vb === 'number') {
                        return direction === 'asc' ? va - vb : vb - va;
                    }
                    const sa = String(va);
                    const sb = String(vb);
                    if (sa === sb) return 0;
                    if (direction === 'asc') {
                        return sa > sb ? 1 : -1;
                    }
                    return sa < sb ? 1 : -1;
                });

                // Sıralanmış veriyi yeniden çiz
                updateCompanyManagement(companyPropertyData);
            });
        });
    })();

let companyPropertyData = [];
let applicationBaseData = [];
let currentApplicationData = [];

function updateCompanyManagement(data) {
    const resultList = document.getElementById('company-property-list');
    if (!resultList) return;
    resultList.innerHTML = '';  // Önce mevcut içeriği temizleyin

    // Tüm verileri orijinal yapısıyla sakla
    companyPropertyData = Array.isArray(data) ? data.slice() : [];

    companyPropertyData.forEach((item, index) => {
        const p = item.data?.properties || {};
        const row = document.createElement('tr');
        const id = p.id || '';

        row.innerHTML = `
            <td>
                <input type="checkbox"
                       class="form-check-input company-property-checkbox"
                       data-property-id="${id}">
            </td>
            <td style="text-align:center;">${index + 1}</td>
            <td>${id}</td>
            <td>${p.ilAd || ''}</td>
            <td>${p.ilceAd || ''}</td>
            <td>${p.mahalleAd || ''}</td>
            <td>${p.adaNo || ''}</td>
            <td>${p.parselNo || ''}</td>
            <td>${p.alan || ''}</td>
            <td>${p.nitelik || ''}</td>
            <td>${p.imarFonksiyon || ''}</td>
            <td>${p.durum || ''}</td>
            <td>${p.sorguDurumu || ''}</td>
            <td>${p.basvuru_turu || ''}</td>
            <td>${p.basvurulan_firma || ''}</td>
        `;
        resultList.appendChild(row);
    });
    
    // Seçili şirkete ait parselleri haritaya çiz
    data.forEach(jitem => {
        window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: jitem.data }));
    });
    
    // "Talebe Ekle" butonunu görünür yap (şirket seçildiğinde)
    // checkAndShowCompanyAddToRequestBtn fonksiyonunu kullan (tüm koşulları kontrol eder)
    setTimeout(function() {
        if (typeof window.checkAndShowCompanyAddToRequestBtn === 'function') {
            window.checkAndShowCompanyAddToRequestBtn();
        } else {
            // Fallback: Basit kontrol
            const companyAddToRequestBtn = document.getElementById('companyAddToRequestBtn');
            if (companyAddToRequestBtn && data.length > 0) {
                companyAddToRequestBtn.style.display = 'inline-block';
                // Event listener'ı kontrol et
                if (typeof window.setupCompanyAddToRequestBtn === 'function') {
                    window.setupCompanyAddToRequestBtn();
                }
            }
        }
    }, 50);
    
    // Parsel checkbox'ları için change event listener ekle
    // Checkbox seçildiğinde/kaldırıldığında "Talebe Ekle" butonunu göster/gizle
    document.querySelectorAll('#company-property-list .company-property-checkbox').forEach(checkbox => {
        // Mevcut listener'ları kaldırmak için clone ve replace
        if (!checkbox.dataset.listenerAdded) {
            checkbox.dataset.listenerAdded = 'true';
            checkbox.addEventListener('change', function() {
                // Scroll pozisyonunu koru - layout değişikliğinden önce kaydet
                const companyTableContainer = document.getElementById('company-table-container');
                const navCompanyManagement = document.getElementById('nav-company-management');
                const scrollTop = companyTableContainer ? companyTableContainer.scrollTop : (navCompanyManagement ? navCompanyManagement.scrollTop : 0);
                
                // checkAndShowCompanyAddToRequestBtn fonksiyonunu kullan (tüm koşulları kontrol eder)
                if (typeof window.checkAndShowCompanyAddToRequestBtn === 'function') {
                    window.checkAndShowCompanyAddToRequestBtn();
                } else {
                    // Fallback: Basit kontrol
                    const companyAddToRequestBtn = document.getElementById('companyAddToRequestBtn');
                    const selectedCheckboxes = document.querySelectorAll('#company-property-list .company-property-checkbox:checked');
                    
                    if (companyAddToRequestBtn) {
                        if (selectedCheckboxes.length > 0 && window.currentRequestData) {
                            companyAddToRequestBtn.style.display = 'inline-block';
                            if (typeof window.setupCompanyAddToRequestBtn === 'function') {
                                window.setupCompanyAddToRequestBtn();
                            }
                        } else {
                            companyAddToRequestBtn.style.display = 'none';
                        }
                    }
                }
                
                // Scroll pozisyonunu geri yükle - layout değişikliğinden sonra
                setTimeout(() => {
                    if (companyTableContainer) {
                        companyTableContainer.scrollTop = scrollTop;
                    } else if (navCompanyManagement) {
                        navCompanyManagement.scrollTop = scrollTop;
                    }
                }, 0);
            });
        }
    });
}

document.getElementById('company-property-list').addEventListener('click', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    
    const index = row.rowIndex - 1; // thead'i hesaba katmak için -1
    if (index >= 0 && index < companyPropertyData.length) {
        const item = companyPropertyData[index];
        highlightAndZoomToPolygon(item.data);
        updateCompanyPropertyInfo(item.data.properties);
    }
});

    document.addEventListener('DOMContentLoaded', function() {
        let playInterval;
        let currentIndex = 0;
        let isPaused = false;

    document.getElementById('companyPlayButton').addEventListener('click', function() {
        if (this.innerHTML.includes('Oynat')) {
            startPlaying();
        } else if (this.innerHTML.includes('Duraklat')) {
            pausePlaying();
        } else {
            resumePlaying();
        }
    });

    document.getElementById('companyStopButton').addEventListener('click', stopPlaying);

        function startPlaying() {
        document.getElementById('companyPlayButton').innerHTML = '<i class="fas fa-pause"></i> Duraklat';
        document.getElementById('companyStopButton').style.display = 'inline-block';
        document.getElementById('companySelectedPropertyInfo').style.display = 'block';
        
        const rows = document.querySelectorAll('#company-property-list tr');
        
        function playNext() {
            if (currentIndex < rows.length) {
                rows[currentIndex].click();
                currentIndex++;
            } else {
                stopPlaying();
            }
        }
        
        playInterval = setInterval(playNext, 3000); // Her 3 saniyede bir sonraki araziye geç
        playNext(); // İlk araziyi hemen göster
    }

    function stopPlaying() {
        clearInterval(playInterval);
        document.getElementById('companyPlayButton').innerHTML = '<i class="fas fa-play"></i> Oynat';
        document.getElementById('companyStopButton').style.display = 'none';
        document.getElementById('companySelectedPropertyInfo').style.display = 'none';
        currentIndex = 0;
        isPaused = false;
    }

    function pausePlaying() {
        clearInterval(playInterval);
        document.getElementById('companyPlayButton').innerHTML = '<i class="fas fa-play"></i> Devam Et';
        isPaused = true;
    }

    function resumePlaying() {
        startPlaying();
        isPaused = false;
    }

   
    
});
function updateCompanyPropertyInfo(properties) {
        console.log("Güncellenen properties: ", properties); // Bu satırı ekleyin

    document.getElementById('companySelectedPropertyInfo').style.display = 'block';
    document.getElementById('company-info-id').textContent = properties.id || 'Bilgi yok';
    document.getElementById('company-info-il').textContent = properties.ilAd || 'Bilgi yok';
    document.getElementById('company-info-ilce').textContent = properties.ilceAd || 'Bilgi yok';
    document.getElementById('company-info-mahalle').textContent = properties.mahalleAd || 'Bilgi yok';
    document.getElementById('company-info-nitelik').textContent = properties.nitelik || 'Bilgi yok';
    document.getElementById('company-info-alan').textContent = properties.alan || 'Bilgi yok';
}


// Kaydet butonuna tıklama işlevi
document.getElementById('saveCompanyBtn').addEventListener('click', async function() {
    const companyId = document.getElementById('editCompanyId').value;
    const newCompanyName = document.getElementById('editCompanyName').value.trim();
   
    

    if (newCompanyName === "") {
        TitleAlertMessage('⚠️ Lütfen şirket adını giriniz.', 'warning');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'update_company');
        formData.append('company_id', companyId);
        formData.append('company_name', newCompanyName);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
       
           
                editModal.hide();
       
            fetchCompanies(); // Refresh the table after deletion
            TitleAlertMessage(`Şirket İsmi Başarıyla Güncellendi`, 'success');
           
        } else {
            TitleAlertMessage('❌ Şirket güncellenemedi.', 'danger');
        }
    } catch (error) {
        console.error("Error updating company:", error);
        TitleAlertMessage('❌ Şirket güncellenirken bir hata oluştu.', 'danger');
    }
});

// When 'Save' is clicked in the modal
            document.getElementById('saveCopyCompany').addEventListener('click', function() {
                const newCompanyName = document.getElementById('newCompanyNameInput').value.trim();
                const companyId = document.getElementById('copyCompanyId').value;
                if (newCompanyName === '') {
                    TitleAlertMessage('⚠️ Lütfen yeni şirket adı giriniz.', 'warning');
                    return;
                }

                // Send API request to copy company properties
                fetch('api.php?action=copy_company_properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId, newCompanyName })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                         copyModal.hide();
                        fetchCompanies(); // Refresh company list
                        TitleAlertMessage(`Şirket Başarıyla Kopyalandı`, 'success');
                    } else {
                        TitleAlertMessage('❌ Şirket kopyalama başarısız oldu.', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error copying company:', error);
                    TitleAlertMessage('❌ Kopyalama işlemi sırasında bir hata oluştu.', 'danger');
                });
            });

        // Şirket Yönetimi Menü Kartları
        const addCompanyCard = document.getElementById('addCompanyCard');
        const viewCompaniesCard = document.getElementById('viewCompaniesCard');
        
        const addCompanyScreen = document.getElementById('addCompanyScreen');
        const viewCompaniesScreen = document.getElementById('viewCompaniesScreen');
        
        const companyMainMenu = document.querySelector('.company-main-menu');
        
        // Geri butonları
        const backFromAddCompany = document.getElementById('backFromAddCompany');
        const backFromViewCompanies = document.getElementById('backFromViewCompanies');
        
        // Form alanlarını temizle
        function clearCompanyForm() {
            const newCompanyNameInput = document.getElementById('newCompanyName');
            const companyDescriptionInput = document.getElementById('companyDescription');
            
            if (newCompanyNameInput) {
                newCompanyNameInput.value = "";
            }
            if (companyDescriptionInput) {
                companyDescriptionInput.value = "";
                companyDescriptionInput.placeholder = "Şirket açıklaması...";
            }
        }

        // Ekranları gizle
        function hideAllScreens() {
            addCompanyScreen.style.display = 'none';
            viewCompaniesScreen.style.display = 'none';
            companyMainMenu.style.display = 'block';
        }
        
        // Şirket Yönetimi Kartı
        if (addCompanyCard) {
            addCompanyCard.addEventListener('click', function() {
                companyMainMenu.style.display = 'none';
                addCompanyScreen.style.display = 'block';
                // Şirket listesini yükle
                fetchCompaniesForManagement();
            });
        }
        
        // Arazi Yönetimi Kartı
        if (viewCompaniesCard) {
            viewCompaniesCard.addEventListener('click', async function() {
                companyMainMenu.style.display = 'none';
                viewCompaniesScreen.style.display = 'block';
                // Şirket listesini yükle ve arama fonksiyonunu başlat
                await fetchCompaniesForViewing();
                initializeCompanySearch();
                initializeTableSorting();
                // Şirket dropdown'unu doldur
                await populateCompanySelect();
            });
        }
        
        // Geri butonları
        if (backFromAddCompany) {
            backFromAddCompany.addEventListener('click', function() {
                clearCompanyForm(); // Form alanlarını temizle
                hideAllScreens();
            });
        }
        
        if (backFromViewCompanies) {
            backFromViewCompanies.addEventListener('click', function() {
                // Arama alanını temizle
                const searchInput = document.getElementById('companySearchInput');
                if (searchInput) {
                    searchInput.value = '';
                }
                hideAllScreens();
            });
        }
        
        // İptal butonu
        const cancelAddCompany = document.getElementById('cancelAddCompany');
        if (cancelAddCompany) {
            cancelAddCompany.addEventListener('click', function() {
                clearCompanyForm(); // Form alanlarını temizle
                hideAllScreens();
            });
        }

        // Password Protection for Sorgu Yönetimi
        const showPasswordModalBtn = document.getElementById('showPasswordModal');
        const passwordModal = document.getElementById('passwordModal');
        const passwordInput = document.getElementById('passwordInput');
        const checkPasswordBtn = document.getElementById('checkPassword');
        const passwordError = document.getElementById('passwordError');
        
        // Correct password (you can change this)
        const correctPassword = 'admin123';
        
        if (showPasswordModalBtn) {
            showPasswordModalBtn.addEventListener('click', function() {
                const modal = new bootstrap.Modal(passwordModal);
                modal.show();
            });
        }
        
        if (checkPasswordBtn) {
            checkPasswordBtn.addEventListener('click', function() {
                const enteredPassword = passwordInput.value;
                
                if (enteredPassword === correctPassword) {
                    // Correct password - show content
                    passwordError.style.display = 'none';
                    passwordModal.querySelector('.btn-close').click();
                    
                    // Show the protected content
                    const protectedContent = document.querySelector('.password-protection-section');
                    if (protectedContent) {
                        protectedContent.innerHTML = `
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i>
                                <strong>Erişim Onaylandı</strong>
                                <p class="mb-0">Sorgu yönetimi araçlarına erişebilirsiniz.</p>
                            </div>
                        `;
                    }
                } else {
                    // Wrong password
                    passwordError.style.display = 'block';
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            });
        }
        
        // Enter key support for password input
        if (passwordInput) {
            passwordInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    checkPasswordBtn.click();
                }
            });
        }

        // Seçili Parseller İçin Fonksiyonlar
        let selectedProperties = [];
        let queryItems = [];

        // Tümünü seç/seçme
        const selectAllProperties = document.getElementById('selectAllProperties');
        if (selectAllProperties) {
            selectAllProperties.addEventListener('change', function() {
                const checkboxes = document.querySelectorAll('#result-list input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
                updateSelectedProperties();
            });
        }

        // Seçili parselleri güncelle
        function updateSelectedProperties() {
            console.log('🔄 updateSelectedProperties çağrıldı');
            // Sol taraftaki liste tabındaki checkbox'ları kontrol et
            const checkboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
            console.log('📊 Bulunan checkbox sayısı:', checkboxes.length);
            console.log('📊 Checkbox\'lar:', checkboxes);
            
            selectedProperties = Array.from(checkboxes).map(checkbox => {
                const row = checkbox.closest('tr');
                return {
                    id: row.cells[1].textContent,
                    il: row.cells[2].textContent,
                    ilce: row.cells[3].textContent,
                    mahalle: row.cells[4].textContent,
                    adaParsel: row.cells[5].textContent,
                    nitelik: row.cells[6].textContent,
                    imarFonksiyon: row.cells[7].textContent,
                    durum: row.cells[8].textContent,
                    sorguDurumu: row.cells[9].textContent,
                    alan: row.cells[10].textContent
                };
            });
            
            const selectedCount = document.getElementById('selectedCount');
            const selectedActions = document.getElementById('selectedActions');
            
            if (selectedCount) {
                selectedCount.textContent = `${selectedProperties.length} seçili`;
            }
            
            if (selectedActions) {
                selectedActions.style.display = selectedProperties.length > 0 ? 'block' : 'none';
            }
            
            console.log('📊 selectedProperties güncellendi:', selectedProperties);
            console.log('📊 selectedProperties.length:', selectedProperties.length);
        }

        // Excel'e indir butonu
        const exportToExcelBtn = document.getElementById('exportToExcelBtn');
        if (exportToExcelBtn) {
            exportToExcelBtn.addEventListener('click', function() {
                if (selectedProperties.length === 0) {
                    TitleAlertMessage('⚠️ Lütfen en az bir parsel seçin.', 'warning');
                    return;
                }
                
                // Excel dosyası oluştur
                exportToExcel(selectedProperties, 'secilen_parseller.xlsx');
            });
        }

        // ===== YENİ SORGU SIRASINA EKLE BUTONU =====
        const sendToQueryBtn = document.getElementById('sendToQueryBtn');
        if (sendToQueryBtn) {
            sendToQueryBtn.addEventListener('click', function() {
                console.log('🚀 Sorgu sırasına ekle butonuna tıklandı');
                
                // Seçili checkbox'ları bul
                const selectedCheckboxes = document.querySelectorAll('.property-checkbox:checked');
                console.log('📋 Seçili checkbox sayısı:', selectedCheckboxes.length);
                
                if (selectedCheckboxes.length === 0) {
                    TitleAlertMessage('⚠️ Lütfen en az bir arazi seçiniz!', 'warning');
                    return;
                }
                
                // Seçili ID'leri al
                const selectedIds = Array.from(selectedCheckboxes).map(checkbox => {
                    const row = checkbox.closest('tr');
                    return row.cells[1].textContent.trim(); // Prolegal ID
                });
                
                console.log('📝 Seçili ID\'ler:', selectedIds);
                
                // Global addToQueryQueue fonksiyonunu kullan (tasarim/ui.js)
                if (typeof addToQueryQueue === 'function') {
                    addToQueryQueue(selectedIds);
                } else {
                    TitleAlertMessage('❌ Sorgu sırasına ekleme fonksiyonu bulunamadı.', 'danger');
                }
            });
        }

        // CSV içeriği oluştur
        function createCSVContent(data) {
            const headers = ['ID', 'İl', 'İlçe', 'Mahalle', 'Ada/Parsel', 'Nitelik', 'İmar Fonksiyonu', 'Durum', 'Sorgu Durumu', 'Alan'];
            const csvRows = [headers.join(',')];
            
            data.forEach(item => {
                const row = [
                    `"${item.id || ''}"`,
                    `"${item.il || ''}"`,
                    `"${item.ilce || ''}"`,
                    `"${item.mahalle || ''}"`,
                    `"${item.adaParsel || ''}"`,
                    `"${item.nitelik || ''}"`,
                    `"${item.imarFonksiyon || ''}"`,
                    `"${item.durum || ''}"`,
                    `"${item.sorguDurumu || ''}"`,
                    `"${item.alan || ''}"`
                ];
                csvRows.push(row.join(','));
            });
            
            return csvRows.join('\n');
        }

        // Excel dosyası oluştur ve indir
        function exportToExcel(data, filename, columns = null, headers = null) {
            // Verileri JSON olarak gönder
            const jsonData = JSON.stringify(data);
            
            // Form oluştur
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'export_excel.php';
            form.target = '_blank';
            
            // Veri input'u
            const dataInput = document.createElement('input');
            dataInput.type = 'hidden';
            dataInput.name = 'data';
            dataInput.value = jsonData;
            
            // Dosya adı input'u
            const filenameInput = document.createElement('input');
            filenameInput.type = 'hidden';
            filenameInput.name = 'filename';
            filenameInput.value = filename;

            // Opsiyonel kolon / header bilgisi
            if (Array.isArray(columns) && columns.length > 0) {
                const columnsInput = document.createElement('input');
                columnsInput.type = 'hidden';
                columnsInput.name = 'columns';
                columnsInput.value = JSON.stringify(columns);
                form.appendChild(columnsInput);
            }
            if (Array.isArray(headers) && headers.length > 0) {
                const headersInput = document.createElement('input');
                headersInput.type = 'hidden';
                headersInput.name = 'headers';
                headersInput.value = JSON.stringify(headers);
                form.appendChild(headersInput);
            }
            
            form.appendChild(dataInput);
            form.appendChild(filenameInput);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        }

        // CSV indir (yedek)
        function downloadCSV(content, filename) {
            const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Sorgu yönetimi tablosunu güncelle
        function updateQueryManagementTable() {
            const tbody = document.getElementById('queryManagementTable');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            queryItems.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <input type="checkbox" class="form-check-input query-item-checkbox" data-index="${index}">
                    </td>
                    <td>${item.id}</td>
                    <td>${item.il}</td>
                    <td>${item.ilce}</td>
                    <td>${item.mahalle}</td>
                    <td>${item.nitelik}</td>
                    <td>${item.alan}</td>
                    <td>
                        <button class="btn btn-danger btn-sm remove-query-item" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        // Query Management Functions
        async function loadQueryQueue() {
            try {
                const response = await fetch('api.php?action=get_query_queue');
                const queue = await response.json();
                updateQueryQueueTable(queue);
            } catch (error) {
                console.error('Error loading query queue:', error);
            }
        }

        async function loadQueryResults() {
            try {
                const response = await fetch('api.php?action=get_query_results');
                const results = await response.json();
                updateQueryResultsTable(results);
            } catch (error) {
                console.error('Error loading query results:', error);
            }
        }

        async function updateQueryResult(resultId, status) {
            try {
                const response = await fetch('api.php?action=update_query_result', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        result_id: resultId,
                        status: status
                    })
                });
                const result = await response.json();
                if (result.success) {
                    TitleAlertMessage('Sonuç güncellendi', 'success', 3);
                    // Listeyi yeniden çekmek yerine sadece ilgili satırı kaldır
                    queryResultData = Array.isArray(queryResultData) ? queryResultData.filter(r => String(r.id) !== String(resultId)) : [];
                    queryResultBaseData = Array.isArray(queryResultBaseData) ? queryResultBaseData.filter(r => String(r.id) !== String(resultId)) : [];
                    currentQueryResultData = Array.isArray(currentQueryResultData) ? currentQueryResultData.filter(r => String(r.id) !== String(resultId)) : [];
                    renderQueryResults(currentQueryResultData);
                }
            } catch (error) {
                console.error('Error updating query result:', error);
            }
        }

        function updateQueryQueueTable(queue) {
            const tableBody = document.getElementById('queryManagementTable');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            queue.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="checkbox" class="form-check-input query-item-checkbox" value="${item.id}"></td>
                    <td>${item.property_id}</td>
                    <td>${item.status}</td>
                    <td>${item.created_at}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="removeFromQueue(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        function updateQueryResultsTable(results) {
            const tableBody = document.getElementById('queryResultsTable');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            results.forEach(result => {
                const row = document.createElement('tr');
                const statusClass = result.status === 'approved' ? 'success' : 
                                  result.status === 'rejected' ? 'danger' : 'warning';
                const statusText = result.status === 'approved' ? 'Uygun' : 
                                 result.status === 'rejected' ? 'Uygun Değil' : 'Beklemede';
                
                row.innerHTML = `
                    <td>${result.property_id}</td>
                    <td>${result.query_date}</td>
                    <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="updateQueryResult(${result.id}, 'approved')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="updateQueryResult(${result.id}, 'rejected')">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        function exportQueryResults() {
            const table = document.getElementById('queryResultsTable');
            if (!table) return;
            
            let csv = 'ID,Tarih,Durum\n';
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    csv += `${cells[0].textContent},${cells[1].textContent},${cells[2].textContent}\n`;
                }
            });
            
            downloadCSV(csv, 'sorgu_sonuclari.csv');
        }

        // Sorgu yönetimi tablosu olayları
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-query-item')) {
                const index = parseInt(e.target.dataset.index);
                queryItems.splice(index, 1);
                updateQueryManagementTable();
            }
            
            // Sorguya gönder butonu
            // sendToQueryBtn event listener kaldırıldı - yeniden yazılacak
            
            // Sonuçları Excel'e indir butonu
            if (e.target.id === 'exportResultsBtn') {
                exportQueryResults();
            }
        });

        // Sorgu yönetimi tabı şifre kontrolü ile korunuyor (aşağıda tanımlı)

        // Sorgu temizle butonu
        const clearQueryBtn = document.getElementById('clearQueryBtn');
        if (clearQueryBtn) {
            clearQueryBtn.addEventListener('click', function() {
                if (confirm('Tüm sorgu öğelerini temizlemek istediğinizden emin misiniz?')) {
                    queryItems = [];
                    updateQueryManagementTable();
                }
            });
        }

        // Sorgu Excel'e indir butonu
        const exportQueryBtn = document.getElementById('exportQueryBtn');
        if (exportQueryBtn) {
            exportQueryBtn.addEventListener('click', function() {
                if (queryItems.length === 0) {
                    TitleAlertMessage('⚠️ Sorgu yönetiminde hiç öğe yok.', 'warning');
                    return;
                }
                
                exportToExcel(queryItems, 'sorgu_parselleri.xlsx');
            });
        }

        // Liste tabı Excel'e indir butonu
        const exportListToExcelBtn = document.getElementById('exportListToExcelBtn');
        if (exportListToExcelBtn) {
            exportListToExcelBtn.addEventListener('click', function() {
                if (propertyData.length === 0) {
                    TitleAlertMessage('⚠️ Listede hiç parsel yok.', 'warning');
                    return;
                }
                
                // propertyData'dan Excel için uygun formata çevir
                const excelData = propertyData.map(item => ({
                    id: item.data.properties.id || '',
                    il: item.data.properties.ilAd || '',
                    ilce: item.data.properties.ilceAd || '',
                    mahalle: item.data.properties.mahalleAd || '',
                    adaParsel: item.data.properties.adaParsel || '',
                    nitelik: item.data.properties.nitelik || '',
                    imarFonksiyon: item.data.properties.imarFonksiyon || '',
                    durum: item.data.properties.durum || '',
                    sorguDurumu: item.data.properties.sorguDurumu || '',
                    alan: item.data.properties.alan || ''
                }));
                
                exportToExcel(excelData, 'parsel_listesi.xlsx');
            });
        }

        // Tümünü seç sorgu yönetimi
        const selectAllQueryItems = document.getElementById('selectAllQueryItems');
        if (selectAllQueryItems) {
            selectAllQueryItems.addEventListener('change', function() {
                const checkboxes = document.querySelectorAll('.query-item-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
            });
        }

        // Parsel checkbox olayları
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('property-checkbox')) {
                updateSelectedProperties();
            }
        });

        // Tapusor butonu
        const tapusorBtn = document.getElementById('tapusorBtn');
        if (tapusorBtn) {
            tapusorBtn.addEventListener('click', function() {
                let lat = null;
                let lng = null;

                // Öncelik: Seçili parselin merkez koordinatı (geometriye göre)
                try {
                    if (window.currentParcelCenter && typeof window.currentParcelCenter.lat === 'function') {
                        lat = window.currentParcelCenter.lat();
                        lng = window.currentParcelCenter.lng();
                        console.log('Tapusor - currentParcelCenter kullanılıyor:', { lat, lng });
                    }
                } catch (e) {
                    console.error('Tapusor - currentParcelCenter okunurken hata:', e);
                }

                // Eğer parsel merkezi yoksa, koordinat input'una geri dön
                if (lat === null || lng === null) {
                    const coordinateInput = document.getElementById('coordinate-info-input');
                if (!coordinateInput || !coordinateInput.value) {
                    TitleAlertMessage('⚠️ Koordinat bilgisi bulunamadı. Lütfen önce haritada bir konum veya parsel seçin.', 'warning');
                    return;
                }
                    
                    const coordinateValue = coordinateInput.value;
                    const parts = coordinateValue.split(' - ').map(coord => coord.trim());
                    if (parts.length === 2) {
                        lat = parts[0];
                        lng = parts[1];
                    }

                    if (!lat || !lng) {
                        TitleAlertMessage('⚠️ Koordinat bilgisi geçersiz.', 'warning');
                        return;
                    }

                    console.log('Tapusor - coordinate-info-input kullanılıyor:', { lat, lng });
                }
                
                // Tapusor linkini oluştur (zoom=18, seçili parsel merkezi veya koordinat input'u kullanılıyor)
                const tapusorUrl = `https://tapusor.com/bilgi-al/teknik?zoom=18&latc=${lat}&lngc=${lng}&mapType=2&lat=${lat}&lng=${lng}`;
                console.log('Tapusor URL:', tapusorUrl); // Debug için
                console.log('Koordinatlar:', { lat, lng }); // Debug için
                
                // Yeni sekmede aç ve referansı sakla
                if (!tapusorWindow || tapusorWindow.closed) {
                    tapusorWindow = window.open(tapusorUrl, TAPUSOR_WINDOW_NAME);
                } else {
                    tapusorWindow.location.href = tapusorUrl;
                    tapusorWindow.focus();
                }

                // LocalStorage'a işaretle
                const propId = document.getElementById('oznitelik:id')?.textContent?.trim();
                if (propId) {
                    markActionChecked(propId, 'tapusor');
                }
            });
        }

        // Google Earth butonu
        const googleEarthBtn = document.getElementById('googleEarthBtn');
        console.log('Google Earth button found:', googleEarthBtn); // Debug için
        if (googleEarthBtn) {
            googleEarthBtn.addEventListener('click', function() {
                // Koordinat bilgilerini al
                const coordinateInput = document.getElementById('coordinate-info-input');
                if (!coordinateInput || !coordinateInput.value) {
                    TitleAlertMessage('⚠️ Koordinat bilgisi bulunamadı. Lütfen önce haritada bir konum seçin.', 'warning');
                    return;
                }
                
                // Koordinatları parse et
                const coordinateValue = coordinateInput.value;
                const [lat, lng] = coordinateValue.split(' - ').map(coord => coord.trim());
                
                if (!lat || !lng) {
                    TitleAlertMessage('⚠️ Koordinat bilgisi geçersiz.', 'warning');
                    return;
                }
                
                // Eğer poligon varsa KML oluşturup Earth web ile overlay aç
                const panel = window.currentPanel || null;
                const geometry = panel?.geometry || null;
                let earthUrl = null;
                if (geometry) {
                    const center = (() => {
                        try {
                            if (geometry.type === 'Polygon' && geometry.coordinates?.[0]?.length) {
                                const coords = geometry.coordinates[0];
                                const lats = coords.map(c => c[1]);
                                const lngs = coords.map(c => c[0]);
                                const clat = (Math.min(...lats) + Math.max(...lats)) / 2;
                                const clng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                                return { lat: clat, lng: clng };
                            } else if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]?.length) {
                                const coords = geometry.coordinates[0][0];
                                const lats = coords.map(c => c[1]);
                                const lngs = coords.map(c => c[0]);
                                const clat = (Math.min(...lats) + Math.max(...lats)) / 2;
                                const clng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                                return { lat: clat, lng: clng };
                            }
                        } catch (_) {}
                        return { lat: parseFloat(lat), lng: parseFloat(lng) };
                    })();
                    earthUrl = buildKmlEarthUrl(geometry, center);
                }
                if (!earthUrl) {
                    earthUrl = `https://earth.google.com/web/@${lat},${lng},300a,600d,35y,350h,60t,0r/data=CgRCAggBKAI6AwoBMEICCABKDQj___________8BEAA?authuser=0`;
                }

                // Mevcut sekmeyi yeniden kullan; COOP bloklanırsa eskiyi kapatıp tek yeni sekme aç
                let reused = false;
                // Global referans tutulmuşsa onu kullan
                earthWindow = window.__earthWindowRef || earthWindow;
                // Referans yoksa veya tarayıcı kapalı sanıyorsa, isimden yeniden yakalamayı dene
                if (!earthWindow || earthWindow.closed) {
                    try {
                        const byName = window.open('', EARTH_WINDOW_NAME);
                        if (byName) {
                            earthWindow = byName;
                            window.__earthWindowRef = byName;
                        }
                    } catch (_) {
                        earthWindow = null;
                    }
                }
                if (earthWindow && !earthWindow.closed) {
                    try {
                        earthWindow.location.href = earthUrl;
                        earthWindow.focus();
                        reused = true;
                    } catch (e) {
                        // COOP/CSP sebebiyle erişilemiyorsa önceki sekmeyi kapatıp yeni aç
                        try { earthWindow.close(); } catch (_) {}
                        earthWindow = null;
                        window.__earthWindowRef = null;
                    }
                }
                if (!reused) {
                    earthWindow = window.open(earthUrl, EARTH_WINDOW_NAME);
                    if (!earthWindow) {
                        TitleAlertMessage('⚠️ 3D sekmesi açılamadı (popup engeli olabilir).', 'warning');
                        return;
                    }
                    window.__earthWindowRef = earthWindow;
                    try { earthWindow.focus(); } catch (_) {}
                }

                const propId = document.getElementById('oznitelik:id')?.textContent?.trim();
                if (propId) {
                    markActionChecked(propId, 'earth');
                }
            });
        }

        // TKGM butonu
        const tkgmBtn = document.getElementById('tkgmBtn');
        console.log('TKGM button found:', tkgmBtn); // Debug için
        if (tkgmBtn) {
            tkgmBtn.addEventListener('click', function() {
                // Arazi bilgilerini al
                const mahalleId = document.getElementById('oznitelik:mahalleno')?.textContent;
                const ada = document.getElementById('oznitelik:ada')?.textContent;
                const parsel = document.getElementById('oznitelik:parsel')?.textContent;
                
                console.log('TKGM arazi bilgileri:', { mahalleId, ada, parsel });
                
                if (!mahalleId || !ada || !parsel) {
                    TitleAlertMessage('⚠️ TKGM için gerekli bilgiler bulunamadı (Mahalle ID, Ada, Parsel).', 'warning');
                    return;
                }
                
                // TKGM linkini oluştur
                const tkgmUrl = `https://parselsorgu.tkgm.gov.tr/#ara/idari/${mahalleId}/${ada}/${parsel}`;
                console.log('TKGM URL:', tkgmUrl);
                
                // Yeni sekmede veya mevcut sekmede aç ve referansı sakla
                if (!tkgmWindow || tkgmWindow.closed) {
                    tkgmWindow = window.open(tkgmUrl, TKGM_WINDOW_NAME);
                } else {
                    tkgmWindow.location.href = tkgmUrl;
                    tkgmWindow.focus();
                }

                const propId = document.getElementById('oznitelik:id')?.textContent?.trim();
                if (propId) {
                    markActionChecked(propId, 'tkgm');
                }
            });
        }

        // Dış sekme durumlarına göre butonları tekrar aktif et
        window.addEventListener('focus', function() {
            try {
                if (tapusorWindow && tapusorWindow.closed && tapusorBtn) {
                    tapusorWindow = null;
                }
                if (earthWindow && earthWindow.closed && googleEarthBtn) {
                    earthWindow = null;
                    window.__earthWindowRef = null;
                }
                if (tkgmWindow && tkgmWindow.closed && tkgmBtn) {
                    tkgmWindow = null;
                }
            } catch (e) {
                console.error('Sekme durumu kontrol hatası:', e);
            }
        });

        // Modal aksiyon durum checkbox'larını property ID'ye göre güncelle (backend + kullanıcı bazlı)
        function syncActionChecksForCurrentProperty() {
            const propId = document.getElementById('oznitelik:id')?.textContent?.trim();
            const tapusorCheck = document.getElementById('tapusorChecked');
            const earthCheck = document.getElementById('googleEarthChecked');
            const tkgmCheck = document.getElementById('tkgmChecked');

            if (!propId || !tapusorCheck || !earthCheck || !tkgmCheck) return;

            fetch('api.php?action=get_parcel_actions&parcel_id=' + encodeURIComponent(propId), {
                credentials: 'same-origin'
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data || !data.success) return;
                tapusorCheck.checked = !!data.tapusor;
                earthCheck.checked = !!data.earth;
                tkgmCheck.checked = !!data.tkgm;
            })
            .catch(err => {
                console.error('❌ parcel_actions fetch hatası:', err);
            });
        }

        // Backend'e aksiyon durumlarını kaydet
        window.saveParcelActions = function(propertyId, overrides = {}) {
            const tapusorCheck = document.getElementById('tapusorChecked');
            const earthCheck = document.getElementById('googleEarthChecked');
            const tkgmCheck = document.getElementById('tkgmChecked');

            if (!propertyId || !tapusorCheck || !earthCheck || !tkgmCheck) return;

            const payload = {
                parcel_id: propertyId,
                tapusor: overrides.tapusor !== undefined ? !!overrides.tapusor : !!tapusorCheck.checked,
                earth: overrides.earth !== undefined ? !!overrides.earth : !!earthCheck.checked,
                tkgm: overrides.tkgm !== undefined ? !!overrides.tkgm : !!tkgmCheck.checked,
            };

            fetch('api.php?action=save_parcel_actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            }).catch(err => {
                console.error('❌ parcel_actions save hatası:', err);
            });
        };

        // Global helper: bir aksiyonu işaretle (butonlardan çağrılır)
        window.markActionChecked = function(propertyId, actionKey) {
            const tapusorCheck = document.getElementById('tapusorChecked');
            const earthCheck = document.getElementById('googleEarthChecked');
            const tkgmCheck = document.getElementById('tkgmChecked');

            if (!propertyId || !tapusorCheck || !earthCheck || !tkgmCheck) return;

            if (actionKey === 'tapusor') {
                tapusorCheck.checked = true;
            } else if (actionKey === 'earth') {
                earthCheck.checked = true;
            } else if (actionKey === 'tkgm') {
                tkgmCheck.checked = true;
            }

            saveParcelActions(propertyId);
        };

        // Checkbox'lardan gelen manuel değişiklikleri backend'e yaz
        function bindActionCheckbox(checkboxId, actionKey) {
            const el = document.getElementById(checkboxId);
            if (!el) return;

            el.addEventListener('change', function() {
                const propId = document.getElementById('oznitelik:id')?.textContent?.trim();
                if (!propId) return;

                const overrides = {};
                overrides[actionKey] = !!el.checked;
                saveParcelActions(propId, overrides);
            });
        }

        bindActionCheckbox('tapusorChecked', 'tapusor');
        bindActionCheckbox('googleEarthChecked', 'earth');
        bindActionCheckbox('tkgmChecked', 'tkgm');

        // Panel açıldığında / property değiştiğinde checkbox'ları güncellemek için
        // setPanel içi initializeModernModal zaten çağrılıyor; orada uygun yerde
        // syncActionChecksForCurrentProperty() çağrılabilir.
        // Burada güvenli olması için global event ile de bağlayalım:
        document.addEventListener('PROPERTY_PANEL_UPDATED', syncActionChecksForCurrentProperty);

        // İmar Bilgileri Düzenleme
        const editImarBtn = document.getElementById('editImarBtn');
        const imarViewMode = document.getElementById('imarViewMode');
        const imarEditMode = document.getElementById('imarEditMode');
        const imarEditForm = document.getElementById('imarEditForm');
        const cancelImarEdit = document.getElementById('cancelImarEdit');

        if (editImarBtn) {
            editImarBtn.addEventListener('click', function() {
                imarViewMode.style.display = 'none';
                imarEditMode.style.display = 'block';
                
                // Mevcut değerleri form alanlarına doldur
                document.getElementById('imarFonksiyonEdit').value = document.getElementById('imar:fonksiyon').textContent || '';
                document.getElementById('imarDurumEdit').value = document.getElementById('imar:durum').textContent || '';
                document.getElementById('imarPlaniEdit').value = document.getElementById('imar:plani').textContent || '';
                document.getElementById('yapilasmaOraniEdit').value = document.getElementById('imar:yapilasma_orani').textContent || '';
                document.getElementById('emsalEdit').value = document.getElementById('imar:emsal').textContent || '';
                document.getElementById('katAdediEdit').value = document.getElementById('imar:kat_adedi').textContent || '';
                document.getElementById('yukseklikEdit').value = document.getElementById('imar:yukseklik').textContent || '';
                document.getElementById('imarDurumuEdit').value = document.getElementById('imar:imar_durumu').textContent || '';
            });
        }

        if (cancelImarEdit) {
            cancelImarEdit.addEventListener('click', function() {
                imarViewMode.style.display = 'block';
                imarEditMode.style.display = 'none';
            });
        }

        if (imarEditForm) {
            imarEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Form verilerini topla
                const imarData = {
                    fonksiyon: document.getElementById('imarFonksiyonEdit').value,
                    durum: document.getElementById('imarDurumEdit').value,
                    plani: document.getElementById('imarPlaniEdit').value,
                    yapilasma_orani: document.getElementById('yapilasmaOraniEdit').value,
                    emsal: document.getElementById('emsalEdit').value,
                    kat_adedi: document.getElementById('katAdediEdit').value,
                    yukseklik: document.getElementById('yukseklikEdit').value,
                    imar_durumu: document.getElementById('imarDurumuEdit').value
                };

                // Prolegal ID'yi al (mevcut property data'dan)
                const prolegalId = propertyData && propertyData.length > 0 ? propertyData[0].data.properties.id : null;
                
                if (!prolegalId) {
                    TitleAlertMessage('⚠️ Prolegal ID bulunamadı.', 'warning');
                    return;
                }

                // API'ye gönder
                fetch('api.php?action=update_imar_data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prolegal_id: prolegalId,
                        imar_data: JSON.stringify(imarData)
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Başarılı - görüntüleme moduna geç ve verileri güncelle
                        imarViewMode.style.display = 'block';
                        imarEditMode.style.display = 'none';
                        
                        // Tabloyu güncelle
                        document.getElementById('imar:fonksiyon').textContent = imarData.fonksiyon || '-';
                        document.getElementById('imar:durum').textContent = imarData.durum || '-';
                        document.getElementById('imar:plani').textContent = imarData.plani || '-';
                        document.getElementById('imar:yapilasma_orani').textContent = imarData.yapilasma_orani || '-';
                        document.getElementById('imar:emsal').textContent = imarData.emsal || '-';
                        document.getElementById('imar:kat_adedi').textContent = imarData.kat_adedi || '-';
                        document.getElementById('imar:yukseklik').textContent = imarData.yukseklik || '-';
                        document.getElementById('imar:imar_durumu').textContent = imarData.imar_durumu || '-';
                        
                        TitleAlertMessage('✅ İmar bilgileri başarıyla güncellendi!', 'success');
                    } else {
                        TitleAlertMessage('❌ İmar bilgileri güncellenirken hata oluştu.', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    TitleAlertMessage('❌ İmar bilgileri güncellenirken hata oluştu.', 'danger');
                });
            });
        }

        // İmar bilgilerini yükleme fonksiyonu
        function loadImarBilgileri(prolegalId) {
            if (!prolegalId) return;
            
            fetch(`api.php?action=get_imar_bilgileri&prolegal_id=${prolegalId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.data) {
                        // İmar bilgilerini tabloya doldur
                        document.getElementById('imar:fonksiyon').textContent = data.data.fonksiyon || '-';
                        document.getElementById('imar:durum').textContent = data.data.durum || '-';
                        document.getElementById('imar:plani').textContent = data.data.plani || '-';
                        document.getElementById('imar:yapilasma_orani').textContent = data.data.yapilasma_orani || '-';
                        document.getElementById('imar:emsal').textContent = data.data.emsal || '-';
                        document.getElementById('imar:kat_adedi').textContent = data.data.kat_adedi || '-';
                        document.getElementById('imar:yukseklik').textContent = data.data.yukseklik || '-';
                        document.getElementById('imar:imar_durumu').textContent = data.data.imar_durumu || '-';
                    }
                })
                .catch(error => {
                    console.error('İmar bilgileri yüklenirken hata:', error);
                });
        }

// ===== SORGU SIRASI FONKSİYONLARI =====

// Seçili arazileri sorgu sırasına ekle
async function addSelectedToQueue() {
    console.log('🔄 Sorgu sırasına ekleme işlemi başlatılıyor...');
    
    // Debug: Tüm checkbox'ları kontrol et
    const allCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]');
    console.log('🔍 Toplam checkbox sayısı:', allCheckboxes.length);
    
    // Seçili checkbox'ları bul
    const selectedCheckboxes = document.querySelectorAll('#result-list input[type="checkbox"]:checked');
    console.log('🔍 Seçili arazi sayısı:', selectedCheckboxes.length);
    console.log('🔍 Seçili checkbox\'lar:', selectedCheckboxes);
    
    if (selectedCheckboxes.length === 0) {
        TitleAlertMessage('⚠️ Lütfen sorgu sırasına eklemek için en az bir arazi seçin!', 'warning');
        return;
    }
    
    // Seçili arazi ID'lerini topla
    const selectedIds = [];
    selectedCheckboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const idCell = row.querySelector('td:nth-child(2)'); // ID sütunu
        if (idCell) {
            selectedIds.push(idCell.textContent.trim());
        }
    });
    
    console.log('📋 Seçili arazi ID\'leri:', selectedIds);
    
    try {
        // API'ye sorgu sırasına ekleme isteği gönder
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=add_to_query_queue&property_ids=${selectedIds.join(',')}`
                });
                
                console.log('📡 Response status:', response.status);
                console.log('📡 Response ok:', response.ok);
                
                // Raw response'u oku
                const responseText = await response.text();
                console.log('📡 Raw response:', responseText);
                
                // JSON parse et
                let result;
                try {
                    result = JSON.parse(responseText);
                    console.log('📡 Parsed result:', result);
                } catch (parseError) {
                    console.error('❌ JSON parse hatası:', parseError);
                    console.error('❌ Raw response:', responseText);
                    TitleAlertMessage('❌ API\'den geçersiz yanıt geldi. Lütfen sayfayı yenileyin.', 'danger');
                    return;
                }
        
        if (result.success) {
            // Başarı mesajı
            let successMessage = `${result.success_count} arazi sorgu sırasına eklendi!`;
            
            // Uyarı mesajları varsa ekle
            if (result.errors && result.errors.length > 0) {
                successMessage += '\n\nUyarılar:\n' + result.errors.join('\n');
            }
            
            TitleAlertMessage(successMessage, 'success');
            
                    // Checkbox'ları temizle
                    selectedCheckboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                    
                    // Tabloyu yenile (sorgulama durumu güncellensin)
                    console.log('🔄 Tablo yenileniyor...');
                    setTimeout(() => {
                        // Liste tab'ındaki tabloyu yenile
                        if (typeof loadListeTab === 'function') {
                            loadListeTab();
                        } else if (typeof loadStatusFilter === 'function') {
                            loadStatusFilter('tumu');
                        }
                    }, 500);
                    
                    // Sağ sidebar'ı aç ve sorgu yönetimi tab'ına geç
                    openRightSidebarAndShowQueue();
                    
                    // Sorgu sırasını yenile
                    loadQueueList();
            
    } else {
            // Hata mesajı
            let errorMessage = 'Hata: ' + (result.message || 'Araziler sorgu sırasına eklenemedi.');
            
            // Detaylı hatalar varsa ekle
            if (result.errors && result.errors.length > 0) {
                errorMessage += '\n\nDetaylar:\n' + result.errors.join('\n');
            }
            
            TitleAlertMessage(errorMessage, 'danger');
        }
        
    } catch (error) {
        console.error('❌ Sorgu sırasına ekleme hatası:', error);
        TitleAlertMessage('❌ Araziler sorgu sırasına eklenirken bir hata oluştu.', 'danger');
    }
}

// Sağ sidebar'ı aç ve sorgu yönetimi tab'ını göster
function openRightSidebarAndShowQueue() {
    console.log('🔄 Sağ sidebar açılıyor ve sorgu yönetimi tab\'ına geçiliyor...');
    
    // Sağ sidebar'ı aç
    const rightMenu = document.getElementById('rightMenu');
    if (rightMenu) {
        rightMenu.classList.add('visible');
        console.log('✅ Sağ sidebar açıldı');
    }
    
    // Sorgu yönetimi tab'ına geç (eğer varsa)
    const queueTab = document.querySelector('[data-tab="general"]');
    if (queueTab) {
        queueTab.click();
        console.log('✅ Sorgu yönetimi tab\'ına geçildi');
    } else {
        console.log('❌ Sorgu yönetimi tab bulunamadı');
    }
}

let fullQueueData = [];
let queueBaseData = [];
let currentQueueData = [];
let lastQueueSourceType = 'Sorgu Sırası';
let queueSortState = { key: null, direction: 'asc' };
let queryResultSortState = { key: null, direction: 'asc' };

function getQueueSortValue(item, key) {
    if (!item) return '';
    switch (key) {
        case 'id':
            return Number(item.prolegal_id ?? item.id ?? 0);
        case 'il':
            return (item.il || '').toString().toLowerCase();
        case 'ilce':
            return (item.ilce || '').toString().toLowerCase();
        case 'mahalle':
            return (item.mahalle || '').toString().toLowerCase();
        case 'ada':
            return Number(item.ada || 0);
        case 'parsel':
            return Number(item.parsel || 0);
        case 'uygunluk':
            return (item.uygunluk_durumu || '').toString().toLowerCase();
        case 'sorgu':
            return (item.sorgulama_durumu || '').toString().toLowerCase();
        case 'sorgu_tarihi':
            return item.sorgu_tarihi ? new Date(item.sorgu_tarihi).getTime() : 0;
        case 'basvuru':
            return (item.basvuru_turu || '').toString().toLowerCase();
        case 'basvuru_tarihi':
            return item.basvuru_tarihi ? new Date(item.basvuru_tarihi).getTime() : 0;
        case 'firma':
            return (item.sorgulanan_firma || '').toString().toLowerCase();
        case 'sorgulanan_firma':
            return (item.sorgulanan_firma || item.basvurulan_firma || '').toString().toLowerCase();
        case 'konu':
            return (item.konu || '').toString().toLowerCase();
        case 'created_at':
            return item.created_at ? new Date(item.created_at).getTime() : 0;
        case 'updated_at':
            return item.updated_at ? new Date(item.updated_at).getTime() : 0;
        default:
            return '';
    }
}

function applyQueueSort() {
    if (!Array.isArray(currentQueueData) || !queueSortState.key) {
        return;
    }
    const { key, direction } = queueSortState;
    currentQueueData.sort((a, b) => {
        const va = getQueueSortValue(a, key);
        const vb = getQueueSortValue(b, key);
        if (typeof va === 'number' && typeof vb === 'number') {
            return direction === 'asc' ? va - vb : vb - va;
        }
        const sa = String(va);
        const sb = String(vb);
        if (sa === sb) return 0;
        if (direction === 'asc') {
            return sa > sb ? 1 : -1;
        }
        return sa < sb ? 1 : -1;
    });
}

function handleQueueHeaderClick(th, source) {
    const key = th.dataset.sortKey;
    if (!key) return;

    // Sadece ilgili tabloda sort ikonlarını güncelle
    const table = th.closest('table');
    if (table) {
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        // direction hesaplaması aşağıda source'a göre yapılıyor
    }

    if (source === 'queue') {
        let direction = 'asc';
        if (queueSortState.key === key && queueSortState.direction === 'asc') {
            direction = 'desc';
        }
        queueSortState = { key, direction };
        if (table) th.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        applyQueueSort();
        updateQueueDisplay(currentQueueData, true);
        return;
    }

    if (source === 'application') {
        // Sadece başvurular tablosunda lokal sıralama: tabloyu kendi içinde sırala
        const appContainer = document.getElementById('applicationListContainer');
        if (!appContainer) return;
        const rows = Array.from(appContainer.querySelectorAll('tbody tr'));
        const direction = th.classList.contains('sort-asc') ? 'desc' : 'asc';
        if (table) {
            const headers = table.querySelectorAll('th.sortable');
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
        rows.sort((a, b) => {
            const getVal = (row) => {
                const dataKey = row.querySelector(`[data-sort-key="${key}"]`) ? null : null;
                const cellIdx = Array.from(th.parentElement.children).indexOf(th);
                const text = row.querySelector(`td:nth-child(${cellIdx + 1})`)?.textContent?.trim() || '';
                const num = Number(text.replace(',', '.'));
                if (!isNaN(num)) return num;
                return text.toLowerCase();
            };
            const va = getVal(a);
            const vb = getVal(b);
            if (typeof va === 'number' && typeof vb === 'number') {
                return direction === 'asc' ? va - vb : vb - va;
            }
            return direction === 'asc' ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
        });
        const tbody = appContainer.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
            rows.forEach(r => tbody.appendChild(r));
        }
    }
}

// Sorgu sırasını yükle (filtreleme ile) - sadece sıradakiler
async function loadQueueList() {
    console.log('🔄 Sorgu sırası yükleniyor...');
    
    // Loading göster
    const loadingElement = document.getElementById('queryQueueLoading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    try {
        // Filtreleme parametrelerini al
        const filters = getActiveFilters();
        const queryParams = new URLSearchParams({
            action: 'get_queue_list',
            ...filters
        });
        
        const response = await fetch(`api.php?${queryParams}`);
        const queueItems = await response.json();
        
        console.log('📊 Sorgu sırası verileri:', queueItems);
        
        // Global veri setini güncelle
        fullQueueData = Array.isArray(queueItems) ? queueItems : [];
        queueBaseData = fullQueueData.slice();
        populateSharedCompanyOptions();
        populateSharedIlOptionsFromData();
        lastQueueSourceType = 'Sorgu Sırası';
        
        const filtered = renderFilteredQueue();
        updateRecordCounter(filtered, lastQueueSourceType);
        
    } catch (error) {
        console.error('❌ Sorgu sırası yükleme hatası:', error);
        const queueContainer = document.getElementById('queueListContainer');
        if (queueContainer) {
            queueContainer.innerHTML = '<div class="text-danger text-center p-3">Veri yüklenirken hata oluştu.</div>';
        }
    } finally {
        // Loading gizle
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Tüm kayıtları filtrele (filtreleme ile)
async function loadAllRecordsWithFilters() {
    console.log('🔄 Tüm kayıtlar filtreleniyor...');
    
    try {
        // Filtreleme parametrelerini al
        const filters = getActiveFilters();
        const queryParams = new URLSearchParams({
            action: 'get_all_records',
            ...filters
        });
        
        // Client-side filtering over existing data
        const source = Array.isArray(fullQueueData) && fullQueueData.length ? fullQueueData : currentQueueData;
        const filtered = renderFilteredQueue();
        updateRecordCounter(filtered, 'Filtreli');
        
    } catch (error) {
        console.error('❌ Tüm kayıtları filtreleme hatası:', error);
        const queueContainer = document.getElementById('queueListContainer');
        if (queueContainer) {
            queueContainer.innerHTML = '<div class="text-danger text-center p-3">Veri yüklenirken hata oluştu.</div>';
        }
    }
}

// Tüm durumları getir (Tüm Durumları Listele butonu için)
async function loadAllRecordsWithAllStatuses() {
    console.log('🔄 Tüm durumlar getiriliyor...');
    
    // Loading göster
    const loadingElement = document.getElementById('queryQueueLoading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    try {
        // Tüm durumları temsil eden parametreler gönder
        // Sağ sidebar filtreleme mantığı ile aynı şekilde
        const filters = {
            basvuru_durumu: 'Küçük Başvuru,Büyük Başvuru,Belirtilmemiş',
            sorgulama_durumu: 'Sorguda,Sırada,Sorgulanmadı',
            uygunluk_durumu: 'Uygun,Uygun Değil'
        };

        const queryParams = new URLSearchParams({
            action: 'get_all_records',
            ...filters
        });
        
        const response = await fetch(`api.php?${queryParams}`);
        const allRecords = await response.json();
        
        console.log('📊 Tüm durumlar:', allRecords);
        
        // Global veri setini güncelle
        fullQueueData = Array.isArray(allRecords) ? allRecords : [];
        queueBaseData = fullQueueData.slice();
        lastQueueSourceType = 'Tüm Durumlar';
        
        const filtered = renderFilteredQueue();
        updateRecordCounter(filtered, lastQueueSourceType);
        
    } catch (error) {
        console.error('❌ Tüm durumlar yüklenirken hata:', error);
        TitleAlertMessage('❌ Kayıtlar yüklenirken bir hata oluştu.', 'danger');
    } finally {
        // Loading gizle
        const loadingElement = document.getElementById('queryQueueLoading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Aktif filtreleri al
function getActiveFilters() {
    const filters = {};

    // Sorguya Gönderme tabı: sadece "Sorgu Sırasında" (Sırada) kayıtları getirir
    filters.sorgulama_durumu = 'Sırada';

    const state = getTabState('query-pane');
    if (state.il) filters.il = state.il;
    if (state.ada) filters.ada = state.ada;
    if (state.parsel) filters.parsel = state.parsel;

    return filters;
}

// Filtreleri temizle
function clearFilters() {
    const sorguSelect = document.getElementById('filterSorguDurumu');
    const uygunlukSelect = document.getElementById('filterUygunlukDurumu');
    const dateRangeInput = document.getElementById('queryDateRange');
    const statusSelect = document.getElementById('queryStatusFilter');
    const companyFilter = document.getElementById('sharedCompanyFilter');
    const ilInput = document.getElementById('queryFilterIl');
    const adaInput = document.getElementById('queryFilterAda');
    const parselInput = document.getElementById('queryFilterParsel');

    if (sorguSelect) sorguSelect.value = '';
    if (uygunlukSelect) uygunlukSelect.value = '';
    if (dateRangeInput) dateRangeInput.value = '';
    if (statusSelect) statusSelect.value = 'Sorgu Sırasında';
    if (companyFilter) companyFilter.value = '';
    if (ilInput) ilInput.value = '';
    if (adaInput) adaInput.value = '';
    if (parselInput) parselInput.value = '';
    window.rightSidebarCompanyFilterName = '';
    window.sharedCompanyFilterName = '';
    window.sharedDateFilter = { from: null, to: null };
    saveInputsForActiveTab();
    
    // Sayaçı sıfırla
    updateRecordCounter([], 'Filtreler Temizlendi');
    
    loadQueueList();
    loadSorgudaResults();
}

// Tüm durumları listele (tüm kayıtlar - sırada olmayanlar dahil)
async function listAllRecords() {
    console.log('📋 Tüm durumlar listeleniyor...');
    
    // Loading göster
    const loadingElement = document.getElementById('queryQueueLoading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    try {
        const params = new URLSearchParams({ action: 'get_all_records' });
        const response = await fetch(`api.php?${params.toString()}`);
        const allRecords = await response.json();
        
        console.log('📊 Tüm durumlar:', allRecords);
        
        // Sorgu sırası listesini güncelle
        updateQueueDisplay(allRecords);
        
        // Kayıt sayısını güncelle
        updateRecordCounter(allRecords, 'Tüm Durumlar');
        
    } catch (error) {
        console.error('❌ Kayıt listeleme hatası:', error);
        const queueContainer = document.getElementById('queueListContainer');
        if (queueContainer) {
            queueContainer.innerHTML = '<div class="text-danger text-center p-3">Veri yüklenirken hata oluştu.</div>';
        }
    } finally {
        // Loading gizle
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Ortak liste kolonları
const sharedListColumns = [
    { type: 'checkbox', width: 30 },
    { type: 'order', label: 'Sıra', width: 40, align: 'center' },
    { key: 'prolegal_id', label: 'Prolegal Taşınmaz No', sortable: 'id', className: 'fw-bold text-primary' },
    { key: 'il', label: 'İl', sortable: 'il' },
    { key: 'ilce', label: 'İlçe', sortable: 'ilce' },
    { key: 'mahalle', label: 'Mahalle', sortable: 'mahalle' },
    { key: 'ada', label: 'Ada', sortable: 'ada' },
    { key: 'parsel', label: 'Parsel', sortable: 'parsel' },
    { key: 'uygunluk_durumu', label: 'Uygunluk Durumu', sortable: 'uygunluk' },
    { key: 'sorgulama_durumu', label: 'Sorgu Durumu', sortable: 'sorgu' },
    { key: 'basvuru_turu', label: 'Başvuru Türü', sortable: 'basvuru' },
    { key: 'basvuru_tarihi', label: 'Başvuru Tarihi', sortable: 'basvuru_tarihi' },
    { key: 'created_at', label: 'Oluşturulma', sortable: 'created_at' },
    { key: 'updated_at', label: 'Güncellenme', sortable: 'updated_at' },
    { key: 'sorgulanan_firma', label: 'Sorgulanan Firma', sortable: 'sorgulanan_firma' },
    { key: 'basvurulan_firma', label: 'Başvurulan Firma', sortable: 'firma' },
    { key: 'konu', label: 'Konu', sortable: 'konu' }
];

const queryResultColumns = sharedListColumns.filter(col => col.key !== 'updated_at');
const applicationColumns = [...sharedListColumns];

// Sorguya gönderme sekmesi: yalnızca oluşturulma tarihi görünsün (diğer tarih kolonları çıkarıldı)
const queueListColumns = sharedListColumns.filter(col => (
    col.key !== 'updated_at' &&
    col.key !== 'basvuru_tarihi' &&
    col.key !== 'basvuru_turu'
));

function formatBasvuruDurumu(value) {
    if (value === 'Küçük') return 'Küçük Başvuru';
    if (value === 'Büyük') return 'Büyük Başvuru';
    return value || 'Belirtilmemiş';
}

function renderStatusBadge(value, type = 'sorgu') {
    const val = (value || '').toString().trim();
    const map = {
        sorgu: {
            'Sorguda': 'badge bg-success',
            'Sırada': 'badge bg-warning text-dark',
            'Sorgulanmadı': 'badge bg-secondary'
        },
        basvuru: {
            'Küçük Başvuru': 'badge bg-info text-dark',
            'Büyük Başvuru': 'badge bg-primary',
            'Belirtilmemiş': 'badge bg-secondary'
        },
        uygunluk: {
            'Uygun': 'badge bg-success',
            'Uygun değil': 'badge bg-danger',
            'Uygun Değil': 'badge bg-danger',
            '': 'badge bg-secondary'
        }
    };
    const cls = map[type]?.[val] || 'badge bg-light text-dark';
    const text = val || '-';
    return `<span class="${cls}">${text}</span>`;
}

function renderListTable(items, options = {}) {
    const {
        columns = sharedListColumns,
        selectAllId = 'selectAllRows',
        checkboxClass = 'row-checkbox',
        rowDataAttrs = (item) => ({ 'data-property-id': item?.prolegal_id || item?.id || '' })
    } = options;


    let html = `<div class="list-shell"><table class="table table-sm table-hover list-table"><thead class="table-light"><tr>`;

    columns.forEach(col => {
        if (col.type === 'checkbox') {
            html += `<th style="width:${col.width || 30}px;"><input type="checkbox" id="${selectAllId}" class="form-check-input"></th>`;
            return;
        }
        const style = col.width ? `style="width:${col.width}px;${col.align ? ` text-align:${col.align};` : ''}"` : (col.align ? `style="text-align:${col.align};"` : '');
        const sortable = col.sortable ? ` class="sortable" data-sort-key="${col.sortable}"` : '';
        html += `<th ${style || ''}${sortable}>${col.label}${col.sortable ? ' <span class="sort-icon"></span>' : ''}</th>`;
    });

    html += `</tr></thead><tbody>`;

    items.forEach((item, index) => {
        const attrs = rowDataAttrs(item) || {};
        const attrString = Object.entries(attrs).map(([k, v]) => `${k}="${String(v)}"`).join(' ');

        html += `<tr ${attrString}>`;

        columns.forEach(col => {
            if (col.type === 'checkbox') {
                const pid = item?.prolegal_id || item?.id || '';
                html += `<td><input type="checkbox" class="form-check-input ${checkboxClass}" data-prolegal-id="${pid}"></td>`;
                return;
            }
            if (col.type === 'order') {
                html += `<td style="text-align:${col.align || 'left'};">${index + 1}</td>`;
                return;
            }
            let value = item[col.key] ?? '-';
            if (col.key === 'basvuru_turu') {
                value = formatBasvuruDurumu(value);
            }
            if (col.key === 'sorgulama_durumu') {
                html += `<td class="${col.className || ''}">${renderStatusBadge(value, 'sorgu')}</td>`;
            } else if (col.key === 'basvuru_turu') {
                html += `<td class="${col.className || ''}">${renderStatusBadge(value, 'basvuru')}</td>`;
            } else if (col.key === 'uygunluk_durumu') {
                html += `<td class="${col.className || ''}">${renderStatusBadge(value, 'uygunluk')}</td>`;
            } else {
                html += `<td class="${col.className || ''}">${value}</td>`;
            }
        });

        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

function applySharedFilters(items, target = 'queue') {
    if (!Array.isArray(items)) return [];
    const state = getTabState(target);
    const ilVal = (state.il || '').trim().toLowerCase();
    const adaVal = (state.ada || '').trim();
    const parselVal = (state.parsel || '').trim();

    const companyName = (state.company || '').trim();
    const companyLower = companyName.toLowerCase();
    const dateFilter = state.dateRange || {};

    return items.filter(item => {
        const itemIl = String(item.il || '').trim().toLowerCase();
        const itemAda = String(item.ada || '').trim();
        const itemParsel = String(item.parsel || '').trim();
        if (ilVal && itemIl !== ilVal) return false;
        if (adaVal && itemAda !== adaVal) return false;
        if (parselVal && itemParsel !== parselVal) return false;
        if (companyLower) {
            const comp = (item.sorgulanan_firma || item.basvurulan_firma || '').toString().trim().toLowerCase();
            if (!comp.includes(companyLower)) return false;
        }
        if (dateFilter.from || dateFilter.to) {
            const ts = getFilterTimestamp(item, target);
            if (ts === null) return false;
            if (dateFilter.from && ts < dateFilter.from) return false;
            if (dateFilter.to && ts > dateFilter.to) return false;
        }
        return true;
    });
}

function applyFiltersForTarget(targetId) {
    switch (targetId) {
        case 'query-pane':
        case 'queue':
            return renderFilteredQueue();
        case 'query-result-pane':
        case 'result':
            return renderFilteredQueryResults();
        case 'application-pane':
        case 'application':
            return renderFilteredApplications();
        default:
            return null;
    }
}

function applyFiltersForActiveTab() {
    const activePane = document.querySelector('#rightMenu .query-pane.active');
    const targetId = activePane ? activePane.id : null;
    applyFiltersForTarget(targetId);
}

function parseDateRangeValue(val) {
    if (!val) return { from: null, to: null };
    const normalized = val.trim();

    // Önce YYYY-MM-DD desenini yakala (aralarda boşluk/dash olsa da)
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const matches = normalized.match(datePattern);

    // Eğer iki tarih yakalandıysa bunları kullan
    if (matches && matches.length >= 2) {
        const tsFrom = Date.parse(matches[0]);
        const tsTo = Date.parse(matches[1]);
        return {
            from: Number.isNaN(tsFrom) ? null : tsFrom,
            to: Number.isNaN(tsTo) ? null : (tsTo + 24 * 60 * 60 * 1000 - 1)
        };
    }

    // Tek tarih veya "tarih to tarih" senaryosu için boşluk/tabanlı ayraç
    const hasRangeDelimiter = /\s(to|–|-)\s/.test(normalized);
    const parts = hasRangeDelimiter
        ? normalized.split(/\s*(?:to|–|-)\s*/).filter(Boolean)
        : [normalized];

    let from = null;
    let to = null;

    if (parts.length === 1) {
        const ts = Date.parse(parts[0]);
        if (!Number.isNaN(ts)) {
            from = ts;
            to = ts + 24 * 60 * 60 * 1000 - 1;
        }
    } else if (parts.length >= 2) {
        const tsFrom = Date.parse(parts[0]);
        const tsTo = Date.parse(parts[1]);
        if (!Number.isNaN(tsFrom)) from = tsFrom;
        if (!Number.isNaN(tsTo)) to = tsTo + 24 * 60 * 60 * 1000 - 1;
    }
    return { from, to };
}

function parseSorguDate(val) {
    if (!val) return null;
    let ts = Date.parse(val);
    if (Number.isNaN(ts)) {
        // Try to normalize "YYYY-MM-DD HH:MM:SS"
        const normalized = val.replace(' ', 'T');
        ts = Date.parse(normalized);
    }
    if (Number.isNaN(ts)) {
        // Try only date part
        const datePart = val.split(' ')[0];
        ts = Date.parse(datePart);
    }
    if (Number.isNaN(ts)) {
        // Try DD.MM.YYYY
        const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) {
            const iso = `${m[3]}-${m[2]}-${m[1]}`;
            ts = Date.parse(iso);
        }
    }
    return Number.isNaN(ts) ? null : ts;
}

function getFilterTimestamp(item, target = 'queue') {
    // Sorguya gönderme sekmesi: oluşturulma tarihi
    if (target === 'queue' || target === 'query-pane') {
        return parseSorguDate(item.created_at);
    }
    // Diğer sekmeler: güncellenme tarihi öncelikli, yoksa oluşturulma
    const rawDate = item.updated_at || item.created_at;
    return parseSorguDate(rawDate);
}

function collectCompanyNamesFromData() {
    const sources = [
        fullQueueData, queueBaseData, currentQueueData,
        queryResultBaseData, queryResultData, currentQueryResultData,
        applicationBaseData, currentApplicationData
    ];
    const set = new Set();
    sources.forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(item => {
            const name = (item?.sorgulanan_firma || '').toString().trim();
            if (name) set.add(name);
        });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));
}

function populateSharedCompanyOptions() {
    const list = document.getElementById('sharedCompanyOptions');
    if (!list) return;
    const names = collectCompanyNamesFromData();
    list.innerHTML = '';
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        list.appendChild(opt);
    });
}

function applyCompanyFilter(value) {
    const name = (value || '').trim();
    const activeTab = getActiveTabId();
    const state = getTabState(activeTab);
    state.company = name;
    window.sharedCompanyFilterName = name;
    window.rightSidebarCompanyFilterName = name; // backward compatibility
    applyFiltersForTarget(activeTab);
}

function populateSharedIlOptionsFromData() {
    const select = document.getElementById('queryFilterIl');
    if (!select) return;
    const current = select.value;
    const sources = [
        fullQueueData, queueBaseData, currentQueueData,
        queryResultBaseData, queryResultData, currentQueryResultData,
        applicationBaseData, currentApplicationData
    ];
    const set = new Set();
    sources.forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(item => {
            const il = (item?.il || '').toString().trim();
            if (il) set.add(il);
        });
    });
    select.innerHTML = '<option value=\"\">İl seç</option>';
    Array.from(set).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' })).forEach(il => {
        const opt = document.createElement('option');
        opt.value = il;
        opt.textContent = il;
        select.appendChild(opt);
    });
    if (current && set.has(current)) {
        select.value = current;
    }
}

function renderFilteredQueue() {
    const source = Array.isArray(fullQueueData) && fullQueueData.length ? fullQueueData : currentQueueData;
    const filtered = applySharedFilters(source, 'queue');
    updateQueueDisplay(filtered);
    return filtered;
}

function renderFilteredQueryResults() {
    const source = Array.isArray(queryResultBaseData) && queryResultBaseData.length ? queryResultBaseData : queryResultData;
    if (!source || source.length === 0) {
        // Veri yoksa fetch etmeyi dene
        loadSorgudaResults(true);
        return [];
    }
    const filtered = applySharedFilters(source, 'result');
    currentQueryResultData = filtered.slice();
    renderQueryResults(filtered);
    return filtered;
}

function renderFilteredApplications() {
    const source = Array.isArray(applicationBaseData) && applicationBaseData.length ? applicationBaseData : currentQueueData;
    const filtered = applySharedFilters(source, 'application');
    updateApplicationDisplay(filtered);
    return filtered;
}

// Sorgu sırası listesini güncelle (Sorgu & Uygunluk tabı)
function updateQueueDisplay(queueItems, skipApplicationUpdate = false) {
    currentQueueData = Array.isArray(queueItems) ? queueItems : [];

    const queueContainer = document.getElementById('queueListContainer');
    if (!queueContainer) {
        console.log('❌ query list container bulunamadı');
        return;
    }
    
    if (!queueItems || queueItems.length === 0) {
        const emptyHtml = '<div class="text-muted text-center p-3 small">Filtrelere uygun kayıt bulunamadı</div>';
        queueContainer.innerHTML = emptyHtml;
        const badge = document.getElementById('queryCountBadge');
        if (badge) {
            badge.textContent = '0 seçili / 0 sırada kayıt';
        }
        return;
    }
    
    const tableHtml = renderListTable(queueItems, {
        selectAllId: 'selectAllQueueItems',
        checkboxClass: 'queue-item-checkbox',
        columns: queueListColumns,
        rowDataAttrs: (item) => ({
            'data-property-id': item?.prolegal_id || item?.id || '',
            'data-sorgulanan-firma': item?.sorgulanan_firma || '',
            'data-queue-id': item?.id || ''
        })
    });

    queueContainer.innerHTML = tableHtml;
    
    // Sayaç: sırada kayıt
    const badge = document.getElementById('queryCountBadge');
    if (badge) {
        badge.textContent = `${queueItems.length} sırada kayıt`;
    }

    // Tümünü seç checkbox'ı
    const selectAll = document.getElementById('selectAllQueueItems');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = queueContainer.querySelectorAll('.queue-item-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = selectAll.checked;
            });
            updateQueueSelectionBadge();
        });
    }
    // Satır seçimlerinde seçili sayısını güncelle
    queueContainer.querySelectorAll('.queue-item-checkbox').forEach(cb => {
        cb.addEventListener('change', updateQueueSelectionBadge);
    });
    
    // Kolon başlıklarına sıralama özelliği ekle
    const sortableHeaders = queueContainer.querySelectorAll('th.sortable');
    sortableHeaders.forEach(th => {
        th.addEventListener('click', function() {
            handleQueueHeaderClick(th, 'queue');
        });
    });

    updateQueueSelectionBadge();
    
    console.log('✅ Sorgu sırası listesi güncellendi');
}

// Seçili kayıtların konusu aynıysa döndürür
function getCommonSubject(selectedIds) {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0 || !Array.isArray(currentQueueData)) {
        return '';
    }
    const idsSet = new Set(selectedIds.map(id => String(id)));
    let common = null;
    for (const item of currentQueueData) {
        const pid = String(item?.prolegal_id ?? item?.id ?? '');
        if (!idsSet.has(pid)) continue;
        const konu = (item.konu || '').trim();
        if (!konu) {
            common = '';
            break;
        }
        if (common === null) {
            common = konu;
        } else if (common !== konu) {
            common = '';
            break;
        }
    }
    return common || '';
}

// Belirli bir kaydın konu bilgisi (sorgu tablosundan)
function getSubjectById(propertyId) {
    if (!Array.isArray(currentQueueData)) return '';
    const item = currentQueueData.find(it => String(it?.prolegal_id ?? it?.id ?? '') === String(propertyId));
    return (item?.konu || '').trim();
}

// Sorgu Sonucu sekmesinde uygunluk toplu güncelle
async function applyQueryResultStatusUpdate(statusSelectEl) {
    try {
        const checkboxes = document.querySelectorAll('.query-result-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-prolegal-id')).filter(Boolean);

        if (selectedIds.length === 0) {
            TitleAlertMessage('⚠️ Lütfen en az bir kayıt seçin.', 'warning');
            return;
        }
        const statusValue = statusSelectEl ? statusSelectEl.value : '';
        if (!statusValue) {
            TitleAlertMessage('⚠️ Lütfen Uygun veya Uygun Değil seçin.', 'warning');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        const now = new Date();
        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
        const nowDateOnly = now.toISOString().slice(0, 10);

        for (const propertyId of selectedIds) {
            try {
                const formData = new URLSearchParams();
                formData.append('action', 'update_query_record');
                formData.append('property_id', propertyId);
                formData.append('uygunluk_durumu', statusValue);
                // Uygunluk güncellemesi sorgu durumunu da "Sorgulandı" yapsın
                formData.append('sorgu_durumu', 'Sorgulandı');
                // Uygun/Uygun Değil verildiği anda sorgu tarihi güncellensin
                formData.append('sorgu_tarihi', nowStr);

                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('❌ Toplu uygunluk güncelleme hatası:', error);
                failCount++;
            }
        }

        if (successCount > 0) {
            TitleAlertMessage(`✅ ${successCount} kayıt güncellendi` + (failCount ? `, ${failCount} hata` : ''), failCount ? 'warning' : 'success');
            // Mevcut filtreleri değiştirmeden listeyi güncelle
            loadSorgudaResults(true);
        } else {
            TitleAlertMessage('❌ Güncelleme başarısız.', 'danger');
        }
    } catch (error) {
        console.error('❌ applyQueryResultStatusUpdate genel hata:', error);
        TitleAlertMessage('❌ Güncelleme sırasında hata oluştu.', 'danger');
    }
}

// Başvuru sekmesi listesini güncelle (aynı kayıtlar, odak: başvuru)
function updateApplicationSelectionBadge(totalCount) {
    const appCountBadge = document.getElementById('applicationCountBadge');
    if (!appCountBadge) return;
    const checked = document.querySelectorAll('#applicationListContainer .queue-item-checkbox:checked').length;
    const total = typeof totalCount === 'number'
        ? totalCount
        : (Array.isArray(currentApplicationData) ? currentApplicationData.length : 0);
    appCountBadge.textContent = `${checked} seçili / ${total} uygun kayıt`;
}

function updateApplicationDisplay(queueItems, skipQueueUpdate = false) {
    const appContainer = document.getElementById('applicationListContainer');
    if (!appContainer) {
        return;
    }
    
    currentApplicationData = Array.isArray(queueItems) ? queueItems : [];
    populateSharedCompanyOptions();
    populateSharedIlOptionsFromData();
    const totalCount = Array.isArray(queueItems) ? queueItems.length : 0;

    // Sayaç badge'ini güncelle
    const appCountBadge = document.getElementById('applicationCountBadge');
    if (appCountBadge) {
        appCountBadge.textContent = `0 seçili / ${totalCount} uygun kayıt`;
    }

    if (!queueItems || totalCount === 0) {
        appContainer.innerHTML = '<div class="text-muted text-center p-3 small">Filtrelere uygun kayıt bulunamadı</div>';
        if (appCountBadge) appCountBadge.textContent = '0 seçili / 0 uygun kayıt';
        return;
    }
    
    const tableHtml = renderListTable(queueItems, {
        selectAllId: 'selectAllApplicationItems',
        checkboxClass: 'queue-item-checkbox',
        columns: applicationColumns,
        rowDataAttrs: (item) => ({
            'data-property-id': item?.prolegal_id || item?.id || '',
            'data-sorgulanan-firma': item?.sorgulanan_firma || ''
        })
    });
    appContainer.innerHTML = tableHtml;

    const selectAllApp = document.getElementById('selectAllApplicationItems');
    if (selectAllApp) {
        selectAllApp.addEventListener('change', function() {
            const checkboxes = appContainer.querySelectorAll('.queue-item-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = selectAllApp.checked;
            });
            updateApplicationSelectionBadge(totalCount);
        });
    }
    // Satır seçimlerini takip et
    appContainer.querySelectorAll('.queue-item-checkbox').forEach(cb => {
        cb.addEventListener('change', () => updateApplicationSelectionBadge(totalCount));
    });

    // Kolon başlıklarına sıralama özelliği ekle (Başvurular tablo başlığı)
    const sortableHeaders = appContainer.querySelectorAll('th.sortable');
    sortableHeaders.forEach(th => {
        th.addEventListener('click', function() {
            handleQueueHeaderClick(th, 'application');
        });
    });
    
    updateApplicationSelectionBadge(totalCount);
}

// ID filtreleme kaldırıldı; şirket/durum/tarih filtreleri backend çağrısında uygulanıyor.

function exportCurrentQueueToExcel() {
    if (!Array.isArray(currentQueueData) || currentQueueData.length === 0) {
        TitleAlertMessage('⚠️ Liste boş. Önce kayıtları listeleyin.', 'warning');
        return;
    }

    // Hem Sorgu & Uygunluk hem Başvurular tabındaki seçili satırları oku
    const selectedCheckboxes = document.querySelectorAll(
        '#queueListContainer .queue-item-checkbox:checked, #applicationListContainer .queue-item-checkbox:checked'
    );

    const selectedIds = Array.from(selectedCheckboxes).map(cb =>
        cb.getAttribute('data-prolegal-id')
    ).filter(Boolean);

    const idSet = new Set(selectedIds.map(id => String(id)));

    // Eğer seçim yapılmışsa sadece seçili kayıtları, yoksa tüm currentQueueData'yı kullan
    const exportSource = idSet.size > 0
        ? currentQueueData.filter(item => idSet.has(String(item?.prolegal_id ?? item?.id ?? '')))
        : currentQueueData;

    if (!exportSource.length) {
        TitleAlertMessage('⚠️ Seçili kayıt bulunamadı.', 'warning');
        return;
    }

    const exportRows = exportSource.map(item => {
        const prolegalId = item?.prolegal_id ?? item?.id ?? '';
        const il = item?.il ?? '';
        const ilce = item?.ilce ?? '';
        const mahalle = item?.mahalle ?? '';
        const ada = item?.ada ?? '';
        const parsel = item?.parsel ?? '';
        const uygunluk = item?.uygunluk_durumu ?? '';
        const sorgu = item?.sorgulama_durumu ?? 'Sorgulanmadı';
        const basvuru = item?.basvuru_turu
            ? (item.basvuru_turu === 'Küçük'
                ? 'Küçük Başvuru'
                : (item.basvuru_turu === 'Büyük'
                    ? 'Büyük Başvuru'
                    : item.basvuru_turu))
            : 'Belirtilmemiş';

        return {
            id: prolegalId,
            il,
            ilce,
            mahalle,
            adaParsel: `${ada || '-'} / ${parsel || '-'}`,
            nitelik: uygunluk,
            imarFonksiyon: '',
            durum: uygunluk,
            sorguDurumu: sorgu,
            alan: ''
        };
    });

    exportToExcel(exportRows, `sorgu_kayitlari_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Çift scroll bar'ı senkronize et
function syncScrollBars() {
    const topScroll = document.getElementById('topScroll');
    const tableResponsive = document.querySelector('.table-responsive');
    
    if (!topScroll || !tableResponsive) return;
    
    // Üst scroll bar'ın genişliğini tablo ile eşitle
    const tableWidth = tableResponsive.querySelector('table').scrollWidth;
    topScroll.firstElementChild.style.width = tableWidth + 'px';
    
    // Scroll event'lerini senkronize et
    let isScrolling = false;
    
    topScroll.addEventListener('scroll', function() {
        if (!isScrolling) {
            isScrolling = true;
            tableResponsive.scrollLeft = topScroll.scrollLeft;
            setTimeout(() => isScrolling = false, 10);
        }
    });
    
    tableResponsive.addEventListener('scroll', function() {
        if (!isScrolling) {
            isScrolling = true;
            topScroll.scrollLeft = tableResponsive.scrollLeft;
            setTimeout(() => isScrolling = false, 10);
        }
    });
}

// Uygunluk selectbox'larına event listener ekle
function setupUygunlukEventListeners() {
    // Tüm uygunluk selectbox'larını bul
    const uygunlukSelects = document.querySelectorAll('.uygunluk-select');
    
    uygunlukSelects.forEach(select => {
        // Mevcut listener'ı kaldır (duplicate olmasın diye)
        select.removeEventListener('change', handleUygunlukChange);
        // Yeni listener ekle
        select.addEventListener('change', handleUygunlukChange);
    });
}

// Uygunluk değiştiğinde sorgu durumunu otomatik güncelle
function handleUygunlukChange(event) {
    const uygunlukSelect = event.target;
    const propertyId = uygunlukSelect.getAttribute('data-property-id');
    const selectedValue = uygunlukSelect.value;
    
    console.log('🔄 Uygunluk değişti:', selectedValue, 'Property ID:', propertyId);
    const row = uygunlukSelect.closest('tr');
    const sorguSelect = row ? row.querySelector('.sorgu-select') : null;
    const basvuruSelect = row ? row.querySelector('.basvuru-select') : null;

    // Uygun veya Uygun değil seçildiğinde sorgu durumunu Sorgulandı yap
    if (selectedValue === 'Uygun' || selectedValue === 'Uygun değil') {
        if (sorguSelect) {
            sorguSelect.value = 'Sorgulandı';
            console.log('✅ Sorgu durumu otomatik olarak "Sorgulandı" yapıldı');
            
            // Sorgulanan firma seçimini göster
            toggleSorgulananFirmaSelection(sorguSelect);
        }
    }

    // Uygunluk "Sorgulanmadı" ise başvuru durumu otomatik "Seçiniz" (boş) olsun
    if (basvuruSelect) {
        const normalized = (selectedValue || '').toLowerCase();
        if (normalized.includes('sorgulanmad')) {
            basvuruSelect.value = '';
            console.log('✅ Uygunluk=Sorgulanmadı -> Başvuru durumu Seçiniz (boş) yapıldı');
        }
    }
}

// Sorgu select'leri için delege change listener'ı
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('sorgu-select')) {
        console.log('🔄 Delegated change - sorgu-select:', e.target.value);
        try {
            toggleSorgulananFirmaSelection(e.target);
        } catch (err) {
            console.error('toggleSorgulananFirmaSelection çalışırken hata:', err);
        }
    }
});

// Konu modal event listener'larını kur
function setupKonuModalEvents() {
    const saveKonuBtn = document.getElementById('saveKonuBtn');
    if (saveKonuBtn && !saveKonuBtn.hasAttribute('data-listener-added')) {
        saveKonuBtn.addEventListener('click', saveKonu);
        saveKonuBtn.setAttribute('data-listener-added', 'true');
    }
    
    const saveSorgulananFirmaBtn = document.getElementById('saveSorgulananFirmaBtn');
    if (saveSorgulananFirmaBtn && !saveSorgulananFirmaBtn.hasAttribute('data-listener-added')) {
        saveSorgulananFirmaBtn.addEventListener('click', saveSorgulananFirma);
        saveSorgulananFirmaBtn.setAttribute('data-listener-added', 'true');
    }
    
    const toggleSorgulananNewCompanyBtn = document.getElementById('toggleSorgulananNewCompany');
    if (toggleSorgulananNewCompanyBtn && !toggleSorgulananNewCompanyBtn.hasAttribute('data-listener-added')) {
        toggleSorgulananNewCompanyBtn.addEventListener('click', toggleSorgulananNewCompanyForm);
        toggleSorgulananNewCompanyBtn.setAttribute('data-listener-added', 'true');
    }
}

// Sorgulanan firma seçimi göster/gizle
function toggleSorgulananFirmaSelection(selectElement) {
    const row = selectElement.closest('tr');
    const firmaSelection = row.querySelector('.sorgulanan-firma-selection');
    const propertyId = selectElement.getAttribute('data-property-id');
    const basvuruSelect = row.querySelector('.basvuru-select');
    const uygunlukSelect = row.querySelector('.uygunluk-select');
    const sorguUyari = row.querySelector('.sorgu-uyari');
    
    if (selectElement.value === 'Sorguda' || selectElement.value === 'Sırada' || selectElement.value === 'Sorgulandı') {
        const currentSorgulananFirma = row.getAttribute('data-sorgulanan-firma');
        const firmaWarning = firmaSelection ? firmaSelection.querySelector('small') : null;
        const hasExistingFirma =
            currentSorgulananFirma &&
            currentSorgulananFirma !== '' &&
            currentSorgulananFirma !== 'null' &&
            currentSorgulananFirma !== 'undefined';

        console.log('🔍 Sorgu select değişti:', {
            value: selectElement.value,
            propertyId,
            currentSorgulananFirma
        });

        if (selectElement.value === 'Sorgulandı') {
            // İSTEK: Sorgu durumu halihazırda veya sonradan "Sorgulandı" ise,
            // şirket seçimi ve "firma seçmelisiniz" uyarısı hiç gösterilmesin.
            if (firmaSelection) {
                firmaSelection.style.display = 'none';
            }
            if (firmaWarning) {
                firmaWarning.style.display = 'none';
            }
            console.log('✅ Sorgu=Sorgulandı -> şirket seçimi/uyarı gösterilmiyor');
        } else {
            // Sorguda / Sırada durumlarında her zaman şirket seçimi göster
            if (firmaSelection) {
                firmaSelection.style.display = 'block';
            }
            loadSorgulananFirmaCompaniesForSelect(propertyId, currentSorgulananFirma);
            if (firmaWarning) {
                // Firma varsa uyarıyı gizle, yoksa göster
                firmaWarning.style.display = hasExistingFirma ? 'none' : 'block';
            }
            console.log('✅ Sorgu=Sorguda/Sırada -> şirket seçimi gösteriliyor');
        }
    } else {
        if (firmaSelection) {
            firmaSelection.style.display = 'none';
        }
        console.log('❌ Sorgu durumu boş/diğer, şirket seçim alanı gizlendi');
    }

    // KURAL 1 (ek uyarı): Sorgu durumu "Sorgulandı" ise küçük uyarı yazısı göster
    if (sorguUyari) {
        const uygunlukDegeri = uygunlukSelect ? (uygunlukSelect.value || '') : '';
        const uygunlukSecilmemis =
            uygunlukDegeri === '' ||
            uygunlukDegeri === 'Seçiniz' ||
            uygunlukDegeri === 'Sorgulanmadı';

        if (selectElement.value === 'Sorgulandı' && uygunlukSecilmemis) {
            sorguUyari.style.display = 'block';
        } else {
            sorguUyari.style.display = 'none';
        }
    }

    // KURAL 2:
    // Sorgu durumu "Sırada" ise, başvuru ve uygunluk selectbox'ları
    // ön yüzde otomatik olarak "Seçiniz" konumuna gelsin.
    if (selectElement.value === 'Sırada') {
        console.log('🔄 Sorgu durumu Sırada -> Başvuru/Uygunluk Seçiniz yapılıyor');
        if (basvuruSelect) {
            basvuruSelect.value = '';
        }
        if (uygunlukSelect) {
            uygunlukSelect.value = 'Seçiniz';
            try {
                handleUygunlukChange({ target: uygunlukSelect });
            } catch (e) {
                console.error('handleUygunlukChange tetiklenirken hata:', e);
            }
        }
    }
}

// Sorgulanan firma şirketlerini select için yükle
async function loadSorgulananFirmaCompaniesForSelect(propertyId, currentSorgulananFirma = null) {
    console.log('🏢 Sorgulanan firma şirket listesi yükleniyor...', propertyId, currentSorgulananFirma);
    
    try {
        const response = await fetch('api.php?action=get_companies');
        const companies = await response.json();
        
        console.log('📋 Gelen şirketler:', companies);
        
        const select = document.getElementById(`sorgulananFirmaSelect_${propertyId}`);
        if (select) {
            // Mevcut option'ları temizle (ilk option hariç)
            select.innerHTML = '<option value="">Sorgulanan Firma Seçiniz</option>';
            
            if (companies && companies.length > 0) {
                companies.forEach(company => {
                    const option = document.createElement('option');
                    option.value = company.id;
                    option.textContent = company.name;
                    
                    // Eğer mevcut sorgulanan firma bu şirketse seçili yap
                    if (currentSorgulananFirma && currentSorgulananFirma == company.id) {
                        option.selected = true;
                    }
                    
                    select.appendChild(option);
                });
                console.log('✅ Sorgulanan firma şirketleri yüklendi:', propertyId, companies.length, 'şirket');
            } else {
                console.log('⚠️ Sorgulanan firma şirket listesi boş');
            }
        } else {
            console.log('❌ Select element bulunamadı:', `sorgulananFirmaSelect_${propertyId}`);
        }
    } catch (error) {
        console.error('❌ Sorgulanan firma şirketleri yükleme hatası:', error);
    }
}

// Sorgulanan firma şirketlerini yükle
async function loadSorgulananFirmaCompanies() {
    try {
        const response = await fetch('api.php?action=get_companies');
        const result = await response.json();
        
        const select = document.getElementById('sorgulananFirmaCompanySelect');
        if (result.success && result.companies) {
            // Mevcut option'ları temizle (ilk option hariç)
            select.innerHTML = '<option value="">Şirket Seçiniz</option>';
            
            result.companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name + (company.contact ? ` (${company.contact})` : '');
                select.appendChild(option);
            });
            console.log('✅ Sorgulanan firma şirketleri yüklendi');
        } else {
            select.innerHTML = '<option value="">Şirket bulunamadı</option>';
        }
    } catch (error) {
        console.error('❌ Sorgulanan firma şirketleri yükleme hatası:', error);
        document.getElementById('sorgulananFirmaCompanySelect').innerHTML = '<option value="">Şirketler yüklenemedi</option>';
    }
}

// Sorgulanan yeni şirket formunu göster/gizle
function toggleSorgulananNewCompanyForm() {
    const form = document.getElementById('sorgulananNewCompanyForm');
    const button = document.getElementById('toggleSorgulananNewCompany');
    
    if (form.style.display === 'none') {
        form.style.display = 'block';
        button.innerHTML = '<i class="fas fa-minus"></i> İptal';
        button.className = 'btn btn-outline-danger btn-sm';
    } else {
        form.style.display = 'none';
        button.innerHTML = '<i class="fas fa-plus"></i> Yeni Şirket';
        button.className = 'btn btn-outline-primary btn-sm';
        
        // Formu temizle
        document.getElementById('sorgulananNewCompanyName').value = '';
        document.getElementById('sorgulananNewCompanyContact').value = '';
    }
}

// Sorgulanan firma modal'ını aç
function openSorgulananFirmaModal(propertyId) {
    console.log('🏢 Sorgulanan firma modal açılıyor:', propertyId);
    
    // Modal'ı aç
    const modal = new bootstrap.Modal(document.getElementById('sorgulananFirmaModal'));
    modal.show();
    
    // Property ID'yi modal'a kaydet
    document.getElementById('sorgulananFirmaModal').setAttribute('data-property-id', propertyId);
    
    // Şirketleri yükle
    loadSorgulananFirmaCompanies();
    
    // Yeni şirket formunu gizle
    document.getElementById('sorgulananNewCompanyForm').style.display = 'none';
}

// Sorgulanan firma kaydet
async function saveSorgulananFirma() {
    const modal = document.getElementById('sorgulananFirmaModal');
    const propertyId = modal.getAttribute('data-property-id');
    
    // Seçilen şirketi kontrol et
    const selectedCompanyId = document.getElementById('sorgulananFirmaCompanySelect').value;
    const newCompanyName = document.getElementById('sorgulananNewCompanyName').value.trim();
    const newCompanyContact = document.getElementById('sorgulananNewCompanyContact').value.trim();
    
    let companyId = null;
    let companyName = '';
    
    if (selectedCompanyId) {
        companyId = selectedCompanyId;
        companyName = document.getElementById('sorgulananFirmaCompanySelect').selectedOptions[0].textContent;
    } else if (newCompanyName) {
        // Yeni şirket oluştur
        try {
            const createResponse = await fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'create_company',
                    name: newCompanyName,
                    contact: newCompanyContact
                })
            });
            
            const createResult = await createResponse.json();
            if (createResult.success) {
                companyId = createResult.company_id;
                companyName = newCompanyName;
            } else {
                TitleAlertMessage('❌ Yeni şirket oluşturulurken hata: ' + createResult.message, 'danger');
                return;
            }
        } catch (error) {
            console.error('❌ Şirket oluşturma hatası:', error);
            TitleAlertMessage('❌ Yeni şirket oluşturulurken bir hata oluştu.', 'danger');
            return;
        }
    } else {
        TitleAlertMessage('⚠️ Lütfen bir şirket seçin veya yeni şirket ekleyin!', 'warning');
        return;
    }
    
    console.log('💾 Sorgulanan firma kaydediliyor:', propertyId, companyId, companyName);
    
    try {
        const formData = new URLSearchParams();
        formData.append('action', 'update_query_record');
        formData.append('property_id', propertyId);
        formData.append('sorgulanan_firma', companyId);
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            TitleAlertMessage(`✅ Sorgulanan firma başarıyla kaydedildi: ${companyName}`, 'success');
            
            // Modal'ı kapat
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            bootstrapModal.hide();
            
            // Listeyi yenile
            loadQueueList();
        } else {
            TitleAlertMessage('❌ Sorgulanan firma kaydedilirken hata: ' + (result.message || 'Bilinmeyen hata'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Sorgulanan firma kaydetme hatası:', error);
        TitleAlertMessage('❌ Sorgulanan firma kaydedilirken bir hata oluştu.', 'danger');
    }
}

// Konu modal'ını aç
function openKonuModal(propertyId) {
    console.log('📝 Konu modal açılıyor:', propertyId);
    
    // Modal'ı aç
    const modal = new bootstrap.Modal(document.getElementById('konuModal'));
    modal.show();
    
    // Property ID'yi modal'a kaydet
    document.getElementById('konuModal').setAttribute('data-property-id', propertyId);
    
    // Textarea'yı temizle
    document.getElementById('konuTextarea').value = '';
}

// Konu kaydet
async function saveKonu() {
    const modal = document.getElementById('konuModal');
    const propertyId = modal.getAttribute('data-property-id');
    const konuText = document.getElementById('konuTextarea').value.trim();
    
    if (!konuText) {
        TitleAlertMessage('⚠️ Lütfen konu açıklaması girin!', 'warning');
        return;
    }
    
    console.log('💾 Konu kaydediliyor:', propertyId, konuText);
    
    try {
        const formData = new URLSearchParams();
        formData.append('action', 'update_query_record');
        formData.append('property_id', propertyId);
        formData.append('konu', konuText);
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            TitleAlertMessage('✅ Konu başarıyla kaydedildi!', 'success');
            
            // Modal'ı kapat
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            bootstrapModal.hide();
            
            // Listeyi yenile
            loadQueueList();
        } else {
            TitleAlertMessage('❌ Konu kaydedilirken hata: ' + (result.message || 'Bilinmeyen hata'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Konu kaydetme hatası:', error);
        TitleAlertMessage('❌ Konu kaydedilirken bir hata oluştu.', 'danger');
    }
}

// Kayıt sayacını güncelle
function updateRecordCounter(records, sourceType) {
    const counter = document.getElementById('recordCounter');
    if (!counter) return;
    
    const totalCount = records ? records.length : 0;
    const filters = getActiveFilters();
    
    let html = '';
    
    // Eğer "Tüm Durumlar" ise, her durumun sayısını göster
    if (sourceType === 'Tüm Durumlar' && records && records.length > 0) {
        // Durum sayılarını hesapla
        const counts = calculateStatusCounts(records);
        
        // Ana toplam
        html += `<span class="badge bg-primary">${totalCount} toplam</span>`;
        
        // Uygunluk durumları
        html += '<div class="filter-info">';
        html += `✅ Uygun: ${counts.uygun} | ❌ Uygun Değil: ${counts.uygunDegil}`;
        html += '</div>';
        
        // Başvuru durumları
        html += '<div class="filter-info">';
        html += `📋 Küçük: ${counts.kucukBasvuru} | 📋 Büyük: ${counts.buyukBasvuru}`;
        html += '</div>';
        
        // Sorgu durumları
        html += '<div class="filter-info">';
        html += `🔍 Sorguda: ${counts.sorguda} | 🔍 Sırada: ${counts.sirada}`;
        html += '</div>';
        
    } else {
        // Normal filtreleme durumu
        let badgeClass = 'bg-primary';
        
        // Ana sayaç
        html += `<span class="badge ${badgeClass}">${totalCount} kayıt</span>`;
        if (totalCount === 0 && Object.keys(filters).length > 0) {
            html += '<div class="filter-info text-warning">Seçili filtrelere ait kayıt yok</div>';
            counter.innerHTML = html;
            return;
        }
        
        // Filtre bilgileri
        const companyFilterName = window.rightSidebarCompanyFilterName || '';
        if (Object.keys(filters).length > 0) {
            html += '<div class="filter-info">';
            
            if (filters.basvuru_durumu) {
                html += `📋 ${filters.basvuru_durumu}`;
            }
            if (filters.sorgu_durumu) {
                html += (filters.basvuru_durumu ? ' | ' : '') + `🔍 ${filters.sorgu_durumu}`;
            }
            if (filters.uygunluk_durumu) {
                html += ((filters.basvuru_durumu || filters.sorgu_durumu) ? ' | ' : '') + `✅ ${filters.uygunluk_durumu}`;
            }
            if (filters.company_id) {
                html += ((filters.basvuru_durumu || filters.sorgu_durumu || filters.uygunluk_durumu) ? ' | ' : '') + `🏢 ${companyFilterName || ('Şirket #' + filters.company_id)}`;
            }
            
            html += '</div>';
        } else {
            html += `<div class="filter-info">${sourceType}</div>`;
        }
    }
    
    counter.innerHTML = html;
}

// Durum sayılarını hesapla
function calculateStatusCounts(records) {
    const counts = {
        uygun: 0,
        uygunDegil: 0,
        kucukBasvuru: 0,
        buyukBasvuru: 0,
        belirtilmemis: 0,
        sorguda: 0,
        sirada: 0
    };
    
    records.forEach(record => {
        // Uygunluk durumu
        if (record.uygunluk_durumu === 'Uygun') {
            counts.uygun++;
        } else if (record.uygunluk_durumu === 'Uygun değil') {
            counts.uygunDegil++;
        }
        
        // Başvuru durumu
        if (record.basvuru_turu === 'Küçük') {
            counts.kucukBasvuru++;
        } else if (record.basvuru_turu === 'Büyük') {
            counts.buyukBasvuru++;
        } else if (record.basvuru_turu === 'Belirtilmemiş') {
            counts.belirtilmemis++;
        }
        
        // Sorgu durumu
        if (record.sorgulama_durumu === 'Sorguda') {
            counts.sorguda++;
        } else if (record.sorgulama_durumu === 'Sırada') {
            counts.sirada++;
        }
        // Sorgulanmadı kayıtları sayılmıyor
    });
    
    return counts;
}

// Şirket seçimi checkbox'ını göster/gizle
function toggleCompanySelection(selectElement) {
    console.log('🔄 toggleCompanySelection çağrıldı, seçilen değer:', selectElement.value);
    
    const row = selectElement.closest('tr');
    const companySelection = row.querySelector('.company-selection');
    const companySelect = row.querySelector('.company-selection select');
    const sorguSelect = row.querySelector('.sorgu-select');
    const uygunlukSelect = row.querySelector('.uygunluk-select');
    
    console.log('📍 Row bulundu:', !!row);
    console.log('📍 Company selection bulundu:', !!companySelection);
    console.log('📍 Company select bulundu:', !!companySelect);
    
    if (selectElement.value === 'Küçük Başvuru' || selectElement.value === 'Büyük Başvuru') {
        console.log('✅ Şirket seçimi gösteriliyor');
        companySelection.style.display = 'block';
        loadCompaniesForSelect(companySelect);
        
        // Tarih input'unu da ekle (eğer yoksa)
        addDateInputIfNeeded(row);

        // KURAL 1:
        // Başvuru durumu Küçük/Büyük Başvuru ise,
        // sorgu durumu otomatik "Sorgulandı", uygunluk durumu "Uygun" olsun (yalnızca ön yüzde).
        if (sorguSelect) {
            sorguSelect.value = 'Sorgulandı';
            toggleSorgulananFirmaSelection(sorguSelect);
        }
        if (uygunlukSelect) {
            uygunlukSelect.value = 'Uygun';
            try {
                handleUygunlukChange({ target: uygunlukSelect });
            } catch (e) {
                console.error('handleUygunlukChange tetiklenirken hata:', e);
            }
        }
    } else {
        console.log('❌ Şirket seçimi gizleniyor');
        companySelection.style.display = 'none';
        companySelect.value = '';
    }
}

// Sorguya gönderme sekmesinde seçili kayıt sayısını göster
function updateQueueSelectionBadge() {
    const badge = document.getElementById('queryCountBadge');
    if (!badge) return;
    const checked = document.querySelectorAll('#queueListContainer .queue-item-checkbox:checked').length;
    const total = Array.isArray(currentQueueData) ? currentQueueData.length : 0;
    badge.textContent = `${checked} seçili / ${total} sırada kayıt`;
}

// Tarih input'unu ekle (başvuru durumu seçildiğinde)
function addDateInputIfNeeded(row) {
    const propertyId = row.querySelector('[data-property-id]').getAttribute('data-property-id');
    const tarihCell = row.querySelector('td:nth-child(6)'); // Başvuru Tarihi sütunu
    
    // Eğer tarih input'u yoksa ekle (başvuru durumu seçildiğinde)
    if (!tarihCell.querySelector('input[type="date"]')) {
        tarihCell.innerHTML = `
            <input type="date" class="form-control form-control-sm basvuru-tarihi-input" 
                   id="basvuruTarihi_${propertyId}" 
                   value="${new Date().toISOString().split('T')[0]}"
                   data-property-id="${propertyId}">
        `;
        console.log('✅ Tarih input\'u eklendi (başvuru durumu seçildiğinde)');
    }
}

// Şirketleri dropdown'a yükle
async function loadCompaniesForSelect(selectElement) {
    console.log('🏢 Şirket listesi yükleniyor...');
    
    try {
        const response = await fetch('api.php?action=get_companies');
        const companies = await response.json();
        
        console.log('📋 Gelen şirketler:', companies);
        
        // Mevcut seçenekleri temizle (ilk seçenek hariç)
        selectElement.innerHTML = '<option value="">Şirket Seçiniz</option>';
        
        if (companies && companies.length > 0) {
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                selectElement.appendChild(option);
            });
            console.log('✅ Şirket listesi yüklendi:', companies.length, 'şirket');
        } else {
            console.log('⚠️ Şirket listesi boş');
        }
        
    } catch (error) {
        console.error('❌ Şirket listesi yükleme hatası:', error);
    }
}

// Kayıt güncelle
async function updateRecord(propertyId) {
    console.log('💾 Kayıt güncelleniyor:', propertyId);
    
    const row = document.querySelector(`tr[data-property-id="${propertyId}"]`);
    if (!row) {
        console.error('❌ Kayıt satırı bulunamadı');
        return;
    }
    
    const basvuruSelect = row.querySelector('.basvuru-select');
    const sorguSelect = row.querySelector('.sorgu-select');
    const uygunlukSelect = row.querySelector('.uygunluk-select');
    const sorgulananFirmaSelect = row.querySelector(`#sorgulananFirmaSelect_${propertyId}`);
    const companySelect = row.querySelector('#companySelect_' + propertyId);
    
    const updateData = {
        property_id: propertyId
    };
    
    // Tarih bilgisini her zaman al (tablodan)
    const tarihInput = row.querySelector(`#basvuruTarihi_${propertyId}`);
    if (tarihInput && tarihInput.value) {
        updateData.basvuru_tarihi = tarihInput.value;
    }
    
    if (basvuruSelect.value && basvuruSelect.value !== '') {
        updateData.basvuru_durumu = basvuruSelect.value;
        console.log('🔍 Başvuru durumu seçildi:', basvuruSelect.value);
        
        // Eğer başvuru durumu seçildiyse ve şirket seçimi varsa
        if ((basvuruSelect.value === 'Küçük Başvuru' || basvuruSelect.value === 'Büyük Başvuru') && companySelect) {
            console.log('🔍 Şirket seçimi kontrol ediliyor:', companySelect.value);
            if (!companySelect.value) {
                TitleAlertMessage('⚠️ Başvuru durumu güncelleniyor - lütfen bir şirket seçiniz!', 'warning');
                return;
            }
            updateData.company_id = companySelect.value;
            console.log('✅ Şirket ID eklendi:', companySelect.value);
        }
    }
    
    if (sorguSelect.value && sorguSelect.value !== '') {
        updateData.sorgu_durumu = sorguSelect.value;
    }
    
    // Sorgulanan firma kontrolü
    console.log('🔍 updateRecord - sorgulananFirmaSelect:', {
        element: sorgulananFirmaSelect,
        value: sorgulananFirmaSelect ? sorgulananFirmaSelect.value : 'element bulunamadı',
        exists: !!sorgulananFirmaSelect
    });
    
    if (sorgulananFirmaSelect && sorgulananFirmaSelect.value && sorgulananFirmaSelect.value !== '') {
        updateData.sorgulanan_firma = sorgulananFirmaSelect.value;
        console.log('✅ Sorgulanan firma eklendi:', sorgulananFirmaSelect.value);
    } else {
        console.log('❌ Sorgulanan firma eklenmedi');
    }
    
    if (uygunlukSelect.value && uygunlukSelect.value !== '' && uygunlukSelect.value !== 'Seçiniz') {
        updateData.uygunluk_durumu = uygunlukSelect.value;
    }
    
    // Hiçbir değişiklik yoksa uyarı ver
    if (!updateData.basvuru_durumu && !updateData.sorgu_durumu && !updateData.uygunluk_durumu && !updateData.sorgulanan_firma) {
        TitleAlertMessage('⚠️ Lütfen güncellenecek en az bir alan seçin!', 'warning');
        return;
    }

    // Sorgu durumu "Sorgulandı" ise ve henüz sorgulanan firma yoksa,
    // satırdaki mevcut değeri kontrol et; o da yoksa kullanıcıdan seçim iste.
    if (updateData.sorgu_durumu === 'Sorgulandı') {
        const existingSorgulananFirma = row.getAttribute('data-sorgulanan-firma');
        const hasExistingFirma = existingSorgulananFirma &&
            existingSorgulananFirma !== '' &&
            existingSorgulananFirma !== 'null' &&
            existingSorgulananFirma !== 'undefined';
        
        if (!updateData.sorgulanan_firma && !hasExistingFirma) {
            TitleAlertMessage('⚠️ Sorgu durumu Sorgulandı seçildi. Lütfen sorgulanan firmayı da seçin.', 'warning');
            return;
        }
    }
    
    try {
        const formData = new URLSearchParams();
        formData.append('action', 'update_query_record');
        formData.append('property_id', propertyId);
        
        if (updateData.basvuru_durumu) {
            formData.append('basvuru_durumu', updateData.basvuru_durumu);
            if (updateData.company_id) {
                formData.append('company_id', updateData.company_id);
            }
            if (updateData.basvuru_tarihi) {
                formData.append('basvuru_tarihi', updateData.basvuru_tarihi);
            }
        }
        
        if (updateData.sorgu_durumu) {
            formData.append('sorgu_durumu', updateData.sorgu_durumu);
        }
        
        if (updateData.uygunluk_durumu) {
            formData.append('uygunluk_durumu', updateData.uygunluk_durumu);
        }

        if (updateData.sorgulanan_firma) {
            formData.append('sorgulanan_firma', updateData.sorgulanan_firma);
        }
        
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            TitleAlertMessage('✅ Kayıt başarıyla güncellendi!', 'success');

            // Güncellenen kaydı sağ sidebar gridlerinden çıkar
            const propertyIdStr = String(propertyId);

            if (Array.isArray(fullQueueData)) {
                fullQueueData = fullQueueData.filter(item => String(item.prolegal_id) !== propertyIdStr);
            }
            if (Array.isArray(currentQueueData)) {
                currentQueueData = currentQueueData.filter(item => String(item.prolegal_id) !== propertyIdStr);
            }

            // Sorgu & Uygunluk gridinden satırı kaldır
            const queueRow = document.querySelector(`#queueListContainer tr[data-property-id="${propertyIdStr}"]`);
            if (queueRow && queueRow.parentElement) {
                queueRow.parentElement.removeChild(queueRow);
            }

            // Başvurular gridini de güncelle
            updateApplicationDisplay(currentQueueData);
            updateRecordCounter(currentQueueData, lastQueueSourceType);
        } else {
            TitleAlertMessage('❌ Güncelleme hatası: ' + (result.message || 'Bilinmeyen hata'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Güncelleme hatası:', error);
        TitleAlertMessage('❌ Güncelleme sırasında bir hata oluştu.', 'danger');
    }
}

// Event listener'ları ekle
document.addEventListener('DOMContentLoaded', function() {
    // Sağ sidebar tam ekran toggle
        // expandBtn tıklaması üst blokta ele alındı

    // Flatpickr tarih / aralık takvimi
    const dateRangeInput = document.getElementById('queryDateRange');
    const attachDateHandlers = (inputEl) => {
        if (!inputEl) return;
        const updateSharedDateFilter = () => {
            const val = (inputEl.value || '').trim();
            window.sharedDateFilter = parseDateRangeValue(val);
            saveInputsForActiveTab();
            applyFiltersForActiveTab();
        };
        inputEl.addEventListener('change', updateSharedDateFilter);
        inputEl.addEventListener('blur', updateSharedDateFilter);
        return updateSharedDateFilter;
    };

    if (window.flatpickr && dateRangeInput) {
        const updateSharedDateFilter = attachDateHandlers(dateRangeInput);
        flatpickr(dateRangeInput, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            allowInput: true,
            onChange: updateSharedDateFilter
        });
        // Varsayılan tarihleri temizle
        dateRangeInput.value = '';
    } else {
        attachDateHandlers(dateRangeInput);
    }

    // Filtreleme butonları
    const listAllBtn = document.getElementById('listAllRecords');
    const applyFiltersBtn = document.getElementById('applyQueryFilters');
    const clearFiltersBtn = document.getElementById('clearQueryFilters');
    const exportQueueExcelBtn = document.getElementById('exportQueueExcel');
    
    if (listAllBtn) {
        listAllBtn.addEventListener('click', function() {
            // Tüm Durumları Listele butonuna basıldığında tüm durumları getir
            loadAllRecordsWithAllStatuses();
        });
    }
    
    if (exportQueueExcelBtn) {
        exportQueueExcelBtn.addEventListener('click', exportCurrentQueueToExcel);
    }
    
    if (applyFiltersBtn) {
        // Eğer "Tüm Durumları Listele" butonuna basılmışsa, tüm kayıtları filtrele
        // Yoksa sadece sıradakileri filtrele
        applyFiltersBtn.addEventListener('click', function() {
            const filters = getActiveFilters();
            const hasFilters = Object.keys(filters).length > 0;
            
            if (hasFilters) {
                // Filtre varsa, tüm kayıtları filtrele
                loadAllRecordsWithFilters();
            } else {
                // Hiç filtre seçilmemişse (Tümü, Tümü, Tümü) -> Tüm Durumları Listele mantığını kullan
                loadAllRecordsWithAllStatuses();
            }
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    // Ortak il/ada/parsel filtreleri değişince üç sekmeyi güncelle (blur + change)
    const sharedIlInput = document.getElementById('queryFilterIl');
    const sharedAdaInput = document.getElementById('queryFilterAda');
    const sharedParselInput = document.getElementById('queryFilterParsel');
    const reloadWithSharedFilters = () => {
        saveInputsForActiveTab();
        applyFiltersForActiveTab();
    };
    [sharedIlInput, sharedAdaInput, sharedParselInput].forEach(input => {
        if (input) {
            input.addEventListener('change', reloadWithSharedFilters);
            input.addEventListener('blur', reloadWithSharedFilters);
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') reloadWithSharedFilters();
            });
            input.addEventListener('input', saveInputsForActiveTab);
        }
    });

    // Şirket filtresi (tek input + datalist, case-insensitive arama)
    const sharedCompanyInput = document.getElementById('sharedCompanyFilter');
    if (sharedCompanyInput) {
        sharedCompanyInput.addEventListener('focus', populateSharedCompanyOptions);
        sharedCompanyInput.addEventListener('input', () => {
            const val = sharedCompanyInput.value;
            applyCompanyFilter(val);
            saveInputsForActiveTab();
        });
        sharedCompanyInput.addEventListener('change', () => {
            applyCompanyFilter(sharedCompanyInput.value);
            saveInputsForActiveTab();
        });
        sharedCompanyInput.addEventListener('blur', () => {
            applyCompanyFilter(sharedCompanyInput.value);
            saveInputsForActiveTab();
        });
    }

    // Sol sidebar - sorgu sonuçları için şirket seçimi (input + datalist)
    const leftCompanyInput = document.getElementById('leftQueryCompanyInput');
    const leftCompanyDatalist = document.getElementById('leftCompanyList');
    const leftQuickAddCompanyBtn = document.getElementById('leftQuickAddCompanyBtn');
    const leftQuickCompanyNameInput = document.getElementById('leftQuickCompanyName');
    const leftQuickCompanySaveBtn = document.getElementById('leftQuickCompanySaveBtn');
    
    async function ensureAllCompaniesLoadedForLeft() {
        if (Array.isArray(window.allCompanies) && window.allCompanies.length > 0) {
            return window.allCompanies;
        }
        try {
            const response = await fetch('api.php?action=get_companies_summary');
            if (!response.ok) {
                throw new Error('Şirket listesi alınamadı: ' + response.status);
            }
            const companies = await response.json();
            window.allCompanies = companies;
            return companies;
        } catch (error) {
            console.error('❌ Sol sidebar şirket listesi yükleme hatası:', error);
            return [];
        }
    }
    
    async function populateLeftCompanyOptions() {
        if (!leftCompanyInput || !leftCompanyDatalist) return;
        const companies = await ensureAllCompaniesLoadedForLeft();
        
        // Mevcut datalist option'larını clean
        leftCompanyDatalist.innerHTML = '';
        
        // İsimlere göre alfabetik sırala
        companies
            .slice()
            .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))
            .forEach(company => {
                const option = document.createElement('option');
                option.value = company.company_name || '';
                option.dataset.id = company.id;
                leftCompanyDatalist.appendChild(option);
            });
    }
    
    if (leftCompanyInput && leftCompanyDatalist) {
        populateLeftCompanyOptions();
        
        leftCompanyInput.addEventListener('change', function() {
            const value = this.value.trim();
            let selectedId = null;
            let selectedName = '';
            
            if (value) {
                const options = Array.from(leftCompanyDatalist.options);
                const match = options.find(opt => opt.value === value);
                if (match) {
                    selectedId = match.dataset.id || null;
                    selectedName = match.value;
                }
            }
            
            window.selectedLeftQueryCompanyId = selectedId;
            window.selectedLeftQueryCompanyName = selectedName;
            
            console.log('🔍 Sol sidebar şirket seçildi (datalist):', {
                id: window.selectedLeftQueryCompanyId,
                name: window.selectedLeftQueryCompanyName
            });

            const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
            if (headerCompanyEl) {
                headerCompanyEl.textContent = selectedName || '';
            }

            // Şirketler tabındaki arazi listesini seçilen şirkete göre güncelle
            if (selectedId) {
                fetchCompanyProperties(selectedId);
            }
        });
    }
    
    // Sol sidebar hızlı şirket oluşturma - minimum tıklama ile
    if (leftQuickAddCompanyBtn) {
        leftQuickAddCompanyBtn.addEventListener('click', async function() {
            try {
                let name = (leftCompanyInput?.value || '').trim();
                
                // Eğer input boşsa, gerekirse modalı kullan (eski davranış)
                if (!name && leftQuickCompanyNameInput && leftQuickCompanySaveBtn) {
                    leftQuickCompanyNameInput.value = '';
                    const modalEl = document.getElementById('leftQuickCompanyModal');
                    if (modalEl) {
                        const modal = new bootstrap.Modal(modalEl);
                        modalEl.addEventListener('shown.bs.modal', function handleShown() {
                            leftQuickCompanyNameInput.focus();
                            leftQuickCompanyNameInput.select();
                            modalEl.removeEventListener('shown.bs.modal', handleShown);
                        });
                        modal.show();
                    }
                    return;
                }

                if (!name) {
                    TitleAlertMessage('⚠️ Lütfen bir şirket adı yazın.', 'warning');
                    leftCompanyInput?.focus();
                    return;
                }

                // Eğer yazılan isim zaten listede varsa, sadece onu seç
                if (leftCompanyDatalist) {
                    const options = Array.from(leftCompanyDatalist.options);
                    const existing = options.find(opt => opt.value === name);
                    if (existing) {
                        window.selectedLeftQueryCompanyId = existing.dataset.id || null;
                        window.selectedLeftQueryCompanyName = existing.value;
                        if (leftCompanyInput) leftCompanyInput.value = existing.value;

                        const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
                        if (headerCompanyEl) {
                            headerCompanyEl.textContent = existing.value;
                        }

                        if (existing.dataset.id) {
                            fetchCompanyProperties(existing.dataset.id);
                        }
                        return;
                    }
                }

                // Yeni şirketi direkt oluştur
                const formData = new FormData();
                formData.append('action', 'add_company');
                formData.append('company_name', name);
                
                const response = await fetch('api.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                    if (!result.success || !result.id) {
                        TitleAlertMessage('❌ Şirket eklenemedi.', 'danger');
                        return;
                    }
                
                const newCompanyId = result.id;
                
                // Global şirket listesini güncelle
                if (!Array.isArray(window.allCompanies)) {
                    window.allCompanies = [];
                }
                window.allCompanies.push({
                    id: newCompanyId,
                    company_name: name,
                    property_count: 0
                });
                
                // Sol inputu ve global seçimi güncelle
                await populateLeftCompanyOptions();
                if (leftCompanyInput) {
                    leftCompanyInput.value = name;
                }
                window.selectedLeftQueryCompanyId = String(newCompanyId);
                window.selectedLeftQueryCompanyName = name;

                const headerCompanyEl = document.getElementById('globalSelectedCompanyName');
                if (headerCompanyEl) {
                    headerCompanyEl.textContent = name;
                }

                // Şirketler tabındaki listeyi de taze tutmak için, global fonksiyon varsa çağır
                if (typeof loadCompaniesForCompanyTab === 'function') {
                    loadCompaniesForCompanyTab();
                }

                TitleAlertMessage('✅ Şirket oluşturuldu ve seçildi.', 'success');
            } catch (error) {
                console.error('❌ Sol sidebar hızlı şirket oluşturma hatası:', error);
                TitleAlertMessage('❌ Şirket oluşturulurken bir hata oluştu.', 'danger');
            }
        });
    }

    // Şirket seçimi kaldırıldı (sorguya gönderme toplu güncelle)

    // Sağ sorgu yönetimi - toplu güncelleme butonu
    const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
    if (bulkUpdateBtn) {
        bulkUpdateBtn.addEventListener('click', applyBulkQueueUpdate);
    }
    const removeFromQueueBtn = document.getElementById('removeFromQueueBtn');
    if (removeFromQueueBtn) {
        removeFromQueueBtn.addEventListener('click', removeSelectedFromQueue);
    }
    const queueExportBtn = document.getElementById('queueExportBtn');
    if (queueExportBtn) {
        queueExportBtn.addEventListener('click', exportSelectedQueueToExcel);
    }

    // Başvurular tabı - konuma göre filtreleme
    const appFilterApply = document.getElementById('appFilterApply');
    const appFilterClear = document.getElementById('appFilterClear');
    const appBulkUpdateBtn = document.getElementById('applicationBulkUpdateBtn');
    const appSubjectInput = document.getElementById('applicationSubjectInput');
    const queryResultExportBtn = document.getElementById('queryResultExportBtn');
    const queryResultTabBtn = document.querySelector('[data-target="query-result-pane"]');
    const queryResultStatusSelect = document.getElementById('queryResultStatusSelect');
    const queryResultStatusUpdateBtn = document.getElementById('queryResultStatusUpdateBtn');
    if (appFilterApply) {
        // Listele butonundan çağrılırken uyarı aktif olsun
        appFilterApply.addEventListener('click', () => loadApplicationsByLocation(false));
    }
    if (appFilterClear) {
        appFilterClear.addEventListener('click', clearApplicationLocationFilters);
    }
    if (appBulkUpdateBtn) {
        appBulkUpdateBtn.addEventListener('click', applyBulkApplicationStatusUpdate);
    }
    if (queryResultExportBtn) {
        queryResultExportBtn.addEventListener('click', exportQueryResultsToExcel);
    }
    if (queryResultStatusUpdateBtn && queryResultStatusSelect) {
        queryResultStatusUpdateBtn.addEventListener('click', () => applyQueryResultStatusUpdate(queryResultStatusSelect));
    }
    if (queryResultTabBtn) {
        queryResultTabBtn.addEventListener('click', () => {
            loadSorgudaResults(true);
        });
    }
    // Sekme açılmadan da ilk veriyi al (fallback) -- kaldırıldı: sonsuz çağrıyı önlemek için
    // setTimeout(() => loadSorgudaResults(true), 600);

    // Başvurular tabı - konum filtre panelini aç/kapat
    const appLocationToggle = document.getElementById('appLocationToggle');
    const appLocationToggleIcon = document.getElementById('appLocationToggleIcon');
    const appLocationPanel = document.getElementById('appLocationPanel');
    if (appLocationToggle && appLocationPanel) {
        appLocationToggle.addEventListener('click', () => {
            const isOpen = appLocationPanel.classList.contains('open');
            const labelSpan = appLocationToggle.querySelector('.app-location-toggle-label');

            if (isOpen) {
                // Kapat
                appLocationPanel.classList.remove('open');
                if (appLocationToggleIcon) appLocationToggleIcon.textContent = '▼';
                if (labelSpan) labelSpan.textContent = 'Konum filtrelerini göster';
            } else {
                // Aç
                appLocationPanel.classList.add('open');
                if (appLocationToggleIcon) appLocationToggleIcon.textContent = '▲';
                if (labelSpan) labelSpan.textContent = 'Konum filtrelerini gizle';
            }
        });
    }

    // Başvurular tabı - konum select'lerini il/ilçe/mahalle verisi ile doldur
    initApplicationLocationSelects();
});

// Sağ sorgu yönetimi - toplu güncelleme (Sorguya Gönder)
async function applyBulkQueueUpdate() {
    try {
        const checkboxes = document.querySelectorAll('.queue-item-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-prolegal-id'));
        
        if (selectedIds.length === 0) {
            TitleAlertMessage('⚠️ Lütfen en az bir kayıt seçin.', 'warning');
            return;
        }
        
        let companyName = '';
        let konu = '';
        
        let successCount = 0;
        let failCount = 0;
        const operationDate = new Date();
        const operationDateStr = operationDate.toISOString().slice(0, 19).replace('T', ' ');
        const operationDateOnly = operationDate.toISOString().slice(0, 10);
        
        for (const propertyId of selectedIds) {
            try {
                // Satırdan şirket bilgisini oku (sorgulanan_firma)
                const row = document.querySelector(`#queueListContainer tr[data-property-id="${propertyId}"]`);
                const rowCompany = row ? (row.getAttribute('data-sorgulanan-firma') || '') : '';
                const resolvedCompany = rowCompany || window.sharedCompanyFilterName || '';

                const formData = new URLSearchParams();
                formData.append('action', 'update_query_record');
                formData.append('property_id', propertyId);
                
                if (resolvedCompany) {
                    formData.append('sorgulanan_firma', resolvedCompany);
                }
                const itemSubject = getSubjectById(propertyId);
                if (itemSubject) {
                    formData.append('konu', itemSubject);
                }
                // Yalnızca Sorguda durumuna geçiş
                formData.append('sorgu_durumu', 'Sorguda');
                // Sorguya gönderme tarihi
                formData.append('sorgu_tarihi', operationDateStr);
                
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });
                
                const result = await response.json();
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('❌ Toplu güncelleme hatası (tekil kayıt):', error);
                failCount++;
            }
        }

        if (successCount > 0) {
            const msg = `✅ ${successCount} kayıt güncellendi` + (failCount ? `, ${failCount} hata` : '');
            TitleAlertMessage(msg, failCount ? 'warning' : 'success');

            // Güncellenen kayıtları sağ sidebar gridlerinden çıkar
            const idSet = new Set(selectedIds.map(id => String(id)));
            if (Array.isArray(fullQueueData)) {
                fullQueueData = fullQueueData.filter(item => !idSet.has(String(item.prolegal_id)));
            }
            if (Array.isArray(currentQueueData)) {
                currentQueueData = currentQueueData.filter(item => !idSet.has(String(item.prolegal_id)));
            }

            // Gridleri ve sayacı güncelle
            updateQueueDisplay(currentQueueData);
            updateRecordCounter(currentQueueData, lastQueueSourceType);

        } else {
            TitleAlertMessage('❌ Toplu güncelleme başarısız oldu.', 'danger');
        }
    } catch (error) {
        console.error('❌ Toplu güncelleme genel hata:', error);
        TitleAlertMessage('❌ Toplu güncelleme sırasında bir hata oluştu.', 'danger');
    }
}

// Başvurular tabı - konuma göre başvuru kayıtlarını yükle
// skipConfirm = true ise, filtre boşken çıkan "çok kayıt gelebilir" uyarısı gösterilmez
// includeAllApplications = true ise, varsayılan olarak Küçük+Büyük başvurular getirilecek
// onlyUygun = true ise, uygunluk_durumu=Uygun filtresi eklenir
async function loadApplicationsByLocation(skipConfirm = false, includeAllApplications = false, onlyUygun = false) {
    try {
        const il = document.getElementById('appFilterIl')?.value.trim() || '';
        const ilce = document.getElementById('appFilterIlce')?.value.trim() || '';
        const mahalle = document.getElementById('appFilterMahalle')?.value.trim() || '';
        const ada = document.getElementById('appFilterAda')?.value.trim() || '';
        const parsel = document.getElementById('appFilterParsel')?.value.trim() || '';
        const sharedIl = document.getElementById('queryFilterIl')?.value.trim() || '';
        const sharedAda = document.getElementById('queryFilterAda')?.value.trim() || '';
        const sharedParsel = document.getElementById('queryFilterParsel')?.value.trim() || '';
        // Ortak durum filtresinden başvuru seçimi yapıldıysa onu da al
        const statusSelect = document.getElementById('queryStatusFilter');
        const statusValue = statusSelect ? statusSelect.value : '';
        let basvuruFilter = '';
        if (!onlyUygun) { // Uygunluk filtresi istenirken başvuru durumuna göre daraltma yapma
            if (statusValue === 'basvuru_kucuk') {
                basvuruFilter = 'Küçük Başvuru';
            } else if (statusValue === 'basvuru_buyuk') {
                basvuruFilter = 'Büyük Başvuru';
            }
            // Başvuru tabına geçildiğinde otomatik olarak küçük+büyük başvurular gelsin
            if (!basvuruFilter && includeAllApplications) {
                basvuruFilter = 'Küçük Başvuru,Büyük Başvuru';
            }
        }

        const params = new URLSearchParams({ action: 'get_all_records' });
        if (il) params.append('il', il);
        if (ilce) params.append('ilce', ilce);
        if (mahalle) params.append('mahalle', mahalle);
        if (ada) params.append('ada', ada);
        if (parsel) params.append('parsel', parsel);
        if (!il && sharedIl) params.append('il', sharedIl);
        if (!ada && sharedAda) params.append('ada', sharedAda);
        if (!parsel && sharedParsel) params.append('parsel', sharedParsel);
        if (basvuruFilter) params.append('basvuru_durumu', basvuruFilter);
        if (onlyUygun) params.append('uygunluk_durumu', 'Uygun');

        // Hiçbir filtre seçilmemişse, kullanıcıyı uyar (tüm veriyi çekme riskini azalt)
        if (!skipConfirm && !il && !ilce && !mahalle && !ada && !parsel) {
            const confirmAll = confirm(
                'Hiçbir konum filtresi seçilmedi. Bu işlem çok fazla kaydı listeleyip sistemi yavaşlatabilir.\n\n' +
                'Yine de devam etmek istiyor musunuz?'
            );
            if (!confirmAll) {
                return;
            }
        }

        const loadingElement = document.getElementById('queryQueueLoading');
        if (loadingElement) loadingElement.style.display = 'block';

        const response = await fetch(`api.php?${params.toString()}`);
        const records = await response.json();

        console.log('📊 Başvurular (konuma göre):', records);

        const normalizedRecords = Array.isArray(records) ? records : [];
        applicationBaseData = normalizedRecords.slice();
        populateSharedCompanyOptions();
        populateSharedIlOptionsFromData();

        // Çok büyük liste durumunda ek uyarı göster
        const HARD_LIMIT = 5000;
        const SOFT_LIMIT = 1000;

        if (normalizedRecords.length > HARD_LIMIT) {
            TitleAlertMessage(
                `⚠️ ${normalizedRecords.length} kayıt bulundu. Bu kadar çok kaydı tek seferde yüklemek yerine lütfen konum filtresini daraltın.`,
                'warning'
            );
        } else if (normalizedRecords.length > SOFT_LIMIT) {
            TitleAlertMessage(
                `ℹ️ ${normalizedRecords.length} kayıt bulundu. Listeleme devam ediyor ancak sistemi yavaşlatabilir, mümkünse konum filtresini daraltın.`,
                'info'
            );
        }

        renderFilteredApplications();
    } catch (error) {
        console.error('❌ Başvurular konum filtresi hatası:', error);
        const appContainer = document.getElementById('applicationListContainer');
        if (appContainer) {
            appContainer.innerHTML = '<div class="text-danger text-center p-3 small">Veri yüklenirken hata oluştu.</div>';
        }
    } finally {
        const loadingElement = document.getElementById('queryQueueLoading');
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

// Başvurular tabı - küçük/büyük başvuru toplu güncelleme
async function applyBulkApplicationStatusUpdate() {
    try {
        const checkboxes = document.querySelectorAll('#applicationListContainer .queue-item-checkbox:checked');
        const selectedIds = Array.from(checkboxes)
            .map(cb => cb.getAttribute('data-prolegal-id'))
            .filter(Boolean);

        if (selectedIds.length === 0) {
            TitleAlertMessage('⚠️ Lütfen en az bir başvuru kaydı seçin.', 'warning');
            return;
        }

        const statusSelect = document.getElementById('applicationStatusSelect');
        const basvuruDurumu = statusSelect ? statusSelect.value : '';
        let konu = '';

        if (!basvuruDurumu) {
            TitleAlertMessage('⚠️ Lütfen bir başvuru durumu seçin (Küçük / Büyük).', 'warning');
            return;
        }

        // Konu otomatik ortak konudan geliyor; yoksa boş bırakılır

        let successCount = 0;
        let failCount = 0;
        const successIds = [];
        const now = new Date();
        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

        for (const propertyId of selectedIds) {
            try {
                const row = document.querySelector(`#applicationListContainer tr[data-property-id="${propertyId}"]`);
                const companyName = row ? (row.getAttribute('data-sorgulanan-firma') || '') : '';

                const formData = new URLSearchParams();
                formData.append('action', 'update_query_record');
                formData.append('property_id', propertyId);
                formData.append('basvuru_durumu', basvuruDurumu);
                // Başvuru tarihi güncellensin
                formData.append('basvuru_tarihi', nowStr);
                if (companyName) {
                    formData.append('basvurulan_firma', companyName);
                }
                const itemSubject = getSubjectById(propertyId);
                if (itemSubject) {
                    formData.append('konu', itemSubject);
                }

                // Başvuru giriliyorsa, iş kuralına göre otomatik:
                // - Uygunluk durumu: Uygun
                // - Sorgu durumu: Sorgulandı
                if (basvuruDurumu === 'Küçük Başvuru' || basvuruDurumu === 'Büyük Başvuru') {
                    formData.append('uygunluk_durumu', 'Uygun');
                    formData.append('sorgu_durumu', 'Sorgulandı');
                }

                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    successCount++;
                    successIds.push(propertyId);
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('❌ Başvurular toplu güncelleme hatası (tekil kayıt):', error);
                failCount++;
            }
        }

        if (successCount > 0) {
            const msg = `✅ ${successCount} başvuru kaydı güncellendi` + (failCount ? `, ${failCount} hata` : '');
            TitleAlertMessage(msg, failCount ? 'warning' : 'success');

            // Başarıyla güncellenen satırları Application listesinden kaldır
            const appContainer = document.getElementById('applicationListContainer');
            if (appContainer && successIds.length > 0) {
                const normalizedSuccessIds = successIds.map(id => String(id));
                successIds.forEach(id => {
                    const row = appContainer.querySelector(`tr[data-property-id="${id}"]`);
                    if (row && row.parentElement) {
                        row.parentElement.removeChild(row);
                    }
                });

                // Kalan satır sayısını kontrol et ve badge'i güncelle
                const remainingCheckboxes = appContainer.querySelectorAll('.queue-item-checkbox');
                const remainingCount = remainingCheckboxes.length;
                const removedSet = new Set(normalizedSuccessIds);
                currentApplicationData = currentApplicationData.filter(item => !removedSet.has(String(item?.prolegal_id ?? item?.id ?? '')));
                updateApplicationSelectionBadge(remainingCount);

                // Hiç kayıt kalmadıysa mesaj göster
                if (remainingCount === 0) {
                    appContainer.innerHTML = '<div class="text-muted text-center p-3 small">Filtrelere uygun kayıt bulunamadı</div>';
                }
            }
        } else {
            TitleAlertMessage('❌ Başvuru güncellemesi başarısız oldu.', 'danger');
        }
    } catch (error) {
        console.error('❌ Başvurular toplu güncelleme genel hata:', error);
        TitleAlertMessage('❌ Başvurular toplu güncelleme sırasında bir hata oluştu.', 'danger');
    }
}

// Başvurular tabı - konum filtrelerini temizle
function clearApplicationLocationFilters() {
    const il = document.getElementById('appFilterIl');
    const ilce = document.getElementById('appFilterIlce');
    const mahalle = document.getElementById('appFilterMahalle');
    const ada = document.getElementById('appFilterAda');
    const parsel = document.getElementById('appFilterParsel');

    if (il) il.value = '';
    if (ilce) {
        ilce.innerHTML = '<option value=\"\">İlçe Seçiniz</option>';
    }
    if (mahalle) {
        mahalle.innerHTML = '<option value=\"\">Mahalle Seçiniz</option>';
    }
    if (ada) ada.value = '';
    if (parsel) parsel.value = '';

    // Listeyi temiz göster
    const appContainer = document.getElementById('applicationListContainer');
    if (appContainer) {
        appContainer.innerHTML = '<div class="text-muted text-center p-3 small">Konum filtresi ile başvuru kayıtlarını listeleyin.</div>';
    }
}

// Başvurular tabı - il/ilçe/mahalle select zinciri
async function initApplicationLocationSelects() {
    const ilSelect = document.getElementById('appFilterIl');
    const ilceSelect = document.getElementById('appFilterIlce');
    const mahalleSelect = document.getElementById('appFilterMahalle');

    if (!ilSelect || !ilceSelect || !mahalleSelect) {
        return;
    }

    try {
        // İl listesini yükle
        const ilData = await getJSON(IL_DATA);
        if (ilData && Array.isArray(ilData.features)) {
            ilData.features.forEach(element => {
                const opt = document.createElement('option');
                opt.value = element.properties.text || '';
                opt.dataset.id = element.properties.id;
                opt.textContent = element.properties.text || '';
                ilSelect.appendChild(opt);
            });
        }

        ilSelect.addEventListener('change', async function() {
            const selectedOption = ilSelect.options[ilSelect.selectedIndex];
            const ilceId = selectedOption ? selectedOption.dataset.id : '';

            // İlçe ve mahalle select'lerini temizle
            ilceSelect.innerHTML = '<option value=\"\">İlçe Seçiniz</option>';
            mahalleSelect.innerHTML = '<option value=\"\">Mahalle Seçiniz</option>';

            if (!ilceId) return;

            try {
                const ilceData = await getJSON(ILCE_DATA(ilceId));
                if (ilceData && Array.isArray(ilceData.features)) {
                    ilceData.features.forEach(element => {
                        const opt = document.createElement('option');
                        opt.value = element.properties.text || '';
                        opt.dataset.id = element.properties.id;
                        opt.textContent = element.properties.text || '';
                        ilceSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error('❌ İlçe listesi yüklenemedi (başvurular):', err);
            }
        });

        ilceSelect.addEventListener('change', async function() {
            const selectedOption = ilceSelect.options[ilceSelect.selectedIndex];
            const mahalleId = selectedOption ? selectedOption.dataset.id : '';

            mahalleSelect.innerHTML = '<option value=\"\">Mahalle Seçiniz</option>';

            if (!mahalleId) return;

            try {
                const mahalleData = await getJSON(MAHALLE_DATA(mahalleId));
                if (mahalleData && Array.isArray(mahalleData.features)) {
                    mahalleData.features.forEach(element => {
                        const opt = document.createElement('option');
                        opt.value = element.properties.text || '';
                        opt.textContent = element.properties.text || '';
                        mahalleSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error('❌ Mahalle listesi yüklenemedi (başvurular):', err);
            }
        });
    } catch (error) {
        console.error('❌ İl listesi yüklenemedi (başvurular):', error);
    }
}

// Sorgu sırasından çıkar
async function removeFromQueue(queueId) {
    console.log('🗑️ Sorgu sırasından çıkarılıyor:', queueId);
    
    if (!confirm('Bu araziyi sorgu sırasından çıkarmak istediğinize emin misiniz?')) {
        return;
    }
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=remove_from_queue&queue_id=${queueId}`
        });
        
        const result = await response.json();
        
        if (result.success) {
            TitleAlertMessage('✅ Arazi sorgu sırasından çıkarıldı!', 'success');
            // Tam yenilemeden önce yerel listelerden çıkar
            const filterOut = (arr) => Array.isArray(arr) ? arr.filter(item => String(item?.id) !== String(queueId)) : [];
            fullQueueData = filterOut(fullQueueData);
            queueBaseData = filterOut(queueBaseData);
            currentQueueData = filterOut(currentQueueData);
            currentApplicationData = filterOut(currentApplicationData);
            updateQueueDisplay(currentQueueData, true);
            updateApplicationDisplay(currentApplicationData, true);
        } else {
            TitleAlertMessage('❌ Hata: ' + (result.message || 'Arazi sorgu sırasından çıkarılamadı.'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Sorgu sırasından çıkarma hatası:', error);
        TitleAlertMessage('❌ Hata: Arazi sorgu sırasından çıkarılırken bir hata oluştu.', 'danger');
    }
}

function exportSelectedQueueToExcel() {
    const queueContainer = document.getElementById('queueListContainer');
    if (!queueContainer) {
        TitleAlertMessage('❌ Sorgu listesi yüklenemedi.', 'danger');
        return;
    }
    const checkboxes = queueContainer.querySelectorAll('.queue-item-checkbox:checked');
    if (!checkboxes.length) {
        TitleAlertMessage('⚠️ Lütfen en az bir kayıt seçin.', 'warning');
        return;
    }
    const rows = [];
    checkboxes.forEach(cb => {
        const propertyId = cb.getAttribute('data-prolegal-id') || cb.closest('tr')?.getAttribute('data-property-id') || '';
        const item = currentQueueData.find(entry => {
            const pid = String(entry?.prolegal_id ?? entry?.id ?? '').trim();
            return pid && pid === propertyId;
        });
        if (item) {
            rows.push({
                id: item.prolegal_id || item.id || '',
                il: item.il || '',
                ilce: item.ilce || '',
                mahalle: item.mahalle || '',
                ada: item.ada || '',
                parsel: item.parsel || ''
            });
        }
    });
    if (!rows.length) {
        TitleAlertMessage('⚠️ Seçilen kayıtların bilgisi bulunamadı.', 'warning');
        return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'export_excel.php';
    form.target = '_blank';
    form.style.display = 'none';

    const appendField = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    appendField('data', JSON.stringify(rows));
    appendField('filename', `sorgu-secili-araziler-${Date.now()}.xlsx`);
    appendField('columns', JSON.stringify(['id', 'il', 'ilce', 'mahalle', 'ada', 'parsel']));
    appendField('headers', JSON.stringify(['ID', 'İl', 'İlçe', 'Mahalle', 'Ada', 'Parsel']));

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
        document.body.removeChild(form);
    }, 1000);
}

function getSelectedQueueIds() {
    const checkboxes = document.querySelectorAll('#queueListContainer .queue-item-checkbox:checked');
    const ids = [];
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        const qid = row?.getAttribute('data-queue-id');
        if (qid) ids.push(qid);
    });
    return ids;
}

async function removeSelectedFromQueue() {
    const ids = getSelectedQueueIds();
    if (!ids.length) {
        alert('Lütfen sorgu tablosunda en az bir kayıt seçin.');
        return;
    }
    if (!confirm(`Seçili ${ids.length} kaydı sorgu tablosundan çıkarmak istiyor musunuz?`)) return;

    let removed = 0;
    for (const id of ids) {
        try {
            const resp = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=remove_from_queue&queue_id=${encodeURIComponent(id)}`
            });
            const result = await resp.json();
            if (result?.success) {
                removed += 1;
                const filterOut = (arr) => Array.isArray(arr) ? arr.filter(item => String(item?.id) !== String(id)) : [];
                fullQueueData = filterOut(fullQueueData);
                queueBaseData = filterOut(queueBaseData);
                currentQueueData = filterOut(currentQueueData);
            }
        } catch (e) {
            console.error('removeSelectedFromQueue hata', e);
        }
    }
    updateQueueDisplay(currentQueueData, true);
    if (removed) {
        TitleAlertMessage(`✅ ${removed} kayıt sorgudan çıkarıldı.`, 'success');
    } else {
        TitleAlertMessage('❌ Kayıtlar çıkarılamadı.', 'danger');
    }
}
// Sorgu Sonucu sekmesi - sadece Sorguda kayıtları listeler
let queryResultData = [];
let queryResultBaseData = [];
let currentQueryResultData = [];

async function loadSorgudaResults(forceFetch = false) {
    try {
        // Mevcut veri varsa ve zorlanmadıysa, sadece filtre uygula
        if (!forceFetch && Array.isArray(queryResultBaseData) && queryResultBaseData.length > 0) {
            renderFilteredQueryResults();
            return;
        }

        const params = new URLSearchParams({ action: 'get_all_records', sorgulama_durumu: 'Sorguda' });
        const ilInput = document.getElementById('queryFilterIl');
        const adaInput = document.getElementById('queryFilterAda');
        const parselInput = document.getElementById('queryFilterParsel');
        if (ilInput && ilInput.value.trim()) params.append('il', ilInput.value.trim());
        if (adaInput && adaInput.value.trim()) params.append('ada', adaInput.value.trim());
        if (parselInput && parselInput.value.trim()) params.append('parsel', parselInput.value.trim());
        const response = await fetch(`api.php?${params.toString()}`);
        const data = await response.json();
        queryResultData = Array.isArray(data) ? data : [];
        queryResultBaseData = queryResultData.slice();
        populateSharedCompanyOptions();
        populateSharedIlOptionsFromData();
        renderFilteredQueryResults();
        const queryResultBadge = document.getElementById('queryResultCountBadge');
        if (queryResultBadge) queryResultBadge.textContent = `0 seçili / ${queryResultData.length} sorguda kayıt`;
    } catch (error) {
        console.error('❌ Sorgu Sonucu yükleme hatası:', error);
        const container = document.getElementById('queryResultListContainer');
        if (container) {
            container.innerHTML = '<div class="text-danger text-center p-3 small">Veri yüklenirken hata oluştu.</div>';
        }
    }
}

function updateQueryResultSelectionBadge(totalCount) {
    const badge = document.getElementById('queryResultCountBadge');
    if (!badge) return;
    const checked = document.querySelectorAll('#queryResultListContainer .query-result-checkbox:checked').length;
    const total = typeof totalCount === 'number'
        ? totalCount
        : (Array.isArray(currentQueryResultData) ? currentQueryResultData.length : 0);
    badge.textContent = `${checked} seçili / ${total} sorguda kayıt`;
}

function renderQueryResults(items) {
    const container = document.getElementById('queryResultListContainer');
    const badge = document.getElementById('queryResultCountBadge');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="text-muted text-center p-3 small">Sorguda kayıt bulunamadı</div>';
        if (badge) badge.textContent = '0 seçili / 0 sorguda kayıt';
        return;
    }

    updateQueryResultSelectionBadge(items.length);

    const tableHtml = renderListTable(items, {
        selectAllId: 'selectAllQueryResultItems',
        checkboxClass: 'query-result-checkbox',
        columns: queryResultColumns,
        rowDataAttrs: (item) => ({
            'data-property-id': item?.prolegal_id || item?.id || ''
        })
    });
    container.innerHTML = tableHtml;

    // Tümünü seç checkbox'ı (sorgu sonucu)
    const selectAll = document.getElementById('selectAllQueryResultItems');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = container.querySelectorAll('.query-result-checkbox');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
            updateQueryResultSelectionBadge(items.length);
        });
    }
    // Satır seçimlerini takip et
    container.querySelectorAll('.query-result-checkbox').forEach(cb => {
        cb.addEventListener('change', () => updateQueryResultSelectionBadge(items.length));
    });

    // Basit sıralama hookup (aynı sorter kullanarak)
    const sortableHeaders = container.querySelectorAll('th.sortable');
    sortableHeaders.forEach(th => {
        th.addEventListener('click', function() {
            const key = th.dataset.sortKey;
            if (!key) return;
            let direction = 'asc';
            if (queryResultSortState.key === key && queryResultSortState.direction === 'asc') {
                direction = 'desc';
            }
            queryResultSortState = { key, direction };
            queryResultData.sort((a, b) => {
                const va = getQueueSortValue(a, key);
                const vb = getQueueSortValue(b, key);
                if (typeof va === 'number' && typeof vb === 'number') {
                    return direction === 'asc' ? va - vb : vb - va;
                }
                const sa = String(va);
                const sb = String(vb);
                if (sa === sb) return 0;
                return direction === 'asc' ? (sa > sb ? 1 : -1) : (sa < sb ? 1 : -1);
            });
            renderQueryResults(queryResultData);
        });
    });
}

function exportQueryResultsToExcel() {
    const checkboxes = document.querySelectorAll('#queryResultListContainer .query-result-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-prolegal-id')).filter(Boolean);

    const source = (Array.isArray(currentQueryResultData) && currentQueryResultData.length > 0)
        ? currentQueryResultData
        : queryResultData;

    if (!Array.isArray(source) || source.length === 0) {
        TitleAlertMessage('⚠️ İndirilecek sorgu sonucu yok.', 'warning');
        return;
    }

    const exportSource = selectedIds.length
        ? source.filter(item => selectedIds.includes(String(item?.prolegal_id ?? item?.id ?? '')))
        : source;

    if (!exportSource.length) {
        TitleAlertMessage('⚠️ Seçili kayıt bulunamadı.', 'warning');
        return;
    }

    const rows = exportSource.map(item => ({
        id: item.prolegal_id || item.id || '',
        il: item.il || '',
        ilce: item.ilce || '',
        mahalle: item.mahalle || '',
        adaParsel: `${item.ada || ''}/${item.parsel || ''}`,
        nitelik: item.uygunluk_durumu || '',
        imarFonksiyon: item.imar_fonksiyon || '',
        durum: item.uygunluk_durumu || '',
        sorguDurumu: item.sorgulama_durumu || '',
        alan: item.alan || ''
    }));

    try {
        const columns = ['id', 'il', 'ilce', 'mahalle', 'adaParsel', 'sirket', 'konu', 'uygunluk'];
        const headers = ['Prolegal No', 'İl', 'İlçe', 'Mahalle', 'Ada/Parsel', 'Şirket', 'Konu', 'Uygunluk Durumu'];
        exportToExcel(rows, `sorgu_sonucu_${new Date().toISOString().slice(0,10)}.xlsx`, columns, headers);
    } catch (err) {
        console.error('❌ Excel dışa aktarım hatası:', err);
        TitleAlertMessage('❌ Excel oluşturulamadı.', 'danger');
    }
}
