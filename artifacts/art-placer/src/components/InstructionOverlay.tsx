import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function InstructionOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('lll-instructions-seen');
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 1500);
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background px-6 py-4 rounded-sm shadow-xl flex items-center gap-4 max-w-sm w-[calc(100%-2rem)]"
        >
          <div className="text-sm">
            <p className="font-medium">
              Drag art to the walls. Sculptures go on the floor.
            </p>
            <p className="text-background/70 mt-1">
              Or tap a piece, then tap where it should go.
            </p>
          </div>
          <button 
            onClick={dismiss}
            className="p-1 hover:bg-background/20 rounded-full transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Dismiss instructions"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}