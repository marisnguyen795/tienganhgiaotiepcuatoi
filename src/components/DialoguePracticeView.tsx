import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Situation } from '../data';
import { makeWordKey, UserProgress } from '../hooks/useLocalProgress';
import {
  AIPreference,
  EvaluationResult,
  requestTranslationEvaluation,
} from '../utils/aiClient';
import {
  isSpeechRecognitionSupported,
  speakEnglish,
  startListening,
  stopSpeaking,
} from '../utils/speech';
import { VoiceWave } from './VoiceWave';

type DialoguePracticeViewProps = {
  situation: Situation;
  progress: UserProgress;
  aiPreference: AIPreference;
  onBack: () => void;
  onToggleMasteredSituation: (id: number) => void;
  onToggleFavoriteSituation: (id: number) => void;
  onToggleMasteredWord: (wordKey: string) => void;
};

type RoleFilter = 'ALL' | 'A' | 'B';

export function DialoguePracticeView({
  situation,
  progress,
  aiPreference,
  onBack,
  onToggleMasteredSituation,
  onToggleFavoriteSituation,
  onToggleMasteredWord,
}: DialoguePracticeViewProps) {
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [showVietnamese, setShowVietnamese] = useState<boolean>(true);
  const [roleMode, setRoleMode] = useState<RoleFilter>('ALL');
  const [activeTurnIdx, setActiveTurnIdx] = useState<number | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState<boolean>(false);

  const [listeningTurnIdx, setListeningTurnIdx] = useState<number | null>(null);
  const [spokenTextMap, setSpokenTextMap] = useState<Record<number, string>>({});
  const [aiTurnFeedback, setAiTurnFeedback] = useState<Record<number, EvaluationResult>>({});
  const [evaluatingTurnIdx, setEvaluatingTurnIdx] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const [followUpCountdown, setFollowUpCountdown] = useState<number | null>(null);
  const [followUpListening, setFollowUpListening] = useState<boolean>(false);
  const [followUpSpoken, setFollowUpSpoken] = useState<string>('');
  const [followUpFeedback, setFollowUpFeedback] = useState<EvaluationResult | null>(null);
  const [evaluatingFollowUp, setEvaluatingFollowUp] = useState<boolean>(false);

  const isMastered = progress.masteredSituationIds.includes(situation.id);
  const isFav = progress.favoriteSituationIds.includes(situation.id);
  const micSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, [situation.id]);

  useEffect(() => {
    if (followUpCountdown === null || followUpCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setFollowUpCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [followUpCountdown]);

  const handlePlayTurn = (idx: number, text: string) => {
    setIsPlayingAll(false);
    setActiveTurnIdx(idx);
    speakEnglish(text, {
      rate: speechRate,
      onEnd: () => setActiveTurnIdx(null),
      onError: () => setActiveTurnIdx(null),
    });
  };

  const handlePlayAll = () => {
    if (isPlayingAll) {
      stopSpeaking();
      setIsPlayingAll(false);
      setActiveTurnIdx(null);
      return;
    }

    setIsPlayingAll(true);
    let current = 0;

    const playNext = () => {
      if (current >= situation.dialogue.length) {
        setIsPlayingAll(false);
        setActiveTurnIdx(null);
        return;
      }
      const turn = situation.dialogue[current];
      setActiveTurnIdx(current);
      speakEnglish(turn.en, {
        rate: speechRate,
        onEnd: () => {
          current += 1;
          window.setTimeout(playNext, 350);
        },
        onError: () => {
          setIsPlayingAll(false);
          setActiveTurnIdx(null);
        },
      });
    };

    playNext();
  };

  const handleToggleMicForTurn = (idx: number) => {
    setSpeechError(null);

    if (listeningTurnIdx === idx) {
      stopListeningRef.current?.();
      setListeningTurnIdx(null);
      return;
    }

    stopSpeaking();
    stopListeningRef.current?.();
    setListeningTurnIdx(idx);
    setFollowUpListening(false);

    stopListeningRef.current = startListening({
      onTranscript: (transcript) => {
        setSpokenTextMap((prev) => ({ ...prev, [idx]: transcript }));
      },
      onError: (err) => setSpeechError(err),
      onEnd: () => setListeningTurnIdx(null),
    });
  };

  const handleAnalyzeTurnWithAI = async (idx: number) => {
    const turn = situation.dialogue[idx];
    const text = spokenTextMap[idx]?.trim();
    if (!turn || !text || evaluatingTurnIdx === idx) return;

    setEvaluatingTurnIdx(idx);
    const res = await requestTranslationEvaluation({
      vietnamesePrompt: turn.vn,
      expectedEnglish: turn.en,
      userAnswer: text,
      inputMode: 'speak',
      domain: situation.domain,
      where: situation.where,
      preference: aiPreference,
    });
    setAiTurnFeedback((prev) => ({ ...prev, [idx]: res }));
    setEvaluatingTurnIdx(null);
  };

  const handleStartFollowUpPractice = () => {
    setSpeechError(null);
    setFollowUpCountdown(8);
    speakEnglish(situation.followUp, { rate: speechRate });
  };

  const handleToggleFollowUpMic = () => {
    setSpeechError(null);
    if (followUpListening) {
      stopListeningRef.current?.();
      setFollowUpListening(false);
      return;
    }

    stopSpeaking();
    stopListeningRef.current?.();
    setListeningTurnIdx(null);
    setFollowUpListening(true);

    stopListeningRef.current = startListening({
      onTranscript: (transcript) => setFollowUpSpoken(transcript),
      onError: (err) => setSpeechError(err),
      onEnd: () => setFollowUpListening(false),
    });
  };

  const handleEvaluateFollowUp = async () => {
    if (!followUpSpoken.trim() || evaluatingFollowUp) return;
    setEvaluatingFollowUp(true);
    const res = await requestTranslationEvaluation({
      vietnamesePrompt: `Trả lời câu hỏi tình huống: "${situation.followUp}" (${situation.goal})`,
      expectedEnglish: `Natural response to: ${situation.followUp}`,
      userAnswer: followUpSpoken.trim(),
      inputMode: 'speak',
      domain: situation.domain,
      where: situation.where,
      preference: aiPreference,
    });
    setFollowUpFeedback(res);
    setEvaluatingFollowUp(false);
  };

  return (
    <div className="space-y-6">
      {/* Theater Stage Header */}
      <div className="hero-navy rounded-3xl p-5 sm:p-7 space-y-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              stopListeningRef.current?.();
              onBack();
            }}
            className="inline-flex items-center gap-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-white/12 border border-white/15 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay lại lộ trình</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavoriteSituation(situation.id)}
              aria-label={isFav ? 'Bỏ lưu tình huống' : 'Lưu tình huống'}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                isFav
                  ? 'bg-amber-400/20 border-amber-300/60 text-amber-200'
                  : 'bg-white/12 border-white/15 text-white hover:bg-white/20'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">{isFav ? 'Đã lưu' : 'Lưu lại'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleMasteredSituation(situation.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                isMastered
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>{isMastered ? 'Đã thuộc tình huống' : 'Đánh dấu đã thuộc'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-blue-200 flex flex-wrap items-center gap-2">
            <span className="text-amber-300 font-semibold">{situation.domain}</span>
            <span aria-hidden="true">·</span>
            <span>Địa điểm: {situation.where}</span>
            <span aria-hidden="true">·</span>
            <span>Đối tác: {situation.withWho}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white text-balance">
            {situation.title}
          </h1>
          <p className="text-sm sm:text-base text-blue-100/90">Mục tiêu: {situation.goal}</p>
        </div>

        <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePlayAll}
              className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white text-[#071f4f] text-sm font-bold shadow-sm hover:bg-amber-300 transition-colors"
            >
              {isPlayingAll ? (
                <>
                  <Pause className="w-4 h-4" aria-hidden="true" />
                  <span>Dừng hội thoại</span>
                  <VoiceWave tone="indigo" />
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Nghe toàn bộ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowVietnamese((prev) => !prev)}
              className="inline-flex items-center gap-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-white/12 border border-white/15 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            >
              {showVietnamese ? (
                <>
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                  <span>Ẩn nghĩa Việt</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Hiện nghĩa Việt</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center p-1 bg-white/12 border border-white/15 rounded-xl">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'A', label: 'Vai Bạn (A)' },
                  { id: 'B', label: 'Vai Đối tác (B)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRoleMode(opt.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    roleMode === opt.id
                      ? 'bg-white text-[#071f4f] shadow-sm'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-1 bg-white/12 border border-white/15 rounded-xl">
              {[
                { label: '0.75x', val: 0.75 },
                { label: '1.0x', val: 0.95 },
                { label: '1.15x', val: 1.15 },
              ].map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  onClick={() => setSpeechRate(sp.val)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg font-mono text-xs font-semibold transition-colors ${
                    speechRate === sp.val
                      ? 'bg-white text-[#071f4f] shadow-sm'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {speechError && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-4 py-3 text-sm">
          {speechError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Interactive Turn Sequence Indicator */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Tiến trình thoại:
            </span>
            <div className="flex items-center gap-1.5 flex-1">
              {situation.dialogue.map((turn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePlayTurn(idx, turn.en)}
                  aria-label={`Nghe lượt ${idx + 1}`}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    activeTurnIdx === idx
                      ? 'bg-indigo-600 scale-y-125'
                      : turn.role === 'A'
                        ? 'bg-indigo-200 hover:bg-indigo-400'
                        : 'bg-slate-200 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3.5">
            {situation.dialogue.map((turn, idx) => {
              const isUserRole = turn.role === 'A';
              const isActiveAudio = activeTurnIdx === idx;
              const isListening = listeningTurnIdx === idx;
              const hideEnglishPrompt =
                (roleMode === 'A' && turn.role === 'A') ||
                (roleMode === 'B' && turn.role === 'B');
              const spoken = spokenTextMap[idx];
              const turnAiEval = aiTurnFeedback[idx];

              return (
                <motion.div
                  key={`${situation.id}-turn-${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.03 }}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    isActiveAudio
                      ? 'bg-indigo-50/80 border-indigo-400 shadow-sm shadow-indigo-100'
                      : isUserRole
                        ? 'surface-card'
                        : 'bg-slate-50/90 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isUserRole
                            ? 'bg-[#071f4f] text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {turn.role}
                      </span>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-semibold ${
                              isUserRole ? 'text-indigo-700' : 'text-slate-700'
                            }`}
                          >
                            {turn.speaker}
                          </span>
                          {turn.intent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{turn.intent}</span>
                            </>
                          )}
                          {isActiveAudio && <VoiceWave tone="indigo" />}
                          {isListening && <VoiceWave tone="rose" />}
                        </div>

                        {hideEnglishPrompt ? (
                          <p className="text-sm font-medium text-indigo-700 py-1">
                            Lượt của bạn — Hãy nói tự do theo cách của bạn dựa theo ý tiếng Việt bên dưới.
                          </p>
                        ) : (
                          <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
                            {turn.en}
                          </p>
                        )}

                        {showVietnamese && (
                          <p className="text-sm text-slate-600 leading-relaxed">{turn.vn}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePlayTurn(idx, turn.en)}
                        aria-label={`Nghe câu của ${turn.speaker}`}
                        className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
                          isActiveAudio
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700'
                        }`}
                      >
                        <Volume2 className="w-5 h-5" aria-hidden="true" />
                      </button>

                      {micSupported && (
                        <button
                          type="button"
                          onClick={() => handleToggleMicForTurn(idx)}
                          aria-label={isListening ? 'Dừng ghi âm' : 'Nói thử câu này'}
                          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
                            isListening
                              ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isListening ? (
                            <MicOff className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <Mic className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {spoken && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-2.5 pl-11">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                        <p className="text-slate-700">
                          Bạn nói: <span className="font-semibold text-slate-900">“{spoken}”</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAnalyzeTurnWithAI(idx)}
                          disabled={evaluatingTurnIdx === idx}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          {evaluatingTurnIdx === idx ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>AI Chỉnh trên câu của bạn</span>
                        </button>
                      </div>

                      {turnAiEval && (
                        <div className="bg-emerald-50/70 rounded-xl border border-emerald-200/80 p-3 text-xs space-y-1">
                          <p className="font-bold text-emerald-800">
                            {turnAiEval.score}/100 · Chỉnh chuẩn: “{turnAiEval.correctedEn}”
                          </p>
                          <p className="text-slate-700">{turnAiEval.feedbackVn}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Follow-up Reflex Challenge */}
          <div className="surface-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-indigo-600">
                  Thử thách phản xạ tự do · AI chỉnh theo cấu trúc của bạn
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  Nếu đối tác hỏi tiếp câu này, bạn trả lời sao?
                </h2>
              </div>

              {followUpCountdown !== null && (
                <div
                  className={`font-mono text-sm font-bold tabular-nums px-3.5 py-1.5 rounded-xl border ${
                    followUpCountdown > 0
                      ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}
                >
                  {followUpCountdown > 0 ? `${followUpCountdown}s phản xạ` : 'Hết giờ'}
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200/70 p-4 flex items-center justify-between gap-4">
              <p className="text-base sm:text-lg font-semibold text-slate-900">
                “{situation.followUp}”
              </p>
              <button
                type="button"
                onClick={() => speakEnglish(situation.followUp, { rate: speechRate })}
                aria-label="Nghe câu hỏi mở rộng"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center shrink-0"
              >
                <Volume2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartFollowUpPractice}
                className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-700"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Bấm giờ 8 giây</span>
              </button>

              {micSupported && (
                <button
                  type="button"
                  onClick={handleToggleFollowUpMic}
                  className={`inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold ${
                    followUpListening
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {followUpListening ? (
                    <>
                      <MicOff className="w-4 h-4" aria-hidden="true" />
                      <span>Dừng nói</span>
                      <VoiceWave tone="light" />
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" aria-hidden="true" />
                      <span>Nói trả lời</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={followUpSpoken}
                onChange={(e) => setFollowUpSpoken(e.target.value)}
                placeholder="Hoặc gõ câu trả lời tiếng Anh của riêng bạn..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <button
                type="button"
                onClick={handleEvaluateFollowUp}
                disabled={!followUpSpoken.trim() || evaluatingFollowUp}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#071f4f] text-white text-xs sm:text-sm font-semibold hover:bg-[#0f2f73] disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
              >
                {evaluatingFollowUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
                )}
                <span>AI Chấm</span>
              </button>
            </div>

            {followUpFeedback && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-1.5 text-sm">
                <p className="font-bold text-emerald-800">
                  {followUpFeedback.score}/100 · Tối ưu trên câu của bạn: “
                  {followUpFeedback.correctedEn}”
                </p>
                <p className="text-slate-700 text-xs sm:text-sm">{followUpFeedback.feedbackVn}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:col-span-4 surface-card rounded-3xl p-5 sm:p-6 space-y-4 lg:sticky lg:top-24">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Từ & Cụm từ cốt lõi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nghe phát âm chuẩn hoặc lưu lại để ôn tập nhanh
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {situation.targetWords.map((word) => {
              const key = makeWordKey(situation.id, word.en);
              const learned = progress.masteredWordKeys.includes(key);

              return (
                <div key={key} className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-slate-900 truncate">
                      {word.en}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{word.vn}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakEnglish(word.en, { rate: speechRate })}
                      aria-label={`Nghe phát âm ${word.en}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700 flex items-center justify-center transition-colors"
                    >
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleMasteredWord(key)}
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
        </aside>
      </div>
    </div>
  );
}
