// js/main-gerador.js
import { MidiWriter, parseMidiFile } from './midi-utils.js';
import { callGroq, getComposerSystemPrompt, parseAiParams } from './api-client.js';
import { setStatus, drawPianoRoll, drawNoteList } from './ui-controller.js';
import { MidiPlayer } from './midi-player.js';
import { generate } from './theory.js';

// Instâncias de player por ID
const players = {};

function getPlayer(id) {
  if (!players[id]) players[id] = new MidiPlayer();
  return players[id];
}

function bindPlayer(id) {
  const p = getPlayer(id);
  p.onProgress = (progress, elapsed) => {
    const fill = document.getElementById('fill-' + id);
    const time = document.getElementById('time-' + id);
    if (fill) fill.style.width = (progress * 100).toFixed(1) + '%';
    if (time) {
      const sec = Math.floor(elapsed);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      time.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }
  };
  p.onEnd = () => {
    const btn = document.getElementById('btn-play-' + id);
    if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
  };
}

window.playerToggle = (id) => {
  const p   = getPlayer(id);
  const btn = document.getElementById('btn-play-' + id);
  if (p.playing) {
    p.pause();
    btn.textContent = '▶'; btn.classList.remove('playing');
  } else {
    p.paused ? p.resume() : p.play();
    btn.textContent = '⏸'; btn.classList.add('playing');
  }
};

window.playerStop = (id) => {
  getPlayer(id).stop();
  const btn = document.getElementById('btn-play-' + id);
  if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
};

window.playerSeek = (id, event) => {
  const wrap = document.getElementById('seek-' + id);
  const ratio = event.offsetX / wrap.offsetWidth;
  getPlayer(id).seek(Math.max(0, Math.min(1, ratio)));
};

window.playerVol = (id, val) => {
  getPlayer(id).setVolume(parseFloat(val));
};

// ============================================================
// SLIDERS
// ============================================================
document.getElementById('tempo').addEventListener('input', e =>
  document.getElementById('tempo-val').textContent = e.target.value);

document.getElementById('duration').addEventListener('input', e =>
  document.getElementById('duration-val').textContent = e.target.value);

// Validação em tempo real do JSON importado
document.getElementById('json-input').addEventListener('input', function () {
  const el  = document.getElementById('json-status');
  const raw = this.value.trim();
  if (!raw) { el.textContent = ''; return; }
  try {
    const n = parseNotasFromString(raw);
    el.textContent = `✓ ${n.length} notas detectadas`;
    el.className = 'json-status ok';
  } catch {
    el.textContent = '⚠ JSON ainda incompleto ou inválido';
    el.className = 'json-status err';
  }
});

// ============================================================
// HELPERS
// ============================================================
function parseNotasFromString(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON não encontrado');
  const parsed = JSON.parse(m[0]);
  const notas = parsed.notas || parsed.notes || parsed.data || [];
  if (!notas.length) throw new Error('Nenhuma nota encontrada');
  return notas;
}

function parseMidiJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON não encontrado');
  const parsed = JSON.parse(m[0]);
  const notas = parsed.notas || parsed.notes || parsed.data || [];
  if (!notas.length) throw new Error('Nenhuma nota encontrada');
  const bpm   = parsed.bpm  || parsed.tempo || 90;
  const instr = parsed.instrument ?? parsed.instrumento ?? 0;
  const tpb   = parsed.tpb  || 480;
  return { notas, bpm, instrument: instr, tpb };
}

function normalizeNota(n) {
  const rawVel = n.velocidade ?? n.velocity ?? n.volume ?? 80;
  return {
    nota:       Math.max(0,  Math.min(127, n.nota     ?? n.note     ?? n.pitch  ?? 60)),
    inicio:     Math.round(n.inicio  ?? n.start    ?? n.time   ?? n.offset ?? 0),
    duracao:    Math.max(60, Math.round(n.duracao  ?? n.duration ?? n.length ?? 480)),
    velocidade: Math.max(60, Math.min(127, rawVel < 10 ? rawVel * 10 : rawVel))
  };
}

function renderResult(id, rawNotas, tempo, instrument, tpb = 480, drumNotas = []) {
  const notas  = rawNotas.map(normalizeNota);
  const writer = new MidiWriter();

  // Usa buildWithDrums se tiver bateria, senão build normal
  const bytes = drumNotas.length > 0
    ? writer.buildWithDrums(notas, drumNotas, tempo, instrument, tpb)
    : writer.build(notas, tempo, instrument, tpb);

  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  document.getElementById('dl-' + id).href = url;
  document.getElementById('result-' + id).style.display = 'block';

  const p = getPlayer(id);
  p.load(notas, tempo, tpb);
  bindPlayer(id);
  const btn = document.getElementById('btn-play-' + id);
  if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }

  requestAnimationFrame(() => {
    drawPianoRoll('canvas-' + id, notas);
    drawNoteList('viz-' + id, notas);
  });
}

// ============================================================
// PAINEL DE PARÂMETROS DA IA
// ============================================================
const NOTE_NAMES_KEY = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function showAiParams(params, bpm) {
  const panel = document.getElementById('ai-params-panel');
  if (!panel) return;

  const keyName = NOTE_NAMES_KEY[params.key] || '?';

  panel.innerHTML = `
    <div class="ai-params-title">🤖 IA ESCOLHEU</div>
    <div class="ai-params-grid">
      <div class="ai-param-item">
        <span class="ai-param-label">ESCALA</span>
        <span class="ai-param-value">${params.scale}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">TÔNICA</span>
        <span class="ai-param-value">${keyName}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">ESTILO</span>
        <span class="ai-param-value">${params.style}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">BATERIA</span>
        <span class="ai-param-value">${params.drumStyle}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">BPM</span>
        <span class="ai-param-value">${bpm}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">COMPASSOS</span>
        <span class="ai-param-value">${params.bars}</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">PROGRESSÃO</span>
        <span class="ai-param-value">[${params.prog.join(',')}]</span>
      </div>
      <div class="ai-param-item">
        <span class="ai-param-label">HUMANIZE</span>
        <span class="ai-param-value">${params.humanize.toFixed(2)}</span>
      </div>
    </div>
    ${params._reasoning ? `<div class="ai-reasoning">💬 "${params._reasoning}"</div>` : ''}
  `;
  panel.style.display = 'block';
}

function hideAiParams() {
  const panel = document.getElementById('ai-params-panel');
  if (panel) panel.style.display = 'none';
}

// ============================================================
// FUNÇÕES EXPOSTAS AO HTML (window.*)
// ============================================================
window.setExample = (btn) => {
  document.getElementById('prompt').value = btn.textContent.trim();
};

window.switchTab = (name) => {
  document.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (name === 'json' && i === 0) || (name === 'upload' && i === 1)));
  document.getElementById('tab-json').classList.toggle('active', name === 'json');
  document.getElementById('tab-upload').classList.toggle('active', name === 'upload');
};

window.generateFromPrompt = async () => {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) { setStatus('status-gen', 'Descreva o som desejado.', 'error'); return; }

  const tempoUI  = parseInt(document.getElementById('tempo').value);
  const instr    = parseInt(document.getElementById('instrument').value);

  document.getElementById('btn-gen').disabled = true;
  hideAiParams();
  setStatus('status-gen', '🧠 IA interpretando descrição...', 'active');

  try {
    // ── PASSO 1: IA escolhe parâmetros ──────────────────────
    const rawAiResponse = await callGroq(
      getComposerSystemPrompt(0, prompt),
      prompt
    );

    const aiParams = parseAiParams(rawAiResponse, prompt);
    const bpm = tempoUI === 90 ? aiParams.bpm : tempoUI;

    // Mostrar painel de parâmetros
    showAiParams(aiParams, bpm);

    setStatus('status-gen', `🎼 Gerando: ${aiParams.style} / ${aiParams.scale} @ ${bpm}bpm...`, 'active');

    // ── PASSO 2: Engine procedural gera as notas ─────────────
    const cfg = {
      key:       aiParams.key + 48,
      scale:     aiParams.scale,
      bpm:       bpm,
      bars:      aiParams.bars,
      prog:      aiParams.prog,
      style:     aiParams.style,
      drumStyle: aiParams.drumStyle,
      humanize:  aiParams.humanize,
    };

    const song = generate(cfg);

    const tpb = 480;
    const b2t = (beats) => Math.round(beats * tpb);

    // Melodia + baixo → notas principais
    const totas = [
      ...song.melody.map(n => ({
        nota:       n.pitch,
        inicio:     b2t(n.startBeat),
        duracao:    Math.max(60, b2t(n.duration)),
        velocidade: n.velocity
      })),
      ...song.bass.map(n => ({
        nota:       n.pitch,
        inicio:     b2t(n.startBeat),
        duracao:    Math.max(60, b2t(n.duration)),
        velocidade: Math.round(n.velocity * 0.85)
      })),
    ];
    totas.sort((a, b) => a.inicio - b.inicio);

    // Bateria → canal 9 (notas já estão em GM: 36=kick, 38=snare, etc.)
    const drumNotas = song.drums.map(n => ({
      nota:       n.pitch,
      inicio:     b2t(n.startBeat),
      duracao:    60,   // percussão: duração curta fixa
      velocidade: Math.max(40, Math.min(127, n.velocity))
    }));

    renderResult('gen', totas, bpm, instr, tpb, drumNotas);

    const drumInfo = drumNotas.length > 0 ? ` + ${drumNotas.length} hits de bateria` : '';
    setStatus('status-gen',
      `✓ ${totas.length} notas${drumInfo} — ${aiParams.style} / ${aiParams.scale} @ ${bpm}bpm`, 'done');

  } catch (e) {
    console.error(e);
    setStatus('status-gen', '✗ ' + e.message, 'error');
  } finally {
    document.getElementById('btn-gen').disabled = false;
  }
};

window.importFromJSON = () => {
  const raw = document.getElementById('json-input').value.trim();
  if (!raw) { setStatus('status-import', 'Cole um JSON válido.', 'error'); return; }
  try {
    const { notas, bpm, instrument, tpb } = parseMidiJson(raw);
    document.getElementById('json-status').textContent = `✓ ${notas.length} notas importadas (${bpm} BPM)`;
    document.getElementById('json-status').className   = 'json-status ok';
    renderResult('import', notas, bpm, instrument, tpb);
    setStatus('status-import', `✓ ${notas.length} notas importadas! (${bpm} BPM)`, 'done');
  } catch (e) {
    document.getElementById('json-status').textContent = '✗ ' + e.message;
    document.getElementById('json-status').className   = 'json-status err';
    setStatus('status-import', '✗ Erro: ' + e.message, 'error');
  }
};

window.handleMidiUpload = (input) => {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const { notas, bpm, instrument, tpb } = parseMidiFile(e.target.result);

      document.getElementById('upload-loaded').textContent = `✓ ${file.name} — ${notas.length} notas`;

      if (notas.length === 0) {
        setStatus('status-import', '⚠ 0 notas detectadas — veja o console (F12) para detalhes', 'error');
        return;
      }

      const originalBlob = new Blob([e.target.result], { type: 'audio/midi' });
      const originalUrl  = URL.createObjectURL(originalBlob);
      document.getElementById('dl-import').href     = originalUrl;
      document.getElementById('dl-import').download = file.name;

      document.getElementById('result-import').style.display = 'block';
      requestAnimationFrame(() => {
        drawPianoRoll('canvas-import', notas.map(normalizeNota));
        drawNoteList('viz-import', notas.map(normalizeNota));
      });

      const jsonNotas = notas.map(normalizeNota);
      const jsonStr   = JSON.stringify({ bpm, tpb, instrument, notas: jsonNotas }, null, 2);
      document.getElementById('json-input').value = jsonStr;

      const jsonStatusEl = document.getElementById('json-status');
      jsonStatusEl.textContent = `✓ ${jsonNotas.length} notas convertidas do MIDI`;
      jsonStatusEl.className   = 'json-status ok';

      window.switchTab('json');
      setStatus('status-import', `✓ ${notas.length} notas (~${bpm} BPM) — JSON disponível na aba "Colar JSON"`, 'done');
    } catch (err) {
      console.error('Erro no parseMidiFile:', err);
      setStatus('status-import', '✗ Erro: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
};

// ============================================================
// DRAG-AND-DROP
// ============================================================
const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) window.handleMidiUpload({ files: [file] });
});
