/* HARU — process timelapse (MP4 via WebCodecs + mp4-muxer) and MP3 encoding (lamejs) */
(function (H) {
  'use strict';

  const VIDEO_CODECS = [
    { mux: 'avc', codec: 'avc1.640028' }, { mux: 'avc', codec: 'avc1.4d0028' }, { mux: 'avc', codec: 'avc1.42001f' },
    { mux: 'vp9', codec: 'vp09.00.31.08' },
  ];

  H.probeMedia = async function (w = 1280, h = 720, fps = 30) {
    const res = { video: null, audio: null };
    if (typeof VideoEncoder === 'undefined') return res;
    for (const c of VIDEO_CODECS) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec: c.codec, width: w, height: h, bitrate: 4e6, framerate: fps });
        if (s.supported) { res.video = c; break; }
      } catch (e) { /* next */ }
    }
    if (typeof AudioEncoder !== 'undefined') {
      try { const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 44100, bitrate: 192000 }); if (a.supported) res.audio = { mux: 'aac', codec: 'mp4a.40.2', sampleRate: 44100 }; } catch (e) { /* */ }
      if (!res.audio) { try { const a = await AudioEncoder.isConfigSupported({ codec: 'opus', numberOfChannels: 2, sampleRate: 48000, bitrate: 160000 }); if (a.supported) res.audio = { mux: 'opus', codec: 'opus', sampleRate: 48000 }; } catch (e) { /* */ } }
    }
    return res;
  };

  class Timelapse {
    constructor() { this.active = false; this.frames = 0; }

    async start({ width = 1280, height = 720, fps = 30, withAudio = true, bitrate = 5e6 }) {
      this.support = await H.probeMedia(width, height, fps);
      if (!this.support.video || typeof Mp4Muxer === 'undefined') { this.active = false; return false; }
      this.w = width; this.h = height; this.fps = fps; this.frames = 0;
      const audio = withAudio && this.support.audio ? this.support.audio : null;
      this.audioCfg = audio;
      this.target = new Mp4Muxer.ArrayBufferTarget();
      this.muxer = new Mp4Muxer.Muxer({
        target: this.target,
        video: { codec: this.support.video.mux, width, height, frameRate: fps },
        audio: audio ? { codec: audio.mux, numberOfChannels: 2, sampleRate: audio.sampleRate } : undefined,
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });
      this.error = null;
      this.venc = new VideoEncoder({ output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta), error: (e) => { this.error = e; console.error('video enc', e); } });
      this.venc.configure({ codec: this.support.video.codec, width, height, bitrate, framerate: fps, latencyMode: 'quality' });
      this.active = true;
      return true;
    }

    addFrame(canvas) {
      if (!this.active || this.error) return false;
      if (this.venc.encodeQueueSize > 12) return false;
      const ts = Math.round(this.frames * 1e6 / this.fps);
      const vf = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / this.fps) });
      this.venc.encode(vf, { keyFrame: this.frames % (this.fps * 2) === 0 });
      vf.close();
      this.frames++;
      return true;
    }

    /* still image for `seconds`: two frames spanning the whole duration instead of n identical
       frames (keeps phones/tablets from software-encoding a minute of the same picture) */
    async hold(canvas, seconds) {
      if (!this.active || this.error) return;
      const n = Math.max(2, Math.round(seconds * this.fps));
      const step = Math.round(1e6 / this.fps);
      const t0 = Math.round(this.frames * 1e6 / this.fps);
      while (this.venc.encodeQueueSize > 0) await H.sleep(5);
      let vf = new VideoFrame(canvas, { timestamp: t0, duration: step * (n - 1) });
      this.venc.encode(vf, { keyFrame: true }); vf.close();
      vf = new VideoFrame(canvas, { timestamp: t0 + step * (n - 1), duration: step });
      this.venc.encode(vf, { keyFrame: false }); vf.close();
      this.frames += n;
    }

    get seconds() { return this.frames / (this.fps || 30); }

    async finish(audioBuffer) {
      if (!this.active) return null;
      this.active = false;
      await this.venc.flush();
      if (this.audioCfg && audioBuffer) {
        try {
          let buf = audioBuffer;
          if (buf.sampleRate !== this.audioCfg.sampleRate) buf = await resample(buf, this.audioCfg.sampleRate);
          const maxSec = Math.max(1, this.seconds);
          const total = Math.min(buf.length, Math.floor(maxSec * buf.sampleRate));
          const aenc = new AudioEncoder({ output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta), error: (e) => console.error('audio enc', e) });
          aenc.configure({ codec: this.audioCfg.codec, numberOfChannels: 2, sampleRate: buf.sampleRate, bitrate: this.audioCfg.mux === 'aac' ? 192000 : 160000 });
          const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
          const block = 4096;
          const fadeStart = total - Math.floor(buf.sampleRate * 1.5);
          for (let i = 0; i < total; i += block) {
            const n = Math.min(block, total - i);
            const data = new Float32Array(n * 2);
            for (let k = 0; k < n; k++) {
              const g = i + k > fadeStart ? Math.max(0, (total - i - k) / (total - fadeStart)) : 1;
              data[k] = L[i + k] * g; data[n + k] = R[i + k] * g;
            }
            const ad = new AudioData({ format: 'f32-planar', sampleRate: buf.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / buf.sampleRate * 1e6), data });
            aenc.encode(ad); ad.close();
            if (aenc.encodeQueueSize > 20) await H.sleep(1);
          }
          await aenc.flush();
        } catch (e) { console.error('audio track failed', e); }
      }
      this.muxer.finalize();
      return new Uint8Array(this.target.buffer);
    }

    cancel() { try { if (this.venc && this.venc.state !== 'closed') this.venc.close(); } catch (e) { /* */ } this.active = false; }
  }
  H.Timelapse = Timelapse;

  async function resample(buf, rate) {
    const ctx = new OfflineAudioContext(2, Math.ceil(buf.duration * rate), rate);
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
    return ctx.startRendering();
  }

  /* ---------- MP3 ---------- */
  H.encodeMp3 = async function (buffer, kbps = 192, onProgress) {
    if (typeof lamejs === 'undefined') throw new Error('lamejs missing');
    const enc = new lamejs.Mp3Encoder(2, buffer.sampleRate, kbps);
    const L = buffer.getChannelData(0), R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    const block = 1152, chunks = [];
    const l16 = new Int16Array(block), r16 = new Int16Array(block);
    let peak = 0;
    for (let i = 0; i < L.length; i += 64) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const norm = peak > 0.98 ? 0.98 / peak : peak < 0.5 && peak > 0 ? 0.8 / peak : 1;
    for (let i = 0, n = 0; i < L.length; i += block, n++) {
      const len = Math.min(block, L.length - i);
      for (let k = 0; k < len; k++) {
        l16[k] = Math.max(-32768, Math.min(32767, L[i + k] * norm * 32767));
        r16[k] = Math.max(-32768, Math.min(32767, R[i + k] * norm * 32767));
      }
      const out = enc.encodeBuffer(len === block ? l16 : l16.subarray(0, len), len === block ? r16 : r16.subarray(0, len));
      if (out.length) chunks.push(new Uint8Array(out));
      if (n % 300 === 0) { onProgress && onProgress(i / L.length); await H.nextFrame(); }
    }
    const end = enc.flush(); if (end.length) chunks.push(new Uint8Array(end));
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const outBuf = new Uint8Array(total); let o = 0; chunks.forEach((c) => { outBuf.set(c, o); o += c.length; });
    return outBuf;
  };

  /* ---------- composite process frame ---------- */
  H.drawProcessFrame = function (ctx, W, Hh, s) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f2f3f1'; ctx.fillRect(0, 0, W, Hh);
    s.room.draw(ctx, W, Hh, s.pet, { cam: s.cam || s.room.cam });
    /* painting inset */
    const pw = Math.round(Hh * 0.3), m = 22;
    if (s.painter) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(W - pw - m + 4, m + 5, pw, pw);
      ctx.drawImage(s.painter.canvas, W - pw - m, m, pw, pw);
      ctx.strokeStyle = 'rgba(30,30,40,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(W - pw - m + 0.5, m + 0.5, pw, pw);
    }
    /* piano roll strip */
    if (s.song) {
      const sh = Math.round(Hh * 0.2);
      ctx.fillStyle = 'rgba(246,247,244,0.86)'; ctx.fillRect(0, Hh - sh, W, sh);
      ctx.save(); ctx.translate(0, Hh - sh);
      H.drawPianoRoll(ctx, W, sh, s.song, { playStep: s.playStep, reveal: s.reveal, writeStep: s.writeStep, noClear: true, colors: H.LIGHT_COLORS });
      ctx.restore();
    }
    /* caption */
    ctx.fillStyle = 'rgba(246,247,244,0.86)'; ctx.fillRect(m, m, 430, 54);
    ctx.fillStyle = '#16181d'; ctx.font = '600 18px "Malgun Gothic", "Segoe UI", sans-serif';
    ctx.fillText(`${s.petName} · ${s.phaseKo}`, m + 12, m + 23);
    ctx.font = '12px Consolas, monospace'; ctx.fillStyle = '#5c616b';
    ctx.fillText(`HARU  ${s.date}  ${s.clock}  ·  ${Math.round(s.progress * 100)}%  ${s.extra || ''}`, m + 12, m + 43);
    ctx.fillStyle = '#2f45ff'; ctx.fillRect(m, m + 54, 430 * H.clamp(s.progress), 2);
    ctx.restore();
  };

  H.drawEndCard = function (ctx, W, Hh, poster, meta) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f2f3f1'; ctx.fillRect(0, 0, W, Hh);
    const ph = Hh - 80, pw = ph * poster.width / poster.height;
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect((W - pw) / 2 + 6, 46, pw, ph);
    ctx.drawImage(poster, (W - pw) / 2, 40, pw, ph);
    ctx.fillStyle = '#16181d'; ctx.font = '600 22px "Malgun Gothic", sans-serif';
    ctx.fillText(meta.title, 60, Hh / 2 - 10);
    ctx.font = '13px Consolas, monospace'; ctx.fillStyle = '#5c616b';
    ctx.fillText(meta.date, 60, Hh / 2 + 16);
    ctx.fillText(`${meta.genre} · ${meta.bpm} BPM`, 60, Hh / 2 + 36);
    ctx.fillText(`by ${meta.artist}`, 60, Hh / 2 + 56);
  };
})(window.H);
