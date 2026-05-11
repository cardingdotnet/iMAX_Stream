'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import PlayerBar from '@/components/player/PlayerBar';
import AudioPlayer from '@/components/player/AudioPlayer';

interface LayoutClientProps {
  username: string;
  displayName: string;
  children: React.ReactNode;
}

export default function LayoutClient({ 
  username, 
  displayName, 
  children 
}: LayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-[100dvh] bg-ink-900">
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar
            username={username}
            displayName={displayName}
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-ink-900">
            {children}
          </main>
        </div>
      </div>
      
      <PlayerBar />
      <AudioPlayer />
    </div>
  );
}
