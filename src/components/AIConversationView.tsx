import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Domain } from '../data';
import { UserProgress } from '../hooks/useLocalProgress';
import {
  AIPreference,
  AIEngineUsed,
  fetchAIStatus,
  ProvidersSnapshot,
  recheckAIProviders,
  requestRoleplayTurn,
  RoleplayCorrection,
  StoredSituation,
} from '../utils/aiClient';
import {
  isSpeechRecognitionSupported,
  speakEnglish,
  startListening,
  stopSpeaking,
} from '../utils/speech';
import { VoiceWave } from './VoiceWave';

type AIConversationViewProps = {
  situations: StoredSituation[];
  progress: UserProgress;
  aiPreference: AIPreference;
  onChangePreference: (pref: AIPreference) => void;
  onToggleMasteredSituation: (id: number) => void;
  onOpenKnowledgeLoader: (topic?: string) => void;
};

type ChatMessage = {
  id: string;
  sender: 'ai' | 'user';
  textEn: string;
  textVn?: string;
  correction?: RoleplayCorrection | null;
  engine?: AIEngineUsed;
};

function engineName(engine: AIEngineUsed): string {
  if (engine === 'dual') return 'Gemini + Meta AI';
  if (engine === 'gemini') return 'Gemini AI';
  if (engine === 'meta') return 'Meta AI';
  return 'Offline';
}

export function AIConversationView({
  situations,
  progress,
  aiPreference,
  onChangePreference,
  onToggleMasteredSituation,
  onOpenKnowledgeLoader,
}: AIConversationViewProps) {
  const [selectedDomain, setSelectedDomain] = useState<'Tất cả' | Domain>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSituationId, setSelectedSituationId] = useState<number>(
    situations[0]?.id ?? 1
  );

  const [inChat, setInChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [suggestedReply, setSuggestedReply] = useState<{ en: string; vn: string } | null>(null);
  const [showSuggestion, setShowSuggestion] = useState<boolean>(false);
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
  const [autoSpeakAI, setAutoSpeakAI] = useState<boolean>(true);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);

  const [inputMode, setInputMode] = useState<'speak' | 'write'>('write');
  const [draftText, setDraftText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [lastEngine, setLastEngine] = useState<AIEngineUsed>('dual');
  const [failoverNote, setFailoverNote] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersSnapshot | null>(null);

  const stopListeningRef = useRef<(() => void) | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const micSupported = isSpeechRecognitionSupported();

  const availableDomains = useMemo(() => {
    return Array.from(new Set(situations.map((s) => s.domain)));
  }, [situations]);

  const filteredSituations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return situations.filter((s) => {
      if (selectedDomain !== 'Tất cả' && s.domain !== selectedDomain) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.where.toLowerCase().includes(q)
      );
    });
  }, [situations, selectedDomain, searchQuery]);

  const activeSituation: StoredSituation = useMemo(() => {
    return situations.find((s) => s.id === selectedSituationId) ?? situations[0];
  }, [situations, selectedSituationId]);

  useEffect(() => {
    fetchAIStatus().then((res) => {
      if (res.providers) setProviders(res.providers);
    });
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (inChat) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, inChat]);

  const startConversation = async () => {
    if (!activeSituation) return;
    stopSpeaking();
    stopListeningRef.current?.();
    setIsListening(false);
    setMessages([]);
    setUsedWords([]);
    setSuggestedReply(null);
    setShowSuggestion(false);
    setShowTranslations({});
    setConversationCompleted(false);
    setFailoverNote(null);
    setDraftText('');
    setInChat(true);
    setIsSending(true);

    const res = await requestRoleplayTurn({
      situation: activeSituation,
      history: [],
      userTurnCount: 0,
      preference: aiPreference,
    });

    setLastEngine(res.engine);
    setFailoverNote(res.failoverNote);
    if (res.providers) setProviders(res.providers);

    const openingMsg: ChatMessage = {
      id: `ai-open-${Date.now()}`,
      sender: 'ai',
      textEn: res.replyEn,
      textVn: res.replyVn,
      engine: res.engine,
    };
    setMessages([openingMsg]);
    if (res.suggestedReplyEn) {
      setSuggestedReply({ en: res.suggestedReplyEn, vn: res.suggestedReplyVn });
    }
    setIsSending(false);

    if (autoSpeakAI) {
      speakEnglish(res.replyEn);
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
      onTranscript: (transcript) => setDraftText(transcript),
      onError: (err) => setMicError(err),
      onEnd: () => setIsListening(false),
    });
  };

  const handleSendMessage = async (overrideText?: string) => {
    const content = (overrideText ?? draftText).trim();
    if (!content || isSending || !activeSituation) return;

    stopSpeaking();
    stopListeningRef.current?.();
    setIsListening(false);
    setShowSuggestion(false);
    setDraftText('');

    const userMsgId = `user-${Date.now()}`;
    const pendingUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      textEn: content,
    };

    const nextHistory = [...messages, pendingUserMsg];
    const userTurnCount = nextHistory.filter((m) => m.sender === 'user').length;
    setMessages(nextHistory);
    setIsSending(true);

    const res = await requestRoleplayTurn({
      situation: activeSituation,
      history: messages.map((m) => ({ sender: m.sender, textEn: m.textEn })),
      userTurnCount,
      userMessage: content,
      inputMode,
      preference: aiPreference,
    });

    setLastEngine(res.engine);
    setFailoverNote(res.failoverNote);
    if (res.providers) setProviders(res.providers);

    if (res.usedTargetWords.length > 0) {
      setUsedWords((prev) => Array.from(new Set([...prev, ...res.usedTargetWords])));
    }

    const aiReplyMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      textEn: res.replyEn,
      textVn: res.replyVn,
      engine: res.engine,
    };

    setMessages((prev) => [
      ...prev.map((m) => (m.id === userMsgId ? { ...m, correction: res.correction } : m)),
      aiReplyMsg,
    ]);

    if (res.suggestedReplyEn) {
      setSuggestedReply({ en: res.suggestedReplyEn, vn: res.suggestedReplyVn });
    }
    if (res.conversationCompleted) {
      setConversationCompleted(true);
    }

    setIsSending(false);
    if (autoSpeakAI) {
      speakEnglish(res.replyEn);
    }
  };

  const handleRecheckAI = async () => {
    const res = await recheckAIProviders();
    if (res.providers) setProviders(res.providers);
  };

  if (!inChat && activeSituation) {
    return (
      <div className="space-y-6">
        <div className="surface-card rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-indigo-600">
              Hội thoại nhập vai trực tiếp · Sửa lỗi bám sát câu của bạn
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Nói chuyện trực tiếp với AI
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-2">
              <Cpu className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <select
                aria-label="Chọn nền tảng AI cho hội thoại"
                value={aiPreference}
                onChange={(e) => onChangePreference(e.target.value as AIPreference)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="parallel">Song song (Gemini + Meta AI)</option>
                <option value="auto">Tự động (Gemini ↔ Meta AI)</option>
                <option value="gemini">Ưu tiên Gemini AI</option>
                <option value="meta">Ưu tiên Meta AI</option>
                <option value="offline">Chỉ Offline</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenKnowledgeLoader(selectedDomain === 'Tất cả' ? '' : selectedDomain)
              }
              className="min-h-[38px] px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Load thêm chủ đề mới</span>
            </button>

            {providers &&
              (providers.gemini.status === 'exhausted' || providers.meta.status === 'exhausted') && (
                <button
                  type="button"
                  onClick={handleRecheckAI}
                  className="min-h-[38px] px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-amber-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kiểm tra lại AI</span>
                </button>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 surface-card rounded-3xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Chọn tình huống nhập vai ({filteredSituations.length})
              </h2>
              <div className="relative sm:w-56">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tình huống..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedDomain('Tất cả')}
                className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
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
                  onClick={() => setSelectedDomain(d)}
                  className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                    selectedDomain === d
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
              {filteredSituations.map((sit) => {
                const isSelected = sit.id === activeSituation.id;
                const isDone = progress.masteredSituationIds.includes(sit.id);
                return (
                  <button
                    key={sit.id}
                    type="button"
                    onClick={() => setSelectedSituationId(sit.id)}
                    className={`w-full text-left rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-400 shadow-xs'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                        <span className="font-mono text-indigo-600 mr-1.5">{sit.id}.</span>
                        {sit.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sit.domain} · {sit.dialogue.length} lượt · Vai AI: {sit.withWho}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isDone && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      )}
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
            <div className="hero-navy rounded-3xl p-5 sm:p-6 space-y-5 text-white">
              <div>
                <p className="text-xs font-medium text-amber-300">
                  Chủ đề đang chọn · {activeSituation.where}
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1 text-balance">
                  {activeSituation.id}. {activeSituation.title}
                </h2>
                <p className="text-sm text-blue-100/90 mt-1.5">{activeSituation.goal}</p>
              </div>

              {activeSituation.targetWords.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-white/15">
                  <p className="text-xs font-semibold text-blue-200">
                    Từ mục tiêu gợi ý (bấm để nghe phát âm)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeSituation.targetWords.map((w) => (
                      <button
                        key={w.en}
                        type="button"
                        onClick={() => speakEnglish(w.en)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-white/12 border border-white/15 text-white text-xs font-semibold hover:bg-white/22 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                        <span>
                          {w.en} — {w.vn}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={startConversation}
                className="w-full min-h-[52px] px-6 py-3 rounded-2xl bg-amber-400 text-slate-950 text-base font-bold shadow-md shadow-amber-950/20 hover:bg-amber-300 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
              >
                <Bot className="w-5 h-5" aria-hidden="true" />
                <span>Bắt đầu nói chuyện</span>
              </button>
            </div>

            <div className="surface-card rounded-3xl p-5 space-y-2">
              <p className="text-xs font-bold text-indigo-700">
                Sửa lỗi thông minh trên chính câu của bạn:
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Bạn tự do diễn đạt không cần theo khuôn mẫu. Ví dụ bạn nói:{' '}
                <span className="font-medium text-rose-700">“I cleaning street now”</span> → AI giữ
                nguyên khung câu bạn dùng và chỉnh thành:{' '}
                <span className="font-semibold text-emerald-700">
                  “I am cleaning the street now.”
                </span>
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nhờ sửa trực tiếp trên nền câu bạn tự nghĩ, bạn sẽ nhớ rất lâu và phản xạ tự nhiên hơn.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeSituation) return null;
  const isSituationMastered = progress.masteredSituationIds.includes(activeSituation.id);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Studio Chat Header */}
      <div className="hero-navy rounded-3xl p-4 sm:p-5 space-y-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              stopListeningRef.current?.();
              setIsListening(false);
              setInChat(false);
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-white/12 border border-white/15 text-white text-xs sm:text-sm font-semibold hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Đổi tình huống</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/12 border border-white/15 text-blue-100 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>{engineName(lastEngine)}</span>
            </span>

            <button
              type="button"
              onClick={() => setAutoSpeakAI((prev) => !prev)}
              aria-label={autoSpeakAI ? 'Tắt tự động đọc câu AI' : 'Bật tự động đọc câu AI'}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                autoSpeakAI
                  ? 'bg-white text-[#071f4f] border-white'
                  : 'bg-white/12 text-blue-100 border-white/15 hover:bg-white/20'
              }`}
            >
              {autoSpeakAI ? (
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Tự đọc AI</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white">
              {activeSituation.title}
            </h1>
            <p className="text-xs text-blue-200">
              AI đang đóng vai <strong className="text-white">{activeSituation.withWho}</strong> tại{' '}
              {activeSituation.where}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleMasteredSituation(activeSituation.id)}
            className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              isSituationMastered
                ? 'bg-emerald-500 text-white'
                : 'bg-white/14 border border-white/20 text-white hover:bg-white/22'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isSituationMastered ? 'Đã thuộc' : 'Đánh dấu hoàn thành'}</span>
          </button>
        </div>

        {activeSituation.targetWords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-white/15">
            <span className="text-xs text-blue-200 mr-1">Từ gợi ý (tùy chọn):</span>
            {activeSituation.targetWords.map((w) => {
              const isUsed = usedWords.some((u) => u.toLowerCase() === w.en.toLowerCase());
              return (
                <button
                  key={w.en}
                  type="button"
                  onClick={() => speakEnglish(w.en)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isUsed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/12 text-blue-100 hover:bg-white/22'
                  }`}
                >
                  {isUsed && <Check className="w-3 h-3" aria-hidden="true" />}
                  <span>{w.en}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {failoverNote && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-2.5 text-xs">
          {failoverNote}
        </div>
      )}

      {/* Chat Stream */}
      <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-4 min-h-[350px] max-h-[54vh] overflow-y-auto">
        {messages.map((msg) => {
          const isAI = msg.sender === 'ai';
          const showVn = Boolean(showTranslations[msg.id]);

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className={`flex flex-col ${isAI ? 'items-start' : 'items-end'} space-y-2`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 py-3 space-y-1.5 ${
                  isAI
                    ? 'bg-slate-100 text-slate-900 rounded-tl-md'
                    : 'bg-[#071f4f] text-white rounded-tr-md shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[11px] font-semibold ${
                      isAI ? 'text-indigo-700' : 'text-amber-300'
                    }`}
                  >
                    {isAI ? activeSituation.withWho : 'Bạn'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => speakEnglish(msg.textEn)}
                      aria-label="Nghe tin nhắn"
                      className={`p-1 rounded-lg transition-colors ${
                        isAI
                          ? 'text-slate-600 hover:bg-white'
                          : 'text-blue-100 hover:bg-white/15'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    {isAI && msg.textVn && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowTranslations((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="text-[11px] font-medium text-slate-600 hover:text-indigo-700 px-1.5 py-0.5 rounded-md hover:bg-white"
                      >
                        {showVn ? 'Ẩn dịch' : 'Dịch'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm sm:text-base font-medium leading-relaxed">{msg.textEn}</p>

                {isAI && showVn && msg.textVn && (
                  <p className="text-xs sm:text-sm text-slate-600 pt-1.5 border-t border-slate-200/80">
                    {msg.textVn}
                  </p>
                )}
              </div>

              {!isAI && msg.correction && (
                <div
                  className={`max-w-[92%] sm:max-w-[80%] rounded-2xl border p-3.5 text-xs sm:text-sm space-y-1.5 ${
                    msg.correction.isCorrect
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/85 border-amber-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-bold ${
                        msg.correction.isCorrect ? 'text-emerald-700' : 'text-amber-800'
                      }`}
                    >
                      {msg.correction.isCorrect ? 'Chuẩn tự nhiên' : 'Chỉnh trên chính câu của bạn'} ·{' '}
                      <span className="font-mono tabular-nums">{msg.correction.score}/100</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => speakEnglish(msg.correction!.correctedEn)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Nghe câu chuẩn</span>
                    </button>
                  </div>

                  {!msg.correction.isCorrect && (
                    <p className="text-emerald-800 font-semibold">
                      Đúng là: “{msg.correction.correctedEn}”
                    </p>
                  )}

                  <p className="text-slate-700 leading-relaxed">
                    <span className="font-semibold">Lý do: </span>
                    {msg.correction.reasonVn}
                  </p>

                  {msg.correction.betterNativeEn && (
                    <p className="text-indigo-800 text-xs">
                      <span className="font-semibold">Mở rộng từ câu bạn: </span>“
                      {msg.correction.betterNativeEn}”
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" aria-hidden="true" />
            <span>AI đang phân tích và phản hồi...</span>
          </div>
        )}

        {conversationCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Bạn đã hoàn thành tốt mục tiêu tình huống này!
              </p>
              <p className="text-xs text-emerald-700">
                Bạn có thể tiếp tục trò chuyện hoặc đánh dấu đã thuộc tình huống.
              </p>
            </div>
            {!isSituationMastered && (
              <button
                type="button"
                onClick={() => onToggleMasteredSituation(activeSituation.id)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                Lưu hoàn thành
              </button>
            )}
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Composer */}
      <div className="surface-card rounded-3xl p-4 space-y-3">
        {suggestedReply && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowSuggestion((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <span>{showSuggestion ? 'Ẩn gợi ý trả lời' : 'Bí ý? Xem gợi ý tham khảo'}</span>
              </button>

              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setInputMode('speak')}
                  className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 ${
                    inputMode === 'speak' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Mic className="w-3 h-3" aria-hidden="true" />
                  <span>Nói</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopListeningRef.current?.();
                    setIsListening(false);
                    setInputMode('write');
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 ${
                    inputMode === 'write' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" aria-hidden="true" />
                  <span>Viết</span>
                </button>
              </div>
            </div>

            {showSuggestion && (
              <div className="bg-indigo-50/70 border border-indigo-200/70 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{suggestedReply.en}</p>
                  <p className="text-xs text-slate-600">{suggestedReply.vn}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakEnglish(suggestedReply.en)}
                    aria-label="Nghe câu gợi ý"
                    className="min-h-[36px] min-w-[36px] rounded-xl bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftText(suggestedReply.en)}
                    className="min-h-[36px] px-3 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    Dùng câu này
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {micError && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {micError}
          </p>
        )}

        <div className="flex items-end gap-2">
          {micSupported && (
            <button
              type="button"
              onClick={handleToggleMic}
              aria-label={isListening ? 'Dừng nói' : 'Nói bằng micro'}
              className={`min-h-[48px] px-3.5 rounded-2xl flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
                isListening
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" aria-hidden="true" />
                  <VoiceWave tone="light" />
                </>
              ) : (
                <Mic className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}

          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              isListening
                ? 'Đang nghe giọng nói tiếng Anh của bạn...'
                : 'Nói hoặc gõ theo ý của riêng bạn...'
            }
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!draftText.trim() || isSending}
            aria-label="Gửi câu trả lời"
            className="min-h-[48px] px-4 sm:px-5 rounded-2xl bg-[#071f4f] text-white text-sm font-semibold hover:bg-[#0f2f73] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>
            Bạn tự do diễn đạt — AI sẽ giữ nguyên khung câu của bạn và chỉ chỉnh chỗ cần chuẩn hơn.
          </span>
          <button
            type="button"
            onClick={startConversation}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold shrink-0 ml-2"
          >
            <Eye className="w-3 h-3" aria-hidden="true" />
            <span>Bắt đầu lại</span>
          </button>
        </div>
      </div>
    </div>
  );
}
