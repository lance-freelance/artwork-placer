import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Placement } from '../types';

interface DragState {
  objectId: string;
  source: 'tray' | 'room';
  clientX: number;
  clientY: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface StoreContextValue {
  activeRoomId: string;
  setActiveRoomId: (id: string) => void;
  
  placements: Placement[];
  history: Placement[][];
  
  placeObject: (p: Placement) => void;
  updatePlacement: (objectId: string, x: number, y: number) => void;
  removePlacement: (objectId: string) => void;
  
  undo: () => void;
  resetRoom: (roomId: string) => void;
  resetAll: () => void;
  
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  
  dragState: DragState | null;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  
  roomWidth: number;
  setRoomWidth: (w: number) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeRoomId, setActiveRoomId] = useState('living-room');
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [history, setHistory] = useState<Placement[][]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [roomWidth, setRoomWidth] = useState(1000);

  // Undo is deliberately single-step: we keep only the state immediately
  // before the last action, never a full stack.
  const saveHistory = useCallback((newPlacements: Placement[]) => {
    setHistory([placements]);
    setPlacements(newPlacements);
  }, [placements]);

  const placeObject = useCallback((p: Placement) => {
    saveHistory([...placements.filter(pl => pl.objectId !== p.objectId), p]);
  }, [placements, saveHistory]);

  const updatePlacement = useCallback((objectId: string, x: number, y: number) => {
    saveHistory(placements.map(p => p.objectId === objectId ? { ...p, x, y } : p));
  }, [placements, saveHistory]);

  const removePlacement = useCallback((objectId: string) => {
    saveHistory(placements.filter(p => p.objectId !== objectId));
  }, [placements, saveHistory]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setPlacements(history[0]);
    setHistory([]);
  }, [history]);

  const resetRoom = useCallback((roomId: string) => {
    saveHistory(placements.filter(p => p.roomId !== roomId));
  }, [placements, saveHistory]);

  const resetAll = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  const value = {
    activeRoomId, setActiveRoomId,
    placements, history,
    placeObject, updatePlacement, removePlacement,
    undo, resetRoom, resetAll,
    selectedObjectId, setSelectedObjectId,
    dragState, setDragState,
    roomWidth, setRoomWidth
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
};