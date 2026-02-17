/** FORM API HANDLER */

// Bölgeyi tara için filtreleme fonksiyonu
function filterRegionScanData(data) {
    console.log('🔍 Bölgeyi tara verileri filtreleniyor...');
    
    if (!data || !Array.isArray(data)) {
        console.log('❌ Geçersiz veri formatı');
        return [];
    }
    
    const filteredData = data.filter(item => {
        if (item.status !== 200 || !item.data || !item.data.properties) {
            return false;
        }
        
        const props = item.data.properties;
        
        // Hisse kontrolü - Sadece %100 tam hisse
        const hisse = props.hisse;
        if (hisse !== '100%') {
            console.log(`❌ Hisse filtresi: ${hisse} - ${props.ozet}`);
            return false;
        }
        
        // Nitelik kontrolü - Database'de zaten filtreleniyor, burada sadece log için kontrol ediyoruz
        const nitelik = props.nitelik;
        console.log(`✅ Nitelik: ${nitelik} - ${props.ozet}`);
        
        console.log(`✅ Geçti: ${props.ozet} (Hisse: ${hisse}, Nitelik: ${nitelik})`);
        return true;
    });
    
    console.log(`📊 Filtreleme sonucu: ${data.length} → ${filteredData.length} arazi`);
    return filteredData;
}

// Filtresiz tara için (yalnızca Tam Hisse) basit filtreleme
function filterRegionScanDataHisseOnly(data) {
    console.log('🔍 Filtresiz tara verileri (yalnızca Tam Hisse) filtreleniyor...');

    if (!data || !Array.isArray(data)) {
        console.log('❌ Geçersiz veri formatı');
        return [];
    }

    const filteredData = data.filter(item => {
        if (item.status !== 200 || !item.data || !item.data.properties) {
            return false;
        }

        const props = item.data.properties;
        return props.hisse === '100%';
    });

    console.log(`📊 (Filtresiz) Filtreleme sonucu: ${data.length} → ${filteredData.length} arazi`);
    return filteredData;
}

// TitleAlertMessage fonksiyonu ui.js'de tanımlı - burada kaldırıldı

function setWindowParam(key, value) {
    window[key] = value;
}

function getWindowParam(key) {
    return window[key];
}

const selectIl = document.querySelector('#select-il');
const ilceContainer = document.querySelector('#ilce-container');
const mahalleContainer = document.querySelector('#mahalle-container');
const inputAda = document.querySelector('#input-ada');
const inputParsel = document.querySelector('#input-parsel');
const btnSorgula = document.querySelector('#btn-sorgula');
const btnSorgulaPro = document.querySelector('#btn-sorgulaPro');
const btnTemizle = document.querySelector('#btn-temizle');

// Kontrol sekmesinde Prolegal ID ile durum etiketlerini karşılıklı temizle
const statusFilterIds = [
    'durumMusterisizBasvuru',
    'durumMusteriliBasvuru',
    'durumSorguda',
    'durumSirada',
    'durumSorgulandi',
    'durumUygun',
    'durumUygunDegil',
    'durumBasvurusuYapilmamisUygunlar'
];
const prolegalNoInput = document.getElementById('prolegalNo');
const statusFilterCheckboxes = statusFilterIds
    .map(id => document.getElementById(id))
    .filter(Boolean);

const clearStatusFilters = () => {
    statusFilterCheckboxes.forEach(cb => { cb.checked = false; });
};

if (prolegalNoInput && statusFilterCheckboxes.length) {
    // Sadece rakam kabul et; harf vs. girilirse temizle
    prolegalNoInput.addEventListener('input', () => {
        const digitsOnly = prolegalNoInput.value.replace(/\D+/g, '');
        if (prolegalNoInput.value !== digitsOnly) {
            prolegalNoInput.value = digitsOnly;
        }
    });

    // ID yazılırken seçili etiketleri temizle
    prolegalNoInput.addEventListener('input', () => {
        const hasValue = prolegalNoInput.value.trim() !== '';
        const anyChecked = statusFilterCheckboxes.some(cb => cb.checked);
        if (hasValue && anyChecked) {
            clearStatusFilters();
        }
    });

    // Etiket seçildiğinde varsa ID alanını temizle
    statusFilterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked && prolegalNoInput.value.trim() !== '') {
                prolegalNoInput.value = '';
            }
        });
    });
}

// İl bilgilerini yükle
fetch(IL_DATA).then(data => data.json()).then(result => {
    setWindowParam("data_iller", result);
    result.features.forEach(element => {
        selectIl.appendChild(
            createOption(
                element.properties.id,
                element.properties.text
            )
        )
    });
});


selectIl.addEventListener('change', async function(e) {
    const id = e.target.value;
    console.log('🌍 İl değişti:', id);

    clearCheckboxes(ilceContainer);
    clearCheckboxes(mahalleContainer);

    if (id == 0 || isNaN(id)) {
        // İl seçimi temizlendiyse imar fonksiyonları temizlendi
        return;
    }
    
    // YENİ İMAR FONKSİYON SİSTEMİ: Ana fonksiyonları yükle
    loadImarAnaFonksiyonlari(id, '', '').catch(error => {
        console.error('İmar ana fonksiyonları yüklenirken hata:', error);
    });

    console.log('📍 İlçeler yükleniyor...');
    const ilceler = await getJSON(ILCE_DATA(id));
    console.log('📍 İlçeler yüklendi:', ilceler?.features?.length || 0, 'adet');
    setWindowParam('data_ilceler', ilceler);

    ilceler.features.forEach((ilce) => {
        ilceContainer.appendChild(
            createCheckbox(
                ilce.properties.id,
                ilce.properties.text,
                'ilce'
            )
        );
    });

    const il = getWindowParam('data_iller').features.find(i => i.properties.id == id);
    window.dispatchEvent(new CustomEvent("SETMAP_COORDS", { detail: il }));
});

let selectedIlceler = new Set();

document.addEventListener('change', async function(e) {
    if (e.target.classList.contains('ilce-checkbox')) {
        const id = e.target.value;
        const isChecked = e.target.checked;

        if (id == 0 || isNaN(id)) return;

        if (isChecked) {
            selectedIlceler.add(id);
            // İlçe seçildiyse, mahallelerini ekle
            const mahalleler = await getJSON(MAHALLE_DATA(id));
            mahalleler.features.forEach((mahalle) => {
                if (!document.getElementById(`mahalle-${mahalle.properties.id}`)) {
                    mahalleContainer.appendChild(
                        createCheckbox(
                            mahalle.properties.id,
                            mahalle.properties.text,
                            'mahalle',
                            id
                        )
                    );
                }
            });
        } else {
            selectedIlceler.delete(id);
            // İlçe seçimi kaldırıldıysa, mahallelerini kaldır
            const mahalleElements = mahalleContainer.querySelectorAll(`.mahalle-checkbox[data-ilce="${id}"]`);
            mahalleElements.forEach(el => el.closest('.checkbox-card').remove());
        }

        // Seçili olmayan ilçelerin mahallelerini gizle
        document.querySelectorAll('.mahalle-checkbox').forEach(checkbox => {
            const ilceId = checkbox.getAttribute('data-ilce');
            checkbox.closest('.checkbox-card').style.display = selectedIlceler.has(ilceId) ? '' : 'none';
        });

        // YENİ İMAR FONKSİYON SİSTEMİ: Ana fonksiyonları güncelle
        const ilId = document.getElementById('select-il').value;
        const selectedIlceIds = Array.from(selectedIlceler);
        if (selectedIlceIds.length === 1) {
            await loadImarAnaFonksiyonlari(ilId, selectedIlceIds[0], '');
        } else if (selectedIlceIds.length > 1) {
            await loadImarAnaFonksiyonlari(ilId, '', '');
        }

        const ilce = getWindowParam('data_ilceler').features.find(i => i.properties.id == id);
        window.dispatchEvent(new CustomEvent("SETMAP_COORDS", { detail: ilce }));
    }

    if (e.target.classList.contains('mahalle-checkbox')) {
        const id = e.target.value;

        if (id == 0 || isNaN(id)) return;

        // İmar fonksiyonlarını güncelle
        const ilId = document.getElementById('select-il').value;
        const selectedIlceIds = Array.from(selectedIlceler);
        const selectedMahalleIds = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);
        
        if (selectedMahalleIds.length > 0) {
            // Çoklu mahalle seçimi için ana fonksiyonları yükle
            await loadImarAnaFonksiyonlari(ilId, selectedIlceIds.join(','), selectedMahalleIds.join(','));
        }

        const mahalle = getWindowParam('data_mahalleler').find(i => i.properties.id == id);
        window.dispatchEvent(new CustomEvent("SETMAP_COORDS", { detail: mahalle }));
    }
});

// ESKİ İMAR FONKSİYON SİSTEMİ KALDIRILDI - YENİ SİSTEM KULLANILIYOR

function clearMap() {
    STOPAREA();
    STOPDISTANCE();

    // Clear Areas
    Object.keys(Areas).forEach(key => {
        Areas[key].Amarkers.forEach((item) => {
            item.customClearEvents();
            item.setMap(null);
        });
        Areas[key].Amarkers = [];
        Areas[key].AhiddenMarkers.forEach((item) => {
            item.setMap(null);
        });
        Areas[key].AhiddenMarkers = [];
        if (Areas[key].Apolygon) {
            Areas[key].Apolygon.setMap(null);
            Areas[key].Apolygon = null;
        }
        if (Areas[key].AareaField) {
            Areas[key].AareaField.close();
            Areas[key].AareaField = null;
        }
        if (SearchMapItems[key].centerMarker) {
            SearchMapItems[key].centerMarker.setMap(null);
        }
    });
    Areas = {};

    // Clear Distances
    Object.keys(Distances).forEach(key => {
        Distances[key].Dmarkers.forEach((item) => {
            item.customClearEvents();
            item.setMap(null);
        });
        Distances[key].Dmarkers = [];
        Distances[key].DhiddenMarkers.forEach((item) => {
            item.setMap(null);
        });
        Distances[key].DhiddenMarkers = [];
        if (Distances[key].Dpolygon) {
            Distances[key].Dpolygon.setMap(null);
            Distances[key].Dpolygon = null;
        }
        if (Distances[key].infoMeters) {
            Distances[key].infoMeters.close();
            Distances[key].infoMeters = null;
        }
        Distances[key].windows.forEach(element => {
            element.close();
        });
        Distances[key].windows = [];
    });
    Distances = {};

    // Clear SearchMapItems
    Object.keys(SearchMapItems).forEach(key => {
        SearchMapItems[key].markers.forEach((marker) => {
            marker.setMap(null);
        });
        if (SearchMapItems[key].polygon) {
            SearchMapItems[key].polygon.setMap(null);
        }
        SearchMapItems[key].polys.forEach((p) => {
            p.setMap(null);
        });
        if (SearchMapItems[key].mainWindow) {
            SearchMapItems[key].mainWindow.setMap(null);
        }
        SearchMapItems[key].windows.forEach((p) => {
            p.setMap(null);
        });
        SearchMapItems[key].positionMarkers.forEach((p) => {
            p.setMap(null);
        });
        if (SearchMapItems[key].textMarker) {
            SearchMapItems[key].textMarker.setMap(null);
        }
        if (SearchMapItems[key].centerMarker) {
            SearchMapItems[key].centerMarker.setMap(null);
        }
    });
    SearchMapItems = {};
}
btnTemizle.addEventListener('click', async function() {
    console.log("Temizle butonu tıklandı - Sadece sonuçları temizliyorum");
    
    // Sadece sonuçları temizle, parametreleri koru
    clearMap(); // Haritadaki sonuçları temizle
    propertyData = []; // propertyData array'ini temizle
    syncPropertyDataGlobally();
    updateList([]); // Liste tablosunu temizle
    
    // Seçili parselleri de temizle
    selectedProperties = [];
    updateSelectedProperties();
    
    // Sorgu sayısını sıfırla
    const propertyCountElement = document.getElementById('property-count');
    if (propertyCountElement) {
        propertyCountElement.style.display = 'none';
    }
    
    console.log("✅ Sonuçlar temizlendi, parametreler korundu");
});
btnSorgula.addEventListener('click', async function() {
    console.log("Sorgula butonu tıklandı");

    // YENİ SORGU ÖNCESİ ESKİ SONUÇLARI TEMİZLE
    clearMap(); // Haritadaki eski sonuçları temizle
    propertyData = []; // propertyData array'ini temizle
    syncPropertyDataGlobally();
    updateList([]); // Liste tablosunu temizle
    
    // Seçili parselleri de temizle
    selectedProperties = [];
    updateSelectedProperties();

    // Butonun orijinal metnini saklayalım
    const originalButtonText = this.textContent;

    // Butonun metnini değiştirelim ve devre dışı bırakalım
    this.textContent = "Sorgulanıyor...";
    this.setAttribute('disabled', true);

    const il = document.getElementById('select-il').value;
    console.log("🔍 [DEBUG] İl değeri:", il);

    const selectedIlceler = Array.from(document.querySelectorAll('.ilce-checkbox:checked')).map(cb => cb.value); // İlçe ID'leri
    const selectedMahalleler = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);

    const ada = document.querySelector('#input-ada').value.trim();
    const parsel = document.querySelector('#input-parsel').value.trim();
    console.log("🔍 [DEBUG] Ada:", ada, "Parsel:", parsel);
    const nitelik = document.querySelector('#input-nitelik').value.trim();
    const turSecimi = document.querySelector('#turSecimi').value;
    const hisseDurumu = document.querySelector('#hisseDurumu').value;
    const sorgulamaDurumu = document.querySelector('#sorgulamaDurumu').value;
    console.log("🔍 [DEBUG] Frontend sorgulama durumu değeri:", sorgulamaDurumu);
    const tasinmazDetayValues = Array.from(document.querySelectorAll('#tasinmazDetayCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);

    // Arazi büyüklüğü değerlerini al ve boşsa default değerleri ata
    const araziMinInput = document.getElementById('araziMin');
    const araziMaxInput = document.getElementById('araziMax');
    const araziMin = araziMinInput?.value || '0'; // Boşsa 0
    const araziMax = araziMaxInput?.value || '600000'; // Boşsa 600000

    // ✅ İmar switch durumunu kontrol eyle
    const imarSwitch = document.getElementById('imarSwitch');
    const isImarSwitchActive = imarSwitch && imarSwitch.checked;
    
    console.log("🔍 [DEBUG] İmar switch element:", imarSwitch);
    console.log("🔍 [DEBUG] İmar switch durumu:", isImarSwitchActive);
    console.log("🔍 [DEBUG] İmar switch checked:", imarSwitch ? imarSwitch.checked : 'element bulunamadı');

    // ✅ Sadece ada/parsel sorgusu kontrolü
    const isOnlyAdaParselQuery = ada && parsel && !il && selectedIlceler.length === 0 && selectedMahalleler.length === 0;
    console.log("🔍 [DEBUG] Sadece ada/parsel sorgusu mu?", isOnlyAdaParselQuery);
    
    // ✅ Tüm parametreleri query string'e ekle
    const queryParams = new URLSearchParams();
    
    if (isOnlyAdaParselQuery) {
        // Sadece ada/parsel sorgusu - diğer parametreleri gönderme
        console.log("🔍 [DEBUG] Sadece ada/parsel parametreleri gönderiliyor");
        queryParams.append('ada', encodeURIComponent(ada));
        queryParams.append('parsel', encodeURIComponent(parsel));
    } else {
        // Normal sorgu - tüm parametreleri gönder
        console.log("🔍 [DEBUG] Normal sorgu - tüm parametreler gönderiliyor");
        queryParams.append('il', encodeURIComponent(il));
        queryParams.append('ilce', encodeURIComponent(selectedIlceler.join(',')));
        queryParams.append('mahalle', encodeURIComponent(selectedMahalleler.join(',')));
        queryParams.append('ada', encodeURIComponent(ada));
        queryParams.append('parsel', encodeURIComponent(parsel));
        queryParams.append('nitelik', encodeURIComponent(nitelik));
        queryParams.append('tasinmazDetay', encodeURIComponent(tasinmazDetayValues.join(',')));
        queryParams.append('araziMin', encodeURIComponent(araziMin));
        queryParams.append('araziMax', encodeURIComponent(araziMax));
        queryParams.append('turSecimi', encodeURIComponent(turSecimi));
        queryParams.append('hisseDurumu', encodeURIComponent(hisseDurumu));
        queryParams.append('sorgulama_durumu', encodeURIComponent(sorgulamaDurumu));
    }

    // ✅ İmar switch durumuna göre sorgu mantığı
    if (isImarSwitchActive) {
        console.log("🔍 [DEBUG] İmar switch açık - hem tapu_maliye hem de imar view sorgusu yapılacak");
        
        const selectedAnaFonksiyonlar = Array.from(document.querySelectorAll('.ana-fonksiyon-checkbox:checked'))
            .map(cb => cb.value);
        const selectedAltFonksiyonlar = Array.from(document.querySelectorAll('.alt-fonksiyon-checkbox:checked'))
            .map(cb => cb.value);

        console.log("🔍 [DEBUG] Seçilen ana fonksiyonlar:", selectedAnaFonksiyonlar);
        console.log("🔍 [DEBUG] Seçilen alt fonksiyonlar:", selectedAltFonksiyonlar);
        
        // Eğer hiç checkbox seçili değilse tüm imar durumları için sorgu yap
        if (selectedAnaFonksiyonlar.length === 0 && selectedAltFonksiyonlar.length === 0) {
            console.log("🔍 [DEBUG] Hiç checkbox seçili değil - tüm imar durumları için sorgu yapılacak");
            queryParams.append('imar_all_functions', 'true'); // Tüm imar fonksiyonları için sorgu
        } else {
            console.log("🔍 [DEBUG] Seçili checkbox'lar var - sadece seçili olanlar için sorgu yapılacak");
            queryParams.append('imar_all_functions', 'false'); // Sadece seçili olanlar için sorgu
        }
        
        // İmar parametrelerini ekle
        queryParams.append('ana_fonksiyon_id', encodeURIComponent(selectedAnaFonksiyonlar.join(',')));
        queryParams.append('alt_fonksiyon_id', encodeURIComponent(selectedAltFonksiyonlar.join(',')));
        queryParams.append('imar_switch_active', 'true'); // İmar switch açık olduğunu belirt
    } else {
        console.log("🔍 [DEBUG] İmar switch kapalı - sadece tapu_maliye sorgusu yapılacak");
        queryParams.append('imar_switch_active', 'false'); // İmar switch kapalı olduğunu belirt
    }

    try {
        console.log("API isteği gönderiliyor:", `${API_URL}?${queryParams.toString()}`);

        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            headers: { "Content-Type": "application/json" }
        });

        console.log("Response status:", response.status);

        // 414 hatasını özel olarak kontrol et
        if (response.status === 414) {
            throw new Error('Request-URI Too Long - 414');
        }

        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }

        const jsonResponse = await response.json();
        console.log("API Yanıtı:", jsonResponse);
        
        // İmar fonksiyonu debug
        if (jsonResponse && jsonResponse.length > 0) {
            console.log("🔍 İlk 3 kayıt için imarFonksiyon değerleri:");
            jsonResponse.slice(0, 3).forEach((item, index) => {
                console.log(`📋 Kayıt ${index + 1}:`, {
                    id: item.id,
                    imarFonksiyon: item.imarFonksiyon,
                    ana_fonksiyon_ad: item.ana_fonksiyon_ad,
                    alt_fonksiyon_ad: item.alt_fonksiyon_ad,
                    ana_fonksiyon_id: item.ana_fonksiyon_id,
                    alt_fonksiyon_id: item.alt_fonksiyon_id
                });
            });
        }

        updateList(jsonResponse);

        // Liste tabını aktif et
        const listTabButton = document.getElementById('nav-liste-tab'); 
        listTabButton.click();

        // Sadece gerçek parsel verisi olan kayıtları say
        const validResults = jsonResponse.filter(item => 
            item.data !== null && 
            item.status === 200 && 
            item.data.properties && 
            item.data.properties.id
        );
        const resultCount = validResults.length;
        console.log("Bulunan gayrimenkul sayısı:", resultCount);
        console.log("🔍 [DEBUG] Toplam response:", jsonResponse.length, "Geçerli kayıt:", resultCount);
        TitleAlertMessage(`✅ Bulunan Gayrimenkul sayısı: ${resultCount}`, 'success', 8);

        const propertyCountElement = document.getElementById('property-count');
        if (propertyCountElement) {
            propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul`;
        }

        const MAX_DISPLAYABLE_RESULTS = 8000; 

        if (resultCount > MAX_DISPLAYABLE_RESULTS) {
            TitleAlertMessage(`⚠️ Çok fazla veri! ${resultCount} sonuç bulundu. Lütfen filtreleri daraltarak daha az veri çekin. İlçe, Mahalle veya Arazi Büyüklüğü filtrelerini kullanabilirsiniz.`, 'danger', 10);
            // property-count'u güncelle
            const propertyCountElement = document.getElementById('property-count');
            if (propertyCountElement) {
                propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul (Çok fazla!)`;
                propertyCountElement.style.display = 'inline';
            }
            return; 
        }

        if (resultCount > 0) {
            jsonResponse.forEach(item => {
                if (item.status == 200) {
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                    checkToggleState();
                } else {
                    TitleAlertMessage(`⚠️ ${item.data.Message || 'Veri bulunamadı'}`, 'warning', 6);
                }
            });
        } else {
            TitleAlertMessage('⚠️ Veri bulunamadı', 'warning', 6);
        }
    } catch (err) {
        console.error("Error:", err);
        let errorMessage = 'Kritere göre veri bulunamadı (İlçe/Mahalle, Hisse ve Türü kontrol ediniz).';
        
        if (err.message === 'API yanıt vermedi') {
            errorMessage = 'API şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.';
        } else if (err.message.includes('Request-URI Too Long') || err.message.includes('414') || err.message.includes('URI Too Long') || err.message.includes('Too Long')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın. Özellikle İlçe, Mahalle ve Taşınmaz Detay filtrelerini azaltın.';
        } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın.';
        } else if (err.message.includes('Request-URI Too Long - 414')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın. Özellikle İlçe, Mahalle ve Taşınmaz Detay filtrelerini azaltın.';
        }
        
        TitleAlertMessage(`❌ ${errorMessage}`, 'danger', 10);
        const propertyCountElement = document.getElementById('property-count');
        if (propertyCountElement) {
            propertyCountElement.style.display = 'none';
        }
    } finally {
        this.textContent = originalButtonText;
        this.removeAttribute('disabled');
    }
});

btnSorgulaPro.addEventListener('click', async function() {
    console.log("Kontrol Sorgula butonu tıklandı");

    // YENİ SORGU ÖNCESİ ESKİ SONUÇLARI TEMİZLE
    clearMap(); // Haritadaki eski sonuçları temizle
    propertyData = []; // propertyData array'ini temizle
    syncPropertyDataGlobally();
    updateList([]); // Liste tablosunu temizle
    
    // Seçili parselleri de temizle
    selectedProperties = [];
    updateSelectedProperties();

    // Butonun orijinal metnini saklayalım
    const originalButtonText = this.textContent;

    // Butonun metnini değiştirelim ve devre dışı bırakalım
    this.textContent = "Sorgulanıyor...";
    this.setAttribute('disabled', true);

    // Prolegal Taşınmaz No alanı
    const prolegalNo = document.getElementById('prolegalNo').value.trim();

    // Durum checkbox'larını kontrol et
    const selectedDurumlar = []; // tapu_maliye.Durum için (Uygun, Uygun değil)
    const selectedSorguDurumlar = []; // sorgudurumu.sorgulama_durumu için (Sorguda, Sırada)
    const selectedBasvurular = [];
    
    console.log("🔍 Checkbox kontrolleri:");
    
    // Checkbox'ları kontrol et
    if (document.getElementById('durumMusterisizBasvuru') && document.getElementById('durumMusterisizBasvuru').checked) {
        selectedBasvurular.push('Küçük');
        console.log("✅ Müşterisiz başvuru seçili");
    }
    if (document.getElementById('durumMusteriliBasvuru') && document.getElementById('durumMusteriliBasvuru').checked) {
        selectedBasvurular.push('Büyük');
        console.log("✅ Müşterili başvuru seçili");
    }
    if (document.getElementById('durumSorguda') && document.getElementById('durumSorguda').checked) {
        selectedSorguDurumlar.push('Sorguda');
        console.log("✅ Sorguda seçili");
    }
    if (document.getElementById('durumSirada') && document.getElementById('durumSirada').checked) {
        selectedSorguDurumlar.push('Sırada');
        console.log("✅ Sırada seçili");
    }
    if (document.getElementById('durumSorgulandi') && document.getElementById('durumSorgulandi').checked) {
        selectedSorguDurumlar.push('Sorgulandı');
        console.log("✅ Sorgulandı seçili");
    }
    if (document.getElementById('durumUygun') && document.getElementById('durumUygun').checked) {
        selectedDurumlar.push('Uygun');
        console.log("✅ Uygun seçili");
    }
    if (document.getElementById('durumUygunDegil') && document.getElementById('durumUygunDegil').checked) {
        selectedDurumlar.push('Uygun değil');
        console.log("✅ Uygun değil seçili");
    }
    if (document.getElementById('durumBasvurusuYapilmamisUygunlar') && document.getElementById('durumBasvurusuYapilmamisUygunlar').checked) {
        selectedDurumlar.push('UYGUN_BASVURU_NULL');
        console.log("✅ Başvurusu yapılmamış uygunlar seçili");
    }
    
    // Not Rating filtreleme
    const selectedNotRatings = [];
    if (document.getElementById('notRatingOlumlu') && document.getElementById('notRatingOlumlu').checked) {
        selectedNotRatings.push('1');
        console.log("✅ Olumlu değerlendirme seçili");
    }
    if (document.getElementById('notRatingOlumsuz') && document.getElementById('notRatingOlumsuz').checked) {
        selectedNotRatings.push('0');
        console.log("✅ Olumsuz değerlendirme seçili");
    }
    
    // ✅ İmar switch durumunu kontrol et
    const imarSwitch = document.getElementById('imarSwitch');
    const isImarSwitchActive = imarSwitch && imarSwitch.checked;
    
    console.log("🔍 [DEBUG] İmar switch element:", imarSwitch);
    console.log("🔍 [DEBUG] İmar switch durumu:", isImarSwitchActive);
    console.log("🔍 [DEBUG] İmar switch checked:", imarSwitch ? imarSwitch.checked : 'element bulunamadı');

    // Yeni İmar Fonksiyonları filtresi (Ana/Alt fonksiyon) - sadece switch açıkken
    const selectedAnaFonksiyonlar = isImarSwitchActive ? Array.from(document.querySelectorAll('.ana-fonksiyon-checkbox:checked'))
        .map(cb => cb.value) : [];
    const selectedAltFonksiyonlar = isImarSwitchActive ? Array.from(document.querySelectorAll('.alt-fonksiyon-checkbox:checked'))
        .map(cb => cb.value) : [];
    
    // Eğer imar switch aktif ve hiç checkbox seçili değilse tüm imar durumları için sorgu yap
    const imarAllFunctions = isImarSwitchActive && selectedAnaFonksiyonlar.length === 0 && selectedAltFonksiyonlar.length === 0;
    
    console.log("🔍 [DEBUG] SORGU FİLTRELERİ:");
    console.log("📋 Seçili tapu durumları (tapu_maliye.Durum):", selectedDurumlar);
    console.log("📋 Seçili sorgu durumları (sorgudurumu.sorgulama_durumu):", selectedSorguDurumlar);
    console.log("📋 Seçili başvurular:", selectedBasvurular);
    console.log("📋 Seçili not_rating değerleri:", selectedNotRatings);
    console.log("📋 Seçili ana fonksiyonlar:", selectedAnaFonksiyonlar);
    console.log("📋 Seçili alt fonksiyonlar:", selectedAltFonksiyonlar);

    let queryParams;
    
    // Eğer Prolegal No varsa, sadece onunla sorgu yap 
    if (prolegalNo !== '') {
        queryParams = new URLSearchParams();
        queryParams.append('prolegalId', encodeURIComponent(prolegalNo));
    } else if (selectedDurumlar.length > 0 || selectedSorguDurumlar.length > 0 || selectedBasvurular.length > 0 || selectedNotRatings.length > 0 || selectedAnaFonksiyonlar.length > 0 || selectedAltFonksiyonlar.length > 0) {
        // Durum filtrelerine göre sorgula
        queryParams = new URLSearchParams();
        
        // tapu_maliye.Durum için durum parametresi
        if (selectedDurumlar.length > 0) {
            queryParams.append('durum', selectedDurumlar.join(','));
        }
        
        // sorgudurumu.sorgulama_durumu için sorgulama_durumu parametresi
        if (selectedSorguDurumlar.length > 0) {
            queryParams.append('sorgulama_durumu', selectedSorguDurumlar.join(','));
            console.log("🔍 [DEBUG] sorgulama_durumu parametresi eklendi:", selectedSorguDurumlar.join(','));
        }
        
        // Diğer parametreler
        if (selectedBasvurular.length > 0) {
            queryParams.append('basvuruDurumu', selectedBasvurular.join(','));
        }
        
        // ✅ Yeni İmar Fonksiyonları parametreleri - sadece switch açıkken
        if (isImarSwitchActive && selectedAnaFonksiyonlar.length > 0) {
            queryParams.append('anaFonksiyonId', selectedAnaFonksiyonlar.join(','));
            console.log("🔗 [DEBUG] Ana fonksiyon ID'leri eklendi:", selectedAnaFonksiyonlar.join(','));
        }
        if (isImarSwitchActive && selectedAltFonksiyonlar.length > 0) {
            queryParams.append('altFonksiyonId', selectedAltFonksiyonlar.join(','));
            console.log("🔗 [DEBUG] Alt fonksiyon ID'leri eklendi:", selectedAltFonksiyonlar.join(','));
        }
        
        if (!isImarSwitchActive) {
            console.log("🔍 [DEBUG] İmar switch kapalı - imar parametreleri gönderilmiyor");
        }
        if (selectedNotRatings.length > 0) {
            queryParams.append('notRating', selectedNotRatings.join(','));
        }
    } else {
        TitleAlertMessage('⚠️ Lütfen Prolegal Taşınmaz No giriniz veya en az bir durum filtresi seçiniz.', 'warning', 6);
        this.textContent = originalButtonText;
        this.removeAttribute('disabled');
        return;
    }

    try {
        console.log("API isteği gönderiliyor:", `${API_URL}?${queryParams.toString()}`);
        console.log('🔍 [DEBUG] Final queryParams:', queryParams.toString());

        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            headers: { "Content-Type": "application/json" }
        });

        console.log("Response status:", response.status);

        // 414 hatasını özel olarak kontrol et
        if (response.status === 414) {
            throw new Error('Request-URI Too Long - 414');
        }

        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }

        const jsonResponse = await response.json();
        console.log("API Yanıtı:", jsonResponse);
        
        // propertyData'yı güncelle
        propertyData = jsonResponse;
        syncPropertyDataGlobally();
        console.log('📊 propertyData güncellendi:', propertyData);
        
        // Liste tabını güncelle
        console.log('🔄 updateList çağrılıyor...');
        updateList(jsonResponse);
        
        // Liste tabına geç
        const listTabButton = document.getElementById('nav-liste-tab');
        if (listTabButton) {
            console.log('🔄 Liste tabına geçiliyor...');
            listTabButton.click();
        } else {
            console.error('❌ nav-liste-tab butonu bulunamadı!');
        }
        
        // Sadece gerçek parsel verisi olan kayıtları say
        const validResults = jsonResponse.filter(item => 
            item.data !== null && 
            item.status === 200 && 
            item.data.properties && 
            item.data.properties.id
        );
        const resultCount = validResults.length;
        console.log("Bulunan gayrimenkul sayısı:", resultCount);
        console.log("🔍 [DEBUG] Toplam response:", jsonResponse.length, "Geçerli kayıt:", resultCount);
        TitleAlertMessage(`✅ Bulunan Gayrimenkul sayısı: ${resultCount}`, 'success', 8);
        
        // Sayıyı gösterir
        const propertyCountElement = document.getElementById('property-count');
        if (propertyCountElement) {
            propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul`;
            propertyCountElement.style.display = 'inline';
        }

        const MAX_DISPLAYABLE_RESULTS = 8000; // Maksimum gösterilebilir sonuç sayısı

        if (resultCount > MAX_DISPLAYABLE_RESULTS) {
            TitleAlertMessage(`⚠️ Çok fazla veri! ${resultCount} sonuç bulundu. Lütfen filtreleri daraltarak daha az veri çekin. İlçe, Mahalle veya Arazi Büyüklüğü filtrelerini kullanabilirsiniz.`, 'danger', 10);
            // property-count'u güncelle
            const propertyCountElement = document.getElementById('property-count');
            if (propertyCountElement) {
                propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul (Çok fazla!)`;
                propertyCountElement.style.display = 'inline';
            }
            return; // İşlemi burada sonlandır
        }

        if (resultCount > 0) {
            jsonResponse.forEach(item => {
                if (item.status == 200) {
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                    checkToggleState();
                } else {
                    TitleAlertMessage(`⚠️ ${item.data.Message || 'Veri bulunamadı'}`, 'warning', 6);
                }
            });
        } else {
            TitleAlertMessage('⚠️ Veri bulunamadı', 'warning', 6);
        }
    } catch (err) {
        console.error("Error:", err);
        let errorMessage = 'Kritere göre veri bulunamadı.';
        
        if (err.message === 'API yanıt vermedi') {
            errorMessage = 'API şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.';
        } else if (err.message.includes('Request-URI Too Long') || err.message.includes('414') || err.message.includes('URI Too Long') || err.message.includes('Too Long')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın. Özellikle İlçe, Mahalle ve Taşınmaz Detay filtrelerini azaltın.';
        } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın.';
        } else if (err.message.includes('Request-URI Too Long - 414')) {
            errorMessage = '⚠️ Çok fazla filtre seçildi! URL çok uzun oldu. Lütfen filtreleri azaltın ve daha az seçim yapın. Özellikle İlçe, Mahalle ve Taşınmaz Detay filtrelerini azaltın.';
        }
        
        TitleAlertMessage(`❌ ${errorMessage}`, 'danger', 10);
    } finally {
        // İşlem tamamlandığında veya hata durumunda butonun orijinal metnini geri getirelim ve aktif hale getirelim
        this.textContent = originalButtonText;
        this.removeAttribute('disabled');
    }
});

document.getElementById('result-list').addEventListener('click', function(e) {
    const key = e.target.closest('tr').dataset.key;

    if (key && SearchMapItems[key]) {
        const item = SearchMapItems[key];
        if (item && item.polygon) {
            const bounds = new google.maps.LatLngBounds();
            const paths = item.polygon.getPath();
            paths.forEach((latLng) => {
                bounds.extend(latLng);
            });

            myMap.fitBounds(bounds);

            // Özel PL SVG ikonu
            const customIcon = {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="#3C9BB9" stroke="#FFFFFF" stroke-width="2"/>
                        <text x="20" y="25" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" text-anchor="middle" font-weight="bold">PL</text>
                    </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
            };

            // Poligonu vurgula
            const originalOptions = {
                strokeColor: item.polygon.get('strokeColor'),
                strokeWeight: item.polygon.get('strokeWeight'),
                strokeOpacity: item.polygon.get('strokeOpacity'),
                fillColor: item.polygon.get('fillColor'),
                fillOpacity: item.polygon.get('fillOpacity')
            };

            const originalFillColor = item.polygon.get('fillColor');
            item.polygon.setOptions({
                strokeColor: '#3C9BB9',
                strokeWeight: 3,
                strokeOpacity: 1,
                fillColor: originalFillColor, // Orijinal rengi koru
                fillOpacity: 0.1,
                zIndex: 1
            });

            const pathArray = paths.getArray();
            const markers = [];
            const animationLines = [];

            // Toplam animasyon süresi (ms cinsinden)
            const TOTAL_ANIMATION_TIME = 2500; // 2.5 saniye (0.5 saniye marj bırakıyoruz)
            
            // Köşe başına düşen süre
            const timePerCorner = TOTAL_ANIMATION_TIME / (pathArray.length + 2); // +2 for L-shape animation

            // Marker ve çizgi ekleme fonksiyonu
            function addMarkerAndLine(start, end, index, total) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        // Marker ekleme
                        const marker = new google.maps.Marker({
                            position: start,
                            map: myMap,
                            icon: customIcon,
                            opacity: 0,
                            zIndex: 3
                        });
                        markers.push(marker);

                        // Marker fade-in animasyonu
                        let opacity = 0;
                        const fadeIn = setInterval(() => {
                            opacity += 0.5;
                            marker.setOpacity(Math.min(opacity, 1));
                            if (opacity >= 1) {
                                clearInterval(fadeIn);
                                resolve();
                            }
                        }, timePerCorner / 4);

                        // Çizgi ekleme ve animasyon
                        const line = new google.maps.Polyline({
                            path: [start, start],
                            geodesic: true,
                            strokeColor: '#FFFFFF',
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            map: myMap,
                            zIndex: 2
                        });
                        animationLines.push(line);

                        let distance = 0;
                        const animate = setInterval(() => {
                            distance += 0.2;
                            const current = google.maps.geometry.spherical.interpolate(start, end, Math.min(distance, 1));
                            line.setPath([start, current]);
                            if (distance >= 1) {
                                clearInterval(animate);
                            }
                        }, timePerCorner / 10);
                    }, index * timePerCorner);
                });
            }

            // Sıralı animasyon
            async function animateSequentially() {
                const promises = [];
                for (let i = 0; i < pathArray.length; i++) {
                    const start = pathArray[i];
                    const end = pathArray[(i + 1) % pathArray.length];
                    promises.push(addMarkerAndLine(start, end, i, pathArray.length));
                }
                await Promise.all(promises);
                animatePolygonFill();
            }

            // Poligon dolgu animasyonu
            function animatePolygonFill() {
                let opacity = 0.1;
                const fadeInterval = setInterval(() => {
                    opacity += 0.2;
                    item.polygon.setOptions({ fillOpacity: Math.min(opacity, 0.3) });
                    if (opacity >= 0.3) {
                        clearInterval(fadeInterval);
                    }
                }, timePerCorner / 3);
            }

           
            // Animasyonları başlat
            const startTime = Date.now();
            animateSequentially();

            // 3 saniye sonra veya animasyon bitiminde (hangisi daha geç olursa) her şeyi eski haline döndür
            setTimeout(() => {
                const elapsedTime = Date.now() - startTime;
                const remainingTime = Math.max(0, 3000 - elapsedTime);
                
                setTimeout(() => {
                    markers.forEach(marker => {
                        marker.setMap(null);
                    });
                    animationLines.forEach(line => {
                        line.setMap(null);
                    });
                    item.polygon.setOptions(originalOptions);
                }, remainingTime);
            }, TOTAL_ANIMATION_TIME);
        }
    }
});

document.querySelectorAll('th[data-column]').forEach(header => {
    header.addEventListener('click', function() {
        const column = this.getAttribute('data-column');
        const order = this.getAttribute('data-order');
        const newOrder = order === 'desc' ? 'asc' : 'desc';
        this.setAttribute('data-order', newOrder);

        // Tüm başlıklardan sorted class'ını kaldır
        document.querySelectorAll('.sortable-header').forEach(h => {
            h.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
        });

        // Tıklanan başlığa sorted class'ını ekle
        this.classList.add('sorted', `sorted-${newOrder}`);

        // Verileri sıralamak için updateList fonksiyonunu çağırın
        sortTableData(column, newOrder);
    });
});

function parseTurkishNumber(value) {
    if (!value) return NaN;
    
    // Test için console log
    console.log(`🔢 Input: "${value}"`);
    
    // Basit ve güvenli parsing
    const cleaned = String(value)
        .replace(/\s|&nbsp;/g, '')        // boşluk + &nbsp; temizle
        .replace(/[^\d,.-]/g, '')         // sadece rakam, virgül, nokta, eksi bırak
        .replace(/\./g, '')               // binlik ayırıcıları kaldır (235.275 → 235275)
        .replace(',', '.');               // ondalık ayırıcısı (235275,00 → 235275.00)
    
    console.log(`🔢 Cleaned: "${cleaned}"`);
    
    const num = parseFloat(cleaned);
    console.log(`🔢 Final: ${num}`);
    
    return isNaN(num) ? NaN : num;
}

function sortTableData(column, order = 'asc') {
    try {
        const resultList = document.getElementById('result-list');
        if (!resultList) {
            console.warn('⚠️ result-list elementi bulunamadı');
            return;
        }

        const rows = Array.from(resultList.querySelectorAll('tr'));
        if (rows.length === 0) {
            console.warn('⚠️ Sıralanacak satır bulunamadı');
            return;
        }

        const columnIndex = getColumnIndex(column);
        if (columnIndex === -1) {
            console.warn(`⚠️ Geçersiz kolon indeksi: ${column}`);
            return;
        }

        const sortedRows = rows.sort((a, b) => {
            const aText = a.querySelector(`td:nth-child(${columnIndex})`)?.textContent?.trim() || '';
            const bText = b.querySelector(`td:nth-child(${columnIndex})`)?.textContent?.trim() || '';

            if (!aText && !bText) return 0;
            if (!aText) return 1;
            if (!bText) return -1;

            const aNum = parseTurkishNumber(aText);
            const bNum = parseTurkishNumber(bText);

            const aIsNum = !isNaN(aNum);
            const bIsNum = !isNaN(bNum);

            if (aIsNum && bIsNum) {
                return order === 'asc' ? aNum - bNum : bNum - aNum;
            }

            return order === 'asc'
                ? aText.localeCompare(bText, 'tr', { sensitivity: 'base' })
                : bText.localeCompare(aText, 'tr', { sensitivity: 'base' });
        });

        // propertyData sıralaması
        const oldPropertyData = Array.isArray(propertyData) ? [...propertyData] : [];
        propertyData = sortedRows.map(row => {
            try {
                const key = row.getAttribute('data-key');
                return oldPropertyData.find(item =>
                    item?.data?.properties &&
                    `${item.data.properties.mahalleId}/${item.data.properties.adaNo}/${item.data.properties.parselNo}` === key
                );
            } catch {
                return undefined;
            }
        }).filter(Boolean);
        syncPropertyDataGlobally();

        // DOM güncelleme
        resultList.innerHTML = '';
        sortedRows.forEach(row => resultList.appendChild(row));

        console.log(`✅ '${column}' kolonu ${order === 'asc' ? 'artan' : 'azalan'} şekilde sıralandı.`);
    } catch (err) {
        console.error('❌ Sıralama işlemi başarısız:', err);
    }
}


function getColumnIndex(column) {
    const columns = {
        'id': 2,
        'il': 3,
        'ilce': 4,
        'mahalle': 5,
        'ada': 6,
        'parsel': 7,
        'alan': 8,
        'nitelik': 9,
        'imarFonksiyon': 10,
        'durum': 11,
        'sorguDurumu': 12,
        'basvuru_turu': 13,
        'basvurulan_firma': 14
    };
    
    const index = columns[column];
    if (index === undefined) {
        console.warn(`⚠️ Kolon bulunamadı: ${column}`);
        return -1;
    }
    return index;
}

function updateList(data) {
    console.log('🔄 updateList çağrıldı');
    console.log('📊 Gelen veri:', data);
    console.log('📊 Veri uzunluğu:', data ? data.length : 'undefined');
    
    const resultList = document.getElementById('result-list');
    if (!resultList) {
        console.error('❌ result-list elementi bulunamadı!');
        return;
    }
    
    resultList.innerHTML = '';  // Önce mevcut içeriği temizleyin
    propertyData = data; // Tüm verileri orijinal yapısıyla sakla
    syncPropertyDataGlobally();

    // Varsayılan sıralama: İl -> İlçe -> Mahalle -> Ada/Parsel
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
            
            const aAda = String(aProps.adaNo || aProps.ada || aProps.AdaBilgisi || '');
            const bAda = String(bProps.adaNo || bProps.ada || bProps.AdaBilgisi || '');
            
            if (aAda !== bAda) return aAda.localeCompare(bAda);
            
            const aParsel = String(aProps.parselNo || aProps.parsel || aProps.ParselBilgisi || '');
            const bParsel = String(bProps.parselNo || bProps.parsel || bProps.ParselBilgisi || '');
            
            return aParsel.localeCompare(bParsel);
        } catch (error) {
            console.error('Sıralama hatası:', error, a, b);
            return 0;
        }
    });

    sortedData.forEach((item, index) => {
        try {
            const row = document.createElement('tr');
            
            // Veri yapısını kontrol et ve güvenli erişim sağla
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
            
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="form-check-input property-checkbox" data-id="${properties.id || ''}">
                </td>
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                <td>${properties.id || ''}</td>
                <td>${properties.ilAd || properties.il || ''}</td>
                <td>${properties.ilceAd || properties.ilce || ''}</td>
                <td>${properties.mahalleAd || properties.mahalle || ''}</td>
                <td>${ada}</td>
                <td>${parsel}</td>
                <td>${properties.alan || properties.YuzolcumBilgisi || ''}</td>
                <td>${properties.nitelik || properties.AnaTasinmazNitelik || ''}</td>
                <td>${properties.imarFonksiyon || ''}</td>
                <td>${properties.durum || properties.Durum || properties.tapu_durum || ''}</td>
                <td>${properties.sorguDurumu || properties.sorgulama_durumu || properties.Durum || properties.tapu_durum || ''}</td>
                <td>${properties.basvuru_turu || ''}</td>
                <td>${properties.basvurulan_firma || ''}</td>
            `;
            resultList.appendChild(row);
        } catch (error) {
            console.error('Satır oluşturulurken hata:', error, item);
        }
    });
    
    console.log('✅ Tabloya eklenen satır sayısı:', resultList.children.length);
    console.log('📊 result-list içeriği:', resultList.innerHTML.substring(0, 200) + '...');
    
    // Checkbox'lar için event listener'lar ekle
    resultList.querySelectorAll('.property-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // updateSelectedProperties fonksiyonunu çağır
            if (typeof updateSelectedProperties === 'function') {
                updateSelectedProperties();
            }
        });
    });
    
    // Layout refresh için küçük bir gecikme ekle
    setTimeout(() => {
        // Sol frame'in height'ını yeniden hesapla
        const leftSidebar = document.getElementById('left-sidebar-wrapper');
        const tabContent = document.querySelector('.nav-tabs-custom > .tab-content');
        const listeTab = document.getElementById('nav-liste');
        
        if (leftSidebar && tabContent && listeTab) {
            // Force layout recalculation
            leftSidebar.style.height = leftSidebar.offsetHeight + 'px';
            setTimeout(() => {
                leftSidebar.style.height = '';
                // Tab content'in height'ını yeniden hesapla
                tabContent.style.height = 'calc(100% - 50px)';
                // Liste tab'ının görünürlüğünü kontrol et
                if (listeTab.classList.contains('active')) {
                    listeTab.style.display = 'flex';
                }
            }, 10);
        }
    }, 50);
}

function createOption(value, title) {
    const op = document.createElement('option');
    op.textContent = title;
    op.value = value;
    return op;
}

function createCheckbox(value, label, type, ilceId = null) {
    const container = document.createElement('div');
    container.className = 'checkbox-card';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.id = `${type}-${value}`;
    checkbox.className = `${type}-checkbox`;
    if (ilceId) {
        checkbox.setAttribute('data-ilce', ilceId);
    }

    const labelElement = document.createElement('label');
    labelElement.htmlFor = `${type}-${value}`;
    labelElement.textContent = label;

    container.appendChild(checkbox);
    container.appendChild(labelElement);

    return container;
}

function clearCheckboxes(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

let playInterval;
let currentIndex = 0;
let isPaused = false;
let propertyData = []; // Tüm arazi verilerini tutacak dizi

// propertyData'nın güncel halini window üzerinden erişilebilir tut
function syncPropertyDataGlobally() {
    window.propertyData = propertyData;
}
syncPropertyDataGlobally();

document.getElementById('playButton').addEventListener('click', function() {
    if (this.innerHTML.includes('Oynat')) {
        startPlaying();
    } else if (this.innerHTML.includes('Duraklat')) {
        pausePlaying();
    } else {
        resumePlaying();
    }
});

document.getElementById('stopButton').addEventListener('click', stopPlaying);

function startPlaying() {
    document.getElementById('playButton').innerHTML = '<i class="fas fa-pause"></i> Duraklat';
    document.getElementById('stopButton').style.display = 'inline-block';
    document.getElementById('selectedPropertyInfo').style.display = 'block';
    
    const rows = document.querySelectorAll('#result-list tr');
    
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
    document.getElementById('playButton').innerHTML = '<i class="fas fa-play"></i> Oynat';
    document.getElementById('stopButton').style.display = 'none';
    document.getElementById('selectedPropertyInfo').style.display = 'none';
    currentIndex = 0;
    isPaused = false;
}

function pausePlaying() {
    clearInterval(playInterval);
    document.getElementById('playButton').innerHTML = '<i class="fas fa-play"></i> Devam Et';
    isPaused = true;
}

function resumePlaying() {
    startPlaying();
    isPaused = false;
}

document.getElementById('result-list').addEventListener('click', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    
    const index = row.rowIndex - 1; // thead'i hesaba katmak için -1
    if (index >= 0 && index < propertyData.length) {
const item = propertyData[index];
highlightAndZoomToPolygon(item.data);
updateSelectedPropertyInfo(item.data.properties);
    }
});

function highlightAndZoomToPolygon(item) {
    if (item && item.geometry) {
        const bounds = new google.maps.LatLngBounds();
        const paths = item.geometry.coordinates[0].map(coord => new google.maps.LatLng(coord[1], coord[0]));
        paths.forEach((latLng) => {
            bounds.extend(latLng);
        });

        myMap.fitBounds(bounds);

        // Mevcut animasyon fonksiyonunu çağır
        animatePolygon(paths, item.properties);
    }
}

function animatePolygon(paths, properties) {
    // Özel PL SVG ikonu
    const customIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="#3C9BB9" stroke="#FFFFFF" stroke-width="2"/>
                <text x="20" y="25" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" text-anchor="middle" font-weight="bold">PL</text>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        anchor: new google.maps.Point(15, 15)
    };

    // Poligonu oluştur
    const polygon = new google.maps.Polygon({
        paths: paths,
        strokeColor: '#3C9BB9',
        strokeWeight: 3,
        strokeOpacity: 1,
        fillColor: '#3C9BB9',
        fillOpacity: 0.1,
        map: myMap,
        zIndex: 1
    });

    const markers = [];
    const animationLines = [];

    // Toplam animasyon süresi (ms cinsinden)
    const TOTAL_ANIMATION_TIME = 2500; // 2.5 saniye
    
    // Köşe başına düşen süre
    const timePerCorner = TOTAL_ANIMATION_TIME / (paths.length + 2);

    // Marker ve çizgi ekleme fonksiyonu
    function addMarkerAndLine(start, end, index) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Marker ekleme
                const marker = new google.maps.Marker({
                    position: start,
                    map: myMap,
                    icon: customIcon,
                    opacity: 0,
                    zIndex: 3
                });
                markers.push(marker);

                // Marker fade-in animasyonu
                let opacity = 0;
                const fadeIn = setInterval(() => {
                    opacity += 0.1;
                    marker.setOpacity(Math.min(opacity, 1));
                    if (opacity >= 1) {
                        clearInterval(fadeIn);
                        resolve();
                    }
                }, timePerCorner / 10);

                // Çizgi ekleme ve animasyon
                const line = new google.maps.Polyline({
                    path: [start, start],
                    geodesic: true,
                    strokeColor: '#FFFFFF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    map: myMap,
                    zIndex: 2
                });
                animationLines.push(line);

                let distance = 0;
                const animate = setInterval(() => {
                    distance += 0.1;
                    const current = google.maps.geometry.spherical.interpolate(start, end, Math.min(distance, 1));
                    line.setPath([start, current]);
                    if (distance >= 1) {
                        clearInterval(animate);
                    }
                }, timePerCorner / 10);
            }, index * timePerCorner);
        });
    }

    // Sıralı animasyon
    async function animateSequentially() {
        const promises = [];
        for (let i = 0; i < paths.length; i++) {
            const start = paths[i];
            const end = paths[(i + 1) % paths.length];
            promises.push(addMarkerAndLine(start, end, i));
        }
        await Promise.all(promises);
        animatePolygonFill();
    }

    // Poligon dolgu animasyonu
    function animatePolygonFill() {
        let opacity = 0.1;
        const fadeInterval = setInterval(() => {
            opacity += 0.05;
            polygon.setOptions({ fillOpacity: Math.min(opacity, 0.3) });
            if (opacity >= 0.3) {
                clearInterval(fadeInterval);
            }
        }, timePerCorner / 3);
    }

    // Animasyonları başlat
    animateSequentially();

    // 3 saniye sonra temizle
    setTimeout(() => {
        markers.forEach(marker => marker.setMap(null));
        animationLines.forEach(line => line.setMap(null));
        polygon.setMap(null);
    }, TOTAL_ANIMATION_TIME + 500);
}

function updateSelectedPropertyInfo(properties) {
        console.log("Güncellenen properties: ", properties); // Bu satırı ekleyin

    document.getElementById('selectedPropertyInfo').style.display = 'block';
    document.getElementById('info-id').textContent = properties.id || 'Bilgi yok';
    document.getElementById('info-il').textContent = properties.ilAd || 'Bilgi yok';
    document.getElementById('info-ilce').textContent = properties.ilceAd || 'Bilgi yok';
    document.getElementById('info-mahalle').textContent = properties.mahalleAd || 'Bilgi yok';
    document.getElementById('info-nitelik').textContent = properties.nitelik || 'Bilgi yok';
    document.getElementById('info-alan').textContent = properties.alan || 'Bilgi yok';
}
let allowMapZoom = true; // Haritanın otomatik yakınlaşmasını kontrol etmek için

document.getElementById('scan-region-btn').addEventListener('click', async function() {
    console.log('Bölgeyi Tara butonu tıklandı.');
    if (window.startHeaderLoading) window.startHeaderLoading();
    allowMapZoom = false; // Bu tıklama ile fitBounds devre dışı

    // Filtreleri varsayılan değerlere ayarla (Uygun Araziler + Tam Hisse)
    if (typeof window.setDefaultFiltersForScan === 'function') {
        window.setDefaultFiltersForScan();
    }

    // Butonu devre dışı bırak ve sorgulama işlemi başladığını belirt
    this.textContent = 'Sorgulanıyor...';
    this.setAttribute('disabled', true);

    // Harita sınırlarını al (Görünür alanın sınırları)
    const bounds = myMap.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

            // Bu koordinatlarla sorguyu başlat
            const queryParams = new URLSearchParams({
                ne_lat: ne.lat(),
                ne_lng: ne.lng(),
                sw_lat: sw.lat(),
                sw_lng: sw.lng()
            });

    try {
        // API'ye GET isteği yap
        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error('API isteği başarısız oldu');
        }

        const data = await response.json();
        console.log('API Yanıtı:', data);

        // Filtreleme fonksiyonu - Sadece %100 hisse ve Uygun Araziler
        const filteredData = filterRegionScanData(data);
        console.log('Filtrelenmiş veri:', filteredData);

        // Gelen sonuçları haritada göster
        if (filteredData.length > 0) {
            filteredData.forEach(item => {
                if (item.status === 200) {
                    // Polygon verisi mevcutsa haritaya çiz
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                }
            });
            
            // Sonuçları liste görünümünde güncelle
            updateList(filteredData);
            
            // Sonuç sayısını göster
            const resultCount = filteredData.length;
            TitleAlertMessage(`Bulunan Gayrimenkul sayısı: ${resultCount}`, 'success');
            
            const propertyCountElement = document.getElementById('property-count');
            if (propertyCountElement) {
            propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul`;
            }

            // Liste sekmesine geç
            document.getElementById('nav-liste-tab').click();
        } else {
            TitleAlertMessage('Seçilen bölgede veri bulunamadı.', 'warning');
        }
    } catch (err) {
        console.error('Hata:', err);
        TitleAlertMessage('Sorgu sırasında bir hata oluştu. Lütfen tekrar deneyin.', 'danger');
    } finally {
        if (window.stopHeaderLoading) window.stopHeaderLoading();
        // Butonu tekrar aktif hale getir
        this.textContent = 'Bölgeyi Tara';
        this.removeAttribute('disabled');
    }
});

// "Filtresiz Tara" butonu: Sadece Tam Hisse filtresi uygular, UI varsayılanlarını değiştirmez
document.getElementById('scan-region-nofilter-btn')?.addEventListener('click', async function() {
    console.log('Filtresiz Tara butonu tıklandı.');
    allowMapZoom = false;
    if (window.startHeaderLoading) window.startHeaderLoading();

    const originalText = this.textContent;
    this.textContent = 'Sorgulanıyor...';
    this.setAttribute('disabled', true);

    const bounds = myMap.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const queryParams = new URLSearchParams({
        ne_lat: ne.lat(),
        ne_lng: ne.lng(),
        sw_lat: sw.lat(),
        sw_lng: sw.lng()
    });

    // API tarafında tür filtresinin kaldırılmasını belirt
    queryParams.append('filtresiz', '1');

    try {
        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('API isteği başarısız oldu');

        const data = await response.json();
        console.log('API Yanıtı (filtresiz):', data);

        // Yalnızca %100 hisseyi geçir
        const filteredData = filterRegionScanDataHisseOnly(data);

        if (filteredData.length > 0) {
            filteredData.forEach(item => {
                if (item.status === 200) {
                    window.dispatchEvent(new CustomEvent('SETMAP_FIELD', { detail: item.data }));
                }
            });

            updateList(filteredData);

            const resultCount = filteredData.length;
            TitleAlertMessage(`Bulunan Gayrimenkul sayısı: ${resultCount}`, 'success');

            const propertyCountElement = document.getElementById('property-count');
            if (propertyCountElement) {
                propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul`;
            }

            document.getElementById('nav-liste-tab').click();
        } else {
            TitleAlertMessage('Seçilen bölgede veri bulunamadı.', 'warning');
        }
    } catch (err) {
        console.error('Hata (filtresiz):', err);
        TitleAlertMessage('Sorgu sırasında bir hata oluştu. Lütfen tekrar deneyin.', 'danger');
    } finally {
        if (window.stopHeaderLoading) window.stopHeaderLoading();
        this.textContent = originalText || 'Filtresiz Tara';
        this.removeAttribute('disabled');
    }
});

window.addEventListener('SETMAP_COORDS', e => {
    storeItems.forEach(item => {
        item.setMap(null);
    });

    storeItems.length = 0;

    if (!e.detail.geometry) return;

    const coordinates = e.detail.geometry.coordinates;
    const bounds = new google.maps.LatLngBounds();

    for (let i = 0; i < coordinates.length; i++) {
        const polygon = e.detail.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

        const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
        const center = MAPHELPER.getCenter(triangleCoords);
        // Poligonu oluştur
        const bermudaTriangle = new google.maps.Polygon({
            clickable: false,
            paths: triangleCoords,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillOpacity: 0, // İç dolgusunun opaklığını 0 olarak ayarla
            fillColor: null // İç dolgunun rengini null olarak ayarla
        });
        bermudaTriangle.setMap(myMap);
        storeItems.push(bermudaTriangle);

        // Her üçgenin sınırlarını bounds'a ekleyin
        triangleCoords.forEach(coord => {
            bounds.extend(coord);
        });

        // PL Logolu Marker oluşturmak
        const customSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                <path fill="#4285F4" d="M18 0C8.1 0 0 8.1 0 18c0 7.9 5.8 14.5 13.4 15.8L18 48l4.6-14.2C30.2 32.5 36 25.9 36 18c0-9.9-8.1-18-18-18z"/>
                <circle cx="18" cy="18" r="12" fill="#FFF"/>
                <text x="18" y="23" font-family="Arial" font-size="14" fill="#4285F4" text-anchor="middle" font-weight="bold">PL</text>
            </svg>
        `;
        const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(customSVG);

        const plMarker = new google.maps.Marker({
            position: center,
            map: myMap,
            icon: {
                url: svgUrl,
                scaledSize: new google.maps.Size(36, 48),
                anchor: new google.maps.Point(18, 48),
            }
        });

        storeItems.push(plMarker); // Marker'ı sakla
    }

    // Eğer allowMapZoom true ise harita yakınlaştırılır
    if (allowMapZoom) {
        myMap.fitBounds(bounds);
    }
    return;
});

window.addEventListener('SETMAP_FIELD', e => {
    console.log("🎯 SETMAP_FIELD event alındı!", e.detail);
    
    if (!e.detail.geometry) {
        console.log("❌ Geometry yok, event iptal ediliyor");
        return;
    }

    const key = `${e.detail.properties.mahalleId}/${e.detail.properties.adaNo}/${e.detail.properties.parselNo}`;
    console.log("🔑 Key:", key);

    if (SearchMapItems[key]) {
        console.log("⚠️ Bu key zaten mevcut, atlanıyor");
        return;
    }

    SearchMapItems[key] = {
        data: e.detail,
        polygon: null,
        markers: [],
        polys: [],
        mainWindow: null,
        windows: [],
        positionMarkers: [],
        selectedPositionInfo: null,
        textMarker: null,
        centerMarker: null
    }

    const coordinates = e.detail.geometry.coordinates;
    
    // Coordinates null check
    if (!coordinates || !Array.isArray(coordinates)) {
        console.error('❌ Coordinates null veya array değil:', coordinates);
        return;
    }
    
    const bounds = new google.maps.LatLngBounds();

    for (let i = 0; i < coordinates.length; i++) {
        const polygon = e.detail.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

        const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
        const center = MAPHELPER.getCenter(triangleCoords);
        
        // VERİTABANI DEĞER ANALİZİ
        console.log("🚀 SETMAP_FIELD event tetiklendi!");
        console.log("🎯 Arazi properties:", e.detail.properties);
        console.log("📋 DURUM değerleri analizi:");
        console.log("   - basvuru_sayısı:", `'${e.detail.properties.basvuru_sayısı}'`);
        console.log("   - basvurulan_firma:", `'${e.detail.properties.basvurulan_firma}'`);
        console.log("   - basvuru_turu:", `'${e.detail.properties.basvuru_turu}'`);
        console.log("   - durum (tapu_maliye):", `'${e.detail.properties.durum}'`);
        console.log("🚨 BAŞVURU TÜRÜ BOŞ MU?:", e.detail.properties.basvuru_turu === undefined || e.detail.properties.basvuru_turu === null || e.detail.properties.basvuru_turu === '');
        
        let fillColor = "#ff0000"; // Default kırmızı
        
        const basvuru_turu = e.detail.properties.basvuru_turu;
        const tapu_durum = e.detail.properties.durum;
        
        console.log("📊 Durum kontrolü:", {basvuru_turu, tapu_durum});
        
        // SADECE BAŞVURU TÜRÜ KONTROLÜ - EN YÜKSEK ÖNCELİK
        if (basvuru_turu === 'Küçük') {
            fillColor = "#FF8C00"; // TURUNCU - Müşterisiz Başvuru
            console.log("🟠 MÜŞTERİSİZ BAŞVURU tespit edildi - TURUNCU renk");
        } else if (basvuru_turu === 'Büyük') {
            fillColor = "#FFED4E"; // SARI - Müşterili Başvuru
            console.log("🟡 MÜŞTERİLİ BAŞVURU tespit edildi - SARI renk");
        } 
        // SORGUDA DURUMU KONTROLÜ
        else if (tapu_durum === 'Sorguda') {
            fillColor = "#00732F"; // YEŞİL
            console.log("🔍 SORGUDA durumu tespit edildi - YEŞİL renk");
        }
        // SIRADA DURUMU kontrol 
        else if (tapu_durum === 'Sırada') {
            fillColor = "#808080"; // GRİ
            console.log("📋 SIRADA durumu tespit edildi - GRİ renk");
        }
        // DİĞER DURUMLAR İÇİN MEVCUT RENKLERİ KORU
        else if (tapu_durum === 'Uygun') {
            fillColor = "#004CFF"; // MAVİ
            console.log("✅ UYGUN durumu tespit edildi - MAVİ renk");
        } else if (tapu_durum === 'Uygun değil') {
            fillColor = "#732982"; // MOR
            console.log("❌ UYGUN DEĞİL durumu tespit edildi - MOR renk");
        } else {
            console.log("❓ Default kırmızı:", {basvuru_turu, tapu_durum});
        }
        
        console.log("🎨 Final renk:", fillColor);
        
        // Poligonu oluştur
        console.log("🔧 Poligon oluşturuluyor...", {fillColor, triangleCoords: triangleCoords.length});
        SearchMapItems[key].polygon = new google.maps.Polygon({
            paths: triangleCoords,
            strokeWeight: 2,
            fillColor: fillColor,
            fillOpacity: 0.35,
        });

        console.log("🗺️ Poligon haritaya ekleniyor...", {myMap: !!myMap});
        SearchMapItems[key].polygon.setMap(myMap);
        console.log("✅ Poligon haritaya eklendi!");
        google.maps.event.addListener(SearchMapItems[key].polygon, 'click', function(event) {
            setPanel(e.detail);
            modal('#info-modal', true);

            // Seçili parsel anahtarını globalde sakla ve Firmaya Ekle satırını güncelle
            window.currentParcelKey = e.detail.properties.id;
            updateFirmayaEkleCheckbox(window.currentParcelKey);
        });

        // PL Logolu Marker - Dinamik Renk
        const customSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                <path fill="${fillColor}" d="M18 0C8.1 0 0 8.1 0 18c0 7.9 5.8 14.5 13.4 15.8L18 48l4.6-14.2C30.2 32.5 36 25.9 36 18c0-9.9-8.1-18-18-18z"/>
                <circle cx="18" cy="18" r="12" fill="#FFF"/>
                <text x="18" y="23" font-family="Arial" font-size="14" fill="${fillColor}" text-anchor="middle" font-weight="bold">PL</text>
            </svg>
        `;
        const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(customSVG);

        const plMarker = new google.maps.Marker({
            position: center,
            map: myMap,
            icon: {
                url: svgUrl,
                scaledSize: new google.maps.Size(36, 48),
                anchor: new google.maps.Point(18, 48),
            }
        });

        SearchMapItems[key].centerMarker = plMarker;

        triangleCoords.forEach(coord => {
            bounds.extend(coord);
        });
    }

    // Eğer `allowMapZoom` true ise yakınlaştırma yapılır
    if (allowMapZoom) {
        myMap.fitBounds(bounds);
    }
});

// ===================================================================================
// İMAR FONKSİYONLARI OPTİMİZE EDİLMİŞ SİSTEM - vw_imar_filtre KULLANIMI
// ===================================================================================

// Ana fonksiyonları yükle (İl/İlçe/Mahalle değişiminde çağrılır)
async function loadImarAnaFonksiyonlari(ilId = '', ilceId = '', mahalleId = '') {
    try {
        console.log('🏗️ [DEBUG] İmar ana fonksiyonları yükleniyor:', { ilId, ilceId, mahalleId });
        
        const params = new URLSearchParams({ 
            action: 'get_imar_ana_fonksiyonlari' 
        });
        
        if (ilId) params.append('il_id', ilId);
        if (ilceId) params.append('ilce_id', ilceId);
        if (mahalleId) params.append('mahalle_id', mahalleId);
        
        const apiUrl = `./api.php?${params}`;
        console.log('🌐 [DEBUG] API URL:', apiUrl);
        
        const startTime = performance.now();
        const response = await fetch(apiUrl);
        const endTime = performance.now();
        
        console.log(`⏱️ [DEBUG] API Response Time: ${(endTime - startTime).toFixed(2)}ms`);
        console.log('📡 [DEBUG] Response Status:', response.status);
        
        if (!response.ok) {
            console.error('❌ [DEBUG] API Error:', response.status, response.statusText);
            throw new Error(`API Error: ${response.status}`);
        }
        
        const anaFonksiyonlar = await response.json();
        console.log('📋 [DEBUG] Gelen ana fonksiyonlar:', anaFonksiyonlar);
        console.log('📊 [DEBUG] Ana fonksiyon sayısı:', anaFonksiyonlar.length);
        
        const container = document.getElementById('anaFonksiyonCheckboxes');
        if (container) {
            console.log('🎨 [DEBUG] Ana fonksiyon container bulundu, checkbox\'lar oluşturuluyor...');
            container.innerHTML = '';
            
            anaFonksiyonlar.forEach((fonksiyon, index) => {
                const checkboxCard = document.createElement('div');
                checkboxCard.className = 'checkbox-card';
                checkboxCard.innerHTML = `
                    <input type="checkbox" id="ana_${index}" class="form-check-input ana-fonksiyon-checkbox" 
                           value="${fonksiyon.id}" data-name="${fonksiyon.name}">
                    <label for="ana_${index}" class="form-check-label">${fonksiyon.name}</label>
                `;
                container.appendChild(checkboxCard);
                console.log(`✅ [DEBUG] Ana fonksiyon checkbox eklendi: ${fonksiyon.name} (ID: ${fonksiyon.id})`);
            });
            
            console.log('🔗 [DEBUG] Ana fonksiyon event listener\'lar kuruluyor...');
            // Ana fonksiyon değiştiğinde alt fonksiyonları yükle
            setupAnaFonksiyonChangeListener();
            setupAnaFonksiyonSearch();
        } else {
            console.error('❌ [DEBUG] Ana fonksiyon container bulunamadı!');
        }
        
        // Alt fonksiyonları temizle
        const altContainer = document.getElementById('altFonksiyonCheckboxes');
        if (altContainer) {
            altContainer.innerHTML = '';
            console.log('🧹 [DEBUG] Alt fonksiyonlar temizlendi');
        }
        
        console.log('✅ [DEBUG] Ana fonksiyonlar başarıyla yüklendi');
        
    } catch (error) {
        console.error('❌ [DEBUG] İmar ana fonksiyonları yüklenirken hata:', error);
        console.error('❌ [DEBUG] Hata detayı:', error.message);
    }
}

// Alt fonksiyonları yükle (Ana fonksiyon seçimine göre)
async function loadImarAltFonksiyonlari(ilId = '', ilceId = '', mahalleId = '', anaFonksiyonId = '') {
    try {
        console.log('🏗️ [DEBUG] İmar alt fonksiyonları yükleniyor:', { ilId, ilceId, mahalleId, anaFonksiyonId });
        
        const params = new URLSearchParams({ 
            action: 'get_imar_alt_fonksiyonlari' 
        });
        
        if (ilId) params.append('il_id', ilId);
        if (ilceId) params.append('ilce_id', ilceId);
        if (mahalleId) params.append('mahalle_id', mahalleId);
        if (anaFonksiyonId) params.append('ana_fonksiyon_id', anaFonksiyonId);
        
        const apiUrl = `./api.php?${params}`;
        console.log('🌐 [DEBUG] Alt fonksiyon API URL:', apiUrl);
        
        const startTime = performance.now();
        const response = await fetch(apiUrl);
        const endTime = performance.now();
        
        console.log(`⏱️ [DEBUG] Alt fonksiyon API Response Time: ${(endTime - startTime).toFixed(2)}ms`);
        console.log('📡 [DEBUG] Alt fonksiyon Response Status:', response.status);
        
        if (!response.ok) {
            console.error('❌ [DEBUG] Alt fonksiyon API Error:', response.status, response.statusText);
            throw new Error(`Alt Fonksiyon API Error: ${response.status}`);
        }
        
        const altFonksiyonlar = await response.json();
        console.log('📋 [DEBUG] Gelen alt fonksiyonlar:', altFonksiyonlar);
        console.log('📊 [DEBUG] Alt fonksiyon sayısı:', altFonksiyonlar.length);
        
        const container = document.getElementById('altFonksiyonCheckboxes');
        if (container) {
            container.innerHTML = '';
            
            altFonksiyonlar.forEach((fonksiyon, index) => {
                const checkboxCard = document.createElement('div');
                checkboxCard.className = 'checkbox-card';
                checkboxCard.innerHTML = `
                    <input type="checkbox" id="alt_${index}" class="form-check-input alt-fonksiyon-checkbox" 
                           value="${fonksiyon.id}" data-name="${fonksiyon.name}">
                    <label for="alt_${index}" class="form-check-label">${fonksiyon.name}</label>
                `;
                container.appendChild(checkboxCard);
            });
            
            setupAltFonksiyonSearch();
        }
        
    } catch (error) {
        console.error('❌ İmar alt fonksiyonları yüklenirken hata:', error);
    }
}

// Ana fonksiyon değiştiğinde alt fonksiyonları yükle
function setupAnaFonksiyonChangeListener() {
    // Önceki event listener'ları temizle
    const existingCheckboxes = document.querySelectorAll('.ana-fonksiyon-checkbox');
    existingCheckboxes.forEach(checkbox => {
        checkbox.removeEventListener('change', handleAnaFonksiyonChange);
    });
    
    const anaCheckboxes = document.querySelectorAll('.ana-fonksiyon-checkbox');
    
    anaCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleAnaFonksiyonChange);
    });
}

// Ana fonksiyon değişim handler'ı
async function handleAnaFonksiyonChange() {
    console.log('🔄 [DEBUG] Ana fonksiyon değişti:', this.checked, this.value);
    
    // İl/İlçe/Mahalle bilgilerini al
    const ilSelect = document.getElementById('select-il');
    const ilceContainer = document.getElementById('ilce-container');
    const mahalleContainer = document.getElementById('mahalle-container');
    
    const ilId = ilSelect ? ilSelect.value : '';
    const ilceIds = Array.from(ilceContainer.querySelectorAll('input:checked'))
        .map(input => input.value).join(',');
    const mahalleIds = Array.from(mahalleContainer.querySelectorAll('input:checked'))
        .map(input => input.value).join(',');
    
    // Seçili ana fonksiyonları al
    const selectedAnaFonksiyonlar = Array.from(document.querySelectorAll('.ana-fonksiyon-checkbox:checked'))
        .map(cb => cb.value).join(',');
    
    console.log('🔍 [DEBUG] Alt fonksiyonlar için parametreler:', {
        ilId, ilceIds, mahalleIds, selectedAnaFonksiyonlar
    });
    
    if (selectedAnaFonksiyonlar) {
        await loadImarAltFonksiyonlari(ilId, ilceIds, mahalleIds, selectedAnaFonksiyonlar);
    } else {
        // Ana fonksiyon seçimi kaldırıldıysa alt fonksiyonları temizle
        const altContainer = document.getElementById('altFonksiyonCheckboxes');
        if (altContainer) {
            altContainer.innerHTML = '';
            console.log('🧹 [DEBUG] Alt fonksiyonlar temizlendi (ana fonksiyon seçimi kaldırıldı)');
        }
    }
}

// Ana fonksiyon arama
function setupAnaFonksiyonSearch() {
    const searchInput = document.getElementById('anaFonksiyonSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const checkboxes = document.querySelectorAll('.ana-fonksiyon-checkbox');
        
        checkboxes.forEach(checkbox => {
            const label = checkbox.nextElementSibling;
            const text = label.textContent.toLowerCase();
            const card = checkbox.closest('.checkbox-card');
            
            if (text.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Alt fonksiyon arama
function setupAltFonksiyonSearch() {
    const searchInput = document.getElementById('altFonksiyonSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const checkboxes = document.querySelectorAll('.alt-fonksiyon-checkbox');
        
        checkboxes.forEach(checkbox => {
            const label = checkbox.nextElementSibling;
            const text = label.textContent.toLowerCase();
            const card = checkbox.closest('.checkbox-card');
            
            if (text.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// İl/İlçe/Mahalle değiştiğinde ana fonksiyonları yükleyen ek listener'lar kaldırıldı
// (İl, ilçe ve mahalle için imar fonksiyon çağrıları yukarıdaki change handler'larında zaten yapılıyor)
document.addEventListener('DOMContentLoaded', function() {
    const ilSelect = document.getElementById('select-il');
    const ilceContainer = document.getElementById('ilce-container');
    const mahalleContainer = document.getElementById('mahalle-container');
    
    // Ana fonksiyon butonları
    const selectAllAnaBtn = document.getElementById('selectAllAnaFonksiyon');
    const clearAnaBtn = document.getElementById('clearAnaFonksiyon');
    
    if (selectAllAnaBtn) {
        selectAllAnaBtn.addEventListener('click', function() {
            document.querySelectorAll('.ana-fonksiyon-checkbox').forEach(checkbox => {
                checkbox.checked = true;
            });
            // Alt fonksiyonları yeniden yükle
            const ilId = ilSelect ? ilSelect.value : '';
            const ilceIds = Array.from(ilceContainer.querySelectorAll('input:checked'))
                .map(input => input.value).join(',');
            const mahalleIds = Array.from(mahalleContainer.querySelectorAll('input:checked'))
                .map(input => input.value).join(',');
            const selectedAnaFonksiyonlar = Array.from(document.querySelectorAll('.ana-fonksiyon-checkbox:checked'))
                .map(cb => cb.value).join(',');
            
            loadImarAltFonksiyonlari(ilId, ilceIds, mahalleIds, selectedAnaFonksiyonlar);
        });
    }
    
    if (clearAnaBtn) {
        clearAnaBtn.addEventListener('click', function() {
            document.querySelectorAll('.ana-fonksiyon-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            // Alt fonksiyonları temizle
            const altContainer = document.getElementById('altFonksiyonCheckboxes');
            if (altContainer) {
                altContainer.innerHTML = '';
            }
        });
    }
    
    // Alt fonksiyon butonları
    const selectAllAltBtn = document.getElementById('selectAllAltFonksiyon');
    const clearAltBtn = document.getElementById('clearAltFonksiyon');
    
    if (selectAllAltBtn) {
        selectAllAltBtn.addEventListener('click', function() {
            document.querySelectorAll('.alt-fonksiyon-checkbox').forEach(checkbox => {
                checkbox.checked = true;
            });
        });
    }
    
    if (clearAltBtn) {
        clearAltBtn.addEventListener('click', function() {
            document.querySelectorAll('.alt-fonksiyon-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        });
    }
});
