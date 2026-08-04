import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * First-use "Drag art into the room" hint.
 * Sits above the tray in the bottom-left, matching the reference design.
 * Dismissed on first interaction and remembered in localStorage.
 */
export function InstructionOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('lll-instructions-seen');
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('lll-instructions-seen', 'true');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25 }}
          onClick={dismiss}
          // Absolute, so this never contributes to the measured height of the
          // bottom chrome. In normal flow it would reserve matte while visible
          // and reflow the whole board on dismiss; transient hints float over
          // the photo instead.
          className="absolute bottom-full left-0 mb-2.5 z-30 bg-white/90 backdrop-blur-sm text-foreground rounded-xl px-3.5 py-2.5 shadow-md text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 max-w-[160px]"
          aria-label="Dismiss hint"
        >
          <p className="text-[12px] font-medium leading-snug">
            Drag art into the room
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            Or tap to select, then tap to place
          </p>
          {/* Small decorative dot matching the reference arrow cue */}
          <span className="block mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive/80 mx-auto" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
