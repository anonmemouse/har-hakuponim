// הר הקופונים — app.js
// SMS backup voucher scanner | Hebrew | Offline

let ALL_DATA = [];
let LAST_DELETED = null;
let SHOW_DELETED = false;
let SORT = { key: 'date', asc: false };
let CHART_INSTANCE = null;

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_CYCLE = ['new', 'used', 'expired', 'unknown'];
const STATUS_LABELS = { new: '✅ חדש', used: '🔵 נוצל', expired: '❌ פג תוקף', unknown: '❓ לא ידוע' };
const PRIORITY_LABELS = { HIGH: '🔴 גבוהה', MEDIUM: '🔵 בינונית', LOW: '⚪ נמוכה' };

const VENDORS = [
  ['buyme','BuyMe'], ['שופרסל','שופרסל'], ['יוחננוף','יוחננוף'],
  ['סופר פארם','סופר-פארם'], ['טיב טעם','טיב טעם'], ['powercard','PowerCard'],
  ['dream card','Dream Card'], ['תו הזהב','תו הזהב'], ['מקס','MAX'],
  ['כאל','כאל'], ['ישראכרט','ישראכרט'], ['הוט','מועדון הוט'],
  ['המשביר','המשביר'], ['רמי לוי','רמי לוי'], ['fox','FOX'],
  ['castro','Castro'], ['h&m','H&M'], ['ksp','KSP'],
  ['ace','ACE'], ['ארומה','ארומה'], ['קפה גרג','קפה גרג'],
  ['terminal x','Terminal X'], ['renuar','Renuar'], ['htzone','HTzone']
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
  $('#undoActionBtn').click(undoDelete);
  $('#toggleDeletedBtn').click(() => { SHOW_DELETED = !SHOW_DELETED; renderTable(); });
  $('#chartType, #chartData').on('change', renderChart);
  $('#searchInput, #priorityFilter, #statusFilter, #vendorFilter').on('input change', renderTable);
  $(document).on('click', 'th[data-sort]', function() {
    const k = $(this).data('sort');
    SORT.asc = SORT.key === k ? !SORT.asc : false;
    SORT.key = k;
    renderTable();
  });
  $(document).on('click', '.copy-btn', function() {
    const code = $(this).data('code');
    navigator.clipboard.writeText(code).then(() => {
      const ok = $(this).siblings('.copy-ok');
      ok.fadeIn(100).delay(800).fadeOut(200);
    });
  });
  $(document).on('click', '.btn-delete', function() {
    const id = $(this).closest('tr').data('id');
    const row = ALL_DATA.find(r => r.id === id);
    if (!row) return;
    row.deleted = true;
    LAST_DELETED = row;
    $('#undoText').text('נמחק: ' + row.sender + ' — ' + row.code.substring(0, 20));
    $('#undoBar').fadeIn();
    setTimeout(() => $('#undoBar').fadeOut(), 5000);
    renderTable(); updateStats();
  });
  $(document).on('click', '.btn-restore', function() {
    const id = $(this).closest('tr').data('id');
    const row = ALL_DATA.find(r => r.id === id);
    if (row) { row.deleted = false; renderTable(); updateStats(); }
  });
  $(document).on('click', '.status-btn', function() {
    const id = $(this).closest('tr').data('id');
    const row = ALL_DATA.find(r => r.id === id);
    if (!row) return;
    const idx = STATUS_CYCLE.indexOf(row.status);
    row.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    renderTable();
  });
  $(document).on('click', '.toggle-msg', function() {
    const td = $(this).closest('td');
    td.find('.msg-short').toggle();
    td.find('.msg-full').toggle();
    $(this).text(td.find('.msg-full').is(':visible') ? '▲ פחות' : '▼ הצג הכל');
  });
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
      setTimeout(() => {
        $('#progressWrap').hide();
        initUI();
      }, 300);
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
    const date = allText.find(t => RE.dateCell.test(t)) || '';
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
    const date = ts ? new Date(ts).toLocaleString('he-IL') : '';
    const parsed = buildRows({ date, sender, text });
    if (parsed) rows.push(...parsed);
  });
  return rows;
}

function parseCSV(csv) {
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return result.data.flatMap(row => buildRows({
    date: row.date || row.Date || '',
    sender: row.sender || row.address || row.Sender || '',
    text: row.body || row.message || row.text || row.Message || ''
  }) || []);
}

function buildRows(item) {
  const text = (item.text || '').trim();
  if (!text || !RE.voucher.test(text) || RE.exclude.test(text)) return null;
  const codes = extractCodes(text);
  const amounts = extractAmounts(text);
  const expiry = extractExpiry(text);
  const expired = isExpired(expiry);
  const vendor = identifyVendor(item.sender || '', text);
  const priority = (codes.length && amounts.length) ? 'HIGH' : codes.length ? 'MEDIUM' : 'LOW';
  const baseRow = {
    date: item.date || '',
    sender: item.sender || '',
    vendor, priority,
    amount: amounts.join(', '),
    expiry, expired,
    message: text,
    status: expired ? 'expired' : 'new',
    deleted: false
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
  return new Date(y, p[1]-1, p[0]) < new Date();
}

function identifyVendor(sender, text) {
  const hay = (sender + ' ' + text).toLowerCase();
  for (const [k, name] of VENDORS) if (hay.includes(k.toLowerCase())) return name;
  return sender || 'לא ידוע';
}

// ─── UI ───
function initUI() {
  const vendors = [...new Set(ALL_DATA.map(r => r.vendor))].sort();
  $('#vendorFilter').html('<option value="">כל הספקים</option>' + vendors.map(v => `<option>${escHtml(v)}</option>`).join(''));
  $('#statsGrid, #chartsSection, #filtersSection, #tableSection').show();
  $('#exportBtn, #toggleDeletedBtn').show();
  updateStats();
  renderChart();
  renderTable();
}

function updateStats() {
  const a = ALL_DATA.filter(r => !r.deleted);
  $('#statsGrid').html([
    { n: a.filter(r => r.priority==='HIGH').length, l: '🔴 עדיפות גבוהה', c: '#fde68a' },
    { n: a.filter(r => r.priority==='MEDIUM').length, l: '🔵 עדיפות בינונית', c: '#bfdbfe' },
    { n: a.filter(r => r.priority==='LOW').length, l: '⚪ עדיפות נמוכה', c: '#cbd5e1' },
    { n: a.filter(r => r.amount).length, l: '💰 עם סכום', c: '#6ee7b7' },
    { n: a.filter(r => r.expired).length, l: '⏰ פג תוקף', c: '#fca5a5' },
    { n: ALL_DATA.filter(r => r.deleted).length, l: '🗑 נמחקו', c: '#94a3b8' },
    { n: a.length, l: '📋 סה"כ', c: '#d8b4fe' }
  ].map(s => `<div class="stat-card"><div class="stat-num" style="color:${s.c}">${s.n}</div><div class="stat-label">${s.l}</div></div>`).join(''));
}

function renderChart() {
  const active = ALL_DATA.filter(r => !r.deleted);
  const groupBy = $('#chartData').val() || 'vendor';
  const counts = {};
  active.forEach(r => counts[r[groupBy]] = (counts[r[groupBy]] || 0) + 1);
  const labels = Object.keys(counts).sort((a,b) => counts[b]-counts[a]).slice(0, 14);
  const values = labels.map(l => counts[l]);
  const colors = labels.map((_, i) => `hsla(${(i*27)%360},70%,58%,0.82)`);
  const type = $('#chartType').val() || 'bar';
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (CHART_INSTANCE) CHART_INSTANCE.destroy();
  CHART_INSTANCE = new Chart(ctx, {
    type,
    data: { labels, datasets: [{ label: 'כמות', data: values, backgroundColor: colors, borderColor: colors.map(c=>c.replace('0.82','1')), borderWidth: 1, borderRadius: type==='bar'?10:0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: type!=='bar', labels: { color: '#cbd5e1' } } },
      scales: (type==='radar'||type==='polarArea') ? { r: { ticks: { color: '#cbd5e1', backdropColor: 'transparent' }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#cbd5e1' } } } : { x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.07)' } }, y: { beginAtZero: true, ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.07)' } } }
    }
  });
}

function getFiltered() {
  const q = $('#searchInput').val().toLowerCase();
  const pri = $('#priorityFilter').val();
  const st = $('#statusFilter').val();
  const v = $('#vendorFilter').val();
  return ALL_DATA
    .filter(r => !r.deleted || SHOW_DELETED)
    .filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q))
    .filter(r => !pri || r.priority === pri)
    .filter(r => !st || r.status === st)
    .filter(r => !v || r.vendor === v)
    .sort((a, b) => {
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
  if (!rows.length) {
    $('#tableBody').html('<tr><td colspan="10" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">🔍 לא נמצאו תוצאות</td></tr>');
    return;
  }
  $('#tableBody').html(rows.map(r => {
    const codeHtml = `<div class="code-line">
      <span class="code-pill">${escHtml(r.code)}</span>
      <button class="copy-btn" data-code="${escHtml(r.code)}">📋 העתק</button>
      <span class="copy-ok">✅ הועתק</span>
    </div>`;
    const actionBtn = r.deleted
      ? `<button class="btn restore btn-restore">↩ שחזר</button>`
      : `<button class="btn danger btn-delete">✕</button>`;
    const msgHtml = `<div class="msg-short">${escHtml(r.message.substring(0,80))}${r.message.length>80?'...':''}</div><div class="msg-full">${escHtml(r.message)}</div>${r.message.length>80?'<span class="toggle-msg">▼ הצג הכל</span>':''}`;
    return `<tr class="${r.deleted?'deleted-row':''} ${r.expired?'expired-row':''}" data-id="${r.id}">
      <td>${actionBtn}</td>
      <td><span class="badge badge-${r.priority}">${PRIORITY_LABELS[r.priority]||r.priority}</span></td>
      <td style="white-space:nowrap;font-size:12px">${escHtml(r.date)}</td>
      <td style="font-size:12px">${escHtml(r.sender)}</td>
      <td><span class="vendor-name">${escHtml(r.vendor)}</span></td>
      <td style="font-weight:700;color:#6ee7b7">${r.amount?'₪'+r.amount:''}</td>
      <td style="font-size:12px;color:${r.expired?'#fca5a5':'inherit'}">${escHtml(r.expiry)}</td>
      <td>${codeHtml}</td>
      <td>${msgHtml}</td>
      <td><button class="status-btn s-${r.status}">${STATUS_LABELS[r.status]||r.status}</button></td>
    </tr>`;
  }).join(''));
}

function resetFilters() {
  $('#searchInput').val('');
  $('#priorityFilter, #statusFilter, #vendorFilter').val('');
  renderTable();
}

function exportCSV() {
  const cols = ['date','sender','vendor','priority','amount','expiry','code','message','status'];
  const csv = '\ufeff' + cols.join(',') + '\n' +
    ALL_DATA.filter(r=>!r.deleted).map(r => cols.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'har_hakuponim_export.csv';
  a.click();
}

function undoDelete() {
  if (LAST_DELETED) { LAST_DELETED.deleted = false; $('#undoBar').hide(); renderTable(); updateStats(); }
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}