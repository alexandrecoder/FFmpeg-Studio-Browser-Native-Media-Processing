# 🎬 FFmpeg Studio

**FFmpeg Studio** is a powerful web application that brings the full functionality of FFmpeg directly to your browser using **FFmpeg WASM**. Media processing is done locally, with no need to upload your files to third-party servers.

---

## ⚠️ Required Local Setup (Missing File)

Due to GitHub's file size limitations, the heavy WebAssembly binary (`ffmpeg-core.wasm` ~30MB) is **not included** in this repository. 

To run this project locally, you **must download the official file manually** before starting the server:

1. Download the official binary here: [ffmpeg-core.wasm (v0.12.6)](https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm) *(Right-click the link and select "Save Link As..." / "Salvar link como...")*.
2. Move the downloaded `ffmpeg-core.wasm` file into the `ffmpeg/` directory of this project.

### Expected Directory Structure:
```text
ffmpeg-studio/
├── ffmpeg/
│   ├── 814.ffmpeg.js
│   ├── ffmpeg-core.js
│   ├── ffmpeg-core.wasm  <-- [ Put the downloaded file here ]
│   ├── ffmpeg.js
│   └── util.js
├── index.html
├── app.js
└── style.css
