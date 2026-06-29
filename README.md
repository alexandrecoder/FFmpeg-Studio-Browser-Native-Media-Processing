# 🎬 FFmpeg Studio

**FFmpeg Studio** is a powerful web application that brings the full functionality of FFmpeg directly to your browser using **FFmpeg WASM**. Media processing is done locally, with no need to upload your files to third-party servers.

## ✨ Features

The app is divided into four main operation modes:

*   ⚡ **Quick Convert:** Drag and drop any media file and choose from dozens of pre-configured presets for video (MP4, WebM, GIF), audio (MP3, AAC, FLAC), images (WebP, PNG), and optimized compression for social media (Discord, Twitter/X, WhatsApp).
*   ⌨️ **Playground:** An interactive virtual terminal that allows you to run raw FFmpeg commands. It features a built-in virtual file system (VFS) and a snippet library (ready-to-use scripts to reverse videos, extract audio, generate thumbnails, etc.).
*   ✦ **Visual Editor:** A node-based interface to build complex FFmpeg pipelines visually. Tools include scaling, trimming, FPS control, rotation, cropping, plus filters like blur, grayscale, brightness, and subtitle burning[cite: 1].
*   ⟨/⟩ **Code Mode:** An integrated code editor for writing JavaScript scripts[cite: 1]. It utilizes a Fluent API designed to easily build and chain FFmpeg commands[cite: 1].

## 🛠️ Technologies Used

*   **Front-end:** HTML5, CSS3, and Vanilla JavaScript[cite: 1].
*   **Processing:** [FFmpeg WASM](https://github.com/ffmpegwasm/ffmpeg.wasm) (`@ffmpeg/core`)[cite: 1].
*   **Typography:** *JetBrains Mono* (for code/terminal) and *Syne* (for UI) fonts[cite: 1].

## 🚀 How to Run Locally

Due to the nature of WebAssembly (WASM) and SharedArrayBuffer features, this project **cannot** be opened directly by double-clicking `index.html`. It requires a local server and specific security headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`)[cite: 1].

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
