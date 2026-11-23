import express from 'express';
import type { Request, Response } from 'express';
import {
  converseRoleplayWithAI,
  evaluateTranslationWithAI,
  generateDynamicKnowledgeWithAI,
  getProviderStatusSnapshot,
  parseRawTextImportWithAI,
  resetProviderCooldowns,
} from './aiEngine.ts';
import type { AIPreference, RoleplayHistoryTurn } from './aiEngine.ts';
import {
  issueAdminToken,
  requireAdminAuth,
  verifyAdminPasscode,
  verifyAdminToken,
} from './adminAuth.ts';
import {
  getPublicIntegrationSnapshot,
  updateRuntimeIntegrations,
} from './runtimeConfig.ts';
import {
  deleteSituationById,
  getAllKnowledge,
  getAllSituations,
  getSupabaseStatus,
  resetSupabaseClientCache,
  saveKnowledgeItems,
  saveSituations,
  SUPABASE_SCHEMA_SQL,
  syncAllLocalToSupabase,
} from './supabaseStore.ts';
import type { StoredSituation } from './supabaseStore.ts';

function parsePreference(val: unknown): AIPreference {
  if (
    val === 'parallel' ||
    val === 'auto' ||
    val === 'gemini' ||
    val === 'meta' ||
    val === 'offline'
  ) {
    return val;
  }
  return 'parallel';
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'anh-van-phan-xa' });
  });

  // Public curriculum & knowledge endpoints
  app.get('/api/situations', async (_req: Request, res: Response) => {
    try {
      const situations = await getAllSituations(false);
      res.json({ situations });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tải tình huống' });
    }
  });

  app.get('/api/knowledge', async (_req: Request, res: Response) => {
    try {
      const knowledge = await getAllKnowledge();
      res.json({ knowledge });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tải kiến thức' });
    }
  });

  // Dynamic AI knowledge expansion ("Load thêm kiến thức mới")
  app.post('/api/knowledge/load-more', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const topic =
        typeof body.topic === 'string' && body.topic.trim()
          ? body.topic.trim().slice(0, 140)
          : 'Giao tiếp thực tế đời sống & công việc';
      const mode =
        body.mode === 'situations' || body.mode === 'knowledge' || body.mode === 'both'
          ? body.mode
          : 'both';
      const count = typeof body.count === 'number' ? Math.max(1, Math.min(4, body.count)) : 2;
      const preference = parsePreference(body.preference);

      const existing = await getAllSituations(true);
      const existingTitles = existing.map((s) => s.title);

      const generated = await generateDynamicKnowledgeWithAI({
        topic,
        existingTitles,
        mode,
        count,
        preference,
      });

      if (!generated.ok) {
        res.status(503).json({
          error:
            generated.failoverNote ||
            'Không thể tạo thêm kiến thức mới do cả Gemini và Meta AI đều đang tạm ngưng hoặc hết token.',
          providers: generated.providers,
        });
        return;
      }

      let savedSituations: StoredSituation[] = [];
      let syncedToSupabase = false;

      if (generated.situations.length > 0) {
        const sitSave = await saveSituations(generated.situations);
        savedSituations = sitSave.items;
        syncedToSupabase = sitSave.syncedToSupabase;
      }
      if (generated.knowledge.length > 0) {
        const kSave = await saveKnowledgeItems(generated.knowledge);
        syncedToSupabase = syncedToSupabase || kSave.syncedToSupabase;
      }

      res.json({
        engine: generated.engine,
        failoverNote: generated.failoverNote,
        addedSituations: savedSituations,
        addedKnowledge: generated.knowledge,
        syncedToSupabase,
        providers: generated.providers,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tạo kiến thức mới' });
    }
  });

  // AI provider health status
  app.get('/api/ai/status', async (_req: Request, res: Response) => {
    const supabase = await getSupabaseStatus();
    res.json({
      providers: getProviderStatusSnapshot(),
      supabase,
    });
  });

  app.post('/api/ai/recheck', async (_req: Request, res: Response) => {
    const supabase = await getSupabaseStatus();
    res.json({
      providers: resetProviderCooldowns(),
      supabase,
    });
  });

  // Feature 1: Adaptive Vietnamese -> English reflex evaluation
  app.post('/api/ai/evaluate', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const vietnamesePrompt =
        typeof body.vietnamesePrompt === 'string' ? body.vietnamesePrompt.trim() : '';
      const expectedEnglish =
        typeof body.expectedEnglish === 'string' ? body.expectedEnglish.trim() : '';
      const userAnswer = typeof body.userAnswer === 'string' ? body.userAnswer.trim() : '';
      const inputMode = body.inputMode === 'speak' ? 'speak' : 'write';
      const preference = parsePreference(body.preference);

      if (!vietnamesePrompt || !expectedEnglish || !userAnswer) {
        res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi hoặc câu trả lời.' });
        return;
      }

      if (userAnswer.length > 600) {
        res.status(400).json({ error: 'Câu trả lời quá dài (tối đa 600 ký tự).' });
        return;
      }

      const result = await evaluateTranslationWithAI({
        vietnamesePrompt,
        expectedEnglish,
        userAnswer,
        inputMode,
        domain: typeof body.domain === 'string' ? body.domain : undefined,
        where: typeof body.where === 'string' ? body.where : undefined,
        hintWord: typeof body.hintWord === 'string' ? body.hintWord : undefined,
        preference,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi xử lý AI';
      res.status(500).json({ error: message });
    }
  });

  // Feature 2: Direct AI Roleplay Conversation
  app.post('/api/ai/roleplay', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const situationTitle =
        typeof body.situationTitle === 'string' ? body.situationTitle.trim() : '';
      const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
      const where = typeof body.where === 'string' ? body.where.trim() : '';
      const withWho = typeof body.withWho === 'string' ? body.withWho.trim() : '';
      const goal = typeof body.goal === 'string' ? body.goal.trim() : '';

      if (!situationTitle || !withWho) {
        res.status(400).json({ error: 'Thiếu thông tin tình huống hội thoại.' });
        return;
      }

      const targetWords = Array.isArray(body.targetWords)
        ? body.targetWords
            .filter(
              (w): w is { en: string; vn: string } =>
                Boolean(
                  w && typeof w === 'object' && typeof (w as { en?: unknown }).en === 'string'
                )
            )
            .slice(0, 10)
        : [];

      const history: RoleplayHistoryTurn[] = Array.isArray(body.history)
        ? body.history
            .filter(
              (h): h is RoleplayHistoryTurn =>
                Boolean(
                  h &&
                    typeof h === 'object' &&
                    ((h as { sender?: unknown }).sender === 'ai' ||
                      (h as { sender?: unknown }).sender === 'user') &&
                    typeof (h as { textEn?: unknown }).textEn === 'string'
                )
            )
            .slice(-12)
        : [];

      const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : undefined;
      if (userMessage && userMessage.length > 600) {
        res.status(400).json({ error: 'Tin nhắn quá dài (tối đa 600 ký tự).' });
        return;
      }

      const inputMode = body.inputMode === 'speak' ? 'speak' : 'write';
      const preference = parsePreference(body.preference);

      const result = await converseRoleplayWithAI({
        situationTitle,
        domain,
        where,
        withWho,
        goal,
        targetWords,
        history,
        userMessage,
        inputMode,
        preference,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi xử lý hội thoại AI';
      res.status(500).json({ error: message });
    }
  });

  // Admin Authentication & System Management Routes
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';
    if (!verifyAdminPasscode(passcode)) {
      res.status(401).json({ error: 'Mật khẩu quản trị không chính xác.' });
      return;
    }
    const { token, expiresAt } = issueAdminToken();
    res.json({ token, expiresAt });
  });

  app.get('/api/admin/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    res.json({ valid: verifyAdminToken(token) });
  });

  app.get('/api/admin/overview', requireAdminAuth, async (_req: Request, res: Response) => {
    try {
      const [situations, knowledge, supabase] = await Promise.all([
        getAllSituations(true),
        getAllKnowledge(),
        getSupabaseStatus(),
      ]);
      res.json({
        situations,
        knowledge,
        supabase,
        supabaseSchemaSql: SUPABASE_SCHEMA_SQL,
        providers: getProviderStatusSnapshot(),
        integrations: getPublicIntegrationSnapshot(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu quản trị' });
    }
  });

  // Admin live link for Supabase & Gemini/Meta AI APIs (secrets stored server-side only)
  app.post('/api/admin/integrations', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = updateRuntimeIntegrations({
        geminiApiKey: typeof body.geminiApiKey === 'string' ? body.geminiApiKey : undefined,
        metaApiKey: typeof body.metaApiKey === 'string' ? body.metaApiKey : undefined,
        metaBaseUrl: typeof body.metaBaseUrl === 'string' ? body.metaBaseUrl : undefined,
        metaModel: typeof body.metaModel === 'string' ? body.metaModel : undefined,
        supabaseUrl: typeof body.supabaseUrl === 'string' ? body.supabaseUrl : undefined,
        supabaseKey: typeof body.supabaseKey === 'string' ? body.supabaseKey : undefined,
        clearGemini: Boolean(body.clearGemini),
        clearMeta: Boolean(body.clearMeta),
        clearSupabase: Boolean(body.clearSupabase),
      });

      if (!result.ok) {
        res.status(400).json({ error: result.error || 'Cấu hình không hợp lệ.' });
        return;
      }

      resetSupabaseClientCache();
      const providers = resetProviderCooldowns();
      const supabase = await getSupabaseStatus();

      res.json({
        ok: true,
        providers,
        supabase,
        integrations: getPublicIntegrationSnapshot(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi lưu cấu hình.' });
    }
  });

  app.post('/api/admin/import', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const mode = body.mode === 'raw_text' ? 'raw_text' : 'json';

      if (mode === 'raw_text') {
        const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
        if (!rawText) {
          res.status(400).json({ error: 'Vui lòng nhập nội dung văn bản cần import.' });
          return;
        }
        const defaultDomain =
          typeof body.defaultDomain === 'string' ? body.defaultDomain.trim() : 'Import tùy chỉnh';
        const preference = parsePreference(body.preference);

        const parsed = await parseRawTextImportWithAI({
          rawText,
          defaultDomain,
          preference,
        });

        if (!parsed.ok || parsed.situations.length === 0) {
          res.status(400).json({
            error:
              parsed.failoverNote ||
              'AI chưa thể chuẩn hóa văn bản này. Hãy thử dán dữ liệu rõ nghĩa hơn hoặc import bằng JSON.',
          });
          return;
        }

        const saved = await saveSituations(parsed.situations);
        res.json({
          engine: parsed.engine,
          failoverNote: parsed.failoverNote,
          ...saved,
        });
        return;
      }

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        res.status(400).json({ error: 'Danh sách dữ liệu import trống.' });
        return;
      }

      const validItems: StoredSituation[] = rawItems
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: Number(item.id || 0),
          domain: String(item.domain || 'Import tùy chỉnh'),
          title: String(item.title || 'Tình huống import'),
          where: String(item.where || 'Thực tế'),
          withWho: String(item.withWho || 'Đối tác'),
          goal: String(item.goal || 'Luyện phản xạ giao tiếp'),
          dialogue: Array.isArray(item.dialogue) ? (item.dialogue as StoredSituation['dialogue']) : [],
          followUp: String(item.followUp || 'What would you say next?'),
          targetWords: Array.isArray(item.targetWords)
            ? (item.targetWords as StoredSituation['targetWords'])
            : [],
          source: 'imported' as const,
          hidden: Boolean(item.hidden),
        }))
        .filter((s) => s.title && s.dialogue.length > 0);

      if (validItems.length === 0) {
        res.status(400).json({
          error: 'Không có tình huống hợp lệ nào (cần có title và ít nhất 1 lượt thoại trong dialogue).',
        });
        return;
      }

      const saved = await saveSituations(validItems);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi import dữ liệu' });
    }
  });

  app.post('/api/admin/situations', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const sit = body.situation as StoredSituation | undefined;
      if (!sit || !sit.title || !Array.isArray(sit.dialogue) || sit.dialogue.length === 0) {
        res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung hội thoại.' });
        return;
      }
      const saved = await saveSituations([sit]);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi lưu tình huống' });
    }
  });

  app.delete('/api/admin/situations/:id', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ error: 'ID tình huống không hợp lệ.' });
        return;
      }
      const result = await deleteSituationById(id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi xóa tình huống' });
    }
  });

  app.post('/api/admin/supabase/sync', requireAdminAuth, async (_req: Request, res: Response) => {
    const result = await syncAllLocalToSupabase();
    res.status(result.ok ? 200 : 400).json(result);
  });

  return app;
}
