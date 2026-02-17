const API_BASE = "./";
let editModal ="";
let copyModal ="";
    const API_URL = API_BASE + "api.php";

    const IL_DATA = API_BASE + "il/illiste.json";
    const ILCE_DATA = (ilce) => `${API_BASE}ilce/${ilce}.json`;
    const MAHALLE_DATA = (mahalle) => `${API_BASE}mahalle/${mahalle}.json`;

    const getJSON = async (url) => await fetch(url).then(data => data.json());

    function toggleParselVisibility(visible) {
        Object.values(SearchMapItems).forEach(item => {
            item.polygon.setVisible(visible);
            item.marker.setVisible(visible);
        });
    }

    // Menü aç/kapa işlevi
    document.getElementById('menuToggle').addEventListener('click', function() {
        const rightMenu = document.getElementById('rightMenu');
        rightMenu.classList.toggle('visible');
    });

    document.addEventListener('DOMContentLoaded', function() {
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
            showParselRows();
            showCadaRows();
            hideCparselRows();
        } else {
            hideParsel();
            hideParselRows();
            hideCadaRows();
            hideCparselRows();
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
            row.style.display = '';
        });
    }

    function hideParselRows() {
        const rows = document.querySelectorAll('.ada-parsel-row');
        rows.forEach(row => {
            row.style.display = 'none';
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
    document.addEventListener("DOMContentLoaded", function() {
        updateParselVisibility();
        checkImarToggleState();
    }); 

    // Parsel görünürlüğünü toggle durumuna göre güncelleyen fonksiyon
    function updateParselVisibility() {
        const parselSwitch = document.getElementById('parselSwitch');

        if (parselSwitch.checked) {
            localStorage.setItem('parselVisibility', 'visible');
            showParsel();
            showParselRows();
            showCadaRows();
        } else {
            localStorage.setItem('parselVisibility', 'hidden');
            hideParsel();
            hideParselRows();
            hideCadaRows();
            hideCparselRows();
            
            // Ada parsel inputlarını temizle
            const inputAda = document.getElementById('input-ada');
            const inputParsel = document.getElementById('input-parsel');
            if (inputAda) inputAda.value = '';
            if (inputParsel) inputParsel.value = '';
        }
    }

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

    document.addEventListener('DOMContentLoaded', function() {
        const araziBuyukluguData = [{
                value: "1",
                label: "1'den küçük (0-1 da)"
            },
            {
                value: "2",
                label: "1 - 5 da"
            },
            {
                value: "3",
                label: "5 - 10 da"
            },
            {
                value: "4",
                label: "10 - 20 da"
            },
            {
                value: "5",
                label: "20 - 30 da"
            },
            {
                value: "6",
                label: "30 - 40 da"
            },
            {
                value: "7",
                label: "40 - 50 da"
            },
            {
                value: "8",
                label: "50 - 60 da"
            },
            {
                value: "9",
                label: "60 - 70 da"
            },
            {
                value: "10",
                label: "70 - 80 da"
            },
            {
                value: "11",
                label: "80 - 90 da"
            },
            {
                value: "12",
                label: "90 - 100 da"
            },
            {
                value: "13",
                label: "100 - 200 da"
            },
            {
                value: "14",
                label: "200 - 500 da"
            },
            {
                value: "15",
                label: "500 - 1.000 da"
            },
            {
                value: "16",
                label: "1.000 da ve üzeri"
            }
        ];

        
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

        // Arazi Büyüklüğü Dilimi
        const araziBuyukluguCheckboxes = document.getElementById('araziBuyukluguCheckboxes');
        const araziBuyukluguSearch = document.getElementById('araziBuyukluguSearch');
        const selectAllAraziBuyuklugu = document.getElementById('selectAllAraziBuyuklugu');
        const clearAraziBuyuklugu = document.getElementById('clearAraziBuyuklugu');

        
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

        renderCheckboxes(araziBuyukluguCheckboxes, araziBuyukluguData);
        handleSearch(araziBuyukluguSearch, araziBuyukluguCheckboxes, araziBuyukluguData);
        handleSelectAll(selectAllAraziBuyuklugu, araziBuyukluguCheckboxes);
        handleClear(clearAraziBuyuklugu, araziBuyukluguCheckboxes);

        // Taşınmaz Detay
        const tasinmazDetayCheckboxes = document.getElementById('tasinmazDetayCheckboxes');
        const tasinmazDetaySearch = document.getElementById('tasinmazDetaySearch');
        const selectAllTasinmazDetay = document.getElementById('selectAllTasinmazDetay');
        const clearTasinmazDetay = document.getElementById('clearTasinmazDetay');

        renderCheckboxes(tasinmazDetayCheckboxes, tasinmazDetayData);
        handleSearch(tasinmazDetaySearch, tasinmazDetayCheckboxes, tasinmazDetayData);
        handleSelectAll(selectAllTasinmazDetay, tasinmazDetayCheckboxes);
        handleClear(clearTasinmazDetay, tasinmazDetayCheckboxes);
    });

    
    

document.addEventListener('DOMContentLoaded', function() {
    const selectAllIlce = document.getElementById('selectAllIlce');
    const clearIlce = document.getElementById('clearIlce');

    selectAllIlce.addEventListener('click', async function() {
        const ilceCheckboxes = document.querySelectorAll('.ilce-checkbox');
        selectedIlceler.clear();
        for (let checkbox of ilceCheckboxes) {
            checkbox.checked = true;
            selectedIlceler.add(checkbox.value);
        }
        await updateAllMahalleler();
    });

    clearIlce.addEventListener('click', async function() {
        const ilceCheckboxes = document.querySelectorAll('.ilce-checkbox');
        for (let checkbox of ilceCheckboxes) {
            checkbox.checked = false;
        }
        selectedIlceler.clear();
        clearMahalleler();
    });
});
document.addEventListener('change', async function(e) {
    if (e.target.classList.contains('ilce-checkbox')) {
        const id = e.target.value;
        const isChecked = e.target.checked;

        if (isChecked) {
            selectedIlceler.add(id);
        } else {
            selectedIlceler.delete(id);
        }

        await updateMahalleler(id, isChecked);
    }

    // ... (mahalle-checkbox için olan kısım aynı kalabilir)
});
async function updateAllMahalleler() {
    clearMahalleler();
    for (let ilceId of selectedIlceler) {
        await updateMahalleler(ilceId, true);
    }
}
async function updateMahalleler(ilceId, isChecked) {
    if (ilceId == 0 || isNaN(ilceId)) return;

    if (isChecked) {
        const mahalleler = await getJSON(MAHALLE_DATA(ilceId));
        mahalleler.features.forEach((mahalle) => {
            if (!document.getElementById(`mahalle-${mahalle.properties.id}`)) {
                mahalleContainer.appendChild(
                    createCheckbox(
                        mahalle.properties.id,
                        mahalle.properties.text,
                        'mahalle',
                        ilceId
                    )
                );
            }
        });
    } else {
        const mahalleElements = mahalleContainer.querySelectorAll(`.mahalle-checkbox[data-ilce="${ilceId}"]`);
        mahalleElements.forEach(el => el.closest('.checkbox-card').remove());
    }
}

function clearMahalleler() {
    mahalleContainer.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', function () {
    // Form elemanlarını seçin
    const ilSelect = document.getElementById('select-il');
    const ilceContainer = document.getElementById('ilce-container');
    const mahalleContainer = document.getElementById('mahalle-container');
    const adaInput = document.getElementById('input-ada');
    const parselInput = document.getElementById('input-parsel');
    const turSecimiSelect = document.getElementById('turSecimi');
    const araziBuyukluguCheckboxes = document.getElementById('araziBuyukluguCheckboxes');
    const hisseDurumuSelect = document.getElementById('hisseDurumu');

    // Taşınmaz Detay konteyneri
    const tasinmazDetayContainer = document.getElementById('tasinmazDetayCheckboxes');

    // API'den Taşınmaz Detay verilerini getiren fonksiyon
    async function fetchTasinmazDetay() {
        // Form elemanlarından seçilen değerleri alın
        const selectedIl = ilSelect.value;
        const selectedIlce = Array.from(ilceContainer.querySelectorAll('input:checked')).map(input => input.value).join(',');
        const selectedMahalle = Array.from(mahalleContainer.querySelectorAll('input:checked')).map(input => input.value).join(',');
        const selectedAda = adaInput.value;
        const selectedParsel = parselInput.value;
        const selectedTurSecimi = turSecimiSelect.value;
        const selectedHisseDurumu = hisseDurumuSelect.value;
        const selectedAraziBuyuklugu = Array.from(araziBuyukluguCheckboxes.querySelectorAll('input:checked')).map(input => input.value).join(',');

        // API'ye GET isteği gönderin
        try {
            const response = await fetch(`api.php?update=true&il=${selectedIl}&ilce=${encodeURIComponent(selectedIlce)}&mahalle=${encodeURIComponent(selectedMahalle)}&ada=${selectedAda}&parsel=${selectedParsel}&turSecimi=${selectedTurSecimi}&hisseDurumu=${selectedHisseDurumu}&araziBuyuklugu=${encodeURIComponent(selectedAraziBuyuklugu)}`);
            
            if (!response.ok) {
                throw new Error("API isteğinde bir hata oluştu");
            }

            const data = await response.json();

            // Gelen verileri "Taşınmaz Detay" checkbox'larına ekleyin
            if (data && data.length > 0) {
                renderCheckboxes(tasinmazDetayContainer, data);
            } else {
                tasinmazDetayContainer.innerHTML = "<p>Sonuç bulunamadı.</p>";
            }
        } catch (error) {
            console.error("Taşınmaz Detay verisi alınırken hata oluştu:", error);
            tasinmazDetayContainer.innerHTML = "<p>Veri alınamadı.</p>";
        }
    }
    
    

    // Taşınmaz Detay kutucuklarını oluşturmak için yardımcı fonksiyon
   function renderCheckboxes(container, data) {
    container.innerHTML = '';
    data.forEach(item => {
        // ARAZİ veya TARLA kontrolü (büyük/küçük harf duyarsız)
        const isAraziOrTarla = item.label.toUpperCase().includes('ARSA') || 
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

    // Form elemanlarına değişiklikleri dinleyecek event listener'lar ekleyin
    ilSelect.addEventListener('change', fetchTasinmazDetay);
    ilceContainer.addEventListener('change', fetchTasinmazDetay);
    mahalleContainer.addEventListener('change', fetchTasinmazDetay);
    adaInput.addEventListener('input', fetchTasinmazDetay);
    parselInput.addEventListener('input', fetchTasinmazDetay);
    turSecimiSelect.addEventListener('change', fetchTasinmazDetay);
    hisseDurumuSelect.addEventListener('change', fetchTasinmazDetay);
    araziBuyukluguCheckboxes.addEventListener('change', fetchTasinmazDetay);
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
        return [];
    }
}

// Function to fetch and display the list of companies in the table
async function fetchCompanies() {
    try {
        const response = await fetch('api.php?action=get_companies_summary');
        if (!response.ok) {
            throw new Error("API request failed with status " + response.status);
        }

        const companies = await response.json();

        // Clear the table body
        companyTableBody.innerHTML = '';

        // Check if there are any companies returned
        if (companies.length === 0) {
            companyTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Şirket bulunamadı.</td></tr>';
            return;
        }

        // Display each company in the table
        companies.forEach(company => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" name="company-checkbox" class="company-checkbox" data-firmName="${company.company_name}" value="${company.id}">
                </td>
                <td>${company.id}</td>
                <td>${company.company_name}</td>
                <td>${company.property_count}</td>
                <td>
                    <button style="margin-bottom:6px;" class="btn btn-danger btn-sm delete-btn" data-id="${company.id}"><i class="fas fa-trash"></i></button>
                    <button style="margin-bottom:6px;" class="btn btn-sm btn-primary edit-btn" data-company-id="${company.id}" data-company-name="${company.company_name}">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button style="margin-bottom:6px;" class="btn btn-info btn-sm copy-btn" data-id="${company.id}">
                        <i class="fas fa-copy"></i>
                    </button>
                </td>
                
                
            `;
            companyTableBody.appendChild(row);
        });

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
                }
                else{
                    document.getElementById('nav-company-management-tab').style.display ="none";
     // Liste sekmesine geç
           document.getElementById('nav-liste-tab').click();
                }
                
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const companyId = e.target.getAttribute('data-id');
                await deleteCompany(companyId);
                fetchCompanies(); // Refresh the table after deletion
                 document.getElementById('nav-company-management-tab').style.display ="none";
                // Liste sekmesine geç
                 document.getElementById('nav-liste-tab').click();
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
        console.error("Error fetching companies:", error);
        companyTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Şirket bilgileri yüklenirken bir hata oluştu.</td></tr>';
    }
}


document.addEventListener('DOMContentLoaded', function () {
    // Get references to elements
    const companyTableBody = document.getElementById('companyTableBody');
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const newCompanyNameInput = document.getElementById('newCompanyName');

    // Check if elements exist
    if (!companyTableBody || !addCompanyBtn || !newCompanyNameInput) {
        console.error("Required elements not found in the DOM.");
        return;
    }

    

    // Function to add a new company
    async function addCompany() {
        const companyName = newCompanyNameInput.value.trim();
        if (companyName === "") {
            alert("Lütfen bir şirket adı girin.");
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

            if (result.success) {
                alert("Şirket başarıyla eklendi.");
                newCompanyNameInput.value = ""; // Clear input field after adding
                fetchCompanies(); // Refresh the table to include the new company
            } else {
                alert("Şirket eklenemedi.");
            }
        } catch (error) {
            console.error("Error adding company:", error);
            alert("Şirket eklenirken bir hata oluştu.");
        }
    }

    // Function to delete a company
    

    // Add event listener to the Add button
    addCompanyBtn.addEventListener('click', addCompany);

    // Fetch companies when the page loads
    fetchCompanies();
});
async function deleteCompany(companyId) {
    try {
        // Şirketin mevcut gayrimenkul sayısını kontrol et
        const countResponse = await fetch(`api.php?action=get_property_count&company_id=${companyId}`, {
            method: 'GET'
        });
        
        const countResult = await countResponse.json();
        
        if (countResult.success) {
            const propertyCount = countResult.property_count;

            // Eğer gayrimenkul varsa kullanıcıya uyarı göster
            if (propertyCount > 0) {
                const confirmation = confirm(`Seçilen şirkette ${propertyCount} kadar gayrimenkul mevcut. Silmek istediğine emin misin?`);
                if (!confirmation) {
                    return; // Kullanıcı iptal ettiyse fonksiyondan çık
                }
            }
        }

        // Şirketi silme işlemini başlat
        const formData = new FormData();
        formData.append('action', 'delete_company');
        formData.append('company_id', companyId);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert("Şirket başarıyla silindi.");
        } else {
            alert("Şirket silinemedi.");
        }
    } catch (error) {
        console.error("Error deleting company:", error);
        alert("Şirket silinirken bir hata oluştu.");
    }
}
function addPropertyToFirm(parcelKey, firmId) {
    // Send a request to your API to add the property to the firm
        const selectedFirmCheckboxId = document.querySelector('input.company-checkbox:checked')?.value;

    fetch(`${API_URL}?action=addPropertyToFirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, parcelKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Gayrimenkul firmaya eklendi.');
            fetchCompanies().then(() => {
                // fetchCompanies tamamlandığında seçili şirket checkbox'ını geri yükleyin
                if (selectedFirmCheckboxId) {
                    document.querySelector(`input.company-checkbox[value="${selectedFirmCheckboxId}"]`).checked = true;
                }
                fetchCompanyProperties(selectedFirmCheckboxId);
            });
        } else {
            alert('Bir hata oluştu.');
        }
    });

}

function removePropertyFromFirm(parcelKey, firmId) {
    // Şu anda seçili olan şirketin checkbox ID'sini al
    const selectedFirmCheckboxId = document.querySelector('input.company-checkbox:checked')?.value;

    fetch(`${API_URL}?action=removePropertyFromFirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, parcelKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Gayrimenkul firmadan çıkarıldı.');

            // Haritadan poligonu kaldır
            removePolygonFromMap(parcelKey);

            // Şirket listesini yeniden al
            fetchCompanies().then(() => {
                // fetchCompanies tamamlandığında seçili şirket checkbox'ını geri yükleyin
                if (selectedFirmCheckboxId) {
                    document.querySelector(`input.company-checkbox[value="${selectedFirmCheckboxId}"]`).checked = true;
                }
                // Güncellenen şirket verilerini haritaya yükleyin
                fetchCompanyProperties(selectedFirmCheckboxId);
            });
           
        } else {
            alert('Bir hata oluştu.');
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
    const selectedFirmCheckbox = document.querySelector('input.company-checkbox:checked');
    const selectedFirmId = selectedFirmCheckbox?.value;
    const selectedFirmName = selectedFirmCheckbox?.dataset.firmname;

    const firmayaEkleRow = document.getElementById('firmayaEkleRow');
    const firmNameLabel = document.getElementById('firm-name-label');
    const firmCheckbox = document.getElementById('firm-checkbox');

    if (!selectedFirmId) {
        if (firmayaEkleRow) {
            firmayaEkleRow.style.display = 'none';
        }
        return;
    }

    if (firmayaEkleRow && firmNameLabel && firmCheckbox) {
        firmNameLabel.innerText = selectedFirmName;
        firmayaEkleRow.style.display = 'table-row';
        firmCheckbox.checked = false; 
        firmCheckbox.dataset.parcelKey = parcelKey; 
        firmCheckbox.dataset.firmId = selectedFirmId; 
    } else {
        const newRow = document.createElement('tr');
        newRow.id = 'firmayaEkleRow';
        newRow.innerHTML = `
            <td>Firmaya Ekle (<span id="firm-name-label">${selectedFirmName}</span>)</td>
            <td><input type="checkbox" id="firm-checkbox" data-parcel-key="${parcelKey}" data-firm-id="${selectedFirmId}"></td>
        `;
        document.querySelector('#nav-oznitelik table tbody').appendChild(newRow);
    }

    // Update the checkbox state based on company properties
    console.log("Properties response:",veriyukle);
   fetchCompanyProperties(selectedFirmId).then(veriyukle => {
    const isAssociated = veriyukle.some(featureData => featureData.data.properties.id  === parcelKey);
        firmCheckbox.checked = isAssociated;
    });
}

 // Checkbox için event listener ekle
        document.getElementById('firm-checkbox').addEventListener('change', function() {
            const firmId = this.dataset.firmId;
            const parcelKey = this.dataset.parcelKey;

            if (this.checked) {
                addPropertyToFirm(parcelKey, firmId);
            } else {
                removePropertyFromFirm(parcelKey, firmId);
            }
        });

        

document.querySelectorAll('input.company-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        updateFirmayaEkleCheckbox(currentParcelKey); // Ensure currentParcelKey is the selected parcel's key
    });
});

function updateCompanyManagement(data) {
        allowMapZoom = false; // Bu tıklama ile fitBounds devre dışı

    const resultList = document.getElementById('company-property-list');
    resultList.innerHTML = '';  // Önce mevcut içeriği temizleyin
    propertyData = data; // Tüm verileri orijinal yapısıyla sakla
     const selectedFirmCheckbox = document.querySelector('input.company-checkbox:checked');
    const selectedFirmId = selectedFirmCheckbox?.value;
    const selectedFirmName = selectedFirmCheckbox?.dataset.firmname;

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
    document.getElementById('nav-company-management-tab').style.display ="block";
    document.getElementById('nav-company-management-tab').innerText=selectedFirmName;
    document.getElementById('nav-company-management-tab').click();

    data.forEach(jitem => {
               
                    // Polygon verisi mevcutsa haritaya çiz
                    window.dispatchEvent(new CustomEvent("SETMAP_FIELD", { detail: jitem.data }));
                
            });
}

document.getElementById('company-property-list').addEventListener('click', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    
    const index = row.rowIndex - 1; // thead'i hesaba katmak için -1
    if (index >= 0 && index < propertyData.length) {
const item = propertyData[index];
highlightAndZoomToPolygon(item.data);
updateCompanyPropertyInfo(item.data.properties);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    let playInterval;
    let currentIndex = 0;
    let isPaused = false;
    let propertyData = []; // Tüm arazi verilerini tutacak dizi

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
        alert("Lütfen şirket adını giriniz.");
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
            alert("Şirket güncellenemedi.");
        }
    } catch (error) {
        console.error("Error updating company:", error);
        alert("Şirket güncellenirken bir hata oluştu.");
    }
});

// When 'Save' is clicked in the modal
            document.getElementById('saveCopyCompany').addEventListener('click', function() {
                const newCompanyName = document.getElementById('newCompanyNameInput').value.trim();
                const companyId = document.getElementById('copyCompanyId').value;
                if (newCompanyName === '') {
                    alert('Lütfen yeni şirket adı giriniz.');
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
                        alert('Şirket kopyalama başarısız oldu.');
                    }
                })
                .catch(error => {
                    console.error('Error copying company:', error);
                    alert('Kopyalama işlemi sırasında bir hata oluştu.');
                });
            });