# BibleNDI

**Broadcast Bible verses over NDI for live production.**

BibleNDI is an open-source desktop app built with Electron that lets you display scripture on screen and send it as a live NDI video stream to OBS, vMix, Wirecast, or any NDI-compatible production software — with no capture card required.

---

## Features

- **Three independent NDI outputs** — each with its own channel name and live toggle
  - **Landscape 16:9** — full-frame slate at 1280×720
  - **Portrait** — full-frame slate with selectable canvas ratio (9:16, 4:5, 1:1)
  - **Lower Third** — bar-only output (1280×180) that floats over your video
- **Auto-fit text** — verse text scales automatically to fill the container; set a max size cap
- **Transparent backgrounds** — set BG opacity to 0% for text-only alpha-channel output (ideal for lower thirds in OBS)
- **Per-output styling** — font, text colour, background colour, opacity, background image, text alignment, reference position, bold, drop shadow
- **Multiple Bible versions** — drop any SQLite Bible database into the `bible/` folder and switch versions live
- **Session persistence** — book, chapter, verse, settings, channel names, and portrait ratio are saved and restored automatically on relaunch or crash
- **Keyboard navigation** — `←` / `→` to step verses, `Shift+←` / `Shift+→` to step chapters

---

## Screenshots

> _Add screenshots here_

---

## Requirements

### Runtime (end users)

- Windows 10/11 x64
- [NDI 6 Runtime](https://ndi.video/download-ndi-sdk/) — free, install the **Runtime** (not the full SDK)

### Development

- Node.js 18+ and Yarn
- [NDI 6 SDK](https://ndi.video/download-ndi-sdk/) — required to compile the native addon (install to default path)
- Python 3.x (for node-gyp)
- Visual Studio Build Tools 2019+ with "Desktop development with C++"

---

## Installation (end users)

Download the latest release from the [Releases](../../releases) page and run the installer (`BibleNDI Setup x.x.x.exe`).

The NDI Runtime must be installed separately — download it free from [ndi.video](https://ndi.video/download-ndi-sdk/).

### Adding Bible versions

Drop any SQLite Bible database file (`.sqlite`, `.sqlite3`, or `.db`) into:

```
%APPDATA%\BibleNDI\   ← packaged app (or the bible/ folder in development)
```

> The bundled `kjv.sqlite` (King James Version) is included by default.

---

## Development Setup

```powershell
# 1. Clone
git clone https://github.com/your-username/bible-ndi.git
cd bible-ndi

# 2. Install dependencies
yarn install

# 3. Build the native NDI addon
#    (requires NDI 6 SDK installed — creates a junction if SDK path has spaces)
New-Item -ItemType Junction -Path "C:\ndi_sdk" -Target "C:\Program Files\NDI\NDI 6 SDK" -ErrorAction SilentlyContinue
yarn rebuild-ndi

# 4. Build & run
yarn start
```

### Available scripts

| Command               | Description                                         |
| --------------------- | --------------------------------------------------- |
| `yarn build`          | Compile TypeScript + bundle renderer                |
| `yarn start`          | Build and launch the app in dev mode                |
| `yarn rebuild-ndi`    | Rebuild the native NDI sender addon                 |
| `yarn rebuild-native` | Rebuild better-sqlite3 for current Electron version |
| `yarn dist:win`       | Build a distributable Windows installer + zip       |

---

## Project Structure

```
bible-ndi/
├── app/                    # Electron main process (TypeScript)
│   ├── main.ts             # App entry, IPC setup
│   ├── outputWindow.ts     # Offscreen NDI output windows
│   ├── ndi.ts              # NDI native addon wrapper
│   └── database.ts         # Bible SQLite adapter
├── renderer/               # React renderer (TypeScript + TSX)
│   ├── App.tsx             # Main UI
│   ├── slateRenderers.tsx  # Slate & Lower Third renderers (auto-fit)
│   ├── viewTypes.ts        # Shared types and defaults
│   ├── styleUtils.ts       # Background/style helpers
│   ├── output.tsx          # Offscreen output renderer
│   └── components/
│       ├── FitPreview.tsx  # Scaled preview container
│       ├── NdiControl.tsx  # NDI channel name + live button
│       ├── ScriptureNav.tsx # Book/chapter/verse navigation
│       └── SettingsPanel.tsx # Per-output style settings
├── native/
│   └── ndi-sender/         # Native C++ NDI addon (node-gyp)
│       ├── ndi_sender.cpp
│       ├── binding.gyp
│       └── find-ndi.js     # NDI SDK auto-detection at build time
├── shared/
│   └── types.ts            # Types shared between main and renderer
├── bible/                  # SQLite Bible databases
│   └── kjv.sqlite
└── assets/                 # App icons (add icon.ico here)
```

---

## How NDI Output Works

Each view (Landscape, Portrait, Lower Third) has a hidden offscreen `BrowserWindow` that renders at full native resolution. A `setInterval` loop at 30 fps captures each frame via `webContents.capturePage()` and sends the raw BGRA pixel buffer to the NDI sender via a native C++ addon. The NDI sender uses `NDIlib_FourCC_video_type_BGRA`, so alpha transparency is fully preserved — receivers that support alpha (like OBS with **Alpha Channel** enabled on the NDI source) will see a transparent background when BG opacity is set to 0%.

---

## Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** this repository
2. **Create a branch** for your feature or fix: `git checkout -b feat/my-feature`
3. **Make your changes** and ensure the app builds cleanly with `yarn build`
4. **Commit** with a clear message: `git commit -m "feat: add my feature"`
5. **Push** your branch: `git push origin feat/my-feature`
6. **Open a Pull Request** describing what you changed and why

### Good first issues / ideas

- [ ] macOS and Linux support (NDI addon already has mac/linux paths in `binding.gyp`)
- [ ] App icon (drop a 256×256 `icon.ico` into `assets/` and wire it up in `package.json`)
- [ ] More Bible version schema adapters
- [ ] Verse search / jump-to-reference input
- [ ] Custom lower third height slider
- [ ] Hotkey customisation
- [ ] Multi-monitor preview window

### Code style

- TypeScript strict mode — no `any`
- Keep React components pure/functional with hooks
- Native addon changes require a `yarn rebuild-ndi` after editing C++

### Reporting bugs

Please open an issue with:

- OS version
- NDI Runtime/SDK version
- Steps to reproduce
- Any console output from the terminal where you launched the app

---

## License

[MIT](LICENSE)

---

## Acknowledgements

- [NDI®](https://ndi.video/) by Vizrt — the network video protocol powering the stream
- [Electron](https://www.electronjs.org/) — cross-platform desktop runtime
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — fast synchronous SQLite bindings
- [React](https://react.dev/) — UI rendering
