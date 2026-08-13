const STATE_KEY = 'liExtractorStateV1';
const $ = id => document.getElementById(id);
let activeTabId = null;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(type, extra = {}) {
  const tab = await activeTab();
  if (!tab?.id || !/^https:\/\/www\.linkedin\.com\/search\/results\/content\//.test(tab.url || '')) {
    $('note').textContent = 'Open a LinkedIn content search results page first.';
    return { ok: false };
  }
  activeTabId = tab.id;
  try { return await chrome.tabs.sendMessage(tab.id, { type, ...extra }); }
  catch (e) {
    $('note').textContent = 'Reload the LinkedIn search page once after installing the extension, then try again.';
    return { ok: false, error: e.message };
  }
}

function render(s = {}) {
  const target = Number(s.target || $('target').value || 200);
  $('keyword').textContent = s.keyword || '—';
  $('status').textContent = s.status || 'idle';
  $('unique').textContent = `${s.unique || 0} / ${target}`;
  $('dupes').textContent = s.duplicates || 0;
  $('scrolls').textContent = s.scrolls || 0;
  $('note').textContent = s.message || 'Ready';
  const running = s.status === 'running';
  const paused = s.status === 'paused';
  $('start').disabled = running || paused;
  $('pause').disabled = !running;
  $('resume').disabled = !paused;
  $('stop').disabled = !(running || paused);
}

async function load() {
  const tab = await activeTab();
  const valid = /^https:\/\/www\.linkedin\.com\/search\/results\/content\//.test(tab?.url || '');
  if (!valid) {
    render({ status: 'Not on LinkedIn search', message: 'Open a LinkedIn content search results page first.' });
    $('start').disabled = true;
    return;
  }
  activeTabId = tab.id;
  await send('LIEX_PING');
  const obj = await chrome.storage.local.get(STATE_KEY);
  render(obj[STATE_KEY] || {});
}

$('start').addEventListener('click', async () => {
  const target = Math.max(1, Math.min(5000, Number($('target').value) || 200));
  $('target').value = target;
  const res = await send('LIEX_START', { target });
  if (res?.ok) $('note').textContent = 'Scrape started. Keep this LinkedIn tab open.';
});
$('pause').addEventListener('click', () => send('LIEX_PAUSE'));
$('resume').addEventListener('click', () => send('LIEX_RESUME'));
$('stop').addEventListener('click', () => send('LIEX_STOP'));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STATE_KEY]) render(changes[STATE_KEY].newValue);
});

load();
