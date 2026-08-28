const positions = {
  pitcher: { name: "投手", power: 42, technique: 36, defense: 24, stamina: 34, mindset: 30 },
  catcher: { name: "捕手", power: 32, technique: 34, defense: 42, stamina: 34, mindset: 34 },
  infielder: { name: "內野手", power: 30, technique: 38, defense: 40, stamina: 32, mindset: 31 },
  outfielder: { name: "外野手", power: 37, technique: 31, defense: 35, stamina: 38, mindset: 30 },
};

const seasons = [
  "高一 春季",
  "高一 夏季",
  "高一 秋季",
  "高二 春季",
  "高二 夏季",
  "高二 秋季",
  "高三 春季",
  "高三 夏季",
  "選秀前夜",
];

const actionDefs = [
  {
    key: "weight",
    title: "重量與爆發",
    desc: "提升力量與體能，壓力小幅上升。",
    gains: { power: [3, 8], stamina: [1, 4], stress: [2, 6] },
  },
  {
    key: "skill",
    title: "技術特訓",
    desc: "提升控球、打擊手感或傳接穩定度。",
    gains: { technique: [3, 8], defense: [1, 4], stress: [1, 5] },
  },
  {
    key: "game",
    title: "實戰拚聲量",
    desc: "用比賽累積名氣，但表現會受運氣影響。",
    gains: { fame: [4, 12], mindset: [0, 5], stress: [3, 9] },
  },
  {
    key: "recover",
    title: "調整與復原",
    desc: "降低壓力，心態更穩，但能力成長較少。",
    gains: { mindset: [2, 6], stamina: [0, 3], stress: [-12, -5] },
  },
];

const eventPool = [
  { text: "雨後場地濕滑，你提早到球場幫忙整備，教練默默記住了。", effect: { mindset: 3, fame: 1 } },
  { text: "校內練習賽碰上學長壓迫，你在關鍵局數穩住節奏。", effect: { technique: 3, mindset: 2 } },
  { text: "肩膝有些緊繃，防護員要求你把訓練量收斂一點。", effect: { stamina: -2, stress: -4 } },
  { text: "地方球探來看比賽，你的一次好表現被記在筆記本裡。", effect: { fame: 5 } },
  { text: "連續失誤讓休息室安靜下來，你選擇留下來多做基礎動作。", effect: { defense: 3, stress: 3 } },
  { text: "隊友陷入低潮，你陪他加練，也讓自己重新想起打球的理由。", effect: { mindset: 4, stress: -2 } },
];

let selectedPosition = "pitcher";
let state = null;

const $ = (id) => document.getElementById(id);

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomFromState() {
  state.rng = (1664525 * state.rng + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function roll(min, max) {
  return Math.floor(randomFromState() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function newGame(form) {
  const name = $("playerName").value.trim() || "無名新秀";
  const number = clamp(Number($("playerNumber").value || 0), 0, 99);
  const seed = $("seedInput").value.trim() || makeSeed();
  const base = positions[selectedPosition];

  state = {
    name,
    number,
    seed,
    position: selectedPosition,
    seasonIndex: 0,
    rng: hashSeed(`${seed}:${name}:${selectedPosition}`),
    stats: {
      power: base.power,
      technique: base.technique,
      defense: base.defense,
      stamina: base.stamina,
      mindset: base.mindset,
      fame: 0,
      stress: 10,
    },
    log: [`${name}穿上 ${number} 號球衣，加入高中棒球隊。`],
    finished: false,
  };

  form.reset();
  $("seedInput").value = seed;
  $("startPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  save();
  render();
}

function applyEffect(effect) {
  Object.entries(effect).forEach(([key, value]) => {
    state.stats[key] = clamp((state.stats[key] || 0) + value, 0, 100);
  });
}

function actionSummary(action, event) {
  const impact = Object.entries(action.gains)
    .map(([key, range]) => {
      const value = roll(range[0], range[1]);
      applyEffect({ [key]: value });
      return { key, value };
    })
    .filter((item) => item.value !== 0);

  applyEffect(event.effect);
  const impactText = impact.map(({ key, value }) => `${statLabel(key)} ${value > 0 ? "+" : ""}${value}`).join("、");
  const eventText = Object.entries(event.effect)
    .map(([key, value]) => `${statLabel(key)} ${value > 0 ? "+" : ""}${value}`)
    .join("、");

  return `${action.title}：${impactText}。${event.text}（${eventText}）`;
}

function takeAction(key) {
  if (state.finished) {
    reset();
    return;
  }

  const action = actionDefs.find((item) => item.key === key);
  const event = eventPool[roll(0, eventPool.length - 1)];
  const season = seasons[state.seasonIndex];
  const summary = actionSummary(action, event);
  state.log.unshift(`${season}｜${summary}`);
  state.seasonIndex += 1;

  if (state.seasonIndex >= seasons.length) {
    finishCareer();
  }

  save();
  render(summary);
}

function finishCareer() {
  const score = overall() + state.stats.fame + state.stats.mindset - Math.floor(state.stats.stress * 0.55);
  let ending = "獲得獨立聯盟邀請，先從更長的路開始。";

  if (score >= 185) ending = "第一輪被職業球隊指名，成為全國注目的超級新秀。";
  else if (score >= 155) ending = "在選秀中段獲得指名，踏進職棒體系。";
  else if (score >= 125) ending = "收到大學強校與業餘隊邀約，選擇繼續磨練。";

  state.finished = true;
  state.log.unshift(`選秀結果｜${ending}`);
}

function overall() {
  const { power, technique, defense, stamina, mindset } = state.stats;
  return Math.round((power + technique + defense + stamina + mindset) / 5);
}

function statLabel(key) {
  return {
    power: "力量",
    technique: "技術",
    defense: "守備",
    stamina: "體能",
    mindset: "心態",
    fame: "聲望",
    stress: "壓力",
  }[key];
}

function render(resultText = "") {
  const pos = positions[state.position];
  $("seasonLabel").textContent = state.finished ? "生涯第一章完結" : seasons[state.seasonIndex];
  $("playerTitle").textContent = `NO.${state.number} ${state.name}`;
  $("jerseyNo").textContent = state.number;
  $("cardName").textContent = state.name;
  $("positionName").textContent = pos.name;
  $("overall").textContent = overall();
  $("fame").textContent = state.stats.fame;
  $("stress").textContent = state.stats.stress;

  ["power", "technique", "defense", "stamina", "mindset"].forEach((key) => {
    $(key).textContent = state.stats[key];
  });

  $("phaseTitle").textContent = state.finished ? "未來去向" : "本季目標";
  $("storyTitle").textContent = state.finished ? "選秀會結束" : "你要怎麼安排這一季？";
  $("storyText").textContent = state.finished
    ? state.log[0].replace("選秀結果｜", "")
    : "每個選擇都會改變能力、聲望與壓力。高三結束時，球探會用你的整體狀態決定下一站。";

  $("actions").innerHTML = state.finished
    ? '<button type="button" data-action="restart"><strong>建立下一位球員</strong><span>用新的種子與位置展開另一段人生。</span></button>'
    : actionDefs
        .map(
          (action) =>
            `<button type="button" data-action="${action.key}"><strong>${action.title}</strong><span>${action.desc}</span></button>`,
        )
        .join("");

  $("careerLog").innerHTML = state.log.map((item) => `<li>${item}</li>`).join("");
  $("resultBox").classList.toggle("hidden", !resultText);
  $("resultBox").textContent = resultText;
}

function save() {
  localStorage.setItem("diamond-road-state", JSON.stringify(state));
}

function restore() {
  const saved = localStorage.getItem("diamond-road-state");
  if (!saved) return;
  state = JSON.parse(saved);
  $("startPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  render();
}

function reset() {
  state = null;
  localStorage.removeItem("diamond-road-state");
  $("gamePanel").classList.add("hidden");
  $("startPanel").classList.remove("hidden");
  $("seedInput").value = makeSeed();
}

document.querySelectorAll("[data-position]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedPosition = button.dataset.position;
    document.querySelectorAll("[data-position]").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
});

$("creatorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  newGame(event.currentTarget);
});

$("actions").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "restart") reset();
  else takeAction(button.dataset.action);
});

$("randomSeed").addEventListener("click", () => {
  $("seedInput").value = makeSeed();
});

$("resetGame").addEventListener("click", reset);

$("seedInput").value = makeSeed();
restore();
