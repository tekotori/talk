const messages = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');

const KEY = 'talk-v1-messages';
const API_URL = 'https://talk-ai.sachi-log-mitsu.workers.dev';

let history = JSON.parse(localStorage.getItem(KEY) || 'null') || [
  {
    who: 'him',
    text: 'お、来た。\n今日はどうだった？',
    at: Date.now()
  }
];

function render() {
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

function add(who, text) {
  history.push({
    who,
    text,
    at: Date.now()
  });

  render();
}

async function getAIReply() {
  const response = await fetch(API_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      messages: history.slice(-20)
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.reply) {
    throw new Error('No reply');
  }

  return data.reply;
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  const text = input.value.trim();

  if (!text) return;

  add('me', text);

  input.value = '';
  input.style.height = 'auto';

  const button = form.querySelector('button');
  button.disabled = true;

  try {
    const reply = await getAIReply();
    add('him', reply);

  } catch (error) {
    console.error(error);

    add(
      'him',
      'ん、ごめん。今ちょっとうまく返せなかった。'
    );

  } finally {
    button.disabled = false;
    input.focus();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height =
    Math.min(input.scrollHeight, 120) + 'px';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

render();
