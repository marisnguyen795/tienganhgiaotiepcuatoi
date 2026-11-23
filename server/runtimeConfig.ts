import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type RuntimeSecretsOverride = {
  geminiApiKey?: string;
  metaApiKey?: string;
  metaBaseUrl?: string;
  metaModel?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  updatedAt?: string;
};

let cachedWritableDir: string | null = null;

export function resolveWritableDataDir(): string {
  if (cachedWritableDir) return cachedWritableDir;

  const preferredDir = path.resolve(__dirname, 'data');
  // On Vercel/read-only serverless filesystems, prefer /tmp directly
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (!isServerless) {
    try {
      if (!fs.existsSync(preferredDir)) {
        fs.mkdirSync(preferredDir, { recursive: true });
      }
      fs.accessSync(preferredDir, fs.constants.W_OK);
      cachedWritableDir = preferredDir;
      return cachedWritableDir;
    } catch {
      // Fall through to tmp dir
    }
  }

  const tmpDir = path.join(os.tmpdir(), 'anh_van_phan_xa_data');
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {
    // Ignore if even tmp fails
  }
  cachedWritableDir = tmpDir;
  return cachedWritableDir;
}

function getRuntimeConfigPath(): string {
  return path.join(resolveWritableDataDir(), 'runtime_config.json');
}

let memoryOverride: RuntimeSecretsOverride | null = null;

function loadRuntimeOverrideFromDisk(): RuntimeSecretsOverride {
  if (memoryOverride) return memoryOverride;
  try {
    const filePath = getRuntimeConfigPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as RuntimeSecretsOverride;
      if (parsed && typeof parsed === 'object') {
        memoryOverride = parsed;
        return memoryOverride;
      }
    }
  } catch {
    // Ignore read errors
  }
  memoryOverride = {};
  return memoryOverride;
}

function persistRuntimeOverride(next: RuntimeSecretsOverride): void {
  memoryOverride = next;
  try {
    const filePath = getRuntimeConfigPath();
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // On ephemeral or read-only filesystems, memoryOverride remains active for the instance
  }
}

export function validateExternalEndpointUrl(rawUrl: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: true, normalized: '' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Định dạng URL không hợp lệ (cần bắt đầu bằng https://).' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Chỉ cho phép giao thức https:// hoặc http://.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '169.254.169.254' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, error: 'Không cho phép trỏ URL về địa chỉ nội bộ.' };
  }

  return { valid: true, normalized: trimmed.replace(/\/+$/, '') };
}

export function maskSecret(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length <= 8) return '••••••••';
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export function getEffectiveSecrets() {
  const override = loadRuntimeOverrideFromDisk();

  const geminiKey =
    override.geminiApiKey !== undefined
      ? override.geminiApiKey.trim()
      : (process.env.GEMINI_API_KEY ?? '').trim();

  const metaKey =
    override.metaApiKey !== undefined
      ? override.metaApiKey.trim()
      : (process.env.META_AI_API_KEY ?? '').trim();

  const metaBaseUrl =
    (override.metaBaseUrl !== undefined && override.metaBaseUrl.trim()
      ? override.metaBaseUrl.trim()
      : (process.env.META_AI_BASE_URL ?? 'https://api.llama.com/compat/v1').trim()
    ).replace(/\/+$/, '');

  const metaModel =
    override.metaModel !== undefined && override.metaModel.trim()
      ? override.metaModel.trim()
      : (process.env.META_AI_MODEL ?? 'Llama-4-Maverick-17B-128E-Instruct-FP8').trim();

  const supabaseUrl = (
    override.supabaseUrl !== undefined
      ? override.supabaseUrl.trim()
      : (process.env.SUPABASE_URL ?? '').trim()
  ).replace(/\/+$/, '');

  const supabaseKey =
    override.supabaseKey !== undefined
      ? override.supabaseKey.trim()
      : (
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          ''
        ).trim();

  return {
    geminiKey,
    geminiSource:
      override.geminiApiKey !== undefined && override.geminiApiKey.trim()
        ? ('admin' as const)
        : (process.env.GEMINI_API_KEY ?? '').trim()
          ? ('env' as const)
          : ('none' as const),
    metaKey,
    metaSource:
      override.metaApiKey !== undefined && override.metaApiKey.trim()
        ? ('admin' as const)
        : (process.env.META_AI_API_KEY ?? '').trim()
          ? ('env' as const)
          : ('none' as const),
    metaBaseUrl,
    metaModel,
    supabaseUrl,
    supabaseKey,
    supabaseSource:
      (override.supabaseUrl !== undefined && override.supabaseUrl.trim()) ||
      (override.supabaseKey !== undefined && override.supabaseKey.trim())
        ? ('admin' as const)
        : (process.env.SUPABASE_URL ?? '').trim()
          ? ('env' as const)
          : ('none' as const),
  };
}

export function getPublicIntegrationSnapshot() {
  const s = getEffectiveSecrets();
  let supabaseHost: string | null = null;
  if (s.supabaseUrl) {
    try {
      supabaseHost = new URL(s.supabaseUrl).host;
    } catch {
      supabaseHost = s.supabaseUrl;
    }
  }

  return {
    gemini: {
      configured: Boolean(s.geminiKey),
      masked: maskSecret(s.geminiKey),
      source: s.geminiSource,
    },
    meta: {
      configured: Boolean(s.metaKey),
      masked: maskSecret(s.metaKey),
      baseUrl: s.metaBaseUrl,
      model: s.metaModel,
      source: s.metaSource,
    },
    supabase: {
      configured: Boolean(s.supabaseUrl && s.supabaseKey),
      urlMasked: supabaseHost,
      keyMasked: maskSecret(s.supabaseKey),
      source: s.supabaseSource,
    },
  };
}

export function updateRuntimeIntegrations(input: {
  geminiApiKey?: string;
  metaApiKey?: string;
  metaBaseUrl?: string;
  metaModel?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  clearGemini?: boolean;
  clearMeta?: boolean;
  clearSupabase?: boolean;
}): { ok: boolean; error?: string } {
  const current = { ...loadRuntimeOverrideFromDisk() };

  if (input.clearGemini) {
    delete current.geminiApiKey;
  } else if (typeof input.geminiApiKey === 'string' && input.geminiApiKey.trim()) {
    current.geminiApiKey = input.geminiApiKey.trim();
  }

  if (input.clearMeta) {
    delete current.metaApiKey;
    delete current.metaBaseUrl;
    delete current.metaModel;
  } else {
    if (typeof input.metaApiKey === 'string' && input.metaApiKey.trim()) {
      current.metaApiKey = input.metaApiKey.trim();
    }
    if (typeof input.metaBaseUrl === 'string' && input.metaBaseUrl.trim()) {
      const check = validateExternalEndpointUrl(input.metaBaseUrl);
      if (!check.valid) return { ok: false, error: `Meta Base URL: ${check.error}` };
      current.metaBaseUrl = check.normalized;
    }
    if (typeof input.metaModel === 'string' && input.metaModel.trim()) {
      current.metaModel = input.metaModel.trim().slice(0, 120);
    }
  }

  if (input.clearSupabase) {
    delete current.supabaseUrl;
    delete current.supabaseKey;
  } else {
    if (typeof input.supabaseUrl === 'string' && input.supabaseUrl.trim()) {
      const check = validateExternalEndpointUrl(input.supabaseUrl);
      if (!check.valid) return { ok: false, error: `Supabase URL: ${check.error}` };
      current.supabaseUrl = check.normalized;
    }
    if (typeof input.supabaseKey === 'string' && input.supabaseKey.trim()) {
      current.supabaseKey = input.supabaseKey.trim();
    }
  }

  current.updatedAt = new Date().toISOString();
  persistRuntimeOverride(current);
  return { ok: true };
}
