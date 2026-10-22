# Mom's 52nd Birthday

A birthday page with two views:

- **Mom's view** (`index.html`): a 3D strawberry-and-blueberry cake with "5" and "2" candles on a black background. Press and hold anywhere (or hold Space) to blow the candles out; a ring shows progress. Confetti follows, then "Read your messages" opens an ivory scrapbook of everyone's notes that you can drag around. Tap any piece to see the picture and message.
- **Contributor view** (`index.html#write`): a chat-style page where family and friends type a note, add their name, and optionally attach a photo, paste an iOS sticker, or draw a doodle.

## Project structure

```
moms-52nd-birthday/
├── index.html        Page markup for both views
├── css/
│   └── style.css     All styles (cake stage, scrapbook, note page, doodle pad)
└── js/               Plain scripts, loaded in this order
    ├── core.js       Constants (AGE), routing between the two views, data-store handles
    ├── cake.js       three.js scene: cake, candles, flames, smoke, blowing, confetti, render loop
    ├── scrapbook.js  Scrapbook board layout, drag/pan, single-note viewer
    ├── notes.js      Contributor page: composer, image processing, doodle pad, sending
    └── main.js       Connects to the data store and boots the page (must load last)
```

The JS files are classic scripts (not ES modules), so they share top-level variables and must stay in this order in `index.html`. three.js r128 and the Google Fonts (Gloock, Karla) load from CDNs.

## Running it in VS Code

1. Open the `moms-52nd-birthday` folder in VS Code.
2. Install the **Live Server** extension, right-click `index.html`, and choose **Open with Live Server**.
   Or, from a terminal: `npx serve .`
3. Visit the page for Mom's view, and add `#write` to the URL for the note page.

## Important: where notes and pictures are saved

On claude.ai, notes are saved with the page's built-in data store (`window.claude`: `db`, `assets`, `user`). **That store only exists on claude.ai.** Running this folder anywhere else:

- The cake, candles, confetti and scrapbook layout all work.
- The scrapbook shows a sign-in message instead of notes, and the note page can't send.

To host it yourself (Netlify, Vercel, GitHub Pages, etc.), swap in your own backend, for example Firebase Firestore for notes and Firebase Storage for pictures. These are the only places that touch the store:

| File | What it does | Replace with |
|---|---|---|
| `js/core.js` | Gets `db`, `user`, `assets` from `window.claude` | Initialize your backend |
| `js/main.js` | Gets the visitor's id; live-subscribes to all notes (`messages` collection) and to the visitor's own doc | Your auth/anonymous id + realtime query |
| `js/notes.js` | `assets.upload(blob)` for the picture, then `myDoc.set(...)` for the note | Upload to storage, write the document |
| `js/scrapbook.js`, `js/notes.js` | `blobUrl(id)` turns a picture id into a URL (`/_blob/<id>`) | Return your storage download URL |

Data shape: one document per person at `messages/<personId>`:

```json
{
  "from": "Aunt Grace",
  "updatedAt": 1792706000000,
  "notes": [
    { "id": "K3F9A2", "text": "Happy birthday!", "at": 1792706000000,
      "img": { "id": "<picture id>", "kind": "photo" } }
  ]
}
```

`img` is optional; `kind` is `"photo"` (shown with a white border and tape) or `"sticker"` (transparent PNG or doodle, shown with a die-cut white outline).

Outside claude.ai you could also add real blowing with the microphone (`navigator.mediaDevices.getUserMedia`), which isn't available inside an artifact.

## Customizing

- **Age / candles:** `AGE` in `js/core.js`. Digit shapes exist for 5 and 2; other digits fall back to the 5 shape, so add a curve in `cake.js` (see `digits`) for new numbers.
- **Cake colors:** the `toon(...)` color list near the top of the cake section in `js/cake.js`.
- **Candle color/finish:** `waxMat` in `js/cake.js`.
- **Fruit ring:** `PAIRS` and `RING` in `js/cake.js`.
- **Page colors and fonts:** the `:root` tokens at the top of `css/style.css`.
