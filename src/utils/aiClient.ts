import type { Situation } from '../data';

export type AIProviderId = 'gemini' | 'meta';
export type AIPreference = 'parallel' | 'auto' | 'gemini' | 'meta' | 'offline';
export type AIEngineUsed = 'gemini' | 'meta' | 'dual' | 'offline';

export type ProviderStatusInfo = {
  configured: boolean;
  status: 'ready' | 'exhausted' | 'error' | 'unconfigured';
  cooldownUntil: number | null;
  lastError: string | null;
};

export type ProvidersSnapshot = {
  gemini: ProviderStatusInfo;
  meta: ProviderStatusInfo;
};

export type SupabaseStatusInfo = {
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  permissionDenied?: boolean;
  keyRole?: 'service_role' | 'anon' | 'unknown' | null;
  urlMasked: string | null;
  message: string;
};

export type KnowledgeItem = {
  id: string;
  topic: string;
  phraseEn: string;
  meaningVn: string;
  usageNoteVn: string;
  exampleEn: string;
  exampleVn: string;
  sourceEngine: 'gemini' | 'meta' | 'dual' | 'manual';
  createdAt: string;
};

export type StoredSituation = Situation & {
  source?: 'builtin' | 'imported' | 'ai_generated';
  hidden?: boolean;
  createdAt?: string;
};

export type EvaluationResult = {
  engine: AIEngineUsed;
  score: number;
  verdict: string;
  userAnswer: string;
  correctedEn: string;
  naturalAlternative: string;
  feedbackVn: string;
  grammarNotes: string[];
  practiceTip: string;
  dualInsight?: string | null;
  failoverNote: string | null;
  providers?: ProvidersSnapshot;
};

export type RoleplayCorrection = {
  isCorrect: boolean;
  score: number;
  correctedEn: string;
  reasonVn: string;
  betterNativeEn: string;
};

export type RoleplayResult = {
  engine: AIEngineUsed;
  correction: RoleplayCorrection | null;
  usedTargetWords: string[];
  replyEn: string;
  replyVn: string;
  suggestedReplyEn: string;
  suggestedReplyVn: string;
  conversationCompleted: boolean;
  failoverNote: string | null;
  providers?: ProvidersSnapshot;
};

const PREF_STORAGE_KEY = 'anh_van_phan_xa_ai_pref_v2';

export function getStoredAIPreference(): AIPreference {
  try {
    const val = localStorage.getItem(PREF_STORAGE_KEY);
    if (
      val === 'parallel' ||
      val === 'auto' ||
      val === 'gemini' ||
      val === 'meta' ||
      val === 'offline'
    ) {
      return val;
    }
  } catch {
    // Ignore storage error
  }
  return 'parallel';
}

export function saveStoredAIPreference(pref: AIPreference): void {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, pref);
  } catch {
    // Ignore storage error
  }
}

export async function fetchAIStatus(): Promise<{
  providers: ProvidersSnapshot | null;
  supabase: SupabaseStatusInfo | null;
}> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return { providers: null, supabase: null };
    const data = (await res.json()) as {
      providers?: ProvidersSnapshot;
      supabase?: SupabaseStatusInfo;
    };
    return {
      providers: data.providers ?? null,
      supabase: data.supabase ?? null,
    };
  } catch {
    return { providers: null, supabase: null };
  }
}

export async function recheckAIProviders(): Promise<{
  providers: ProvidersSnapshot | null;
  supabase: SupabaseStatusInfo | null;
}> {
  try {
    const res = await fetch('/api/ai/recheck', { method: 'POST' });
    if (!res.ok) return { providers: null, supabase: null };
    const data = (await res.json()) as {
      providers?: ProvidersSnapshot;
      supabase?: SupabaseStatusInfo;
    };
    return {
      providers: data.providers ?? null,
      supabase: data.supabase ?? null,
    };
  } catch {
    return { providers: null, supabase: null };
  }
}

export async function fetchLiveSituations(): Promise<StoredSituation[] | null> {
  try {
    const res = await fetch('/api/situations');
    if (!res.ok) return null;
    const data = (await res.json()) as { situations?: StoredSituation[] };
    return Array.isArray(data.situations) ? data.situations : null;
  } catch {
    return null;
  }
}

export async function fetchLiveKnowledge(): Promise<KnowledgeItem[] | null> {
  try {
    const res = await fetch('/api/knowledge');
    if (!res.ok) return null;
    const data = (await res.json()) as { knowledge?: KnowledgeItem[] };
    return Array.isArray(data.knowledge) ? data.knowledge : null;
  } catch {
    return null;
  }
}

export async function loadMoreKnowledgeWithAI(params: {
  topic: string;
  mode?: 'situations' | 'knowledge' | 'both';
  count?: number;
  preference: AIPreference;
}): Promise<{
  ok: boolean;
  engine?: AIEngineUsed;
  addedSituations: StoredSituation[];
  addedKnowledge: KnowledgeItem[];
  syncedToSupabase?: boolean;
  failoverNote?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch('/api/knowledge/load-more', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as {
      engine?: AIEngineUsed;
      addedSituations?: StoredSituation[];
      addedKnowledge?: KnowledgeItem[];
      syncedToSupabase?: boolean;
      failoverNote?: string | null;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        addedSituations: [],
        addedKnowledge: [],
        error: data.error || 'Không thể tải thêm kiến thức lúc này.',
      };
    }
    return {
      ok: true,
      engine: data.engine,
      addedSituations: data.addedSituations ?? [],
      addedKnowledge: data.addedKnowledge ?? [],
      syncedToSupabase: data.syncedToSupabase,
      failoverNote: data.failoverNote,
    };
  } catch {
    return {
      ok: false,
      addedSituations: [],
      addedKnowledge: [],
      error: 'Không kết nối được tới máy chủ AI.',
    };
  }
}

// Admin API clients (token kept strictly in React memory)
export async function adminLogin(passcode: string): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !data.token) {
      return { ok: false, error: data.error || 'Đăng nhập thất bại.' };
    }
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export type IntegrationStatusSnapshot = {
  gemini: {
    configured: boolean;
    masked: string | null;
    source: 'admin' | 'env' | 'none';
  };
  meta: {
    configured: boolean;
    masked: string | null;
    baseUrl: string;
    model: string;
    source: 'admin' | 'env' | 'none';
  };
  supabase: {
    configured: boolean;
    urlMasked: string | null;
    keyMasked: string | null;
    source: 'admin' | 'env' | 'none';
  };
};

export async function adminFetchOverview(token: string): Promise<{
  ok: boolean;
  situations?: StoredSituation[];
  knowledge?: KnowledgeItem[];
  supabase?: SupabaseStatusInfo;
  supabaseSchemaSql?: string;
  providers?: ProvidersSnapshot;
  integrations?: IntegrationStatusSnapshot;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Lỗi tải dữ liệu quản trị' };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export async function adminSaveIntegrations(
  token: string,
  payload: {
    geminiApiKey?: string;
    metaApiKey?: string;
    metaBaseUrl?: string;
    metaModel?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    clearGemini?: boolean;
    clearMeta?: boolean;
    clearSupabase?: boolean;
  }
): Promise<{
  ok: boolean;
  providers?: ProvidersSnapshot;
  supabase?: SupabaseStatusInfo;
  integrations?: IntegrationStatusSnapshot;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/integrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Lưu cấu hình thất bại.' };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export async function adminImportData(
  token: string,
  payload:
    | { mode: 'json'; items: unknown[] }
    | { mode: 'raw_text'; rawText: string; defaultDomain: string; preference: AIPreference }
): Promise<{
  ok: boolean;
  savedCount?: number;
  syncedToSupabase?: boolean;
  engine?: AIEngineUsed;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Import thất bại.' };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export async function adminSaveSituation(
  token: string,
  situation: StoredSituation
): Promise<{ ok: boolean; syncedToSupabase?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/situations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ situation }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Lưu thất bại.' };
    return { ok: true, syncedToSupabase: data.syncedToSupabase };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export async function adminDeleteSituation(
  token: string,
  id: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/situations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Xóa thất bại.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ.' };
  }
}

export async function adminSyncSupabase(token: string): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const res = await fetch('/api/admin/supabase/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    return {
      ok: Boolean(res.ok && data.ok),
      message: data.message || 'Hoàn tất kiểm tra đồng bộ.',
    };
  } catch {
    return { ok: false, message: 'Không thể kết nối tới máy chủ.' };
  }
}

function normalizeContractions(text: string): string {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\byou're\b/g, 'you are')
    .replace(/\bwe're\b/g, 'we are')
    .replace(/\bthey're\b/g, 'they are')
    .replace(/\bhe's\b/g, 'he is')
    .replace(/\bshe's\b/g, 'she is')
    .replace(/\bit's\b/g, 'it is')
    .replace(/\blet's\b/g, 'let us')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bdoesn't\b/g, 'does not')
    .replace(/\bdidn't\b/g, 'did not')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bi'll\b/g, 'i will')
    .replace(/\bi've\b/g, 'i have')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCommonGrammarIssues(userRaw: string): {
  notes: string[];
  autoFix: string;
} {
  const notes: string[] = [];
  let fixed = userRaw.trim();

  if (/\bI\s+[a-z]+ing\b/i.test(fixed) && !/\bI\s+(am|'m|was)\s+[a-z]+ing\b/i.test(fixed)) {
    notes.push('Thiếu động từ to-be "am" trước động từ đuôi -ing (thì hiện tại tiếp diễn).');
    fixed = fixed.replace(/\b(I)\s+([a-z]+ing)\b/i, 'I am $2');
  }
  if (/\b(he|she|it)\s+[a-z]+ing\b/i.test(fixed) && !/\b(is|'s|was)\s+[a-z]+ing\b/i.test(fixed)) {
    notes.push('Thiếu "is" sau chủ ngữ ngôi thứ 3 số ít khi dùng -ing.');
    fixed = fixed.replace(/\b(he|she|it)\s+([a-z]+ing)\b/i, '$1 is $2');
  }
  if (/\b(you|we|they)\s+[a-z]+ing\b/i.test(fixed) && !/\b(are|'re|were)\s+[a-z]+ing\b/i.test(fixed)) {
    notes.push('Thiếu "are" sau chủ ngữ số nhiều khi dùng -ing.');
    fixed = fixed.replace(/\b(you|we|they)\s+([a-z]+ing)\b/i, '$1 are $2');
  }

  fixed = fixed.replace(/\bi\b/g, 'I');
  if (fixed.length > 0) {
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    if (!/[.!?]$/.test(fixed)) fixed += '.';
  }

  return { notes, autoFix: fixed };
}

export function evaluateOfflineTranslation(params: {
  expectedEnglish: string;
  userAnswer: string;
  hintWord?: string;
  failoverNote?: string | null;
  providers?: ProvidersSnapshot;
}): EvaluationResult {
  const { expectedEnglish, userAnswer, hintWord, failoverNote, providers } = params;
  const userNorm = normalizeContractions(userAnswer);
  const targetNorm = normalizeContractions(expectedEnglish);

  const userTokens = userNorm.split(' ').filter(Boolean);
  const targetTokens = targetNorm.split(' ').filter(Boolean);
  const targetSet = new Set(targetTokens);
  const userSet = new Set(userTokens);

  let matchedCount = 0;
  for (const t of targetTokens) {
    if (userSet.has(t)) matchedCount += 1;
  }

  const ratio = targetTokens.length > 0 ? matchedCount / targetTokens.length : 0;
  const hasEnglishStructure =
    userTokens.length >= 2 && /[a-z]/i.test(userAnswer) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(userAnswer);

  const { notes, autoFix } = detectCommonGrammarIssues(userAnswer);

  // Respect user's own valid English structure even if it differs from expectedEnglish
  let score = hasEnglishStructure ? Math.max(68, Math.round(ratio * 100)) : Math.round(ratio * 60);
  if (userNorm === targetNorm) score = 100;
  if (notes.length > 0 && score > 82) score = 82;
  score = Math.max(0, Math.min(100, score));

  if (hintWord && !userNorm.includes(normalizeContractions(hintWord))) {
    notes.push(`Bạn có thể thử kết hợp thêm từ khóa "${hintWord}" nếu muốn diễn đạt sát ngữ cảnh hơn.`);
  }
  if (targetSet.size > 0 && ratio < 0.4 && hasEnglishStructure) {
    notes.push('Bạn đang dùng cách diễn đạt riêng. Khi có Gemini/Meta AI, hệ thống sẽ chấm linh hoạt theo đúng ý của bạn.');
  }

  const verdict =
    score >= 90
      ? 'Xuất sắc!'
      : score >= 75
        ? 'Tự nhiên & rõ ý'
        : score >= 55
          ? 'Cần chỉnh nhẹ'
          : 'Thử lại nhé';

  const feedbackVn = hasEnglishStructure
    ? notes.length > 0
      ? 'Bạn giữ được ý chính nhưng có lỗi ngữ pháp nhỏ. Hệ thống đã giữ nguyên khung câu của bạn và sửa đúng chỗ cần chỉnh để bạn dễ nhớ.'
      : 'Cấu trúc câu và vốn từ bạn dùng rất ổn định! Hãy đọc to lại câu của chính bạn để tạo phản xạ tự nhiên.'
    : 'Hãy nhập hoặc nói câu trả lời bằng tiếng Anh để hệ thống phân tích trên chính câu của bạn.';

  return {
    engine: 'offline',
    score,
    verdict,
    userAnswer,
    correctedEn: hasEnglishStructure ? autoFix : expectedEnglish,
    naturalAlternative:
      hasEnglishStructure && userNorm !== targetNorm ? expectedEnglish : '',
    feedbackVn,
    grammarNotes: notes,
    practiceTip:
      'Đọc to lại câu đã hiệu chỉnh 2 lần để ghi nhớ trực tiếp theo vốn từ của chính bạn.',
    failoverNote: failoverNote ?? null,
    providers,
  };
}

export async function requestTranslationEvaluation(params: {
  vietnamesePrompt: string;
  expectedEnglish: string;
  userAnswer: string;
  inputMode: 'speak' | 'write';
  domain?: string;
  where?: string;
  hintWord?: string;
  preference: AIPreference;
}): Promise<EvaluationResult> {
  if (params.preference === 'offline') {
    return evaluateOfflineTranslation({
      expectedEnglish: params.expectedEnglish,
      userAnswer: params.userAnswer,
      hintWord: params.hintWord,
      failoverNote: 'Đang chấm bằng quy tắc Offline theo lựa chọn của bạn.',
    });
  }

  try {
    const res = await fetch('/api/ai/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Partial<EvaluationResult> & {
      engine: AIEngineUsed;
      failoverNote?: string | null;
      providers?: ProvidersSnapshot;
    };

    if (data.engine === 'offline') {
      return evaluateOfflineTranslation({
        expectedEnglish: params.expectedEnglish,
        userAnswer: params.userAnswer,
        hintWord: params.hintWord,
        failoverNote: data.failoverNote,
        providers: data.providers,
      });
    }

    return data as EvaluationResult;
  } catch {
    return evaluateOfflineTranslation({
      expectedEnglish: params.expectedEnglish,
      userAnswer: params.userAnswer,
      hintWord: params.hintWord,
      failoverNote: 'Không kết nối được máy chủ AI -> Đã chuyển sang chấm quy tắc Offline.',
    });
  }
}

export function converseOfflineRoleplay(params: {
  situation: Situation;
  turnCount: number;
  userMessage?: string;
  failoverNote?: string | null;
  providers?: ProvidersSnapshot;
}): RoleplayResult {
  const { situation, turnCount, userMessage, failoverNote, providers } = params;
  const bTurns = situation.dialogue.filter((t) => t.role === 'B');
  const aTurns = situation.dialogue.filter((t) => t.role === 'A');

  const currentExpectedA = aTurns[Math.min(Math.max(0, turnCount - 1), aTurns.length - 1)];
  const nextBTurn = bTurns[Math.min(turnCount, bTurns.length - 1)];
  const nextATurn = aTurns[Math.min(turnCount, aTurns.length - 1)];

  let correction: RoleplayCorrection | null = null;
  const usedTargetWords: string[] = [];

  if (userMessage && userMessage.trim()) {
    const normUser = normalizeContractions(userMessage);
    for (const tw of situation.targetWords) {
      if (normUser.includes(normalizeContractions(tw.en))) {
        usedTargetWords.push(tw.en);
      }
    }

    const { notes, autoFix } = detectCommonGrammarIssues(userMessage);
    const refEn = currentExpectedA?.en ?? situation.dialogue[0]?.en ?? '';
    const hasGrammarFix = notes.length > 0;

    correction = {
      isCorrect: !hasGrammarFix,
      score: hasGrammarFix ? 76 : 90,
      correctedEn: autoFix,
      reasonVn: hasGrammarFix
        ? notes[0]
        : 'Bạn diễn đạt tự nhiên theo cách của riêng mình và đúng ngữ cảnh.',
      betterNativeEn: refEn !== autoFix ? refEn : '',
    };
  }

  const isFollowUpStep = turnCount >= bTurns.length;
  const replyEn = isFollowUpStep
    ? situation.followUp
    : nextBTurn?.en ?? situation.dialogue[0]?.en ?? 'Hello, how can I help you?';
  const replyVn = isFollowUpStep
    ? 'Câu hỏi mở rộng tiếp nối tình huống (chế độ Offline).'
    : nextBTurn?.vn ?? situation.dialogue[0]?.vn ?? '';

  return {
    engine: 'offline',
    correction,
    usedTargetWords,
    replyEn,
    replyVn,
    suggestedReplyEn: nextATurn?.en ?? 'Yes, thank you very much.',
    suggestedReplyVn: nextATurn?.vn ?? 'Vâng, cảm ơn bạn rất nhiều.',
    conversationCompleted: turnCount >= Math.max(2, bTurns.length),
    failoverNote: failoverNote ?? null,
    providers,
  };
}

export async function requestRoleplayTurn(params: {
  situation: Situation;
  history: { sender: 'ai' | 'user'; textEn: string }[];
  userTurnCount: number;
  userMessage?: string;
  inputMode?: 'speak' | 'write';
  preference: AIPreference;
}): Promise<RoleplayResult> {
  if (params.preference === 'offline') {
    return converseOfflineRoleplay({
      situation: params.situation,
      turnCount: params.userTurnCount,
      userMessage: params.userMessage,
      failoverNote: 'Đang hội thoại theo kịch bản Offline thông minh.',
    });
  }

  try {
    const res = await fetch('/api/ai/roleplay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        situationTitle: params.situation.title,
        domain: params.situation.domain,
        where: params.situation.where,
        withWho: params.situation.withWho,
        goal: params.situation.goal,
        targetWords: params.situation.targetWords,
        history: params.history,
        userMessage: params.userMessage,
        inputMode: params.inputMode ?? 'write',
        preference: params.preference,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Partial<RoleplayResult> & {
      engine: AIEngineUsed;
      failoverNote?: string | null;
      providers?: ProvidersSnapshot;
    };

    if (data.engine === 'offline') {
      return converseOfflineRoleplay({
        situation: params.situation,
        turnCount: params.userTurnCount,
        userMessage: params.userMessage,
        failoverNote: data.failoverNote,
        providers: data.providers,
      });
    }

    return data as RoleplayResult;
  } catch {
    return converseOfflineRoleplay({
      situation: params.situation,
      turnCount: params.userTurnCount,
      userMessage: params.userMessage,
      failoverNote: 'Mất kết nối máy chủ -> Đã chuyển sang chế độ Offline.',
    });
  }
}
