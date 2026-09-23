const CACHE = 'talk-v9';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// -------------------------
// インストール
// -------------------------

self.addEventListener(
  'install',
  event => {

    event.waitUntil(
      caches
        .open(CACHE)
        .then(
          cache =>
            cache.addAll(ASSETS)
        )
    );

    self.skipWaiting();
  }
);

// -------------------------
// 更新
// -------------------------

self.addEventListener(
  'activate',
  event => {

    event.waitUntil(
      caches
        .keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !== CACHE
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
        )
    );

    self.clients.claim();
  }
);

// -------------------------
// 通常通信
// -------------------------

self.addEventListener(
  'fetch',
  event => {

    event.respondWith(
      fetch(event.request)
        .then(response => {

          const copy =
            response.clone();

          caches
            .open(CACHE)
            .then(cache => {
              cache.put(
                event.request,
                copy
              );
            });

          return response;
        })
        .catch(
          () =>
            caches.match(
              event.request
            )
        )
    );
  }
);

// -------------------------
// Push受信
// -------------------------

self.addEventListener(
  'push',
  event => {

    let data = {
      title: 'Talk',
      body: 'メッセージが届いてる',
      url: './'
    };

    if (event.data) {
      try {
        data = {
          ...data,
          ...event.data.json()
        };
      } catch {
        data.body =
          event.data.text();
      }
    }

    event.waitUntil(
      self.registration
        .showNotification(
          data.title || 'Talk',
          {
            body:
              data.body ||
              'メッセージが届いてる',

            icon:
              './icon-192.png',

            badge:
              './icon-192.png',

            data: {
              url:
                data.url || './'
            }
          }
        )
    );
  }
);

// -------------------------
// 通知タップ
// -------------------------

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

const targetUrl =
  new URL(
    './?chat=kohei',
    self.registration.scope
  ).href;

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(windowClients => {

          // Talkがすでに開いていたら
          // URLを変更せず、その画面を前面に出す
          for (const client of windowClients) {

if (
  client.url.startsWith(
    self.registration.scope
  )
) {
  return client
    .navigate(targetUrl)
    .then(client => client.focus());
}
          }

          // Talkが開いていない場合だけ新しく開く
          return clients.openWindow(
            targetUrl
          );
        })
    );
  }
);
