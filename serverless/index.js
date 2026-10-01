// Yandex Cloud Function: пожелания Оле и рейтинг Arbuz Surfer.
// Хранилище — бакет Object Storage (S3 API). Каждое пожелание — отдельный объект wishes/<id>.json,
// лучший результат игрока — scores/<player>.json. Отдельные объекты, чтобы одновременные записи не затирали друг друга.
//
//   GET  ?op=wishes                  → [{ id, name, text, ts }]
//   GET  ?op=leaderboard&player=<id> → { top: [{ name, score, melons }], me: { rank, score } | null }
//   POST ?op=wish   { text, name, player }
//   POST ?op=score  { player, name, score, melons }
//
// Переменные окружения: BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (статический ключ сервисного аккаунта),
// ALLOW_ORIGIN (по умолчанию https://ndrwbv.github.io).
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'ru-central1', endpoint: 'https://storage.yandexcloud.net' });
const BUCKET = process.env.BUCKET;
const ORIGIN = process.env.ALLOW_ORIGIN || 'https://ndrwbv.github.io';
const HEADERS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};
const reply = (statusCode, data) => ({ statusCode, headers: HEADERS, body: JSON.stringify(data) });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const cache = new Map(); // prefix → { at, items }; живёт, пока жив инстанс функции
async function listKeys(prefix) {
  const keys = []; let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents || []) keys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
async function readJson(Key) {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }));
  return JSON.parse(await r.Body.transformToString());
}
async function writeJson(Key, data) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body: JSON.stringify(data), ContentType: 'application/json' }));
}
async function loadAll(prefix, ttl = 15000) {
  const hit = cache.get(prefix);
  if (hit && Date.now() - hit.at < ttl) return hit.items;
  const keys = await listKeys(prefix);
  const items = [];
  for (let i = 0; i < keys.length; i += 50) {
    const part = await Promise.all(keys.slice(i, i + 50).map((k) => readJson(k).catch(() => null)));
    items.push(...part.filter(Boolean));
  }
  cache.set(prefix, { at: Date.now(), items });
  return items;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const q = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
    catch { return reply(400, { error: 'bad json' }); }
  }
  try {
    if (q.op === 'wishes' && method === 'GET') {
      const items = await loadAll('wishes/');
      return reply(200, items.sort((a, b) => a.ts - b.ts).map(({ id, name, text, ts }) => ({ id, name, text, ts })));
    }
    if (q.op === 'leaderboard' && method === 'GET') {
      const all = (await loadAll('scores/')).sort((a, b) => b.score - a.score);
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
      await writeJson(`wishes/${id}.json`, { id, name, text, player: clean(body.player, 40), ts: Date.now() });
      cache.delete('wishes/');
      return reply(200, { id });
    }
    if (q.op === 'score' && method === 'POST') {
      const player = clean(body.player, 40).replace(/[^\w-]/g, '');
      const name = clean(body.name, 24), score = Math.floor(Number(body.score)), melons = Math.floor(Number(body.melons) || 0);
      if (!player || !name || !(score >= 0 && score <= 200000)) return reply(400, { error: 'bad score' });
      const key = `scores/${player}.json`;
      const prev = await readJson(key).catch(() => null);
      const best = Math.max(score, prev?.score || 0);
      if (!prev || best > prev.score || name !== prev.name) {
        await writeJson(key, { player, name, score: best, melons: best === score ? melons : prev.melons, ts: Date.now() });
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
