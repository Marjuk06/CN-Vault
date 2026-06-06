import { useVaultStore } from '@/store/vaultStore';
import {
  LayoutDashboard, Shield, Star, KeyRound,
  Plug, RefreshCcw, FileText, ShieldAlert, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NetworkStatusPill } from './NetworkStatusPill';

import { Settings, Wand2 } from 'lucide-react';
import logoUrl from '@/assets/logoo.png';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenGenerator: () => void;
}

export default function Sidebar({ onOpenSettings, onOpenGenerator }: SidebarProps) {
  const { activeCategory, setActiveCategory, lockVault, entries, userProfile } = useVaultStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all', label: 'All Items', icon: Shield },
    { id: 'favorites', label: 'Favorites', icon: Star },
  ];

  const categoryItems = [
    { id: 'Logins', label: 'Logins', icon: KeyRound },
    { id: 'Email', label: 'Email', icon: Mail },
    { id: 'API Keys', label: 'API Keys', icon: Plug },
    { id: 'Recovery', label: 'Recovery', icon: RefreshCcw },
    { id: 'Notes', label: 'Notes', icon: FileText },
  ];

  const countFor = (cat: string) => entries.filter((e) => e.category === cat).length;
  const favCount = entries.filter((e) => e.isFavorite).length;

  return (
    <div className="hidden md:flex glass flex-shrink-0 flex-col z-10 w-[210px] h-screen border-r border-white/[0.05] p-4 pb-3">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-8 h-8 rounded-[10px] bg-[#120D26] border border-white/[0.08] shadow-sm flex items-center justify-center overflow-hidden backdrop-blur-md">
          <img src={logoUrl} alt="CN Vault Logo" className="w-full h-full object-contain scale-[0.9] transition-transform" />
        </div>
        <span className="font-bold text-sm tracking-tight text-white">CN Vault</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        <p className="text-[9px] font-bold tracking-widest uppercase text-white/20 px-2 mb-1">MENU</p>
        {navItems.map((item) => {
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id)}
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 border',
                isActive
                  ? 'bg-violet-600/15 border-violet-600/25 text-violet-300'
                  : 'text-white/45 border-transparent hover:bg-white/[0.05] hover:text-white/75'
              )}
            >
              <span className="flex items-center gap-2">
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </span>
              {item.id === 'favorites' && favCount > 0 && (
                <span className="text-[9px] font-bold bg-white/10 rounded-full px-1.5 py-0.5 text-white/40">{favCount}</span>
              )}
              {item.id === 'all' && entries.length > 0 && (
                <span className="text-[9px] font-bold bg-white/10 rounded-full px-1.5 py-0.5 text-white/40">{entries.length}</span>
              )}
            </button>
          );
        })}

        <p id="tour-categories" className="text-[9px] font-bold tracking-widest uppercase text-white/20 px-2 mt-4 mb-1">CATEGORIES</p>
        {categoryItems.map((item) => {
          const isActive = activeCategory === item.id;
          const count = countFor(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id)}
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 border',
                isActive
                  ? 'bg-violet-600/15 border-violet-600/25 text-violet-300'
                  : 'text-white/45 border-transparent hover:bg-white/[0.05] hover:text-white/75'
              )}
            >
              <span className="flex items-center gap-2">
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </span>
              {count > 0 && (
                <span className="text-[9px] font-bold bg-white/10 rounded-full px-1.5 py-0.5 text-white/40">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tools */}
      <div className="mt-2 mb-2 px-2 flex flex-col gap-1">
        <button
          id="tour-generator"
          onClick={onOpenGenerator}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-white/45 hover:bg-white/[0.05] hover:text-white/75 transition-all duration-200"
        >
          <Wand2 className="w-3.5 h-3.5 shrink-0" />
          Password Generator
        </button>
        <button
          id="tour-settings"
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-white/45 hover:bg-white/[0.05] hover:text-white/75 transition-all duration-200"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          Settings
        </button>
      </div>

      {/* User bar + Lock */}
      <div className="border-t border-white/[0.05] pt-3 mt-2 flex flex-col gap-3">
        <div className="flex justify-center">
          <NetworkStatusPill />
        </div>
        <div
          className="flex items-center gap-2 px-1.5 py-1.5 cursor-pointer hover:bg-white/[0.05] rounded-xl transition-colors -mx-0.5"
          onClick={onOpenSettings}
        >
          {userProfile?.avatar ? (
            <img src={userProfile.avatar} alt="Profile" className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-[11px] font-bold shrink-0 text-white">
              {userProfile?.name?.charAt(0).toUpperCase() || 'V'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white/80 truncate leading-tight">{userProfile?.name || 'CN Vault'}</div>
            <div className="text-[9px] text-white/30 truncate">Settings</div>
          </div>
          <button
            id="tour-lock"
            onClick={(e) => { e.stopPropagation(); lockVault(); }}
            title="Lock Vault"
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
