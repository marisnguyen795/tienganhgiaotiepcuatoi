import { useState } from 'react';
import { Loader2, Shield, X } from 'lucide-react';
import { adminLogin } from '../utils/aiClient';

type AdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
};

export function AdminModal({ isOpen, onClose, onSuccess }: AdminModalProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || loading) return;
    setError(null);
    setLoading(true);
    const res = await adminLogin(passcode.trim());
    setLoading(false);
    if (!res.ok || !res.token) {
      setError(res.error || 'Mật khẩu không đúng.');
      return;
    }
    setPasscode('');
    onSuccess(res.token);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/app-logo.png"
              alt="Logo Anh Văn Phản Xạ"
              className="w-11 h-11 rounded-2xl object-cover shadow-xs ring-1 ring-slate-200 shrink-0"
            />
            <div>
              <h2 id="admin-login-title" className="font-display text-lg font-bold text-slate-900">
                Quản trị hệ thống
              </h2>
              <p className="text-xs text-slate-500">Nhập mã xác thực quản trị viên</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPasscode('');
              setError(null);
              onClose();
            }}
            aria-label="Đóng"
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-passcode-input" className="block text-xs font-semibold text-slate-700">
              Mã xác thực Admin
            </label>
            <input
              id="admin-passcode-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Nhập mật khẩu quản trị"
              className="w-full min-h-[46px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPasscode('');
                setError(null);
                onClose();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!passcode.trim() || loading}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Shield className="w-4 h-4" aria-hidden="true" />}
              <span>{loading ? 'Đang kiểm tra...' : 'Mở khóa Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
