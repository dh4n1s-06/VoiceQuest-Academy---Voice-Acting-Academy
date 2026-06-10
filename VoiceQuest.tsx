import { useEffect, useMemo, useRef, useState } from "react";
import { SCENES, ACHIEVEMENTS, type Scene } from "@/game/scenes";
import { audio, MUSIC, SFX } from "@/game/audio";
import { VoiceRecorder, lineMatch, hasSpeechRecognition, type RecordingResult } from "@/game/recorder";

type Stage =
  | "name"
  | "welcome"
  | "info"
  | "listen"
  | "guess"
  | "unlock"
  | "dub"
  | "feedback"
  | "graduation";

import bgLobby from "@/assets/bg/academy-lobby.jpg.asset.json";
import bgTheatre from "@/assets/bg/theatre-stage.jpg.asset.json";
import bgClass from "@/assets/bg/voice-classroom.jpg.asset.json";
import bgListen from "@/assets/bg/listening-lab.jpg.asset.json";
import bgCasting from "@/assets/bg/casting-room.jpg.asset.json";
import bgScreen from "@/assets/bg/screening-room.jpg.asset.json";
import bgBooth from "@/assets/bg/recording-booth.jpg.asset.json";
import bgGrad from "@/assets/bg/graduation-stage.jpg.asset.json";
import infoVideo from "@/assets/videos/video-information.mp4.asset.json";

function bgFor(stage: Stage): string {
  switch (stage) {
    case "name": return bgLobby.url;
    case "welcome": return bgTheatre.url;
    case "info": return bgClass.url;
    case "listen": return bgListen.url;
    case "guess": return bgCasting.url;
    case "unlock": return bgScreen.url;
    case "dub":
    case "feedback": return bgBooth.url;
    case "graduation": return bgGrad.url;
  }
}

function highestAchievement(score: number) {
  let best = null;
  for (const a of ACHIEVEMENTS) if (score >= a.threshold) best = a;
  return best;
}

interface GameState {
  stageName: string;
  score: number;
  streak: number;
  bestStreak: number;
  sceneIndex: number;
  attemptCount: number;
  correctScenes: number;
}

const INIT: GameState = {
  stageName: "",
  score: 0,
  streak: 0,
  bestStreak: 0,
  sceneIndex: 0,
  attemptCount: 0,
  correctScenes: 0,
};

export default function VoiceQuest() {
  const [stage, setStage] = useState<Stage>("name");
  const [state, setState] = useState<GameState>(INIT);
  const [achievementPopup, setAchievementPopup] = useState<
    { a: typeof ACHIEVEMENTS[number]; scoreReached: number } | null
  >(null);
  const [fade, setFade] = useState(false);

  const scene: Scene | undefined = SCENES[state.sceneIndex];
  const progress = Math.round((state.correctScenes / SCENES.length) * 100);
  const badge = highestAchievement(state.score);

  // Music management
  useEffect(() => {
    if (stage === "welcome" || stage === "info") {
      audio.playMusic(MUSIC.academy, { loop: true, volume: 0.2 });
    } else if (stage === "graduation") {
      audio.playMusic(MUSIC.graduation, { loop: false, volume: 0.5 });
      audio.playSfx(SFX.graduation, 0.7);
    } else {
      audio.stopMusic();
    }
  }, [stage]);

  const go = (next: Stage) => {
    setFade(true);
    setTimeout(() => {
      setStage(next);
      setFade(false);
    }, 350);
  };

  const handleCorrect = (firstTry: boolean) => {
    const points = firstTry ? 10 : 5;
    const prevScore = state.score;
    const newScore = prevScore + points;
    const newStreak = state.streak + 1;
    // Find the highest threshold newly crossed by this score gain.
    const milestone =
      [...ACHIEVEMENTS]
        .reverse()
        .find((a) => newScore >= a.threshold && prevScore < a.threshold) ?? null;
    setState((s) => ({
      ...s,
      score: s.score + points,
      streak: newStreak,
      bestStreak: Math.max(s.bestStreak, newStreak),
      correctScenes: s.correctScenes + 1,
    }));
    if (milestone) {
      // Pause progression: show achievement centre-stage ~4.5s, then unlock.
      setAchievementPopup({ a: milestone, scoreReached: newScore });
      audio.playSfx(SFX.achievement, 0.8);
      setTimeout(() => setAchievementPopup(null), 4500);
      setTimeout(() => go("unlock"), 5100);
    } else {
      go("unlock");
    }
  };


  const handleWrong = () => {
    setState((s) => ({ ...s, streak: 0, attemptCount: s.attemptCount + 1 }));
  };

  const skipScene = () => {
    setState((s) => ({ ...s, streak: 0 }));
    advance();
  };

  const advance = () => {
    setState((s) => {
      const next = s.sceneIndex + 1;
      if (next >= SCENES.length) return s;
      return { ...s, sceneIndex: next, attemptCount: 0 };
    });
    setTimeout(() => {
      if (state.sceneIndex + 1 >= SCENES.length) go("graduation");
      else go("guess");
    }, 50);
  };

  const nextScene = advance;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-foreground">
      {/* Background */}
      <div
        key={stage}
        className="fixed inset-0 vq-bg transition-opacity duration-700"
        style={{ backgroundImage: `url(${bgFor(stage)}), linear-gradient(160deg, #1a0e2e, #320e1a 60%, #0a0612)` }}
      />
      <div className="fixed inset-0 vq-overlay" />
      <div className="fixed inset-0 grain particles pointer-events-none" />

      {/* Top HUD */}
      {stage !== "name" && stage !== "welcome" && (
        <TopHUD
          stageName={state.stageName}
          progress={progress}
          badge={badge}
          score={state.score}
          sceneNum={Math.min(state.sceneIndex + 1, SCENES.length)}
          total={SCENES.length}
        />
      )}

      {/* Stage content */}
      <main
        className={`relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-24 transition-opacity duration-300 ${
          fade ? "opacity-0" : "opacity-100"
        }`}
      >
        {stage === "name" && <NameStage onSubmit={(name) => { setState((s) => ({ ...s, stageName: name })); go("welcome"); }} />}
        {stage === "welcome" && <WelcomeStage name={state.stageName} onStart={() => go("info")} />}
        {stage === "info" && <InfoStage onBegin={() => go("guess")} />}
        {stage === "listen" && scene && <ListenStage scene={scene} onNext={() => go("guess")} />}
        {stage === "guess" && scene && (
          <GuessStage
            scene={scene}
            attempts={state.attemptCount}
            onCorrect={() => handleCorrect(state.attemptCount === 0)}
            onWrong={handleWrong}
          />
        )}
        {stage === "unlock" && scene && <UnlockStage scene={scene} onContinue={() => go("dub")} />}
        {stage === "dub" && scene && <DubStage scene={scene} onDone={() => go("feedback")} onSkip={skipScene} />}
        {stage === "feedback" && scene && (
          <FeedbackStage scene={scene} isLast={state.sceneIndex + 1 >= SCENES.length} onNext={nextScene} />
        )}
        {stage === "graduation" && (
          <GraduationStage
            name={state.stageName}
            score={state.score}
            correct={state.correctScenes}
            badge={badge}
            onReplay={() => { setState({ ...INIT, stageName: state.stageName }); go("welcome"); }}
            onHome={() => { setState(INIT); go("name"); }}
          />
        )}
      </main>

      {achievementPopup && <AchievementPopup a={achievementPopup.a} scoreReached={achievementPopup.scoreReached} />}
    </div>
  );
}

/* ---------------- HUD ---------------- */

function TopHUD({
  stageName, progress, badge, score, sceneNum, total,
}: {
  stageName: string; progress: number; badge: ReturnType<typeof highestAchievement>;
  score: number; sceneNum: number; total: number;
}) {
  const color =
    progress < 26 ? "#22c55e" :
    progress < 51 ? "#3b82f6" :
    progress < 76 ? "#a855f7" :
    progress < 100 ? "#f59e0b" : "#fde047";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4">
      <div className="glass mx-auto flex w-full max-w-6xl items-center gap-4 rounded-2xl px-4 py-3">
        <div className="hidden text-sm sm:block">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">Voice Actor</div>
          <div className="font-display text-lg gold-text">🎭 {stageName || "Anonymous"}</div>
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs text-amber-100/80">
            <span className="font-medium">🎭 VoiceQuest Training Progress</span>
            <span>Scene {sceneNum}/{total} · {progress}%</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full border border-amber-200/30 bg-black/50">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}, #fff7c2)`,
                boxShadow: `0 0 16px ${color}`,
              }}
            />
          </div>
        </div>
        <div className="hidden text-right text-sm sm:block">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">Score</div>
          <div className="font-display text-lg gold-text">{score}</div>
        </div>
        {badge && (
          <div className="hidden rounded-xl border border-amber-200/40 bg-black/40 px-3 py-2 text-right md:block">
            <div className="text-[10px] uppercase tracking-widest text-amber-200/70">🏆 Current Academy Title</div>
            <div className="text-sm font-semibold" style={{ color: badge.color }}>
              {badge.icon} {badge.title}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Screens ---------------- */

function NameStage({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fade-in-up glass relative w-full max-w-xl rounded-3xl p-10 text-center">
      <div className="spotlight absolute -inset-20 -z-10" />
      <h1 className="font-display text-4xl md:text-5xl gold-text">🎭 VoiceQuest Academy</h1>
      <p className="mt-3 text-sm md:text-base text-amber-100/80 italic">
        Every great voice actor begins with a name the audience will remember.
      </p>
      <div className="mt-8 text-left">
        <label className="mb-2 block text-sm font-semibold text-amber-100">🎤 Enter Your Stage Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Echo Nova, Luna Sparks, Max Voicewood"
          className="w-full rounded-xl border border-amber-300/40 bg-black/40 px-4 py-3 text-lg text-amber-50 outline-none ring-amber-300/0 transition focus:ring-2 focus:ring-amber-300/60"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name.trim())}
        />
        <p className="mt-2 text-xs text-amber-100/60">
          This name will appear on your casting profile, performance scenes, and graduation certificate.
        </p>
      </div>
      <button
        disabled={!name.trim()}
        onClick={() => onSubmit(name.trim())}
        className="btn-gold pulse-glow mt-8 w-full rounded-2xl px-6 py-3 text-lg font-semibold disabled:opacity-40 disabled:hover:scale-100"
      >
        🎬 Begin Your Audition
      </button>
    </div>
  );
}

function WelcomeStage({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <div className="fade-in-up relative w-full max-w-3xl text-center">
      <div className="spotlight absolute -inset-32 -z-10" />
      <h1 className="font-display text-5xl md:text-7xl gold-text">🎬 Lights. Camera. Action!</h1>
      <p className="mt-6 text-xl text-amber-50/90">Welcome, {name || "future voice actor"}, to VoiceQuest Academy.</p>
      <p className="mt-4 text-base text-amber-100/80 max-w-2xl mx-auto">
        Today, your mission is to bring scenes to life through the power of <em>intonation</em>.
      </p>
      <p className="mt-6 font-display text-2xl md:text-3xl gold-text">🎭 Your voice will shape every character you become.</p>
      <button onClick={onStart} className="btn-gold pulse-glow mt-10 rounded-2xl px-10 py-4 text-lg font-semibold">
        🎬 Start Training
      </button>
    </div>
  );
}

function InfoStage({ onBegin }: { onBegin: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const onPlay = () => audio.pauseMusic();
  const onEndOrPause = () => audio.resumeMusic();

  return (
    <>
      <AcademyMusicCredit />
      <div className="fade-in-up glass w-full max-w-4xl rounded-3xl p-8 md:p-10">
      <h2 className="font-display text-3xl md:text-4xl gold-text">🎤 Did You Know?</h2>
      <p className="mt-3 text-amber-50/90">
        Intonation is the rise and fall of your voice when you speak. It is the melody of speech — by
        changing your pitch, length, and loudness, you express emotion and meaning.
      </p>

      <h3 className="mt-8 font-display text-2xl text-amber-200">🎬 Why It Matters</h3>
      <p className="mt-2 text-amber-50/85">
        In spoken English, intonation shows feelings and attitudes that the written words alone cannot.
        Now let's watch how voice and intonation bring different emotions to life.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200/30 bg-black/60">
        <video
          ref={videoRef}
          controls
          onPlay={onPlay}
          onPause={onEndOrPause}
          onEnded={onEndOrPause}
          className="aspect-video w-full"
        >
          <source src={infoVideo.url} type="video/mp4" />
          Your browser does not support video.
        </video>
      </div>

      <CreditCard className="mt-3 text-left">
        <div className="font-semibold text-amber-200">🎬 Video Credit</div>
        <div className="mt-1 text-amber-50/85">Intonation Example Video</div>
        <div className="text-amber-100/70">Source: @solennaeap on TikTok</div>
      </CreditCard>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title="🎯 Key Components">
          <ul className="space-y-1 text-sm text-amber-50/85">
            <li>• <b>Pitch</b> — how high or low your voice is</li>
            <li>• <b>Stress</b> — which word you emphasise</li>
            <li>• <b>Tone</b> — the emotion behind your voice</li>
            <li>• <b>Pace</b> — how fast or slow you speak</li>
          </ul>
        </Card>
        <Card title="🎭 Why It Matters">
          <ul className="space-y-1 text-sm text-amber-50/85">
            <li>• Show emotions clearly</li>
            <li>• Make speech natural & engaging</li>
            <li>• Help listeners understand meaning</li>
            <li>• Avoid misunderstandings</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4" title="🎤 In VoiceQuest you will…">
        <ul className="space-y-1 text-sm text-amber-50/85">
          <li>🎧 Listen to real voice performances</li>
          <li>🧠 Identify the correct emotion</li>
          <li>🎤 Record your own voice to match the character</li>
        </ul>
      </Card>

      <p className="mt-6 text-center font-display text-lg text-amber-200">
        Now it's your turn to step into the booth and bring every scene to life! 🎬✨
      </p>

      <div className="mt-6 text-center">
        <button onClick={onBegin} className="btn-gold rounded-2xl px-10 py-3 text-lg font-semibold">
          🎬 Begin Training
        </button>
      </div>

      </div>
    </>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-amber-200/20 bg-black/30 p-4 ${className}`}>
      <div className="mb-2 text-sm font-semibold text-amber-200">{title}</div>
      {children}
    </div>
  );
}

function CreditCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-amber-300/40 bg-black/55 p-4 text-xs leading-relaxed text-amber-100 shadow-[0_16px_40px_-24px_rgba(246,198,81,0.65)] ${className}`}>
      {children}
    </div>
  );
}

function AcademyMusicCredit() {
  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-2xl border border-amber-300/40 bg-black/65 px-4 py-3 text-right text-xs leading-relaxed text-amber-100 shadow-[0_16px_40px_-24px_rgba(246,198,81,0.65)] backdrop-blur-md">
      <div className="font-semibold text-amber-200">🎵 Academy Theme Music</div>
      <div className="text-amber-50/85">Tonbo (YouTube)</div>
    </div>
  );
}

function ListenStage({ scene, onNext }: { scene: Scene; onNext: () => void }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="fade-in-up glass w-full max-w-2xl rounded-3xl p-8 text-center">
      <div className="text-xs uppercase tracking-widest text-amber-200/70">{scene.film}</div>
      <h2 className="mt-1 font-display text-3xl md:text-4xl gold-text">🎧 Listen Carefully</h2>
      <p className="mt-2 text-sm text-amber-100/80">Focus on the character's tone, pitch, and emotion.</p>

      <div className="mt-8 rounded-2xl border border-amber-200/30 bg-black/40 p-6">
        <div className="text-xs uppercase tracking-widest text-amber-200/60">Target Line</div>
        <div className="mt-2 font-display text-2xl md:text-3xl text-amber-50">"{scene.line}"</div>
      </div>

      <audio ref={ref} src={scene.audio} onEnded={() => setPlaying(false)} />

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => {
            const a = ref.current;
            if (!a) return;
            if (a.paused) { a.currentTime = 0; a.play().catch(() => {}); setPlaying(true); }
            else { a.pause(); setPlaying(false); }
          }}
          className="btn-gold rounded-full px-8 py-3 text-base font-semibold"
        >
          {playing ? "⏸ Pause" : "🎵 Play Audio Model"}
        </button>
        <p className="text-xs text-amber-100/60">You can replay the audio as many times as you like.</p>
      </div>

      <button onClick={onNext} className="mt-8 rounded-xl border border-amber-200/40 px-6 py-2 text-sm text-amber-100 hover:bg-white/5">
        Continue → Emotion Guess
      </button>
    </div>
  );
}

function GuessStage({
  scene, attempts, onCorrect, onWrong,
}: {
  scene: Scene; attempts: number; onCorrect: () => void; onWrong: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const playModel = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };
  const replayModel = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
    setPlaying(true);
  };

  const click = (opt: string) => {
    if (chosen === opt) return;
    setChosen(opt);
    if (opt === scene.correct) {
      audio.playSfx(SFX.correct, 0.7);
      setTimeout(onCorrect, 600);
    } else {
      audio.playSfx(SFX.wrong, 0.6);
      setShake(true);
      onWrong();
      setTimeout(() => { setChosen(null); setShake(false); }, 700);
    }
  };

  return (
    <div className={`fade-in-up glass w-full max-w-3xl rounded-3xl p-8 text-center ${shake ? "animate-pulse" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-amber-200/70">{scene.film}</div>
      <h2 className="mt-1 font-display text-3xl gold-text">🎧 Listen Carefully</h2>
      <p className="mt-2 text-sm text-amber-100/80">Replay as often as you like, then choose the emotion that matches.</p>

      <div className="mt-6 rounded-2xl border border-amber-200/30 bg-black/40 p-5">
        <div className="text-xs uppercase tracking-widest text-amber-200/60">🎯 Target Line</div>
        <div className="mt-1 font-display text-2xl md:text-3xl text-amber-50">"{scene.line}"</div>

        <audio ref={audioRef} src={scene.audio} onEnded={() => setPlaying(false)} />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button onClick={playModel} className="btn-gold rounded-full px-6 py-2 text-sm font-semibold">
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button onClick={replayModel} className="rounded-full border border-amber-200/50 px-6 py-2 text-sm text-amber-100 hover:bg-white/5">
            🔄 Replay
          </button>
        </div>
      </div>

      <h3 className="mt-8 font-display text-xl text-amber-200">🎭 Select the emotion that best matches the line</h3>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {scene.options.map((o) => {
          const isChosen = chosen === o;
          const isCorrect = isChosen && o === scene.correct;
          const isWrong = isChosen && o !== scene.correct;
          return (
            <button
              key={o}
              onClick={() => click(o)}
              disabled={!!chosen && isCorrect}
              className={`rounded-2xl border px-5 py-4 text-left text-base font-medium transition
                ${isCorrect ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-100" :
                  isWrong ? "border-rose-400/70 bg-rose-400/10 text-rose-100" :
                  "border-amber-200/30 bg-black/40 text-amber-50 hover:border-amber-300/60 hover:bg-white/5"}`}
            >
              <span className="mr-2 text-amber-200/70">{String.fromCharCode(65 + scene.options.indexOf(o))}.</span>
              {o}
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-xs text-amber-100/70">
        {attempts === 0 ? "First attempt — correct = +10 points" : `Attempt ${attempts + 1} — correct = +5 points`}
      </div>
    </div>
  );
}


function UnlockStage({ scene, onContinue }: { scene: Scene; onContinue: () => void }) {
  return (
    <div className="fade-in-up glass w-full max-w-4xl rounded-3xl p-8 text-center">
      <div className="pop-in font-display text-4xl md:text-5xl gold-text">🎬 Scene Unlocked!</div>
      <div className="mt-1 text-sm text-amber-100/70">{scene.film}</div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200/40 bg-black">
        {scene.video ? (
          <video controls autoPlay className="aspect-video w-full">
            <source src={scene.video} type="video/mp4" />
          </video>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-black/80 text-amber-200/70">
            Scene video coming soon — {scene.character}: "{scene.line}"
          </div>
        )}
      </div>

      <p className="mt-4 text-amber-50">
        <b className="text-amber-200">{scene.character}:</b> "{scene.line}"
      </p>

      <button onClick={onContinue} className="btn-gold mt-6 rounded-2xl px-8 py-3 font-semibold">
        🎤 Step Into the Recording Booth
      </button>
    </div>
  );
}

function DubStage({ scene, onDone, onSkip }: { scene: Scene; onDone: () => void; onSkip: () => void }) {
  const recRef = useRef<VoiceRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [verdict, setVerdict] = useState<null | { pass: boolean; msg: string }>(null);
  const [failCount, setFailCount] = useState(0);
  const supportsSR = useMemo(() => hasSpeechRecognition(), []);

  const replayModel = () => {
    const a = audioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
  };

  const toggle = async () => {
    if (recording) {
      setRecording(false);
      setEvaluating(true);
      const r = await recRef.current!.stop();
      setResult(r);

      // Strict evaluation pipeline.
      let pass = false;
      let msg = "";
      const heardSomething = !!r.transcript && r.transcript.trim().length > 0;
      const minConfidence = 0.55;

      if (!supportsSR) {
        // Fallback: only energy-based pass when SR isn't available.
        if (r.energy < 0.06) {
          msg = "🎭 Close! Try again with stronger emotion and clearer delivery.";
        } else {
          pass = true;
          msg = "✅ Director Approved! Strong delivery.";
        }
      } else if (!heardSomething) {
        msg = "🎤 We couldn't detect any speech. Please speak clearly and try again.";
      } else if (r.confidence > 0 && r.confidence < minConfidence) {
        msg = "🎤 We couldn't clearly recognise your line. Please speak clearly and try again.";
      } else if (!lineMatch(scene.line, r.transcript)) {
        msg = `❌ That didn't match the line. Try saying: "${scene.line}"`;
      } else if (r.energy < 0.08) {
        msg = "🎭 Close! You said the correct words, but the emotion does not yet match the character. Listen again and try another take.";
      } else {
        pass = true;
        msg = "✅ Director Approved! Strong delivery.";
      }

      // Debug logging to help diagnose mobile rejections.
      // eslint-disable-next-line no-console
      console.log("[DubStage] eval", {
        pass,
        reason: msg,
        target: scene.line,
        transcript: r.transcript,
        confidence: r.confidence,
        energy: r.energy,
        durationMs: r.durationMs,
      });

      if (pass) {
        audio.playSfx(SFX.correct, 0.7);
      } else {
        audio.playSfx(SFX.wrong, 0.5);
        setFailCount((c) => c + 1);
      }
      setVerdict({ pass, msg });
      setEvaluating(false);
    } else {
      setResult(null);
      setVerdict(null);
      try {
        const rec = new VoiceRecorder();
        await rec.start();
        recRef.current = rec;
        setRecording(true);
      } catch {
        setVerdict({ pass: false, msg: "🎙️ Microphone access denied. Please allow mic permission." });
        setFailCount((c) => c + 1);
      }
    }
  };

  return (
    <div className="fade-in-up glass w-full max-w-4xl rounded-3xl p-8">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-amber-200/70">{scene.film}</div>
        <h2 className="font-display text-3xl md:text-4xl gold-text">🎬 Dub It Right!</h2>
        <p className="mt-1 text-sm text-amber-100/80">
          Record the highlighted line with the correct intonation. Tap the mic to start and stop.
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 overflow-hidden rounded-2xl border border-amber-200/30 bg-black">
          {scene.video ? (
            <video controls className="aspect-video w-full">
              <source src={scene.video} type="video/mp4" />
            </video>
          ) : (
            <div className="flex aspect-video items-center justify-center text-amber-200/70">Scene video coming soon</div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-300/10 p-4">
            <div className="text-xs uppercase tracking-widest text-amber-200/80">Your line</div>
            <div className="mt-1 font-display text-xl text-amber-50">"{scene.line}"</div>
          </div>

          <audio ref={audioRef} src={scene.audio} />
          <button onClick={replayModel} className="rounded-xl border border-amber-200/40 px-4 py-2 text-sm text-amber-100 hover:bg-white/5">
            🎧 Listen Again
          </button>

          <button
            onClick={toggle}
            disabled={evaluating}
            className={`rounded-2xl px-5 py-6 text-lg font-semibold transition ${
              recording
                ? "border border-rose-400/70 bg-rose-500/20 text-rose-100 animate-pulse"
                : "btn-gold"
            }`}
          >
            {recording ? "🔴 Recording… Tap to Stop" : evaluating ? "Analysing…" : "🎤 Tap to Record"}
          </button>

          {result?.url && (
            <div className="rounded-xl border border-amber-200/30 bg-black/40 p-3">
              <div className="mb-1 text-xs text-amber-200/80">Your take</div>
              <audio controls src={result.url} className="w-full" />
              {result.transcript && (
                <div className="mt-2 text-xs text-amber-100/70">Heard: "{result.transcript}"</div>
              )}
            </div>
          )}

          {verdict && (
            <div className={`rounded-xl border p-3 text-sm ${
              verdict.pass ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                           : "border-amber-300/60 bg-amber-300/10 text-amber-100"
            }`}>
              {verdict.msg}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-amber-100/60">
          {supportsSR ? "Speech recognition: enabled" : "Speech recognition not available in this browser — emotion only"}
        </span>
        <div className="flex items-center gap-3">
          {failCount >= 1 && !verdict?.pass && (
            <button
              onClick={onSkip}
              className="rounded-2xl border border-amber-200/50 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-white/5"
            >
              ⏭ Skip Scene
            </button>
          )}
          <button
            onClick={onDone}
            disabled={!verdict?.pass}
            className="btn-gold rounded-2xl px-6 py-2 font-semibold disabled:opacity-40 disabled:hover:scale-100"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackStage({ scene, isLast, onNext }: { scene: Scene; isLast: boolean; onNext: () => void }) {
  useEffect(() => {
    audio.playSfx(SFX.sceneUnlocked, 0.6);
  }, []);
  return (
    <div className="fade-in-up glass w-full max-w-2xl rounded-3xl p-10 text-center">
      <div className="pop-in font-display text-4xl gold-text">🎬 Director Approved!</div>
      <p className="mt-3 text-amber-50/90">{scene.positive}</p>
      <button onClick={onNext} className="btn-gold mt-8 rounded-2xl px-8 py-3 font-semibold">
        {isLast ? "🎓 Walk to Graduation" : "🎬 Next Scene"}
      </button>
    </div>
  );
}

function GraduationStage({
  name, score, correct, badge, onReplay, onHome,
}: {
  name: string; score: number; correct: number;
  badge: ReturnType<typeof highestAchievement>;
  onReplay: () => void; onHome: () => void;
}) {
  return (
    <div className="fade-in-up glass relative w-full max-w-3xl rounded-3xl p-10 text-center overflow-hidden">
      {/* Cinematic spotlight on graduate */}
      <div className="pointer-events-none absolute inset-0 spotlight" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[180%] w-[140%] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,221,150,0.35), transparent 55%)",
        }}
      />
      <Confetti burst />
      <Sparkles />

      {/* Animated crown above title */}
      <div className="relative">
        <div
          className="absolute left-1/2 -top-8 -translate-x-1/2 text-5xl"
          style={{ animation: "crownBob 2.4s ease-in-out infinite", filter: "drop-shadow(0 0 18px rgba(246,198,81,0.7))" }}
        >
          👑
        </div>
      </div>

      <div className="pop-in font-display text-3xl md:text-5xl gold-text mt-6">
        🎉 Congratulations, {name || "Voice Actor"}!
      </div>
      <p className="mt-3 text-amber-100/90">You have officially graduated from VoiceQuest Academy.</p>
      <p className="mt-2 text-sm text-amber-100/70 italic">
        Your voice has completed its journey through emotion, tone, and performance.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Stat label="⭐ Final Score" value={`${score} / 120`} />
        <Stat label="🎭 Correct Scenes" value={`${correct} / ${SCENES.length}`} />
        <Stat label="🏆 Final Academy Title" value={badge ? `${badge.icon} ${badge.title}` : "—"} color={badge?.color} />
      </div>

      {badge && (
        <div className="pop-in mt-8 inline-block rounded-2xl border-2 px-6 py-3 text-xl font-semibold pulse-glow"
             style={{ borderColor: badge.color, color: badge.color }}>
          {badge.icon} {badge.title}
        </div>
      )}

      <p className="mt-4 text-sm text-amber-100/80">🎓 Graduation Status: Successfully Completed</p>

      <p className="mt-8 text-amber-50/90">
        "Every voice has power. You have learned to shape emotion, meaning, and character through yours."
      </p>
      <p className="mt-2 text-sm text-amber-100/70">
        Thank you for training at VoiceQuest Academy — where voices bring stories to life.
      </p>

      <CreditCard className="relative z-10 mx-auto mt-6 max-w-md text-center">
        <div className="font-semibold text-amber-200">🎵 Graduation Theme Music</div>
        <div className="mt-2 text-amber-50/90">MUSDO (YouTube)</div>
      </CreditCard>

      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onReplay} className="btn-gold rounded-2xl px-6 py-3 font-semibold">🔄 Play Again</button>
        <button onClick={onHome} className="rounded-2xl border border-amber-200/50 px-6 py-3 font-semibold text-amber-100 hover:bg-white/5">
          🏠 Return to Home
        </button>
      </div>

      <CreditCard className="relative z-10 mx-auto mt-8 max-w-xl text-left">
        <div className="text-center font-semibold uppercase tracking-[0.25em] text-amber-200">🎬 Credits</div>
        <div className="mt-4 space-y-3 text-amber-50/85">
          <div>
            <div className="font-semibold text-amber-200">Intonation Example Video:</div>
            <div>@solennaeap on TikTok</div>
          </div>
          <div>
            <div className="font-semibold text-amber-200">🎵 Academy Theme Music:</div>
            <div>Tonbo (YouTube)</div>
          </div>
          <div>
            <div className="font-semibold text-amber-200">🎵 Graduation Theme Music:</div>
            <div>MUSDO (YouTube)</div>
          </div>
        </div>
      </CreditCard>

      <div className="relative z-10 mx-auto mt-6 max-w-2xl rounded-3xl border-2 border-amber-300/50 bg-black/70 p-6 text-left shadow-[0_20px_60px_-20px_rgba(246,198,81,0.55)] backdrop-blur-md">
        <div className="text-center font-display text-2xl gold-text">
          🏫 Special Thanks from VoiceQuest Academy
        </div>
        <div className="mx-auto mt-2 h-[2px] w-32 rounded-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

        <div className="mt-5 grid gap-3 sm:grid-cols-1">
          <div className="rounded-2xl border border-amber-200/30 bg-black/40 p-4 text-center">
            <div className="text-2xl">🎓</div>
            <div className="mt-1 font-display text-lg text-amber-100">Ms. Ramadhani</div>
            <div className="text-xs uppercase tracking-widest text-amber-200/80">
              Headmaster of VoiceQuest Academy
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200/30 bg-black/40 p-4 text-center">
            <div className="text-2xl">🎬</div>
            <div className="mt-1 font-display text-lg text-amber-100">Ms. Qistina</div>
            <div className="text-xs uppercase tracking-widest text-amber-200/80">
              Director of Voice Performance Training
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200/30 bg-black/40 p-4 text-center">
            <div className="text-2xl">🎤</div>
            <div className="mt-1 font-display text-lg text-amber-100">Ms. Hadifah</div>
            <div className="text-xs uppercase tracking-widest text-amber-200/80">
              Chief Recording Booth Supervisor
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-900/30 to-black/50 p-5 text-center">
          <div className="font-display text-lg text-amber-200">
            🌟 Special Thanks to All VoiceQuest Academy Students
          </div>
          <p className="mt-3 text-sm leading-relaxed text-amber-50/90">
            Thank you for participating in your voice acting training journey.
          </p>
          <p className="mt-2 text-sm italic leading-relaxed text-amber-100/85">
            Every great voice actor begins with a single line, a single emotion,
            and the courage to perform.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-50/90">
            Keep exploring, keep expressing, and keep bringing stories to life through your voice.
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-200">
            The VoiceQuest Academy team is proud of your achievement.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes crownBob {
          0%,100% { transform: translate(-50%, 0) rotate(-4deg); }
          50%     { transform: translate(-50%, -8px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-amber-200/30 bg-black/40 p-4">
      <div className="text-xs uppercase tracking-widest text-amber-200/70">{label}</div>
      <div className="mt-1 font-display text-2xl" style={{ color: color || "var(--gold-glow)" }}>{value}</div>
    </div>
  );
}

function AchievementPopup({ a, scoreReached }: { a: typeof ACHIEVEMENTS[number]; scoreReached: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-[achFade_0.4s_ease-out]">
      {/* Dimmed, blurred backdrop blocks all background content */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <Sparkles />
      <div
        className="relative mx-4 w-full max-w-lg rounded-3xl border-4 px-10 py-10 text-center animate-[achPopIn_0.5s_cubic-bezier(.2,1.4,.4,1)]"
        style={{
          borderColor: a.color,
          background: "linear-gradient(160deg, #0b0820 0%, #160a2e 60%, #08040f 100%)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 30px 90px -10px rgba(0,0,0,0.9), 0 0 80px ${a.color}, 0 0 160px ${a.color}55`,
        }}
      >
        {/* Academy badge ring */}
        <div
          className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 text-5xl animate-[achGlow_2.4s_ease-in-out_infinite]"
          style={{
            borderColor: a.color,
            background: "radial-gradient(circle at 50% 35%, rgba(255,225,150,0.18), rgba(0,0,0,0.6) 70%)",
            boxShadow: `inset 0 0 24px ${a.color}, 0 0 30px ${a.color}`,
          }}
        >
          {a.icon}
        </div>

        <div className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
          🏆 Achievement Unlocked!
        </div>
        <div className="mt-3 font-display text-4xl md:text-5xl font-bold gold-text drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {a.title.toUpperCase()}
        </div>
        <div
          className="mt-4 inline-block rounded-full border px-4 py-1 text-sm font-semibold"
          style={{ borderColor: a.color, color: a.color, background: "rgba(0,0,0,0.45)" }}
        >
          You have reached {scoreReached} Academy Marks!
        </div>
        <div className="mt-5 text-sm italic text-amber-100/90">"{a.description}"</div>
      </div>
      <style>{`
        @keyframes achPopIn {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes achFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes achGlow {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}

function Confetti({ burst = false }: { burst?: boolean }) {
  const count = burst ? 120 : 40;
  const bits = Array.from({ length: count });
  const colors = ["#f6c651", "#ffd98a", "#e35d6a", "#9b87f5", "#22c55e", "#38bdf8", "#fff7c2"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((_, i) => {
        const duration = 3 + ((i * 7) % 40) / 10;
        const delay = burst ? (i % 20) * 0.05 : i * 0.1;
        const size = burst ? 6 + (i % 6) : 8;
        return (
          <span
            key={i}
            className="absolute block rounded-sm"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `-${(i * 7) % 40}px`,
              width: size,
              height: size * 0.5,
              background: colors[i % colors.length],
              animation: `confetti ${duration}s cubic-bezier(.3,.7,.4,1) ${delay}s ${burst ? "1" : "infinite"} forwards`,
              transform: `rotate(${(i * 47) % 360}deg)`,
              opacity: 0.9,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Sparkles() {
  const sparkles = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparkles.map((_, i) => (
        <span
          key={i}
          className="absolute text-amber-200"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 61) % 100}%`,
            fontSize: `${10 + (i % 4) * 4}px`,
            animation: `sparkle ${2 + (i % 4)}s ease-in-out ${i * 0.15}s infinite`,
            filter: "drop-shadow(0 0 6px rgba(255,225,150,0.8))",
          }}
        >
          ✨
        </span>
      ))}
      <style>{`
        @keyframes sparkle {
          0%,100% { opacity: 0; transform: scale(0.6); }
          50%     { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

