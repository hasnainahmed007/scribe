/**
 * Client-Side Audio Vault using IndexedDB
 * Persists full-fidelity audio Blobs (including converted WhatsApp .ogg and WAV tracks)
 * locally in the creator's browser for instant, zero-latency playback when loading past transcripts.
 */

const DB_NAME = 'ScribyAudioVault';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores an audio Blob under a specific key (e.g. "transcript_12" or "title_MyRecording.wav")
 */
export async function saveAudioBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AudioVault] Failed to save audio blob locally:', err);
  }
}

/**
 * Retrieves a stored audio Blob by key
 */
export async function getAudioBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve((req.result as Blob) || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Deletes a stored audio Blob by key
 */
export async function deleteAudioBlob(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Helper to store audio for a transcript session
 */
export async function cacheTranscriptAudio(
  transcriptId: number | string | undefined,
  title: string,
  blob: Blob
): Promise<void> {
  if (transcriptId) {
    await saveAudioBlob(`transcript_${transcriptId}`, blob);
  }
  if (title) {
    await saveAudioBlob(`title_${title.trim()}`, blob);
  }
}

/**
 * Helper to retrieve audio for a transcript from local vault
 */
export async function retrieveTranscriptAudio(
  transcriptId: number | string | undefined,
  title?: string
): Promise<Blob | null> {
  if (transcriptId) {
    const blob = await getAudioBlob(`transcript_${transcriptId}`);
    if (blob) return blob;
  }
  if (title) {
    const blob = await getAudioBlob(`title_${title.trim()}`);
    if (blob) return blob;
  }
  return null;
}
