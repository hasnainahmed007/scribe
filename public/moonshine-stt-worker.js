/**
 * Dedicated Module Web Worker for Moonshine WASM Speech-to-Text.
 * Keeps heavy WASM model initialization and ONNX Runtime inference completely
 * off the main UI thread, and allows immediate OS-level WASM heap reclamation
 * via worker.terminate() when long audio jobs finish or recycle.
 */
import { loadMoonshineModule, Transcriber, ModelArch } from '/moonshine-wasm/index.js';

let cachedMod = null;
let activeTranscriber = null;
let activeKey = '';

function resolveModelArch(archKey) {
  switch (archKey) {
    case 'tiny':
      return ModelArch.Tiny;
    case 'base':
      return ModelArch.Base;
    case 'tiny_streaming':
      return ModelArch.TinyStreaming;
    case 'small_streaming':
      return ModelArch.SmallStreaming;
    case 'medium_streaming':
      return ModelArch.MediumStreaming;
    default:
      return ModelArch.Base;
  }
}

function locateWasmFile(path) {
  const clean = String(path || '').replace(/^\/+/, '');
  return `/moonshine-wasm/${clean}`;
}

function reply(msg) {
  postMessage(msg);
}

function fail(id, err) {
  const message = err instanceof Error ? err.message : String(err || 'Unknown worker STT error');
  reply({ type: 'error', id, message });
}

function serializeLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  return rawLines.map((l) => ({
    text: l?.text || '',
    startTime: Number.isFinite(l?.startTime) ? l.startTime : 0,
    duration: Number.isFinite(l?.duration) ? l.duration : 0,
    speakerSpans: Array.isArray(l?.speakerSpans)
      ? l.speakerSpans.map((s) => ({
          startTime: Number.isFinite(s?.startTime) ? s.startTime : 0,
          duration: Number.isFinite(s?.duration) ? s.duration : 0,
          speakerId: s?.speakerId != null ? String(s.speakerId) : '0',
          speakerIndex: typeof s?.speakerIndex === 'number' ? s.speakerIndex : 0,
          startChar: typeof s?.startChar === 'number' ? s.startChar : -1,
          endChar: typeof s?.endChar === 'number' ? s.endChar : -1,
        }))
      : [],
  }));
}

self.onmessage = (event) => {
  const msg = event.data || {};
  void (async () => {
    try {
      switch (msg.type) {
        case 'init': {
          const wantDiar = msg.enableDiarization !== false;
          const nextKey = `${msg.language}:${msg.archKey}:diar=${wantDiar ? '1' : '0'}`;
          if (activeTranscriber && activeKey === nextKey) {
            reply({ type: 'ready', id: msg.id, diarizationEnabled: wantDiar });
            return;
          }

          if (activeTranscriber) {
            try {
              activeTranscriber.close();
            } catch {}
            activeTranscriber = null;
            activeKey = '';
          }

          if (!cachedMod) {
            cachedMod = await loadMoonshineModule({ locateFile: locateWasmFile });
          }

          const modelArch = resolveModelArch(msg.archKey);
          const onProgress = (loaded, total, file) => {
            reply({
              type: 'progress',
              id: msg.id,
              loaded: loaded || 0,
              total,
              file: file || 'model',
            });
          };

          let diarizationEnabled = false;
          if (wantDiar) {
            try {
              activeTranscriber = await Transcriber.load({
                language: msg.language,
                modelArch,
                module: cachedMod,
                moduleOptions: { locateFile: locateWasmFile },
                options: {
                  identify_speakers: 'true',
                  diarization_analyze_cadence: '0.5',
                  diarization_cluster_cadence: '1.0',
                  diarization_cluster_window_sec: '22.0',
                },
                onProgress,
              });
              diarizationEnabled = true;
            } catch (diarErr) {
              console.warn('[Moonshine STT Worker] Falling back to non-diarized load:', diarErr);
              activeTranscriber = await Transcriber.load({
                language: msg.language,
                modelArch,
                module: cachedMod,
                moduleOptions: { locateFile: locateWasmFile },
                onProgress,
              });
            }
          } else {
            activeTranscriber = await Transcriber.load({
              language: msg.language,
              modelArch,
              module: cachedMod,
              moduleOptions: { locateFile: locateWasmFile },
              onProgress,
            });
          }

          activeKey = `${msg.language}:${msg.archKey}:diar=${diarizationEnabled ? '1' : '0'}`;
          reply({ type: 'ready', id: msg.id, diarizationEnabled });
          break;
        }

        case 'transcribeChunk': {
          if (!activeTranscriber) {
            throw new Error('STT Worker transcriber is not initialized.');
          }
          const pcm = new Float32Array(msg.audioBuffer);
          const transcript = activeTranscriber.transcribe(pcm, {
            sampleRate: msg.sampleRate || 16000,
          });
          reply({
            type: 'chunkResult',
            id: msg.id,
            lines: serializeLines(transcript?.lines),
          });
          break;
        }

        case 'close': {
          if (activeTranscriber) {
            try {
              activeTranscriber.close();
            } catch {}
            activeTranscriber = null;
            activeKey = '';
          }
          reply({ type: 'closed', id: msg.id });
          break;
        }

        default:
          throw new Error(`Unsupported STT Worker message: ${msg.type}`);
      }
    } catch (err) {
      fail(msg.id, err);
    }
  })();
};
