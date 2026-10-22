import { randomBytes, createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_BODY = 2_850_000;
const hash = value => createHash('sha256').update(value).digest('hex');
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
function session(req) {
  const value = (req.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('birthday_session='))?.slice(17);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
async function boundedJSON(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) fail('Send JSON.', 415);
  const reader = req.body?.getReader();
  if (!reader) fail('A note is required.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); fail('The picture is too large. Please use a smaller image.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('The note could not be read.'); }
}
function validateImage(image) {
  if (image == null) return null;
  if (!['photo','sticker'].includes(image.kind) || typeof image.data !== 'string') fail('Invalid attachment.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.data);
  if (!match) fail('Use a JPG, PNG or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE) fail('The picture must be 2 MB or smaller.', 413);
  const type = match[1];
  const valid = type === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) fail('The attachment is not a supported image.');
  return { bytes, type, kind: image.kind };
}
function publicNote(note) {
  return { key: note.id, id: note.id, from: note.from, text: note.text, at: note.at, img: note.img || null };
}

// Dependency injection keeps the production handler and backend tests on the same code path.
export function createAPI(getStores) {
  return async req => {
    try {
      const url = new URL(req.url), path = url.pathname;
      if (req.method === 'POST') {
        if (req.headers.get('origin') !== url.origin) fail('Please send from this birthday website.', 403);
      }
      if (path === '/api/session' && req.method === 'GET') {
        const token = session(req) || randomBytes(32).toString('hex');
        return json({ ready: true }, 200, { 'Set-Cookie': `birthday_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}` });
      }
      if (path === '/api/notes' && req.method === 'GET') {
        const mine = url.searchParams.get('mine') === '1', token = session(req);
        if (mine && !token) fail('Please refresh the page to reconnect.', 401);
        const { notes } = getStores();
        const { blobs } = await notes.list(mine ? { prefix: `${hash(token)}/` } : {});
        const records = [];
        // Bounded parallel reads, including all pages (the SDK auto-paginates list()).
        for (let i = 0; i < blobs.length; i += 20) {
          records.push(...await Promise.all(blobs.slice(i, i + 20).map(b => notes.get(b.key, { type: 'json' }))));
        }
        return json({ notes: records.filter(Boolean).map(publicNote).sort((a,b) => a.at - b.at || a.id.localeCompare(b.id)) });
      }
      if (path === '/api/notes' && req.method === 'POST') {
        const token = session(req);
        if (!token) fail('Please refresh the page to reconnect.', 401);
        const input = await boundedJSON(req);
        if (!input || !UUID.test(input.id || '')) fail('Invalid note identifier.');
        if (typeof input.from !== 'string' || !input.from.trim() || input.from.length > 60) fail('Enter a name of up to 60 characters.');
        if (typeof input.text !== 'string' || input.text.length > 1500) fail('Keep your message to 1,500 characters.');
        const picture = validateImage(input.image);
        if (!input.text.trim() && !picture) fail('Write a message or attach a picture.');
        const { notes, images } = getStores();
        const key = `${hash(token)}/${input.id}`, id = hash(key);
        const previous = await notes.get(key, { type: 'json' });
        if (previous) return json({ note: publicNote(previous) });
        const record = { id, from: input.from.trim(), text: input.text.trim(), at: Date.now(), img: null };
        if (picture) {
          const bytes = picture.bytes.buffer.slice(picture.bytes.byteOffset, picture.bytes.byteOffset + picture.bytes.byteLength);
          await images.set(id, bytes, { metadata: { type: picture.type, kind: picture.kind }, onlyIfNew: true });
          // If a previous request uploaded the same attachment before failing, retain its kind.
          const saved = await images.getMetadata(id);
          record.img = { id, kind: saved.metadata.kind };
        }
        const result = await notes.setJSON(key, record, { onlyIfNew: true });
        const saved = result.modified ? record : await notes.get(key, { type: 'json' });
        return json({ note: publicNote(saved) }, result.modified ? 201 : 200);
      }
      if (/^\/api\/images\/[a-f0-9]{64}$/.test(path) && req.method === 'GET') {
        const { images } = getStores();
        const entry = await images.getWithMetadata(path.split('/').pop(), { type: 'arrayBuffer' });
        if (!entry) fail('Picture not found.', 404);
        return new Response(entry.data, { headers: {
          'Content-Type': entry.metadata.type, 'Cache-Control': 'public, max-age=86400, immutable',
          'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox"
        } });
      }
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      if (!error.status) console.error('Birthday API:', error.message);
      return json({ error: error.status ? error.message : 'The scrapbook is temporarily unavailable. Please try again.' }, error.status || 503);
    }
  };
}
