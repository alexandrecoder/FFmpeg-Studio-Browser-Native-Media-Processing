/* ═══════════════════════════════════════════════════════════
   FFmpeg Studio — app.js
   Browser-native FFmpeg WASM processing
═══════════════════════════════════════════════════════════ */

// ─── FFmpeg state ─────────────────────────────────────────
let ffmpegInstance = null;
let ffmpegLoaded = false;
const { FFmpeg } = FFmpegWASM;
const { fetchFile, toBlobURL } = FFmpegUtil;

// Virtual file system (name → Uint8Array)
const vfs = new Map();

// ─── Init ──────────────────────────────────────────────────
async function loadFFmpeg() {
  try {
    setStatus('loading', 'Loading FFmpeg…');
    ffmpegInstance = new FFmpeg();
    ffmpegInstance.on('log', ({ message }) => {
      dispatchLog(message);
    });
    ffmpegInstance.on('progress', ({ progress }) => {
      dispatchProgress(Math.round(progress * 100));
    });

    await ffmpegInstance.load({
		  coreURL: '/ffmpeg/ffmpeg-core.js',
		  wasmURL: '/ffmpeg/ffmpeg-core.wasm',
		});

    ffmpegLoaded = true;
    setStatus('ready', 'FFmpeg ready');
    toast('FFmpeg loaded successfully', 'success');
    enableRunButtons();
  } catch (e) {
    setStatus('error', 'Load failed');
    console.error(e);
    toast('Failed to load FFmpeg: ' + e.message, 'error');
  }
}

// ─── Status ────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById('ffmpeg-status');
  const txt = document.getElementById('ffmpeg-status-text');
  dot.className = 'status-dot ' + type;
  txt.textContent = text;
}

function enableRunButtons() {
  document.getElementById('quick-run-btn').disabled = !quickFile;
  document.getElementById('editor-run-btn').disabled = !editorInputFile;
  document.getElementById('code-run-btn').disabled = false;
  document.getElementById('pg-run-btn').disabled = false;
}

// ─── Log dispatcher ────────────────────────────────────────
let currentLogTarget = null;
let currentProgressTarget = null;

function dispatchLog(msg) {
  if (currentLogTarget) appendLog(currentLogTarget, msg);
  addTerminalLine('pg-terminal', msg, 'out');
}

function dispatchProgress(pct) {
  if (currentProgressTarget) {
    const bar = document.getElementById(currentProgressTarget + '-bar');
    const pctEl = document.getElementById(currentProgressTarget + '-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }
}

function appendLog(boxId, msg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'log-line' +
    (msg.includes('Error') || msg.includes('error') ? ' err' :
     msg.includes('frame') || msg.includes('time') ? '' : ' info');
  line.textContent = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function addTerminalLine(termId, text, cls = '') {
  const term = document.getElementById(termId);
  if (!term) return;
  const line = document.createElement('div');
  line.className = 'terminal-line ' + cls;
  line.textContent = text;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

// ─── Toast ─────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── Tab navigation ────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ═══════════════════════════════════════════════════════════
// QUICK CONVERT
// ═══════════════════════════════════════════════════════════
let quickFile = null;
let selectedPreset = null;

const PRESETS = {
  video: [
    { name: 'MP4 H.264', ext: 'mp4', desc: 'Universal web video', args: ['-c:v','libx264','-c:a','aac'] },
    { name: 'MP4 H.265', ext: 'mp4', desc: 'Smaller file, modern', args: ['-c:v','libx265','-c:a','aac'] },
    { name: 'WebM VP9',  ext: 'webm', desc: 'Open web format', args: ['-c:v','libvpx-vp9','-c:a','libopus'] },
    { name: 'AVI',       ext: 'avi', desc: 'Legacy format', args: ['-c:v','mpeg4','-c:a','mp3'] },
    { name: 'MOV',       ext: 'mov', desc: 'Apple QuickTime', args: ['-c:v','libx264','-c:a','aac'] },
    { name: 'MKV',       ext: 'mkv', desc: 'Container, copy streams', args: ['-c','copy'] },
    { name: 'GIF',       ext: 'gif', desc: 'Animated GIF', args: ['-vf','fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'] },
    { name: 'MP4 lossless', ext: 'mp4', desc: 'CRF 0, largest file', args: ['-c:v','libx264','-crf','0'] },
  ],
  audio: [
    { name: 'MP3 320k', ext: 'mp3', desc: 'High quality audio', args: ['-c:a','libmp3lame','-b:a','320k','-vn'] },
    { name: 'MP3 128k', ext: 'mp3', desc: 'Web streaming', args: ['-c:a','libmp3lame','-b:a','128k','-vn'] },
    { name: 'AAC',      ext: 'aac', desc: 'Apple / mobile', args: ['-c:a','aac','-b:a','192k','-vn'] },
    { name: 'OGG',      ext: 'ogg', desc: 'Open source audio', args: ['-c:a','libvorbis','-q:a','4','-vn'] },
    { name: 'FLAC',     ext: 'flac', desc: 'Lossless audio', args: ['-c:a','flac','-vn'] },
    { name: 'WAV',      ext: 'wav', desc: 'Uncompressed PCM', args: ['-c:a','pcm_s16le','-vn'] },
    { name: 'Opus',     ext: 'opus', desc: 'Best for voice', args: ['-c:a','libopus','-b:a','96k','-vn'] },
    { name: 'Extract Audio', ext: 'mp3', desc: 'Strip video', args: ['-vn','-c:a','libmp3lame','-q:a','2'] },
  ],
  image: [
    { name: 'JPEG',   ext: 'jpg',  desc: 'Single frame snapshot', args: ['-vframes','1','-q:v','2'] },
    { name: 'PNG',    ext: 'png',  desc: 'Lossless image', args: ['-vframes','1'] },
    { name: 'WebP',   ext: 'webp', desc: 'Modern web image', args: ['-vframes','1','-quality','85'] },
    { name: 'Thumbnails', ext: 'jpg', desc: 'Every 5 seconds', args: ['-vf','fps=1/5','-q:v','3'] },
  ],
  compress: [
    { name: 'Compress 50%', ext: 'mp4', desc: 'CRF 28 fast preset', args: ['-c:v','libx264','-crf','28','-preset','fast','-c:a','aac','-b:a','128k'] },
    { name: 'Compress 70%', ext: 'mp4', desc: 'CRF 32 faster', args: ['-c:v','libx264','-crf','32','-preset','faster','-c:a','aac','-b:a','96k'] },
    { name: 'Twitter/X',   ext: 'mp4', desc: '720p, 2.5MB target', args: ['-c:v','libx264','-crf','26','-preset','fast','-vf','scale=1280:720','-c:a','aac','-b:a','128k'] },
    { name: 'WhatsApp',    ext: 'mp4', desc: 'Max compat, small', args: ['-c:v','libx264','-crf','30','-preset','fast','-vf','scale=640:360','-c:a','aac','-b:a','64k'] },
    { name: 'Discord',     ext: 'mp4', desc: '< 8MB upload', args: ['-c:v','libx264','-crf','24','-preset','fast','-maxrate','1000k','-bufsize','2000k','-c:a','aac','-b:a','96k'] },
    { name: 'Telegram',    ext: 'mp4', desc: 'Streaming ready', args: ['-c:v','libx264','-movflags','+faststart','-crf','24','-c:a','aac','-b:a','128k'] },
  ],
};

function renderPresets(cat) {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = '';
  (PRESETS[cat] || []).forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'preset-card' + (selectedPreset && selectedPreset.name === p.name ? ' selected' : '');
    card.innerHTML = `<div class="p-name">${p.name}</div><div class="p-ext">.${p.ext}</div><div class="p-desc">${p.desc}</div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPreset = p;
      document.getElementById('quick-outname').value = 'output.' + p.ext;
      updateQuickCmd();
    });
    grid.appendChild(card);
  });
}

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPreset = null;
    renderPresets(btn.dataset.cat);
  });
});
renderPresets('video');

// Quick file drop
const quickDrop = document.getElementById('quick-drop');
const quickFileInput = document.getElementById('quick-file-input');

quickDrop.addEventListener('dragover', e => { e.preventDefault(); quickDrop.classList.add('drag-over'); });
quickDrop.addEventListener('dragleave', () => quickDrop.classList.remove('drag-over'));
quickDrop.addEventListener('drop', e => {
  e.preventDefault(); quickDrop.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleQuickFile(e.dataTransfer.files[0]);
});
quickFileInput.addEventListener('change', e => { if (e.target.files[0]) handleQuickFile(e.target.files[0]); });

function handleQuickFile(file) {
  quickFile = file;
  const info = document.getElementById('quick-file-info');
  info.textContent = `${file.name}  (${formatBytes(file.size)})`;
  info.classList.remove('hidden');
  if (ffmpegLoaded) document.getElementById('quick-run-btn').disabled = false;
  updateQuickCmd();
}

function updateQuickCmd() {
  const cmd = document.getElementById('quick-generated-cmd');
  if (!selectedPreset) { cmd.textContent = 'Select a preset ↑'; return; }
  const parts = buildQuickArgs();
  cmd.textContent = 'ffmpeg ' + parts.join(' ');
}

function buildQuickArgs() {
  const inName  = quickFile ? quickFile.name : 'input';
  const outName = document.getElementById('quick-outname').value || 'output';
  const crf     = document.getElementById('quick-crf').value;
  const scale   = document.getElementById('quick-scale').value;
  const ss      = document.getElementById('quick-ss').value;
  const t       = document.getElementById('quick-t').value;

  const args = ['-i', inName];
  if (ss)  { args.push('-ss', ss); }
  if (t)   { args.push('-t', t); }

  // Build vf filter
  let vfFilters = [];
  if (scale) vfFilters.push(`scale=${scale}:-2`);

  // Preset args (excluding -vf since we merge)
  const presetArgs = [...selectedPreset.args];
  const vfIdx = presetArgs.indexOf('-vf');
  if (vfIdx !== -1) {
    const presetVf = presetArgs.splice(vfIdx, 2)[1];
    vfFilters.push(presetVf);
  }

  args.push(...presetArgs);
  if (vfFilters.length) args.push('-vf', vfFilters.join(','));

  // Override CRF if preset uses libx264/libx265
  if (presetArgs.includes('libx264') || presetArgs.includes('libx265')) {
    const crfIdx = args.indexOf('-crf');
    if (crfIdx === -1) args.push('-crf', crf);
  }

  args.push(outName);
  return args;
}

['quick-crf','quick-scale','quick-ss','quick-t','quick-outname'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateQuickCmd);
});
document.getElementById('quick-crf').addEventListener('input', e => {
  document.getElementById('quick-crf-val').textContent = e.target.value;
});

// Quick run
document.getElementById('quick-run-btn').addEventListener('click', async () => {
  if (!ffmpegLoaded || !quickFile || !selectedPreset) return;
  const outName = document.getElementById('quick-outname').value || 'output';
  const args = buildQuickArgs();
  const section = document.getElementById('quick-progress-section');
  section.style.display = 'block';
  document.getElementById('quick-log').innerHTML = '';
  currentLogTarget = 'quick-log';
  currentProgressTarget = 'quick-progress';

  try {
    await ffmpegInstance.writeFile(quickFile.name, await fetchFile(quickFile));
    await ffmpegInstance.exec(args);
    const data = await ffmpegInstance.readFile(outName);
    const blob = new Blob([data.buffer], { type: guessMime(outName) });
    renderOutput('quick-output-preview', blob, outName);
    toast('Conversion complete!', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    appendLog('quick-log', 'ERROR: ' + e.message);
  } finally {
    currentLogTarget = null;
    currentProgressTarget = null;
  }
});

// ═══════════════════════════════════════════════════════════
// PLAYGROUND
// ═══════════════════════════════════════════════════════════
const SNIPPETS = [
  { label: 'to MP4',      cmd: 'ffmpeg -i INPUT -c:v libx264 -c:a aac output.mp4' },
  { label: 'to MP3',      cmd: 'ffmpeg -i INPUT -vn -b:a 192k output.mp3' },
  { label: 'to GIF',      cmd: 'ffmpeg -i INPUT -vf "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" output.gif' },
  { label: 'Snapshot',    cmd: 'ffmpeg -i INPUT -ss 00:00:01 -vframes 1 thumb.jpg' },
  { label: 'Compress',    cmd: 'ffmpeg -i INPUT -crf 28 -preset fast output.mp4' },
  { label: 'Extract audio', cmd: 'ffmpeg -i INPUT -vn -c:a libmp3lame output.mp3' },
  { label: 'Trim 10s',    cmd: 'ffmpeg -ss 0 -t 10 -i INPUT -c copy out_trim.mp4' },
  { label: 'Scale 720p',  cmd: 'ffmpeg -i INPUT -vf scale=1280:720 -c:a copy output_720.mp4' },
  { label: 'Reverse',     cmd: 'ffmpeg -i INPUT -vf reverse -af areverse out_rev.mp4' },
  { label: 'Grayscale',   cmd: 'ffmpeg -i INPUT -vf format=gray output_gray.mp4' },
  { label: 'Speed 2x',    cmd: 'ffmpeg -i INPUT -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]" out_fast.mp4' },
  { label: 'Slow 0.5x',   cmd: 'ffmpeg -i INPUT -filter_complex "[0:v]setpts=2.0*PTS[v];[0:a]atempo=0.5[a]" -map "[v]" -map "[a]" out_slow.mp4' },
  { label: 'Rotate 90°',  cmd: 'ffmpeg -i INPUT -vf "transpose=1" out_rot.mp4' },
  { label: 'Loudnorm',    cmd: 'ffmpeg -i INPUT -af loudnorm output_loud.mp4' },
  { label: 'Crop center', cmd: 'ffmpeg -i INPUT -vf "crop=in_w/2:in_h/2:(in_w-in_w/2)/2:(in_h-in_h/2)/2" out_crop.mp4' },
  { label: 'Add subtitles', cmd: 'ffmpeg -i INPUT -vf subtitles=subs.srt out_sub.mp4' },
];

function initSnippets() {
  const bar = document.getElementById('snippets-scroll');
  SNIPPETS.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'snippet-chip';
    chip.textContent = s.label;
    chip.addEventListener('click', () => {
      const input = document.getElementById('pg-cmd-input');
      // Auto-replace INPUT with first vfs file if available
      let cmd = s.cmd;
      if (vfs.size > 0) cmd = cmd.replace('INPUT', [...vfs.keys()][0]);
      input.value = cmd;
      input.focus();
    });
    bar.appendChild(chip);
  });
}
initSnippets();

// PG file drop
const pgDrop = document.getElementById('pg-drop');
const pgFileInput = document.getElementById('pg-file-input');
pgDrop.addEventListener('click', () => pgFileInput.click());
pgFileInput.addEventListener('change', e => {
  [...e.target.files].forEach(addToVFS);
  e.target.value = '';
});

async function addToVFS(file) {
  const data = await file.arrayBuffer();
  vfs.set(file.name, new Uint8Array(data));
  renderVFS();
  if (ffmpegLoaded) await ffmpegInstance.writeFile(file.name, vfs.get(file.name));
  toast(`Added: ${file.name}`, 'info');
}

function renderVFS() {
  const list = document.getElementById('pg-file-list');
  list.innerHTML = '';
  vfs.forEach((data, name) => {
    const li = document.createElement('li');
    li.className = 'vfs-item';
    li.innerHTML = `
      <span class="vfs-name">${name}</span>
      <span class="vfs-size">${formatBytes(data.byteLength)}</span>
      <button class="vfs-del" data-name="${name}">✕</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('.vfs-del').forEach(btn => {
    btn.addEventListener('click', () => {
      vfs.delete(btn.dataset.name);
      renderVFS();
    });
  });
}

// PG run
async function pgRunCommand() {
  const raw = document.getElementById('pg-cmd-input').value.trim();
  if (!raw || !ffmpegLoaded) return;

  addTerminalLine('pg-terminal', '$ ' + raw, 'cmd');

  // Parse command
  let args = parseShellArgs(raw);
  if (args[0] === 'ffmpeg') args = args.slice(1);

  try {
    // Write all vfs files
  //  for (const [name, data] of vfs.entries()) {
  //    await ffmpegInstance.writeFile(name, data);
  //  }
    currentProgressTarget = null;
    await ffmpegInstance.exec(args);

    // Try to read output (last arg)
    const outArg = args[args.length - 1];
    if (outArg && !outArg.startsWith('-')) {
      try {
        const data = await ffmpegInstance.readFile(outArg);
        const blob = new Blob([data.buffer], { type: guessMime(outArg) });
        renderPGOutput(blob, outArg);
        addTerminalLine('pg-terminal', `✓ Output: ${outArg} (${formatBytes(data.byteLength)})`, 'success');
      } catch (_) {}
    }
  } catch (e) {
    addTerminalLine('pg-terminal', 'Error: ' + e.message, 'err');
    toast(e.message, 'error');
  }
}

document.getElementById('pg-run-btn').addEventListener('click', pgRunCommand);
document.getElementById('pg-cmd-input').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') pgRunCommand();
  if (e.key === 'Enter') pgRunCommand();
});
document.getElementById('pg-clear-btn').addEventListener('click', () => {
  document.getElementById('pg-terminal').innerHTML = '';
  document.getElementById('pg-outputs').innerHTML = '';
});

function renderPGOutput(blob, name) {
  const container = document.getElementById('pg-outputs');
  const wrap = document.createElement('div');
  wrap.className = 'pg-output-item';
  const url = URL.createObjectURL(blob);

  if (blob.type.startsWith('video')) {
    wrap.innerHTML = `<video src="${url}" controls style="max-width:280px;max-height:160px"></video>`;
  } else if (blob.type.startsWith('audio')) {
    wrap.innerHTML = `<audio src="${url}" controls></audio>`;
  } else if (blob.type.startsWith('image')) {
    wrap.innerHTML = `<img src="${url}" style="max-width:280px;max-height:160px"/>`;
  }

  const dl = document.createElement('a');
  dl.className = 'download-btn';
  dl.href = url; dl.download = name;
  dl.textContent = `⬇ ${name}`;
  wrap.appendChild(dl);
  container.appendChild(wrap);
}

// ═══════════════════════════════════════════════════════════
// VISUAL EDITOR
// ═══════════════════════════════════════════════════════════
let editorPipeline = [];
let editorInputFile = null;

const OP_DEFS = {
  input:      { title: '📂 Input File', fields: [] },
  output:     { title: '💾 Output File', fields: [{ label: 'Filename', key: 'filename', val: 'output.mp4', type: 'text' }] },
  scale:      { title: '⤡ Scale', fields: [{ label: 'Width', key: 'w', val: '1280', type: 'text' }, { label: 'Height', key: 'h', val: '-2', type: 'text' }] },
  trim:       { title: '✂ Trim', fields: [{ label: 'Start', key: 'ss', val: '0', type: 'text' }, { label: 'Duration', key: 't', val: '30', type: 'text' }] },
  fps:        { title: '🎞 FPS', fields: [{ label: 'FPS', key: 'fps', val: '30', type: 'text' }] },
  rotate:     { title: '↺ Rotate', fields: [{ label: 'Degrees', key: 'deg', val: '90', type: 'select', options: ['90','180','270'] }] },
  crop:       { title: '▣ Crop', fields: [{ label: 'W', key: 'cw', val: '640' }, { label: 'H', key: 'ch', val: '480' }, { label: 'X', key: 'cx', val: '0' }, { label: 'Y', key: 'cy', val: '0' }] },
  vcodec:     { title: '▷ Video Codec', fields: [{ label: 'Codec', key: 'codec', val: 'libx264', type: 'select', options: ['libx264','libx265','libvpx-vp9','mpeg4','copy'] }, { label: 'CRF', key: 'crf', val: '23', type: 'text' }] },
  volume:     { title: '🔊 Volume', fields: [{ label: 'Multiplier', key: 'vol', val: '1.5', type: 'text' }] },
  acodec:     { title: '♫ Audio Codec', fields: [{ label: 'Codec', key: 'codec', val: 'aac', type: 'select', options: ['aac','libmp3lame','libvorbis','libopus','flac','pcm_s16le','copy'] }, { label: 'Bitrate', key: 'br', val: '192k', type: 'text' }] },
  mute:       { title: '🔇 Strip Audio', fields: [] },
  blur:       { title: '◎ Blur', fields: [{ label: 'Radius', key: 'r', val: '5', type: 'text' }] },
  brightness: { title: '☀ Brightness', fields: [{ label: 'Brightness', key: 'b', val: '0.1', type: 'text' }, { label: 'Contrast', key: 'c', val: '1.0', type: 'text' }] },
  vflip:      { title: '↕ Vertical Flip', fields: [] },
  hflip:      { title: '↔ Horizontal Flip', fields: [] },
  grayscale:  { title: '⬛ Grayscale', fields: [] },
  subtitle:   { title: 'CC Burn Subtitles', fields: [{ label: '.srt file', key: 'src', val: 'subs.srt', type: 'text' }] },
};

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const op = btn.dataset.op;
    const def = OP_DEFS[op];
    if (!def) return;
    const id = Date.now();
    const node = { id, op, def, values: Object.fromEntries((def.fields || []).map(f => [f.key, f.val])) };
    editorPipeline.push(node);
    renderPipeline();
    updateEditorCmd();
    document.getElementById('canvas-hint').style.display = 'none';
  });
});

function renderPipeline() {
  const container = document.getElementById('pipeline-nodes');
  container.innerHTML = '';
  editorPipeline.forEach((node, idx) => {
    const el = document.createElement('div');
    el.className = 'pipeline-node';
    const isLast = idx === editorPipeline.length - 1;
    el.innerHTML = `
      <div class="node-connector">
        <div class="node-dot"></div>
        ${!isLast ? '<div class="node-line"></div>' : ''}
      </div>
      <div class="node-body">
        <div class="node-title">${node.def.title}</div>
        <div class="node-fields" id="nf-${node.id}"></div>
      </div>
      <button class="node-del" data-id="${node.id}">✕</button>`;
    container.appendChild(el);

    // Build fields
    const fieldsEl = el.querySelector(`#nf-${node.id}`);
    node.def.fields.forEach(f => {
      const row = document.createElement('div');
      row.className = 'node-field-row';
      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        input.className = 'code-select';
        f.options.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o; opt.textContent = o;
          if (o === node.values[f.key]) opt.selected = true;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement('input');
        input.type = 'text'; input.className = 'code-input';
        input.value = node.values[f.key] || '';
      }
      input.addEventListener('input', () => {
        node.values[f.key] = input.value;
        updateEditorCmd();
      });
      row.innerHTML = `<span class="node-field-label">${f.label}</span>`;
      row.appendChild(input);
      fieldsEl.appendChild(row);
    });

    el.querySelector('.node-del').addEventListener('click', () => {
      editorPipeline = editorPipeline.filter(n => n.id !== node.id);
      renderPipeline();
      updateEditorCmd();
      if (editorPipeline.length === 0) document.getElementById('canvas-hint').style.display = '';
    });
  });
}

function updateEditorCmd() {
  const inFile = document.getElementById('editor-input-file').value || 'input.mp4';
  const outFile = document.getElementById('editor-output-file').value || 'output.mp4';

  const args = ['-i', inFile];
  const vfFilters = [];

  editorPipeline.forEach(node => {
    switch (node.op) {
      case 'trim':     args.push('-ss', node.values.ss, '-t', node.values.t); break;
      case 'scale':    vfFilters.push(`scale=${node.values.w}:${node.values.h}`); break;
      case 'fps':      vfFilters.push(`fps=${node.values.fps}`); break;
      case 'rotate':   vfFilters.push(`transpose=${node.values.deg === '90' ? 1 : node.values.deg === '180' ? '2,transpose=2' : 2}`); break;
      case 'crop':     vfFilters.push(`crop=${node.values.cw}:${node.values.ch}:${node.values.cx}:${node.values.cy}`); break;
      case 'vcodec':   args.push('-c:v', node.values.codec); if (node.values.codec !== 'copy') args.push('-crf', node.values.crf); break;
      case 'volume':   args.push('-af', `volume=${node.values.vol}`); break;
      case 'acodec':   args.push('-c:a', node.values.codec); if (node.values.codec !== 'copy') args.push('-b:a', node.values.br); break;
      case 'mute':     args.push('-an'); break;
      case 'blur':     vfFilters.push(`gblur=sigma=${node.values.r}`); break;
      case 'brightness': vfFilters.push(`eq=brightness=${node.values.b}:contrast=${node.values.c}`); break;
      case 'vflip':    vfFilters.push('vflip'); break;
      case 'hflip':    vfFilters.push('hflip'); break;
      case 'grayscale': vfFilters.push('format=gray'); break;
      case 'subtitle': vfFilters.push(`subtitles=${node.values.src}`); break;
    }
  });

  if (vfFilters.length) args.push('-vf', '"' + vfFilters.join(',') + '"');
  args.push(outFile);

  document.getElementById('editor-cmd-code').textContent = 'ffmpeg ' + args.join(' ');
  return args;
}

document.getElementById('editor-file-input').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  editorInputFile = file;
  document.getElementById('editor-input-file').value = file.name;
  document.getElementById('editor-output-file').value = 'output.' + file.name.split('.').pop();
  document.getElementById('editor-run-btn').disabled = !ffmpegLoaded;
  updateEditorCmd();
});
document.getElementById('editor-input-file').addEventListener('input', updateEditorCmd);
document.getElementById('editor-output-file').addEventListener('input', updateEditorCmd);

document.getElementById('editor-run-btn').addEventListener('click', async () => {
  if (!ffmpegLoaded || !editorInputFile) return;
  const cmdEl = document.getElementById('editor-cmd-code').textContent;
  const outFile = document.getElementById('editor-output-file').value || 'output.mp4';
  let args = parseShellArgs(cmdEl);
  if (args[0] === 'ffmpeg') args = args.slice(1);

  const wrap = document.getElementById('editor-progress-wrap');
  wrap.style.display = 'block';
  document.getElementById('editor-log').innerHTML = '';
  currentLogTarget = 'editor-log';
  currentProgressTarget = 'editor-progress';

  try {
    await ffmpegInstance.writeFile(editorInputFile.name, await fetchFile(editorInputFile));
    await ffmpegInstance.exec(args);
    const data = await ffmpegInstance.readFile(outFile);
    const blob = new Blob([data.buffer], { type: guessMime(outFile) });
    renderOutput('editor-output-preview', blob, outFile);
    toast('Pipeline complete!', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    appendLog('editor-log', 'ERROR: ' + e.message);
  } finally {
    currentLogTarget = null;
    currentProgressTarget = null;
  }
});

// ═══════════════════════════════════════════════════════════
// CODE MODE
// ═══════════════════════════════════════════════════════════
const DEFAULT_CODE = `// FFmpeg Studio — Fluent API
// Use the 'ff' object to build and run commands

const result = await ff
  .input('video.mp4')      // specify input file (must be loaded in Playground)
  .trim('0', '10')         // trim: start, duration
  .scale(1280, 720)        // resize
  .fps(30)                 // set framerate
  .codec('libx264', 23)    // video codec, crf
  .audioCodec('aac', '192k')
  .output('out.mp4')
  .run();

console.log('Done!', result.filename, formatBytes(result.size));
`;

const CODE_EXAMPLES = [
  {
    title: 'Convert to GIF',
    desc: 'Convert a video to an optimized GIF',
    code: `// Convert video to optimized GIF
const result = await ff
  .input('video.mp4')
  .trim('0', '5')
  .scale(480, -1)
  .fps(12)
  .output('animated.gif')
  .run();
console.log('GIF created:', result.filename);`
  },
  {
    title: 'Batch screenshots',
    desc: 'Extract frames every N seconds',
    code: `// Extract a frame every 2 seconds
const result = await ffmpeg.exec([
  '-i', 'video.mp4',
  '-vf', 'fps=1/2',
  '-q:v', '2',
  'frame%03d.jpg'
]);
console.log('Frames extracted');`
  },
  {
    title: 'Audio visualizer',
    desc: 'Create audio waveform video',
    code: `// Generate waveform visualization
const result = await ffmpeg.exec([
  '-i', 'audio.mp3',
  '-filter_complex',
  '[0:a]showwaves=s=1280x360:mode=line:rate=25:colors=00e5a0[v]',
  '-map', '[v]',
  '-map', '0:a',
  '-c:v', 'libx264',
  '-c:a', 'copy',
  'waveform.mp4'
]);`
  },
  {
    title: 'Normalize loudness',
    desc: 'EBU R128 loudness normalization',
    code: `// Normalize audio loudness (EBU R128)
const result = await ffmpeg.exec([
  '-i', 'video.mp4',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:v', 'copy',
  'normalized.mp4'
]);
console.log('Normalized!');`
  },
  {
    title: 'Stacked comparison',
    desc: 'Side-by-side video comparison',
    code: `// Stack two videos side by side
const result = await ffmpeg.exec([
  '-i', 'video1.mp4',
  '-i', 'video2.mp4',
  '-filter_complex',
  '[0][1]hstack=inputs=2[out]',
  '-map', '[out]',
  '-map', '0:a',
  '-c:v', 'libx264',
  'comparison.mp4'
]);`
  },
  {
    title: 'Thumbnail grid',
    desc: 'Create a thumbnail mosaic',
    code: `// Create a 4x4 thumbnail grid
const result = await ffmpeg.exec([
  '-i', 'video.mp4',
  '-vf',
  'select=not(mod(n\\,30)),scale=160:90,tile=4x4',
  '-frames:v', '1',
  '-q:v', '2',
  'thumbgrid.jpg'
]);`
  },
];

// Fluent Builder
class FFFluentBuilder {
  constructor(ff) {
    this._ff = ff;
    this._inputFile = null;
    this._outputFile = null;
    this._args = [];
    this._vf = [];
    this._af = [];
  }
  input(name) { this._inputFile = name; return this; }
  output(name) { this._outputFile = name; return this; }
  trim(ss, t) { this._args.push('-ss', ss, '-t', t); return this; }
  scale(w, h = -2) { this._vf.push(`scale=${w}:${h}`); return this; }
  fps(n) { this._vf.push(`fps=${n}`); return this; }
  codec(c, crf = 23) { this._args.push('-c:v', c); if (c !== 'copy') this._args.push('-crf', String(crf)); return this; }
  audioCodec(c, br = '192k') { this._args.push('-c:a', c); if (c !== 'copy') this._args.push('-b:a', br); return this; }
  volume(v) { this._af.push(`volume=${v}`); return this; }
  blur(r) { this._vf.push(`gblur=sigma=${r}`); return this; }
  grayscale() { this._vf.push('format=gray'); return this; }
  rotate(deg) { this._vf.push(`transpose=${deg === 90 ? 1 : 2}`); return this; }
  hflip() { this._vf.push('hflip'); return this; }
  vflip() { this._vf.push('vflip'); return this; }
  noAudio() { this._args.push('-an'); return this; }
  custom(...args) { this._args.push(...args); return this; }

  async run() {
    if (!this._inputFile || !this._outputFile) throw new Error('input() and output() required');
    const ffInst = this._ff;
    const args = ['-i', this._inputFile, ...this._args];
    if (this._vf.length) args.push('-vf', this._vf.join(','));
    if (this._af.length) args.push('-af', this._af.join(','));
    args.push(this._outputFile);
    addCodeLog(`$ ffmpeg ${args.join(' ')}`, 'c-info');
    await ffInst.exec(args);
    const data = await ffInst.readFile(this._outputFile);
    return { filename: this._outputFile, size: data.byteLength, data };
  }
}

// Code editor setup
const codeEditor = document.getElementById('code-editor');
codeEditor.value = DEFAULT_CODE;
updateLineNumbers();

codeEditor.addEventListener('input', updateLineNumbers);
codeEditor.addEventListener('scroll', syncScroll);
codeEditor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = codeEditor.selectionStart;
    codeEditor.value = codeEditor.value.substring(0, s) + '  ' + codeEditor.value.substring(codeEditor.selectionEnd);
    codeEditor.selectionStart = codeEditor.selectionEnd = s + 2;
  }
});

function updateLineNumbers() {
  const lines = codeEditor.value.split('\n').length;
  document.getElementById('line-numbers').innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}
function syncScroll() {
  document.getElementById('line-numbers').scrollTop = codeEditor.scrollTop;
}

function addCodeLog(msg, cls = '') {
  const term = document.getElementById('code-terminal');
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = msg;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

// Run code
document.getElementById('code-run-btn').addEventListener('click', async () => {
  if (!ffmpegLoaded) { toast('FFmpeg not ready', 'error'); return; }
  document.getElementById('code-terminal').innerHTML = '';
  document.getElementById('code-output-preview').innerHTML = '';
  addCodeLog('Running…', 'c-info');

  const code = codeEditor.value;

  // Build sandbox console
  const sandboxConsole = {
    log: (...a) => addCodeLog(a.map(String).join(' ')),
    error: (...a) => addCodeLog(a.map(String).join(' '), 'c-err'),
    warn: (...a) => addCodeLog(a.map(String).join(' '), 'c-warn'),
    info: (...a) => addCodeLog(a.map(String).join(' '), 'c-info'),
  };

  const ff = new FFFluentBuilder(ffmpegInstance);
  const ffmpeg = ffmpegInstance;

  try {
    // Write vfs files first
    for (const [name, data] of vfs.entries()) {
      await ffmpegInstance.writeFile(name, data);
    }

    const wrapped = `(async () => { ${code} })()`;
    const fn = new Function('ff', 'ffmpeg', 'fetchFile', 'formatBytes', 'console', wrapped);
    await fn(ff, ffmpeg, fetchFile, formatBytes, sandboxConsole);
    addCodeLog('✓ Execution complete', 'c-success');

    // Try to show last output
    if (ff._outputFile) {
      try {
        const data = await ffmpegInstance.readFile(ff._outputFile);
        const blob = new Blob([data.buffer], { type: guessMime(ff._outputFile) });
        renderOutput('code-output-preview', blob, ff._outputFile);
      } catch (_) {}
    }
  } catch (e) {
    addCodeLog('Error: ' + e.message, 'c-err');
    toast('Script error: ' + e.message, 'error');
  }
});

document.getElementById('code-clear-out').addEventListener('click', () => {
  document.getElementById('code-terminal').innerHTML = '';
  document.getElementById('code-output-preview').innerHTML = '';
});

// Examples
document.getElementById('code-examples-btn').addEventListener('click', () => {
  const modal = document.getElementById('examples-modal');
  const list  = document.getElementById('examples-list');
  list.innerHTML = '';
  CODE_EXAMPLES.forEach(ex => {
    const item = document.createElement('div');
    item.className = 'example-item';
    item.innerHTML = `<div class="ex-title">${ex.title}</div><div class="ex-desc">${ex.desc}</div>`;
    item.addEventListener('click', () => {
      codeEditor.value = ex.code;
      updateLineNumbers();
      modal.style.display = 'none';
    });
    list.appendChild(item);
  });
  modal.style.display = 'flex';
});
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('examples-modal').style.display = 'none';
});
document.getElementById('examples-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// Format code btn (basic indentation)
document.getElementById('code-format-btn').addEventListener('click', () => {
  toast('Basic formatting applied', 'info');
  // simple: normalize spacing
  codeEditor.value = codeEditor.value.replace(/\t/g, '  ').replace(/\n{3,}/g, '\n\n');
  updateLineNumbers();
});

// API Docs
const FLUENT_API = [
  { name: '.input(filename)', sig: 'input(name: string)', desc: 'Set input file name (must exist in VFS)' },
  { name: '.output(filename)', sig: 'output(name: string)', desc: 'Set output file name' },
  { name: '.trim(start, dur)', sig: 'trim(ss: string, t: string)', desc: 'Trim from start for duration' },
  { name: '.scale(w, h)', sig: 'scale(w: number, h?: number)', desc: 'Resize. Default h=-2 (keep ratio)' },
  { name: '.fps(n)', sig: 'fps(n: number)', desc: 'Change frame rate' },
  { name: '.codec(c, crf)', sig: 'codec(codec: string, crf?: number)', desc: 'Set video codec and quality' },
  { name: '.audioCodec(c, br)', sig: 'audioCodec(c: string, br?: string)', desc: 'Set audio codec and bitrate' },
  { name: '.volume(v)', sig: 'volume(v: number)', desc: 'Multiply audio volume' },
  { name: '.blur(r)', sig: 'blur(radius: number)', desc: 'Apply Gaussian blur' },
  { name: '.grayscale()', sig: 'grayscale()', desc: 'Convert to grayscale' },
  { name: '.rotate(deg)', sig: 'rotate(deg: 90|270)', desc: 'Rotate 90 or 270 degrees' },
  { name: '.hflip()', sig: 'hflip()', desc: 'Flip horizontally' },
  { name: '.vflip()', sig: 'vflip()', desc: 'Flip vertically' },
  { name: '.noAudio()', sig: 'noAudio()', desc: 'Remove audio stream' },
  { name: '.custom(...args)', sig: 'custom(...args: string[])', desc: 'Append raw FFmpeg arguments' },
  { name: '.run()', sig: 'run(): Promise<{filename, size, data}>', desc: 'Execute the pipeline' },
];
const RAW_API = [
  { name: 'ffmpeg.exec(args)', sig: 'exec(args: string[]): Promise<void>', desc: 'Run raw FFmpeg command array' },
  { name: 'ffmpeg.writeFile()', sig: 'writeFile(name, data): Promise<void>', desc: 'Write file to WASM FS' },
  { name: 'ffmpeg.readFile()', sig: 'readFile(name): Promise<Uint8Array>', desc: 'Read file from WASM FS' },
  { name: 'ffmpeg.deleteFile()', sig: 'deleteFile(name): Promise<void>', desc: 'Delete file from WASM FS' },
  { name: 'ffmpeg.listDir("/")', sig: 'listDir(path): Promise<FSNode[]>', desc: 'List directory contents' },
  { name: 'fetchFile(src)', sig: 'fetchFile(src: File|URL|string): Promise<Uint8Array>', desc: 'Fetch a file into WASM FS' },
  { name: 'formatBytes(n)', sig: 'formatBytes(n: number): string', desc: 'Format byte count to human string' },
];

function renderApiDocs(type) {
  const docs = document.getElementById('api-docs');
  const items = type === 'fluent' ? FLUENT_API : RAW_API;
  docs.innerHTML = '';
  const section = document.createElement('div');
  section.className = 'api-section';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'api-method';
    el.innerHTML = `<div class="api-method-name">${item.name}</div><div class="api-method-sig">${item.sig}</div><div class="api-method-desc">${item.desc}</div>`;
    el.addEventListener('click', () => {
      const pos = codeEditor.selectionStart;
      codeEditor.value = codeEditor.value.substring(0, pos) + item.name + codeEditor.value.substring(pos);
      updateLineNumbers();
      codeEditor.focus();
    });
    section.appendChild(el);
  });
  docs.appendChild(section);
}
renderApiDocs('fluent');

document.querySelectorAll('.api-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.api-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderApiDocs(btn.dataset.api);
  });
});

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function renderOutput(containerId, blob, filename) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const url = URL.createObjectURL(blob);
  let media;
  if (blob.type.startsWith('video')) {
    media = document.createElement('video');
    media.src = url; media.controls = true;
    media.style.maxWidth = '100%'; media.style.maxHeight = '300px';
  } else if (blob.type.startsWith('audio')) {
    media = document.createElement('audio');
    media.src = url; media.controls = true; media.style.width = '100%';
  } else if (blob.type.startsWith('image')) {
    media = document.createElement('img');
    media.src = url; media.style.maxWidth = '100%'; media.style.maxHeight = '300px';
  }
  if (media) container.appendChild(media);

  const dl = document.createElement('a');
  dl.className = 'download-btn';
  dl.href = url; dl.download = filename;
  dl.innerHTML = `⬇ Download ${filename} (${formatBytes(blob.size)})`;
  container.appendChild(dl);
}

function guessMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', mov: 'video/quicktime', gif: 'image/gif',
    mp3: 'audio/mpeg', aac: 'audio/aac', ogg: 'audio/ogg',
    flac: 'audio/flac', wav: 'audio/wav', opus: 'audio/opus',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseShellArgs(cmd) {
  const args = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if ((c === '"' || c === "'") && !inQuote) { inQuote = true; quoteChar = c; }
    else if (c === quoteChar && inQuote) { inQuote = false; args.push(current); current = ''; }
    else if (c === ' ' && !inQuote) { if (current) { args.push(current); current = ''; } }
    else { current += c; }
  }
  if (current) args.push(current);
  return args;
}

// ─── Boot ──────────────────────────────────────────────────
loadFFmpeg();
