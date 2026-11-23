import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { Situation } from '../src/data.ts';
import { getEffectiveSecrets } from './runtimeConfig.ts';
import type { KnowledgeItem, StoredSituation } from './supabaseStore.ts';

export type AIProviderId = 'gemini' | 'meta';
export type AIPreference = 'parallel' | 'auto' | 'gemini' | 'meta' | 'offline';
export type AIEngineUsed = 'gemini' | 'meta' | 'dual' | 'offline';

export type ProviderRuntimeState = {
  configured: boolean;
  status: 'ready' | 'exhausted' | 'error' | 'unconfigured';
  cooldownUntil: number | null;
  lastError: string | null;
};

const COOLDOWN_MS = 3 * 60 * 1000;

const providerStates: Record<AIProviderId, ProviderRuntimeState> = {
  gemini: { configured: false, status: 'unconfigured', cooldownUntil: null, lastError: null },
  meta: { configured: false, status: 'unconfigured', cooldownUntil: null, lastError: null },
};

function getGeminiKey(): string {
  return getEffectiveSecrets().geminiKey;
}

function getMetaKey(): string {
  return getEffectiveSecrets().metaKey;
}

function getMetaBaseUrl(): string {
  return getEffectiveSecrets().metaBaseUrl;
}

function getMetaModel(): string {
  return getEffectiveSecrets().metaModel;
}

function refreshProviderConfigFlags(): void {
  const now = Date.now();
  const hasGemini = Boolean(getGeminiKey());
  const hasMeta = Boolean(getMetaKey());

  if (!hasGemini) {
    providerStates.gemini = {
      configured: false,
      status: 'unconfigured',
      cooldownUntil: null,
      lastError: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
    };
  } else {
    const stillCooling =
      providerStates.gemini.cooldownUntil !== null && providerStates.gemini.cooldownUntil > now;
    providerStates.gemini = {
      configured: true,
      status: stillCooling ? providerStates.gemini.status : 'ready',
      cooldownUntil: stillCooling ? providerStates.gemini.cooldownUntil : null,
      lastError: stillCooling ? providerStates.gemini.lastError : null,
    };
  }

  if (!hasMeta) {
    providerStates.meta = {
      configured: false,
      status: 'unconfigured',
      cooldownUntil: null,
      lastError: 'Chưa cấu hình META_AI_API_KEY trên máy chủ.',
    };
  } else {
    const stillCooling =
      providerStates.meta.cooldownUntil !== null && providerStates.meta.cooldownUntil > now;
    providerStates.meta = {
      configured: true,
      status: stillCooling ? providerStates.meta.status : 'ready',
      cooldownUntil: stillCooling ? providerStates.meta.cooldownUntil : null,
      lastError: stillCooling ? providerStates.meta.lastError : null,
    };
  }
}

export function getProviderStatusSnapshot() {
  refreshProviderConfigFlags();
  return {
    gemini: { ...providerStates.gemini },
    meta: { ...providerStates.meta },
  };
}

export function resetProviderCooldowns() {
  providerStates.gemini.cooldownUntil = null;
  providerStates.gemini.lastError = null;
  providerStates.meta.cooldownUntil = null;
  providerStates.meta.lastError = null;
  refreshProviderConfigFlags();
  return getProviderStatusSnapshot();
}

function isQuotaOrTokenError(errMessage: string, statusCode?: number): boolean {
  if (statusCode === 429 || statusCode === 402) return true;
  return /429|resource_exhausted|quota|token|rate[_ ]?limit|insufficient|credit|exceeded/i.test(
    errMessage
  );
}

function markProviderFailure(provider: AIProviderId, errorMsg: string, statusCode?: number) {
  const exhausted = isQuotaOrTokenError(errorMsg, statusCode);
  providerStates[provider] = {
    configured: true,
    status: exhausted ? 'exhausted' : 'error',
    cooldownUntil: Date.now() + COOLDOWN_MS,
    lastError: exhausted
      ? `${provider === 'gemini' ? 'Gemini' : 'Meta AI'} đã hết token/quota tạm thời.`
      : `${provider === 'gemini' ? 'Gemini' : 'Meta AI'} gặp sự cố kết nối (${errorMsg.slice(0, 80)}).`,
  };
}

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getGeminiKey(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const slice =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(slice) as Record<string, unknown>;
}

async function callMetaJson(
  systemInstruction: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);

  try {
    const response = await fetch(`${getMetaBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getMetaKey()}`,
      },
      body: JSON.stringify({
        model: getMetaModel(),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const error = new Error(`HTTP ${response.status}: ${errText}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '{}';
    return extractJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiJson(
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
    },
  });
  return extractJsonObject(response.text ?? '{}');
}

function isProviderCallable(provider: AIProviderId): { ok: boolean; reason?: string } {
  const state = providerStates[provider];
  if (!state.configured) {
    return { ok: false, reason: `${provider === 'gemini' ? 'Gemini' : 'Meta AI'} chưa cấu hình` };
  }
  if (state.status === 'exhausted' || state.status === 'error') {
    return { ok: false, reason: state.lastError || `${provider} tạm ngưng` };
  }
  return { ok: true };
}

async function runSingleProvider(
  provider: AIProviderId,
  systemInstruction: string,
  userPrompt: string,
  geminiSchema?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    if (provider === 'gemini') {
      return await callGeminiJson(systemInstruction, userPrompt, geminiSchema);
    }
    return await callMetaJson(systemInstruction, userPrompt);
  } catch (err) {
    const e = err as Error & { status?: number };
    const msg = e?.message || 'Unknown error';
    markProviderFailure(provider, msg, e?.status);
    throw err;
  }
}

async function executeWithDualStrategy(
  preference: AIPreference,
  systemInstruction: string,
  userPrompt: string,
  geminiSchema?: Record<string, unknown>
): Promise<
  | { ok: true; engine: 'gemini' | 'meta' | 'dual'; primary: Record<string, unknown>; secondary?: Record<string, unknown>; failoverNote: string | null }
  | { ok: false; failoverNote: string }
> {
  refreshProviderConfigFlags();
  if (preference === 'offline') {
    return { ok: false, failoverNote: 'Đang dùng chế độ Offline theo lựa chọn của bạn.' };
  }

  const notes: string[] = [];

  if (preference === 'parallel') {
    const gCheck = isProviderCallable('gemini');
    const mCheck = isProviderCallable('meta');
    const activeProviders: AIProviderId[] = [];
    if (gCheck.ok) activeProviders.push('gemini');
    else if (gCheck.reason) notes.push(gCheck.reason);
    if (mCheck.ok) activeProviders.push('meta');
    else if (mCheck.reason) notes.push(mCheck.reason);

    if (activeProviders.length === 2) {
      const [gRes, mRes] = await Promise.allSettled([
        runSingleProvider('gemini', systemInstruction, userPrompt, geminiSchema),
        runSingleProvider('meta', systemInstruction, userPrompt),
      ]);

      if (gRes.status === 'fulfilled' && mRes.status === 'fulfilled') {
        return {
          ok: true,
          engine: 'dual',
          primary: gRes.value,
          secondary: mRes.value,
          failoverNote: null,
        };
      }
      if (gRes.status === 'fulfilled') {
        return {
          ok: true,
          engine: 'gemini',
          primary: gRes.value,
          failoverNote: 'Meta AI gặp lỗi/hết token -> Dùng kết quả từ Gemini AI.',
        };
      }
      if (mRes.status === 'fulfilled') {
        return {
          ok: true,
          engine: 'meta',
          primary: mRes.value,
          failoverNote: 'Gemini gặp lỗi/hết token -> Dùng kết quả từ Meta AI.',
        };
      }
      return {
        ok: false,
        failoverNote:
          'Cả Gemini và Meta AI đều hết token hoặc gặp lỗi kết nối -> Đã chuyển sang Offline.',
      };
    }
  }

  const ordered: AIProviderId[] =
    preference === 'meta' ? ['meta', 'gemini'] : ['gemini', 'meta'];

  for (const provider of ordered) {
    const check = isProviderCallable(provider);
    if (!check.ok) {
      if (check.reason) notes.push(check.reason);
      continue;
    }

    try {
      const data = await runSingleProvider(provider, systemInstruction, userPrompt, geminiSchema);
      return {
        ok: true,
        engine: provider,
        primary: data,
        failoverNote:
          notes.length > 0
            ? `${notes.join(' -> ')} -> Đã tự động chuyển sang ${provider === 'gemini' ? 'Gemini AI' : 'Meta AI'}`
            : null,
      };
    } catch {
      notes.push(
        providerStates[provider].lastError ||
          `${provider === 'gemini' ? 'Gemini' : 'Meta AI'} tạm ngưng`
      );
    }
  }

  return {
    ok: false,
    failoverNote:
      notes.length > 0
        ? `${notes.join(' | ')} -> Đã chuyển sang chế độ Offline.`
        : 'Chưa kết nối Gemini/Meta AI -> Đang dùng chế độ Offline.',
  };
}

export type EvaluationInput = {
  vietnamesePrompt: string;
  expectedEnglish: string;
  userAnswer: string;
  inputMode: 'speak' | 'write';
  domain?: string;
  where?: string;
  hintWord?: string;
  preference?: AIPreference;
};

export type EvaluationOutput = {
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
  providers: ReturnType<typeof getProviderStatusSnapshot>;
};

export async function evaluateTranslationWithAI(
  input: EvaluationInput
): Promise<
  | EvaluationOutput
  | { engine: 'offline'; failoverNote: string; providers: ReturnType<typeof getProviderStatusSnapshot> }
> {
  const preference = input.preference ?? 'parallel';

  const systemInstruction = `Bạn là huấn luyện viên phản xạ tiếng Anh cá nhân hóa cho người Việt.
NGUYÊN TẮC VÀNG (RẤT QUAN TRỌNG):
1. KHÔNG ÉP RẬP KHUÔN: Câu tham khảo chỉ dùng để hiểu ngữ cảnh, TUYỆT ĐỐI KHÔNG bắt học viên phải viết/nói giống hệt câu tham khảo nếu cách diễn đạt của họ đã đúng ý và tự nhiên!
2. PHÁT TRIỂN TRÊN CHÍNH NỀN TẢNG CỦA NGƯỜI HỌC: Hãy giữ nguyên cấu trúc câu và vốn từ vựng mà học viên vừa nhập. Chỉ chỉnh sửa tối thiểu đúng những chỗ sai ngữ pháp, sai thì, thiếu trợ động từ/mạo từ/giới từ hoặc dùng từ chưa tự nhiên — ngay trên chính khung câu của họ để họ dễ nhớ và dễ học nhất!
3. Nếu học viên diễn đạt đúng ý bằng từ vựng và cấu trúc riêng của họ (ví dụ: dùng từ đồng nghĩa, rút gọn tự nhiên, đổi trật tự ý hợp lý), hãy chấm 88-100 điểm và khen rõ điểm mạnh trong cách diễn đạt của họ.
4. Gợi ý "naturalAlternative" cũng phải phát triển từ chính ý/cấu trúc của học viên (nâng cấp nhẹ nhàng lên văn phong bản xứ), không thay bằng một câu hoàn toàn xa lạ trừ khi câu gốc quá sai hoặc dùng tiếng Việt.`;

  const userPrompt = `Ngữ cảnh: ${input.domain || 'Giao tiếp thực tế'} (${input.where || 'Đời sống'})
Ý tiếng Việt cần diễn đạt: "${input.vietnamesePrompt}"
(Chỉ tham khảo thêm, không bắt buộc giống: "${input.expectedEnglish}")
Từ gợi ý nếu có: "${input.hintWord || ''}"
Hình thức trả lời: ${input.inputMode === 'speak' ? 'Nói qua micro' : 'Viết'}
Câu học viên tự tạo: "${input.userAnswer}"

Hãy trả về JSON:
{
  "score": number (0-100),
  "verdict": string ("Xuất sắc!", "Tự nhiên & đúng ý", "Cần chỉnh nhẹ", "Thử lại nhé"),
  "correctedEn": string (sửa trực tiếp trên nền cấu trúc & từ vựng của học viên sao cho chuẩn ngữ pháp nhất),
  "naturalAlternative": string (1 biến thể tự nhiên hơn phát triển từ chính cấu trúc học viên vừa dùng, hoặc "" nếu câu học viên đã rất tự nhiên),
  "feedbackVn": string (nhận xét chi tiết bằng tiếng Việt: khen phần học viên làm tốt + giải thích rõ vì sao chỉnh ở điểm nào),
  "grammarNotes": string[] (0-3 lưu ý cụ thể bám sát câu học viên vừa nhập),
  "practiceTip": string (1 mẹo ghi nhớ nhanh gắn trực tiếp với từ vựng học viên vừa dùng)
}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER },
      verdict: { type: Type.STRING },
      correctedEn: { type: Type.STRING },
      naturalAlternative: { type: Type.STRING },
      feedbackVn: { type: Type.STRING },
      grammarNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      practiceTip: { type: Type.STRING },
    },
    required: [
      'score',
      'verdict',
      'correctedEn',
      'naturalAlternative',
      'feedbackVn',
      'grammarNotes',
      'practiceTip',
    ],
  };

  const res = await executeWithDualStrategy(preference, systemInstruction, userPrompt, schema);
  if (!res.ok) {
    return {
      engine: 'offline',
      failoverNote: res.failoverNote,
      providers: getProviderStatusSnapshot(),
    };
  }

  const parsed = res.primary;
  const secondary = res.secondary;
  const rawScore = Number(parsed.score);
  const secScore = secondary ? Number(secondary.score) : NaN;
  const score =
    Number.isFinite(rawScore) && Number.isFinite(secScore)
      ? Math.max(0, Math.min(100, Math.round((rawScore + secScore) / 2)))
      : Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : 80;

  const secondaryAlt = secondary?.correctedEn ? String(secondary.correctedEn) : '';
  const primaryAlt = String(parsed.naturalAlternative || '');
  const dualInsight =
    secondary && secondaryAlt && secondaryAlt.toLowerCase() !== String(parsed.correctedEn || '').toLowerCase()
      ? `Góc nhìn Meta AI: "${secondaryAlt}" — ${String(secondary.feedbackVn || '')}`
      : secondary && secondary.practiceTip
        ? `Mẹo bổ sung từ Meta AI: ${String(secondary.practiceTip)}`
        : null;

  return {
    engine: res.engine,
    score,
    verdict: String(
      parsed.verdict || (score >= 85 ? 'Xuất sắc!' : score >= 65 ? 'Khá tự nhiên' : 'Cần chỉnh nhẹ')
    ),
    userAnswer: input.userAnswer,
    correctedEn: String(parsed.correctedEn || input.expectedEnglish),
    naturalAlternative: primaryAlt,
    feedbackVn: String(parsed.feedbackVn || 'Bạn đã truyền đạt rõ ý theo cách riêng của mình.'),
    grammarNotes: Array.isArray(parsed.grammarNotes)
      ? parsed.grammarNotes.map((g) => String(g)).slice(0, 4)
      : [],
    practiceTip: String(parsed.practiceTip || 'Đọc to lại chính câu đã chỉnh của bạn 2 lần để nhớ lâu.'),
    dualInsight,
    failoverNote: res.failoverNote,
    providers: getProviderStatusSnapshot(),
  };
}

export type RoleplayHistoryTurn = {
  sender: 'ai' | 'user';
  textEn: string;
};

export type RoleplayInput = {
  situationTitle: string;
  domain: string;
  where: string;
  withWho: string;
  goal: string;
  targetWords: { en: string; vn: string }[];
  history: RoleplayHistoryTurn[];
  userMessage?: string;
  inputMode?: 'speak' | 'write';
  preference?: AIPreference;
};

export type RoleplayOutput = {
  engine: AIEngineUsed;
  correction: {
    isCorrect: boolean;
    score: number;
    correctedEn: string;
    reasonVn: string;
    betterNativeEn: string;
  } | null;
  usedTargetWords: string[];
  replyEn: string;
  replyVn: string;
  suggestedReplyEn: string;
  suggestedReplyVn: string;
  conversationCompleted: boolean;
  failoverNote: string | null;
  providers: ReturnType<typeof getProviderStatusSnapshot>;
};

export async function converseRoleplayWithAI(
  input: RoleplayInput
): Promise<
  | RoleplayOutput
  | { engine: 'offline'; failoverNote: string; providers: ReturnType<typeof getProviderStatusSnapshot> }
> {
  const preference = input.preference ?? 'parallel';
  const targetWordsText = input.targetWords.map((w) => `${w.en} (${w.vn})`).join(', ');
  const isOpening = !input.userMessage || input.userMessage.trim() === '';

  const systemInstruction = `Bạn là bạn diễn AI (đóng vai "${input.withWho}") kiêm gia sư tiếng Anh thích ứng theo năng lực học viên Việt Nam.
Tình huống: "${input.situationTitle}" tại "${input.where}" (Chủ đề: ${input.domain}).
Mục tiêu giao tiếp: ${input.goal}.
Từ mục tiêu khuyến khích dùng: ${targetWordsText}.

NGUYÊN TẮC PHẢN HỒI THÔNG MINH:
1. Luôn giữ mạch hội thoại tự nhiên (1-2 câu tiếng Anh) đúng vai "${input.withWho}", phản hồi trực tiếp theo nội dung học viên vừa nói.
2. KHI ĐÁNH GIÁ CÂU HỌC VIÊN (correction):
   - KHÔNG bắt học viên nói theo một câu mẫu rập khuôn. Hãy tôn trọng cấu trúc câu và vốn từ vựng học viên vừa dùng.
   - Chỉ sửa những lỗi ngữ pháp/từ vựng thật sự sai trên chính câu của họ (ví dụ "I cleaning street now" -> sửa giữ nguyên ý: "I am cleaning the street now.", lý do: "Thiếu 'am' trong thì hiện tại tiếp diễn và thiếu 'the'").
   - Nếu câu của họ đã đúng ngữ pháp & tự nhiên dù dùng từ khác với từ mục tiêu, đặt isCorrect=true, score=90-100, khen họ và chỉ gợi ý 1 nâng cấp nhẹ nhàng trên nền câu đó ở betterNativeEn.
3. Trả về JSON thuần theo đúng cấu trúc.`;

  const transcript = input.history
    .slice(-8)
    .map((h) => `${h.sender === 'ai' ? input.withWho : 'Học viên'}: ${h.textEn}`)
    .join('\n');

  const userPrompt = isOpening
    ? `Hãy mở đầu cuộc hội thoại tự nhiên trong vai "${input.withWho}" tại "${input.where}". Đặt correction = null và usedTargetWords = [].
Trả về JSON:
{
  "correction": null,
  "usedTargetWords": [],
  "replyEn": string,
  "replyVn": string,
  "suggestedReplyEn": string,
  "suggestedReplyVn": string,
  "conversationCompleted": false
}`
    : `Lịch sử hội thoại gần đây:
${transcript || '(Mới bắt đầu)'}

Học viên vừa ${input.inputMode === 'speak' ? 'nói' : 'viết'}: "${input.userMessage}"

Hãy sửa lỗi bám sát cấu trúc của học viên và trả lời tiếp trong vai "${input.withWho}". Trả về JSON:
{
  "correction": {
    "isCorrect": boolean,
    "score": number (0-100),
    "correctedEn": string,
    "reasonVn": string,
    "betterNativeEn": string
  },
  "usedTargetWords": string[],
  "replyEn": string,
  "replyVn": string,
  "suggestedReplyEn": string,
  "suggestedReplyVn": string,
  "conversationCompleted": boolean
}`;

  const res = await executeWithDualStrategy(preference, systemInstruction, userPrompt);
  if (!res.ok) {
    return {
      engine: 'offline',
      failoverNote: res.failoverNote,
      providers: getProviderStatusSnapshot(),
    };
  }

  const parsed = res.primary;
  const rawCorrection = parsed.correction as Record<string, unknown> | null | undefined;
  const correction =
    !isOpening && rawCorrection && typeof rawCorrection === 'object'
      ? {
          isCorrect: Boolean(rawCorrection.isCorrect),
          score: Math.max(
            0,
            Math.min(100, Math.round(Number(rawCorrection.score ?? 82) || 82))
          ),
          correctedEn: String(rawCorrection.correctedEn || input.userMessage || ''),
          reasonVn: String(rawCorrection.reasonVn || 'Câu trả lời tự nhiên, đúng ngữ cảnh.'),
          betterNativeEn: String(rawCorrection.betterNativeEn || ''),
        }
      : null;

  return {
    engine: res.engine,
    correction,
    usedTargetWords: Array.isArray(parsed.usedTargetWords)
      ? parsed.usedTargetWords.map((w) => String(w))
      : [],
    replyEn: String(parsed.replyEn || 'Could you tell me a bit more about that?'),
    replyVn: String(parsed.replyVn || 'Bạn có thể chia sẻ thêm một chút được không?'),
    suggestedReplyEn: String(parsed.suggestedReplyEn || ''),
    suggestedReplyVn: String(parsed.suggestedReplyVn || ''),
    conversationCompleted: Boolean(parsed.conversationCompleted),
    failoverNote: res.failoverNote,
    providers: getProviderStatusSnapshot(),
  };
}

export async function generateDynamicKnowledgeWithAI(params: {
  topic: string;
  existingTitles: string[];
  mode: 'situations' | 'knowledge' | 'both';
  count?: number;
  preference?: AIPreference;
}): Promise<{
  ok: boolean;
  engine: AIEngineUsed;
  situations: StoredSituation[];
  knowledge: KnowledgeItem[];
  failoverNote: string | null;
  providers: ReturnType<typeof getProviderStatusSnapshot>;
}> {
  const preference = params.preference ?? 'parallel';
  const count = Math.max(1, Math.min(4, params.count ?? 2));
  const avoidList = params.existingTitles.slice(-25).join('; ');

  const systemInstruction = `Bạn là chuyên gia thiết kế chương trình phản xạ tiếng Anh giao tiếp thực tế cho người Việt.
Nhiệm vụ: Tạo thêm dữ liệu học tập MỚI HOÀN TOÀN (không trùng với danh sách đã có), tự nhiên, dễ nhớ, có tính ứng dụng ngay trong đời sống hoặc công việc.
Trả về JSON hợp lệ theo đúng cấu trúc.`;

  const userPrompt = `Chủ đề người học muốn mở rộng: "${params.topic || 'Giao tiếp thực tế hàng ngày & công việc'}"
Các tình huống ĐÃ CÓ (tránh trùng lặp): ${avoidList || 'Không có'}
Yêu cầu tạo:
- ${params.mode === 'knowledge' ? 0 : count} tình huống giao tiếp mới (situations), mỗi tình huống có 4 lượt thoại A (Bạn) & B (Đối tác) tự nhiên, 1 câu followUp, 3-4 targetWords.
- ${params.mode === 'situations' ? 0 : 4} mẫu câu/cụm từ mở rộng thực chiến (knowledge) kèm nghĩa, ghi chú cách dùng linh hoạt và ví dụ.

Trả về JSON:
{
  "situations": [
    {
      "domain": string,
      "title": string,
      "where": string,
      "withWho": string,
      "goal": string,
      "dialogue": [
        { "role": "A" | "B", "speaker": string, "en": string, "vn": string, "intent": string }
      ],
      "followUp": string,
      "targetWords": [{ "en": string, "vn": string }]
    }
  ],
  "knowledge": [
    {
      "topic": string,
      "phraseEn": string,
      "meaningVn": string,
      "usageNoteVn": string,
      "exampleEn": string,
      "exampleVn": string
    }
  ]
}`;

  const res = await executeWithDualStrategy(preference, systemInstruction, userPrompt);
  if (!res.ok) {
    return {
      ok: false,
      engine: 'offline',
      situations: [],
      knowledge: [],
      failoverNote: res.failoverNote,
      providers: getProviderStatusSnapshot(),
    };
  }

  const parsed = res.primary;
  const rawSits = Array.isArray(parsed.situations) ? parsed.situations : [];
  const rawKnowledge = Array.isArray(parsed.knowledge) ? parsed.knowledge : [];

  const situations: StoredSituation[] = rawSits
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s, idx): StoredSituation => ({
      id: Date.now() + idx,
      domain: String(s.domain || params.topic || 'Mở rộng AI'),
      title: String(s.title || `Tình huống mới ${idx + 1}`),
      where: String(s.where || 'Thực tế'),
      withWho: String(s.withWho || 'Đối tác'),
      goal: String(s.goal || 'Giao tiếp tự nhiên'),
      dialogue: Array.isArray(s.dialogue)
        ? (s.dialogue as Situation['dialogue']).filter((t) => t && t.en && t.vn)
        : [],
      followUp: String(s.followUp || 'Could you tell me more?'),
      targetWords: Array.isArray(s.targetWords)
        ? (s.targetWords as Situation['targetWords']).filter((w) => w && w.en && w.vn)
        : [],
      source: 'ai_generated',
    }))
    .filter((s) => s.dialogue.length > 0);

  const knowledge: KnowledgeItem[] = rawKnowledge
    .filter((k): k is Record<string, unknown> => Boolean(k && typeof k === 'object'))
    .map((k, idx): KnowledgeItem => ({
      id: `kn_${Date.now()}_${idx}`,
      topic: String(k.topic || params.topic || 'Mở rộng AI'),
      phraseEn: String(k.phraseEn || ''),
      meaningVn: String(k.meaningVn || ''),
      usageNoteVn: String(k.usageNoteVn || ''),
      exampleEn: String(k.exampleEn || ''),
      exampleVn: String(k.exampleVn || ''),
      sourceEngine: res.engine,
      createdAt: new Date().toISOString(),
    }))
    .filter((k) => Boolean(k.phraseEn && k.meaningVn));

  return {
    ok: true,
    engine: res.engine,
    situations,
    knowledge,
    failoverNote: res.failoverNote,
    providers: getProviderStatusSnapshot(),
  };
}

export async function parseRawTextImportWithAI(params: {
  rawText: string;
  defaultDomain?: string;
  preference?: AIPreference;
}): Promise<{
  ok: boolean;
  engine: AIEngineUsed;
  situations: StoredSituation[];
  failoverNote: string | null;
}> {
  const systemInstruction = `Bạn là trợ lý biên tập dữ liệu cho ứng dụng học tiếng Anh phản xạ.
Hãy chuyển đổi văn bản thô (bất kỳ định dạng nào: ghi chú, bảng từ vựng, đoạn hội thoại, kịch bản) thành danh sách tình huống JSON chuẩn.
Nếu văn bản là danh sách các câu đơn lẻ, hãy gom nhóm hợp lý thành 1-3 tình huống có hội thoại A/B tự nhiên và giữ nguyên toàn bộ ý chính từ văn bản gốc.`;

  const userPrompt = `Chủ đề mặc định nếu văn bản chưa ghi rõ: "${params.defaultDomain || 'Import tùy chỉnh'}"
Văn bản cần chuẩn hóa:
"""
${params.rawText.slice(0, 6000)}
"""

Trả về JSON:
{
  "situations": [
    {
      "domain": string,
      "title": string,
      "where": string,
      "withWho": string,
      "goal": string,
      "dialogue": [
        { "role": "A" | "B", "speaker": string, "en": string, "vn": string, "intent": string }
      ],
      "followUp": string,
      "targetWords": [{ "en": string, "vn": string }]
    }
  ]
}`;

  const res = await executeWithDualStrategy(
    params.preference ?? 'parallel',
    systemInstruction,
    userPrompt
  );

  if (!res.ok) {
    return {
      ok: false,
      engine: 'offline',
      situations: [],
      failoverNote: res.failoverNote,
    };
  }

  const rawSits = Array.isArray(res.primary.situations) ? res.primary.situations : [];
  const situations: StoredSituation[] = rawSits
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s, idx): StoredSituation => ({
      id: Date.now() + idx,
      domain: String(s.domain || params.defaultDomain || 'Import tùy chỉnh'),
      title: String(s.title || `Bài học import ${idx + 1}`),
      where: String(s.where || 'Thực tế'),
      withWho: String(s.withWho || 'Đối tác'),
      goal: String(s.goal || 'Luyện giao tiếp theo dữ liệu import'),
      dialogue: Array.isArray(s.dialogue)
        ? (s.dialogue as Situation['dialogue']).filter((t) => t && t.en && t.vn)
        : [],
      followUp: String(s.followUp || 'What would you say next?'),
      targetWords: Array.isArray(s.targetWords)
        ? (s.targetWords as Situation['targetWords']).filter((w) => w && w.en && w.vn)
        : [],
      source: 'imported',
    }))
    .filter((s) => s.dialogue.length > 0);

  return {
    ok: situations.length > 0,
    engine: res.engine,
    situations,
    failoverNote: res.failoverNote,
  };
}
