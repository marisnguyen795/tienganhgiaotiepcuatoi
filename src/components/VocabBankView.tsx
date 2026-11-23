import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  List,
  PlusCircle,
  RotateCw,
  Search,
  Volume2,
} from 'lucide-react';
import { Domain } from '../data';
import { makeWordKey, UserProgress } from '../hooks/useLocalProgress';
import { KnowledgeItem, StoredSituation } from '../utils/aiClient';
import { speakEnglish } from '../utils/speech';

type VocabBankViewProps = {
  situations: StoredSituation[];
  knowledge: KnowledgeItem[];
  progress: UserProgress;
  onToggleMasteredWord: (wordKey: string) => void;
  onOpenKnowledgeLoader: (topic?: string) => void;
};

type VocabEntry = {
  key: string;
  en: string;
  vn: string;
  domain: Domain;
  situationTitle: string;
  usageNote?: string;
};

export function VocabBankView({
  situations,
  knowledge,
  progress,
  onToggleMasteredWord,
  onOpenKnowledgeLoader,
}: VocabBankViewProps) {
  const [viewMode, setViewMode] = useState<'flashcard' | 'list'>('flashcard');
  const [domainFilter, setDomainFilter] = useState<'Tất cả' | Domain>('Tất cả');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlearned' | 'learned'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const allEntries = useMemo<VocabEntry[]>(() => {
    const list: VocabEntry[] = [];
    for (const sit of situations) {
      for (const word of sit.targetWords) {
        list.push({
          key: makeWordKey(sit.id, word.en),
          en: word.en,
          vn: word.vn,
          domain: sit.domain,
          situationTitle: sit.title,
        });
      }
    }
    for (const k of knowledge) {
      list.push({
        key: `kn::${k.id}`,
        en: k.phraseEn,
        vn: k.meaningVn,
        domain: k.topic,
        situationTitle: 'Kiến thức AI mở rộng',
        usageNote: k.usageNoteVn,
      });
    }
    return list;
  }, [situations, knowledge]);

  const availableDomains = useMemo(() => {
    return Array.from(new Set(allEntries.map((e) => e.domain)));
  }, [allEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (domainFilter !== 'Tất cả' && entry.domain !== domainFilter) return false;
      const isLearned = progress.masteredWordKeys.includes(entry.key);
      if (statusFilter === 'learned' && !isLearned) return false;
      if (statusFilter === 'unlearned' && isLearned) return false;
      if (!q) return true;
      return (
        entry.en.toLowerCase().includes(q) ||
        entry.vn.toLowerCase().includes(q) ||
        entry.situationTitle.toLowerCase().includes(q)
      );
    });
  }, [allEntries, domainFilter, statusFilter, searchQuery, progress.masteredWordKeys]);

  const safeIndex = filteredEntries.length > 0 ? cardIndex % filteredEntries.length : 0;
  const activeCard = filteredEntries[safeIndex];

  const handleNextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (filteredEntries.length > 0 ? (prev + 1) % filteredEntries.length : 0));
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) =>
      filteredEntries.length > 0
        ? (prev - 1 + filteredEntries.length) % filteredEntries.length
        : 0
    );
  };

  const cardProgressPct =
    filteredEntries.length > 0 ? Math.round(((safeIndex + 1) / filteredEntries.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600">
            Kho từ vựng & mẫu câu mở rộng · {progress.masteredWordKeys.length}/{allEntries.length} mục đã nhớ
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Từ & Cụm từ cốt lõi
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenKnowledgeLoader(domainFilter === 'Tất cả' ? '' : domainFilter)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>Load thêm kiến thức mới</span>
          </button>

          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('flashcard')}
              className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'flashcard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>Thẻ ghi nhớ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" aria-hidden="true" />
              <span>Danh sách</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => {
              setDomainFilter('Tất cả');
              setCardIndex(0);
              setIsFlipped(false);
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              domainFilter === 'Tất cả'
                ? 'bg-[#071f4f] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất cả
          </button>
          {availableDomains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDomainFilter(d);
                setCardIndex(0);
                setIsFlipped(false);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                domainFilter === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'unlearned', label: 'Cần ôn' },
                { id: 'learned', label: 'Đã nhớ' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  setCardIndex(0);
                  setIsFlipped(false);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === st.id
                    ? 'bg-[#071f4f] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {viewMode === 'list' && (
            <div className="relative flex-1 sm:w-56">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ vựng..."
                className="w-full min-h-[42px] pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          )}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="surface-card rounded-3xl p-10 text-center space-y-3">
          <p className="font-display text-lg font-semibold text-slate-900">
            Không có từ vựng nào khớp bộ lọc
          </p>
          <button
            type="button"
            onClick={() => {
              setDomainFilter('Tất cả');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : viewMode === 'flashcard' && activeCard ? (
        <div className="max-w-xl mx-auto space-y-5">
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="truncate pr-2">
                {activeCard.domain} · {activeCard.situationTitle}
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-700 shrink-0">
                {safeIndex + 1} / {filteredEntries.length}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${cardProgressPct}%` }}
              />
            </div>
          </div>

          {/* 3D Flip Flashcard */}
          <div className="perspective-1000">
            <div
              onClick={() => setIsFlipped((prev) => !prev)}
              role="button"
              tabIndex={0}
              aria-label={`Thẻ từ vựng ${activeCard.en}. Bấm để lật xem nghĩa`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsFlipped((prev) => !prev);
                }
              }}
              className={`relative w-full min-h-[270px] cursor-pointer select-none preserve-3d transition-transform duration-500 ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front Face (English) */}
              <div className="absolute inset-0 backface-hidden surface-card rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-4 hover:border-indigo-300">
                <p className="text-xs font-semibold text-indigo-600">
                  Cụm từ tiếng Anh (chạm để lật xem nghĩa)
                </p>

                <p className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  {activeCard.en}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish(activeCard.en);
                    }}
                    aria-label={`Nghe phát âm ${activeCard.en}`}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-100 text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 inline-flex items-center gap-2 text-xs font-semibold transition-colors"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    <span>Phát âm</span>
                  </button>

                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Lật thẻ</span>
                  </span>
                </div>
              </div>

              {/* Back Face (Vietnamese - Royal Navy) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 hero-navy rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-4 text-white">
                <p className="text-xs font-semibold text-amber-300">
                  Nghĩa tiếng Việt (chạm để quay lại)
                </p>

                <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {activeCard.vn}
                </p>

                {activeCard.usageNote && (
                  <p className="text-xs text-blue-100 max-w-md leading-relaxed">
                    {activeCard.usageNote}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish(activeCard.en);
                    }}
                    aria-label={`Nghe lại phát âm ${activeCard.en}`}
                    className="min-h-[44px] px-4 rounded-xl bg-white/15 text-white hover:bg-white/25 inline-flex items-center gap-2 text-xs font-semibold transition-colors"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    <span>Nghe lại ({activeCard.en})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrevCard}
              aria-label="Thẻ trước"
              className="min-h-[48px] min-w-[48px] px-4 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center shadow-xs"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onToggleMasteredWord(activeCard.key)}
              className={`flex-1 min-h-[48px] px-5 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs ${
                progress.masteredWordKeys.includes(activeCard.key)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#071f4f] text-white hover:bg-[#0f2f73]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {progress.masteredWordKeys.includes(activeCard.key)
                  ? 'Đã thuộc cụm từ này'
                  : 'Đánh dấu đã nhớ'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleNextCard}
              aria-label="Thẻ tiếp theo"
              className="min-h-[48px] min-w-[48px] px-4 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center shadow-xs"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredEntries.map((entry) => {
            const learned = progress.masteredWordKeys.includes(entry.key);
            return (
              <div
                key={entry.key}
                className="surface-card rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-slate-500 truncate">
                    {entry.domain} · {entry.situationTitle}
                  </p>
                  <p className="font-display text-base font-bold text-slate-900 truncate">
                    {entry.en}
                  </p>
                  <p className="text-sm text-slate-600 truncate">{entry.vn}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakEnglish(entry.en)}
                    aria-label={`Nghe ${entry.en}`}
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700 flex items-center justify-center"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleMasteredWord(entry.key)}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold transition-colors ${
                      learned
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {learned ? 'Đã nhớ' : 'Lưu'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
