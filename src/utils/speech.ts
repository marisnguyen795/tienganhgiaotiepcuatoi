export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakEnglish(
  text: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = options?.rate ?? 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang === 'en-US' && /natural|google|samantha|daniel|aria/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onError?.();

  window.speechSynthesis.speak(utterance);
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function startListening(callbacks: {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (reason: string) => void;
  onEnd: () => void;
}): () => void {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    callbacks.onError('Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy tự đọc to và kiểm tra.');
    callbacks.onEnd();
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const lastIdx = event.results.length - 1;
    if (lastIdx >= 0) {
      const result = event.results[lastIdx];
      const transcript = result[0]?.transcript ?? '';
      callbacks.onTranscript(transcript, result.isFinal);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      callbacks.onError('Bạn chưa cấp quyền micro. Vui lòng bật quyền micro hoặc luyện phát âm thủ công.');
    } else if (event.error === 'no-speech') {
      callbacks.onError('Chưa nghe thấy giọng nói. Hãy thử nói rõ và gần micro hơn.');
    } else if (event.error !== 'aborted') {
      callbacks.onError('Không thể ghi âm lúc này. Bạn vẫn có thể đọc to và tự chấm điểm.');
    }
  };

  recognition.onend = () => {
    callbacks.onEnd();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError('Không thể khởi động micro.');
    callbacks.onEnd();
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // Ignore if already stopped
    }
  };
}

export function computeWordMatchScore(spoken: string, target: string): {
  score: number;
  matchedWords: number;
  totalWords: number;
} {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const spokenTokens = normalize(spoken);
  const targetTokens = normalize(target);

  if (targetTokens.length === 0) {
    return { score: 0, matchedWords: 0, totalWords: 0 };
  }

  const spokenSet = new Set(spokenTokens);
  let matched = 0;
  for (const token of targetTokens) {
    if (spokenSet.has(token)) {
      matched += 1;
    }
  }

  const score = Math.round((matched / targetTokens.length) * 100);
  return {
    score,
    matchedWords: matched,
    totalWords: targetTokens.length,
  };
}
