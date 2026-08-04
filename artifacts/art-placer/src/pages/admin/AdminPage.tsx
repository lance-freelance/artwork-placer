import { useState } from 'react';
import { RoomsManager } from './RoomsManager';
import { ArtManager } from './ArtManager';
import { Toaster } from '@/components/ui/toaster';

type Tab = 'rooms' | 'art';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rooms');

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-card/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-2xl tracking-wide">Art Placer Admin</h1>
          <div className="h-6 w-px bg-border mx-2" />
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === 'rooms' 
                  ? 'bg-foreground text-background font-medium shadow-sm' 
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Rooms
            </button>
            <button
              onClick={() => setActiveTab('art')}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === 'art' 
                  ? 'bg-foreground text-background font-medium shadow-sm' 
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Art Catalog
            </button>
          </nav>
        </div>
        <div className="text-xs text-muted-foreground font-serif italic">
          Gallery Management
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'rooms' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
          <RoomsManager />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'art' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
          <ArtManager />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
