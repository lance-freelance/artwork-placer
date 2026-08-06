import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * First-use "Drag art into the room" hint.
 * Sits above the tray in the bottom-left, matching the reference design.
 * Dismissed on the visitor's first interaction and remembered in localStorage.
 *
 * It floats over the bottom-left of the room photo — the floor band, where
 * sculptures are placed — so it must never be able to take a press. It used to
 * be a button that dismissed on its own click: that swallowed exactly one
 * interaction anywhere it overlapped and then worked forever after, which is
 * indistinguishable from "the first touch does nothing". It is now inert, and
 * the press that dismisses it also reaches whatever is underneath.
 */
export function InstructionOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('lll-instructions-seen');
    if (seen) return undefined;

    const timer = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Armed only once the hint is actually on screen. Listening from mount would
  // let a visitor who starts placing inside the first 1.8s mark it seen before
  // it ever appeared, and they would never be shown it.
  useEffect(() => {
    if (!visible) return undefined;

    // Capture-phase and passive: this only observes the press, so the same
    // press still lands on the piece or the band beneath the hint.
    const dismiss = () => {
      setVisible(false);
      localStorage.setItem('lll-instructions-seen', 'true');
    };
    window.addEventListener('pointerdown', dismiss, {
      capture: true,
      passive: true,
      once: true,
    });

    return () => {
      window.removeEventListener('pointerdown', dismiss, { capture: true });
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25 }}
          role="status"
          // Absolute, so this never contributes to the measured height of the
          // bottom chrome. In normal flow it would reserve matte while visible
          // and reflow the whole board on dismiss; transient hints float over
          // the photo instead.
          //
          // pointer-events-none is load-bearing, not cosmetic — see the note
          // above. Anything added here must stay inert.
          className="absolute bottom-full left-0 mb-2.5 z-30 pointer-events-none bg-white/90 backdrop-blur-sm text-foreground rounded-xl px-3.5 py-2.5 shadow-md text-left max-w-[160px]"
        >
          <p className="text-[12px] font-medium leading-snug">
            Drag art into the room
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            Or tap to select, then tap to place
          </p>
          {/* Small decorative dot matching the reference arrow cue */}
          <span className="block mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive/80 mx-auto" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
