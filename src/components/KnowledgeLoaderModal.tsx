import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { AIPreference, loadMoreKnowledgeWithAI } from '../utils/aiClient';

type KnowledgeLoaderModalProps = {
  isOpen: boolean;
  defaultTopic?: string;
  aiPreference: AIPreference;
  onClose: () => void;
  onLoaded: (summary: string) => void;
};

const QUICK_TOPICS = [
  'Giao tiếp công việc hàng ngày',
  'Xử lý tình huống khẩn cấp & an toàn',
  'Hỗ trợ khách hàng & du khách',
  'Phỏng vấn & báo cáo công việc',
  'Du lịch, sân bay & khách sạn',
];

export function KnowledgeLoaderModal({
  isOpen,
  defaultTopic = '',
  aiPreference,
  onClose,
  onLoaded,
}: KnowledgeLoaderModalProps) {
  const [topic, setTopic] = useState(defaultTopic);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (chosenTopic?: string) => {
    const finalTopic = (chosenTopic ?? topic).trim() || 'Giao tiếp thực tế đời sống & công việc';
    setError(null);
    setLoading(true);

    const res = await loadMoreKnowledgeWithAI({
      topic: finalTopic,
      mode: 'both',
      count: 2,
      preference: aiPreference,
    });

    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Chưa tải được kiến thức mới. Vui lòng thử lại.');
      return;
    }

    const engineLabel =
      res.engine === 'dual'
        ? 'Gemini + Meta AI song song'
        : res.engine === 'meta'
          ? 'Meta AI'
          : 'Gemini AI';

    const msg = `Đã tải thêm ${res.addedSituations.length} tình huống và ${res.addedKnowledge.length} mẫu câu mới qua ${engineLabel}${
      res.syncedToSupabase ? ' (đã lưu lên Supabase)' : ''
    }.`;
    setTopic('');
    onLoaded(msg);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="load-knowledge-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-indigo-600">Kho học liệu AI không giới hạn</p>
            <h2 id="load-knowledge-title" className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Load thêm kiến thức & tình huống mới
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng"
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label htmlFor="new-knowledge-topic" className="block text-xs font-semibold text-slate-700">
            Nhập chủ đề bạn muốn học thêm (để trống nếu muốn AI tự chọn)
          </label>
          <input
            id="new-knowledge-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Xin nghỉ phép, Tiếp khách nước ngoài, Hỏi đường..."
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />

          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-medium text-slate-700 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>AI đang tạo bài mới...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Load kiến thức mới</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
