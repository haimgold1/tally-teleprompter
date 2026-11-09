# Tally — mobile teleprompter

A teleprompter that records video from your phone's front camera while your script scrolls right below the lens. It is an installable PWA with no backend: scripts and takes stay on your device.

## Run it locally

```bash
npm install
npm run dev
npm test
npm run build
```

The camera only works on `localhost` or over HTTPS, so to try it on a phone, deploy it first (below).

## Deploy to GitHub Pages

1. Create a GitHub repository and push the contents of this folder to the `main` branch. This folder must be the repository root, because that is where `.github/workflows/deploy.yml` is read from.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` now tests, builds and deploys the app. The **Actions** tab shows progress and the address, usually `https://<username>.github.io/<repository>/`.

No base-path setup is needed: the build uses relative paths and works at any address.

## Add to Home Screen

**iPhone (Safari)**

1. Open the app's address in Safari.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Tally from the Home Screen and allow the camera and microphone.

**Android (Chrome)**

1. Open the address in Chrome.
2. Tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
3. Open Tally from the launcher and allow the camera and microphone.

Installing also protects your takes: Safari can clear data for sites you haven't visited in 7 days, but not for installed apps.

## Pair a Bluetooth remote

1. Put the remote or keyboard in pairing mode.
2. On the phone, open **Settings → Bluetooth** and connect to it.
3. Open a script. Keys work as soon as the recording screen is showing.

| Key | Action |
| --- | --- |
| Space, Enter, Page Down, → , Media Play/Pause | Pause or resume the text |
| Page Up, ← | Jump back 4 seconds |
| ↑ / ↓ | Speed ±10 words per minute |
| R | Start or stop recording |

Presentation clickers and page-turner pedals send Page Up and Page Down, so they work well. Small camera-shutter remotes usually send Volume Up, which web pages cannot receive. Pick a remote that acts as a keyboard.

## Writing scripts

- Each line is a paragraph, and each paragraph picks Hebrew or English direction on its own.
- Text in `[square brackets]`, like `[breath]`, shows as a small colored note and is not counted as words.

## How it's organized

| Folder | Responsibility |
| --- | --- |
| `src/lib/` | Pure, tested logic: WPM math, word counting, MIME selection, pipeline choice, key map, audio levels |
| `src/services/` | Camera, recorder, audio meter, wake lock, prompter engine, sharing, and the session that coordinates them |
| `src/storage/` | IndexedDB (scripts, takes, chunks) and settings |
| `src/ui/` | Components and screens |
| `build/`, `scripts/` | Service-worker generation, icon and splash generation |

## iOS Safari limitations

| Limitation | How Tally handles it |
| --- | --- |
| `navigator.share` fails if it isn't called directly from the tap | The video file is built when the Review screen opens, so sharing starts immediately on tap |
| Passing `title` or `text` with files can remove **Save Video** from the share sheet | Only `files` is sent |
| Storing Blobs in IndexedDB is unreliable in WebKit | Chunks are stored as `ArrayBuffer` and turned back into a Blob on playback |
| The IndexedDB connection can be lost in the background | Transactions reopen the connection and retry once |
| Capture stops when the app goes to the background | The take is saved at that point and you get a notice. A take can't continue in the background |
| The audio context stays suspended without a gesture, and after interruptions | It resumes on any touch and when the app returns |
| `noiseSuppression` and `autoGainControl` are requests that iOS may ignore | Requested as specified; the level meter shows what is really coming in |
| A phone can deliver a stereo track with one empty channel, which plays in one ear | The voice chain finds the live channel and sends the same signal to both ears |
| A suspended audio context would record silence | If it can't be resumed at record time, the raw microphone is recorded instead |
| Wake Lock has no effect in installed apps before iOS 18.4, and doesn't exist before 16.4 | Tally shows a one-time tip to set Auto-Lock to Never. The usual workaround plays hidden audio, which could affect the microphone, so it is deliberately not used |
| Orientation can't be locked in Safari | A notice appears if you rotate during a direct recording |
| A canvas outside the document can stop producing frames | The crop canvas stays attached to the page, at 1×1 px |
| Volume buttons and shutter remotes can't be read by web pages | Use a remote that acts as a keyboard |
