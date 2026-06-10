// Microphone recorder + naive emotion energy analysis.
// Uses SpeechRecognition (Web Speech) when available for text match.

export interface RecordingResult {
  blob: Blob;
  url: string;
  transcript: string;
  confidence: number; // 0..1 average recognition confidence across final results
  energy: number; // 0..1 perceived loudness/variation
  durationMs: number;
}

type SR = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

function getSR(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SR;
    webkitSpeechRecognition?: SR;
  };
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SR | null;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private energySum = 0;
  private energyCount = 0;
  private rafId: number | null = null;
  private recognition: any = null;
  private transcript = "";
  private confSum = 0;
  private confCount = 0;
  mimeType = "";

  async start() {
    this.chunks = [];
    this.energySum = 0;
    this.energyCount = 0;
    this.transcript = "";
    this.confSum = 0;
    this.confCount = 0;

    // Mobile-safe constraints. Mono + 16kHz works well for STT on Android
    // Chrome, iOS Safari and Samsung Internet.
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as MediaTrackConstraints,
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Pick the first MIME type the current browser actually supports.
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/mpeg",
    ];
    let chosen = "";
    for (const c of candidates) {
      // @ts-ignore - isTypeSupported may be missing on some browsers
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) {
        chosen = c; break;
      }
    }
    this.mimeType = chosen;
    try {
      this.mediaRecorder = chosen
        ? new MediaRecorder(this.stream, { mimeType: chosen })
        : new MediaRecorder(this.stream);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
    this.startedAt = performance.now();
    try {
      const settings = this.stream.getAudioTracks()[0]?.getSettings();
      // eslint-disable-next-line no-console
      console.log("[VoiceRecorder] start", { mime: this.mimeType || "(default)", sampleRate: settings?.sampleRate, channelCount: settings?.channelCount });
    } catch {}

    // Energy meter
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AC();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buf = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        this.energySum += rms;
        this.energyCount++;
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    } catch {}

    // Speech recognition
    const SR = getSR() as any;
    if (SR) {
      try {
        this.recognition = new SR();
        this.recognition.lang = "en-US";
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 3;
        this.recognition.continuous = true;
        this.recognition.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) {
              this.transcript += " " + r[0].transcript;
              const c = typeof r[0].confidence === "number" ? r[0].confidence : 0;
              this.confSum += c;
              this.confCount++;
            }
          }
        };
        this.recognition.start();
      } catch {
        this.recognition = null;
      }
    }
  }

  async stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({ blob: new Blob(), url: "", transcript: "", confidence: 0, energy: 0, durationMs: 0 });
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blobType = this.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: blobType });
        const url = URL.createObjectURL(blob);
        const energy = this.energyCount ? Math.min(1, (this.energySum / this.energyCount) * 6) : 0;
        const confidence = this.confCount ? this.confSum / this.confCount : 0;
        const durationMs = performance.now() - this.startedAt;
        const mimeType = this.mimeType;
        this.cleanup();
        setTimeout(() => {
          const transcript = this.transcript.trim();
          // eslint-disable-next-line no-console
          console.log("[VoiceRecorder] stop", { transcript, confidence, energy, durationMs, mimeType });
          resolve({ blob, url, transcript, confidence, energy, durationMs });
        }, 250);
        try { this.recognition?.stop(); } catch {}
      };
      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.analyser = null;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }
}

// Common English contractions / homophones to normalise before comparing.
const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bthey're\b/g, "they are"],
  [/\bwe're\b/g, "we are"],
  [/\byou're\b/g, "you are"],
  [/\bit's\b/g, "it is"],
  [/\bi'm\b/g, "i am"],
  [/\bi've\b/g, "i have"],
  [/\bi'll\b/g, "i will"],
  [/\bi'd\b/g, "i would"],
  [/\bdon't\b/g, "do not"],
  [/\bdoesn't\b/g, "does not"],
  [/\bdidn't\b/g, "did not"],
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\bisn't\b/g, "is not"],
  [/\baren't\b/g, "are not"],
  [/\bwasn't\b/g, "was not"],
  [/\bweren't\b/g, "were not"],
  [/\bhasn't\b/g, "has not"],
  [/\bhaven't\b/g, "have not"],
  [/\blet's\b/g, "let us"],
  [/\bthat's\b/g, "that is"],
  [/\bwhat's\b/g, "what is"],
  [/\bwhere's\b/g, "where is"],
  [/\bhow's\b/g, "how is"],
  [/\bgonna\b/g, "going to"],
  [/\bwanna\b/g, "want to"],
  [/\bgotta\b/g, "got to"],
  [/\bain't\b/g, "is not"],
];

function expand(s: string) {
  let out = s.toLowerCase();
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep);
  return out;
}

// Normalise: lowercase, expand contractions, strip punctuation, collapse spaces.
function norm(s: string) {
  return expand(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Levenshtein distance on token arrays.
function tokenEdit(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Returns 0..1 similarity using token-level edit distance, which handles
// extra/missing filler words, accents, and minor mistranscriptions fairly.
export function textSimilarity(target: string, said: string) {
  const t = norm(target).split(" ").filter(Boolean);
  const s = norm(said).split(" ").filter(Boolean);
  if (t.length === 0 || s.length === 0) return 0;
  const dist = tokenEdit(t, s);
  const denom = Math.max(t.length, s.length);
  return Math.max(0, 1 - dist / denom);
}

// Natural matching: accepts the line if the transcript is reasonably close
// to the target (>= threshold). Allows accents, contractions, linking, and
// minor recogniser errors while still rejecting unrelated speech.
export function lineMatch(target: string, said: string, threshold = 0.7): boolean {
  const t = norm(target).split(" ").filter(Boolean);
  if (t.length === 0) return false;
  const sim = textSimilarity(target, said);
  // For very short target lines (1-2 words), require all target words to
  // appear in the transcript so single-word answers can't be faked.
  if (t.length <= 2) {
    const sTokens = new Set(norm(said).split(" ").filter(Boolean));
    const allPresent = t.every((w) => sTokens.has(w));
    return allPresent;
  }
  return sim >= threshold;
}

// Back-compat: keep exactLineMatch exported but route to the natural matcher.
export function exactLineMatch(target: string, said: string): boolean {
  return lineMatch(target, said);
}

export function hasSpeechRecognition() {
  return getSR() !== null;
}

