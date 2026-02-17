async function initMap() {

    const map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 38.4, lng: 35.4 },
        zoom: 5,
        disableDefaultUI: false,
        streetViewControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM,
            style: google.maps.MapTypeControlStyle.DEFAULT
        },
        fullscreenControl: true,
        mapTypeId: 'hybrid',
        styles: []
    });
    window.myMap = map;



    /** genel ayarlar  */
    google.maps.event.addListener(map, 'zoom_changed', function() {
        const currentZoom = map.getZoom();

        // Maksimum zoom seviyesini al
        const maxZoomService = new google.maps.MaxZoomService();
        maxZoomService.getMaxZoomAtLatLng(map.getCenter(), function(response) {
            if (response.status === google.maps.MaxZoomStatus.OK && currentZoom > response.zoom) {
                map.setZoom(response.zoom);
            }
        });

        setMapZoom(currentZoom);
    });

    google.maps.event.addListener(map, 'mousemove', function(event) {
        const lat = event.latLng.lat().toFixed(5)
        const lng = event.latLng.lng().toFixed(5)
        setLngLat(lat, lng);
    });

    setMapZoom(map.getZoom());
    setLngLat(
        map.center.lat().toFixed(5),
        map.center.lng().toFixed(5)
    );
    // Zoom butonları - güvenli erişim
    const zoomInBtn = document.getElementById('zoom-in-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', zoomIn);
    }
    
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', zoomOut);
    }
    
    // Map query butonu - güvenli erişim
    const mapQueryBtn = document.getElementById('map-query-btn');
    if (mapQueryBtn) {
        mapQueryBtn.addEventListener('click', MapQueryAction);
    }
    
    // Measure butonu - güvenli erişim
    const measureBtn = document.getElementById('measure-btn');
    if (measureBtn) {
        measureBtn.addEventListener('click', MeasureAction);
    }
    
    // Print butonu - güvenli erişim
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', PrintAction);
    }

}

function setLngLat(lat, lng) {
    document.getElementById('coordinate-info-input').setAttribute('title', `Enlem: ${lat}, Boylam: ${lng}`);
    document.getElementById('coordinate-info-input').value = `${lat} - ${lng}`;
}

function setMapZoom(zoom) {
    document.getElementById('zoom-level-text').setAttribute('title', `Yakınlaştırma Düzeyi:${zoom}`);
    document.getElementById('zoom-level-text').value = zoom;
}


function zoomIn() {
    window.myMap.setZoom(window.myMap.getZoom() + 1);
}

function zoomOut() {
    window.myMap.setZoom(window.myMap.getZoom() - 1);
}

function showMeasurement() {
    modal('#modal-olcum', true);
}

function PrintAction() {
    if (!Object.keys(window.SearchMapItems).length) {
        TitleAlertMessage('Yazdırılacak Parsel Bulunamadı!', 'info');
        return;
    }

    printItems();
    modal('#modal-yazdir', true);
}

let listenerHandle;

function MapQueryAction(auto = true) {

    if (!this.classList.contains('active') && auto) {
        this.classList.add('active');
        TitleAlertMessage('Parsel bilgilerini görüntülemek istediğiniz alanı işaretleyiniz.', 'info');
        myMap.setOptions({ draggableCursor: 'crosshair' });

        listenerHandle = google.maps.event.addListener(myMap, 'click', function(event) {
            const lat = event.latLng.lat()
            const lng = event.latLng.lng()

            drawMap(lat, lng);
        });


    } else {
        this.classList.remove('active');
        myMap.setOptions({ draggableCursor: 'auto' });
        if (listenerHandle) {
            google.maps.event.removeListener(listenerHandle);
            listenerHandle = null;
        }
    }
}

function MeasureAction() {
    // haritadan seçimi kapat
    MapQueryAction.call(document.getElementById('map-query-btn'), false);
    const measure = document.querySelector('input[name=measure]:checked').value;
    if (!measure) return;

    TitleAlertMessage('Ölçüm işlemini bitirmek için son noktaya tıklayabilirsiniz.', 'info');
    modal('#modal-olcum', false);

    if (measure == 'area') {
        AREA();
        return;
    }

    if (measure == 'distance') {
        DISTANCE();
        return;
    }

}
/** ALAN HESABI */

let AreaClickEvent = null;
let AreaPreviewEvent = null;
let Areas = {};

function AREA() {
    // if(AreaClickEvent) return;
    STOPDISTANCE();

    const AreaId = Date.now();
    Areas[AreaId] = {
        Apolygon: null,
        AcurrentDraggingMarker: null,
        Amarkers: [],
        AhiddenMarkers: [],
        AareaField: null,
        lastInsert: null,
        trianglePolyline: null,
        trianglePolyline2: null
    };

    AreaClickEvent = google.maps.event.addListener(myMap, 'click', function(event) {
        if (Areas[AreaId].AcurrentDraggingMarker) return;
        addAreaMarker(AreaId, event.latLng, null);
        updateAreaPolygon(AreaId);
    });

    if (!MAPHELPER.isTouchDevice || !MAPHELPER.isMobile) {
        AreaPreviewEvent = google.maps.event.addListener(myMap, 'mousemove', function(event) {
            if (Areas[AreaId].AcurrentDraggingMarker) return;
            if (Areas[AreaId].Amarkers.length < 2) return;

            drawAreaPreviewLines(AreaId, event.latLng);
        });
    }



}

function STOPAREA() {
    Object.keys(Areas).forEach(key => {
        if (Areas[key].lastInsert) {
            Areas[key].lastInsert.setIcon(MAPHELPER.customIcon("#87CEEB"));
        }
        if (Areas[key].trianglePolyline) {
            Areas[key].trianglePolyline.setMap(null);
        }
        if (Areas[key].trianglePolyline2) {
            Areas[key].trianglePolyline2.setMap(null);
        }
    });
    if (AreaClickEvent) {
        google.maps.event.removeListener(AreaClickEvent)
    }
    if (AreaPreviewEvent) {
        google.maps.event.removeListener(AreaPreviewEvent);
    }


    AreaClickEvent = null;
}
/**
 * 
 * @param {*} location 
 * @param {*} order listenin hangi sırasına ekleneceğini belirler.
 */
function addAreaMarker(AreaId, location, order = null) {

    if (Areas[AreaId].lastInsert) {
        Areas[AreaId].lastInsert.setIcon(MAPHELPER.customIcon("#87CEEB"));
    }

    const marker = new google.maps.Marker({
        position: location,
        map: myMap,
        icon: MAPHELPER.customIcon(AreaClickEvent ? "#FF0000" : "#87CEEB"),
        draggable: true
    });

    const clickListener = google.maps.event.addListener(marker, 'click', function() {
        if (marker === Areas[AreaId].lastInsert) {
            // durdur
            STOPAREA();
        }
    });

    const dragStartListener = google.maps.event.addListener(marker, 'dragstart', function() {
        Areas[AreaId].AcurrentDraggingMarker = marker;
    });

    const dragendListener = google.maps.event.addListener(marker, 'dragend', function() {
        Areas[AreaId].AcurrentDraggingMarker = null;
        updateAreaPolygon(AreaId);
    });

    const dragListener = google.maps.event.addListener(marker, 'drag', function(event) {
        if (Areas[AreaId].AcurrentDraggingMarker) {
            Areas[AreaId].AcurrentDraggingMarker.setPosition(event.latLng);

            setTimeout(() => {
                updateAreaPolygon(AreaId, marker);
            }, 50);
        }
    });

    google.maps.event.addListener(marker, 'dblclick', function(event) {
        google.maps.event.removeListener(dragStartListener)
        google.maps.event.removeListener(dragendListener)
        google.maps.event.removeListener(dragListener)
        google.maps.event.removeListener(clickListener)
        marker.setMap(null);
        Areas[AreaId].Amarkers = Areas[AreaId].Amarkers.filter(m => m != marker);
        updateAreaPolygon(AreaId);
    });

    marker.customClearEvents = () => {
        google.maps.event.removeListener(dragStartListener)
        google.maps.event.removeListener(dragendListener)
        google.maps.event.removeListener(dragListener)
        google.maps.event.removeListener(clickListener)
    }

    if (order) Areas[AreaId].Amarkers.splice(order, 0, marker);
    else Areas[AreaId].Amarkers.push(marker);

    Areas[AreaId].lastInsert = marker;

    return marker;

}
/**
 * 
 * @param {*} AreaId alanın kimlik bilgisi
 * @param {*} exceptHiddenMarker  hariç tutulacak önizlenen marker bilgisi
 */
function updateAreaPolygon(AreaId, exceptHiddenMarker = null) {
    let polygonPaths = Areas[AreaId].Amarkers.map(function(marker) {
        return marker.getPosition();
    });

    Areas[AreaId].AhiddenMarkers.forEach((a) => a.setMap(null));

    Areas[AreaId].AhiddenMarkers = [];

    for (let i = 0; i < polygonPaths.length - 1; i++) {
        const middlePoint = google.maps.geometry.spherical.interpolate(polygonPaths[i], polygonPaths[i + 1], 0.5);
        const marker = new google.maps.Marker({
            position: middlePoint,
            map: myMap,
            opacity: .4,
            icon: MAPHELPER.customIcon("#808080")
        });


        google.maps.event.addListener(marker, 'click', function(event) {
            addAreaMarker(AreaId, marker.getPosition(), this.i + 1);
        }.bind({ i }));


        Areas[AreaId].AhiddenMarkers.push(marker);
    }


    if (polygonPaths.length >= 2) {

        const middlePoint1 = google.maps.geometry.spherical.interpolate(
            polygonPaths[0],
            polygonPaths[polygonPaths.length - 1],
            0.5
        );
        const marker2 = new google.maps.Marker({
            position: middlePoint1,
            map: myMap,
            opacity: .4,
            icon: MAPHELPER.customIcon("#808080")
        });

        google.maps.event.addListener(marker2, 'click', function() {
            console.log('click')
            marker2.setMap(null);
            updateAreaPolygon(AreaId);
            addAreaMarker(AreaId, marker2.getPosition(), this.i);
        }.bind({ i: polygonPaths.length }));


        Areas[AreaId].AhiddenMarkers.push(marker2);
    }



    if (polygonPaths.length) {
        // Close the polygon
        polygonPaths.push(Areas[AreaId].Amarkers[0].getPosition());
    }


    // Check if the polygon already exists
    if (Areas[AreaId].Apolygon) {
        Areas[AreaId].Apolygon.setPaths([polygonPaths]);
    } else {
        Areas[AreaId].Apolygon = new google.maps.Polygon({
            paths: [polygonPaths],
            strokeColor: "#87CEEB",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#87CEEB",
            fillOpacity: 0.35,
            map: myMap
        });
    }

    const poly_area = google.maps.geometry.spherical.computeArea(polygonPaths)
    const unitText = MAPHELPER.convertAreaUnits(poly_area);
    const centerPosition = MAPHELPER.getCenterLatLng(polygonPaths)

    if (!Areas[AreaId].AareaField) {
        Areas[AreaId].AareaField = new google.maps.InfoWindow({
            content: unitText,
            disableAutoPan: true
        });
    }

    Areas[AreaId].AareaField.setContent(unitText)
    Areas[AreaId].AareaField.setPosition(centerPosition)
    Areas[AreaId].AareaField.open(myMap);
}

function drawAreaPreviewLines(AreaId, currentPosition) {


    if (Areas[AreaId].Amarkers.length < 2) return;
    // İlk nokta
    let firstPoint = Areas[AreaId].Amarkers[0].getPosition();
    // Son nokta
    let lastPoint = Areas[AreaId].Amarkers[Areas[AreaId].Amarkers.length - 1].getPosition();
    // Mevcut fare pozisyonu

    let fark = Math.pow(10, Math.min((19 - myMap.getZoom()), 1));

    // Noktanın ve dairenin en yakın noktasını hesapla
    const closestPoint = google.maps.geometry.spherical.computeOffset(
        currentPosition,
        fark,
        google.maps.geometry.spherical.computeHeading(currentPosition, firstPoint)
    );

    // Üçgeni temsil eden polyline'ı oluştur

    if (!Areas[AreaId].trianglePolyline) {
        Areas[AreaId].trianglePolyline = new google.maps.Polyline({
            path: [firstPoint, closestPoint],
            geodesic: true,
            strokeColor: '#0000ff',
            strokeOpacity: 1.0,
            strokeWeight: 1,
            map: myMap,
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 4
                },
                offset: '0',
                repeat: '20px' // Çizgilerin arasındaki mesafe
            }],
        });
    } else {
        Areas[AreaId].trianglePolyline.setPath([firstPoint, closestPoint]);
    }

    const closestPoint2 = google.maps.geometry.spherical.computeOffset(
        currentPosition, fark,
        google.maps.geometry.spherical.computeHeading(currentPosition, lastPoint)
    );

    // Üçgeni temsil eden polyline'ı oluştur
    if (!Areas[AreaId].trianglePolyline2) {
        Areas[AreaId].trianglePolyline2 = new google.maps.Polyline({
            path: [lastPoint, closestPoint2],
            geodesic: true,
            strokeColor: '#0000ff',
            strokeOpacity: 1.0,
            strokeWeight: 1,
            map: myMap,
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 4
                },
                offset: '0',
                repeat: '20px' // Çizgilerin arasındaki mesafe
            }],
        });
    } else {
        Areas[AreaId].trianglePolyline2.setPath([lastPoint, closestPoint2]);
    }

}

/*** /ALAN HESABI */


let Distances = {};
let isDistanceMode = false;

function DISTANCE() {
    // if(isDistanceMode) return;

    STOPAREA();

    isDistanceMode = true;
    const DistanceId = Date.now();
    Distances[DistanceId] = {
        events: {
            click: null,
            mouseOver: null,
            mouseOut: null,
            mousemove: null
        },
        clearEvents: () => {
            Object.keys(Distances[DistanceId].events).forEach(event => {
                if (Distances[DistanceId].events[event]) {
                    google.maps.event.removeListener(Distances[DistanceId].events[event]);
                }
            })
        },
        currentDraggingMarker: null,
        Dmarkers: [],
        DhiddenMarkers: [],
        windows: [],
        trianglePolyline: null,
        infoMeters: null,
        lastInsert: null
    };
    // Fare hareketlerini izle
    Distances[DistanceId].events.click = google.maps.event.addListener(myMap, 'click', function(event) {
        if (Distances[DistanceId].currentDraggingMarker) return;

        addDistanceMarker(DistanceId, event.latLng);
        updateDistancePolygon(DistanceId);
    });

    // Harita üzerinde mouse cursor'ını değiştir
    Distances[DistanceId].events.mouseOver = google.maps.event.addListener(myMap, 'mouseover', function() {
        myMap.setOptions({ draggableCursor: 'crosshair' });
    });
    // Mouse haritadan çıkarsa cursor'ı varsayılan değere geri getir
    Distances[DistanceId].events.mouseOut = google.maps.event.addListener(myMap, 'mouseout', function() {
        myMap.setOptions({ draggableCursor: null });
    });

    if (!MAPHELPER.isTouchDevice || !MAPHELPER.isMobile) {
        Distances[DistanceId].events.mousemove = google.maps.event.addListener(myMap, 'mousemove', function(event) {
            if (Distances[DistanceId].currentDraggingMarker) return;
            if (Distances[DistanceId].Dmarkers.length < 1) return;

            drawDistancePreviewLine(DistanceId, event.latLng);
        });
    }


}

function STOPDISTANCE() {
    isDistanceMode = false;
    Object.keys(Distances).forEach(key => {
        if (Distances[key].lastInsert) {
            Distances[key].lastInsert.setIcon(MAPHELPER.customIcon("#87CEEB"))
        }
        if (Distances[key].trianglePolyline) {
            Distances[key].trianglePolyline.setMap(null);
        }
        // son pencereyi kapat
        if (
            Distances[key].infoMeters
        ) {
            Distances[key].infoMeters.setMap(null);
        }

        Object.keys(Distances[key].events).forEach(event => {
            if (Distances[key].events[event]) {
                google.maps.event.removeListener(Distances[key].events[event]);
            }
        });
    });

    myMap.setOptions({ draggableCursor: null });

}

function addDistanceMarker(DistanceId, position, order = null) {
    if (Distances[DistanceId].lastInsert) {
        Distances[DistanceId].lastInsert.setIcon(MAPHELPER.customIcon("#87CEEB"));
    }
    // marker move
    const marker = new google.maps.Marker({
        position: position,
        map: myMap,
        icon: MAPHELPER.customIcon(isDistanceMode ? '#ff0000' : "#87CEEB"),
        draggable: true
    });

    Distances[DistanceId].lastInsert = marker;

    const clickListener = google.maps.event.addListener(marker, 'click', function() {
        if (marker === Distances[DistanceId].lastInsert) {
            // durdur
            STOPDISTANCE();
        }
    });

    const dragStartListener = google.maps.event.addListener(marker, 'dragstart', function() {
        Distances[DistanceId].currentDraggingMarker = marker;
    });

    const dragendListener = google.maps.event.addListener(marker, 'dragend', function() {
        Distances[DistanceId].currentDraggingMarker = null;
        updateDistancePolygon(DistanceId);
    });

    const dragListener = google.maps.event.addListener(marker, 'drag', function(event) {
        if (Distances[DistanceId].currentDraggingMarker) {
            Distances[DistanceId].currentDraggingMarker.setPosition(event.latLng);
            updateDistancePolygon(DistanceId);
        }
    });

    google.maps.event.addListener(marker, 'dblclick', function(event) {
        marker.customClearEvents();
        marker.setMap(null);
        Distances[DistanceId].Dmarkers = Distances[DistanceId].Dmarkers.filter(m => m != marker);
        updateDistancePolygon(DistanceId);
    });

    marker.customClearEvents = () => {
        dragStartListener && google.maps.event.removeListener(dragStartListener)
        dragendListener && google.maps.event.removeListener(dragendListener)
        dragListener && google.maps.event.removeListener(dragListener)
        clickListener && google.maps.event.removeListener(clickListener)
    }


    if (order) Distances[DistanceId].Dmarkers.splice(order, 0, marker);
    else Distances[DistanceId].Dmarkers.push(marker);

    return marker;
}

function updateDistancePolygon(DistanceId) {

    Distances[DistanceId].DhiddenMarkers.forEach(d => {
        d.setMap(null);
    });
    Distances[DistanceId].DhiddenMarkers = [];

    Distances[DistanceId].windows.forEach((f) => { f.close(); })
    Distances[DistanceId].windows.windows = [];


    if (Distances[DistanceId].Dmarkers.length < 2) {
        return;
    }

    for (let i = 0; i < Distances[DistanceId].Dmarkers.length - 1; i++) {
        const point1 = Distances[DistanceId].Dmarkers[i].getPosition();
        const point2 = Distances[DistanceId].Dmarkers[i + 1].getPosition();

        const middlePoint = google.maps.geometry.spherical.interpolate(
            point1,
            point2,
            0.5
        );
        const marker = new google.maps.Marker({
            position: middlePoint,
            map: myMap,
            opacity: .5,
            icon: MAPHELPER.customIcon("#dadada")
        });

        google.maps.event.addListener(marker, 'click', function() {
            addDistanceMarker(DistanceId, marker.getPosition(), this.i + 1);
        }.bind({ i }));

        Distances[DistanceId].DhiddenMarkers.push(marker);
    }

    let totalDistance = 0;

    for (let i = 0; i < Distances[DistanceId].Dmarkers.length - 1; i++) {
        const point1 = Distances[DistanceId].Dmarkers[i].getPosition();
        const point2 = Distances[DistanceId].Dmarkers[i + 1].getPosition();

        // Çizgi çiz
        const line = new google.maps.Polyline({
            path: [point1, point2],
            geodesic: true,
            strokeColor: "#0000ff",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map: myMap,
        });
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);

        let text = '';


        if (totalDistance > 0) {
            text = `${Math.round(totalDistance + distance)} m </br>(+${Math.round(distance)} m)`
        } else {
            text = `${Math.round(distance)} m`
        }


        const infowindow = new google.maps.InfoWindow({
            content: `<div style="font-size:10px">${text}</div>`,
            pixelOffset: new google.maps.Size(-5, -5)
        });
        Distances[DistanceId].windows.push(infowindow)

        infowindow.setPosition(point2);
        infowindow.open(myMap);
        totalDistance += distance;

        Distances[DistanceId].DhiddenMarkers.push(line);

    }

}

function drawDistancePreviewLine(DistanceId, position) {

    if (Distances[DistanceId].Dmarkers.length < 1) return;

    // Son nokta
    const lastPoint = Distances[DistanceId].Dmarkers[Distances[DistanceId].Dmarkers.length - 1].getPosition();

    let fark = Math.pow(10, Math.min((19 - myMap.getZoom()), 1));

    // Noktanın ve dairenin en yakın noktasını hesapla
    const closestPoint = google.maps.geometry.spherical.computeOffset(
        position,
        fark,
        google.maps.geometry.spherical.computeHeading(position, lastPoint)
    );


    if (!Distances[DistanceId].trianglePolyline) {
        // Üçgeni temsil eden polyline'ı oluştur
        Distances[DistanceId].trianglePolyline = new google.maps.Polyline({
            path: [lastPoint, closestPoint],
            geodesic: true,
            strokeColor: '#0000ff',
            strokeOpacity: 1.0,
            strokeWeight: 1,
            map: myMap,
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 2
                },
                offset: '0',
                repeat: '20px' // Çizgilerin arasındaki mesafe
            }],
        });
    } else {
        Distances[DistanceId].trianglePolyline.setPath([lastPoint, closestPoint]);
    }

    let totalDistance = 0;
    for (let i = 0; i < Distances[DistanceId].Dmarkers.length - 1; i++) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            Distances[DistanceId].Dmarkers[i].getPosition(),
            Distances[DistanceId].Dmarkers[i + 1].getPosition()
        );
        totalDistance += distance;
    }
    const distance = google.maps.geometry.spherical.computeDistanceBetween(position, lastPoint);
    let text = '';
    if (totalDistance > 0) {
        text = `${Math.round(totalDistance + distance)} m </br>(+${Math.round(distance)} m)`
    } else {
        text = `${Math.round(distance)} m`
    }


    if (!Distances[DistanceId].infoMeters) {
        Distances[DistanceId].infoMeters = new google.maps.InfoWindow({
            content: '',
            pixelOffset: new google.maps.Size(-15, -15)
        });
    }
    Distances[DistanceId].infoMeters.setContent(`<div style="font-size:10px">${text}</div>`);
    Distances[DistanceId].infoMeters.setPosition(position);
    Distances[DistanceId].infoMeters.open(myMap);
}


const storeItems = [];

window.addEventListener('SETMAP_COORDS', e => {

    storeItems.forEach(item => {
        item.setMap(null);
    });

    storeItems.length = 0;


    if (!e.detail.geometry) return;

    console.log(e.detail)

    const coordinates = e.detail.geometry.coordinates;
    const bounds = new google.maps.LatLngBounds();

    for (let i = 0; i < coordinates.length; i++) {

        const polygon = e.detail.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

        const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
        const center = MAPHELPER.getCenter(triangleCoords);
        // Construct the polygon.
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
        myMap.setCenter(center);
        storeItems.push(bermudaTriangle);

        // Her üçgenin sınırlarını bounds'a ekleyin
        triangleCoords.forEach(coord => {
            bounds.extend(coord);
        });
    }
    myMap.fitBounds(bounds);

    console.log(e);
    return;
});


window.SearchMapItems = {};


function drawMap(lat, lng) {
    fetch(`${API_URL}?type=bilgi&enlem=${lat}&boylam=${lng}`).then(re => re.json())
        .then(response => {

            if (response.status !== 200) {
                TitleAlertMessage(response.data.Message, 'danger');
                return;
            }
            const key = `${response.data.properties.mahalleId}/${response.data.properties.adaNo}/${response.data.properties.parselNo}`;

            if (SearchMapItems[key]) {
                return;
            }

            SearchMapItems[key] = {
                data: response.data,
                polygon: null,
                markers: [],
                polys: [],
                mainWindow: null,
                windows: [],
                positionMarkers: [],
                selectedPositionInfo: null,
                textMarker: null,
            }

            const coordinates = response.data.geometry.coordinates;
            const bounds = new google.maps.LatLngBounds();


            for (let i = 0; i < coordinates.length; i++) {


                const polygon = response.data.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

                const triangleCoords = polygon.map(p => ({ lat: p[1], lng: p[0] }));
                const center = MAPHELPER.getCenter(triangleCoords);
                
                // GÜNCEL RENKLENDIRME MANTIGI
                let fillColor = "#ff0000"; // Default kırmızı
                
                const basvuru_turu = response.data.properties.basvuru_turu;
                const tapu_durum = response.data.properties.durum;
                
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

                // Construct the polygon.
                SearchMapItems[key].polygon = new google.maps.Polygon({
                    paths: triangleCoords,
                    strokeWeight: 2,
                    fillColor: fillColor,
                    fillOpacity: 0.35,
                    map: myMap
                });


                google.maps.event.addListener(SearchMapItems[key].polygon, 'click', function(event) {
                    // bilgileri göster
                    setPanel(response.data);
                    modal('#info-modal', true);
                    // Admin paneldeki TKGM değişim kontrolünü tetikle (varsa)
                    const p = response.data.properties || {};
                    const mid = p.mahalleId || p.mahalle_id || null;
                    const adaNo = p.adaNo || p.AdaBilgisi || p.ada || null;
                    const parselNo = p.parselNo || p.ParselBilgisi || p.parsel || null;
                    const fireCheck = (targetWin) => {
                        if (targetWin && typeof targetWin.runPopupTkgmCheck === 'function' && mid && adaNo !== null && parselNo !== null) {
                            try {
                                targetWin.runPopupTkgmCheck(mid, adaNo, parselNo);
                                return true;
                            } catch (err) {
                                console.warn('runPopupTkgmCheck çağrısı başarısız', err);
                            }
                        }
                        return false;
                    };
                    // Önce iframe içindeki adminPanel'e, yoksa aynı pencereye dene
                    const iframe = document.getElementById('adminPanelInlineIframe');
                    if (!(iframe && fireCheck(iframe.contentWindow))) {
                        fireCheck(window);
                    }

                    if (typeof window.fetchImarApiForCurrentParcel === 'function') {
                        window.fetchImarApiForCurrentParcel();
                    }
                });

                myMap.setCenter(center);

                /** Çevresini hesapla */

                const marker = new google.maps.Marker({
                    position: center,
                    map: myMap,
                    icon: ' ',
                    label: {
                        color: '#000000',
                        fontWeight: 'bold',
                        text: `${ response.data.properties.adaNo}/${ response.data.properties.parselNo}`,
                        fontSize: '15px',
                        fontFamily: 'Roboto, Arial, sans-serif, custom-label-init'
                    }
                });
                SearchMapItems[key].markers.push(marker);

                setTimeout(() => {
                    document.querySelectorAll("[style*='custom-label-init']").forEach((i) => {
                        i.style.textShadow = '1px 1px #fff';
                    })
                }, (750));
                /** Çevre Hesabı  */

                triangleCoords.forEach(coord => {
                    bounds.extend(coord);
                });
            }
            myMap.fitBounds(bounds);


        }).catch(e => {
            // haritadan seçimi kapat
            MapQueryAction.call(document.getElementById('map-query-btn'), false);
            TitleAlertMessage('Bir sorun oluştu', 'danger');
            console.log(e)
        })
}




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

    const isValidLatLng = (lat, lng) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
        // Özellikle 0,0 gibi outlier noktalar fitBounds'u dünyaya kaçırıyor
        if (lat === 0 && lng === 0) return false;
        return true;
    };

    // Bulk çizimlerde (Sorguya Git) otomatik fitBounds yapılmasın.
    const autoFitEnabled = !(
        typeof window !== 'undefined' &&
        typeof window.allowMapZoom !== 'undefined' &&
        window.allowMapZoom === false
    );
    let boundsPointCount = 0;



    for (let i = 0; i < coordinates.length; i++) {

        const polygon = e.detail.geometry.type == "MultiPolygon" ? coordinates[i][0] : coordinates[i];

        // Koordinat doğrulama: bozuk/outlier nokta varsa bu poligonu çizme (fitBounds'u dünyaya kaçırıyor)
        let hasInvalid = false;
        const triangleCoords = polygon.map(p => {
            const lat = p?.[1];
            const lng = p?.[0];
            if (!isValidLatLng(lat, lng)) hasInvalid = true;
            return { lat, lng };
        });
        if (hasInvalid) {
            console.warn('⚠️ [SETMAP_FIELD] Geçersiz/outlier koordinat tespit edildi, poligon atlandı:', key);
            continue;
        }
        if (triangleCoords.length < 3) {
            console.warn('⚠️ [SETMAP_FIELD] Yetersiz koordinat (3<), poligon atlandı:', key);
            continue;
        }
        const center = MAPHELPER.getCenter(triangleCoords);
        
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

        // Construct the polygon.
        SearchMapItems[key].polygon = new google.maps.Polygon({
            paths: triangleCoords,
            strokeWeight: 2,
            fillColor: fillColor,
            fillOpacity: 0.35,
        });


        SearchMapItems[key].polygon.setMap(myMap);

        google.maps.event.addListener(SearchMapItems[key].polygon, 'click', function(event) {
            // bilgileri göster
            setPanel(e.detail);
            modal('#info-modal', true);
            if (typeof window.fetchImarApiForCurrentParcel === 'function') {
                window.fetchImarApiForCurrentParcel();
            }
        });

        //myMap.setCenter(center);
        // Create custom SVG icon (pin shape with PL inside)
        const customSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
        <path fill="#4285F4" d="M18 0C8.1 0 0 8.1 0 18c0 7.9 5.8 14.5 13.4 15.8L18 48l4.6-14.2C30.2 32.5 36 25.9 36 18c0-9.9-8.1-18-18-18z"/>
        <circle cx="18" cy="18" r="12" fill="#FFF"/>
        <text x="18" y="23" font-family="Arial" font-size="14" fill="#4285F4" text-anchor="middle" font-weight="bold">PL</text>
    </svg>
`;

        // Convert SVG to data URL
        const svgUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(customSVG);

        // Create marker with custom icon
        SearchMapItems[key].centerMarker = new google.maps.Marker({
            position: center,
            map: myMap,
            icon: {
                url: svgUrl,
                scaledSize: new google.maps.Size(36, 48),
                anchor: new google.maps.Point(18, 48),
                labelOrigin: new google.maps.Point(18, 60) // Move label below the pin
            }
        });
        /** Çevresini hesapla */

        SearchMapItems[key].textMarker = new google.maps.Marker({
            position: center,
            map: myMap,
            icon: ' ',
            label: {
                color: '#000000',
                fontWeight: 'bold',
                text: `${e.detail.properties.adaNo}/${e.detail.properties.parselNo}`,
                fontSize: '10px',
                fontFamily: 'Roboto, Arial, sans-serif, custom-label-init'
            }
        });



        setTimeout(() => {
            document.querySelectorAll("[style*='custom-label-init']").forEach((i) => {
                i.style.textShadow = '1px 1px #fff';
            })
        }, (750));
        /** Çevre Hesabı  */

        drawLinesAndDistances(myMap, key, triangleCoords, e.detail.properties.alan);

        triangleCoords.forEach(coord => {
            bounds.extend(coord);
            boundsPointCount++;
        });


    }

    if (autoFitEnabled && boundsPointCount > 0) {
        myMap.fitBounds(bounds);
    }
    return;
});


function drawLinesAndDistances(map, key, coords, area) {

    let totalDistance = 0;

    for (let i = 0; i < coords.length - 1; i++) {
        const point1 = coords[i];
        const point2 = coords[i + 1];

        // Çizgi çiz
        const line = new google.maps.Polyline({
            path: [point1, point2],
            geodesic: true,
            strokeColor: "#ffffff",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map: map,
        });

        SearchMapItems[key].polys.push(line);

        // Mesafeyi hesapla ve yazdır
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
        totalDistance += distance;
        const middlePoint = google.maps.geometry.spherical.interpolate(point1, point2, 0.5);
        /*
        const rotation = google.maps.geometry.spherical.computeHeading(
          point1,
          point2
        );
        */
        /* Marker nokta gizleme
	  const marker = new google.maps.Marker({
            position: middlePoint,
            map: map,
            icon: ' ',
            label: {
                color: '#ffffff',
                fontWeight: 'bold',
                text: `${distance.toFixed(2)} m`,
                fontSize: '11px',
            
            },
        });
        SearchMapItems[key].markers.push(marker);

        const positionMarker = new google.maps.Marker({
            position: point1,
            map: map,
            icon: {
                ...MAPHELPER.customIcon("#87CEEB"),
                origin: new google.maps.Point(10,10), // origin
                anchor: new google.maps.Point(0, 0) // anchor
            }
        });

        SearchMapItems[key].positionMarkers.push(positionMarker);
      

        const infowindow = new google.maps.InfoWindow({
            content: `
                <table class="table table-bordered table-striped" style="font-size: 10px;margin-bottom:0px !important">
                <tbody>
                <tr>
                    <td colspan="2" style="text-align:center;background-color: #f7f7f7;color: #000;border:solid 1px #ddd">Kordinat</td>
                </tr>
                <tr>
                    <td style="width:50%">Enlem</td>
                    <td>${positionMarker.position.lat()}</td>
                </tr>
                <tr>
                    <td>Boylam</td>
                    <td>${positionMarker.position.lng()}</td>
                </tr>
                </tbody>
            </table>
            `,
            ariaLabel: "Position",
        });

        SearchMapItems[key].windows.push(infowindow); */
    }
    // Çevresi baloncuğunu gizle
    // SearchMapItems[key].mainWindow = new google.maps.InfoWindow({
    //     content: `Çevresi : ${totalDistance.toFixed(2)} m </br>
    //               Alan: ${MAPHELPER.formatNumber(area)} m<sup>2</sup>`,
    // });

    // SearchMapItems[key].mainWindow.setPosition(coords[coords.length - 1]);
    // SearchMapItems[key].mainWindow.open(map);

    SearchMapItems[key].positionMarkers.forEach((element, i) => {
        element.addListener("click", () => {

            if (SearchMapItems[key].selectedPositionInfo) {

                if (SearchMapItems[key].selectedPositionInfo == SearchMapItems[key].windows[i]) {
                    if (SearchMapItems[key].windows[i].getMap()) {
                        SearchMapItems[key].selectedPositionInfo.close();
                    } else {
                        SearchMapItems[key].windows[i].open({
                            anchor: element,
                            myMap,
                        });
                    }
                    return; // 2 kez tıklarsa kapat
                } else {
                    SearchMapItems[key].selectedPositionInfo.close();
                }
            }
            SearchMapItems[key].selectedPositionInfo = SearchMapItems[key].windows[i];

            SearchMapItems[key].windows[i].open({
                anchor: element,
                myMap,
            });
        });
    });
}


/** tüm çizimleri sil */
function RefreshAction() {
    STOPAREA();
    STOPDISTANCE();
    Object.keys(Areas).forEach(key => {
        Areas[key].Amarkers.forEach((item) => {
            item.customClearEvents();
            item.setMap(null);
        })
        Areas[key].Amarkers = [];
        Areas[key].AhiddenMarkers.forEach((item) => {
            item.setMap(null);
        })
        Areas[key].AhiddenMarkers = [];
        if (Areas[key].Apolygon) {
            Areas[key].Apolygon.setMap(null);
            Areas[key].Apolygon = null;
        }

        if (Areas[key].AareaField) {
            Areas[key].AareaField.close();
            Areas[key].AareaField = null;
        }
    });

    Areas = {};

    Object.keys(Distances).forEach(key => {
        Distances[key].Dmarkers.forEach((item) => {
            item.customClearEvents();
            item.setMap(null);
        })
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

    Object.keys(SearchMapItems).forEach(key => {
        const item = SearchMapItems[key];
        if (!item) return;

        // Merkez PL ikonu
        if (item.centerMarker) {
            item.centerMarker.setMap(null);
        }

        // Diğer markerlar
        if (Array.isArray(item.markers)) {
            item.markers.forEach(marker => marker.setMap(null));
        }

        // Parsel poligonu
        if (item.polygon) {
            item.polygon.setMap(null);
        }

        // Kenar çizgileri
        if (Array.isArray(item.polys)) {
            item.polys.forEach(p => p.setMap(null));
        }

        // Info pencereleri
        if (item.mainWindow) {
            item.mainWindow.setMap(null);
        }
        if (Array.isArray(item.windows)) {
            item.windows.forEach(w => w.setMap(null));
        }

        // Köşe markerları
        if (Array.isArray(item.positionMarkers)) {
            item.positionMarkers.forEach(pm => pm.setMap(null));
        }

        // Ada/parsel text label
        if (item.textMarker) {
            item.textMarker.setMap(null);
        }
    });

    SearchMapItems = {};

    /**
     * SearchMapItems[key] = {
        data: e.detail,
        polygon: null,
        markers: [],
        polys: [],
        mainWindow: null,
        windows: [],
        positionMarkers: [],
        selectedPositionInfo: null
    }
     */

}
