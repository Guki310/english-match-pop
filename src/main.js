import "./styles.css";

const WORDS = [
  { id: "apple", word: "apple", cn: "苹果", emoji: "🍎", color: "#ff6f7d" },
  { id: "banana", word: "banana", cn: "香蕉", emoji: "🍌", color: "#ffd45a" },
  { id: "cat", word: "cat", cn: "猫", emoji: "🐱", color: "#ff9f43" },
  { id: "dog", word: "dog", cn: "狗", emoji: "🐶", color: "#b38cff" },
  { id: "fish", word: "fish", cn: "鱼", emoji: "🐟", color: "#4fc3f7" },
  { id: "bird", word: "bird", cn: "鸟", emoji: "🐦", color: "#70d6ff" },
  { id: "sun", word: "sun", cn: "太阳", emoji: "☀️", color: "#ffb703" },
  { id: "moon", word: "moon", cn: "月亮", emoji: "🌙", color: "#8ecae6" },
  { id: "star", word: "star", cn: "星星", emoji: "⭐", color: "#f6c85f" },
  { id: "tree", word: "tree", cn: "树", emoji: "🌳", color: "#64c27b" },
  { id: "flower", word: "flower", cn: "花", emoji: "🌸", color: "#ff8fab" },
  { id: "car", word: "car", cn: "汽车", emoji: "🚗", color: "#ef476f" },
  { id: "train", word: "train", cn: "火车", emoji: "🚂", color: "#6c91bf" },
  { id: "cake", word: "cake", cn: "蛋糕", emoji: "🍰", color: "#ffafcc" },
  { id: "milk", word: "milk", cn: "牛奶", emoji: "🥛", color: "#a8dadc" },
  { id: "book", word: "book", cn: "书", emoji: "📚", color: "#7bdff2" },
  { id: "ball", word: "ball", cn: "球", emoji: "⚽", color: "#9be564" },
  { id: "hat", word: "hat", cn: "帽子", emoji: "🎩", color: "#c77dff" },
];

const LEVELS = {
  tiny: { label: "6 组", pairs: 6 },
  happy: { label: "8 组", pairs: 8 },
  brave: { label: "10 组", pairs: 10 },
};

const app = document.querySelector("#app");
const AudioContext = window.AudioContext || window.webkitAudioContext;

const music = {
  context: null,
  gain: null,
  timer: null,
  step: 0,
};

const state = {
  level: "happy",
  cards: [],
  selected: [],
  matched: new Set(),
  locked: false,
  moves: 0,
  score: 0,
  combo: 0,
  sound: true,
  music: false,
  message: "选图片，再选英文",
  best: Number(localStorage.getItem("english-match-best") || 0),
};

const MELODY = [
  { note: 523.25, length: 0.32 },
  { note: 659.25, length: 0.32 },
  { note: 783.99, length: 0.48 },
  { note: 659.25, length: 0.32 },
  { note: 587.33, length: 0.32 },
  { note: 698.46, length: 0.48 },
  { note: 659.25, length: 0.32 },
  { note: 523.25, length: 0.56 },
];

const BASS = [261.63, 329.63, 392.0, 349.23];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeCards() {
  const words = shuffle(WORDS).slice(0, LEVELS[state.level].pairs);
  return shuffle(
    words.flatMap((item) => [
      { ...item, uid: `${item.id}-picture`, type: "picture" },
      { ...item, uid: `${item.id}-word`, type: "word" },
    ]),
  );
}

function startRound(level = state.level) {
  state.level = level;
  state.cards = makeCards();
  state.selected = [];
  state.matched = new Set();
  state.locked = false;
  state.moves = 0;
  state.score = 0;
  state.combo = 0;
  state.message = "选图片，再选英文";
  render();
}

function selectCard(card) {
  if (state.locked || state.matched.has(card.id)) return;
  if (state.selected.some((item) => item.uid === card.uid)) return;

  const sameType = state.selected.length === 1 && state.selected[0].type === card.type;
  state.selected = sameType ? [card] : [...state.selected, card];

  if (state.selected.length < 2) {
    state.message = card.type === "picture" ? "再找英文单词" : "再找对应图片";
    render();
    return;
  }

  state.moves += 1;
  const [first, second] = state.selected;
  const isMatch = first.id === second.id && first.type !== second.type;

  if (isMatch) {
    state.combo += 1;
    state.score += 10 + state.combo * 2;
    state.matched.add(card.id);
    state.message = `Yes! ${card.word}`;
    speak(card.word);
    state.selected = [];
    persistBest();
    render();
    return;
  }

  state.combo = 0;
  state.score = Math.max(0, state.score - 1);
  state.message = "再试一次";
  state.locked = true;
  render();

  window.setTimeout(() => {
    state.selected = [];
    state.locked = false;
    state.message = "选图片，再选英文";
    render();
  }, 780);
}

function persistBest() {
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("english-match-best", String(state.best));
  }
}

function speak(word) {
  if (!state.sound || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  utterance.pitch = 1.18;
  window.speechSynthesis.speak(utterance);
}

function ensureMusic() {
  if (!AudioContext) return false;
  if (!music.context) {
    music.context = new AudioContext();
    music.gain = music.context.createGain();
    music.gain.gain.value = 0.055;
    music.gain.connect(music.context.destination);
  }
  return true;
}

function playTone(frequency, start, length, volume, type = "sine") {
  const oscillator = music.context.createOscillator();
  const noteGain = music.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  noteGain.gain.setValueAtTime(0.0001, start);
  noteGain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(noteGain);
  noteGain.connect(music.gain);
  oscillator.start(start);
  oscillator.stop(start + length + 0.03);
}

function scheduleMusic() {
  if (!state.music || !music.context) return;
  const item = MELODY[music.step % MELODY.length];
  const now = music.context.currentTime;
  const bass = BASS[Math.floor(music.step / 2) % BASS.length];

  playTone(item.note, now, item.length, 0.34);
  if (music.step % 2 === 0) {
    playTone(bass, now, 0.5, 0.18, "triangle");
  }

  music.step += 1;
  music.timer = window.setTimeout(scheduleMusic, item.length * 1000);
}

async function toggleMusic() {
  if (!ensureMusic()) return;

  state.music = !state.music;
  if (state.music) {
    await music.context.resume();
    scheduleMusic();
  } else {
    window.clearTimeout(music.timer);
    music.timer = null;
  }
  render();
}

function isSelected(card) {
  return state.selected.some((item) => item.uid === card.uid);
}

function isComplete() {
  return state.matched.size === LEVELS[state.level].pairs;
}

function stars() {
  const mistakes = Math.max(0, state.moves - LEVELS[state.level].pairs);
  if (mistakes <= 1) return "★★★";
  if (mistakes <= 4) return "★★☆";
  return "★☆☆";
}

function cardTemplate(card) {
  const matched = state.matched.has(card.id);
  const selected = isSelected(card);
  const label =
    card.type === "picture" ? `图片 ${card.cn}` : `英文单词 ${card.word}`;

  return `
    <button
      class="match-card ${card.type} ${selected ? "is-selected" : ""} ${matched ? "is-matched" : ""}"
      style="--card-color: ${card.color}"
      aria-label="${label}"
      ${matched ? "disabled" : ""}
      data-card="${card.uid}"
    >
      <span class="spark spark-one"></span>
      <span class="spark spark-two"></span>
      ${
        card.type === "picture"
          ? `<span class="bubble"><span class="blush blush-left"></span><span class="blush blush-right"></span><span class="emoji" aria-hidden="true">${card.emoji}</span></span>`
          : `<span class="word-wrap"><span class="word">${card.word}</span><span class="word-dots" aria-hidden="true"></span></span><span class="sound-mark">Aa</span>`
      }
    </button>
  `;
}

function render() {
  const complete = isComplete();

  app.innerHTML = `
    <section class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">English Match Pop</p>
          <h1>英语消消乐</h1>
        </div>
        <div class="actions" aria-label="游戏设置">
          <select id="level" aria-label="选择卡片数量">
            ${Object.entries(LEVELS)
              .map(
                ([key, level]) =>
                  `<option value="${key}" ${key === state.level ? "selected" : ""}>${level.label}</option>`,
              )
              .join("")}
          </select>
          <button class="icon-button" id="sound" aria-label="发音开关" title="发音">
            ${state.sound ? "🔊" : "🔇"}
          </button>
          <button class="icon-button ${state.music ? "is-on" : ""}" id="music" aria-label="背景音乐开关" title="背景音乐">
            ${state.music ? "🎵" : "🎶"}
          </button>
          <button class="primary" id="restart">新一局</button>
        </div>
      </header>

      <section class="scoreboard" aria-label="当前成绩">
        <div>
          <span>分数</span>
          <strong>${state.score}</strong>
        </div>
        <div>
          <span>步数</span>
          <strong>${state.moves}</strong>
        </div>
        <div>
          <span>最好</span>
          <strong>${state.best}</strong>
        </div>
      </section>

      <div class="message ${complete ? "is-complete" : ""}">
        <span>${complete ? "全部配对成功" : state.message}</span>
        <strong>${complete ? stars() : state.combo > 1 ? `Combo x${state.combo}` : ""}</strong>
      </div>

      <section class="board" aria-label="英语配对卡片">
        ${state.cards.map(cardTemplate).join("")}
      </section>

      <section class="celebration ${complete ? "show" : ""}" aria-live="polite">
        <div class="badge">🎉</div>
        <h2>完成啦</h2>
        <p>${stars()}  得分 ${state.score}</p>
        <button class="primary" id="again">再玩一次</button>
      </section>
    </section>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector("#restart").addEventListener("click", () => startRound());
  document.querySelector("#level").addEventListener("change", (event) => {
    startRound(event.target.value);
  });
  document.querySelector("#sound").addEventListener("click", () => {
    state.sound = !state.sound;
    render();
  });
  document.querySelector("#music").addEventListener("click", () => {
    toggleMusic();
  });

  document.querySelector("#again")?.addEventListener("click", () => startRound());

  document.querySelectorAll("[data-card]").forEach((button) => {
    const card = state.cards.find((item) => item.uid === button.dataset.card);
    button.addEventListener("click", () => selectCard(card));
  });
}

startRound();
