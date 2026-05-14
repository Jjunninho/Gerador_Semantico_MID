// js/midi-utils.js

// ============================================================
// MIDI WRITER
// ============================================================
export class MidiWriter {
  varLen(val) {
    const b = [];
    b.unshift(val & 0x7F); val >>= 7;
    while (val > 0) { b.unshift((val & 0x7F) | 0x80); val >>= 7; }
    return b;
  }
  u16(v) { return [(v >> 8) & 0xFF, v & 0xFF]; }
  u32(v) { return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]; }

  buildTrack(events) {
    const b = [];
    for (const ev of events) { b.push(...this.varLen(ev.delta)); b.push(...ev.data); }
    b.push(0x00, 0xFF, 0x2F, 0x00); // end of track
    return b;
  }

  // ── build: melodia + baixo (sem bateria) — comportamento original
  build(notas, tempo, instrument, tpb = 480) {
    return this.buildWithDrums(notas, [], tempo, instrument, tpb);
  }

  // ── buildWithDrums: melodia + bateria no canal 9
  // drumNotas: array de { nota, inicio, duracao, velocidade }
  //   onde nota é o número GM (36=kick, 38=snare, 42=hh fechado, 46=hh aberto, etc.)
  buildWithDrums(notas, drumNotas = [], tempo, instrument, tpb = 480) {
    const b = [];
    const hasDrums = drumNotas && drumNotas.length > 0;
    const numTracks = hasDrums ? 3 : 2;

    // MIDI header
    b.push(0x4D, 0x54, 0x68, 0x64); // MThd
    b.push(...this.u32(6));
    b.push(...this.u16(1));          // format 1
    b.push(...this.u16(numTracks));
    b.push(...this.u16(tpb));

    // Track 0: tempo
    const µ = Math.round(60000000 / tempo);
    const trkTempo = this.buildTrack([
      { delta: 0, data: [0xFF, 0x51, 0x03, (µ >> 16) & 0xFF, (µ >> 8) & 0xFF, µ & 0xFF] }
    ]);
    b.push(0x4D, 0x54, 0x72, 0x6B);
    b.push(...this.u32(trkTempo.length));
    b.push(...trkTempo);

    // Track 1: melodia/harmonia (canal 0)
    const events = [{ delta: 0, data: [0xC0, Math.max(0, instrument)] }];
    const flat = [];
    for (const n of notas) {
      flat.push({ time: n.inicio,              nota: n.nota, vel: n.velocidade });
      flat.push({ time: n.inicio + n.duracao,  nota: n.nota, vel: 0 });
    }
    flat.sort((a, z) => a.time - z.time || (a.vel === 0 ? -1 : 1));
    let prev = 0;
    for (const ev of flat) {
      const delta = Math.max(0, ev.time - prev);
      prev = ev.time;
      events.push({ delta, data: ev.vel > 0 ? [0x90, ev.nota, ev.vel] : [0x80, ev.nota, 0] });
    }
    const trkNotes = this.buildTrack(events);
    b.push(0x4D, 0x54, 0x72, 0x6B);
    b.push(...this.u32(trkNotes.length));
    b.push(...trkNotes);

    // Track 2: bateria (canal 9 — padrão GM para percussão)
    if (hasDrums) {
      const drumEvents = [];
      const drumFlat = [];
      for (const n of drumNotas) {
        const dur = Math.max(30, n.duracao || 60);
        drumFlat.push({ time: n.inicio,       nota: n.nota, vel: n.velocidade });
        drumFlat.push({ time: n.inicio + dur, nota: n.nota, vel: 0 });
      }
      drumFlat.sort((a, z) => a.time - z.time || (a.vel === 0 ? -1 : 1));
      let prevD = 0;
      for (const ev of drumFlat) {
        const delta = Math.max(0, ev.time - prevD);
        prevD = ev.time;
        // Canal 9 (0x99 = note-on ch9, 0x89 = note-off ch9)
        drumEvents.push({ delta, data: ev.vel > 0 ? [0x99, ev.nota, ev.vel] : [0x89, ev.nota, 0] });
      }
      const trkDrums = this.buildTrack(drumEvents);
      b.push(0x4D, 0x54, 0x72, 0x6B);
      b.push(...this.u32(trkDrums.length));
      b.push(...trkDrums);
    }

    return new Uint8Array(b);
  }
}

// ============================================================
// MIDI PARSER  — lê binário .mid → notas[]
// ============================================================
export function parseMidiFile(buffer) {
  const data = new Uint8Array(buffer);
  let i = 0;

  const r8    = () => data[i++];
  const r16   = () => { const v = (data[i] << 8) | data[i + 1]; i += 2; return v; };
  const r32   = () => { const v = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]; i += 4; return v; };
  const varLen = () => {
    let v = 0;
    do {
      if (i >= data.length) break;
      const b = r8();
      v = (v << 7) | (b & 0x7F);
      if (!(b & 0x80)) break;
    } while (true);
    return v;
  };

  if (String.fromCharCode(data[0], data[1], data[2], data[3]) !== 'MThd')
    throw new Error('Arquivo MIDI inválido — header não encontrado');

  i += 4;
  r32();
  const format   = r16();
  const ntracks  = r16();
  const tpb      = r16();

  console.log(`[MIDI Parser] Format=${format} Tracks=${ntracks} TPB=${tpb}`);

  let globalTempo = 500000;
  const notas = [];
  let capturedInstrument = 0;

  const findNextMTrk = (from) => {
    for (let p = from; p <= data.length - 8; p++) {
      if (data[p]===0x4D && data[p+1]===0x54 && data[p+2]===0x72 && data[p+3]===0x6B)
        return p;
    }
    return -1;
  };

  let tracksFound = 0;
  while (tracksFound < ntracks) {
    const mtrk = findNextMTrk(i);
    if (mtrk === -1) { console.warn('[MIDI Parser] Nenhum MTrk encontrado a partir de', i); break; }
    i = mtrk + 4;
    const len = r32();
    const end = i + len;
    tracksFound++;
    console.log(`[MIDI Parser] Track ${tracksFound}: offset=${mtrk} len=${len} end=${end}`);

    let tick = 0;
    let lastStatus = 0;
    const noteOns = {};

    while (i < end) {
      if (i >= data.length) break;
      tick += varLen();

      let status = data[i];
      if (status & 0x80) {
        if (status < 0xF0) lastStatus = status;
        i++;
      } else {
        status = lastStatus;
      }

      const type = status & 0xF0;
      const ch   = status & 0x0F;

      if (type === 0x90) {
        const n = r8(), v = r8();
        console.log(`[MIDI Parser] NoteOn ch=${ch} nota=${n} vel=${v} tick=${tick}`);
        const key = `${n}_${ch}`;
        if (v > 0) {
          noteOns[key] = { tick, vel: v };
        } else {
          if (noteOns[key]) {
            const on = noteOns[key];
            notas.push({ nota: n, inicio: on.tick, duracao: Math.max(60, tick - on.tick), velocidade: on.vel });
            delete noteOns[key];
          }
        }
      } else if (type === 0x80) {
        const n = r8(); r8();
        const key = `${n}_${ch}`;
        if (noteOns[key]) {
          const on = noteOns[key];
          notas.push({ nota: n, inicio: on.tick, duracao: Math.max(60, tick - on.tick), velocidade: on.vel });
          delete noteOns[key];
        }
      } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
        r8(); r8();
      } else if (type === 0xC0) {
        const prog = r8();
        if (capturedInstrument === 0) capturedInstrument = prog;
      } else if (type === 0xD0) {
        r8();
      } else if (status === 0xFF) {
        const mt = r8();
        const ml = varLen();
        if (mt === 0x51 && ml === 3) {
          globalTempo = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        }
        i += ml;
      } else if (status === 0xF0 || status === 0xF7) {
        i += varLen();
      } else {
        i++;
      }
    }

    for (const key of Object.keys(noteOns)) {
      const on = noteOns[key];
      const nota = parseInt(key.split('_')[0]);
      const duracao = Math.max(240, tick - on.tick || 480);
      notas.push({ nota, inicio: on.tick, duracao, velocidade: on.vel });
    }

    i = end;
  }

  notas.sort((a, b) => a.inicio - b.inicio);
  const bpm = Math.round(60000000 / globalTempo);
  return { notas, bpm, tpb, instrument: capturedInstrument };
}
