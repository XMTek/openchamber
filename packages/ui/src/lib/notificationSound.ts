// ---------------------------------------------------------------------------
// Notification sound playback.
//
// In Electron (any origin), uses IPC to read the audio file as base64 then
// plays it via a data URL — bypasses web security restrictions on file://.
// Falls back to direct Audio API for local origins where file:// is allowed.
// ---------------------------------------------------------------------------

let activeAudio: HTMLAudioElement | null = null;

const getDesktopBridge = (): { invoke: (...args: unknown[]) => Promise<unknown> } | null => {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { __OPENCHAMBER_DESKTOP__?: { invoke?: (...args: unknown[]) => Promise<unknown> } }).__OPENCHAMBER_DESKTOP__;
  return bridge?.invoke ? (bridge as { invoke: (...args: unknown[]) => Promise<unknown> }) : null;
};

const getAudioMimeType = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'ogg') return 'audio/ogg';
  return 'audio/wav';
};

const playAudio = (src: string): void => {
  if (typeof Audio === 'undefined') return;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  const audio = new Audio(src);
  audio.volume = 1.0;
  activeAudio = audio;
  const cleanup = () => { if (activeAudio === audio) activeAudio = null; };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);
  audio.play().catch((err) => {
    console.warn('[notificationSound] playback failed', err);
    cleanup();
  });
};

const toFileUrl = (filePath: string): string => {
  const trimmed = filePath.trim();
  if (trimmed.startsWith('file://') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
};

export const playNotificationSound = (filePath: string): void => {
  if (!filePath?.trim()) return;

  const bridge = getDesktopBridge();

  if (bridge) {
    // In Electron: read file via IPC (safe from any origin) and play as data URL.
    bridge.invoke('openchamber:invoke', 'desktop_read_audio_file', { path: filePath.trim() })
      .then((base64) => {
        if (typeof base64 !== 'string' || !base64) return;
        const mime = getAudioMimeType(filePath);
        playAudio(`data:${mime};base64,${base64}`);
      })
      .catch((err) => {
        console.warn('[notificationSound] IPC read failed', err);
      });
    return;
  }

  // Fallback for local dev (file:// works from localhost).
  playAudio(toFileUrl(filePath));
};
