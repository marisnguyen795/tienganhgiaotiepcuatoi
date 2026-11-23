import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Bookmark,
  Bot,
  CheckCircle2,
  Circle,
  Flame,
  Languages,
  MapPin,
  MessageCircle,
  Play,
  PlusCircle,
  Search,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { DOMAINS, Domain, Situation } from '../data';
import { UserProgress } from '../hooks/useLocalProgress';
import { StoredSituation } from '../utils/aiClient';
import { speakEnglish } from '../utils/speech';
import { VoiceWave } from './VoiceWave';

type HomeDashboardProps = {
  situations: StoredSituation[];
  progress: UserProgress;
  onOpenSituation: (situation: Situation) => void;
  onStartReflexDrill: (domainFilter?: Domain | 'Tất cả') => void;
  onOpenVietToEng: () => void;
  onOpenAIChat: () => void;
  onOpenKnowledgeLoader: (topic?: string) => void;
  onToggleFavorite: (situationId: number) => void;
};

type FilterOption = 'Tất cả' | 'Đã lưu' | Domain;

function domainAccent(domain: string): { iconBg: string; text: string } {
  const lower = domain.toLowerCase();
  if (lower.includes('công việc') || lower.includes('báo cáo')) {
    return { iconBg: 'bg-blue-50 text-blue-700', text: 'text-blue-700' };
  }
  if (lower.includes('vệ sinh') || lower.includes('môi trường')) {
    return { iconBg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700' };
  }
  if (lower.includes('du lịch') || lower.includes('du khách')) {
    return { iconBg: 'bg-amber-50 text-amber-700', text: 'text-amber-700' };
  }
  return { iconBg: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-700' };
}

export function HomeDashboard({
  situations,
  progress,
  onOpenSituation,
  onStartReflexDrill,
  onOpenVietToEng,
  onOpenAIChat,
  onOpenKnowledgeLoader,
  onToggleFavorite,
}: HomeDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSpeakingHero, setIsSpeakingHero] = useState(false);

  const masteredCount = progress.masteredSituationIds.length;
  const totalCount = situations.length;
  const completionRatio = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const recommendedSituation = useMemo(() => {
    return (
      situations.find((s) => !progress.masteredSituationIds.includes(s.id)) ?? situations[0]
    );
  }, [situations, progress.masteredSituationIds]);

  const dynamicDomains = useMemo(() => {
    const iconMap = new Map<string, string>(DOMAINS.map((d) => [d.name, d.icon]));
    const names = Array.from(new Set(situations.map((s) => s.domain)));
    return names.map((name) => ({
      name,
      icon: iconMap.get(name) ?? '✨',
    }));
  }, [situations]);

  const filteredSituations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return situations.filter((item) => {
      if (selectedFilter === 'Đã lưu') {
        if (!progress.favoriteSituationIds.includes(item.id)) return false;
      } else if (selectedFilter !== 'Tất cả') {
        if (item.domain !== selectedFilter) return false;
      }

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.where.toLowerCase().includes(q) ||
        item.withWho.toLowerCase().includes(q) ||
        item.goal.toLowerCase().includes(q) ||
        item.dialogue.some(
          (turn) =>
            turn.en.toLowerCase().includes(q) || turn.vn.toLowerCase().includes(q)
        )
      );
    });
  }, [situations, selectedFilter, searchQuery, progress.favoriteSituationIds]);

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRatio / 100) * circumference;

  const activeDomainForDrill: Domain | 'Tất cả' =
    selectedFilter !== 'Tất cả' && selectedFilter !== 'Đã lưu' ? selectedFilter : 'Tất cả';

  const handlePlayHeroSample = () => {
    const sample = recommendedSituation?.dialogue[0]?.en;
    if (!sample) return;
    setIsSpeakingHero(true);
    speakEnglish(sample, {
      onEnd: () => setIsSpeakingHero(false),
      onError: () => setIsSpeakingHero(false),
    });
  };

  return (
    <div className="space-y-8">
      {/* Hero Focal Stage + Progress Bento */}
      {recommendedSituation && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-8 hero-navy rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 text-white">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-200">
                <span className="text-amber-300 font-semibold">Gợi ý phản xạ hôm nay</span>
                <span aria-hidden="true">·</span>
                <span>{recommendedSituation.domain}</span>
                <span aria-hidden="true">·</span>
                <span>{recommendedSituation.where}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white text-balance max-w-2xl leading-tight">
                {recommendedSituation.title}
              </h1>

              <p className="text-blue-100/90 text-sm sm:text-base max-w-xl leading-relaxed">
                {recommendedSituation.goal}. Thực hành cùng{' '}
                <span className="font-semibold text-white">
                  {recommendedSituation.withWho.toLowerCase()}
                </span>{' '}
                qua {recommendedSituation.dialogue.length} lượt hội thoại thực tế.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-medium text-blue-200 flex items-center gap-2">
                  <span>Câu mở đầu mẫu</span>
                  {isSpeakingHero && <VoiceWave tone="light" />}
                </p>
                <p className="text-sm sm:text-base font-semibold text-white truncate">
                  “{recommendedSituation.dialogue[0]?.en}”
                </p>
                {recommendedSituation.dialogue[0]?.vn && (
                  <p className="text-xs text-blue-200/85 truncate">
                    {recommendedSituation.dialogue[0]?.vn}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePlayHeroSample}
                aria-label="Nghe câu mẫu"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white text-[#071f4f] hover:bg-amber-300 flex items-center justify-center shrink-0 transition-colors shadow-sm"
              >
                <Volume2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenSituation(recommendedSituation)}
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl bg-amber-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-950/20 hover:bg-amber-300 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Bắt đầu tình huống</span>
              </button>

              <button
                type="button"
                onClick={onOpenAIChat}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-2xl bg-white/14 border border-white/20 text-white text-xs sm:text-sm font-semibold hover:bg-white/22 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Bot className="w-4 h-4 text-sky-300 shrink-0" aria-hidden="true" />
                <span>Nói chuyện AI</span>
              </button>

              <button
                type="button"
                onClick={onOpenVietToEng}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-2xl bg-white/14 border border-white/20 text-white text-xs sm:text-sm font-semibold hover:bg-white/22 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Languages className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                <span>Việt → Anh</span>
              </button>

              <button
                type="button"
                onClick={() => onStartReflexDrill(activeDomainForDrill)}
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-2xl bg-white/14 border border-white/20 text-white text-xs sm:text-sm font-semibold hover:bg-white/22 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Zap className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Phản xạ 3 phút</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 surface-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-indigo-600">Tiến độ lộ trình</p>
                <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                  Nhịp độ luyện tập
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Duy trì 3 phút mỗi ngày để phản xạ tự nhiên
                </p>
              </div>

              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                  <defs>
                    <linearGradient id="progressRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-slate-100"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="url(#progressRingGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute font-mono text-sm font-bold tabular-nums text-slate-900">
                  {completionRatio}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-slate-100">
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/60">
                <p className="text-[11px] font-medium text-slate-500">Tình huống thuộc</p>
                <p className="font-mono text-xl font-bold tabular-nums text-slate-900 mt-1">
                  {masteredCount}
                  <span className="text-xs font-normal text-slate-400">/{totalCount}</span>
                </p>
              </div>
              <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200/60">
                <p className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  <span>Chuỗi ngày</span>
                </p>
                <p className="font-mono text-xl font-bold tabular-nums text-slate-900 mt-1">
                  {progress.streakDays}
                  <span className="text-xs font-medium text-slate-500 ml-1">ngày</span>
                </p>
              </div>
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/60">
                <p className="text-[11px] font-medium text-slate-500">Từ vựng đã nhớ</p>
                <p className="font-mono text-xl font-bold tabular-nums text-indigo-700 mt-1">
                  {progress.masteredWordKeys.length}
                </p>
              </div>
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/60">
                <p className="text-[11px] font-medium text-slate-500">Phiên phản xạ</p>
                <p className="font-mono text-xl font-bold tabular-nums text-emerald-700 mt-1">
                  {progress.completedDrillsCount}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter & Search Toolbar */}
      <section aria-label="Bộ lọc tình huống" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Thư viện tình huống ({situations.length} bài)
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Chọn tình huống thực tế hoặc tải thêm chủ đề mới bằng AI bất kỳ lúc nào
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onOpenKnowledgeLoader(
                  selectedFilter !== 'Tất cả' && selectedFilter !== 'Đã lưu'
                    ? selectedFilter
                    : ''
                )
              }
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Load thêm kiến thức mới</span>
            </button>

            <div className="relative flex-1 sm:w-72">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tình huống, địa điểm..."
                className="w-full min-h-[44px] pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-2xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedFilter('Tất cả')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedFilter === 'Tất cả'
                ? 'bg-[#071f4f] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Tất cả ({situations.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('Đã lưu')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedFilter === 'Đã lưu'
                ? 'bg-[#071f4f] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Đã lưu ({progress.favoriteSituationIds.length})
          </button>

          {dynamicDomains.map((domain) => {
            const isSelected = selectedFilter === domain.name;
            const count = situations.filter((s) => s.domain === domain.name).length;
            return (
              <button
                key={domain.name}
                type="button"
                onClick={() => setSelectedFilter(domain.name)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span aria-hidden="true">{domain.icon}</span>
                <span>{domain.name}</span>
                <span className={isSelected ? 'text-indigo-200' : 'text-slate-400'}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {filteredSituations.length === 0 ? (
        <div className="surface-card rounded-3xl p-10 text-center space-y-3">
          <p className="font-display text-lg font-semibold text-slate-900">
            Không tìm thấy tình huống phù hợp
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedFilter('Tất cả');
                setSearchQuery('');
              }}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Xem tất cả
            </button>
            <button
              type="button"
              onClick={() => onOpenKnowledgeLoader(searchQuery)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Tạo bài mới chủ đề này bằng AI
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredSituations.map((situation) => {
            const isMastered = progress.masteredSituationIds.includes(situation.id);
            const isFav = progress.favoriteSituationIds.includes(situation.id);
            const accent = domainAccent(situation.domain);

            return (
              <motion.article
                key={situation.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="group surface-card rounded-2xl hover:border-indigo-300/90 transition-colors p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-bold tabular-nums ${accent.iconBg}`}
                      >
                        {String(situation.id).padStart(2, '0')}
                      </span>
                      <div className="text-xs text-slate-500 min-w-0 truncate">
                        <span className={`font-semibold ${accent.text}`}>{situation.domain}</span>
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 inline shrink-0" aria-hidden="true" />
                          {situation.where}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(situation.id);
                      }}
                      aria-label={isFav ? 'Bỏ lưu tình huống' : 'Lưu tình huống'}
                      className={`min-h-[38px] min-w-[38px] -mr-1.5 -mt-1.5 rounded-xl flex items-center justify-center transition-colors ${
                        isFav
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors">
                      {situation.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {situation.goal}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                    {isMastered ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span>Đã thuộc</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 truncate">
                        <Circle className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                        <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="tabular-nums">{situation.dialogue.length} lượt</span>
                        <span aria-hidden="true">·</span>
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">{situation.withWho}</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenSituation(situation)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-900 text-xs font-semibold group-hover:bg-[#071f4f] group-hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Luyện tập</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
