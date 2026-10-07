// OfficeLed — Service Worker das notificações push (v2, 07/10/2026)
// v2: avisa o servidor quando o push CHEGA no aparelho (/recebido). É a única
// prova de entrega: a Apple responde "aceito" mesmo quando o aparelho não
// mostra nada.
const PUSH_FN = 'https://dtvnoqmavqoftqyurtyv.supabase.co/functions/v1/push-notify';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

async function avisarRecebido() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) return;
    await fetch(PUSH_FN + '/recebido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch (_) { /* sem rede: a notificação aparece do mesmo jeito */ }
}

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'OfficeLed';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'officeled',
    renotify: true,
    data: { url: self.registration.scope },
  };
  e.waitUntil(Promise.all([self.registration.showNotification(title, options), avisarRecebido()]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// O iOS às vezes troca a inscrição: grava a nova no servidor sem depender de abrir o app.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const sub = e.newSubscription || await self.registration.pushManager.getSubscription();
      if (!sub) return;
      await fetch(PUSH_FN + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign(sub.toJSON(), { origem: self.registration.scope, user_agent: 'service-worker' })),
      });
    } catch (_) { /* tenta de novo quando o app abrir */ }
  })());
});
