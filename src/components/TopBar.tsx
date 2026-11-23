import { motion } from 'motion/react';
import { BookOpen, Bot, Compass, Flame, Languages, Shield, ShieldCheck, TrendingUp } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type AppTab = 'home' | 'viet_eng' | 'ai_chat' | 'vocab' | 'progress' | 'reflex' | 'admin';

type TopBarProps = {
  activeTab: AppTab;
  isAdmin: boolean;
  onSelectTab: (tab: AppTab) => void;
  onQuickStart: () => void;
  onOpenAdmin: () => void;
};

const NAV_ITEMS: { id: AppTab; label: string; mobileLabel: string; icon: typeof Compass }[] = [
  { id: 'home', label: 'Trang chủ', mobileLabel: 'Trang chủ', icon: Compass },
  { id: 'viet_eng', label: 'Việt → Anh', mobileLabel: 'Việt–Anh', icon: Languages },
  { id: 'ai_chat', label: 'Nói chuyện AI', mobileLabel: 'Chat AI', icon: Bot },
  { id: 'vocab', label: 'Từ vựng', mobileLabel: 'Từ vựng', icon: BookOpen },
  { id: 'progress', label: 'Tiến độ', mobileLabel: 'Tiến độ', icon: TrendingUp },
];

export function TopBar({
  activeTab,
  isAdmin,
  onSelectTab,
  onQuickStart,
  onOpenAdmin,
}: TopBarProps) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-slate-200/80 shadow-[0_1px_12px_-6px_rgba(15,23,42,0.08)]">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3 sm:gap-6 md:gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-xl py-1 pr-1 group"
          >
            <img
              src="/app-logo.png"
              alt="Logo Anh Văn Phản Xạ"
              className="w-8 h-8 md:w-9 md:h-9 rounded-xl object-cover shadow-xs ring-1 ring-slate-900/10 shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <span className="font-display text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Anh Văn Phản Xạ
            </span>
          </button>

          <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-7">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md ${
                    isActive ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton compact />

            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="Mở khu vực quản trị Admin"
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] md:min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                activeTab === 'admin' || isAdmin
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={onQuickStart}
              className="inline-flex items-center justify-center gap-1.5 min-h-[38px] md:min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-[#071f4f] text-white text-xs md:text-sm font-semibold shadow-sm hover:bg-[#0f2f73] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              <Flame className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Luyện ngay</span>
              <span className="sm:hidden">Luyện</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Thanh điều hướng di động"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 pb-safe shadow-[0_-6px_24px_-8px_rgba(15,23,42,0.1)]"
      >
        <div className="grid grid-cols-5 h-[60px] max-w-xl mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${
                  isActive ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    aria-hidden="true"
                    className="absolute top-0 w-9 h-[2.5px] bg-indigo-600 rounded-b-full"
                  />
                )}
                <span
                  className={`flex items-center justify-center w-9 h-7 rounded-xl transition-colors ${
                    isActive ? 'bg-indigo-50' : ''
                  }`}
                >
                  <Icon
                    className={`w-[19px] h-[19px] transition-transform ${
                      isActive ? 'scale-105 stroke-[2.25]' : ''
                    }`}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap truncate max-w-full">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
