import { useVaultStore } from '@/store/vaultStore';
import { Shield, Star, KeyRound, Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onOpenSettings: () => void;
  onAddEntry: () => void;
}

export default function BottomNav({ onOpenSettings, onAddEntry }: BottomNavProps) {
  const { activeCategory, setActiveCategory } = useVaultStore();

  const items = [
    { id: 'all', label: 'All', icon: Shield },
    { id: 'Logins', label: 'Logins', icon: KeyRound },
    { id: 'favorites', label: 'Favs', icon: Star },
  ];

  return (
    <div className="md:hidden glass fixed bottom-0 left-0 right-0 h-[64px] border-t border-white/[0.05] z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-full px-2">
        {items.map((item) => {
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id)}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors',
                isActive ? 'text-violet-400' : 'text-white/40 hover:text-white/70'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* Floating Action Button (Add) */}
        <button
          onClick={onAddEntry}
          className="flex flex-col items-center justify-center w-12 h-12 -translate-y-4 rounded-full bg-violet-600 shadow-[0_8px_16px_rgba(124,58,237,0.4)] text-white hover:bg-violet-500 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors text-white/40 hover:text-white/70"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
