const messages = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');

const KEY = 'talk-v1-messages';
const MEMORY_KEY = 'talk-long-term-memory';
const ACCESS_KEY_STORAGE = 'talk-access-key';

const API_URL =
  'https://talk-ai.sachi-log-mitsu.workers.dev';

// -------------------------
// 会話履歴
// -------------------------

let history =
  JSON.parse(localStorage.getItem(KEY) || 'null') || [
    {
      who: 'him',
      text: 'お、来た。\n今日はどうだった？',
      at: Date.now()
    }
  ];

// -------------------------
// 長期記憶
// -------------------------

let memories =
  JSON.parse(
    localStorage.getItem(MEMORY_KEY) || '[]'
  );

function saveMemories() {
  localStorage.setItem(
    MEMORY_KEY,
    JSON.stringify(memories)
  );
}

// 今後STEP 2でAIがここに記憶を追加する
function addMemory(text) {
  const clean = String(text || '').trim();

  if (!clean) return;

  // 同じ内容を重複保存しない
  if (memories.some(m => m.text === clean)) {
    return;
  }

  memories.push({
    id: crypto.randomUUID(),
    text: clean,
    createdAt: Date.now()
  });

  saveMemories();
}

// -------------------------
// Talk専用アクセスキー
// -------------------------

function getAccessKey() {
  let key =
    localStorage.getItem(ACCESS_KEY_STORAGE);

  if (!key) {
    key = window.prompt(
      'Talkのアクセスキーを入力してください'
    );

    if (key) {
      key = key.trim();

      localStorage.setItem(
        ACCESS_KEY_STORAGE,
        key
      );
    }
  }

  return key;
}

// -------------------------
// 表示
// -------------------------

function render() {
  messages.innerHTML = '';

  history.forEach(m => {
    const row =
      document.createElement('div');

    row.className =
      `row ${m.who === 'me' ? 'me' : 'him'}`;

    const bubble =
      document.createElement('div');

    bubble.className = 'bubble';
    bubble.textContent = m.text;

    row.appendChild(bubble);
    messages.appendChild(row);
  });

  messages.scrollTop =
    messages.scrollHeight;

  localStorage.setItem(
    KEY,
    JSON.stringify(history)
  );
}

function add(who, text) {
  history.push({
    who,
    text,
    at: Date.now()
  });

  render();
}

// -------------------------
// AIへ送信
// -------------------------

async function getAIReply() {
  const accessKey = getAccessKey();

  if (!accessKey) {
    throw new Error('No access key');
  }

  const response = await fetch(API_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'X-Talk-Key': accessKey
    },

    body: JSON.stringify({
      messages: history.slice(-20),

      // 長期記憶もWorkerへ送る
      memories: memories
        .slice(-50)
        .map(memory => memory.text)
    })
  });

  if (response.status === 401) {
    localStorage.removeItem(
      ACCESS_KEY_STORAGE
    );

    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.reply) {
    throw new Error('No reply');
  }

  return data.reply;
}

// -------------------------
// 送信
// -------------------------

form.addEventListener(
  'submit',
  async e => {
    e.preventDefault();

    const text = input.value.trim();

    if (!text) return;

    add('me', text);

    input.value = '';
    input.style.height = 'auto';

    const button =
      form.querySelector('button');

    button.disabled = true;

    try {
      const reply =
        await getAIReply();

      add('him', reply);

    } catch (error) {
      console.error(error);

      if (error.message === 'Unauthorized') {
        add(
          'him',
          'アクセスキーが違うみたい。もう一度入力してみて。'
        );

      } else if (
        error.message === 'No access key'
      ) {
        add(
          'him',
          'アクセスキーを入力すると話せるよ。'
        );

      } else {
        add(
          'him',
          'ん、ごめん。今ちょっとうまく返せなかった。'
        );
      }

    } finally {
      button.disabled = false;
      input.focus();
    }
  }
);

// -------------------------
// 入力欄
// -------------------------

input.addEventListener(
  'input',
  () => {
    input.style.height = 'auto';

    input.style.height =
      Math.min(
        input.scrollHeight,
        120
      ) + 'px';
  }
);

// -------------------------
// PWA
// -------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register(
        './sw.js'
      );
    }
  );
}

render();
