import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  adminDeleteSituation,
  adminFetchOverview,
  adminImportData,
  adminSaveIntegrations,
  adminSaveSituation,
  adminSyncSupabase,
  AIPreference,
  IntegrationStatusSnapshot,
  KnowledgeItem,
  loadMoreKnowledgeWithAI,
  ProvidersSnapshot,
  recheckAIProviders,
  StoredSituation,
  SupabaseStatusInfo,
} from '../utils/aiClient';

type AdminConsoleViewProps = {
  adminToken: string;
  aiPreference: AIPreference;
  onChangePreference: (pref: AIPreference) => void;
  onSituationsUpdated: () => void;
  onLogout: () => void;
};

type AdminSectionTab = 'infrastructure' | 'import' | 'library';

const SAMPLE_JSON_TEMPLATE = [
  {
    domain: 'Nhà hàng & Dịch vụ',
    title: 'Hỏi dị ứng thực phẩm của khách',
    where: 'Bàn ăn nhà hàng',
    withWho: 'Thực khách',
    goal: 'Xác nhận dị ứng và gợi ý món an toàn',
    dialogue: [
      {
        role: 'A',
        speaker: 'Bạn',
        en: 'Before I place your order, do you have any food allergies?',
        vn: 'Trước khi lên đơn món, quý khách có bị dị ứng thực phẩm nào không ạ?',
        intent: 'Chủ động hỏi dị ứng để đảm bảo an toàn',
      },
      {
        role: 'B',
        speaker: 'Khách',
        en: 'Yes, I am allergic to peanuts and shellfish.',
        vn: 'Có, tôi bị dị ứng đậu phộng và hải sản có vỏ.',
        intent: 'Khách báo loại thực phẩm dị ứng',
      },
      {
        role: 'A',
        speaker: 'Bạn',
        en: 'Noted. I will inform our chef to prepare a nut-free dish for you.',
        vn: 'Tôi đã ghi nhận. Tôi sẽ báo bếp chuẩn bị món không có hạt cho quý khách.',
        intent: 'Xác nhận và báo bếp xử lý riêng',
      },
    ],
    followUp: 'Would you like me to recommend our safest signature dish?',
    targetWords: [
      { en: 'food allergies', vn: 'dị ứng thực phẩm' },
      { en: 'place your order', vn: 'đặt món' },
      { en: 'inform', vn: 'thông báo' },
    ],
  },
];

export function AdminConsoleView({
  adminToken,
  aiPreference,
  onChangePreference,
  onSituationsUpdated,
  onLogout,
}: AdminConsoleViewProps) {
  const [section, setSection] = useState<AdminSectionTab>('infrastructure');
  const [loading, setLoading] = useState(true);
  const [situations, setSituations] = useState<StoredSituation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [supabase, setSupabase] = useState<SupabaseStatusInfo | null>(null);
  const [sqlSchema, setSqlSchema] = useState('');
  const [providers, setProviders] = useState<ProvidersSnapshot | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatusSnapshot | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Live Supabase & AI Integration Form Inputs (Admin enters freely here)
  const [sbUrlInput, setSbUrlInput] = useState('');
  const [sbKeyInput, setSbKeyInput] = useState('');
  const [showSbKey, setShowSbKey] = useState(false);
  const [savingSupabase, setSavingSupabase] = useState(false);

  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [metaKeyInput, setMetaKeyInput] = useState('');
  const [showMetaKey, setShowMetaKey] = useState(false);
  const [metaBaseUrlInput, setMetaBaseUrlInput] = useState('');
  const [metaModelInput, setMetaModelInput] = useState('');
  const [savingAI, setSavingAI] = useState(false);

  // Import JSON / Raw text / AI Generator states
  const [importMode, setImportMode] = useState<'raw_text' | 'json' | 'manual'>('raw_text');
  const [rawText, setRawText] = useState('');
  const [defaultDomain, setDefaultDomain] = useState('Mở rộng thực tế');
  const [jsonText, setJsonText] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual creation fields
  const [mDomain, setMDomain] = useState('Công việc');
  const [mTitle, setMTitle] = useState('');
  const [mWhere, setMWhere] = useState('');
  const [mWithWho, setMWithWho] = useState('');
  const [mGoal, setMGoal] = useState('');
  const [mEn1, setMEn1] = useState('');
  const [mVn1, setMVn1] = useState('');
  const [mEn2, setMEn2] = useState('');
  const [mVn2, setMVn2] = useState('');

  // Library search & SQL copy
  const [libSearch, setLibSearch] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlBox, setShowSqlBox] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const res = await adminFetchOverview(adminToken);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Không tải được dữ liệu quản trị.' });
      setLoading(false);
      return;
    }
    setSituations(res.situations ?? []);
    setKnowledge(res.knowledge ?? []);
    setSupabase(res.supabase ?? null);
    if (res.supabase?.permissionDenied || (res.supabase?.configured && !res.supabase?.tablesReady)) {
      setShowSqlBox(true);
    }
    setSqlSchema(res.supabaseSchemaSql ?? '');
    setProviders(res.providers ?? null);
    if (res.integrations) {
      setIntegrations(res.integrations);
      setMetaBaseUrlInput((prev) => prev || res.integrations?.meta.baseUrl || '');
      setMetaModelInput((prev) => prev || res.integrations?.meta.model || '');
    }
    setLoading(false);
  }, [adminToken]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!sbUrlInput.trim() && !sbKeyInput.trim()) || savingSupabase) return;
    setSavingSupabase(true);
    setStatusBanner(null);

    const res = await adminSaveIntegrations(adminToken, {
      supabaseUrl: sbUrlInput.trim() || undefined,
      supabaseKey: sbKeyInput.trim() || undefined,
    });

    setSavingSupabase(false);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Không thể lưu cấu hình Supabase.' });
      return;
    }

    if (res.supabase) setSupabase(res.supabase);
    if (res.integrations) setIntegrations(res.integrations);
    setSbUrlInput('');
    setSbKeyInput('');
    setStatusBanner({
      type: res.supabase?.connected ? 'ok' : 'err',
      text: res.supabase?.message || 'Đã cập nhật cấu hình Supabase.',
    });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleClearSupabaseConfig = async () => {
    setSavingSupabase(true);
    const res = await adminSaveIntegrations(adminToken, { clearSupabase: true });
    setSavingSupabase(false);
    if (res.ok) {
      if (res.supabase) setSupabase(res.supabase);
      if (res.integrations) setIntegrations(res.integrations);
      setStatusBanner({
        type: 'ok',
        text: 'Đã xóa cấu hình Supabase tùy chỉnh (quay về biến môi trường nếu có).',
      });
      await loadOverview();
    }
  };

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAI) return;
    setSavingAI(true);
    setStatusBanner(null);

    const res = await adminSaveIntegrations(adminToken, {
      geminiApiKey: geminiKeyInput.trim() || undefined,
      metaApiKey: metaKeyInput.trim() || undefined,
      metaBaseUrl: metaBaseUrlInput.trim() || undefined,
      metaModel: metaModelInput.trim() || undefined,
    });

    setSavingAI(false);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Không thể lưu cấu hình AI.' });
      return;
    }

    if (res.providers) setProviders(res.providers);
    if (res.integrations) setIntegrations(res.integrations);
    setGeminiKeyInput('');
    setMetaKeyInput('');
    setStatusBanner({
      type: 'ok',
      text: 'Đã cập nhật khóa API AI & áp dụng tức thì cho toàn bộ hệ thống.',
    });
  };

  const handleClearAIConfig = async (target: 'gemini' | 'meta') => {
    setSavingAI(true);
    const res = await adminSaveIntegrations(
      adminToken,
      target === 'gemini' ? { clearGemini: true } : { clearMeta: true }
    );
    setSavingAI(false);
    if (res.ok) {
      if (res.providers) setProviders(res.providers);
      if (res.integrations) setIntegrations(res.integrations);
      setStatusBanner({
        type: 'ok',
        text: `Đã gỡ khóa ${target === 'gemini' ? 'Gemini' : 'Meta AI'} tùy chỉnh.`,
      });
    }
  };

  const handleImportRawText = async () => {
    if (!rawText.trim() || isProcessing) return;
    setIsProcessing(true);
    setStatusBanner(null);

    const res = await adminImportData(adminToken, {
      mode: 'raw_text',
      rawText: rawText.trim(),
      defaultDomain: defaultDomain.trim() || 'Import tùy chỉnh',
      preference: aiPreference,
    });

    setIsProcessing(false);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Import thất bại.' });
      return;
    }

    setRawText('');
    setStatusBanner({
      type: 'ok',
      text: `AI đã chuẩn hóa và import thành công ${res.savedCount} tình huống${
        res.syncedToSupabase ? ' (đã đồng bộ Supabase)' : ''
      }.`,
    });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleImportJson = async () => {
    if (!jsonText.trim() || isProcessing) return;
    setStatusBanner(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatusBanner({ type: 'err', text: 'JSON không đúng định dạng. Vui lòng kiểm tra lại.' });
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];

    setIsProcessing(true);
    const res = await adminImportData(adminToken, { mode: 'json', items });
    setIsProcessing(false);

    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Import JSON thất bại.' });
      return;
    }
    setJsonText('');
    setStatusBanner({
      type: 'ok',
      text: `Đã import ${res.savedCount} tình huống từ JSON${
        res.syncedToSupabase ? ' (đã đồng bộ Supabase)' : ''
      }.`,
    });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (file.name.endsWith('.json')) {
        setImportMode('json');
        setJsonText(content);
      } else {
        setImportMode('raw_text');
        setRawText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_JSON_TEMPLATE, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_import_tinh_huong.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim() || !mEn1.trim() || isProcessing) return;
    setIsProcessing(true);
    setStatusBanner(null);

    const newSit: StoredSituation = {
      id: 0,
      domain: mDomain.trim() || 'Tùy chỉnh',
      title: mTitle.trim(),
      where: mWhere.trim() || 'Thực tế',
      withWho: mWithWho.trim() || 'Đối tác',
      goal: mGoal.trim() || 'Luyện phản xạ giao tiếp',
      dialogue: [
        {
          role: 'A',
          speaker: 'Bạn',
          en: mEn1.trim(),
          vn: mVn1.trim() || mTitle.trim(),
          intent: 'Lượt mở đầu',
        },
        ...(mEn2.trim()
          ? [
              {
                role: 'B' as const,
                speaker: mWithWho.trim() || 'Đối tác',
                en: mEn2.trim(),
                vn: mVn2.trim() || '',
                intent: 'Phản hồi',
              },
            ]
          : []),
      ],
      followUp: 'What would you say next?',
      targetWords: [],
      source: 'imported',
    };

    const res = await adminSaveSituation(adminToken, newSit);
    setIsProcessing(false);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Không lưu được tình huống.' });
      return;
    }

    setMTitle('');
    setMWhere('');
    setMWithWho('');
    setMGoal('');
    setMEn1('');
    setMVn1('');
    setMEn2('');
    setMVn2('');
    setStatusBanner({
      type: 'ok',
      text: `Đã thêm tình huống mới thành công${res.syncedToSupabase ? ' & đồng bộ Supabase' : ''}.`,
    });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleAIGenerateMore = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatusBanner(null);

    const res = await loadMoreKnowledgeWithAI({
      topic: aiTopic.trim() || 'Giao tiếp công việc, đời sống và xử lý tình huống bất ngờ',
      mode: 'both',
      count: 2,
      preference: aiPreference,
    });

    setIsProcessing(false);
    if (!res.ok) {
      setStatusBanner({ type: 'err', text: res.error || 'Không thể tạo kiến thức mới.' });
      return;
    }

    setAiTopic('');
    setStatusBanner({
      type: 'ok',
      text: `Đã nạp thêm ${res.addedSituations.length} tình huống & ${res.addedKnowledge.length} mẫu kiến thức mới qua ${
        res.engine === 'dual' ? 'Gemini + Meta AI song song' : res.engine === 'meta' ? 'Meta AI' : 'Gemini AI'
      }.`,
    });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleToggleVisibility = async (sit: StoredSituation) => {
    await adminSaveSituation(adminToken, { ...sit, hidden: !sit.hidden });
    await loadOverview();
    onSituationsUpdated();
  };

  const handleDelete = async (id: number) => {
    await adminDeleteSituation(adminToken, id);
    await loadOverview();
    onSituationsUpdated();
  };

  const handleSyncSupabase = async () => {
    setSyncingSupabase(true);
    setStatusBanner(null);
    const res = await adminSyncSupabase(adminToken);
    setSyncingSupabase(false);
    setStatusBanner({ type: res.ok ? 'ok' : 'err', text: res.message });
    await loadOverview();
  };

  const handleRecheckAI = async () => {
    const res = await recheckAIProviders();
    if (res.providers) setProviders(res.providers);
    if (res.supabase) setSupabase(res.supabase);
  };

  const filteredSituations = situations.filter((s) => {
    const q = libSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q) ||
      s.where.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Admin Top Header */}
      <div className="hero-navy rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3">
          <img
            src="/app-logo.png"
            alt="Logo Anh Văn Phản Xạ"
            className="w-11 h-11 rounded-2xl object-cover shadow-sm ring-1 ring-white/25 shrink-0"
          />
          <div>
            <p className="text-xs font-semibold text-emerald-300">
              Quản trị viên đang hoạt động · Toàn quyền hệ thống
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
              Trung tâm Quản trị & Kết nối API
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
          <div className="flex items-center p-1 bg-white/12 border border-white/15 rounded-xl overflow-x-auto no-scrollbar max-w-full">
            {(
              [
                { id: 'infrastructure', label: 'Kết nối Supabase & AI' },
                { id: 'import', label: 'Import & Nạp AI' },
                { id: 'library', label: `Kho (${situations.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  section === t.id
                    ? 'bg-white text-[#071f4f] shadow-xs'
                    : 'text-blue-100 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/12 border border-white/15 text-xs font-semibold text-white hover:bg-rose-500 hover:border-rose-400 inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thoát</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            statusBanner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {statusBanner.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" aria-hidden="true" />
          <span>Đang tải bảng điều khiển quản trị...</span>
        </div>
      ) : section === 'infrastructure' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Card 1: Direct Supabase Link & Sync */}
          <div className="lg:col-span-6 surface-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Liên kết cơ sở dữ liệu Supabase
                  </h2>
                  <p className="text-xs text-slate-500">
                    Nhập trực tiếp URL & Key dự án Supabase để lưu trữ đám mây
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 text-xs sm:text-sm ${
                supabase?.tablesReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : supabase?.permissionDenied
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : supabase?.configured
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  Trạng thái:{' '}
                  {supabase?.tablesReady
                    ? 'Đã kết nối & sẵn sàng'
                    : supabase?.permissionDenied
                      ? 'Thiếu quyền truy cập bảng (permission denied)'
                      : supabase?.configured
                        ? 'Đã kết nối — Cần chạy SQL Schema'
                        : 'Chưa liên kết (đang lưu tạm trên máy chủ)'}
                </p>
                {integrations?.supabase.configured && (
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/70">
                    {integrations.supabase.urlMasked} · {integrations.supabase.keyMasked}
                    {supabase?.keyRole === 'anon'
                      ? ' (anon)'
                      : supabase?.keyRole === 'service_role'
                        ? ' (service_role)'
                        : ''}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">{supabase?.message}</p>
            </div>

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="admin-sb-url" className="block text-xs font-semibold text-slate-700">
                  Supabase Project URL
                </label>
                <input
                  id="admin-sb-url"
                  type="url"
                  value={sbUrlInput}
                  onChange={(e) => setSbUrlInput(e.target.value)}
                  placeholder={
                    integrations?.supabase.urlMasked
                      ? `Đang dùng: https://${integrations.supabase.urlMasked} (nhập mới để đổi)`
                      : 'https://xxxxxxxxxxxx.supabase.co'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-sb-key" className="block text-xs font-semibold text-slate-700">
                  Supabase Service Role Key (khuyên dùng) hoặc Anon Key
                </label>
                <div className="relative">
                  <input
                    id="admin-sb-key"
                    type={showSbKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={sbKeyInput}
                    onChange={(e) => setSbKeyInput(e.target.value)}
                    placeholder={
                      integrations?.supabase.keyMasked
                        ? `Đã lưu khóa ${integrations.supabase.keyMasked} (nhập mới để thay)`
                        : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSbKey((v) => !v)}
                    aria-label={showSbKey ? 'Ẩn khóa' : 'Hiện khóa'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
                  >
                    {showSbKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingSupabase || (!sbUrlInput.trim() && !sbKeyInput.trim())}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {savingSupabase ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>Lưu & Kiểm tra Supabase</span>
                </button>

                {integrations?.supabase.source === 'admin' && (
                  <button
                    type="button"
                    onClick={handleClearSupabaseConfig}
                    disabled={savingSupabase}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                  >
                    Gỡ liên kết
                  </button>
                )}
              </div>
            </form>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncSupabase}
                disabled={syncingSupabase}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {syncingSupabase ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Cloud className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Đồng bộ tất cả lên Supabase</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(sqlSchema);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 inline-flex items-center gap-1.5"
              >
                {copiedSql ? (
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{copiedSql ? 'Đã chép SQL' : 'Sao chép SQL'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSqlBox((v) => !v)}
                className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                {showSqlBox ? 'Ẩn SQL' : 'Xem SQL Schema'}
              </button>
            </div>

            {showSqlBox && sqlSchema && (
              <pre className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {sqlSchema}
              </pre>
            )}
          </div>

          {/* Card 2: Direct AI API Link (Gemini + Meta AI) */}
          <div className="lg:col-span-6 surface-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Liên kết API Gemini & Meta AI
                  </h2>
                  <p className="text-xs text-slate-500">
                    Nhập trực tiếp API Key tại đây để chạy song song hoặc dự phòng tự động
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRecheckAI}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 inline-flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Kiểm tra</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200/80 p-3.5 bg-slate-50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Gemini API</p>
                  <p
                    className={`text-sm font-bold mt-0.5 ${
                      providers?.gemini.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {providers?.gemini.status === 'ready'
                      ? 'Đang hoạt động'
                      : providers?.gemini.status === 'exhausted'
                        ? 'Hết token tạm thời'
                        : 'Chưa liên kết'}
                  </p>
                  {integrations?.gemini.masked && (
                    <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                      {integrations.gemini.masked} ({integrations.gemini.source === 'admin' ? 'Admin' : 'Env'})
                    </p>
                  )}
                </div>
                {integrations?.gemini.source === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleClearAIConfig('gemini')}
                    className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0"
                  >
                    Gỡ
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-3.5 bg-slate-50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Meta AI (Llama API)</p>
                  <p
                    className={`text-sm font-bold mt-0.5 ${
                      providers?.meta.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {providers?.meta.status === 'ready'
                      ? 'Đang hoạt động'
                      : providers?.meta.status === 'exhausted'
                        ? 'Hết token tạm thời'
                        : 'Chưa liên kết'}
                  </p>
                  {integrations?.meta.masked && (
                    <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                      {integrations.meta.masked} ({integrations.meta.source === 'admin' ? 'Admin' : 'Env'})
                    </p>
                  )}
                </div>
                {integrations?.meta.source === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleClearAIConfig('meta')}
                    className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0"
                  >
                    Gỡ
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-ai-pref" className="block text-xs font-semibold text-slate-700">
                Chế độ điều phối AI mặc định
              </label>
              <select
                id="admin-ai-pref"
                value={aiPreference}
                onChange={(e) => onChangePreference(e.target.value as AIPreference)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm font-semibold text-slate-900"
              >
                <option value="parallel">Song song Gemini + Meta AI (Thông minh tối đa)</option>
                <option value="auto">Tự động chuyển đổi (Gemini ↔ Meta AI → Offline)</option>
                <option value="gemini">Ưu tiên Gemini AI</option>
                <option value="meta">Ưu tiên Meta AI (Llama)</option>
                <option value="offline">Chỉ Offline</option>
              </select>
            </div>

            <form onSubmit={handleSaveAIConfig} className="space-y-3.5 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label htmlFor="admin-gemini-key" className="block text-xs font-semibold text-slate-700">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    id="admin-gemini-key"
                    type={showGeminiKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={
                      integrations?.gemini.masked
                        ? `Đang dùng khóa ${integrations.gemini.masked} (nhập mới để đổi)`
                        : 'AIzaSy...'
                    }
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    aria-label={showGeminiKey ? 'Ẩn khóa Gemini' : 'Hiện khóa Gemini'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-meta-key" className="block text-xs font-semibold text-slate-700">
                  Meta AI API Key (Llama API / OpenAI-compatible)
                </label>
                <div className="relative">
                  <input
                    id="admin-meta-key"
                    type={showMetaKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={metaKeyInput}
                    onChange={(e) => setMetaKeyInput(e.target.value)}
                    placeholder={
                      integrations?.meta.masked
                        ? `Đang dùng khóa ${integrations.meta.masked} (nhập mới để đổi)`
                        : 'LLM|... hoặc sk-...'
                    }
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMetaKey((v) => !v)}
                    aria-label={showMetaKey ? 'Ẩn khóa Meta AI' : 'Hiện khóa Meta AI'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
                  >
                    {showMetaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="admin-meta-url" className="block text-xs font-semibold text-slate-700">
                    Meta AI Base URL
                  </label>
                  <input
                    id="admin-meta-url"
                    type="url"
                    value={metaBaseUrlInput}
                    onChange={(e) => setMetaBaseUrlInput(e.target.value)}
                    placeholder="https://api.llama.com/compat/v1"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-meta-model" className="block text-xs font-semibold text-slate-700">
                    Meta AI Model ID
                  </label>
                  <input
                    id="admin-meta-model"
                    type="text"
                    value={metaModelInput}
                    onChange={(e) => setMetaModelInput(e.target.value)}
                    placeholder="Llama-4-Maverick-17B-128E-Instruct-FP8"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingAI}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {savingAI ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Lưu & Kích hoạt API AI ngay</span>
              </button>
            </form>
          </div>
        </div>
      ) : section === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Left: Import Data (Raw Text / JSON / File / Manual) */}
          <div className="lg:col-span-7 surface-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Import thêm dữ liệu học tập
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dán văn bản tự do (AI tự chuẩn hóa), file JSON hoặc nhập tay từng tình huống
                </p>
              </div>

              <label className="cursor-pointer min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tải file .JSON / .TXT</span>
                <input
                  type="file"
                  accept=".json,.txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'raw_text', label: 'Dán văn bản (AI tự tách)' },
                  { id: 'json', label: 'Import JSON' },
                  { id: 'manual', label: 'Nhập tay 1 bài' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setImportMode(m.id)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    importMode === m.id
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {importMode === 'raw_text' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chủ đề mặc định
                  </label>
                  <input
                    type="text"
                    value={defaultDomain}
                    onChange={(e) => setDefaultDomain(e.target.value)}
                    placeholder="Ví dụ: Giao tiếp khách sạn, Phỏng vấn, Công việc..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nội dung thô cần AI chuyển hóa thành bài luyện phản xạ
                  </label>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Dán danh sách câu tiếng Anh/Việt, ghi chú công việc, đoạn hội thoại mẫu hoặc tài liệu đào tạo nhân viên..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleImportRawText}
                  disabled={!rawText.trim() || isProcessing}
                  className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>AI Chuẩn hóa & Import ngay</span>
                </button>
              </div>
            ) : importMode === 'json' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Dán mảng JSON tình huống theo chuẩn hệ thống
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tải file mẫu JSON</span>
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='[{"domain":"Công việc","title":"...","where":"...","withWho":"...","goal":"...","dialogue":[...],"followUp":"...","targetWords":[...]}]'
                  className="w-full font-mono rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />

                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!jsonText.trim() || isProcessing}
                  className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>Import dữ liệu JSON</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleManualSave} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={mDomain}
                    onChange={(e) => setMDomain(e.target.value)}
                    placeholder="Chủ đề (Domain)"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    placeholder="Tiêu đề tình huống *"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    value={mWhere}
                    onChange={(e) => setMWhere(e.target.value)}
                    placeholder="Địa điểm (Where)"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    value={mWithWho}
                    onChange={(e) => setMWithWho(e.target.value)}
                    placeholder="Giao tiếp với ai (With who)"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={mGoal}
                  onChange={(e) => setMGoal(e.target.value)}
                  placeholder="Mục tiêu tình huống"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <input
                    type="text"
                    required
                    value={mEn1}
                    onChange={(e) => setMEn1(e.target.value)}
                    placeholder="Câu tiếng Anh lượt A (Bạn) *"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    value={mVn1}
                    onChange={(e) => setMVn1(e.target.value)}
                    placeholder="Nghĩa tiếng Việt lượt A"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    value={mEn2}
                    onChange={(e) => setMEn2(e.target.value)}
                    placeholder="Câu tiếng Anh lượt B (Đối tác)"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                  <input
                    type="text"
                    value={mVn2}
                    onChange={(e) => setMVn2(e.target.value)}
                    placeholder="Nghĩa tiếng Việt lượt B"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-base sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!mTitle.trim() || !mEn1.trim() || isProcessing}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 inline-flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Lưu tình huống mới</span>
                </button>
              </form>
            )}
          </div>

          {/* Right: Unlimited AI Knowledge Expansion */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-indigo-200/80 shadow-sm p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-indigo-600">
                Đào tạo & mở rộng không giới hạn
              </p>
              <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                Load thêm kiến thức mới từ AI
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Nhập chủ đề bất kỳ (hoặc để trống để AI tự đề xuất) để hệ thống sinh thêm tình huống
                thực tế và cụm từ mới không trùng lặp, tự động lưu vào Supabase.
              </p>
            </div>

            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Ví dụ: Xử lý khiếu nại khách VIP, Đàm phán lương..."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />

            <button
              type="button"
              onClick={handleAIGenerateMore}
              disabled={isProcessing}
              className="w-full min-h-[48px] px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Load thêm kiến thức mới ngay</span>
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Kiến thức mở rộng đã nạp ({knowledge.length} mục):
              </p>
              {knowledge.slice(0, 4).map((k) => (
                <div key={k.id} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                  <p className="font-semibold text-slate-900">{k.phraseEn}</p>
                  <p className="text-slate-600">{k.meaningVn}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Danh sách toàn bộ tình huống ({situations.length})
            </h2>
            <input
              type="search"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc chủ đề..."
              className="w-full sm:w-64 min-h-[44px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="divide-y divide-slate-100">
            {filteredSituations.map((sit) => (
              <div
                key={sit.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${sit.hidden ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    #{sit.id} · {sit.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {sit.domain} · {sit.where} · Nguồn:{' '}
                    {sit.source === 'ai_generated'
                      ? 'AI mở rộng'
                      : sit.source === 'imported'
                        ? 'Admin import'
                        : 'Mặc định'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(sit)}
                    className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {sit.hidden ? 'Hiện lại' : 'Ẩn bài'}
                  </button>

                  {sit.source !== 'builtin' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(sit.id)}
                      aria-label={`Xóa ${sit.title}`}
                      className="min-h-[38px] px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
