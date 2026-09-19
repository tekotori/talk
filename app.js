const messages = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
const KEY = 'talk-v1-messages';

let history = JSON.parse(localStorage.getItem(KEY) || 'null') || [
  { who: 'him', text: 'お、来た。\n今日はどうだった？', at: Date.now() }
];

function render(){
  messages.innerHTML = '';
  history.forEach(m => {
    const row = document.createElement('div');
    row.className = `row ${m.who === 'me' ? 'me' : 'him'}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = m.text;
    row.appendChild(bubble);
    messages.appendChild(row);
  });
  messages.scrollTop = messages.scrollHeight;
  localStorage.setItem(KEY, JSON.stringify(history));
}

function add(who, text){
  history.push({who, text, at: Date.now()});
  render();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  add('me', text);
  input.value = '';
  input.style.height = 'auto';

  // v1はAI未接続。画面と履歴保存の動作確認用。
  setTimeout(() => add('him', 'うん、聞いてる。\n（v1はまだAI未接続。次で本物の会話につなぐ）'), 500);
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
render();
