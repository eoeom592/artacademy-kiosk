// 캐시 버전 — 새 빌드 배포 시 번호를 올리세요 (예: v2, v3 ...)
const CACHE_NAME = 'artacademy-v1';

// 앱 시작에 필요한 최소 파일 목록
// Unity 빌드 파일명은 자동으로 추가됩니다 (아래 install 핸들러 참고)
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

// ── 요청 처리: 네트워크 우선, 실패 시 캐시 ───────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Google Sheets API 요청은 캐시하지 않음
  if (url.includes('script.google.com') || url.includes('googleapis.com')) {
    return; // 브라우저 기본 처리
  }

  // Unity 빌드 파일(.data, .wasm) – 캐시 우선 (대용량이므로 재다운로드 방지)
  if (url.endsWith('.data') || url.endsWith('.wasm') ||
      url.endsWith('.data.br') || url.endsWith('.wasm.br') ||
      url.endsWith('.data.gz') || url.endsWith('.wasm.gz')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
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
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
