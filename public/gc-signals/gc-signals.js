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
    const source = document.body.dataset.signalSource;
    if (!source) throw new Error('signal_source_missing');
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

// 静的公開版は signals.json を使うため、非公開タブを追加しない。
if (document.body.dataset.signalSource === '/api/gc/latest/diagnosis-signals') {
  const shell = document.querySelector('.gc-shell');
  const header = shell.querySelector('header');
  header.querySelector('h1').textContent = 'テクニカルシグナル検索';
  const original = document.createElement('section');
  while (header.nextElementSibling) original.append(header.nextElementSibling);
  const nav = document.createElement('nav');
  nav.className = 'controls';
  nav.setAttribute('aria-label','シグナルの種類');
  const brd = document.createElement('section');
  const combined = document.createElement('section');
  const frame = document.createElement('iframe');
  frame.title = '底値反転スクリーナー';
  frame.style.cssText = 'width:100%;height:75vh;border:0';
  brd.append(frame);
  const note = document.createElement('p');
  note.setAttribute('aria-live','polite');
  const explain = document.createElement('p');
  explain.textContent = 'BRD初動と、その同日または翌営業日から5営業日以内の最新GCを表示します。GC当日のBRD記録を確認できない場合は組み合わせません。売買判定ではありません。';
  const input = document.createElement('input');
  input.maxLength = 4;
  input.placeholder = '例: 6501';
  input.setAttribute('aria-label','銘柄コード（任意）');
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = '組み合わせを検索';
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const headings = table.createTHead().insertRow();
  for (const h of ['銘柄','BRD初動日','BRD判定基準日','GC発生日','GC判定基準日','間隔','シグナル']) {
    const th=document.createElement('th'); th.textContent=h; headings.append(th);
  }
  const body=table.createTBody();
  wrap.append(table);
  combined.append(explain,input,run,note,wrap);
  async function searchCombined() {
    run.disabled=true;
    body.replaceChildren();
    note.textContent='履歴を確認中…';
    try {
      const response=await fetch('/api/brd/gc-combination?'+new URLSearchParams({ticker:input.value.trim().toUpperCase()}),{cache:'no-store'});
      if(!response.ok) throw Error(String(response.status));
      const data=await response.json();
      note.textContent='GC基準日 '+(data.gc_basis||'未取得')+' ／ BRD履歴基準日 '+(data.brd_basis||'未取得')+' ／ '+
        (data.records.length ? data.records.length+'件' : '照合できた組み合わせなし（履歴不足・未反映を含みます）');
      for(const r of data.records) {
        const tr=body.insertRow();
        for(const value of [r.ticker+' '+r.name,r.brd_date,r.brd_basis,r.gc_date,r.gc_basis,
          r.sessions_after===0?'同日':r.sessions_after+'営業日後',r.signal]) addCell(tr,value);
      }
    } catch(error) {
      note.textContent=error.message==='400'?'銘柄コードを確認してください。':'組み合わせの履歴を読み込めませんでした。';
    } finally { run.disabled=false; }
  }
  run.addEventListener('click',searchCombined);
  const panels=[original,brd,combined];
  const buttons=['GC／DC','底値反転（BRD）','BRD＋GC'].map((label,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.addEventListener('click',()=>select(index));
    nav.append(button);
    return button;
  });
  function select(index){
    panels.forEach((p,i)=>{p.hidden=i!==index;buttons[i].setAttribute('aria-pressed',String(i===index));});
    if(index===1&&!frame.getAttribute('src')) frame.src='/brd.html?embedded=1';
    if(index===2&&!note.textContent) searchCombined();
  }
  shell.append(nav,...panels);
  select(0);
}
