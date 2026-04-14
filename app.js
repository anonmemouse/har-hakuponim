// הר הקופונים — app.js v2.0
let ALL_DATA = [];
let SORT = { key: 'date', asc: false };
let CHART_INSTANCE = null;
let SELECTED = new Set();

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_LABELS = { new: '✅ חדש', used: '🔵 נוצל', expired: '❌ פג תוקף', unknown: '❓ לא ידוע' };
const PRIORITY_META = {
  HIGH:   { emoji: '🔥', label: 'דחוף', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)' },
  MEDIUM: { emoji: '💡', label: 'בינוני', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)' },
  LOW:    { emoji: '📌', label: 'נמוך',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)' }
};

// vendor → [display name, website, deep-link template]
const VENDOR_MAP = [
  ['buyme',       'BuyMe',       'https://www.buyme.co.il',        'https://www.buyme.co.il/check?code={code}'],
  ['powercard',   'PowerCard',   'https://www.powercard.co.il',    'https://www.powercard.co.il/balance?card={code}'],
  ['dream card',  'Dream Card',  'https://www.dreamcard.co.il',    null],
  ['תו הזהב',    'תו הזהב',     'https://www.tavhazahav.co.il',   null],
  ['שופרסל',     'שופרסל',      'https://www.shufersal.co.il',    null],
  ['יוחננוף',    'יוחננוף',     'https://www.yochananof.co.il',   null],
  ['סופר פארם',  'סופר-פארם',   'https://www.super-pharm.co.il',  null],
  ['טיב טעם',    'טיב טעם',     'https://www.tivtaam.co.il',      null],
  ['מקס',        'MAX',         'https://www.max.co.il',          null],
  ['כאל',        'כאל',         'https://www.cal-online.co.il',   null],
  ['ישראכרט',    'ישראכרט',     'https://www.isracard.co.il',     null],
  ['הוט',        'מועדון הוט',  'https://www.hot.net.il',         null],
  ['המשביר',     'המשביר',      'https://www.hamashbir.co.il',    null],
  ['רמי לוי',    'רמי לוי',     'https://www.rami-levy.co.il',    null],
  ['fox',         'FOX',         'https://www.foxfashion.com',     null],
  ['castro',      'Castro',      'https://www.castro.com',         null],
  ['h&m',         'H&M',         'https://www2.hm.com/he_il',      null],
  ['ksp',         'KSP',         'https://ksp.co.il',              null],
  ['ace',         'ACE',         'https://www.ace.co.il',          null],
  ['ארומה',      'ארומה',       'https://www.aroma.co.il',        null],
  ['קפה גרג',    'קפה גרג',     'https://www.coffeegang.co.il',   null],
  ['terminal x',  'Terminal X',  'https://www.terminalx.com',      null],
  ['renuar',      'Renuar',      'https://www.renuar.co.il',       null],
  ['htzone',      'HTzone',      'https://www.htzone.co.il',       null]
];

const RE = {
  voucher: /שובר|קופון|הטבה|מתנה|voucher|coupon|gift.?card|כרטיס מתנה|קוד שובר|תו קניה|תו קנייה|מימוש|גיפט/i,
  exclude: /קוד אימות|otp|חד פעמי|verification|חשבונית|מעקב משלוח|פנגו|הלוואה|ריבית|להסרה|הסרה/i,
  expiry: /(?:תוקף|בתוקף|עד תאריך|valid until|expires?)[^\d]{0,20}(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
  amount: /(\d{2,5})\s*(?:₪|ש"ח|ILS)/g,
  dateCell: /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\w{3}\s+\d{1,2},\s+\d{4}/i,
  codes: [
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,
    /\b[A-Z]{2,}[A-Z0-9-]{4,18}\b/g,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    /\b\d{8,16}\b/g
  ]
};

// ─── INIT ───
$(function() {
  $('#loadBtn').click(() => $('#fileInput').click());
  $('#fileInput').change(e => loadFile(e.target.files[0]));
  $('#resetBtn').click(resetFilters);
  $('#exportBtn').click(exportCSV);
  $('#chartType, #chartData').on('change', renderChart);
  $('#searchInput, #statusFilter, #vendorFilter').on('input change', renderTable);

  // Stat card quick filter
  $(document).on('click', '.stat-card[data-filter]', function() {
    const f = $(this).data('filter');
    const v = $(this).data('value');
    if (f === 'priority') { $('#priorityFilter').val(v); }
    else if (f === 'status') { $('#statusFilter').val(v); }
    else if (f === 'amount') { $('#amountFilter').val(v); }
    else { resetFilters(); return; }
    renderTable();
    $('html,body').animate({scrollTop: $('#tableSection').offset().top - 20}, 300);
  });

  // Sort
  $(document).on('click', 'th[data-sort]', function() {
    const k = $(this).data('sort');
    SORT.asc = SORT.key === k ? !SORT.asc : false;
    SORT.key = k;
    renderTable();
  });

  // Copy code
  $(document).on('click', '.copy-btn', function() {
    const code = $(this).data('code');
    navigator.clipboard.writeText(code).then(() => {
      const ok = $(this).siblings('.copy-ok');
      ok.fadeIn(100).delay(1000).fadeOut(200);
    });
  });

  // Status dropdown change
  $(document).on('change', '.status-select', function() {
    const id = $(this).closest('tr').data('id');
    const row = ALL_DATA.find(r => r.id === id);
    if (row) { row.status = $(this).val(); updateStats(); }
  });

  // Select row checkbox
  $(document).on('change', '.row-check', function() {
    const id = $(this).closest('tr').data('id');
    $(this).is(':checked') ? SELECTED.add(id) : SELECTED.delete(id);
    updateBulkBar();
  });

  // Select all
  $(document).on('change', '#selectAll', function() {
    const checked = $(this).is(':checked');
    SELECTED.clear();
    $('#tableBody tr').each(function() {
      const id = $(this).data('id');
      if (id !== undefined) {
        checked ? SELECTED.add(id) : SELECTED.delete(id);
      }
    });
    $('.row-check').prop('checked', checked);
    updateBulkBar();
  });

  // Bulk status change
  $(document).on('change', '#bulkStatus', function() {
    const val = $(this).val();
    if (!val) return;
    SELECTED.forEach(id => {
      const row = ALL_DATA.find(r => r.id === id);
      if (row) row.status = val;
    });
    SELECTED.clear();
    $('#selectAll').prop('checked', false);
    $(this).val('');
    updateBulkBar();
    renderTable();
    updateStats();
  });

  // Vendor click → open website
  $(document).on('click', '.vendor-link', function(e) {
    e.stopPropagation();
  });

  // Filters from #priorityFilter
  $('#priorityFilter').on('change', renderTable);
});

// ─── FILE LOADING ───
function loadFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  setProgress(15, 'קורא ' + file.name + '...');
  const reader = new FileReader();
  reader.onload = e => {
    setProgress(40, 'מחפש קודי שובר...');
    try {
      let rows = ext === 'csv' ? parseCSV(e.target.result)
               : ext === 'xml' ? parseXML(e.target.result)
               : parseHTML(e.target.result);
      ALL_DATA = rows.map((r, i) => ({...r, id: i}));
      setProgress(90, 'בונה ממשק...');
      setTimeout(() => { $('#progressWrap').hide(); initUI(); }, 300);
    } catch(err) {
      alert('שגיאה: ' + err.message);
      $('#progressWrap').hide();
    }
  };
  reader.readAsText(file, 'utf-8');
}

function setProgress(pct, text) {
  $('#progressFill').css('width', pct + '%');
  $('#progressText').text(text);
  $('#progressWrap').show();
}

// ─── PARSERS ───
function normalizeDate(raw) {
  if (!raw) return '';
  // Try timestamp
  const ts = parseInt(raw);
  if (!isNaN(ts) && ts > 1e10) return new Date(ts).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'numeric'});
  // Try parse known formats
  const m = String(raw).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) {
    let [,d,mo,y] = m;
    if (y.length===2) y = '20'+y;
    return `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${y}`;
  }
  // Try locale string → reformat
  const d = new Date(raw);
  if (!isNaN(d)) return d.toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'numeric'});
  return raw;
}

function parseHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = [];
  $(doc).find('tr').each(function() {
    const cells = $(this).find('td');
    if (cells.length < 3) return;
    const msgCell = cells.filter('.dont-break-out').first();
    const text = (msgCell.length ? msgCell.text() : cells.last().text()).trim();
    if (!text || !RE.voucher.test(text) || RE.exclude.test(text)) return;
    const allText = cells.map((_, el) => $(el).text().trim()).get();
    const date = normalizeDate(allText.find(t => RE.dateCell.test(t)) || '');
    const sender = allText.find(t => t && t !== text && t.length < 60 && t !== 'Received' && t !== 'Sent') || '';
    const parsed = buildRows({ date, sender, text });
    if (parsed) rows.push(...parsed);
  });
  return rows;
}

function parseXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rows = [];
  $(doc).find('sms').each(function() {
    const text = $(this).attr('body') || '';
    const sender = $(this).attr('contact_name') || $(this).attr('address') || '';
    const ts = parseInt($(this).attr('date'));
    const date = normalizeDate(ts ? String(ts) : '');
    const parsed = buildRows({ date, sender, text });
    if (parsed) rows.push(...parsed);
  });
  return rows;
}

function parseCSV(csv) {
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return result.data.flatMap(row => buildRows({
    date: normalizeDate(row.date || row.Date || ''),
    sender: row.sender || row.address || row.Sender || '',
    text: row.body || row.message || row.text || row.Message || ''
  }) || []);
}

function buildRows(item) {
  const text = (item.text || '').trim();
  if (!text || !RE.voucher.test(text) || RE.exclude.test(text)) return null;
  const codes = extractCodes(text);
  const amounts = extractAmounts(text);
  const expiry = normalizeDate(extractExpiry(text));
  const expired = isExpired(expiry);
  const [vendor, website, deepLink] = identifyVendor(item.sender || '', text);
  const priority = (codes.length && amounts.length) ? 'HIGH' : codes.length ? 'MEDIUM' : 'LOW';
  const baseRow = {
    date: item.date || '',
    vendor, website, deepLink,
    priority,
    amount: amounts.join(', '),
    expiry, expired,
    message: text,
    status: expired ? 'expired' : 'new'
  };
  return codes.length
    ? codes.map(code => ({...baseRow, code}))
    : [{...baseRow, code: 'ללא קוד'}];
}

function extractCodes(text) {
  const found = [];
  RE.codes.forEach(regex => {
    let m; regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) found.push(m[0]);
  });
  return [...new Set(found)].filter(c => c.length >= 6);
}

function extractAmounts(text) {
  return [...new Set((text.match(RE.amount) || []).map(s => s.match(/\d+/)[0]))];
}

function extractExpiry(text) {
  const m = text.match(RE.expiry);
  return m ? m[1] : '';
}

function isExpired(exp) {
  if (!exp) return false;
  const p = exp.split(/[.\/-]/).map(Number);
  if (p.length < 3) return false;
  let y = p[2]; if (y < 100) y += 2000;
  // handle DD/MM/YYYY
  return new Date(y, p[1]-1, p[0]) < new Date();
}

function identifyVendor(sender, text) {
  const hay = (sender + ' ' + text).toLowerCase();
  for (const [k, name, website, deepLink] of VENDOR_MAP) {
    if (hay.includes(k.toLowerCase())) return [name, website, deepLink];
  }
  return [sender || 'לא ידוע', null, null];
}

// ─── UI ───
function initUI() {
  const vendors = [...new Set(ALL_DATA.map(r => r.vendor))].sort();
  $('#vendorFilter').html('<option value="">כל הספקים</option>' + vendors.map(v => `<option>${escHtml(v)}</option>`).join(''));
  $('#statsGrid, #chartsSection, #filtersSection, #tableSection, #bulkBar').show();
  $('#exportBtn').show();
  updateStats();
  renderChart();
  renderTable();
}

function updateStats() {
  const a = ALL_DATA;
  const total = a.length;
  const stats = [
    { n: a.filter(r=>r.priority==='HIGH').length,   l:'🔥 דחוף',    c:'#fbbf24', filter:'priority', value:'HIGH' },
    { n: a.filter(r=>r.priority==='MEDIUM').length, l:'💡 בינוני',  c:'#60a5fa', filter:'priority', value:'MEDIUM' },
    { n: a.filter(r=>r.priority==='LOW').length,    l:'📌 נמוך',    c:'#94a3b8', filter:'priority', value:'LOW' },
    { n: a.filter(r=>r.status==='new').length,      l:'✅ חדשים',   c:'#6ee7b7', filter:'status',   value:'new' },
    { n: a.filter(r=>r.status==='used').length,     l:'🔵 נוצלו',   c:'#93c5fd', filter:'status',   value:'used' },
    { n: a.filter(r=>r.expired).length,             l:'⏰ פג תוקף', c:'#fca5a5', filter:'status',   value:'expired' },
    { n: a.filter(r=>r.amount).length,              l:'💰 עם סכום', c:'#d8b4fe', filter:'amount',   value:'yes' },
    { n: total,                                     l:'📋 סה"כ',    c:'#e2e8f0', filter:'all',      value:'' }
  ];
  $('#statsGrid').html(stats.map(s =>
    `<div class="stat-card" data-filter="${s.filter}" data-value="${s.value}" title="לחץ לסינון">
      <div class="stat-num" style="color:${s.c}">${s.n}</div>
      <div class="stat-label">${s.l}</div>
    </div>`
  ).join(''));
}

function renderChart() {
  const groupBy = $('#chartData').val() || 'vendor';
  const counts = {};
  ALL_DATA.forEach(r => counts[r[groupBy]] = (counts[r[groupBy]] || 0) + 1);
  const labels = Object.keys(counts).sort((a,b) => counts[b]-counts[a]).slice(0, 14);
  const values = labels.map(l => counts[l]);
  const colors = labels.map((_, i) => `hsla(${(i*27)%360},70%,58%,0.82)`);
  const type = $('#chartType').val() || 'bar';
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (CHART_INSTANCE) CHART_INSTANCE.destroy();
  CHART_INSTANCE = new Chart(ctx, {
    type,
    data: { labels, datasets: [{ label: 'כמות', data: values, backgroundColor: colors, borderColor: colors.map(c=>c.replace('0.82','1')), borderWidth:1, borderRadius: type==='bar'?10:0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: type!=='bar', labels: { color:'#cbd5e1' } } },
      scales: (type==='radar'||type==='polarArea')
        ? { r: { ticks:{color:'#cbd5e1',backdropColor:'transparent'}, grid:{color:'rgba(255,255,255,0.1)'}, pointLabels:{color:'#cbd5e1'} } }
        : { x:{ticks:{color:'#cbd5e1'},grid:{color:'rgba(255,255,255,0.07)'}}, y:{beginAtZero:true,ticks:{color:'#cbd5e1'},grid:{color:'rgba(255,255,255,0.07)'}} }
    }
  });
}

function getFiltered() {
  const q = ($('#searchInput').val()||'').toLowerCase();
  const pri = $('#priorityFilter').val();
  const st = $('#statusFilter').val();
  const v = $('#vendorFilter').val();
  const amt = $('#amountFilter').val();
  return ALL_DATA
    .filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q))
    .filter(r => !pri || r.priority === pri)
    .filter(r => !st || r.status === st)
    .filter(r => !v || r.vendor === v)
    .filter(r => !amt || r.amount)
    .sort((a,b) => {
      const va = SORT.key==='priority' ? PRIORITY_RANK[a.priority] : SORT.key==='amount' ? (parseFloat(a.amount)||0) : String(a[SORT.key]||'').toLowerCase();
      const vb = SORT.key==='priority' ? PRIORITY_RANK[b.priority] : SORT.key==='amount' ? (parseFloat(b.amount)||0) : String(b[SORT.key]||'').toLowerCase();
      return va < vb ? (SORT.asc?-1:1) : va > vb ? (SORT.asc?1:-1) : 0;
    });
}

function renderTable() {
  const rows = getFiltered();
  $('#resultsCount').text(rows.length + ' תוצאות');
  $('th[data-sort]').removeClass('sorted-asc sorted-desc');
  $(`th[data-sort="${SORT.key}"]`).addClass(SORT.asc ? 'sorted-asc' : 'sorted-desc');
  SELECTED.clear(); updateBulkBar();
  if (!rows.length) {
    $('#tableBody').html('<tr><td colspan="9" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">🔍 לא נמצאו תוצאות</td></tr>');
    return;
  }
  $('#tableBody').html(rows.map(r => {
    const pm = PRIORITY_META[r.priority];
    const priorityBadge = `<span class="priority-badge" style="background:${pm.bg};color:${pm.color};border:1px solid ${pm.border}" title="${pm.label}">${pm.emoji}</span>`;

    // vendor cell with link
    let vendorCell;
    if (r.website) {
      const href = (r.deepLink && r.code && r.code !== 'ללא קוד')
        ? r.deepLink.replace('{code}', encodeURIComponent(r.code))
        : r.website;
      vendorCell = `<a class="vendor-link" href="${href}" target="_blank" rel="noopener" title="פתח אתר ${escHtml(r.vendor)}">${escHtml(r.vendor)} 🔗</a>`;
    } else {
      vendorCell = `<span class="vendor-name">${escHtml(r.vendor)}</span>`;
    }

    const codeHtml = (r.code && r.code !== 'ללא קוד')
      ? `<div class="code-line"><span class="code-pill">${escHtml(r.code)}</span><button class="copy-btn" data-code="${escHtml(r.code)}">📋</button><span class="copy-ok">✅</span></div>`
      : `<span style="color:rgba(255,255,255,0.3);font-size:12px">ללא קוד</span>`;

    const statusSelect = `<select class="status-select s-${r.status}">
      <option value="new"    ${r.status==='new'    ?'selected':''}>✅ חדש</option>
      <option value="used"   ${r.status==='used'   ?'selected':''}>🔵 נוצל</option>
      <option value="expired"${r.status==='expired'?'selected':''}>❌ פג תוקף</option>
      <option value="unknown"${r.status==='unknown'?'selected':''}>❓ לא ידוע</option>
    </select>`;

    const short = r.message.length > 60 ? r.message.substring(0,60)+'…' : r.message;
    const msgCell = `<span class="msg-short has-tooltip" data-tooltip="${escHtml(r.message)}">${escHtml(short)}</span>`;

    const expiryColor = r.expired ? '#fca5a5' : r.expiry ? '#fde68a' : 'inherit';

    return `<tr class="${r.expired?'expired-row':''}" data-id="${r.id}">
      <td><input type="checkbox" class="row-check" ${SELECTED.has(r.id)?'checked':''}></td>
      <td>${priorityBadge}</td>
      <td style="white-space:nowrap;font-size:12px">${escHtml(r.date)}</td>
      <td>${vendorCell}</td>
      <td style="font-weight:700;color:#6ee7b7">${r.amount?'₪'+r.amount:''}</td>
      <td style="font-size:12px;color:${expiryColor}">${escHtml(r.expiry)}</td>
      <td>${codeHtml}</td>
      <td>${msgCell}</td>
      <td>${statusSelect}</td>
    </tr>`;
  }).join(''));
}

function updateBulkBar() {
  const n = SELECTED.size;
  $('#bulkCount').text(n + ' נבחרו');
  $('#bulkActions').toggle(n > 0);
}

function resetFilters() {
  $('#searchInput').val('');
  $('#priorityFilter, #statusFilter, #vendorFilter, #amountFilter').val('');
  renderTable();
}

function exportCSV() {
  const cols = ['date','vendor','priority','amount','expiry','code','message','status'];
  const csv = '\ufeff' + cols.join(',') + '\n' +
    ALL_DATA.map(r => cols.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'har_hakuponim_export.csv';
  a.click();
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}