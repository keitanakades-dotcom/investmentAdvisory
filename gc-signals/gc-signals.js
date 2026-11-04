const $ = (id) => document.getElementById(id);
let allRecords = [];

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function render() {
  const ticker = $('ticker').value.trim().toUpperCase();
  const cross = $('cross').value;
  const matches = allRecords.filter((record) => (!ticker || record.ticker.includes(ticker))
    && (cross === 'ALL' || record.type === cross));
  const body = $('results');
  body.replaceChildren();
  for (const record of matches) {
    const row = document.createElement('tr');
    addCell(row, record.ticker);
    addCell(row, record.name);
    addCell(row, record.signal);
    addCell(row, record.date);
    const linkCell = document.createElement('td');
    const link = document.createElement('a');
    link.href = record.chart_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'チャート';
    linkCell.append(link);
    row.append(linkCell);
    body.append(row);
  }
  if (!matches.length) {
    const row = document.createElement('tr');
    const cell = addCell(row, '該当シグナルなし');
    cell.colSpan = 5;
    body.append(row);
  }
  $('result-note').textContent = `${matches.length}件を表示中。銘柄コード・GC/DCで絞り込めます。`;
}

async function load() {
  try {
    const source = document.body.dataset.signalSource || '/api/gc/latest/diagnosis-signals';
    const response = await fetch(source, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'observed') throw new Error('unavailable');
    allRecords = payload.records || [];
    $('freshness').dataset.state = allRecords.length ? 'observed' : 'not_available';
    $('freshness').textContent = payload.as_of
      ? `最新データ日 ${payload.as_of} ／ 自動銘柄診断対象にGC/DCあり。全上場銘柄を網羅する一覧ではありません。`
      : '最新の診断データ日を確認できません。';
    render();
  } catch {
    $('freshness').dataset.state = 'not_available';
    $('freshness').textContent = '最新のGC/DCシグナルを読み込めませんでした。';
    $('result-note').textContent = 'データ更新後に再読み込みしてください。';
    const tr = document.createElement('tr');
    const td = addCell(tr, 'データを表示できません');
    td.colSpan = 5;
    $('results').replaceChildren(tr);
  }
}

$('search').addEventListener('click', render);
$('ticker').addEventListener('input', render);
$('cross').addEventListener('change', render);
load();
