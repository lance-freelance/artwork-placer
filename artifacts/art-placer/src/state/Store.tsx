import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  useListArt,
  useListPlacements,
  useListRooms,
  useReplacePlacements,
} from '@workspace/api-client-react';
import {
  heightPercentOf,
  isValidBand,
  refusalMessage,
  type DropRejection,
} from '@/lib/placement';
import { abortActivePointerDrags } from '../hooks/usePointerDrag';
import { artImageUrl } from '../types';
import type { ArtObject, Placement, Room } from '../types';

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

/**
 * A drop the rules refused, on its way to being shown.
 *
 * Without this a refusal is invisible — the piece simply snaps back, which is
 * indistinguishable from the app losing it.
 */
export interface DropRefusal {
  /** Distinguishes consecutive refusals so the notice re-animates each time. */
  key: number;
  message: string;
  /** Where the release happened, so the notice lands where the eye already is. */
  clientX: number;
  clientY: number;
}

/**
 * One reversible action.
 *
 * The whole arrangement is snapshotted rather than a description of what
 * changed: the sets are small, and it makes undoing a reset no different from
 * undoing a nudge.
 */
export interface HistoryEntry {
  /** Every placement as it stood immediately before the action. */
  placements: Placement[];
  /**
   * The room the action happened in — not necessarily the one on screen when
   * it is undone, which is why it is recorded rather than inferred.
   */
  roomId: string;
}

interface StoreContextValue {
  /** The catalog, as curated in the admin panel. Never hardcoded. */
  rooms: Room[];
  artObjects: ArtObject[];

  activeRoomId: string;
  setActiveRoomId: (id: string) => void;
  
  placements: Placement[];
  history: HistoryEntry[];
  
  placeObject: (p: Placement) => void;
  /**
   * Both keyed by (objectId, roomId): with per-room reuse enabled the same
   * piece can hang in several rooms at once, so objectId alone is ambiguous.
   */
  updatePlacement: (objectId: string, roomId: string, x: number, y: number) => void;
  removePlacement: (objectId: string, roomId: string) => void;
  
  undo: () => void;
  resetRoom: (roomId: string) => void;
  resetAll: () => void;
  
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  
  dragState: DragState | null;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;

  /** The last refused drop, until it times out. */
  dropRefusal: DropRefusal | null;
  /**
   * Report a drop the rules turned down. Silently ignores the refusals that
   * are not worth telling anyone about — see `refusalMessage`.
   */
  noteRefusal: (input: {
    reason: DropRejection;
    type: 'wall' | 'sculpture';
    clientX: number;
    clientY: number;
  }) => void;

  roomWidth: number;
  setRoomWidth: (w: number) => void;

  /**
   * The room canvas currently on screen. Drop maths needs its box, and the
   * pieces that need it live outside it (the tray, the drag layer), so the
   * active canvas registers itself here rather than the components trying to
   * find each other.
   */
  canvasElRef: React.MutableRefObject<HTMLDivElement | null>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** How long a placement change settles before it is written to the server. */
const SAVE_DEBOUNCE_MS = 400;

/**
 * How far back undo reaches. Deep enough that nobody hits the end in a normal
 * session, bounded so a long one cannot grow the stack without limit.
 */
const MAX_UNDO_STEPS = 50;

/** How long a refusal notice stays on screen. */
const REFUSAL_NOTICE_MS = 2200;

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const roomsQuery = useListRooms();
  const artQuery = useListArt();
  const placementsQuery = useListPlacements();
  const { mutateAsync: savePlacements } = useReplacePlacements();

  const rooms = roomsQuery.data;
  const artObjects = artQuery.data;

  // The room the user asked for, which is not always one that still exists —
  // the admin panel can delete it while the board is open. The id handed to
  // everyone else is derived below and is always real, so components can look
  // the room up without guarding against a gap.
  const [requestedRoomId, setRequestedRoomId] = useState('');
  const activeRoomId =
    rooms?.some((r) => r.id === requestedRoomId)
      ? requestedRoomId
      : rooms?.[0]?.id ?? '';

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [roomWidth, setRoomWidth] = useState(1000);
  const canvasElRef = useRef<HTMLDivElement | null>(null);

  const [dropRefusal, setDropRefusal] = useState<DropRefusal | null>(null);
  const refusalCount = useRef(0);
  const refusalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteRefusal = useCallback(
    (input: {
      reason: DropRejection;
      type: 'wall' | 'sculpture';
      clientX: number;
      clientY: number;
    }) => {
      const message = refusalMessage(input.reason, input.type);
      if (!message) return;
      refusalCount.current += 1;
      setDropRefusal({
        key: refusalCount.current,
        message,
        clientX: input.clientX,
        clientY: input.clientY,
      });
      // Restarted rather than stacked, so a run of refused drops shows the
      // latest reason for its full time instead of the first one's timer
      // clearing the last one early.
      if (refusalTimer.current) clearTimeout(refusalTimer.current);
      refusalTimer.current = setTimeout(
        () => setDropRefusal(null),
        REFUSAL_NOTICE_MS,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (refusalTimer.current) clearTimeout(refusalTimer.current);
    },
    [],
  );

  // The saved placements are read once, then this component owns them: it has
  // undo and reset, so re-reading the server mid-session would fight the user.
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const [saveFailed, setSaveFailed] = useState(false);

  // The tray only ever loads thumbnails, but the drag ghost renders the
  // full-size image — so the first drag of each piece would otherwise wait on
  // a multi-megabyte fetch and appear blank. Warm the cache as soon as the
  // catalog arrives.
  useEffect(() => {
    if (!artObjects) return;
    for (const obj of artObjects) {
      const img = new Image();
      img.src = artImageUrl(obj.fullImageFilename, obj.imageVersion);
    }
  }, [artObjects]);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!rooms || !artObjects || !placementsQuery.data) return;

    // Anything pointing at a room or a piece the admin panel has since deleted
    // can never be rendered, so it is dropped on the way in.
    const live = placementsQuery.data.filter(
      (p) =>
        rooms.some((r) => r.id === p.roomId) &&
        artObjects.some((o) => o.id === p.objectId),
    );

    hydratedRef.current = true;
    lastSavedRef.current = JSON.stringify(live);
    setPlacements(live);
  }, [rooms, artObjects, placementsQuery.data]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    const serialized = JSON.stringify(placements);
    if (serialized === lastSavedRef.current) return;

    const snapshot = placements;
    const timer = setTimeout(() => {
      // Writes are chained rather than fired in parallel. Each one is the
      // whole set, so an older request landing after a newer one would quietly
      // undo it. The saved marker moves only once the write has actually
      // succeeded, so a failed save is retried by the next change instead of
      // being remembered as persisted.
      saveChainRef.current = saveChainRef.current
        .then(() => savePlacements({ data: snapshot }))
        .then(() => {
          lastSavedRef.current = serialized;
          setSaveFailed(false);
        })
        .catch((err: unknown) => {
          console.error('Could not save placements', err);
          setSaveFailed(true);
        });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [placements, savePlacements]);

  /**
   * The placements in a list that still make sense against the catalog as it
   * stands right now: their room and their piece both exist, and the piece is
   * still on the correct side of that room's band split.
   *
   * Used both to clean up after a catalog change and, crucially, at the moment
   * undo runs — a snapshot taken before the change cannot be trusted just
   * because it was filtered once.
   */
  const livePlacements = useCallback(
    (list: Placement[]) => {
      if (!rooms || !artObjects) return list;
      // A room holds at most one copy of a piece; anything beyond the first
      // (objectId, roomId) pair is a corrupted record, and the server refuses
      // to save a set containing one.
      const seen = new Set<string>();
      return list.filter((p) => {
        const room = rooms.find((r) => r.id === p.roomId);
        const object = artObjects.find((o) => o.id === p.objectId);
        if (!room || !object) return false;
        const key = `${p.roomId}\u0000${p.objectId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        // Its band may have moved out from under it.
        return isValidBand(
          object.type,
          p.y,
          room.bandSplit,
          heightPercentOf(object, room),
        );
      });
    },
    [rooms, artObjects],
  );

  // The catalog can change under the board while it is open — a piece deleted
  // or switched to the other band in the admin panel. Components look their
  // room and object up by id and assume they exist, so anything orphaned is
  // dropped here, out of the history too so undo cannot resurrect it.
  useEffect(() => {
    if (!hydratedRef.current || !rooms || !artObjects) return;

    const live = livePlacements;

    setPlacements((current) => {
      const next = live(current);
      return next.length === current.length ? current : next;
    });
    setHistory((current) => {
      const next = current.map((entry) => ({
        ...entry,
        placements: live(entry.placements),
      }));
      return next.some(
        (entry, i) => entry.placements.length !== current[i].placements.length,
      )
        ? next
        : current;
    });
  }, [rooms, artObjects, livePlacements]);

  /**
   * Records the arrangement as it stands, then applies the new one.
   *
   * `roomId` is the room the action changed, which undo uses to take the user
   * back to it. Every mutation goes through here so nothing can change the
   * board without becoming reversible.
   */
  const saveHistory = useCallback((newPlacements: Placement[], roomId: string) => {
    setHistory((current) =>
      [...current, { placements, roomId }].slice(-MAX_UNDO_STEPS),
    );
    setPlacements(newPlacements);
  }, [placements]);

  const placeObject = useCallback((p: Placement) => {
    // What an incoming placement displaces depends on the target room's reuse
    // policy. A reuse room only replaces its own copy of the piece — the same
    // artwork may hang in other rooms too. The default (no flag, or false)
    // keeps the original session-wide rule: the piece exists once, anywhere.
    const targetRoom = rooms?.find((r) => r.id === p.roomId);
    const displaced = targetRoom?.allowArtReuse
      ? (pl: Placement) => pl.objectId === p.objectId && pl.roomId === p.roomId
      : (pl: Placement) => pl.objectId === p.objectId;
    saveHistory([...placements.filter((pl) => !displaced(pl)), p], p.roomId);
  }, [placements, rooms, saveHistory]);

  const updatePlacement = useCallback((objectId: string, roomId: string, x: number, y: number) => {
    const matches = (p: Placement) => p.objectId === objectId && p.roomId === roomId;
    if (!placements.some(matches)) return;
    saveHistory(
      placements.map(p => matches(p) ? { ...p, x, y } : p),
      roomId,
    );
  }, [placements, saveHistory]);

  const removePlacement = useCallback((objectId: string, roomId: string) => {
    const matches = (p: Placement) => p.objectId === objectId && p.roomId === roomId;
    if (!placements.some(matches)) return;
    saveHistory(placements.filter(p => !matches(p)), roomId);
  }, [placements, saveHistory]);

  // Safety net: if anything steals the pointer mid-drag (the browser cancelling
  // the gesture, the window losing focus), the piece would otherwise stay
  // stranded in the drag layer with nothing left to release it.
  useEffect(() => {
    const clear = () => {
      // Clearing dragState only hides the ghost — the refs inside whichever
      // component owned the gesture would stay armed, and the next pointerup
      // would re-run its drop with stale geometry, committing a second
      // placement the user never asked for. Tear the gesture down first, then
      // drop the visual state.
      abortActivePointerDrags();
      setDragState(null);
    };
    // These must stay bubble-phase. React's delegated handler sits on the root
    // container, so on a normal release finish() runs first and leaves nothing
    // in flight, which makes the teardown above a no-op. Switching any of these
    // to capture would invert that order and silently abort every valid drop.
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);

  /**
   * Steps back one action, as many times as there are actions.
   *
   * The board also travels to the room the action happened in. Without that,
   * undoing something done in another room looks like nothing happened at all.
   */
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];

    // The snapshot was valid when it was taken, which is not the same as being
    // valid now: the admin panel may have deleted a piece or moved a band
    // since. Re-check it here rather than trusting the earlier sweep.
    setPlacements(livePlacements(previous.placements));
    setHistory((current) => current.slice(0, -1));

    // Go to the room the action happened in — unless it has since been
    // deleted, in which case stay put rather than pointing at nothing.
    if (rooms?.some((r) => r.id === previous.roomId)) {
      setRequestedRoomId(previous.roomId);
    }
    setSelectedObjectId(null);
  }, [history, livePlacements, rooms]);

  const resetRoom = useCallback((roomId: string) => {
    saveHistory(placements.filter(p => p.roomId !== roomId), roomId);
  }, [placements, saveHistory]);

  const resetAll = useCallback(() => {
    // Clearing every room is undone from wherever the user was standing.
    saveHistory([], activeRoomId);
  }, [saveHistory, activeRoomId]);

  if (roomsQuery.isError || artQuery.isError || placementsQuery.isError) {
    return <CatalogNotice title="The collection could not be loaded." body="The server is unreachable. Refresh the page to try again." />;
  }

  if (!rooms || !artObjects || !hydratedRef.current) {
    return <CatalogNotice title="Preparing the collection" body="One moment." />;
  }

  if (rooms.length === 0) {
    return <CatalogNotice title="No rooms yet" body="Add a room in the admin panel to start placing art." />;
  }

  const value = {
    rooms, artObjects,
    activeRoomId, setActiveRoomId: setRequestedRoomId,
    placements, history,
    placeObject, updatePlacement, removePlacement,
    undo, resetRoom, resetAll,
    selectedObjectId, setSelectedObjectId,
    dragState, setDragState,
    dropRefusal, noteRefusal,
    roomWidth, setRoomWidth,
    canvasElRef
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {saveFailed && (
        <div
          role="status"
          className="fixed bottom-3 left-3 z-50 rounded-full border border-border bg-card/90 px-4 py-1.5 text-xs tracking-[0.14em] uppercase text-muted-foreground shadow-sm backdrop-blur-sm"
        >
          Not saved — the arrangement will be retried on the next change
        </div>
      )}
    </StoreContext.Provider>
  );
};

/** Full-screen message shown while the catalog loads, or when it cannot be. */
function CatalogNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-2 bg-background text-foreground px-8 text-center">
      <p className="font-serif text-xl tracking-wide">{title}</p>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{body}</p>
    </div>
  );
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
};
