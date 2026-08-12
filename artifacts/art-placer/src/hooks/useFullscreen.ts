import { useCallback, useEffect, useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(documentRef: FullscreenDocument): Element | null {
  return documentRef.fullscreenElement ?? documentRef.webkitFullscreenElement ?? null;
}

/**
 * Small compatibility wrapper around the browser Fullscreen API.
 *
 * The request is intentionally made from the returned click handler. Browsers
 * reject fullscreen requests that happen later in an effect or timeout because
 * they no longer have the user's activation gesture.
 */
export function useFullscreen() {
  const [supported, setSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const documentRef = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;
    const canRequest =
      typeof root.requestFullscreen === 'function' ||
      typeof root.webkitRequestFullscreen === 'function';
    const canExit =
      typeof documentRef.exitFullscreen === 'function' ||
      typeof documentRef.webkitExitFullscreen === 'function';

    setSupported(canRequest && canExit);

    const syncState = () => {
      setIsFullscreen(Boolean(fullscreenElement(documentRef)));
    };

    syncState();
    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
    };
  }, []);

  const toggle = useCallback(() => {
    if (!supported) return;

    const documentRef = document as FullscreenDocument;
    const current = fullscreenElement(documentRef);

    if (current) {
      const exit = documentRef.exitFullscreen ?? documentRef.webkitExitFullscreen;
      if (exit) {
        void Promise.resolve(exit.call(documentRef)).catch((error: unknown) => {
          console.warn('Could not exit fullscreen', error);
        });
      }
      return;
    }

    const root = document.documentElement as FullscreenElement;
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (request) {
      // Call immediately, before awaiting or scheduling anything, to preserve
      // the activation supplied by the button click.
      void Promise.resolve(request.call(root)).catch((error: unknown) => {
        console.warn('Could not enter fullscreen', error);
      });
    }
  }, [supported]);

  return { supported, isFullscreen, toggle };
}