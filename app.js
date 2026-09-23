const messages = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
// -------------------------
// 画面切り替え
// -------------------------

const talkListScreen =
  document.getElementById('talkListScreen');

const chatScreen =
  document.getElementById('chatScreen');

const openKoheiChat =
  document.getElementById('openKoheiChat');

const backToTalkList =
  document.getElementById('backToTalkList');

const koheiLastMessage =
  document.getElementById('koheiLastMessage');

const koheiLastTime =
  document.getElementById('koheiLastTime');
const notificationButton =
  document.getElementById('notificationButton');

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

let memories = [];

try {
  const saved =
    JSON.parse(
      localStorage.getItem(MEMORY_KEY) || '[]'
    );

  memories =
    Array.isArray(saved) ? saved : [];

} catch (error) {
  console.error('Memory load failed');
  memories = [];
}

function saveMemories() {
  localStorage.setItem(
    MEMORY_KEY,
    JSON.stringify(memories)
  );
}

function addMemory(text) {
  const clean =
    String(text || '').trim();

  if (!clean) return;

  const alreadyExists =
    memories.some(
      memory =>
        memory.text === clean
    );

  if (alreadyExists) return;

  memories.push({
    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

    text: clean,
    createdAt: Date.now()
  });

  if (memories.length > 100) {
    memories =
      memories.slice(-100);
  }

  saveMemories();
}

// -------------------------
// Talk専用アクセスキー
// -------------------------

function getAccessKey() {
  let key =
    localStorage.getItem(
      ACCESS_KEY_STORAGE
    );

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
// 会話表示
// -------------------------

function render() {
  messages.innerHTML = '';

  history.forEach(message => {
    const row =
      document.createElement('div');

    row.className =
      `row ${
        message.who === 'me'
          ? 'me'
          : 'him'
      }`;

    const bubble =
      document.createElement('div');

    bubble.className = 'bubble';
    bubble.textContent =
      message.text;

    row.appendChild(bubble);
    messages.appendChild(row);
  });

  messages.scrollTop =
    messages.scrollHeight;

  localStorage.setItem(
    KEY,
    JSON.stringify(history)
  );
  updateTalkPreview();
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
// 自発メッセージを受け取る
// -------------------------

async function getPendingMessage() {

  const accessKey =
    getAccessKey();

  if (!accessKey) return;

  try {

    const response =
      await fetch(
        `${API_URL}/messages/pending`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-Talk-Key':
              accessKey
          }
        }
      );

    if (!response.ok) {
      console.error(
        'Pending message error:',
        response.status
      );
      return;
    }

    const data =
      await response.json();

    if (
      !data.message ||
      !data.message.text
    ) {
      return;
    }

    // 同じメッセージの二重追加を防ぐ
    const alreadyExists =
      history.some(message =>
        message.who === 'him' &&
        message.text ===
          data.message.text &&
        message.at ===
          data.message.at
      );

    if (alreadyExists) return;

    history.push({
      who: 'him',
      text: data.message.text,
      at:
        data.message.at ||
        Date.now()
    });

    render();

  } catch (error) {

    console.error(
      'Pending message fetch failed:',
      error
    );
  }
}
// -------------------------
// AIへ送信
// -------------------------

async function getAIReply() {
  const accessKey =
    getAccessKey();

  if (!accessKey) {
    throw new Error(
      'No access key'
    );
  }

  const response =
    await fetch(API_URL, {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',

        'X-Talk-Key':
          accessKey
      },

      body: JSON.stringify({
        messages:
          history.slice(-20),

        memories:
          memories
            .slice(-50)
            .map(
              memory =>
                memory.text
            )
      })
    });

  if (response.status === 401) {
    localStorage.removeItem(
      ACCESS_KEY_STORAGE
    );

    throw new Error(
      'Unauthorized'
    );
  }

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data.reply) {
    throw new Error(
      'No reply'
    );
  }

  if (
    Array.isArray(
      data.memoryCandidates
    )
  ) {
    data.memoryCandidates
      .slice(0, 3)
      .forEach(candidate => {

        if (
          typeof candidate ===
          'string'
        ) {
          addMemory(candidate);
        }
      });
  }

  return data.reply;
}

// -------------------------
// メッセージ送信
// -------------------------

form.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const text =
      input.value.trim();

    if (!text) return;

    add('me', text);

    input.value = '';
    input.style.height =
      'auto';

    const button =
      form.querySelector(
        'button'
      );

    button.disabled = true;

    try {
      const reply =
        await getAIReply();

      add(
        'him',
        reply
      );

    } catch (error) {

      console.error(error);

      if (
        error.message ===
        'Unauthorized'
      ) {
        add(
          'him',
          'アクセスキーが違うみたい。もう一度入力してみて。'
        );

      } else if (
        error.message ===
        'No access key'
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
// 入力欄の高さ
// -------------------------

input.addEventListener(
  'input',
  () => {

    input.style.height =
      'auto';

    input.style.height =
      Math.min(
        input.scrollHeight,
        120
      ) + 'px';
  }
);

// -------------------------
// Base64 URL → Uint8Array
// Push購読用
// -------------------------

function urlBase64ToUint8Array(
  base64String
) {
  const padding =
    '='.repeat(
      (4 - base64String.length % 4) % 4
    );

  const base64 =
    (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      char =>
        char.charCodeAt(0)
    )
  );
}

// -------------------------
// Service Worker
// -------------------------

async function getServiceWorker() {
  if (
    !('serviceWorker' in navigator)
  ) {
    throw new Error(
      'Service Worker unsupported'
    );
  }

  await navigator
    .serviceWorker
    .register('./sw.js');

  return navigator
    .serviceWorker
    .ready;
}

// -------------------------
// Push通知をON
// -------------------------

async function enableNotifications() {

  if (
    !('Notification' in window) ||
    !('PushManager' in window)
  ) {
    alert(
      'この環境ではPush通知を利用できません。'
    );
    return;
  }

  const accessKey =
    getAccessKey();

  if (!accessKey) {
    return;
  }

  notificationButton.disabled = true;
  notificationButton.textContent =
    '設定中…';

  try {

    // -------------------------
    // iPhoneに通知許可を求める
    // -------------------------

    const permission =
      await Notification
        .requestPermission();

    if (
      permission !== 'granted'
    ) {
      notificationButton.textContent =
        '通知をON';

      alert(
        '通知が許可されませんでした。'
      );

      return;
    }

    // -------------------------
    // Service Worker取得
    // -------------------------

    const registration =
      await getServiceWorker();

    // -------------------------
    // VAPID公開鍵を取得
    // -------------------------

    const keyResponse =
      await fetch(
        `${API_URL}/push/public-key`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-Talk-Key':
              accessKey
          },

          body: JSON.stringify({})
        }
      );

    if (!keyResponse.ok) {
      throw new Error(
        'Public key error'
      );
    }

    const keyData =
      await keyResponse.json();

    if (!keyData.publicKey) {
      throw new Error(
        'No public key'
      );
    }

    // -------------------------
    // 既存購読を確認
    // -------------------------

    let subscription =
      await registration
        .pushManager
        .getSubscription();

    // -------------------------
    // 未購読ならPush購読
    // -------------------------

    if (!subscription) {
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly: true,

            applicationServerKey:
              urlBase64ToUint8Array(
                keyData.publicKey
              )
          });
    }

    // -------------------------
    // KVへ購読情報を保存
    // -------------------------

    const subscribeResponse =
      await fetch(
        `${API_URL}/push/subscribe`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-Talk-Key':
              accessKey
          },

          body: JSON.stringify({
            subscription:
              subscription.toJSON()
          })
        }
      );

    if (!subscribeResponse.ok) {
      throw new Error(
        'Subscribe save error'
      );
    }

    notificationButton.textContent =
      '通知ON ✓';

  } catch (error) {

    console.error(
      'Push setup failed:',
      error
    );

    notificationButton.textContent =
      '通知をON';

    alert(
      '通知の設定がうまくできませんでした。'
    );

  } finally {
    notificationButton.disabled =
      false;
  }
}

// -------------------------
// 通知ボタン
// -------------------------

if (notificationButton) {
  notificationButton
    .addEventListener(
      'click',
      enableNotifications
    );
}

// -------------------------
// 起動時に通知状態を確認
// -------------------------

async function updateNotificationButton() {

  if (!notificationButton) {
    return;
  }

  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    notificationButton.textContent =
      '通知非対応';

    return;
  }

  if (
    Notification.permission !==
    'granted'
  ) {
    notificationButton.textContent =
      '通知をON';

    return;
  }

  try {
    const registration =
      await getServiceWorker();

    const subscription =
      await registration
        .pushManager
        .getSubscription();

    notificationButton.textContent =
      subscription
        ? '通知ON ✓'
        : '通知をON';

  } catch (error) {
    console.error(error);
  }
}

// -------------------------
// PWA起動
// -------------------------

window.addEventListener(
  'load',
  async () => {

    try {
      await getServiceWorker();
    } catch (error) {
      console.error(
        'Service Worker error:',
        error
      );
    }

    updateNotificationButton();
  }
);
// -------------------------
// トーク一覧の最新メッセージ
// -------------------------

function updateTalkPreview() {

  if (!history.length) return;

  const lastMessage =
    history[history.length - 1];

  if (koheiLastMessage) {
    koheiLastMessage.textContent =
      lastMessage.text
        .replace(/\n/g, ' ')
        .slice(0, 40);
  }

  if (
    koheiLastTime &&
    lastMessage.at
  ) {
    const date =
      new Date(lastMessage.at);

    koheiLastTime.textContent =
      date.toLocaleTimeString(
        'ja-JP',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }
}
// -------------------------
// トーク一覧 ⇄ チャット
// -------------------------

function showTalkList() {
  talkListScreen.hidden = false;
  chatScreen.hidden = true;
}

function showKoheiChat() {
  talkListScreen.hidden = true;
  chatScreen.hidden = false;

  render();

  setTimeout(() => {
    input.focus();
  }, 100);
}

openKoheiChat.addEventListener(
  'click',
  showKoheiChat
);

backToTalkList.addEventListener(
  'click',
  showTalkList
);
render();
getPendingMessage();
