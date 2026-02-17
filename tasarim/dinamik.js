document.addEventListener('DOMContentLoaded', function() {
    const turSecimiElement = document.getElementById('turSecimi');
    const hisseDurumuElement = document.getElementById('hisseDurumu');
    const sorgulamaDurumuElement = document.getElementById('sorgulamaDurumu');
    const araziBuyukluguElement = document.getElementById('araziBuyukluguCheckboxes');
    const tasinmazDetayElement = document.getElementById('tasinmazDetayCheckboxes');

    // Sayfa yüklendiğinde sadece temel alanları temizle, taşınmaz detaylarını yükleme
    clearBasicFields();

    // İl, ilçe veya mahalle değiştiğinde verileri dinamik olarak getir
    document.getElementById('select-il').addEventListener('change', updateDynamicData);
    document.getElementById('ilce-container').addEventListener('change', updateDynamicData);
    document.getElementById('mahalle-container').addEventListener('change', updateDynamicData);
    
    // Tür seçimi, hisse durumu ve sorgulama durumu değiştiğinde taşınmaz detayları güncelle
    turSecimiElement.addEventListener('change', updateTasinmazDetay);
    hisseDurumuElement.addEventListener('change', updateTasinmazDetay);
    sorgulamaDurumuElement.addEventListener('change', updateTasinmazDetay);

    async function updateDynamicData() {
        const selectedIl = document.getElementById('select-il').value;
        const selectedIlce = Array.from(document.querySelectorAll('.ilce-checkbox:checked')).map(cb => cb.value);
        const selectedMahalle = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);

        console.log('🔄 Dinamik veri güncelleniyor - İl:', selectedIl, 'İlçe:', selectedIlce, 'Mahalle:', selectedMahalle);

        // En az bir seçim yapılmışsa dinamik verileri al
        if (selectedIl || selectedIlce.length > 0 || selectedMahalle.length > 0) {
            console.log('✅ Seçim yapıldı, dinamik veriler yükleniyor...');
            
            try {
                // Ajax ile dinamik verileri al
                await fetchDynamicOptions('turSecimi', { il: selectedIl, ilce: selectedIlce.join(','), mahalle: selectedMahalle.join(',') });
                await fetchDynamicOptions('araziBuyuklugu', { il: selectedIl, ilce: selectedIlce.join(','), mahalle: selectedMahalle.join(',') });
                await fetchDynamicOptions('tasinmazDetay', { 
                    il: selectedIl, 
                    ilce: selectedIlce.join(','), 
                    mahalle: selectedMahalle.join(','),
                    turSecimi: turSecimiElement.value,
                    hisseDurumu: hisseDurumuElement.value,
                    sorgulamaDurumu: sorgulamaDurumuElement.value
                });
            } catch (error) {
                console.error('❌ Dinamik veri yüklenirken hata:', error);
            }
        } else {
            console.log('⚠️ Hiçbir seçim yapılmamış, dinamik veriler yüklenmiyor');
            // Seçim yapılmamışsa alanları temizle
            araziBuyukluguElement.innerHTML = '';
            tasinmazDetayElement.innerHTML = '';
        }
    }

    // Tür seçimi, hisse durumu veya sorgulama durumu değiştiğinde sadece taşınmaz detayları güncelle
    async function updateTasinmazDetay() {
        const selectedIl = document.getElementById('select-il').value;
        const selectedIlce = Array.from(document.querySelectorAll('.ilce-checkbox:checked')).map(cb => cb.value);
        const selectedMahalle = Array.from(document.querySelectorAll('.mahalle-checkbox:checked')).map(cb => cb.value);

        console.log('🔄 Taşınmaz detay güncelleniyor - Tür:', turSecimiElement.value, 'Hisse:', hisseDurumuElement.value, 'Sorgulama:', sorgulamaDurumuElement.value);

        // En az bir lokasyon seçimi yapılmışsa taşınmaz detayları güncelle
        if (selectedIl || selectedIlce.length > 0 || selectedMahalle.length > 0) {
            console.log('✅ Lokasyon seçimi mevcut, taşınmaz detayları güncelleniyor...');
            
            const filters = { 
                il: selectedIl, 
                ilce: selectedIlce.join(','), 
                mahalle: selectedMahalle.join(','),
                turSecimi: turSecimiElement.value,
                hisseDurumu: hisseDurumuElement.value,
                sorgulamaDurumu: sorgulamaDurumuElement.value
            };
            
            console.log('🎯 Gönderilecek filtreler:', filters);
            
            try {
                await fetchDynamicOptions('tasinmazDetay', filters);
            } catch (error) {
                console.error('❌ Taşınmaz detay güncellenirken hata:', error);
            }
        } else {
            console.log('⚠️ Lokasyon seçimi yapılmamış, taşınmaz detayları temizleniyor');
            tasinmazDetayElement.innerHTML = '';
        }
    }

    async function fetchDynamicOptions(type, filters) {
        console.log(`🔍 ${type} için gönderilen filtreler:`, filters);
        
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `dinamik.php`,
                method: 'GET',
                data: {
                    ...filters,
                    type: type
                },
                success: function(data) {
                    console.log(`📊 ${type} için gelen data:`, data);

                    if (Array.isArray(data)) {
                        if (type === 'turSecimi') {
                            updateSelectOptions(turSecimiElement, data, 'AnaTasinmazNitelik_1');
                        } else if (type === 'araziBuyuklugu') {
                            updateCheckboxOptions(araziBuyukluguElement, data, 'label');
                        } else if (type === 'tasinmazDetay') {
                            updateCheckboxOptions(tasinmazDetayElement, data, 'AnaTasinmazNitelik_1');
                        }
                        resolve(data);
                    } else {
                        console.error(`❌ Beklenmeyen veri formatı (${type}):`, data);
                        reject(new Error(`Beklenmeyen veri formatı: ${data}`));
                    }
                },
                error: function(xhr, status, error) {
                    console.error(`❌ ${type} veri getirme hatası:`, error);
                    console.error('XHR:', xhr);
                    reject(new Error(`Veri getirme işlemi sırasında bir hata oluştu: ${error}`));
                }
            });
        });
    }

    function updateSelectOptions(element, data, key) {
        element.innerHTML = ''; // Başlangıçta boş
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seçiniz';
        element.appendChild(defaultOption);

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[key];
            option.textContent = item[key];
            element.appendChild(option);
        });
    }

    function updateCheckboxOptions(container, data, key) {
        container.innerHTML = ''; // Başlangıçta boş
        data.forEach(item => {
            const checkboxCard = document.createElement('div');
            checkboxCard.classList.add('checkbox-card');
            checkboxCard.innerHTML = `
                <input type="checkbox" id="${item[key]}" value="${item[key]}">
                <label for="${item[key]}">${item[key]}</label>
            `;
            container.appendChild(checkboxCard);
        });
    }

    function clearBasicFields() {
        // Sadece temel alanları temizle, taşınmaz detaylarını yükleme
        turSecimiElement.innerHTML = '';
        const defaultTurOption = document.createElement('option');
        defaultTurOption.value = '';
        defaultTurOption.textContent = 'Seçiniz';
        turSecimiElement.appendChild(defaultTurOption);

        hisseDurumuElement.innerHTML = '';
        const defaultHisseOption = document.createElement('option');
        defaultHisseOption.value = '';
        defaultHisseOption.textContent = 'Seçiniz';
        hisseDurumuElement.appendChild(defaultHisseOption);

        sorgulamaDurumuElement.innerHTML = '';
        const defaultSorgulamaOption = document.createElement('option');
        defaultSorgulamaOption.value = 'Hepsi';
        defaultSorgulamaOption.textContent = 'Hepsi';
        sorgulamaDurumuElement.appendChild(defaultSorgulamaOption);

        // Taşınmaz detayları ve arazi büyüklüğü alanlarını boş bırak
        // Bunlar il/ilçe/mahalle seçildiğinde yüklenecek
        araziBuyukluguElement.innerHTML = '';
        tasinmazDetayElement.innerHTML = '';
    }
});