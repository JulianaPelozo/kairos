// Service worker do Kairós (versão web): deixa o app instalável e funcionando offline.
// Estratégia: rede primeiro para páginas (pega atualizações), cache primeiro para arquivos com hash.
const CACHE = 'kairos-v2'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/logo.webp']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Só o próprio app; Supabase e outros domínios passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })),
  )
})

// Toque na notificação ou nos botões "Feito" / "Mais tarde".
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const key = e.notification.data?.key
  const action = e.action // '' quando tocou no corpo da notificação
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (list.length) {
      if (key && action) list.forEach((c) => c.postMessage({ type: 'kairos-action', key, action }))
      if (!action) return list[0].focus()
      return
    }
    const url = key && action ? `./?acao=${action}&chave=${encodeURIComponent(key)}` : './'
    return self.clients.openWindow(url)
  })())
})
