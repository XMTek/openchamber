// ---------------------------------------------------------------------------
// Notification sound playback — desktop-first, uses Web Audio API / HTMLAudioElement.
//
// Accepts a full filesystem path (Electron renderer can load file:// URIs) or
// any URL. Silently ignores empty paths and logs warnings on playback failure.
// ---------------------------------------------------------------------------

let activeAudio: HTMLAudioElement | null = null;

const toAudioUrl = (filePath: string): string => {
  const trimmed = filePath.trim();
  if (trimmed.startsWith('file://') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Electron renderer: convert absolute path to file:// URI.
  // Works for both Unix (/path/to/sound.wav) and Windows (C:\path\to\sound.wav).
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
};

export const playNotificationSound = (filePath: string): void => {
  if (!filePath?.trim()) return;
  if (typeof Audio === 'undefined') return;

  try {
    const url = toAudioUrl(filePath);

    // Stop any sound already playing so overlapping events don't stack.
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    const audio = new Audio(url);
    audio.volume = 1.0;
    activeAudio = audio;

    const cleanup = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);

    audio.play().catch((err) => {
      console.warn('[notificationSound] playback failed', err);
      cleanup();
    });
  } catch (err) {
    console.warn('[notificationSound] error creating audio element', err);
  }
};
