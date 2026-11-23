import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Eye,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react';
import { Domain } from '../data';
import { StoredSituation } from '../utils/aiClient';
import {
  computeWordMatchScore,
  isSpeechRecognitionSupported,
  speakEnglish,
  startListening,
  stopSpeaking,
} from '../utils/speech';
import { VoiceWave } from './VoiceWave';

type ReflexDrillViewProps = {
  situations: StoredSituation[];
  initialDomain?: Domain | 'Tất cả';
  onRecordDrill: (correctCount: number, totalCount: number, avgSeconds: number) => void;
  onGoHome: () => void;
};

type DrillCard = {
  id: string;
  domain: Domain;
  where: string;
  withWho: string;
  en: string;
  vn: string;
  intent: string;
};

const ROUND_TIME_SECONDS = 180;
const CARD_TARGET_SECONDS = 8;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ReflexDrillView({
  situations,
  initialDomain = 'Tất cả',
  onRecordDrill,
  onGoHome,
}: ReflexDrillViewProps) {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'Tất cả'>(initialDomain);
  const [phase, setPhase] = useState<'setup' | 'active' | 'summary'>('setup');
  const [cards, setCards] = useState<DrillCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(ROUND_TIME_SECONDS);
  const [cardElapsed, setCardElapsed] = useState<number>(0);

  const [results, setResults] = useState<{ card: DrillCard; correct: boolean; seconds: number }[]>([]);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const [micError, setMicError] = useState<string | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const hasRecordedRef = useRef<boolean>(false);

  const micSupported = isSpeechRecognitionSupported();

  const availableDomains = useMemo(() => {
    return Array.from(new Set(situations.map((s) => s.domain)));
  }, [situations]);

  const availablePool = useMemo(() => {
    const pool: DrillCard[] = [];
    for (const sit of situations) {
      if (selectedDomain !== 'Tất cả' && sit.domain !== selectedDomain) continue;
      sit.dialogue.forEach((turn, idx) => {
        if (turn.role === 'A') {
          pool.push({
            id: `${sit.id}-${idx}`,
            domain: sit.domain,
            where: sit.where,
            withWho: sit.withWho,
            en: turn.en,
            vn: turn.vn,
            intent: turn.intent,
          });
        }
      });
    }
    return pool;
  }, [situations, selectedDomain]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    const interval = window.setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          setPhase('summary');
          return 0;
        }
        return prev - 1;
      });
      setCardElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === 'summary' && !hasRecordedRef.current && results.length > 0) {
      hasRecordedRef.current = true;
      const correct = results.filter((r) => r.correct).length;
      const avg =
        results.reduce((sum, r) => sum + r.seconds, 0) / Math.max(1, results.length);
      onRecordDrill(correct, results.length, avg);
    }
  }, [phase, results, onRecordDrill]);

  const startSession = () => {
    const deck = shuffleArray(availablePool).slice(0, 8);
    if (deck.length === 0) return;
    stopSpeaking();
    stopListeningRef.current?.();
    hasRecordedRef.current = false;
    setCards(deck);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionSecondsLeft(ROUND_TIME_SECONDS);
    setCardElapsed(0);
    setResults([]);
    setSpokenText('');
    setMicError(null);
    setPhase('active');
  };

  const currentCard = cards[currentIndex];

  const handleReveal = () => {
    stopListeningRef.current?.();
    setIsListening(false);
    setIsRevealed(true);
    if (currentCard) {
      speakEnglish(currentCard.en, { rate: 0.95 });
    }
  };

  const handleGrade = (correct: boolean) => {
    if (!currentCard) return;
    stopSpeaking();
    stopListeningRef.current?.();
    setIsListening(false);

    const nextResults = [
      ...results,
      { card: currentCard, correct, seconds: Math.max(1, cardElapsed) },
    ];
    setResults(nextResults);

    if (currentIndex + 1 >= cards.length) {
      setPhase('summary');
    } else {
      setCurrentIndex((prev) => prev + 1);
      setIsRevealed(false);
      setCardElapsed(0);
      setSpokenText('');
      setMicError(null);
    }
  };

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
      onTranscript: (transcript) => setSpokenText(transcript),
      onError: (err) => setMicError(err),
      onEnd: () => setIsListening(false),
    });
  };

  const formatClock = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (phase === 'setup') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="hero-navy rounded-3xl p-6 sm:p-8 space-y-6 text-white">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-300">Chế độ rèn phản xạ tốc độ cao</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white text-balance">
              Phản xạ 3 phút không dịch thầm
            </h1>
            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed max-w-xl">
              Nhìn ngữ cảnh tiếng Việt và nói bật ra câu tiếng Anh trong vòng {CARD_TARGET_SECONDS} giây.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-blue-100">Chọn chủ đề muốn luyện</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDomain('Tất cả')}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  selectedDomain === 'Tất cả'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/12 border border-white/15 text-white hover:bg-white/20'
                }`}
              >
                Tất cả chủ đề
              </button>
              {availableDomains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDomain(d)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    selectedDomain === d
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-white/12 border border-white/15 text-white hover:bg-white/20'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs text-blue-200">Số câu sẵn sàng</p>
                <p className="font-mono font-bold tabular-nums text-white mt-0.5">
                  {Math.min(8, availablePool.length)} câu / phiên
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-200">Thời lượng tối đa</p>
                <p className="font-mono font-bold tabular-nums text-white mt-0.5">03:00</p>
              </div>
            </div>

            <button
              type="button"
              onClick={startSession}
              disabled={availablePool.length === 0}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 py-2.5 rounded-2xl bg-amber-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-950/20 hover:bg-amber-300 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Bắt đầu ngay</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    const correctCount = results.filter((r) => r.correct).length;
    const totalAttempted = results.length;
    const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
    const avgSec =
      totalAttempted > 0
        ? (results.reduce((s, r) => s + r.seconds, 0) / totalAttempted).toFixed(1)
        : '0.0';

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="surface-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-700">Hoàn thành phiên phản xạ</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Tổng kết tốc độ phản xạ
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-slate-50 rounded-2xl border border-slate-200/70 p-4 sm:p-5">
            <div>
              <p className="text-xs text-slate-500">Phản xạ tốt</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 mt-1">
                {correctCount}/{totalAttempted}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tỉ lệ đạt</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-indigo-600 mt-1">
                {accuracy}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trung bình / câu</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 mt-1">
                {avgSec}s
              </p>
            </div>
          </div>

          {results.length > 0 && (
            <div className="divide-y divide-slate-100">
              {results.map((item, idx) => (
                <div key={`${item.card.id}-${idx}`} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.card.en}</p>
                    <p className="text-xs text-slate-500">{item.card.vn}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-medium">
                    <span className="font-mono tabular-nums text-slate-400">{item.seconds}s</span>
                    {item.correct ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span>Đạt</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                        <XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />
                        <span>Ôn lại</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={startSession}
              className="inline-flex items-center gap-2 min-h-[46px] px-5 py-2.5 rounded-2xl bg-[#071f4f] text-white text-sm font-semibold hover:bg-[#0f2f73] transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Luyện vòng mới</span>
            </button>

            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-2 min-h-[46px] px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              <span>Về thư viện tình huống</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const spokenMatch =
    spokenText && currentCard ? computeWordMatchScore(spokenText, currentCard.en) : null;
  const targetProgress = Math.min(100, Math.round((cardElapsed / CARD_TARGET_SECONDS) * 100));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Zap className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          <span className="font-mono tabular-nums">
            Câu {currentIndex + 1}/{cards.length}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm font-bold tabular-nums text-[#071f4f] bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
          <Clock className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          <span>{formatClock(sessionSecondsLeft)}</span>
        </div>
      </div>

      {currentCard && (
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="surface-card rounded-3xl p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>
                Nhịp phản xạ mục tiêu ({CARD_TARGET_SECONDS}s) ·{' '}
                <strong className={cardElapsed <= CARD_TARGET_SECONDS ? 'text-indigo-700' : 'text-amber-700'}>
                  {cardElapsed <= CARD_TARGET_SECONDS ? 'Nhịp tốt' : 'Quá nhịp mục tiêu'}
                </strong>
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-800">{cardElapsed}s</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  cardElapsed <= CARD_TARGET_SECONDS
                    ? 'bg-indigo-600'
                    : cardElapsed <= 12
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-indigo-600">{currentCard.domain}</span>
              <span aria-hidden="true">·</span>
              <span>{currentCard.where}</span>
              <span aria-hidden="true">·</span>
              <span>Nói với {currentCard.withWho.toLowerCase()}</span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl lg:text-[26px] font-bold text-slate-900 leading-snug text-balance">
              “{currentCard.vn}”
            </h2>

            {currentCard.intent && (
              <p className="text-sm text-slate-500">Ý định giao tiếp: {currentCard.intent}</p>
            )}
          </div>

          {micError && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {micError}
            </p>
          )}

          {spokenText && spokenMatch && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200/70 p-4 space-y-1">
              <p className="text-xs text-slate-500">Giọng nói ghi nhận</p>
              <p className="text-sm font-medium text-slate-900">“{spokenText}”</p>
              {isRevealed && (
                <p
                  className={`text-xs font-mono font-semibold tabular-nums ${
                    spokenMatch.score >= 70 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  Độ khớp từ khóa tham khảo: {spokenMatch.score}%
                </p>
              )}
            </div>
          )}

          {isRevealed ? (
            <div className="space-y-5 pt-2 border-t border-slate-100">
              <div className="hero-navy rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 text-white">
                <div>
                  <p className="text-xs font-medium text-amber-300 mb-1">
                    Gợi ý câu tiếng Anh tự nhiên
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-white">{currentCard.en}</p>
                </div>
                <button
                  type="button"
                  onClick={() => speakEnglish(currentCard.en)}
                  aria-label="Nghe lại đáp án"
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-white text-[#071f4f] hover:bg-amber-300 flex items-center justify-center shrink-0 transition-colors"
                >
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleGrade(false)}
                  className="min-h-[48px] px-4 py-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-semibold hover:bg-rose-100 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Chậm, cần ôn</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGrade(true)}
                  className="min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Phản xạ tốt</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReveal}
                className="flex-1 min-w-[180px] min-h-[48px] px-5 py-3 rounded-2xl bg-[#071f4f] text-white text-sm font-semibold shadow-sm hover:bg-[#0f2f73] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>Lật đáp án & Nghe mẫu</span>
              </button>

              {micSupported && (
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`min-h-[48px] px-5 py-3 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" aria-hidden="true" />
                      <span>Dừng nói</span>
                      <VoiceWave tone="light" />
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" aria-hidden="true" />
                      <span>Nói vào micro</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
