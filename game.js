const abilitySets = {
  pitcher: ["體力", "球速", "控球", "變化球"],
  catcher: ["體力", "contact", "力量", "速度", "選球", "守備範圍", "接球", "臂力", "配球"],
  infielder: ["體力", "contact", "力量", "速度", "選球", "守備範圍", "接球", "臂力"],
  outfielder: ["體力", "contact", "力量", "速度", "選球", "守備範圍", "接球", "臂力"],
};

const positionNames = {
  pitcher: "投手",
  catcher: "捕手",
  infielder: "內野手",
  outfielder: "外野手",
};

const eventPool = [
  {
    title: "球探的座位",
    text: "看台上出現幾張陌生面孔。你知道今天不是普通的一天，但沒有人會告訴你該怎麼打。",
    options: [
      { label: "照平常節奏", desc: "成功率高，成長較小。", chance: 75, growth: 1, fame: 1 },
      { label: "提高強度", desc: "成功率中等，可能得到明顯成長。", chance: 55, growth: 2, fame: 3 },
      { label: "賭一場代表作", desc: "成功率低，報酬最高。", chance: 35, growth: 4, fame: 7, injuryRisk: 3 },
    ],
  },
  {
    title: "狀態忽然很好",
    text: "今年某段時間，球就是看得特別清楚，身體也比想像中聽話。",
    options: [
      { label: "把手感留在比賽", desc: "偏向比賽評價與賽後點數。", chance: 70, growth: 1, postBonus: 2, fame: 2 },
      { label: "趁勢加練", desc: "偏向指定能力成長。", chance: 60, growth: 3, fame: 1 },
      { label: "挑戰更難的東西", desc: "可能突破舒適圈。", chance: 42, growth: 4, postBonus: 1, injuryRisk: 2 },
    ],
  },
  {
    title: "一年裡的小低潮",
    text: "有幾週，你怎麼練都不太對。這不是數字能解釋的事，只能看你怎麼撐過去。",
    options: [
      { label: "保守度過", desc: "少拿一點成長，穩住年度。", chance: 82, growth: 1, postBonus: 0 },
      { label: "尋找新方法", desc: "中等風險，可能打開另一個能力。", chance: 58, growth: 2, postBonus: 1 },
      { label: "硬拚到底", desc: "可能大起，也可能少出場。", chance: 33, growth: 5, postBonus: 2, injuryRisk: 4 },
    ],
  },
  {
    title: "關鍵大賽",
    text: "這一年的大賽排進了你的生涯紀錄。沒有人知道它是不是轉捩點，直到多年後回頭看。",
    options: [
      { label: "以穩定為先", desc: "高成功率，小幅累積外界評價。", chance: 78, growth: 1, fame: 2, postBonus: 1 },
      { label: "主動承擔", desc: "成功時會拿到不錯的賽後點數。", chance: 55, growth: 2, fame: 4, postBonus: 3 },
      { label: "把全場扛起來", desc: "高風險高報酬。", chance: 30, growth: 4, fame: 8, postBonus: 5, injuryRisk: 4 },
    ],
  },
];

const pitcherEfforts = {
  hard: { label: "用力投", desc: "今年更拚表現與成長，但肩肘負擔增加最多。", arm: 16, fame: 1, post: 1 },
  normal: { label: "正常投", desc: "維持一般投球強度。", arm: 8, fame: 0, post: 0 },
  easy: { label: "養生投", desc: "保守使用身體，短期成長較少但肩肘負擔較輕。", arm: 2, fame: 0, post: -1 },
};

let selectedPosition = "pitcher";
let state = null;
let currentDieIndex = 0;
let dockCollapsed = false;

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

function schoolYear(age) {
  if (age === 16) return "高一";
  if (age === 17) return "高二";
  if (age === 18) return "高三";
  return "";
}

function stageLabel() {
  if (state.finished) return "完結";
  if (state.stage === "highschool") return schoolYear(state.age);
  if (state.stage === "college") return `大學 ${state.collegeYear} 年`;
  if (state.level === "farm") return `${state.route} 二軍`;
  if (state.level === "majors") return `${state.route} 一軍`;
  return state.route || "未定";
}

function newGame(form) {
  const name = $("playerName").value.trim() || "無名新秀";
  const number = clamp(Number($("playerNumber").value || 0), 0, 99);
  const seed = $("seedInput").value.trim() || makeSeed();

  state = {
    name,
    number,
    seed,
    position: selectedPosition,
    birthYear: 2010,
    year: 2026,
    age: 16,
    stage: "highschool",
    route: "高中",
    level: "school",
    collegeYear: 0,
    rng: hashSeed(`${seed}:${name}:${selectedPosition}`),
    stats: {},
    fame: 0,
    careerSalary: 0,
    armLoad: null,
    injuryRisk: 0,
    injuryHistory: [],
    lastYearInjuryStatus: "none",
    yearInjuryStatus: "none",
    dice: [],
    yearEvents: [],
    eventIndex: 0,
    yearlyEventResults: [],
    currentEvent: null,
    selectedEvent: null,
    competitionResult: null,
    postPoints: 0,
    pendingPostBonus: 0,
    phase: "dice",
    feed: [],
    log: [`${name}穿上 ${number} 號球衣，從${schoolYear(16)}開始這段棒球人生。`],
    finished: false,
  };

  state.stats = makeStats(abilitySets[selectedPosition]);
  state.armLoad = selectedPosition === "pitcher" ? roll(0, 8) : null;
  addFeedCard("intro", "球員誕生", `${name}穿上 ${number} 號球衣，從${schoolYear(16)}開始這段棒球人生。`, `${state.year}`);
  startYear();
  form.reset();
  $("seedInput").value = seed;
  $("startPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  save();
  render();
}

function makeStats(abilities) {
  return abilities.reduce((stats, ability) => {
    const talentCap = roll(55, 86);
    stats[ability] = {
      value: roll(18, 36),
      talentCap,
      overCapCostMultiplier: talentCap >= 76 ? 2 : 3,
      growthProgress: 0,
    };
    return stats;
  }, {});
}

function startYear() {
  currentDieIndex = 0;
  state.phase = state.position === "pitcher" && state.stage === "pro" && !state.finished ? "pitcherEffort" : "dice";
  state.dice = makeDice();
  state.yearEvents = pickYearEvents();
  state.eventIndex = 0;
  state.yearlyEventResults = [];
  state.currentEvent = null;
  state.selectedEvent = null;
  state.competitionResult = null;
  state.postPoints = 0;
  state.pendingPostBonus = 0;
  state.yearInjuryStatus = "none";
}

function makeDice() {
  let count = 3;
  const r = roll(1, 100);

  if (state.lastYearInjuryStatus === "out") {
    count = 3;
  } else if (state.lastYearInjuryStatus === "injured") {
    count = r <= 80 ? 3 : 4;
  } else {
    count = r <= 45 ? 3 : r <= 78 ? 4 : 5;
  }

  if (state.stage === "college" && state.lastYearInjuryStatus === "none" && roll(0, 100) >= 82) count = Math.min(5, count + 1);
  return Array.from({ length: Math.max(3, count) }, (_, index) => ({
    id: index,
    value: roll(1, 6),
    used: false,
  }));
}

function pickYearEvents() {
  const pool = [...eventPool];
  return Array.from({ length: 3 }, () => {
    if (pool.length === 0) return eventPool[roll(0, eventPool.length - 1)];
    const index = roll(0, pool.length - 1);
    return pool.splice(index, 1)[0];
  });
}

function growthCost(ability) {
  const stat = state.stats[ability];
  const value = stat.value;
  const cap = stat.talentCap;
  const distanceToCap = cap - value;

  if (value >= cap) {
    const overBy = value - cap;
    if (overBy >= 15) return 28;
    if (overBy >= 10) return 22;
    if (overBy >= 5) return 14;
    return 8;
  }

  if (value < 50) return 1;

  if (value < 60) {
    if (distanceToCap >= 10) return 1;
    if (distanceToCap >= 6) return 2;
    return 3;
  }

  if (value < 70) {
    if (distanceToCap >= 11) return 2;
    if (distanceToCap >= 6) return 3;
    return 4;
  }

  if (value < 80) {
    if (distanceToCap >= 11) return 3;
    if (distanceToCap >= 6) return 4;
    return 5;
  }

  return distanceToCap >= 5 ? 5 : 6;
}

function addAbility(ability, amount) {
  const stat = state.stats[ability];
  stat.value = clamp(stat.value + amount, 0, 100);
  if (amount < 0) stat.growthProgress = 0;
}

function investGrowthPoints(ability, points) {
  const stat = state.stats[ability];
  stat.growthProgress ||= 0;

  let remaining = Math.max(0, points);
  let gained = 0;
  while (remaining > 0 && stat.value < 100) {
    const cost = growthCost(ability);
    const needed = cost - stat.growthProgress;
    if (remaining < needed) {
      stat.growthProgress += remaining;
      remaining = 0;
    } else {
      remaining -= needed;
      stat.growthProgress = 0;
      stat.value = clamp(stat.value + 1, 0, 100);
      gained += 1;
    }
  }

  return { gained, progress: stat.growthProgress, cost: growthCost(ability) };
}

function addFeedCard(type, title, body, meta = "") {
  if (!state.feed) state.feed = [];
  state.feed.push({ type, title, body, meta, year: state.year });
}

function scrollFeedToBottom() {
  const run = () => {
    const feed = $("gameFeed");
    feed.scrollTop = feed.scrollHeight;
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

function assignDie(ability) {
  const die = state.dice[currentDieIndex];
  if (!die || die.used || state.phase !== "dice") return;

  const result = investGrowthPoints(ability, die.value);
  die.used = true;
  state.log.unshift(`${state.year}｜成長骰 ${die.value} 點投入「${ability}」，能力 +${result.gained}。`);
  currentDieIndex += 1;

  if (state.dice.every((item) => item.used)) {
    addFeedCard("training", "季初特訓", `自主訓練擲出 ${state.dice.length} 顆骰，年度成長已分配完成。`, `${state.year}・${state.age} 歲・${stageLabel()}`);
    state.currentEvent = state.yearEvents[state.eventIndex];
    state.phase = "event";
  }

  save();
  render();
}

function choosePitcherEffort(key) {
  const effort = pitcherEfforts[key];
  state.armLoad = clamp(state.armLoad + effort.arm, 0, 140);
  state.fame += effort.fame;
  state.pendingPostBonus += effort.post;
  state.log.unshift(`${state.year}｜投球強度選擇「${effort.label}」，肩肘感覺${armCondition()}。`);
  addFeedCard("training", "投球強度", `本年度選擇「${effort.label}」。肩肘目前感覺${armCondition()}。`, "職業投手");
  state.phase = "dice";
  save();
  render();
}

function chooseEvent(optionIndex) {
  const event = state.currentEvent || state.yearEvents[state.eventIndex] || eventPool[roll(0, eventPool.length - 1)];
  const option = event.options[optionIndex];
  const success = roll(1, 100) <= option.chance;
  const ability = pickAbility();
  const growth = success ? option.growth : -Math.max(1, Math.ceil(option.growth / 2));
  const fameGain = success ? option.fame || 0 : -Math.max(0, Math.ceil((option.fame || 0) / 2));
  const postSwing = success ? option.postBonus || 0 : -Math.max(0, Math.ceil((option.postBonus || 0) / 2));
  const injuryRisk = success ? Math.floor((option.injuryRisk || 0) / 2) : (option.injuryRisk || 1) + 2;

  addAbility(ability, growth);
  state.fame = Math.max(0, state.fame + fameGain);
  state.pendingPostBonus += postSwing;
  state.injuryRisk += injuryRisk;
  if (state.position === "pitcher" && injuryRisk > 0) state.armLoad = clamp(state.armLoad + injuryRisk * 2, 0, 140);

  const injury = resolveInjury();
  if (injury.status === "out") state.yearInjuryStatus = "out";
  else if (injury.status === "injured" && state.yearInjuryStatus !== "out") state.yearInjuryStatus = "injured";

  state.selectedEvent = {
    title: event.title,
    result: eventResultText(event, option, success, ability, growth, fameGain, postSwing, injury.text),
  };
  addFeedCard("event", `事件卡｜${event.title}`, state.selectedEvent.result, option.label);
  state.yearlyEventResults.push({ success, growth, fameGain, postSwing, injuryStatus: injury.status });
  state.log.unshift(`${state.year}｜${state.selectedEvent.title}：${state.selectedEvent.result}`);

  state.eventIndex += 1;
  if (state.eventIndex >= 3) {
    state.competitionResult = resolveCompetitionResult();
    state.phase = "healthReport";
    state.postPoints = Math.max(0, state.competitionResult.points + state.pendingPostBonus);
    state.selectedEvent = null;
    state.log.unshift(`${state.year}｜年度大賽：${state.competitionResult.label}，獲得 ${state.competitionResult.points} 點賽後成長。`);
  } else {
    state.currentEvent = state.yearEvents[state.eventIndex];
  }

  save();
  render();
}

function eventResultText(event, option, success, ability, growth, fameGain, postSwing, injuryText) {
  const outcome = success
    ? `<strong class="result-success">${option.label}成功！</strong>`
    : `<strong class="result-fail">${option.label}失敗……</strong>`;
  const abilityText = `${ability} ${growth > 0 ? "+" : ""}${growth}`;
  const hiddenEffects = [];

  if (fameGain > 0) hiddenEffects.push("評價悄悄上升");
  if (fameGain < 0) hiddenEffects.push("評價受到影響");
  if (postSwing > 0) hiddenEffects.push(`季末成長點 +${postSwing}`);
  if (postSwing < 0) hiddenEffects.push(`季末成長點 ${postSwing}`);
  if (injuryText) hiddenEffects.push(injuryText);

  return `${event.text} ${outcome}<br>${abilityText}${hiddenEffects.length ? `<br>${hiddenEffects.join("，")}` : ""}`;
}

function resolveCompetitionResult() {
  const score = overall();
  const successes = state.yearlyEventResults.filter((result) => result.success).length;
  let tournamentScore = score + successes * 8 + state.fame * 0.35 + roll(-12, 12);
  if (state.yearInjuryStatus === "injured") tournamentScore -= 16;
  if (state.yearInjuryStatus === "out") tournamentScore -= 34;
  if (state.level === "majors") tournamentScore += 8;
  if (state.stage === "college") tournamentScore += 4;

  if (state.yearInjuryStatus === "out") {
    return { label: "報銷缺席", points: 1, rank: 0 };
  }
  if (tournamentScore < 38) return { label: "首輪出局", points: 1, rank: 1 };
  if (tournamentScore < 50) return { label: "二輪出局", points: 2, rank: 2 };
  if (tournamentScore < 62) return { label: "八強", points: 4, rank: 3 };
  if (tournamentScore < 74) return { label: "四強", points: 6, rank: 4 };
  if (tournamentScore < 86) return { label: "亞軍", points: 8, rank: 5 };
  return { label: "冠軍", points: 10, rank: 6 };
}

function healthReportText() {
  const risk = clamp(state.injuryRisk + (state.position === "pitcher" ? Math.floor(state.armLoad / 18) : 0), 0, 95);
  if (state.yearInjuryStatus === "out") return `本季報銷。下個年度成長骰將固定為 3 顆。（受傷機率 ${risk}%）`;
  if (state.yearInjuryStatus === "injured") return `本季曾短暫缺席。下個年度較容易只有低骰數。（受傷機率 ${risk}%）`;
  if (state.position === "pitcher") return `本季平安出賽。肩肘目前感覺${armCondition()}。（受傷機率 ${risk}%）`;
  return `本季平安出賽。（受傷機率 ${risk}%）`;
}

function seasonResultText() {
  const result = state.competitionResult;
  if (!result) return "年度賽事尚未結算。";
  return `年度大賽結果：${result.label}。獲得能力點 ${result.points} 點，之後會進入季末能力分配。`;
}

function resolveInjury() {
  const risk = state.injuryRisk + (state.position === "pitcher" ? Math.floor(state.armLoad / 18) : 0);
  if (roll(1, 100) > risk) return { text: "", status: "none" };

  const out = roll(1, 100) <= Math.min(28, Math.floor(risk * 0.7));
  const text = out ? "本年度報銷。" : "本年度有短暫缺席。";
  state.injuryHistory.push({ year: state.year, text });

  if (state.position === "pitcher" && state.armLoad >= 95) {
    state.armLoad = 38;
    state.injuryHistory.push({ year: state.year, text: "肩肘負擔達到門檻，進入手術與復健。" });
    return { text: "肩肘負擔過高，系統判定進入手術與復健。", status: "out" };
  }

  return { text, status: out ? "out" : "injured" };
}

function pickAbility() {
  const abilities = Object.keys(state.stats);
  return abilities[roll(0, abilities.length - 1)];
}

function spendPostPoint(ability) {
  if (state.phase !== "post" || state.postPoints <= 0) return;
  state.postPoints -= 1;
  investGrowthPoints(ability, 1);
  save();
  render();
}

function finishPostGrowth() {
  addFeedCard("training", "季末能力分配", `季末能力點分配完成，準備進入下一個年度判定。`, "分配能力點");
  if (state.stage === "highschool" && state.age === 18) {
    state.phase = "route";
  } else if (state.stage === "college" && state.collegeYear >= 3) {
    state.phase = "route";
  } else {
    closeYear();
  }
  save();
  render();
}

function continueFromHealthReport() {
  addFeedCard("health", "健康回報", healthReportText(), "季中健康檢查");
  state.phase = "seasonResult";
  save();
  render();
}

function continueFromSeasonResult() {
  addFeedCard("result", "年度大賽", seasonResultText(), "球季表現");
  state.phase = "post";
  save();
  render();
}

function availableRoutes() {
  const score = overall();
  const routes = [{ key: "college", title: "大學", desc: "穩定延續棒球路，累積更多年份與成長。" }];
  if (score >= 48) routes.push({ key: "cpbl", title: "中職", desc: "進入職業體系，先從二軍開始。" });
  if (score >= 62) routes.push({ key: "milb", title: "美國小聯盟", desc: "挑戰更高層級，但下層競爭更硬。" });
  if (score >= 78 && state.age <= 21) routes.push({ key: "mlb", title: "美國大聯盟", desc: "罕見天才路線，仍從新人與下層體系起步。" });
  return routes;
}

function chooseRoute(key) {
  if (key === "college") {
    state.stage = "college";
    state.route = "大學";
    state.level = "school";
    state.collegeYear = 1;
    state.log.unshift(`${state.year}｜選擇進入大學棒球，繼續累積自己的身體和技術。`);
    addFeedCard("result", "職涯分流", "選擇進入大學棒球，繼續累積自己的身體和技術。", "大學");
  } else {
    state.stage = "pro";
    state.route = { cpbl: "中職", milb: "美國小聯盟", mlb: "美國大聯盟" }[key];
    state.level = "farm";
    state.careerSalary += { cpbl: 90, milb: 160, mlb: 360 }[key];
    state.log.unshift(`${state.year}｜選擇挑戰${state.route}體系，職業人生從二軍或下層開始。`);
    addFeedCard("result", "職涯分流", `選擇挑戰${state.route}體系，職業人生從二軍或下層開始。`, state.route);
  }
  advanceAfterRoute();
}

function advanceAfterRoute() {
  state.lastYearInjuryStatus = state.yearInjuryStatus || "none";
  state.injuryRisk = Math.max(0, Math.floor(state.injuryRisk * 0.5));
  state.year += 1;
  state.age += 1;
  startYear();
  save();
  render();
}

function closeYear() {
  const verdict = autoVerdict();
  if (verdict) {
    state.log.unshift(`${state.year}｜年度判定：${verdict}`);
    addFeedCard("result", "年度判定", verdict, `${state.year}`);
  }

  if (!state.finished) {
    state.lastYearInjuryStatus = state.yearInjuryStatus || "none";
    state.injuryRisk = Math.max(0, Math.floor(state.injuryRisk * 0.5));
    state.year += 1;
    state.age += 1;
    if (state.stage === "college") state.collegeYear += 1;
    if (state.age >= 32) decline();
    if (state.age > 38 || (state.stage === "pro" && overall() < 35 && state.age <= 22)) finishCareer();
    else startYear();
  }

  save();
  render();
}

function autoVerdict() {
  if (state.stage === "highschool") return `${schoolYear(state.age)}結束，下一年繼續。`;
  if (state.stage === "college") return state.collegeYear >= 3 ? "大學階段結束，重新評估職業路線。" : "大學球季結束。";
  if (state.stage === "pro") {
    if (state.level === "farm" && overall() >= 60) {
      state.level = "majors";
      state.careerSalary += Math.max(100, overall() * 4);
      return `綜合評分達標，升上${state.route}一軍層級。`;
    }
    if (state.level === "majors" && overall() < 52) {
      state.level = "farm";
      return "表現不足，系統判定回到二軍或下層調整。";
    }
    state.careerSalary += state.level === "majors" ? overall() * 3 : overall();
    return state.level === "majors" ? "維持一軍層級，累積薪資與歷史評價。" : "仍在二軍或下層體系等待機會。";
  }
  return "";
}

function decline() {
  Object.keys(state.stats).forEach((ability) => {
    const loss = roll(0, state.age >= 35 ? 2 : 1);
    state.stats[ability].value = clamp(state.stats[ability].value - loss, 0, 100);
  });
}

function finishCareer() {
  state.finished = true;
  state.phase = "finished";
  let ending = "這段棒球人生提早停在職業門口，但它依然留下了自己的軌跡。";
  if (overall() >= 78 && state.fame >= 55) ending = "多年後，球迷仍會談起這名球員。他成了一段傳奇。";
  else if (overall() >= 62) ending = "他留下穩定而扎實的職業年資，是很多年輕球員的參照。";
  else if (state.stage === "college") ending = "他在大學棒球中把路走完，等待下一段人生。";
  state.log.unshift(`生涯結語｜${ending}`);
  addFeedCard("result", "生涯結語", ending, "完結");
}

function overall() {
  const values = Object.values(state.stats).map((stat) => stat.value);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function armCondition() {
  if (state.armLoad == null) return "";
  if (state.armLoad < 18) return "輕鬆";
  if (state.armLoad < 36) return "輕盈";
  if (state.armLoad < 58) return "普通";
  if (state.armLoad < 78) return "緊繃";
  if (state.armLoad < 96) return "沉重";
  return "危險";
}

function render(resultText = "") {
  $("yearLabel").textContent = `${state.year} 年・${state.age} 歲・${stageLabel()}`;
  $("playerTitle").textContent = `NO.${state.number} ${state.name}`;
  $("overall").textContent = overall();
  $("level").textContent = state.level === "majors" ? "一軍" : state.level === "farm" ? "二軍" : state.stage === "college" ? "大學" : "高中";
  $("armStat").classList.toggle("hidden", state.position !== "pitcher");
  $("armLabel").textContent = armCondition();

  renderStats();
  renderFeed();
  renderPhase();
  renderDockState();
  $("resultBox").classList.add("hidden");
  $("resultBox").innerHTML = "";
}

function renderFeed() {
  const cards = state.feed || [];
  $("gameFeed").innerHTML = `
    <div class="feed-inner">
      ${cards
        .map(
          (card) => `
            <article class="feed-card ${card.type || ""}">
              <h3><span>${card.title}</span>${card.meta ? `<small>${card.meta}</small>` : ""}</h3>
              <p>${card.body}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
  scrollFeedToBottom();
}

function renderStats() {
  const interactive = ["dice", "post"].includes(state.phase);
  $("statsList").innerHTML = Object.entries(state.stats)
    .map(([ability, stat]) => {
      const over = stat.value >= stat.talentCap;
      const cost = growthCost(ability);
      const progress = stat.growthProgress || 0;
      const showProgress = cost > 1 || progress > 0;
      const disabled = state.phase === "post" && state.postPoints <= 0;
      const tag = interactive ? "button" : "div";
      const actionAttrs = interactive ? ` type="button" data-ability="${ability}" ${disabled ? "disabled" : ""}` : "";
      return `
        <${tag} class="stat-row ${interactive ? "stat-choice" : ""}"${actionAttrs}>
          <div class="stat-top">
            <span>${ability}</span>
            <strong>${stat.value}/${stat.talentCap}${showProgress ? `<small>${progress}/${cost}</small>` : ""}</strong>
          </div>
          <div class="bar" style="--value:${stat.value}%;--cap:${stat.talentCap}%">
            <span></span><i class="cap-line"></i>
          </div>
          <div class="stat-note ${over ? "over-cap" : ""}">目前成長成本 ${cost}</div>
        </${tag}>
      `;
    })
    .join("");
}

function renderPhase() {
  $("dicePanel").classList.toggle("hidden", state.phase !== "dice");
  $("statsActions").classList.add("hidden");
  $("statsList").classList.toggle("hidden", !["dice", "post"].includes(state.phase));
  $("resultBox").classList.add("hidden");

  if (state.finished) {
    $("phaseTitle").textContent = "生涯回顧";
    $("storyTitle").textContent = "這段人生結束了";
    $("storyText").textContent = state.log[0].replace("生涯結語｜", "");
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("statsList").classList.add("hidden");
    $("actions").innerHTML = actionButton("restart", "建立下一位球員", "用新的種子與守位，再看另一段分岔人生。");
    return;
  }

  if (state.phase === "pitcherEffort") {
    $("phaseTitle").textContent = "投手年度選擇";
    $("storyTitle").textContent = "今年要怎麼使用這條手臂？";
    $("storyText").textContent = `肩肘目前感覺${armCondition()}。你不會看到完整負擔數值，只能用大致狀態判斷。`;
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("statsList").classList.add("hidden");
    $("actions").innerHTML = Object.entries(pitcherEfforts)
      .map(([key, effort]) => actionButton(`effort:${key}`, effort.label, effort.desc))
      .join("");
    return;
  }

  if (state.phase === "dice") {
    $("phaseTitle").textContent = "開年成長";
    $("storyTitle").textContent = "分配年度成長骰";
    $("storyText").textContent = "骰子會依序分配。選擇一項能力，把目前這顆骰子的點數完整投入。骰到 6 也不能拆開。";
    renderDice();
    renderStatActions("die");
    $("actions").innerHTML = "";
    return;
  }

  if (state.phase === "event") {
    $("phaseTitle").textContent = `年度事件 ${state.eventIndex + 1}/3`;
    $("storyTitle").textContent = "今年要怎麼面對？";
    $("storyText").textContent = "選擇事件處理方向。事件會由系統判定結果，並指定某項能力成長。";
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("statsList").classList.add("hidden");
    if (!state.currentEvent) state.currentEvent = eventPool[roll(0, eventPool.length - 1)];
    $("storyTitle").textContent = state.currentEvent.title;
    $("storyText").textContent = state.currentEvent.text;
    $("actions").innerHTML = state.currentEvent.options
      .map((option, index) => actionButton(`event:${index}`, option.label, `${option.desc} 成功率 ${option.chance}%`))
      .join("");
    return;
  }

  if (state.phase === "healthReport") {
    $("phaseTitle").textContent = "季中健康檢查";
    $("storyTitle").textContent = "健康回報";
    $("storyText").textContent = healthReportText();
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("statsList").classList.add("hidden");
    $("actions").innerHTML = actionButton("continueHealth", "查看球季表現", "進入年度大賽與球季結果。");
    return;
  }

  if (state.phase === "seasonResult") {
    $("phaseTitle").textContent = "球季表現";
    $("storyTitle").textContent = "年度大賽";
    $("storyText").textContent = seasonResultText();
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("statsList").classList.add("hidden");
    $("actions").innerHTML = actionButton("continueSeason", "分配能力點", "進入季末能力分配。");
    return;
  }

  if (state.phase === "post") {
    $("phaseTitle").textContent = "賽後成長";
    $("storyTitle").textContent = `分配賽後成長點數：${state.postPoints}`;
    $("storyText").textContent = "季末能力點可以一點一點分配。越接近或突破個人上限，每提升 1 點會需要更多點數。";
    renderStatActions("post");
    $("actions").innerHTML = actionButton("finishPost", "完成年度成長", "進入年度判定與下一年。");
    return;
  }

  if (state.phase === "route") {
    $("phaseTitle").textContent = "職涯分流";
    $("storyTitle").textContent = "選擇下一條棒球路";
    $("storyText").textContent = "可選路線依綜合評分與年齡開放。職業體系都會先從二軍或下層開始。";
    $("dicePanel").classList.add("hidden");
    $("statsActions").classList.add("hidden");
    $("actions").innerHTML = availableRoutes().map((route) => actionButton(`route:${route.key}`, route.title, route.desc)).join("");
  }
}

function renderDice() {
  const current = state.dice[currentDieIndex];
  $("dicePanel").innerHTML = `
    <div class="dice-row">
      ${state.dice
        .map(
          (die) =>
            `<div class="die ${die.used ? "used" : ""} ${current && current.id === die.id ? "selected" : ""}">${die.value}</div>`,
        )
        .join("")}
    </div>
    <p class="dice-hint">${
      current
        ? `目前第 ${currentDieIndex + 1}/${state.dice.length} 顆：${current.value} 點。請選擇要投入的能力。`
        : "年度成長骰已分配完畢。"
    }</p>
  `;
}

function renderStatActions(mode) {
  $("statsActions").innerHTML = "";
}

function actionButton(action, title, desc) {
  return `<button type="button" data-action="${action}"><strong>${title}</strong><span>${desc}</span></button>`;
}

function renderDockState() {
  $("controlDock").classList.toggle("collapsed", dockCollapsed);
  $("dockToggle").textContent = dockCollapsed ? "展開" : "收合";
  $("dockToggle").setAttribute("aria-expanded", String(!dockCollapsed));
}

function save() {
  localStorage.setItem("diamond-road-state-v2", JSON.stringify(state));
}

function restore() {
  const saved = localStorage.getItem("diamond-road-state-v2");
  if (!saved) return;
  state = JSON.parse(saved);
  state.lastYearInjuryStatus ||= "none";
  state.yearInjuryStatus ||= "none";
  state.yearEvents ||= pickYearEvents();
  state.eventIndex ||= 0;
  state.yearlyEventResults ||= [];
  state.competitionResult ||= null;
  state.feed ||= (state.log || []).slice().reverse().map((item) => ({
    type: "result",
    title: "生涯紀錄",
    body: item,
    meta: "",
    year: state.year,
  }));
  Object.values(state.stats || {}).forEach((stat) => {
    stat.growthProgress ||= 0;
    stat.overCapCostMultiplier ||= stat.talentCap >= 76 ? 2 : 3;
  });
  if (state.phase === "pitcherEffort" && state.stage !== "pro") state.phase = "dice";
  currentDieIndex = state.dice ? state.dice.findIndex((die) => !die.used) : 0;
  if (currentDieIndex < 0) currentDieIndex = 0;
  $("startPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  render();
}

function reset() {
  state = null;
  currentDieIndex = 0;
  localStorage.removeItem("diamond-road-state-v2");
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

$("statsActions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-ability]");
  if (!button) return;
  if (state.phase === "dice") assignDie(button.dataset.ability);
  if (state.phase === "post") spendPostPoint(button.dataset.ability);
});

$("statsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-ability]");
  if (!button || button.disabled) return;
  if (state.phase === "dice") assignDie(button.dataset.ability);
  if (state.phase === "post") spendPostPoint(button.dataset.ability);
});

$("actions").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "restart") reset();
  if (action === "continueHealth") continueFromHealthReport();
  if (action === "continueSeason") continueFromSeasonResult();
  if (action === "finishPost") finishPostGrowth();
  if (action?.startsWith("effort:")) choosePitcherEffort(action.split(":")[1]);
  if (action?.startsWith("event:")) chooseEvent(Number(action.split(":")[1]));
  if (action?.startsWith("route:")) chooseRoute(action.split(":")[1]);
});

$("randomSeed").addEventListener("click", () => {
  $("seedInput").value = makeSeed();
});

$("resetGame").addEventListener("click", reset);

$("dockToggle").addEventListener("click", () => {
  dockCollapsed = !dockCollapsed;
  renderDockState();
});

$("seedInput").value = makeSeed();
restore();
