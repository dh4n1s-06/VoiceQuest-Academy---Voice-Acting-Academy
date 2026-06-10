import v1 from "@/assets/videos/video1.mp4.asset.json";
import v2 from "@/assets/videos/video2.mp4.asset.json";
import v3 from "@/assets/videos/video3.mp4.asset.json";
import v4 from "@/assets/videos/video4.mp4.asset.json";
import v5 from "@/assets/videos/video5.mp4.asset.json";
import v6 from "@/assets/videos/video6.mp4.asset.json";
import v7 from "@/assets/videos/video7.mp4.asset.json";
import v8 from "@/assets/videos/video8.mp4.asset.json";
import v9 from "@/assets/videos/video9.mp4.asset.json";
import v10 from "@/assets/videos/video10.mp4.asset.json";
import v11 from "@/assets/videos/video11.mp4.asset.json";
import v12 from "@/assets/videos/video12.mp4.asset.json";
import a1 from "@/assets/audio/audio1.mp3.asset.json";
import a2 from "@/assets/audio/audio2.mp3.asset.json";
import a3 from "@/assets/audio/audio3.mp3.asset.json";
import a4 from "@/assets/audio/audio4.mp3.asset.json";
import a5 from "@/assets/audio/audio5.mp3.asset.json";
import a6 from "@/assets/audio/audio6.mp3.asset.json";
import a7 from "@/assets/audio/audio7.mp3.asset.json";
import a8 from "@/assets/audio/audio8.mp3.asset.json";
import a9 from "@/assets/audio/audio9.mp3.asset.json";
import a10 from "@/assets/audio/audio10.mp3.asset.json";
import a11 from "@/assets/audio/audio11.mp3.asset.json";
import a12 from "@/assets/audio/audio12.mp3.asset.json";

export interface Scene {
  id: number;
  film: string;
  character: string;
  line: string;
  options: string[];
  correct: string;
  video: string | null;
  audio: string;
  positive: string;
}

const V = [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12].map((x) => x.url);
const A = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12].map((x) => x.url);


export const SCENES: Scene[] = [
  {
    id: 1, film: "A Bridgerton Story", character: "Charlotte", line: "Do you love me?",
    options: ["Happy", "Sad", "Desperate", "Calm"], correct: "Desperate",
    video: V[0], audio: A[1-1],
    positive: "You sounded like a character desperately searching for an answer.",
  },
  {
    id: 2, film: "Frozen", character: "Elsa", line: "Marriage?",
    options: ["Excited", "Confused", "Fear", "Angry"], correct: "Confused",
    video: V[1], audio: A[2-1],
    positive: "You brought the character's confusion to life through your voice.",
  },
  {
    id: 3, film: "Avengers: Infinity War", character: "Spiderman", line: "I don't feel so good.",
    options: ["Brave", "Cheerful", "Surprised", "Scared"], correct: "Scared",
    video: V[2], audio: A[3-1],
    positive: "You sounded like a character who was frightened and unsure.",
  },
  {
    id: 4, film: "Rush Hour 3", character: "Carter", line: "Shut up!",
    options: ["Angry", "Surprised", "Happy", "Confused"], correct: "Angry",
    video: V[3], audio: A[4-1],
    positive: "Powerful performance! You captured strong anger.",
  },
  {
    id: 5, film: "Despicable Me", character: "Edith", line: "What about this?",
    options: ["Grumpy", "Curious", "Sad", "Surprised"], correct: "Curious",
    video: V[4], audio: A[5-1],
    positive: "You sounded full of curiosity, trying to understand.",
  },
  {
    id: 6, film: "Barbie", character: "Barbie", line: "What are you doing here?",
    options: ["Bubbly", "Calm", "Shocked", "Hurtful"], correct: "Shocked",
    video: V[5], audio: A[6-1],
    positive: "Completely shocked and caught off guard — outstanding!",
  },
  {
    id: 7, film: "Mean Girls", character: "Regina", line: "So you agree?",
    options: ["Angry", "Sarcastic", "Shocked", "Sad"], correct: "Sarcastic",
    video: V[6], audio: A[7-1],
    positive: "Your intonation showed the character didn't truly mean it.",
  },
  {
    id: 8, film: "The Angry Birds Movie 2", character: "Zoe", line: "They are hatching!",
    options: ["Worried", "Curious", "Excited", "Regretful"], correct: "Excited",
    video: V[7], audio: A[8-1],
    positive: "Your intonation reflected a joyful and expressive character.",
  },
  {
    id: 9, film: "Inside Out", character: "Bing Bong", line: "Take her to the moon for me.",
    options: ["Sarcastic", "Shocked", "Angry", "Sad"], correct: "Sad",
    video: V[8], audio: A[9-1],
    positive: "A truly sad character struggling with their emotions.",
  },
  {
    id: 10, film: "Tangled", character: "Rapunzel", line: "What do you want with my hair?",
    options: ["Friendly", "Shocked", "Suspicious", "Confused"], correct: "Suspicious",
    video: V[9], audio: A[10-1],
    positive: "Clearly cautious and skeptical — well done!",
  },
  {
    id: 11, film: "The Lion King", character: "Simba", line: "I was just trying to be brave like you…",
    options: ["Joyful", "Guilty", "Shocked", "Proud"], correct: "Guilty",
    video: V[10], audio: A[11-1],
    positive: "Soft and emotional tone that expressed guilt naturally.",
  },
  {
    id: 12, film: "Inside Out 2", character: "Riley", line: "I'm not good enough.",
    options: ["Angry", "Surprised", "Annoyed", "Anxious"], correct: "Anxious",
    video: V[11], audio: A[12-1],
    positive: "Sounded like a character struggling with self-doubt and anxiety.",
  },
];

export interface Achievement {
  threshold: number; // minimum total score to unlock
  title: string;
  icon: string;
  color: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    threshold: 30,
    title: "Intonation Rookie",
    icon: "🎭",
    color: "#22c55e",
    description: "You're beginning your journey as a voice actor.",
  },
  {
    threshold: 55,
    title: "Confident Speaker",
    icon: "🎤",
    color: "#3b82f6",
    description: "Your voice is becoming stronger and more expressive.",
  },
  {
    threshold: 80,
    title: "Drama Queen",
    icon: "🎬",
    color: "#a855f7",
    description: "You know how to bring emotions to life through performance.",
  },
  {
    threshold: 105,
    title: "Voice Acting Legend",
    icon: "👑",
    color: "#f59e0b",
    description: "You have mastered the art of intonation and voice acting.",
  },
];
