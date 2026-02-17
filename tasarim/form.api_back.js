/** FORM API HANDLER */

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

    clearCheckboxes(ilceContainer);
    clearCheckboxes(mahalleContainer);

    if (id == 0 || isNaN(id)) return;

    const ilceler = await getJSON(ILCE_DATA(id));
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

        const ilce = getWindowParam('data_ilceler').features.find(i => i.properties.id == id);
        window.dispatchEvent(new CustomEvent("SETMAP_COORDS", { detail: ilce }));
    }

    if (e.target.classList.contains('mahalle-checkbox')) {
        const id = e.target.value;

        if (id == 0 || isNaN(id)) return;

        const mahalle = getWindowParam('data_mahalleler').find(i => i.properties.id == id);
        window.dispatchEvent(new CustomEvent("SETMAP_COORDS", { detail: mahalle }));
    }
});

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
    clearMap();
});
btnSorgula.addEventListener('click', async function() {
    console.log("Sorgula butonu tıklandı");

    // Butonun orijinal metnini saklayalım
    const originalButtonText = this.textContent;

    // Butonun metnini değiştirelim ve devre dışı bırakalım
    this.textContent = "Sorgulanıyor...";
    this.setAttribute('disabled', true);

    const il = document.getElementById('select-il').value;

    const selectedIlceler = Array.from(document.querySelectorAll('.ilce-checkbox:checked')).map(cb => cb.value); // İlçe ID'leri

    const selectedMahalleler = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);


    const ada = document.querySelector('#input-ada').value.trim();
    const parsel = document.querySelector('#input-parsel').value.trim();
    const nitelik = document.querySelector('#input-nitelik').value.trim();
    const turSecimi = document.querySelector('#turSecimi').value;
    const hisseDurumu = document.querySelector('#hisseDurumu').value;
    const tasinmazDetayValues = Array.from(document.querySelectorAll('#tasinmazDetayCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    const araziBuyukluguValues = Array.from(document.querySelectorAll('#araziBuyukluguCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);

    // ✅ İmar switch durumunu kontrol et
    const imarSwitch = document.getElementById('imarSwitch');
    const isImarSwitchActive = imarSwitch && imarSwitch.checked;
    
    console.log("🔍 [DEBUG] İmar switch durumu:", isImarSwitchActive);

    const queryParams = new URLSearchParams({
        il: encodeURIComponent(il),
        ilce: encodeURIComponent(selectedIlceler.join(',')),
        mahalle: encodeURIComponent(selectedMahalleler.join(',')),
        ada: encodeURIComponent(ada),
        parsel: encodeURIComponent(parsel),
        nitelik: encodeURIComponent(nitelik),
        tasinmazDetay: encodeURIComponent(tasinmazDetayValues.join(',')),
        araziBuyuklugu: encodeURIComponent(araziBuyukluguValues.join(',')),
        turSecimi: encodeURIComponent(turSecimi),
        hisseDurumu: encodeURIComponent(hisseDurumu)
    });

    // ✅ İmar parametrelerini sadece switch açıkken ekle
    if (isImarSwitchActive) {
        const selectedAnaFonksiyonlar = Array.from(document.querySelectorAll('.ana-fonksiyon-checkbox:checked'))
            .map(cb => cb.value);
        const selectedAltFonksiyonlar = Array.from(document.querySelectorAll('.alt-fonksiyon-checkbox:checked'))
            .map(cb => cb.value);

        console.log("🔍 [DEBUG] Seçilen ana fonksiyonlar:", selectedAnaFonksiyonlar);
        console.log("🔍 [DEBUG] Seçilen alt fonksiyonlar:", selectedAltFonksiyonlar);
        
        queryParams.append('ana_fonksiyon_id', encodeURIComponent(selectedAnaFonksiyonlar.join(',')));
        queryParams.append('alt_fonksiyon_id', encodeURIComponent(selectedAltFonksiyonlar.join(',')));
    } else {
        console.log("🔍 [DEBUG] İmar switch kapalı - imar parametreleri gönderilmiyor");
    }

    try {
        console.log("API isteği gönderiliyor:", `${API_URL}?${queryParams.toString()}`);

        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            headers: { "Content-Type": "application/json" }
        });
        const jsonResponse = await response.json();

        console.log("API Yanıtı:", jsonResponse);

        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }
        const data = jsonResponse;

        updateList(jsonResponse);
        const listTabButton = document.getElementById('nav-liste-tab'); // Liste sekme butonunu referans al
          listTabButton.click();
        const resultCount = jsonResponse.length;
        console.log("Bulunan gayrimenkul sayısı:", resultCount);
        TitleAlertMessage(`Bulunan Gayrimenkul sayısı ${resultCount}.`, 'success');
        // Sayıyı göster
        const countValueElement = document.getElementById('count-value');
        const propertyCountElement = document.getElementById('property-count');
        if (propertyCountElement) {
            propertyCountElement.innerHTML = `: ${resultCount} Gayrimenkul`;
        }


        const MAX_DISPLAYABLE_RESULTS = 8000; // Maksimum gösterilebilir sonuç sayısı

        if (resultCount > MAX_DISPLAYABLE_RESULTS) {
            TitleAlertMessage(`Lütfen seçiminizi daraltınız. Şu anki sorgu ${resultCount} sonuç döndürüyor.`, 'danger');
            return; // İşlemi burada sonlandır
        }

        if (resultCount > 0) {
            jsonResponse.forEach(item => {
                if (item.status == 200) {
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                    checkToggleState();
                } else {
                    TitleAlertMessage(item.data.Message || 'Veri bulunamadı', 'warning');
                }
            });
        } else {
            TitleAlertMessage('Veri bulunamadı', 'warning');
        }
    } catch (err) {
        console.error("Error:", err);
        let errorMessage = 'Kritere göre veri bulunamadı (İlçe/Mahalle, Hisse ve Türü kontrol ediniz).';
        if (err.message === 'API yanıt vermedi') {
            errorMessage = 'API şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.';
        }
        TitleAlertMessage(errorMessage, 'danger');
        const propertyCountElement = document.getElementById('property-count');
        if (propertyCountElement) {
            propertyCountElement.style.display = 'none';
        }
    } finally {
        // İşlem tamamlandığında veya hata durumunda butonun orijinal metnini geri getirelim ve aktif hale getirelim
        this.textContent = originalButtonText;
        this.removeAttribute('disabled');
    }
});

btnSorgulaPro.addEventListener('click', async function() {
    console.log("Sorgula butonu tıklandı");

    // Butonun orijinal metnini saklayalım
    const originalButtonText = this.textContent;

    // Butonun metnini değiştirelim ve devre dışı bırakalım
    this.textContent = "Sorgulanıyor...";
    this.setAttribute('disabled', true);

    // Prolegal Taşınmaz No alanı
    const prolegalNo = document.getElementById('prolegalNo').value.trim();

    // Sadece Prolegal Taşınmaz No doluysa sorgulama yapalım
    if (prolegalNo === '') {
        TitleAlertMessage('Lütfen Prolegal Taşınmaz No giriniz.', 'warning');
        this.textContent = originalButtonText;
        this.removeAttribute('disabled');
        return;
    }

    const queryParams = new URLSearchParams({
        prolegalId: encodeURIComponent(prolegalNo) 
    });

    try {
        console.log("API isteği gönderiliyor:", `${API_URL}?${queryParams.toString()}`);

        const response = await fetch(`${API_URL}?${queryParams.toString()}`, {
            headers: { "Content-Type": "application/json" }
        });
        const jsonResponse = await response.json();

        console.log("API Yanıtı:", jsonResponse);

        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }
        
       
        
        const resultCount = jsonResponse.length;
        console.log("Bulunan gayrimenkul sayısı:", resultCount);
        TitleAlertMessage(`Bulunan Gayrimenkul sayısı ${resultCount}.`, 'success');

        const MAX_DISPLAYABLE_RESULTS = 8000; // Maksimum gösterilebilir sonuç sayısı

        if (resultCount > MAX_DISPLAYABLE_RESULTS) {
            TitleAlertMessage(`Lütfen seçiminizi daraltınız. Şu anki sorgu ${resultCount} sonuç döndürüyor.`, 'danger');
            return; // İşlemi burada sonlandır
        }

        if (resultCount > 0) {
            jsonResponse.forEach(item => {
                if (item.status == 200) {
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                    checkToggleState();
                } else {
                    TitleAlertMessage(item.data.Message || 'Veri bulunamadı', 'warning');
                }
            });
        } else {
            TitleAlertMessage('Veri bulunamadı', 'warning');
        }
    } catch (err) {
        console.error("Error:", err);
        let errorMessage = 'Kritere göre veri bulunamadı.';
        if (err.message === 'API yanıt vermedi') {
            errorMessage = 'API şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.';
        }
        TitleAlertMessage(errorMessage, 'danger');
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

document.querySelectorAll('th').forEach(header => {
    header.addEventListener('click', function() {
        const column = this.getAttribute('data-column');
        const order = this.getAttribute('data-order');
        const newOrder = order === 'desc' ? 'asc' : 'desc';
        this.setAttribute('data-order', newOrder);

        // Verileri sıralamak için updateList fonksiyonunu çağırın
        sortTableData(column, newOrder);
    });
});

function sortTableData(column, order) {
    const resultList = document.getElementById('result-list');
    const rows = Array.from(resultList.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent.trim();

        const aNumericValue = parseFloat(aValue.replace(/\./g, '').replace(',', '.'));
        const bNumericValue = parseFloat(bValue.replace(/\./g, '').replace(',', '.'));

        if (!isNaN(aNumericValue) && !isNaN(bNumericValue)) {
            return order === 'asc' ? aNumericValue - bNumericValue : bNumericValue - aNumericValue;
        } else {
            return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    // Sıralanan satırlara göre `propertyData` dizisini güncelle
    propertyData = sortedRows.map(row => {
        const key = row.getAttribute('data-key');
        return propertyData.find(item => {
            const itemKey = `${item.data.properties.mahalleId}/${item.data.properties.adaNo}/${item.data.properties.parselNo}`;
            return itemKey === key;
        });
    });

    // Eski satırları kaldırıp yeni sıralı satırları ekleyin
    resultList.innerHTML = '';
    sortedRows.forEach(row => resultList.appendChild(row));
}


function getColumnIndex(column) {
    const columns = {
        'id': 1,
        'il': 2,
        'ilce': 3,
        'mahalle': 4,
        'nitelik': 5,
        'alan': 6
    };
    return columns[column];
}

function updateList(data) {
    const resultList = document.getElementById('result-list');
    resultList.innerHTML = '';  // Önce mevcut içeriği temizleyin
    propertyData = data; // Tüm verileri orijinal yapısıyla sakla


    data.forEach(item => {
        const row = document.createElement('tr');
        // Mahalle ID, Ada, Parsel bilgilerinden key oluşturuluyor
        const key = `${item.data.properties.mahalleId}/${item.data.properties.adaNo}/${item.data.properties.parselNo}`;
        
        row.setAttribute('data-key', key);
        row.innerHTML = `
            <td>${item.data.properties.id}</td>
            <td>${item.data.properties.ilAd}</td>
            <td>${item.data.properties.ilceAd}</td>
            <td>${item.data.properties.mahalleAd}</td>
            <td>${item.data.properties.nitelik}</td>
            <td>${item.data.properties.alan}</td>
        `;
        resultList.appendChild(row);
    });
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
    allowMapZoom = false; // Bu tıklama ile fitBounds devre dışı

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

        // Gelen sonuçları haritada göster
        if (data.length > 0) {
            data.forEach(item => {
                if (item.status === 200) {
                    // Polygon verisi mevcutsa haritaya çiz
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: item.data }));
                }
            });
            
            // Sonuçları liste görünümünde güncelle
            updateList(data);
            
            // Sonuç sayısını göster
            const resultCount = data.length;
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
        // Butonu tekrar aktif hale getir
        this.textContent = 'Bölgeyi Tara';
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

        // PL Logolu Marker oluşturma - Dinamik Renk
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

        storeItems.push(plMarker); // Marker'ı sakla
    }

    // Eğer allowMapZoom true ise harita yakınlaştırılır
    if (allowMapZoom) {
        myMap.fitBounds(bounds);
    }
    return;
});

window.addEventListener('SETMAP_FIELD', e => {
    if (!e.detail.geometry) return;

    const key = `${e.detail.properties.mahalleId}/${e.detail.properties.adaNo}/${e.detail.properties.parselNo}`;

    if (SearchMapItems[key]) {
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
    const bounds = new google.maps.LatLngBounds();

    for (let i = 0; i < coordinates.length; i++) {
        const polygon = e.detail.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

        const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
        const center = MAPHELPER.getCenter(triangleCoords);
        // Poligonu oluştur
        // GÜNCEL RENKLENDIRME MANTIGI
        let fillColor = "#ff0000"; // Default kırmızı
        
        const basvuru_turu = e.detail.properties.basvuru_turu;
        const tapu_durum = e.detail.properties.durum;
        
        // ÖNCE BAŞVURU TÜRÜ KONTROLÜ (EN YÜKSEK ÖNCELİK)
        if (basvuru_turu === 'Küçük') {
            fillColor = "#FF8C00"; // TURUNCU - Müşterisiz Başvuru
        } else if (basvuru_turu === 'Büyük') {
            fillColor = "#FFED4E"; // SARI - Müşterili Başvuru
        } 
        // SORGUDA DURUMU KONTROLÜ
        else if (tapu_durum === 'Sorguda') {
            fillColor = "#00732F"; // YEŞİL
        }
        // SIRADA DURUMU KONTROLÜ
        else if (tapu_durum === 'Sırada') {
            fillColor = "#808080"; // GRİ
        }
        // DİĞER DURUMLAR
        else if (tapu_durum === 'Uygun') {
            fillColor = "#004CFF"; // MAVİ
        } else if (tapu_durum === 'Uygun değil') {
            fillColor = "#732982"; // MOR
        }

        SearchMapItems[key].polygon = new google.maps.Polygon({
            paths: triangleCoords,
            strokeWeight: 2,
            fillColor: fillColor,
            fillOpacity: 0.35,
        });

        SearchMapItems[key].polygon.setMap(myMap);
        google.maps.event.addListener(SearchMapItems[key].polygon, 'click', function(event) {
            setPanel(e.detail);
            modal('#info-modal', true);

            // Add Firmaya Ekle checkbox logic
    updateFirmayaEkleCheckbox(e.detail.properties.id);
        });

        // PL Logolu Marker
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