import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => install()}
        aria-label="Cài đặt ứng dụng về màn hình chính"
        className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] md:min-h-[40px] rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
          compact ? 'px-2.5 text-xs' : 'px-3.5 text-xs md:text-sm'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className={compact ? 'hidden sm:inline' : ''}>Cài App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Thêm vào màn hình chính iPhone/iPad"
          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] md:min-h-[40px] px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Cài App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/app-logo.png"
                    alt="Logo Anh Văn Phản Xạ"
                    className="w-12 h-12 rounded-2xl object-cover shadow-sm ring-1 ring-slate-200"
                  />
                  <div>
                    <h3 id="ios-install-title" className="font-display text-base font-bold text-slate-900">
                      Thêm vào màn hình chính
                    </h3>
                    <p className="text-xs text-slate-500">Mở nhanh như ứng dụng gốc</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Đóng hướng dẫn"
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-3 text-sm text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-200/70">
                <li className="flex items-center gap-2.5">
                  <Share className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                  <span>
                    1. Bấm nút <strong>Chia sẻ (Share)</strong> ở thanh dưới Safari.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <PlusSquare className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                  <span>
                    2. Chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
