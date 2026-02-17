(function () {
  // Basit Türkçe upper
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

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // UI hücresi
  function ensureImarCell() {
    const existing = document.getElementById('imar-api-result');
    if (existing) return existing;
    const imarDetayCell = document.getElementById('imar:imar_detay');
    if (!imarDetayCell) return null;
    const table = imarDetayCell.closest('table');
    if (!table) return null;
    const row = document.createElement('tr');
    const labelTd = document.createElement('td');
    labelTd.innerHTML = '<strong>İmar API</strong>';
    const valueTd = document.createElement('td');
    valueTd.id = 'imar-api-result';
    valueTd.textContent = 'İmar API sorgusu bekleniyor...';
    row.appendChild(labelTd);
    row.appendChild(valueTd);
    table.appendChild(row);
    return valueTd;
  }

  // currentPanel + DOM fallback
  function readParcel() {
    const p = (window.currentPanel && window.currentPanel.properties) ? window.currentPanel.properties : {};
    const domText = (id) => {
      const el = document.getElementById(id);
      return el ? (el.textContent || '').trim() : '';
    };
    const merged = {
      il: (p.ilAd || p.il || domText('oznitelik:il')).trim(),
      ilce: (p.ilceAd || p.ilce || domText('oznitelik:ilce')).trim(),
      mahalle: (p.mahalleAd || p.mahalle || p.mahalle_adi || domText('oznitelik:mahalle')).trim(),
      ada: String(p.adaNo || p.ada || p.AdaBilgisi || domText('oznitelik:ada') || '').trim(),
      parsel: String(p.parselNo || p.parsel || p.ParselBilgisi || domText('oznitelik:parsel') || '').trim(),
      id: p.id || p.Id || p.prolegal_id || ''
    };
    if (!merged.il || !merged.ilce || !merged.mahalle || !merged.ada || !merged.parsel) return null;
    return merged;
  }

  // Render helper
  function renderState(state) {
    const cell = ensureImarCell();
    if (!cell) return;
    if (state.type === 'loading') {
      cell.innerHTML = '<span class="spinner-border spinner-border-sm"></span> İmar API sorgulanıyor...';
      return;
    }
    if (state.type === 'error') {
      cell.innerHTML = `<span class="text-danger">❌ ${escapeHtml(state.message)}</span>`;
      if (state.raw) {
        cell.innerHTML += `<div class="text-muted mt-1" style="font-size:12px;">${escapeHtml(state.raw)}</div>`;
      }
      return;
    }
    if (state.type === 'success') {
      const data = state.data || {};
      const status = data.status || '-';
      const plan = data.plan_function || data.planFunction || '-';
      const kaks = data.kaks || '-';
      const taks = data.taks || '-';
      const details = data.parsed_details || {};
      const list = Object.keys(details).map(k => {
        return `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(details[k])}</li>`;
      }).join('');
      cell.innerHTML = `
        <div><strong>Durum:</strong> ${escapeHtml(status)}</div>
        <div><strong>Plan Fonksiyonu:</strong> ${escapeHtml(plan)}</div>
        <div><strong>KAKS:</strong> ${escapeHtml(kaks)}</div>
        <div><strong>TAKS:</strong> ${escapeHtml(taks)}</div>
        ${list ? `<ul class="mb-0" style="padding-left:18px;">${list}</ul>` : ''}
      `;
    }
  }

  let lastKey = null;
  let lastResult = null;
  let inFlightKey = null;

  function makeKey(parcel) {
    return `${parcel.il}|${parcel.ilce}|${parcel.mahalle}|${parcel.ada}|${parcel.parsel}`;
  }

  async function fetchImarApi(reason = '') {
    const parcel = readParcel();
    const cell = ensureImarCell();
    if (!parcel) {
      if (cell) cell.textContent = 'İmar API için il/ilçe/mahalle/ada/parsel eksik.';
      console.warn('İmar API: eksik alan nedeniyle sorgu atlanıyor');
      return;
    }

    const key = makeKey(parcel);
    if (lastKey === key && lastResult) {
      renderState({ type: lastResult.success ? 'success' : 'error', message: lastResult.message, raw: lastResult.raw, data: lastResult.data });
      return;
    }
    if (inFlightKey === key) {
      // Aynı parsel için ikinci tetik: spinner kalsın
      return;
    }

    inFlightKey = key;
    lastResult = null;
    renderState({ type: 'loading' });

    const payload = {
      il: toUpperTr(parcel.il),
      ilce: toUpperTr(parcel.ilce),
      mahalle: toUpperTr(parcel.mahalle),
      ada: String(parcel.ada),
      parsel: String(parcel.parsel)
    };

    console.log('İmar API çağrısı gönderiliyor', { payload, reason });

    try {
      const res = await fetch('api.php?action=imar_api_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      lastKey = key;
      lastResult = json;

      if (!json.success) {
        renderState({
          type: 'error',
          message: json.message || `İmar API başarısız (HTTP ${json.status_code || '-'})`,
          raw: json.raw || ''
        });
        return;
      }

      renderState({ type: 'success', data: json.data || {} });
    } catch (err) {
      renderState({ type: 'error', message: err?.message || 'İmar API çağrısı başarısız' });
    } finally {
      inFlightKey = null;
    }
  }

  // Polygon tıklanınca setPanel -> PROPERTY_PANEL_UPDATED tetikleniyor; burada yakalayıp direkt çağır.
  document.addEventListener('PROPERTY_PANEL_UPDATED', function () {
    fetchImarApi('property_panel_updated');
  });

  // İmar sekmesi açılırsa (gösterim tazelemek için)
  document.addEventListener('shown.bs.tab', function (e) {
    if (e.target && e.target.id === 'info-imar-tab') {
      fetchImarApi('imar_tab_shown');
    }
  });

  window.fetchImarApiForCurrentParcel = fetchImarApi;
})();
