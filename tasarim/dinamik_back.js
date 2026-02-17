document.addEventListener('DOMContentLoaded', function() {
    const turSecimiElement = document.getElementById('turSecimi');
    const hisseDurumuElement = document.getElementById('hisseDurumu');
    const sorgulamaDurumuElement = document.getElementById('sorgulamaDurumu');
    const araziBuyukluguElement = document.getElementById('araziBuyukluguCheckboxes');
    const tasinmazDetayElement = document.getElementById('tasinmazDetayCheckboxes');

    // Sayfa yüklendiğinde tüm alanların boş olmasını sağla
    clearAllFields();

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
            
            await fetchDynamicOptions('tasinmazDetay', { 
                il: selectedIl, 
                ilce: selectedIlce.join(','), 
                mahalle: selectedMahalle.join(','),
                turSecimi: turSecimiElement.value,
                hisseDurumu: hisseDurumuElement.value,
                sorgulamaDurumu: sorgulamaDurumuElement.value
            });
        } else {
            console.log('⚠️ Lokasyon seçimi yapılmamış, taşınmaz detayları temizleniyor');
            tasinmazDetayElement.innerHTML = '';
        }
    }

    async function fetchDynamicOptions(type, filters) {
        $.ajax({
            url: `dinamik.php`,
            method: 'GET',
            data: {
                ...filters,
                type: type
            },
            success: function(data) {
                console.log('Gelen data:', data); // Veriyi kontrol et

                if (Array.isArray(data)) {
                    if (type === 'turSecimi') {
                        updateSelectOptions(turSecimiElement, data, 'AnaTasinmazNitelik_1');
                    } else if (type === 'araziBuyuklugu') {
                        updateCheckboxOptions(araziBuyukluguElement, data, 'label');
                    } else if (type === 'tasinmazDetay') {
                        updateCheckboxOptions(tasinmazDetayElement, data, 'AnaTasinmazNitelik_1');
                    }
                } else {
                    console.error(`Beklenmeyen veri formatı: ${data}`);
                }
            },
            error: function() {
                console.error("Veri getirme işlemi sırasında bir hata oluştu.");
            }
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

    function clearAllFields() {
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

        araziBuyukluguElement.innerHTML = '';
        tasinmazDetayElement.innerHTML = '';
    }
});