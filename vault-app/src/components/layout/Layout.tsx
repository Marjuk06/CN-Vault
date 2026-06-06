import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#060609] text-slate-200 font-sans relative flex flex-row">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="glow-blob" style={{ width: 700, height: 700, background: 'rgba(124,58,237,0.1)', top: -200, left: -100 }} />
        <div className="glow-blob" style={{ width: 500, height: 500, background: 'rgba(59,130,246,0.08)', bottom: -150, right: 200 }} />
        <div className="glow-blob" style={{ width: 400, height: 400, background: 'rgba(6,182,212,0.06)', top: '50%', right: -100 }} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-row relative z-10">
        {children}
      </div>
    </div>
  );
}
