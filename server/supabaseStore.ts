import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { SITUATIONS } from '../src/data.ts';
import type { Situation } from '../src/data.ts';
import { getEffectiveSecrets, resolveWritableDataDir } from './runtimeConfig.ts';

function getLocalCustomFile(): string {
  return path.join(resolveWritableDataDir(), 'custom_situations.json');
}

function getLocalKnowledgeFile(): string {
  return path.join(resolveWritableDataDir(), 'knowledge_packs.json');
}

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

export const SUPABASE_SCHEMA_SQL = `-- Chạy toàn bộ đoạn SQL này trong Supabase SQL Editor (tạo bảng + cấp quyền đầy đủ):
create table if not exists public.reflex_situations (
  id bigint primary key,
  domain text not null,
  title text not null,
  where_place text not null,
  with_who text not null,
  goal text not null,
  dialogue jsonb not null default '[]'::jsonb,
  follow_up text not null default '',
  target_words jsonb not null default '[]'::jsonb,
  source text not null default 'imported',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reflex_knowledge (
  id text primary key,
  topic text not null,
  phrase_en text not null,
  meaning_vn text not null,
  usage_note_vn text not null default '',
  example_en text not null default '',
  example_vn text not null default '',
  source_engine text not null default 'gemini',
  created_at timestamptz not null default now()
);

-- Cấp quyền truy cập schema & bảng (khắc phục triệt để lỗi "permission denied for table"):
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on table public.reflex_situations to postgres, anon, authenticated, service_role;
grant all privileges on table public.reflex_knowledge to postgres, anon, authenticated, service_role;

-- Bật RLS kèm policy cho phép API ứng dụng đọc/ghi hợp lệ:
alter table public.reflex_situations enable row level security;
alter table public.reflex_knowledge enable row level security;

drop policy if exists "allow_all_reflex_situations" on public.reflex_situations;
create policy "allow_all_reflex_situations"
  on public.reflex_situations
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "allow_all_reflex_knowledge" on public.reflex_knowledge;
create policy "allow_all_reflex_knowledge"
  on public.reflex_knowledge
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);`;

let _supabaseClient: SupabaseClient | null = null;
let _lastConfigKey = '';

function getSupabaseConfig() {
  const s = getEffectiveSecrets();
  return { url: s.supabaseUrl, key: s.supabaseKey };
}

export function detectSupabaseKeyRole(key: string): 'service_role' | 'anon' | 'unknown' {
  const k = key.trim();
  if (!k) return 'unknown';
  if (k.startsWith('sb_secret_')) return 'service_role';
  if (k.startsWith('sb_publishable_')) return 'anon';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const json = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(json) as { role?: unknown };
      if (payload.role === 'service_role') return 'service_role';
      if (payload.role === 'anon' || payload.role === 'authenticated') return 'anon';
    } catch {
      // Ignore malformed JWT
    }
  }
  return 'unknown';
}

export function resetSupabaseClientCache(): void {
  _supabaseClient = null;
  _lastConfigKey = '';
}

function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  const sig = `${url}::${key}`;
  if (!_supabaseClient || _lastConfigKey !== sig) {
    _supabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    _lastConfigKey = sig;
  }
  return _supabaseClient;
}

function isPermissionDeniedError(err: { code?: string; message?: string }): boolean {
  return (
    err.code === '42501' ||
    /permission denied|row-level security|insufficient_privilege/i.test(err.message ?? '')
  );
}

export async function getSupabaseStatus() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      permissionDenied: false,
      keyRole: null as 'service_role' | 'anon' | 'unknown' | null,
      urlMasked: null as string | null,
      message: 'Chưa liên kết Supabase URL & Key (hiện đang lưu cục bộ trên máy chủ).',
    };
  }

  const keyRole = detectSupabaseKeyRole(key);
  let masked = url;
  try {
    const parsed = new URL(url);
    masked = parsed.host;
  } catch {
    // Keep as-is
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      permissionDenied: false,
      keyRole,
      urlMasked: masked,
      message: 'Cấu hình Supabase không hợp lệ.',
    };
  }

  try {
    const { error } = await client.from('reflex_situations').select('id').limit(1);
    if (error) {
      if (isPermissionDeniedError(error)) {
        const hint =
          keyRole === 'anon'
            ? `Bạn đang dùng Anon Key nên bị từ chối quyền ghi/đọc (${error.message}). Hãy đổi sang "service_role" secret key (trong Supabase → Project Settings → API) HOẶC sao chép & chạy đoạn SQL cấp quyền GRANT bên dưới trong Supabase SQL Editor.`
            : `Thiếu quyền truy cập bảng (${error.message}). Hãy sao chép & chạy đoạn SQL cấp quyền GRANT bên dưới trong Supabase SQL Editor rồi bấm Đồng bộ lại.`;
        return {
          configured: true,
          connected: true,
          tablesReady: false,
          permissionDenied: true,
          keyRole,
          urlMasked: masked,
          message: hint,
        };
      }
      return {
        configured: true,
        connected: true,
        tablesReady: false,
        permissionDenied: false,
        keyRole,
        urlMasked: masked,
        message: `Đã kết nối Supabase (${masked}), nhưng chưa tạo bảng dữ liệu: ${error.message}`,
      };
    }

    const { error: kError } = await client.from('reflex_knowledge').select('id').limit(1);
    if (kError) {
      const kDenied = isPermissionDeniedError(kError);
      return {
        configured: true,
        connected: true,
        tablesReady: false,
        permissionDenied: kDenied,
        keyRole,
        urlMasked: masked,
        message: kDenied
          ? `Bảng reflex_knowledge chưa có quyền truy cập (${kError.message}). Hãy chạy lại đoạn SQL cấp quyền bên dưới.`
          : `Bảng reflex_situations đã sẵn sàng, nhưng chưa tạo bảng reflex_knowledge: ${kError.message}`,
      };
    }

    return {
      configured: true,
      connected: true,
      tablesReady: true,
      permissionDenied: false,
      keyRole,
      urlMasked: masked,
      message: `Đã kết nối Supabase (${masked}) và cả 2 bảng dữ liệu đã sẵn sàng.`,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      permissionDenied: false,
      keyRole,
      urlMasked: masked,
      message: err instanceof Error ? err.message : 'Không thể kết nối tới Supabase.',
    };
  }
}

function readLocalCustomSituations(): StoredSituation[] {
  try {
    const file = getLocalCustomFile();
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSituation[]) : [];
  } catch {
    return [];
  }
}

function writeLocalCustomSituations(items: StoredSituation[]) {
  try {
    fs.writeFileSync(getLocalCustomFile(), JSON.stringify(items, null, 2), 'utf-8');
  } catch {
    // Gracefully skip local disk write if restricted
  }
}

function readLocalKnowledge(): KnowledgeItem[] {
  try {
    const file = getLocalKnowledgeFile();
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnowledgeItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalKnowledge(items: KnowledgeItem[]) {
  try {
    fs.writeFileSync(getLocalKnowledgeFile(), JSON.stringify(items, null, 2), 'utf-8');
  } catch {
    // Gracefully skip local disk write if restricted
  }
}

function mapSupabaseRowToSituation(row: Record<string, unknown>): StoredSituation {
  return {
    id: Number(row.id),
    domain: String(row.domain || 'Hàng ngày'),
    title: String(row.title || ''),
    where: String(row.where_place || ''),
    withWho: String(row.with_who || ''),
    goal: String(row.goal || ''),
    dialogue: Array.isArray(row.dialogue) ? (row.dialogue as Situation['dialogue']) : [],
    followUp: String(row.follow_up || ''),
    targetWords: Array.isArray(row.target_words)
      ? (row.target_words as Situation['targetWords'])
      : [],
    source: (row.source as StoredSituation['source']) || 'imported',
    hidden: Boolean(row.hidden),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function mapSituationToSupabaseRow(sit: StoredSituation) {
  return {
    id: sit.id,
    domain: sit.domain,
    title: sit.title,
    where_place: sit.where,
    with_who: sit.withWho,
    goal: sit.goal,
    dialogue: sit.dialogue,
    follow_up: sit.followUp,
    target_words: sit.targetWords,
    source: sit.source ?? 'imported',
    hidden: Boolean(sit.hidden),
  };
}

export async function getAllSituations(includeHidden = false): Promise<StoredSituation[]> {
  const builtinMap = new Map<number, StoredSituation>();
  for (const s of SITUATIONS) {
    builtinMap.set(s.id, { ...s, source: 'builtin', hidden: false });
  }

  const localCustom = readLocalCustomSituations();
  for (const s of localCustom) {
    builtinMap.set(s.id, s);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('reflex_situations')
        .select('*')
        .order('id', { ascending: true });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const mapped = mapSupabaseRowToSituation(row as Record<string, unknown>);
          builtinMap.set(mapped.id, mapped);
        }
      }
    } catch {
      // Fall back gracefully to local + built-in situations
    }
  }

  const all = Array.from(builtinMap.values()).sort((a, b) => a.id - b.id);
  return includeHidden ? all : all.filter((s) => !s.hidden);
}

export async function saveSituations(newItems: StoredSituation[]): Promise<{
  savedCount: number;
  syncedToSupabase: boolean;
  items: StoredSituation[];
}> {
  const existingAll = await getAllSituations(true);
  let maxId = existingAll.reduce((m, s) => Math.max(m, s.id), 0);

  const normalized: StoredSituation[] = newItems.map((item) => {
    const id = item.id && Number.isFinite(item.id) && item.id > 0 ? item.id : ++maxId;
    if (id > maxId) maxId = id;
    return {
      ...item,
      id,
      source: item.source ?? 'imported',
      hidden: Boolean(item.hidden),
      createdAt: item.createdAt ?? new Date().toISOString(),
    };
  });

  // Update local custom store (overwriting any custom or overridden built-in ID)
  const localMap = new Map<number, StoredSituation>();
  for (const s of readLocalCustomSituations()) {
    localMap.set(s.id, s);
  }
  for (const s of normalized) {
    localMap.set(s.id, s);
  }
  writeLocalCustomSituations(Array.from(localMap.values()));

  let syncedToSupabase = false;
  const client = getSupabaseClient();
  if (client && normalized.length > 0) {
    try {
      const rows = normalized.map(mapSituationToSupabaseRow);
      const { error } = await client.from('reflex_situations').upsert(rows, { onConflict: 'id' });
      if (!error) {
        syncedToSupabase = true;
      }
    } catch {
      syncedToSupabase = false;
    }
  }

  return {
    savedCount: normalized.length,
    syncedToSupabase,
    items: normalized,
  };
}

export async function deleteSituationById(id: number): Promise<{
  deleted: boolean;
  syncedToSupabase: boolean;
}> {
  const isBuiltin = SITUATIONS.some((s) => s.id === id);
  const currentLocal = readLocalCustomSituations();

  if (isBuiltin) {
    // Soft-hide built-in situation so it can be restored if needed
    const existing = (await getAllSituations(true)).find((s) => s.id === id);
    if (existing) {
      await saveSituations([{ ...existing, hidden: true, source: 'builtin' }]);
    }
  } else {
    writeLocalCustomSituations(currentLocal.filter((s) => s.id !== id));
  }

  let syncedToSupabase = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      if (!isBuiltin) {
        const { error } = await client.from('reflex_situations').delete().eq('id', id);
        syncedToSupabase = !error;
      } else {
        syncedToSupabase = true;
      }
    } catch {
      syncedToSupabase = false;
    }
  }

  return { deleted: true, syncedToSupabase };
}

export async function syncAllLocalToSupabase(): Promise<{
  ok: boolean;
  syncedSituations: number;
  syncedKnowledge: number;
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      syncedSituations: 0,
      syncedKnowledge: 0,
      message: 'Chưa cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trên máy chủ.',
    };
  }

  try {
    const allSituations = await getAllSituations(true);
    const sitRows = allSituations.map(mapSituationToSupabaseRow);
    const { error: sitErr } = await client
      .from('reflex_situations')
      .upsert(sitRows, { onConflict: 'id' });

    if (sitErr) {
      const denied = isPermissionDeniedError(sitErr);
      return {
        ok: false,
        syncedSituations: 0,
        syncedKnowledge: 0,
        message: denied
          ? `Lỗi quyền bảng reflex_situations (${sitErr.message}). Hãy nhập Service Role Key (service_role) HOẶC sao chép & chạy lại đoạn SQL cấp quyền GRANT bên dưới trong Supabase SQL Editor rồi bấm Đồng bộ lại.`
          : `Lỗi đồng bộ bảng reflex_situations: ${sitErr.message}`,
      };
    }

    const knowledge = await getAllKnowledge();
    if (knowledge.length > 0) {
      const kRows = knowledge.map((k) => ({
        id: k.id,
        topic: k.topic,
        phrase_en: k.phraseEn,
        meaning_vn: k.meaningVn,
        usage_note_vn: k.usageNoteVn,
        example_en: k.exampleEn,
        example_vn: k.exampleVn,
        source_engine: k.sourceEngine,
      }));
      const { error: kErr } = await client
        .from('reflex_knowledge')
        .upsert(kRows, { onConflict: 'id' });
      if (kErr) {
        const denied = isPermissionDeniedError(kErr);
        return {
          ok: false,
          syncedSituations: sitRows.length,
          syncedKnowledge: 0,
          message: denied
            ? `Đã đồng bộ ${sitRows.length} tình huống, nhưng bảng reflex_knowledge thiếu quyền (${kErr.message}). Hãy chạy lại đoạn SQL cấp quyền GRANT bên dưới.`
            : `Đã đồng bộ ${sitRows.length} tình huống, nhưng bảng reflex_knowledge báo lỗi: ${kErr.message}`,
        };
      }
    }

    return {
      ok: true,
      syncedSituations: sitRows.length,
      syncedKnowledge: knowledge.length,
      message: `Đã đồng bộ thành công ${sitRows.length} tình huống và ${knowledge.length} kiến thức mở rộng lên Supabase.`,
    };
  } catch (err) {
    return {
      ok: false,
      syncedSituations: 0,
      syncedKnowledge: 0,
      message: err instanceof Error ? err.message : 'Lỗi kết nối Supabase.',
    };
  }
}

export async function getAllKnowledge(): Promise<KnowledgeItem[]> {
  const local = readLocalKnowledge();
  const map = new Map<string, KnowledgeItem>();
  for (const k of local) map.set(k.id, k);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('reflex_knowledge')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const r = row as Record<string, unknown>;
          map.set(String(r.id), {
            id: String(r.id),
            topic: String(r.topic || ''),
            phraseEn: String(r.phrase_en || ''),
            meaningVn: String(r.meaning_vn || ''),
            usageNoteVn: String(r.usage_note_vn || ''),
            exampleEn: String(r.example_en || ''),
            exampleVn: String(r.example_vn || ''),
            sourceEngine: (r.source_engine as KnowledgeItem['sourceEngine']) || 'gemini',
            createdAt: String(r.created_at || new Date().toISOString()),
          });
        }
      }
    } catch {
      // Ignore fallback
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveKnowledgeItems(items: KnowledgeItem[]): Promise<{
  savedCount: number;
  syncedToSupabase: boolean;
}> {
  const existing = readLocalKnowledge();
  const map = new Map<string, KnowledgeItem>();
  for (const k of existing) map.set(k.id, k);
  for (const k of items) map.set(k.id, k);
  writeLocalKnowledge(Array.from(map.values()));

  let syncedToSupabase = false;
  const client = getSupabaseClient();
  if (client && items.length > 0) {
    try {
      const rows = items.map((k) => ({
        id: k.id,
        topic: k.topic,
        phrase_en: k.phraseEn,
        meaning_vn: k.meaningVn,
        usage_note_vn: k.usageNoteVn,
        example_en: k.exampleEn,
        example_vn: k.exampleVn,
        source_engine: k.sourceEngine,
      }));
      const { error } = await client.from('reflex_knowledge').upsert(rows, { onConflict: 'id' });
      syncedToSupabase = !error;
    } catch {
      syncedToSupabase = false;
    }
  }

  return { savedCount: items.length, syncedToSupabase };
}
