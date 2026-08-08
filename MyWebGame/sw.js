// 캐시 버전 — 새 빌드 배포 시 번호를 올리세요 (예: v3, v4 ...)
const CACHE_NAME = 'artacademy-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── 설치: 핵심 파일 미리 캐시 ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] 일부 파일 캐시 실패:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── 활성화: 이전 버전 캐시 삭제 ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── 안전한 캐시 저장 (clone 실패 방지) ───────────────────────────
function tryCacheResponse(request, response) {
  // 206 Partial Content, 이미 소비된 응답, 실패 응답은 캐시 불가
  if (!response.ok || response.status === 206 || response.bodyUsed) return;
  try {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  } catch (e) {
    // 스트리밍 등 clone 불가능한 응답 → 무시
  }
}

// ── 요청 처리 ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Google Sheets / Cloudflare 프록시 요청은 캐시하지 않음
  if (url.includes('script.google.com') || url.includes('googleapis.com') || url.includes('workers.dev')) {
    return;
  }

  // Unity 빌드 파일 – 캐시 우선 (대용량 재다운로드 방지)
  // .unityweb = Unity 6 압축 포맷 포함
  if (url.endsWith('.data')    || url.endsWith('.wasm')    ||
      url.endsWith('.data.br') || url.endsWith('.wasm.br') ||
      url.endsWith('.data.gz') || url.endsWith('.wasm.gz') ||
      url.endsWith('.unityweb')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          tryCacheResponse(event.request, response);
          return response;
        });
      })
    );
    return;
  }

  // 그 외: 네트워크 우선, 오프라인 시 캐시 반환
  event.respondWith(
    fetch(event.request)
      .then(response => {
        tryCacheResponse(event.request, response);
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
