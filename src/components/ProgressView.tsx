import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  CheckCircle2,
  Cloud,
  Cpu,
  Flame,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { DOMAINS, Domain } from '../data';
import { UserProgress } from '../hooks/useLocalProgress';
import {
  AIPreference,
  fetchAIStatus,
  ProvidersSnapshot,
  recheckAIProviders,
  StoredSituation,
  SupabaseStatusInfo,
} from '../utils/aiClient';

type ProgressViewProps = {
  situations: StoredSituation[];
  progress: UserProgress;
  aiPreference: AIPreference;
  onChangePreference: (pref: AIPreference) => void;
  onStartDomainDrill: (domain: Domain) => void;
  onResetProgress: () => void;
};

export function ProgressView({
  situations,
  progress,
  aiPreference,
  onChangePreference,
  onStartDomainDrill,
  onResetProgress,
}: ProgressViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [providers, setProviders] = useState<ProvidersSnapshot | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatusInfo | null>(null);
  const [checkingAI, setCheckingAI] = useState(false);

  useEffect(() => {
    fetchAIStatus().then((snap) => {
      if (snap.providers) setProviders(snap.providers);
      if (snap.supabase) setSupabaseStatus(snap.supabase);
    });
  }, []);

  const handleRecheck = async () => {
    setCheckingAI(true);
    const snap = await recheckAIProviders();
    if (snap.providers) setProviders(snap.providers);
    if (snap.supabase) setSupabaseStatus(snap.supabase);
    setCheckingAI(false);
  };

  const totalSituations = situations.length;
  const totalWords = useMemo(
    () => situations.reduce((sum, s) => sum + s.targetWords.length, 0),
    [situations]
  );
  const masteredPct =
    totalSituations > 0
      ? Math.round((progress.masteredSituationIds.length / totalSituations) * 100)
      : 0;

  const dynamicDomains = useMemo(() => {
    const iconMap = new Map<string, string>(DOMAINS.map((d) => [d.name, d.icon]));
    const names = Array.from(new Set(situations.map((s) => s.domain)));
    return names.map((name) => ({
      name,
      icon: iconMap.get(name) ?? '📚',
    }));
  }, [situations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600">Theo dõi thói quen & Cấu hình AI</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Tiến độ phản xạ của bạn
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Đặt lại tiến độ</span>
        </button>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hero-navy rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-200">Tình huống hoàn thành</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white mt-2">
            {progress.masteredSituationIds.length}
            <span className="text-sm font-normal text-blue-200">/{totalSituations}</span>
          </p>
          <p className="text-xs text-amber-300 font-semibold mt-2">
            Đạt {masteredPct}% lộ trình
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Từ vựng đã nhớ</p>
            <BookCheck className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 mt-2">
            {progress.masteredWordKeys.length}
            <span className="text-sm font-normal text-slate-400">/{totalWords}</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Cụm từ phản xạ cốt lõi</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Chuỗi ngày luyện</p>
            <Flame className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-indigo-700 mt-2">
            {progress.streakDays}
            <span className="text-sm font-normal text-slate-500 ml-1">ngày</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Duy trì mỗi ngày 3 phút</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Phiên phản xạ 3 phút</p>
            <Zap className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 mt-2">
            {progress.completedDrillsCount}
          </p>
          <p className="text-xs text-slate-500 mt-2">Tổng lượt hoàn tất</p>
        </div>
      </div>

      {/* Dual AI Failover & Cloud Sync Card */}
      <div className="surface-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Điều phối AI song song (Gemini + Meta AI → Offline) & Supabase
              </h2>
              <p className="text-xs text-slate-500">
                Chạy song song cả 2 nền tảng AI để phân tích sâu nhất, tự chuyển dự phòng khi hết token
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRecheck}
            disabled={checkingAI}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingAI ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Làm mới trạng thái</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-2">
            <label htmlFor="pref-mode" className="block text-xs font-semibold text-slate-700">
              Ưu tiên điều phối AI
            </label>
            <select
              id="pref-mode"
              value={aiPreference}
              onChange={(e) => onChangePreference(e.target.value as AIPreference)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="parallel">Song song Gemini + Meta AI (Thông minh tối đa)</option>
              <option value="auto">Tự động luân phiên (Gemini ↔ Meta AI → Offline)</option>
              <option value="gemini">Ưu tiên Gemini AI trước</option>
              <option value="meta">Ưu tiên Meta AI (Llama) trước</option>
              <option value="offline">Luôn dùng Offline (không tốn token)</option>
            </select>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3">
              <p className="text-[11px] text-slate-500">Gemini AI</p>
              <p
                className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                  providers?.gemini.status === 'ready'
                    ? 'text-emerald-700'
                    : providers?.gemini.status === 'exhausted'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                {providers?.gemini.status === 'ready' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Sẵn sàng</span>
                  </>
                ) : providers?.gemini.status === 'exhausted' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Hết token</span>
                  </>
                ) : (
                  <span>{providers?.gemini.status === 'unconfigured' ? 'Chưa cấu hình' : 'Đang kiểm tra'}</span>
                )}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3">
              <p className="text-[11px] text-slate-500">Meta AI</p>
              <p
                className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                  providers?.meta.status === 'ready'
                    ? 'text-emerald-700'
                    : providers?.meta.status === 'exhausted'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                {providers?.meta.status === 'ready' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Sẵn sàng</span>
                  </>
                ) : providers?.meta.status === 'exhausted' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Hết token</span>
                  </>
                ) : (
                  <span>{providers?.meta.status === 'unconfigured' ? 'Chưa cấu hình' : 'Đang kiểm tra'}</span>
                )}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3">
              <p className="text-[11px] text-slate-500">Supabase Cloud</p>
              <p
                className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                  supabaseStatus?.connected && supabaseStatus?.tablesReady
                    ? 'text-emerald-700'
                    : supabaseStatus?.permissionDenied
                      ? 'text-rose-700'
                      : supabaseStatus?.configured
                        ? 'text-amber-700'
                        : 'text-slate-600'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {supabaseStatus?.connected && supabaseStatus?.tablesReady
                    ? 'Đã đồng bộ'
                    : supabaseStatus?.permissionDenied
                      ? 'Thiếu quyền SQL'
                      : supabaseStatus?.configured
                        ? 'Cần tạo bảng'
                        : 'Lưu cục bộ'}
                </span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3">
              <p className="text-[11px] text-slate-500">Offline</p>
              <p className="text-xs font-bold text-slate-800 mt-1 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
                <span>Sẵn sàng</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Breakdown + Recent Drill History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 surface-card rounded-3xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Tiến độ theo từng chủ đề
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm luyện ngay vào chủ đề bạn muốn củng cố phản xạ
            </p>
          </div>

          <div className="space-y-4">
            {dynamicDomains.map((domain) => {
              const domainSits = situations.filter((s) => s.domain === domain.name);
              const doneCount = domainSits.filter((s) =>
                progress.masteredSituationIds.includes(s.id)
              ).length;
              const pct =
                domainSits.length > 0 ? Math.round((doneCount / domainSits.length) * 100) : 0;

              return (
                <div key={domain.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span aria-hidden="true">{domain.icon}</span>
                      <span>{domain.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        {doneCount}/{domainSits.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => onStartDomainDrill(domain.name)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1 px-2 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <span>Luyện nhanh</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#071f4f] to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 surface-card rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Lịch sử phiên phản xạ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Các vòng luyện tập gần nhất của bạn
            </p>
          </div>

          {progress.drillHistory.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700">Chưa có dữ liệu phiên phản xạ</p>
              <p className="text-xs text-slate-500">
                Hoàn thành 1 vòng Phản xạ 3 phút để ghi lại tốc độ trả lời của bạn.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {progress.drillHistory.slice(0, 6).map((item, i) => (
                <div key={`${item.date}-${i}`} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-900 font-mono tabular-nums">
                      Đạt {item.correctCount}/{item.totalCount} câu
                    </p>
                    <p className="text-xs text-slate-500">{item.date}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    TB {item.avgSeconds}s/câu
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-app Confirmation Modal */}
      {confirmReset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 id="reset-modal-title" className="font-display text-lg font-bold text-slate-900">
              Đặt lại toàn bộ tiến độ?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Thao tác này sẽ xóa toàn bộ danh sách tình huống đã thuộc, từ vựng đã lưu và chuỗi
              ngày luyện tập trên trình duyệt này.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Xác nhận đặt lại</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
