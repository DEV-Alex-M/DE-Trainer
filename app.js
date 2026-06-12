const data = window.LEARNING_DATA;
const STORAGE_KEY = "deTrainerPractice";
let currentWord = null;
let currentSentence = null;
let currentBuild = null;
let builtWords = [];
let sessionStarted = Date.now();

const $ = (id) => document.getElementById(id);

let progress = loadProgress();

function loadProgress() {
  const defaults = {
    words: {},
    sentences: {},
    builders: {},
    practiceByDate: {},
    lastPracticeDate: ""
  };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return defaults;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  renderStats();
  renderDifficultList();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function markPracticeMinute() {
  const today = todayKey();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - sessionStarted) / 60000));
  progress.practiceByDate[today] = Math.max(progress.practiceByDate[today] || 0, elapsedMinutes);
  progress.lastPracticeDate = today;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  renderStats();
}

function ensureThemeToggle() {
  let toggle = $("themeToggle");
  if (!toggle) {
    const heroActions = document.querySelector(".hero-actions") || document.querySelector(".hero");
    if (!heroActions) return null;
    toggle = document.createElement("button");
    toggle.id = "themeToggle";
    toggle.className = "theme-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Toggle dark mode");
    heroActions.appendChild(toggle);
  }

  toggle.type = "button";
  toggle.disabled = false;
  toggle.classList.add("theme-toggle");
  toggle.setAttribute("aria-label", "Toggle dark mode");
  return toggle;
}

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  document.body.classList.toggle("dark", selectedTheme === "dark");
  localStorage.setItem("deTrainerTheme", selectedTheme);

  const toggle = ensureThemeToggle();
  if (toggle) {
    toggle.textContent = selectedTheme === "dark" ? "☀ Light" : "☾ Dark";
    toggle.setAttribute("aria-pressed", selectedTheme === "dark" ? "true" : "false");
  }
}

function toggleTheme(event) {
  if (event) event.preventDefault();
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
}

function focusIfVisible(element) {
  if (!element) return;
  const panel = element.closest(".panel");
  if (!panel || panel.classList.contains("active")) element.focus();
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function filtered(items) {
  const level = $("levelFilter").value;
  return level === "all" ? items : items.filter(item => item.level === level);
}

function pick(items) {
  const list = filtered(items);
  return list[Math.floor(Math.random() * list.length)] || items[0];
}

function canAskPlural(word) {
  return word.type === "noun" && Boolean(word.plural);
}

function makeWordPracticeItem(word) {
  const mode = canAskPlural(word) && Math.random() < 0.35 ? "plural" : "singular";
  return { ...word, practiceMode: mode };
}

function wordProgressKey(word) {
  return `${word.id}:${word.practiceMode || "singular"}`;
}

function wordPromptText(word) {
  if (!canAskPlural(word)) return word.en;
  if ((word.practiceMode || "singular") === "plural") return `${word.en} (plural)`;
  return `${word.en} (singular)`;
}

function wordArticle(word) {
  return (word.practiceMode || "singular") === "plural" ? (word.pluralArticle || "die") : word.article;
}

function wordGerman(word) {
  return (word.practiceMode || "singular") === "plural" ? word.plural : word.de;
}

function acceptedWordAnswers(word) {
  const base = wordGerman(word);
  const article = wordArticle(word);
  return article ? [`${article} ${base}`, base] : [base];
}

function fullWordAnswer(word) {
  const base = wordGerman(word);
  const article = wordArticle(word);
  return article ? `${article} ${base}` : base;
}

function articleStatus(word, rawAnswer) {
  const expectedArticle = wordArticle(word);
  const expectedWord = normalize(wordGerman(word));
  const answer = normalize(rawAnswer);

  if (!expectedArticle || !answer) return "not_applicable";
  if (answer === expectedWord) return "missing";

  const articleMatch = answer.match(/^(der|die|das)\s+(.+)$/);
  if (!articleMatch) return "not_applicable";

  const givenArticle = articleMatch[1];
  const givenWord = articleMatch[2];
  if (givenWord === expectedWord && givenArticle !== normalize(expectedArticle)) return "wrong";

  return "not_applicable";
}

function displayIssueCount(label, value) {
  return `${label}: ${value || 0}`;
}

function displayWordForms(word) {
  const singular = word.article ? `${word.article} ${word.de}` : word.de;
  const plural = word.plural ? `${word.pluralArticle || "die"} ${word.plural}` : "-";
  return { singular, plural };
}

function recordWord(word, result = {}) {
  const id = wordProgressKey(word);
  const item = progress.words[id] || {
    correct: 0,
    wrong: 0,
    articleMissing: 0,
    articleWrong: 0,
    lastSeen: "",
    mode: word.practiceMode || "singular",
    wordId: word.id
  };

  item.articleWrong = item.articleWrong || 0;

  if (result.correct) item.correct += 1;
  if (result.wrong) item.wrong += 1;
  if (result.articleMissing) item.articleMissing += 1;
  if (result.articleWrong) item.articleWrong += 1;

  item.lastSeen = todayKey();
  progress.words[id] = item;
  markPracticeMinute();
  saveProgress();
}

function recordSentence(collection, sentence, correct) {
  const id = String(sentence.id);
  const item = progress[collection][id] || { correct: 0, wrong: 0, lastSeen: "" };
  correct ? item.correct += 1 : item.wrong += 1;
  item.lastSeen = todayKey();
  progress[collection][id] = item;
  markPracticeMinute();
  saveProgress();
}

function showWord() {
  currentWord = makeWordPracticeItem(pick(data.words));
  $("wordPrompt").textContent = wordPromptText(currentWord);
  $("wordAnswer").value = "";
  $("wordAnswer").disabled = false;
  focusIfVisible($("wordAnswer"));
  $("wordFeedback").textContent = "";
  $("wordFeedback").className = "feedback";
}

function checkWord() {
  if (!currentWord || $("wordAnswer").disabled) return;
  const answer = normalize($("wordAnswer").value);
  const possible = acceptedWordAnswers(currentWord).map(normalize);
  const fullAnswer = normalize(fullWordAnswer(currentWord));
  const feedback = $("wordFeedback");

  const articleProblem = articleStatus(currentWord, $("wordAnswer").value);

  if (answer === fullAnswer) {
    feedback.textContent = `Correct: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback good";
    recordWord(currentWord, { correct: true });
  } else if (articleProblem === "missing") {
    feedback.textContent = `Correct word, article missing: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback warn";
    recordWord(currentWord, { correct: true, articleMissing: true });
  } else if (articleProblem === "wrong") {
    feedback.textContent = `Correct word, wrong article: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback warn";
    recordWord(currentWord, { correct: true, articleWrong: true });
  } else if (possible.includes(answer)) {
    feedback.textContent = `Correct: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback good";
    recordWord(currentWord, { correct: true });
  } else {
    feedback.textContent = `Not quite. Correct: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback bad";
    recordWord(currentWord, { wrong: true });
  }

  $("wordAnswer").disabled = true;
}

function showSentence() {
  currentSentence = pick(data.sentences);
  $("sentencePrompt").textContent = currentSentence.en;
  $("sentenceAnswer").value = "";
  $("sentenceAnswer").disabled = false;
  focusIfVisible($("sentenceAnswer"));
  $("sentenceFeedback").textContent = "";
  $("sentenceFeedback").className = "feedback";
}

function checkSentence() {
  if (!currentSentence || $("sentenceAnswer").disabled) return;
  const answer = normalize($("sentenceAnswer").value);
  const correct = normalize(currentSentence.de);
  const feedback = $("sentenceFeedback");
  const isCorrect = answer === correct;
  feedback.textContent = isCorrect ? `Correct: ${currentSentence.de}` : `Not quite. Correct: ${currentSentence.de}`;
  feedback.className = isCorrect ? "feedback good" : "feedback bad";
  recordSentence("sentences", currentSentence, isCorrect);
  $("sentenceAnswer").disabled = true;
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function renderBuilt() {
  $("builtSentence").textContent = builtWords.map(item => item.word).join(" ");
  document.querySelectorAll(".word-chip").forEach(button => {
    button.classList.toggle("used", builtWords.some(item => item.index === Number(button.dataset.index)));
  });
}

function showBuilder() {
  currentBuild = pick(data.sentences);
  builtWords = [];
  $("builderPrompt").textContent = currentBuild.en;
  $("builderFeedback").textContent = "";
  $("builderFeedback").className = "feedback";
  const words = shuffle(currentBuild.de.replace(/[.!?]/g, "").split(" "));
  $("wordBank").innerHTML = "";
  words.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "word-chip";
    button.dataset.index = index;
    button.textContent = word;
    button.addEventListener("click", () => {
      if (!builtWords.some(item => item.index === index)) {
        builtWords.push({ word, index });
        renderBuilt();
      }
    });
    $("wordBank").appendChild(button);
  });
  renderBuilt();
}

function checkBuild() {
  if (!currentBuild) return;
  const built = normalize(builtWords.map(item => item.word).join(" "));
  const correct = normalize(currentBuild.de);
  const feedback = $("builderFeedback");
  const isCorrect = built === correct;
  feedback.textContent = isCorrect ? `Correct: ${currentBuild.de}` : `Not quite. Correct: ${currentBuild.de}`;
  feedback.className = isCorrect ? "feedback good" : "feedback bad";
  recordSentence("builders", currentBuild, isCorrect);
}

function wordStats(word, mode = "singular") {
  const stats = progress.words[`${word.id}:${mode}`] || progress.words[String(word.id)] || { correct: 0, wrong: 0, articleMissing: 0, articleWrong: 0, lastSeen: "", mode, wordId: word.id };
  stats.articleWrong = stats.articleWrong || 0;
  return stats;
}

function wordPracticeRows() {
  const rows = [];
  data.words.forEach(word => {
    rows.push({ word: { ...word, practiceMode: "singular" }, stats: wordStats(word, "singular") });
    if (canAskPlural(word)) rows.push({ word: { ...word, practiceMode: "plural" }, stats: wordStats(word, "plural") });
  });
  return rows;
}

function difficultWords() {
  return wordPracticeRows()
    .filter(item => item.stats.wrong > 0 || item.stats.articleMissing > 0 || item.stats.articleWrong > 0)
    .sort((a, b) => (b.stats.wrong + b.stats.articleMissing + b.stats.articleWrong) - (a.stats.wrong + a.stats.articleMissing + a.stats.articleWrong));
}

function renderStats() {
  const wordTotal = Object.values(progress.words).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  const sentenceTotal = Object.values(progress.sentences).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.builders).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  $("wordsPracticed").textContent = wordTotal;
  $("sentencesCompleted").textContent = sentenceTotal;
  $("difficultWords").textContent = difficultWords().length;
  $("todayPractice").textContent = `${progress.practiceByDate[todayKey()] || 0} min`;
}

function searchText(value) {
  return normalize(value || "");
}

function matchesSearch(parts, query) {
  if (!query) return true;
  return searchText(parts.join(" ")).includes(query);
}

function renderDifficultList() {
  const query = searchText($("difficultSearch")?.value || "");
  const items = difficultWords().filter(({ word, stats }) => {
    return matchesSearch([
      wordPromptText(word),
      fullWordAnswer(word),
      word.type,
      word.level,
      `wrong ${stats.wrong}`,
      `article missing ${stats.articleMissing}`,
      `article wrong ${stats.articleWrong || 0}`,
      stats.lastSeen
    ], query);
  });

  if (!difficultWords().length) {
    $("difficultList").innerHTML = `<p>No difficult words yet. Wrong answers, missing articles, and wrong articles will appear here.</p>`;
    return;
  }

  if (!items.length) {
    $("difficultList").innerHTML = `<p>No failed words match your search.</p>`;
    return;
  }

  const rows = [`<div class="row header-row"><b>English</b><b>German</b><b>Issues</b><b>Last seen</b></div>`];
  items.forEach(({ word, stats }) => {
    const issues = [
      displayIssueCount("Wrong", stats.wrong),
      displayIssueCount("Article missing", stats.articleMissing),
      displayIssueCount("Article wrong", stats.articleWrong)
    ].join(" • ");
    rows.push(`<div class="row"><span>${wordPromptText(word)}</span><span>${fullWordAnswer(word)}</span><span>${issues}</span><span>${stats.lastSeen || "-"}</span></div>`);
  });
  $("difficultList").innerHTML = rows.join("");
}

function renderContentList() {
  const query = searchText($("contentSearch")?.value || "");
  const words = data.words.filter(word => {
    const forms = displayWordForms(word);
    return matchesSearch([word.level, word.en, forms.singular, forms.plural, word.type], query);
  });
  const sentences = data.sentences.filter(sentence => matchesSearch([sentence.level, sentence.en, sentence.de, "sentence"], query));
  const rows = [];

  if (words.length) {
    rows.push(`<div class="row header-row word-list-row"><b>Level</b><b>English</b><b>Singular</b><b>Plural</b><b>Type</b></div>`);
    words.forEach(word => {
      const forms = displayWordForms(word);
      rows.push(`<div class="row word-list-row"><span>${word.level}</span><span>${word.en}</span><span>${forms.singular}</span><span>${forms.plural}</span><span>${word.type}</span></div>`);
    });
  }

  if (sentences.length) {
    rows.push(`<div class="row header-row"><b>Level</b><b>English sentence</b><b>German sentence</b><b>Type</b></div>`);
    sentences.forEach(sentence => {
      rows.push(`<div class="row"><span>${sentence.level}</span><span>${sentence.en}</span><span>${sentence.de}</span><span>sentence</span></div>`);
    });
  }

  $("contentList").innerHTML = rows.length ? rows.join("") : `<p class="empty-message">No words or sentences match your search.</p>`;
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach(el => el.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "difficult") renderDifficultList();
    });
  });
}

function init() {
  const savedTheme = localStorage.getItem("deTrainerTheme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
  ensureThemeToggle();
  document.addEventListener("click", event => {
    const themeButton = event.target.closest("#themeToggle");
    if (themeButton) toggleTheme(event);
  });

  bindTabs();
  renderContentList();
  renderStats();
  renderDifficultList();
  showWord();
  showSentence();
  showBuilder();

  $("checkWord").addEventListener("click", checkWord);
  $("nextWord").addEventListener("click", showWord);
  $("showWord").addEventListener("click", () => {
    $("wordFeedback").textContent = fullWordAnswer(currentWord);
    $("wordFeedback").className = "feedback warn";
    $("wordAnswer").disabled = true;
  });
  $("wordAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkWord(); });

  $("checkSentence").addEventListener("click", checkSentence);
  $("nextSentence").addEventListener("click", showSentence);
  $("showSentence").addEventListener("click", () => {
    $("sentenceFeedback").textContent = currentSentence.de;
    $("sentenceFeedback").className = "feedback warn";
    $("sentenceAnswer").disabled = true;
  });
  $("sentenceAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkSentence(); });

  $("checkBuild").addEventListener("click", checkBuild);
  $("nextBuild").addEventListener("click", showBuilder);
  $("undoBuild").addEventListener("click", () => { builtWords.pop(); renderBuilt(); });
  $("clearBuild").addEventListener("click", () => { builtWords = []; renderBuilt(); });

  $("levelFilter").addEventListener("change", () => {
    showWord();
    showSentence();
    showBuilder();
  });

  $("contentSearch").addEventListener("input", renderContentList);
  $("difficultSearch").addEventListener("input", renderDifficultList);

  $("resetProgress").addEventListener("click", () => {
    if (!confirm("Reset all local practice history?")) return;
    progress = loadProgress();
    progress.words = {};
    progress.sentences = {};
    progress.builders = {};
    progress.practiceByDate = {};
    progress.lastPracticeDate = "";
    saveProgress();
  });

  setInterval(markPracticeMinute, 60000);
}

init();
