/**
 * audio-engine.js — VAAREC Procedural Ocean Soundtrack & Race Audio Director
 * Motor de Áudio 100% Nativo (Web Audio API) para Replay de Canoagem Oceânica / Va'a.
 * Zero arquivos MP3 pesados ou dependências externas — Síntese em tempo real com alta fidelidade!
 * Suporta aceleração de tempo sincronizada (1x, 5x, 10x, 30x).
 */

(function (global) {
  'use strict';

  class VaarecAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.bgmGain = null;
      this.sfxGain = null;
      this.isMuted = false;
      this.volume = 0.4; // Padrão 40%
      this.isPlayingBGM = false;
      this.bgmTimer = null;
      this.bgmStep = 0;
      this.lastLeaderIdx = null;
      this.buoysSounded = new Set();
      this.startHornTriggered = false;
      this.finishFanfareTriggered = false;
      this.lastKmSounded = 0;
      this.lastKmSounded = 0;
      this.baseBpm = 118;
      this.tempoBpm = 118;
      this.speedMultiplier = 1;
      this.oceanNoiseNode = null;
      this.oceanFilterNode = null;
      this.oceanGainNode = null;
      this.oceanLfo = null;
    }

    /**
     * Inicializa e desbloqueia o AudioContext no primeiro clique/interação
     */
    init() {
      if (this.ctx && this.ctx.state !== 'closed') {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return;
      }

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API não suportada neste navegador.');
        return;
      }

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Canal BGM (Trilha Sonora)
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      // Canal SFX (Efeitos Sonoros)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this._initOceanSwell();
    }

    /**
     * Ajusta a velocidade de reprodução da trilha sonora dinamicamente (1x, 5x, 10x, 30x)
     */
    setPlaybackSpeed(speed) {
      const s = Math.max(0.5, Math.min(50, Number(speed) || 1));
      this.speedMultiplier = s;

      // Escalação progressiva do BPM para acompanhar o ritmo da aceleração
      // 1x -> 118 BPM, 5x -> ~245 BPM, 10x -> ~335 BPM, 30x -> ~545 BPM
      this.tempoBpm = Math.round(this.baseBpm * Math.pow(s, 0.45));

      // Acelera a modulação da ondulação do oceano
      if (this.oceanFilterNode && this.ctx) {
        const targetCutoff = Math.min(1100, 320 + (s - 1) * 26);
        this.oceanFilterNode.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.1);
      }
      if (this.oceanLfo && this.ctx) {
        const targetLfoFreq = Math.min(1.6, 0.18 * Math.pow(s, 0.4));
        this.oceanLfo.frequency.setTargetAtTime(targetLfoFreq, this.ctx.currentTime, 0.1);
      }
    }

    /**
     * Gera som contínuo e orgânico de ondulação do oceano / esteira na água
     */
    _initOceanSwell() {
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Gerador de Pink/Brown Noise (som natural de água/vento)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        output[i] = (b0 + b1 + b2 + b3) * 0.06;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filtro Low-Pass ressonante simulando fluxo de água
      this.oceanFilterNode = this.ctx.createBiquadFilter();
      this.oceanFilterNode.type = 'lowpass';
      this.oceanFilterNode.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.oceanFilterNode.Q.setValueAtTime(3.0, this.ctx.currentTime);

      // Ganho da Ambiência
      this.oceanGainNode = this.ctx.createGain();
      this.oceanGainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);

      // LFO para ondulação lenta (maré/ondas)
      this.oceanLfo = this.ctx.createOscillator();
      this.oceanLfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
      this.oceanLfo.connect(lfoGain);
      lfoGain.connect(this.oceanFilterNode.frequency);
      this.oceanLfo.start();

      whiteNoise.connect(this.oceanFilterNode);
      this.oceanFilterNode.connect(this.oceanGainNode);
      this.oceanGainNode.connect(this.bgmGain);
      whiteNoise.start();
      this.oceanNoiseNode = whiteNoise;
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, Number(val) || 0));
      if (this.masterGain && this.ctx && !this.isMuted) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
    }

    setMuted(muted) {
      this.isMuted = !!muted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
      }
    }

    toggleMute() {
      this.setMuted(!this.isMuted);
      return this.isMuted;
    }

    // ==========================================
    // 🎵 TRILHA SONORA DO PERCURSO (PROCEDURAL THEME)
    // ==========================================

    playBGM() {
      this.init();
      if (this.isPlayingBGM) return;
      this.isPlayingBGM = true;

      // Ativar ambiência do oceano
      if (this.oceanGainNode && this.ctx) {
        this.oceanGainNode.gain.setTargetAtTime(0.18, this.ctx.currentTime, 0.5);
      }

      this._scheduleNextBeat();
    }

    pauseBGM() {
      this.isPlayingBGM = false;
      if (this.bgmTimer) {
        clearTimeout(this.bgmTimer);
        this.bgmTimer = null;
      }
      if (this.oceanGainNode && this.ctx) {
        this.oceanGainNode.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.4);
      }
    }

    stopBGM() {
      this.pauseBGM();
      this.bgmStep = 0;
      this.buoysSounded.clear();
      this.startHornTriggered = false;
      this.finishFanfareTriggered = false;
      this.lastLeaderIdx = null;
    }

    _scheduleNextBeat() {
      if (!this.isPlayingBGM || !this.ctx) return;

      const stepIntervalMs = (60 / this.tempoBpm / 4) * 1000; // semicolcheias
      this._playBeatStep(this.bgmStep);
      this.bgmStep = (this.bgmStep + 1) % 32;

      this.bgmTimer = setTimeout(() => {
        this._scheduleNextBeat();
      }, stepIntervalMs);
    }

    /**
     * Sequenciador Polinésio / Percussão de Remada & Sintetizador de Corrida
     */
    _playBeatStep(step) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const durScale = Math.max(0.18, 1 / (1 + (this.speedMultiplier - 1) * 0.28));

      // 1. Log Drum / Pahu Bass (Batida da Remada Principal nos tempos 0, 8, 16, 24)
      if (step % 8 === 0) {
        this._synthLogDrum(t, step === 0 ? 82 : 74, 0.28, durScale);
      } else if (step === 6 || step === 14 || step === 22 || step === 30) {
        // Contra-tempo sutil da remada
        this._synthLogDrum(t, 98, 0.16, durScale);
      }

      // 2. To'ere / Toque de Madeira (Canoe Gunwale Click nos passos 4, 12, 20, 28)
      if (step % 4 === 2) {
        this._synthWoodClick(t, 0.14, durScale);
      }

      // 3. Spray de Água / Shaker rítmico contínuo
      if (step % 2 === 0) {
        this._synthWaterSpray(t, step % 4 === 0 ? 0.08 : 0.04, durScale);
      }

      // 4. Harmonia Pentatônica Heroica (Ocean Lead Synth)
      const pentatonicNotes = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37];
      if (step === 0 || step === 12 || step === 18 || step === 26) {
        const noteIdx = (Math.floor(step / 4) + Math.floor(this.bgmStep / 16)) % pentatonicNotes.length;
        this._synthArpNote(t, pentatonicNotes[noteIdx], 0.12, durScale);
      }
    }

    _synthLogDrum(time, freq, gainVal, durScale = 1) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const dur = 0.35 * durScale;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 1.6, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.08 * durScale);
      osc.frequency.exponentialRampToValueAtTime(30, time + dur);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    }

    _synthWoodClick(time, gainVal, durScale = 1) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const dur = 0.035 * durScale;

      osc.type = 'square';
      osc.frequency.setValueAtTime(950, time);
      osc.frequency.exponentialRampToValueAtTime(350, time + dur);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.Q.setValueAtTime(6.0, time);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      osc.stop(time + dur + 0.005);
    }

    _synthWaterSpray(time, gainVal, durScale = 1) {
      const dur = 0.03 * durScale;
      const node = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, Math.max(64, Math.floor(this.ctx.sampleRate * dur)), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      node.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4500, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      node.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      node.start(time);
      node.stop(time + dur + 0.002);
    }

    _synthArpNote(time, freq, gainVal, durScale = 1) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const dur = 0.45 * durScale;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    }

    // ==========================================
    // 🔊 EFEITOS SONOROS DE PROVA (RACE SOUND FX)
    // ==========================================

    /**
     * 🏁 Buzina Oficial de Regata / Largada Náutica
     */
    playStartHorn() {
      this.init();
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;

      // 3 Bips preparatórios
      [0, 0.25, 0.5].forEach(dt => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t + dt);
        g.gain.setValueAtTime(0.18, t + dt);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.12);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t + dt);
        osc.stop(t + dt + 0.13);
      });

      // Buzina Longa de Largada (Air Horn ressonante a t + 0.85s)
      const hornTime = t + 0.85;
      const f1 = 220, f2 = 277.18;
      [f1, f2].forEach(freq => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, hornTime);

        g.gain.setValueAtTime(0, hornTime);
        g.gain.linearRampToValueAtTime(0.35, hornTime + 0.06);
        g.gain.setValueAtTime(0.35, hornTime + 1.2);
        g.gain.exponentialRampToValueAtTime(0.001, hornTime + 1.6);

        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(hornTime);
        osc.stop(hornTime + 1.65);
      });
    }

    /**
     * 🚩 Sino / Beacon Náutico ao contornar boias
     */
    
    /**
     * 🚩 Sinal de Split / Marco a Cada Km Percorrido
     */
    playKmSplitChime(km) {
      this.init();
      if (!this.ctx || this.isMuted) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;

      // Acorde de sino duplo cristalino ascendente (E5 -> B5 / 659.25Hz -> 987.77Hz)
      const tones = [
        { freq: 659.25, time: t, dur: 0.45, gain: 0.28 },
        { freq: 987.77, time: t + 0.11, dur: 0.75, gain: 0.35 }
      ];

      tones.forEach(tone => {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(tone.freq, tone.time);
        osc2.frequency.setValueAtTime(tone.freq * 2, tone.time);

        gain.gain.setValueAtTime(0, tone.time);
        gain.gain.linearRampToValueAtTime(tone.gain, tone.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, tone.time + tone.dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(tone.time);
        osc2.start(tone.time);
        osc1.stop(tone.time + tone.dur + 0.02);
        osc2.stop(tone.time + tone.dur + 0.02);
      });
    }

    playBuoyChime() {
      this.init();
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1174.66, t);
      osc2.frequency.setValueAtTime(2349.32, t);

      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.82);
      osc2.stop(t + 0.82);
    }

    /**
     * ⚔️ Whoosh / Duelo Dinâmico na Troca de Liderança
     */
    playOvertakeWhoosh() {
      this.init();
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.55);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.55);
      filter.Q.setValueAtTime(4.0, t);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.6);
    }

    /**
     * 🏆 Fanfarra Triunfal & Foghorn de Chegada
     */
        /**
     * 🏆 Fanfarra Triunfal & Foghorn de Chegada
     */
    playFinishCelebration() {
      this.init();
      if (!this.ctx || this.isMuted) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;

      // 1. Fanfarra Triunfal Ascendente (C4 -> E4 -> G4 -> C5)
      const notes = [
        { f: 261.63, delay: 0.0, dur: 0.35 },  // C4
        { f: 329.63, delay: 0.16, dur: 0.35 }, // E4
        { f: 392.00, delay: 0.32, dur: 0.35 }, // G4
        { f: 523.25, delay: 0.48, dur: 1.4 }   // C5
      ];

      notes.forEach(n => {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'triangle';
        osc2.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, t + n.delay);
        osc2.frequency.setValueAtTime(n.f, t + n.delay);

        g.gain.setValueAtTime(0, t + n.delay);
        g.gain.linearRampToValueAtTime(0.35, t + n.delay + 0.03);
        g.gain.setValueAtTime(0.35, t + n.delay + n.dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.dur);

        osc.connect(g);
        osc2.connect(g);
        g.connect(this.sfxGain);

        osc.start(t + n.delay);
        osc2.start(t + n.delay);
        osc.stop(t + n.delay + n.dur + 0.05);
        osc2.stop(t + n.delay + n.dur + 0.05);
      });

      // 2. Air Horn / Buzina Naval de Vitória (aos 0.85s)
      const hornTime = t + 0.85;
      [261.63, 329.63].forEach(freq => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, hornTime);

        g.gain.setValueAtTime(0, hornTime);
        g.gain.linearRampToValueAtTime(0.32, hornTime + 0.05);
        g.gain.setValueAtTime(0.32, hornTime + 1.2);
        g.gain.exponentialRampToValueAtTime(0.001, hornTime + 1.8);

        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(hornTime);
        osc.stop(hornTime + 1.85);
      });
    }

    /**
     * 🎥 Swoosh / Vento para transições rápidas de Drone e QuickShots
     */
    playDroneWhoosh() {
      this.init();
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;

      const node = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.4), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      node.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, t);
      filter.frequency.exponentialRampToValueAtTime(2200, t + 0.18);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.38);
      filter.Q.setValueAtTime(3.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      node.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      node.start(t);
      node.stop(t + 0.4);
    }
  }

  global.VaarecAudio = new VaarecAudioEngine();
})(typeof window !== 'undefined' ? window : this);
