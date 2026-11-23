import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  PenLine,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Domain } from '../data';
import {
  AIPreference,
  EvaluationResult,
  fetchAIStatus,
  ProvidersSnapshot,
  recheckAIProviders,
  requestTranslationEvaluation,
  StoredSituation,
} from '../utils/aiClient';
import {
  isSpeechRecognitionSupported,
  speakEnglish,
  startListening,
  stopSpeaking,
} from '../utils/speech';
import { VoiceWave } from './VoiceWave';

type VietToEngViewProps = {
  situations: StoredSituation[];
  aiPreference: AIPreference;
  onChangePreference: (pref: AIPreference) => void;
  onOpenKnowledgeLoader: (topic?: string) => void;
};

type PromptItem = {
  id: string;
  domain: Domain;
  where: string;
  withWho: string;
  vn: string;
  en: string;
  hintWord: string;
};

function engineLabel(engine: 'gemini' | 'meta' | 'dual' | 'offline'): string {
  if (engine === 'dual') return 'Gemini + Meta AI';
  if (engine === 'gemini') return 'Gemini AI';
  if (engine === 'meta') return 'Meta AI';
  return 'Offline';
}

export function VietToEngView({
  situations,
  aiPreference,
  onChangePreference,
  onOpenKnowledgeLoader,
}: VietToEngViewProps) {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'Tất cả'>('Tất cả');
  const [inputMode, setInputMode] = useState<'speak' | 'write'>('write');
  const [promptIndex, setPromptIndex] = useState<number>(0);

  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<boolean>(true);

  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<EvaluationResult | null>(null);
  const [providers, setProviders] = useState<ProvidersSnapshot | null>(null);

  const stopListeningRef = useRef<(() => void) | null>(null);
  const micSupported = isSpeechRecognitionSupported();

  const availableDomains = useMemo(() => {
    return Array.from(new Set(situations.map((s) => s.domain)));
  }, [situations]);

  const promptPool = useMemo<PromptItem[]>(() => {
    const items: PromptItem[] = [];
    for (const sit of situations) {
      if (selectedDomain !== 'Tất cả' && sit.domain !== selectedDomain) continue;
      sit.dialogue.forEach((turn, idx) => {
        if (turn.role === 'A') {
          const matchingWord = sit.targetWords[idx % Math.max(1, sit.targetWords.length)]?.en ?? '';
          items.push({
            id: `${sit.id}-${idx}`,
            domain: sit.domain,
            where: sit.where,
            withWho: sit.withWho,
            vn: turn.vn,
            en: turn.en,
            hintWord: matchingWord,
          });
        }
      });
    }
    return items;
  }, [situations, selectedDomain]);

  const safeIndex = promptPool.length > 0 ? promptIndex % promptPool.length : 0;
  const currentPrompt = promptPool[safeIndex];

  useEffect(() => {
    fetchAIStatus().then((res) => {
      if (res.providers) setProviders(res.providers);
    });
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, []);

  const handleToggleMic = () => {
    setMicError(null);
    if (isListening) {
      stopListeningRef.current?.();
      setIsListening(false);
      return;
    }

    stopSpeaking();
    setIsListening(true);
    stopListeningRef.current = startListening({
      onTranscript: (transcript) => {
        setUserAnswer(transcript);
      },
      onError: (err) => setMicError(err),
      onEnd: () => setIsListening(false),
    });
  };

  const handleCheck = async () => {
    if (!currentPrompt || !userAnswer.trim() || isEvaluating) return;
    stopListeningRef.current?.();
    setIsListening(false);
    setIsEvaluating(true);

    const result = await requestTranslationEvaluation({
      vietnamesePrompt: currentPrompt.vn,
      expectedEnglish: currentPrompt.en,
      userAnswer: userAnswer.trim(),
      inputMode,
      domain: currentPrompt.domain,
      where: currentPrompt.where,
      hintWord: currentPrompt.hintWord,
      preference: aiPreference,
    });

    setFeedback(result);
    if (result.providers) setProviders(result.providers);
    setIsEvaluating(false);
  };

  const handleNext = () => {
    stopSpeaking();
    stopListeningRef.current?.();
    setIsListening(false);
    setFeedback(null);
    setUserAnswer('');
    setMicError(null);
    setPromptIndex((prev) => (promptPool.length > 0 ? (prev + 1) % promptPool.length : 0));
  };

  const handleRecheckAI = async () => {
    const res = await recheckAIProviders();
    if (res.providers) setProviders(res.providers);
  };

  const scoreRadius = 24;
  const scoreCircumference = 2 * Math.PI * scoreRadius;
  const scoreOffset = feedback
    ? scoreCircumference - (Math.min(100, Math.max(0, feedback.score)) / 100) * scoreCircumference
    : scoreCircumference;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Engine Selector + Domain Switcher */}
      <div className="surface-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-indigo-600">
              Việt → Anh · Điều chỉnh trên chính cấu trúc & từ vựng của bạn
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Luyện bật câu phản xạ tự do
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5">
              <Cpu className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
              <select
                aria-label="Chọn nền tảng AI"
                value={aiPreference}
                onChange={(e) => onChangePreference(e.target.value as AIPreference)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="parallel">Song song (Gemini + Meta AI)</option>
                <option value="auto">Tự động (Gemini ↔ Meta AI)</option>
                <option value="gemini">Ưu tiên Gemini AI</option>
                <option value="meta">Ưu tiên Meta AI</option>
                <option value="offline">Chỉ dùng Offline</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenKnowledgeLoader(selectedDomain === 'Tất cả' ? '' : selectedDomain)
              }
              className="min-h-[38px] px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Load thêm kiến thức</span>
            </button>

            {providers &&
              (providers.gemini.status === 'exhausted' || providers.meta.status === 'exhausted') && (
                <button
                  type="button"
                  onClick={handleRecheckAI}
                  className="min-h-[38px] px-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium inline-flex items-center gap-1 hover:bg-amber-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kiểm tra lại AI</span>
                </button>
              )}
          </div>
        </div>

        {/* Provider Live Availability Row */}
        {providers && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              Gemini:{' '}
              <strong
                className={
                  providers.gemini.status === 'ready'
                    ? 'text-emerald-700'
                    : providers.gemini.status === 'exhausted'
                      ? 'text-amber-700'
                      : 'text-slate-500'
                }
              >
                {providers.gemini.status === 'ready'
                  ? 'Sẵn sàng'
                  : providers.gemini.status === 'exhausted'
                    ? 'Hết token tạm thời'
                    : 'Chưa cấu hình'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Meta AI:{' '}
              <strong
                className={
                  providers.meta.status === 'ready'
                    ? 'text-emerald-700'
                    : providers.meta.status === 'exhausted'
                      ? 'text-amber-700'
                      : 'text-slate-500'
                }
              >
                {providers.meta.status === 'ready'
                  ? 'Sẵn sàng'
                  : providers.meta.status === 'exhausted'
                    ? 'Hết token tạm thời'
                    : 'Chưa cấu hình'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Offline: <strong className="text-slate-700">Luôn sẵn sàng</strong>
            </span>
          </div>
        )}

        {/* Domain Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedDomain('Tất cả');
              setPromptIndex(0);
              setFeedback(null);
              setUserAnswer('');
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedDomain === 'Tất cả'
                ? 'bg-[#071f4f] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          {availableDomains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setSelectedDomain(d);
                setPromptIndex(0);
                setFeedback(null);
                setUserAnswer('');
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedDomain === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Switcher: NÓI | VIẾT */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setInputMode('speak');
            setMicError(null);
          }}
          className={`min-h-[46px] rounded-xl font-display text-sm font-bold inline-flex items-center justify-center gap-2 transition-all ${
            inputMode === 'speak'
              ? 'bg-[#071f4f] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Mic className="w-4 h-4" aria-hidden="true" />
          <span>NÓI (MICRO)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            stopListeningRef.current?.();
            setIsListening(false);
            setInputMode('write');
          }}
          className={`min-h-[46px] rounded-xl font-display text-sm font-bold inline-flex items-center justify-center gap-2 transition-all ${
            inputMode === 'write'
              ? 'bg-[#071f4f] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <PenLine className="w-4 h-4" aria-hidden="true" />
          <span>VIẾT</span>
        </button>
      </div>

      {/* Main Exercise Card */}
      {currentPrompt && (
        <div className="space-y-4">
          <div className="hero-navy rounded-3xl p-5 sm:p-7 space-y-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-blue-200">
              <span>
                Câu{' '}
                <strong className="font-mono tabular-nums text-amber-300">
                  {safeIndex + 1}/{promptPool.length}
                </strong>{' '}
                · Diễn đạt tự do theo ý của bạn
              </span>
              <span>
                {currentPrompt.domain} · {currentPrompt.where}
              </span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl lg:text-[26px] font-bold text-white leading-snug text-balance">
              “{currentPrompt.vn}”
            </h2>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/15">
              <div className="flex items-center gap-3">
                {currentPrompt.hintWord && (
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-100 hover:text-amber-300 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                    <span>
                      {showHint ? `Gợi ý từ khóa: ${currentPrompt.hintWord}` : 'Hiện gợi ý từ khóa'}
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => speakEnglish(currentPrompt.en)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#071f4f] bg-white hover:bg-amber-300 py-2 px-3.5 rounded-xl transition-colors shadow-xs"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Nghe mẫu tham khảo</span>
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div className="surface-card rounded-3xl p-4 sm:p-5 space-y-3">
            {inputMode === 'speak' && (
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                {micSupported ? (
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`flex-1 min-h-[50px] px-5 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2.5 transition-colors ${
                      isListening
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4" aria-hidden="true" />
                        <span>Đang nghe giọng bạn... Bấm để dừng</span>
                        <VoiceWave tone="light" />
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" aria-hidden="true" />
                        <span>Bấm để nói theo cách của bạn</span>
                      </>
                    )}
                  </button>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl w-full">
                    Trình duyệt chưa hỗ trợ micro trực tiếp. Bạn có thể tự đọc to rồi nhập câu vào ô bên dưới.
                  </p>
                )}
              </div>
            )}

            {micError && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {micError}
              </p>
            )}

            <textarea
              rows={3}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCheck();
                }
              }}
              placeholder={
                inputMode === 'speak'
                  ? 'Nói tự nhiên theo vốn từ của bạn (không cần rập khuôn theo câu mẫu)...'
                  : 'Viết theo cấu trúc & từ vựng của chính bạn — AI sẽ tối ưu trực tiếp trên nền câu của bạn...'
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-none"
            />

            <button
              type="button"
              onClick={handleCheck}
              disabled={!userAnswer.trim() || isEvaluating}
              className="w-full min-h-[50px] rounded-2xl bg-indigo-600 text-white text-sm sm:text-base font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>AI đang phân tích trên chính câu của bạn...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <span>Kiểm tra & Tối ưu theo cách nói của bạn</span>
                </>
              )}
            </button>
          </div>

          {/* Feedback Card */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="surface-card rounded-3xl p-5 sm:p-6 space-y-4"
            >
              {feedback.failoverNote && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3.5 py-2 text-xs">
                  {feedback.failoverNote}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60" aria-hidden="true">
                      <circle
                        cx="30"
                        cy="30"
                        r={scoreRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-slate-100"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r={scoreRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={scoreCircumference}
                        strokeDashoffset={scoreOffset}
                        className={
                          feedback.score >= 85
                            ? 'text-emerald-500'
                            : feedback.score >= 60
                              ? 'text-indigo-600'
                              : 'text-rose-500'
                        }
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold tabular-nums text-slate-900">
                      {feedback.score}
                    </span>
                  </div>

                  <div>
                    <p
                      className={`font-display text-lg sm:text-xl font-bold ${
                        feedback.score >= 85
                          ? 'text-emerald-700'
                          : feedback.score >= 60
                            ? 'text-indigo-700'
                            : 'text-rose-700'
                      }`}
                    >
                      {feedback.verdict}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                      <span>Đánh giá bởi {engineLabel(feedback.engine)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 space-y-1">
                  <p className="text-xs font-medium text-slate-500">Câu bạn diễn đạt</p>
                  <p className="font-semibold text-slate-900 leading-relaxed">{feedback.userAnswer}</p>
                </div>

                <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200/80 p-3.5 space-y-1">
                  <p className="text-xs font-medium text-emerald-700">Chỉnh chuẩn trên nền câu bạn</p>
                  <p className="font-bold text-emerald-900 leading-relaxed">{feedback.correctedEn}</p>
                </div>
              </div>

              {feedback.naturalAlternative &&
                feedback.naturalAlternative.toLowerCase() !==
                  feedback.correctedEn.toLowerCase() && (
                  <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-2xl p-3.5 text-sm">
                    <p className="text-xs font-medium text-indigo-700 mb-0.5">
                      Gợi ý tự nhiên như người bản xứ
                    </p>
                    <p className="font-semibold text-indigo-950">{feedback.naturalAlternative}</p>
                  </div>
                )}

              <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                <p>{feedback.feedbackVn}</p>

                {feedback.grammarNotes.length > 0 && (
                  <ul className="space-y-1 text-xs sm:text-sm text-slate-600 bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
                    {feedback.grammarNotes.map((note, idx) => (
                      <li key={idx}>• {note}</li>
                    ))}
                  </ul>
                )}

                {feedback.dualInsight && (
                  <p className="text-xs text-indigo-900 bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-3">
                    {feedback.dualInsight}
                  </p>
                )}

                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">Mẹo nhớ nhanh:</strong> {feedback.practiceTip}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => speakEnglish(feedback.correctedEn)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 inline-flex items-center gap-2 transition-colors"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  <span>Nghe câu chuẩn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setUserAnswer('');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 inline-flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Thử diễn đạt lại</span>
                </button>
              </div>
            </motion.div>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="w-full min-h-[50px] rounded-2xl bg-[#071f4f] text-white text-sm sm:text-base font-semibold hover:bg-[#0f2f73] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Câu tiếp theo</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
