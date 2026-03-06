# Contributing to BibleNDI

Thank you for your interest in contributing! This document covers everything you need to get started.

---

## Development Setup

### Prerequisites

| Tool                 | Notes                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Node.js 18+          | [nodejs.org](https://nodejs.org)                                                                |
| Yarn                 | `npm install -g yarn`                                                                           |
| NDI 6 SDK            | [ndi.video/download-ndi-sdk](https://ndi.video/download-ndi-sdk/) — full SDK (not just Runtime) |
| Python 3.x           | Required by node-gyp                                                                            |
| VS Build Tools 2019+ | "Desktop development with C++" workload                                                         |

### First-time setup

```powershell
git clone https://github.com/your-username/bible-ndi.git
cd bible-ndi
yarn install

# The NDI SDK installs to a path with spaces by default.
# Create a junction so node-gyp can find it cleanly:
New-Item -ItemType Junction -Path "C:\ndi_sdk" -Target "C:\Program Files\NDI\NDI 6 SDK"

yarn rebuild-ndi      # Compile the C++ NDI addon
yarn start            # Build and launch
```

---

## Branching

| Branch         | Purpose                         |
| -------------- | ------------------------------- |
| `main`         | Stable, release-ready code      |
| `feat/<name>`  | New features                    |
| `fix/<name>`   | Bug fixes                       |
| `chore/<name>` | Maintenance, dependency updates |

Always branch from `main`.

---

## Submitting a Pull Request

1. Fork the repo and create your branch from `main`
2. Make your changes — see Code Guidelines below
3. Run `yarn build` and make sure it compiles with zero errors
4. Test manually by launching with `yarn start`
5. Push and open a PR with a clear description of what and why

### PR checklist

- [ ] `yarn build` passes (no TypeScript errors)
- [ ] App launches and the changed feature works as expected
- [ ] No unrelated files changed
- [ ] Commit messages are descriptive (`feat:`, `fix:`, `chore:`, `docs:`)

---

## Code Guidelines

- **TypeScript strict mode** — no `any`, prefer explicit types
- **React** — functional components and hooks only, no class components
- **Native C++ (ndi_sender.cpp)** — keep it minimal; changes require `yarn rebuild-ndi`
- **No external UI libraries** — all styles are inline React `CSSProperties`
- **File naming** — camelCase for utility files, PascalCase for React components

---

## Reporting Bugs

Open a GitHub Issue and include:

- Windows version
- NDI Runtime version installed
- Steps to reproduce the problem
- Console output from the terminal where you ran `npx electron .` or `yarn start`

---

## Suggesting Features

Open a GitHub Issue with the label `enhancement`. Describe:

- The problem it solves
- How you'd expect it to work
- Any relevant context (OBS version, NDI workflow, etc.)

---

## Roadmap / Good First Issues

| Area           | Task                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| Cross-platform | macOS support — `binding.gyp` already has mac paths, needs testing       |
| Cross-platform | Linux support — similar to macOS                                         |
| UI             | App icon — add `assets/icon.ico` (256×256) and wire up in `package.json` |
| Bible          | More schema adapters for additional Bible database formats               |
| Bible          | Verse search / jump-to-reference text input                              |
| Output         | Custom lower third bar height slider                                     |
| Output         | Configurable output FPS                                                  |
| UX             | Hotkey customisation panel                                               |
| UX             | Multi-monitor live preview window                                        |
| Packaging      | Auto-update support via `electron-updater`                               |

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
