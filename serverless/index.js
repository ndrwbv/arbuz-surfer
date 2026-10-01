// Yandex Cloud Function: пожелания Оле и рейтинг Arbuz Surfer.
// Хранилище — бакет Object Storage. Каждое пожелание — отдельный объект wishes/<id>.json,
// лучший результат игрока — scores/<player>.json. Отдельные объекты, чтобы одновременные записи не затирали друг друга.
//
//   GET  ?op=wishes                  → [{ id, name, text, ts }]
//   GET  ?op=leaderboard&player=<id> → { top: [{ name, score, melons }], me: { rank, score } | null }
//   POST ?op=wish   { text, name, player }
//   POST ?op=score  { player, name, score, melons }
//
// Ключей нет: функция запускается от сервисного аккаунта с ролью storage.editor, и Yandex передаёт
// ей IAM-токен в context.token — им и авторизуемся в Object Storage (заголовок X-YaCloud-SubjectToken).
// Переменные окружения: BUCKET, ALLOW_ORIGIN (по умолчанию https://ndrwbv.github.io).
const BUCKET = process.env.BUCKET;
const ORIGIN = process.env.ALLOW_ORIGIN || 'https://ndrwbv.github.io';
const STORAGE = 'https://storage.yandexcloud.net';
const HEADERS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};
const reply = (statusCode, data) => ({ statusCode, headers: HEADERS, body: JSON.stringify(data) });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function storage(token) {
  const req = async (path, init = {}) => {
    const r = await fetch(`${STORAGE}/${BUCKET}${path}`, { ...init, headers: { 'X-YaCloud-SubjectToken': token, ...(init.headers || {}) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`storage ${init.method || 'GET'} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r;
  };
  return {
    async list(prefix) {
      const keys = []; let next = '';
      do {
        const q = new URLSearchParams({ 'list-type': '2', prefix });
        if (next) q.set('continuation-token', next);
        const xml = await (await req(`?${q}`)).text();
        for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unxml(m[1]));
        next = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml((xml.match(/<NextContinuationToken>([^<]*)</) || [])[1] || '') : '';
      } while (next);
      return keys;
    },
    async read(key) { const r = await req('/' + key); return r ? r.json() : null; },
    async write(key, data) { await req('/' + key, { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }); },
  };
}

const cache = new Map(); // prefix → { at, items }; живёт, пока жив инстанс функции
async function loadAll(s3, prefix, ttl = 15000) {
  const hit = cache.get(prefix);
  if (hit && Date.now() - hit.at < ttl) return hit.items;
  const keys = await s3.list(prefix);
  const items = [];
  for (let i = 0; i < keys.length; i += 50) {
    const part = await Promise.all(keys.slice(i, i + 50).map((k) => s3.read(k).catch(() => null)));
    items.push(...part.filter(Boolean));
  }
  cache.set(prefix, { at: Date.now(), items });
  return items;
}

module.exports.handler = async (event, context) => {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const token = context && context.token && context.token.access_token;
  if (!token) return reply(500, { error: 'no service account token: назначь функции сервисный аккаунт' });
  const s3 = storage(token);
  const q = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
    catch { return reply(400, { error: 'bad json' }); }
  }
  try {
    if (q.op === 'wishes' && method === 'GET') {
      const items = await loadAll(s3, 'wishes/');
      return reply(200, items.sort((a, b) => a.ts - b.ts).map(({ id, name, text, ts }) => ({ id, name, text, ts })));
    }
    if (q.op === 'leaderboard' && method === 'GET') {
      const all = (await loadAll(s3, 'scores/')).sort((a, b) => b.score - a.score);
      const idx = q.player ? all.findIndex((x) => x.player === q.player) : -1;
      return reply(200, {
        top: all.slice(0, 15).map(({ name, score, melons }) => ({ name, score, melons })),
        me: idx >= 0 ? { rank: idx + 1, score: all[idx].score } : null,
      });
    }
    if (q.op === 'wish' && method === 'POST') {
      const text = clean(body.text, 160), name = clean(body.name, 24);
      if (text.length < 2) return reply(400, { error: 'empty' });
      const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await s3.write(`wishes/${id}.json`, { id, name, text, player: clean(body.player, 40), ts: Date.now() });
      cache.delete('wishes/');
      return reply(200, { id });
    }
    if (q.op === 'score' && method === 'POST') {
      const player = clean(body.player, 40).replace(/[^\w-]/g, '');
      const name = clean(body.name, 24), score = Math.floor(Number(body.score)), melons = Math.floor(Number(body.melons) || 0);
      if (!player || !name || !(score >= 0 && score <= 200000)) return reply(400, { error: 'bad score' });
      const key = `scores/${player}.json`;
      const prev = await s3.read(key).catch(() => null);
      const best = Math.max(score, prev?.score || 0);
      if (!prev || best > prev.score || name !== prev.name) {
        await s3.write(key, { player, name, score: best, melons: best === score ? melons : prev.melons, ts: Date.now() });
        cache.delete('scores/');
      }
      return reply(200, { best });
    }
    return reply(404, { error: 'unknown op' });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'storage' });
  }
};
