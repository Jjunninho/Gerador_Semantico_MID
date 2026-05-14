// js/api-client.js  — v2: IA escolhe PARÂMETROS, engine gera as notas
//
// Filosofia:
//   LLMs são péssimas em gerar sequências numéricas coerentes.
//   Mas são ÓTIMAS em interpretar linguagem e mapear intenção → parâmetros.
//   O theory.js já sabe fazer música. A IA só precisa dizer "qual música".

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const STORAGE_KEY = 'groq_api_key';

// ============================================================
// GERENCIAMENTO DA CHAVE API
// ============================================================

function getGroqKey() {
  return localStorage.getItem(STORAGE_KEY) || null;
}

function saveGroqKey(key) {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearGroqKey() {
  localStorage.removeItem(STORAGE_KEY);
  updateApiKeyStatusEl();
}

function updateApiKeyStatusEl() {
  const el = document.getElementById('api-key-status');
  if (!el) return;
  const key = getGroqKey();
  el.textContent = key ? `✓ Chave configurada (${key.slice(0, 8)}…)` : '⚠ Chave Groq não configurada';
  el.style.color  = key ? '#4ade80' : '#f87171';
}

// ============================================================
// MODAL DE CONFIGURAÇÃO DA CHAVE
// ============================================================

function injectModalStyles() {
  if (document.getElementById('groq-modal-style')) return;
  const style = document.createElement('style');
  style.id = 'groq-modal-style';
  style.textContent = `
    #groq-key-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
      font-family: inherit;
    }
    #groq-key-box {
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 32px 28px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    }
    #groq-key-box h2 {
      color: #fff;
      font-size: 15px;
      margin: 0 0 10px;
      font-weight: 700;
    }
    #groq-key-box p {
      color: #aaa;
      font-size: 13px;
      line-height: 1.7;
      margin: 0 0 6px;
    }
    #groq-key-box a {
      color: #4ade80;
      font-size: 13px;
    }
    #groq-key-box .groq-warning {
      background: rgba(255,200,0,0.07);
      border: 1px solid #ffcc00;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 14px 0;
      color: #ffcc00;
      font-size: 12px;
      line-height: 1.7;
    }
    #groq-key-input {
      width: 100%;
      box-sizing: border-box;
      background: #111;
      border: 1px solid #444;
      border-radius: 6px;
      color: #4ade80;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 10px 14px;
      margin: 16px 0 6px;
      outline: none;
    }
    #groq-key-input:focus { border-color: #4ade80; box-shadow: 0 0 0 2px rgba(74,222,128,0.15); }
    #groq-key-error {
      color: #f87171;
      font-size: 11px;
      min-height: 16px;
      margin-bottom: 12px;
    }
    #groq-key-save {
      width: 100%;
      background: #4ade80;
      color: #000;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      padding: 12px;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
    #groq-key-save:hover { background: #22c55e; }
    #groq-key-dismiss {
      display: block;
      text-align: center;
      margin-top: 12px;
      color: #555;
      font-size: 11px;
      cursor: pointer;
      background: none;
      border: none;
      width: 100%;
      padding: 4px;
    }
    #groq-key-dismiss:hover { color: #888; }
  `;
  document.head.appendChild(style);
}

function showKeyModal(resolve) {
  injectModalStyles();

  const overlay = document.createElement('div');
  overlay.id = 'groq-key-overlay';
  overlay.innerHTML = `
    <div id="groq-key-box">
      <h2>🔑 Chave API Groq necessária</h2>
      <p>Esta página usa a IA da Groq para interpretar sua descrição e gerar a música.</p>
      <p>A chave é <strong style="color:#fff">gratuita</strong> e fica salva apenas no seu navegador — nunca é enviada a nenhum servidor externo além do próprio Groq.</p>

      <div class="groq-warning">
        ⚠ Nunca compartilhe sua chave. Ela é pessoal e intransferível.<br>
        Ela será usada somente nesta página, neste navegador.
      </div>

      <p>Obtenha sua chave gratuita em:<br>
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener">
          → console.groq.com/keys
        </a>
      </p>

      <input id="groq-key-input" type="text" placeholder="gsk_..." autocomplete="off" spellcheck="false">
      <div id="groq-key-error"></div>

      <button id="groq-key-save">Salvar e continuar</button>
      <button id="groq-key-dismiss">Cancelar (a geração não funcionará sem a chave)</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#groq-key-input');
  const errEl   = overlay.querySelector('#groq-key-error');
  const saveBtn = overlay.querySelector('#groq-key-save');
  const dismiss = overlay.querySelector('#groq-key-dismiss');

  input.focus();

  function doSave() {
    const val = input.value.trim();
    if (!val.startsWith('gsk_') || val.length < 20) {
      errEl.textContent = 'Chave inválida. Deve começar com "gsk_" e ter mais de 20 caracteres.';
      return;
    }
    saveGroqKey(val);
    updateApiKeyStatusEl();
    document.body.removeChild(overlay);
    resolve(val);
  }

  saveBtn.addEventListener('click', doSave);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  dismiss.addEventListener('click', () => {
    document.body.removeChild(overlay);
    resolve(null);
  });
}

function requireGroqKey() {
  return new Promise(resolve => {
    const key = getGroqKey();
    if (key) { resolve(key); return; }
    showKeyModal(resolve);
  });
}

// Expõe ao HTML para botão "Trocar chave"
window.groqClearKey = () => {
  clearGroqKey();
  showKeyModal(key => {
    if (key) console.log('[Groq] Nova chave salva.');
  });
};

// ============================================================
// CHAMADA À API
// ============================================================

export async function callGroq(system, user, temperature = 0.7) {
  const key = await requireGroqKey();
  if (!key) throw new Error('Chave API não configurada. Acesse console.groq.com/keys para obter uma gratuita.');

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   }
      ]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    if (resp.status === 401) {
      clearGroqKey();
      throw new Error('Chave API inválida ou expirada (401). Recarregue a página e insira uma nova chave.');
    }
    throw new Error(`API ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

// ============================================================
// VOCABULÁRIOS — para a IA escolher
// ============================================================

const VALID_SCALES = [
  'major','minor','dorian','phrygian','pentatonic','lydian','mixolydian',
  'harmMinor','blues','wholeTone','locrian','hungarian','melodicMinor',
  'bebopMajor','bebopDom','lydianDom','arabicMaqam','persian','japaneseIn',
  'japaneseYo','spanishPhrygian','romanian','enigmatic','diminished',
  'augmented','prometheus','pentatonicMin'
];

const VALID_STYLES = [
  'pop','dreampop','shoegaze','synthwave','kpop','rnb','soul','gospel',
  'jazzSwing','bossanova','coolJazz','fusion','bluesStyle','bluesRock',
  'hardRockStyle','metal','doom','punkRock','edm','technoStyle','trap',
  'ambient','chillwave','boomBap','funk','disco','sambaStyle','flamenco',
  'tango','salsa','cumbia','reggae','afrobeat','classicalStyle','romantic',
  'folk','country','arabesque','japanese'
];

const VALID_DRUM_STYLES = [
  'rock','halfTime','dnb','tribal','shuffle','march','sparse','fast',
  'breakbeat','fourOnFloor','bossaNovaDrum','sambaDrum','reggae','trapDrum',
  'funk16','swingJazz','twoStep','ska','ballad','boomBap','discoDrum',
  'afrobeatDrum','tangoGroove','cumbiaGroove','synthwaveDrum'
];

const SCALE_DESCRIPTIONS = {
  major:'alegre/pop/luminoso', minor:'triste/dramático/dark', dorian:'groove/soul/R&B',
  phrygian:'sombrio/flamenco/metal', pentatonic:'folk/oriental/simples',
  lydian:'onírico/mágico/Debussy', mixolydian:'rock/folk/riff',
  harmMinor:'gótico/tango/clássico europeu', blues:'blues/expressivo/bent notes',
  wholeTone:'impressionista/sem resolução', locrian:'caótico/dissonante',
  hungarian:'cigano/leste-europeu/dramático', melodicMinor:'jazz moderno/lírico',
  bebopMajor:'bebop/jazz vintage', bebopDom:'jazz quente/improvisação',
  lydianDom:'jazz fusion/tenso-brilhante', arabicMaqam:'árabe/Oriente Médio',
  persian:'persa/misterioso', japaneseIn:'japonês/pentatônico/melancólico',
  japaneseYo:'japonês/sereno', spanishPhrygian:'flamenco avançado',
  diminished:'horror/jazz avançado/tensão máxima',
  augmented:'instável/fantástico', pentatonicMin:'rock/blues/guitarra'
};

const STYLE_DESCRIPTIONS = {
  pop:'melodia clara, dançante', dreampop:'etéreo, reverb, wall of sound leve',
  shoegaze:'denso, fuzzy, camadas', synthwave:'80s, arpejo synth, neon',
  rnb:'groove sincopado, chords extensos', soul:'vocal feel, orgânico',
  jazzSwing:'swing, improvisação, bebop', bossanova:'bossa nova, sincopado delicado',
  coolJazz:'quartal harmony, relaxed', fusion:'jazz fusion, virtuoso, elétrico',
  bluesStyle:'blues clássico, blue notes', bluesRock:'guitarra pesada, riff',
  hardRockStyle:'power chords, riff, hard rock', metal:'velocidade extrema, agressivo',
  doom:'lentíssimo, pesado, sombrio', punkRock:'velocidade, simples, agressivo',
  edm:'build-up, drop, arpejo, dance', technoStyle:'industrial, pulsante, minimal',
  trap:'hi-hats rápidos, kick 808', ambient:'atmosférico, textural, paisagem sonora',
  chillwave:'lo-fi, nostálgico, suave', boomBap:'hip hop clássico, groove pesado',
  funk:'groove denso, baixo funk', disco:'four on floor, bassline disco',
  sambaStyle:'samba brasileiro, percussão densa', flamenco:'espanhol, virtuoso, marcado',
  tango:'dramático, marcato, bandoneón', salsa:'clave, dançante, latino',
  reggae:'one-drop, off-beat, jamaicano', afrobeat:'polirítmico, africano, denso',
  classicalStyle:'formal, dinâmico, estruturado', romantic:'expressivo, emocional, amplo',
  folk:'acústico, simples, narrativo', arabesque:'árabe, ornamentado, modal',
  japanese:'minimalista, esparso, contemplativo'
};

// ============================================================
// SISTEMA PROMPT — pede PARÂMETROS, não notas
// ============================================================

export function getComposerSystemPrompt(_targetTicks, userPrompt = '') {
  return `Você é um diretor musical especializado em interpretar descrições e traduzi-las em parâmetros técnicos para um engine de composição procedural.

Seu trabalho é APENAS escolher os parâmetros certos. O engine vai gerar a música.

═══ ESCALAS DISPONÍVEIS ═══
${VALID_SCALES.map(s => `"${s}" → ${SCALE_DESCRIPTIONS[s]||s}`).join('\n')}

═══ ESTILOS DISPONÍVEIS ═══
${VALID_STYLES.map(s => `"${s}" → ${STYLE_DESCRIPTIONS[s]||s}`).join('\n')}

═══ ESTILOS DE BATERIA DISPONÍVEIS ═══
${VALID_DRUM_STYLES.join(', ')}

═══ REGRAS ═══
1. Responda SOMENTE com JSON puro
2. Escolha os valores que melhor traduzem a EMOÇÃO e ESTILO da descrição
3. "key" é MIDI 0-11 (0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B)
4. "bpm" entre 40 e 240
5. "bars" entre 4 e 16
6. "prog" é array de graus da escala (0-6), ex: [0,5,3,4] = I-VI-IV-V
7. "humanize" entre 0.0 (mecânico) e 0.12 (expressivo)

Formato EXATO de saída:
{
  "scale": "minor",
  "key": 9,
  "style": "ambient",
  "drumStyle": "sparse",
  "bpm": 70,
  "bars": 8,
  "prog": [0,5,3,4],
  "humanize": 0.08,
  "reasoning": "escolhi menor+ambient pois a descrição pede melancolia e textura atmosférica"
}`;
}

// ============================================================
// FALLBACK — se a IA falhar, usar heurística local
// ============================================================

function inferFallback(userPrompt) {
  const p = userPrompt.toLowerCase();
  let scale='minor', style='pop', drumStyle='rock', key=9, bpm=110, bars=8,
      prog=[0,5,3,4], humanize=0.06;

  if(/alegr|feliz|pop|bright/i.test(p))    { scale='major'; key=0; style='pop'; bpm=120; }
  if(/trist|melanc|sombri/i.test(p))        { scale='minor'; style='dreampop'; bpm=72; drumStyle='ballad'; humanize=0.1; }
  if(/jazz|swing/i.test(p))                 { scale='dorian'; style='jazzSwing'; drumStyle='swingJazz'; bpm=140; prog=[0,4,2,5]; humanize=0.1; }
  if(/blues/i.test(p))                      { scale='blues'; style='bluesStyle'; drumStyle='shuffle'; bpm=85; prog=[0,0,0,0,3,3,0,4]; }
  if(/ambient|atmosf|pad/i.test(p))         { scale='lydian'; style='ambient'; drumStyle='sparse'; bpm=65; bars=16; humanize=0.08; prog=[0,4,2,1]; }
  if(/metal|pesado|agressiv/i.test(p))      { scale='phrygian'; style='metal'; drumStyle='fast'; bpm=200; prog=[0,1,5,0]; }
  if(/bossa|samba|brasil/i.test(p))         { scale='major'; style='bossanova'; drumStyle='bossaNovaDrum'; bpm=130; prog=[0,4,2,5]; humanize=0.05; }
  if(/flamenco|espanho/i.test(p))           { scale='spanishPhrygian'; style='flamenco'; drumStyle='tribal'; bpm=155; prog=[0,1,4,0]; }
  if(/tango/i.test(p))                      { scale='harmMinor'; style='tango'; drumStyle='tangoGroove'; bpm=68; }
  if(/funk/i.test(p))                       { scale='dorian'; style='funk'; drumStyle='funk16'; bpm=108; key=0; }
  if(/trap|hip.hop/i.test(p))               { scale='minor'; style='trap'; drumStyle='trapDrum'; bpm=140; humanize=0.04; }
  if(/synthwave|80s/i.test(p))              { scale='minor'; style='synthwave'; drumStyle='synthwaveDrum'; bpm=110; }
  if(/rock/i.test(p))                       { scale='pentatonicMin'; style='hardRockStyle'; drumStyle='rock'; bpm=140; }
  if(/japonês|japan|zen/i.test(p))          { scale='japaneseIn'; style='japanese'; drumStyle='sparse'; bpm=80; bars=16; humanize=0.09; }
  if(/árabe|maqam/i.test(p))               { scale='arabicMaqam'; style='arabesque'; drumStyle='tribal'; bpm=100; }

  return { scale, key, style, drumStyle, bpm, bars, prog, humanize };
}

// ============================================================
// PARSE E VALIDAÇÃO da resposta da IA
// ============================================================

export function parseAiParams(raw, userPrompt = '') {
  let parsed;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    parsed = JSON.parse(m[0]);
  } catch {
    console.warn('[api-client] IA retornou JSON inválido, usando fallback');
    return inferFallback(userPrompt);
  }

  const scale     = VALID_SCALES.includes(parsed.scale)          ? parsed.scale      : 'minor';
  const style     = VALID_STYLES.includes(parsed.style)          ? parsed.style      : 'pop';
  const drumStyle = VALID_DRUM_STYLES.includes(parsed.drumStyle) ? parsed.drumStyle  : 'rock';
  const key       = Number.isInteger(parsed.key) && parsed.key >= 0 && parsed.key <= 11 ? parsed.key : 9;
  const bpm       = parsed.bpm >= 40 && parsed.bpm <= 240        ? parsed.bpm        : 100;
  const bars      = parsed.bars >= 4 && parsed.bars <= 16        ? parsed.bars       : 8;
  const humanize  = parsed.humanize >= 0 && parsed.humanize <= 0.15 ? parsed.humanize : 0.06;

  let prog = parsed.prog;
  if (!Array.isArray(prog) || prog.length < 2) prog = [0, 5, 3, 4];
  prog = prog.map(g => Math.max(0, Math.min(6, Math.round(g))));

  if (parsed.reasoning) console.log('[Compositor IA]', parsed.reasoning);

  return { scale, key, style, drumStyle, bpm, bars, prog, humanize };
}
