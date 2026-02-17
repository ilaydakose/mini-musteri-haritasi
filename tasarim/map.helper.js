const MAPHELPER = {
    getCenter: (polygon) => {
        let data = polygon.map(p => new google.maps.LatLng(p.lat, p.lng) );
        var bounds = new google.maps.LatLngBounds();
        var i;
        for (i = 0; i < data.length; i++) {
            bounds.extend(data[i]);
        }
        return bounds.getCenter();
    },
    getCenterLatLng: (data) =>{
        var bounds = new google.maps.LatLngBounds();
        var i;
        for (i = 0; i < data.length; i++) {
            bounds.extend(data[i]);
        }
    
        return bounds.getCenter();
    },
    convertAreaUnits: (areaInSquareMeters) => {
    
        if(areaInSquareMeters < 1000){
            return `${MAPHELPER.formatNumber(areaInSquareMeters, 2)} m2`
        }
    
        if(areaInSquareMeters < 1000 * 10){
            let dekar = areaInSquareMeters / 1000;
            return `${MAPHELPER.formatNumber(dekar, 2)} daa`
        }
    
        let hektar = areaInSquareMeters / (1000 * 10);
        return `${MAPHELPER.formatNumber(hektar, 2)} ha`
    },

    formatNumber: (number) => {
        // Sayıyı virgülle ayrılmış bir dizeye dönüştür
        const numberString = number.toLocaleString('tr-TR');
      
        // Eğer sayıda ondalık kısım yoksa, ondalık kısmı ekleyin
        if (numberString.indexOf(',') === -1) {
          return numberString + ',00';
        }
      
        return numberString;
    },
    customIcon: (color) => ({ 
        path: 'M -10,-10 L -10,10 L 10,10 L 10,-10 Z', // Kare şeklinde bir yol
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#000',
        strokeWeight: 2,
        scale: .65,
        scaledSize: new google.maps.Size(15, 15), // scaled size
        origin: new google.maps.Point(10,10), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    }),
    isMobile : /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    isTouchDevice:  (navigator.maxTouchPoints || 'ontouchstart' in document.documentElement)

    
}