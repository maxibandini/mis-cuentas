// Guarda la app en el dispositivo para que abra al instante.
// Si cambiás index.html, subí también este archivo con otro número de versión.
const VERSION = 'mis-cuentas-v3'
const ARCHIVOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Archivos de la app, se muestra lo guardado y se actualiza en segundo plano
  if (url.origin === location.origin) {
    const clave = url.origin + url.pathname
    e.respondWith(caches.open(VERSION).then(async c => {
      const guardado = await c.match(clave)
      const red = fetch(e.request).then(r => { if (r.ok) c.put(clave, r.clone()); return r }).catch(() => guardado)
      return guardado || red
    }))
    return
  }

  // Tipografías de Google, se guardan la primera vez
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION + '-fuentes').then(async c => {
      const guardado = await c.match(e.request)
      if (guardado) return guardado
      const r = await fetch(e.request)
      c.put(e.request, r.clone())
      return r
    }))
  }
})
