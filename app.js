const data = window.LEARNING_DATA;
const STORAGE_KEY = "deTrainerPractice";
let currentWord = null;
let currentSentence = null;
let currentBuild = null;
let currentGrammar = null;
let selectedGrammarOption = "";
let builtWords = [];
let sessionStarted = Date.now();

const $ = (id) => document.getElementById(id);

let progress = loadProgress();

function loadProgress() {
  const defaults = {
    words: {},
    sentences: {},
    builders: {},
    grammars: {},
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

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("deTrainerTheme", theme);
  const toggle = $("themeToggle");
  if (toggle) toggle.textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
}

function toggleTheme() {
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
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
  const level = $("levelFilter") ? $("levelFilter").value : "all";
  const category = $("categoryFilter") ? $("categoryFilter").value : "all";
  return items.filter(item => {
    const levelOk = level === "all" || item.level === level;
    const categoryOk = category === "all" || item.category === category;
    return levelOk && categoryOk;
  });
}

function allCategories() {
  const values = [
    ...data.words.map(item => item.category),
    ...data.sentences.map(item => item.category),
    ...(data.grammar || []).map(item => item.category)
  ].filter(Boolean);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function populateCategoryFilter() {
  const select = $("categoryFilter");
  if (!select) return;
  const current = select.value || "all";
  select.innerHTML = `<option value="all">All categories</option>` + allCategories()
    .map(category => `<option value="${category}">${category}</option>`)
    .join("");
  select.value = allCategories().includes(current) ? current : "all";
}

function pick(items) {
  const list = filtered(items);
  return list[Math.floor(Math.random() * list.length)] || items[0];
}

function grammarFocusMatches(item) {
  const focus = $("grammarFocusFilter") ? $("grammarFocusFilter").value : "all";
  if (focus === "all") return true;
  return item.grammarTopic === focus || item.category === focus;
}

function filteredGrammarItems() {
  return filtered(data.grammar || []).filter(grammarFocusMatches);
}

function acceptedWordAnswers(word) {
  const base = word.de;
  return word.article ? [`${word.article} ${base}`, base] : [base];
}

function fullWordAnswer(word) {
  return word.article ? `${word.article} ${word.de}` : word.de;
}

function recordWord(word, correct, articleMissing = false, articleWrong = false) {
  const id = String(word.id);
  const item = progress.words[id] || { correct: 0, wrong: 0, articleMissing: 0, articleWrong: 0, lastSeen: "" };
  if (correct) item.correct += 1;
  else item.wrong += 1;
  if (articleMissing) item.articleMissing += 1;
  if (articleWrong) item.articleWrong += 1;
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
  currentWord = pick(data.words);
  $("wordPrompt").textContent = currentWord.en;
  $("wordAnswer").value = "";
  $("wordAnswer").disabled = false;
  $("wordFeedback").textContent = "";
  $("wordFeedback").className = "feedback";
}

function splitArticleAnswer(value) {
  const parts = normalize(value).split(" ");
  if (parts.length < 2) return { article: "", word: normalize(value) };
  return { article: parts[0], word: parts.slice(1).join(" ") };
}

function checkWord() {
  if (!currentWord) return;
  const input = $("wordAnswer");
  const answer = normalize(input.value);
  const possible = acceptedWordAnswers(currentWord).map(normalize);
  const fullAnswer = normalize(fullWordAnswer(currentWord));
  const feedback = $("wordFeedback");

  if (answer === fullAnswer) {
    feedback.textContent = `Correct: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback good";
    recordWord(currentWord, true, false, false);
  } else if (possible.includes(answer)) {
    feedback.textContent = `Correct word, article missing: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback warn";
    recordWord(currentWord, true, true, false);
  } else if (currentWord.article) {
    const given = splitArticleAnswer(input.value);
    const correctWordOnly = normalize(currentWord.de);
    const correctPlural = normalize(currentWord.plural || "");
    const wordIsCorrect = given.word === correctWordOnly || (correctPlural && given.word === correctPlural);
    if (wordIsCorrect && given.article && given.article !== normalize(currentWord.article)) {
      feedback.textContent = `Correct word, wrong article. Correct: ${fullWordAnswer(currentWord)}`;
      feedback.className = "feedback warn";
      recordWord(currentWord, true, false, true);
    } else {
      feedback.textContent = `Not quite. Correct: ${fullWordAnswer(currentWord)}`;
      feedback.className = "feedback bad";
      recordWord(currentWord, false, false, false);
    }
  } else {
    feedback.textContent = `Not quite. Correct: ${fullWordAnswer(currentWord)}`;
    feedback.className = "feedback bad";
    recordWord(currentWord, false, false, false);
  }
  input.disabled = true;
}

function showSentence() {
  currentSentence = pick(data.sentences);
  $("sentencePrompt").textContent = currentSentence.en;
  $("sentenceAnswer").value = "";
  $("sentenceAnswer").disabled = false;
  $("sentenceFeedback").textContent = "";
  $("sentenceFeedback").className = "feedback";
}

function checkSentence() {
  if (!currentSentence) return;
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

function recordGrammar(grammar, correct) {
  const id = String(grammar.id);
  const item = progress.grammars[id] || { correct: 0, wrong: 0, lastSeen: "" };
  correct ? item.correct += 1 : item.wrong += 1;
  item.lastSeen = todayKey();
  progress.grammars[id] = item;
  markPracticeMinute();
  saveProgress();
}

function showGrammar() {
  currentGrammar = filteredGrammarItems()[Math.floor(Math.random() * filteredGrammarItems().length)] || (data.grammar || [])[0];
  selectedGrammarOption = "";
  const prompt = $("grammarPrompt");
  const label = $("grammarCaseLabel");
  const options = $("grammarOptions");
  const context = $("grammarContext");
  const input = $("grammarAnswer");
  const feedback = $("grammarFeedback");

  if (!currentGrammar) {
    prompt.textContent = "No grammar questions available.";
    return;
  }

  label.textContent = `${currentGrammar.case || "Grammar"} • ${currentGrammar.level} • ${currentGrammar.category || "mixed"}`;
  prompt.textContent = currentGrammar.prompt;
  if (context) {
    const contextText = currentGrammar.context || currentGrammar.meaning || currentGrammar.translation || "";
    context.textContent = contextText ? `Expected meaning: ${contextText}` : "";
    context.style.display = contextText ? "block" : "none";
  }
  feedback.textContent = "";
  feedback.className = "feedback";
  input.value = "";
  input.disabled = false;
  options.innerHTML = "";

  const isChoice = currentGrammar.mode === "choice";
  input.style.display = isChoice ? "none" : "block";
  options.style.display = isChoice ? "flex" : "none";

  if (isChoice) {
    (currentGrammar.options || []).forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "grammar-option";
      button.textContent = option;
      button.addEventListener("click", () => {
        selectedGrammarOption = option;
        document.querySelectorAll(".grammar-option").forEach(btn => btn.classList.remove("selected"));
        button.classList.add("selected");
      });
      options.appendChild(button);
    });
  }
}

function grammarAcceptedAnswers(grammar) {
  return [grammar.answer, ...(grammar.accepted || [])].map(normalize);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function articleFromAnswerPart(value) {
  const normalized = normalize(value);
  const contractions = {
    am: "dem",
    im: "dem",
    zum: "dem",
    zur: "der",
    ins: "das",
    vom: "dem",
    ans: "das"
  };
  const parts = normalized.split(" ").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (["der", "die", "das", "den", "dem"].includes(parts[i])) return parts[i];
    if (contractions[parts[i]]) return contractions[parts[i]];
  }
  return "";
}

function getGrammarPromptParts(grammar) {
  const prompt = grammar.prompt || "";
  const marker = "___";
  const markerIndex = prompt.indexOf(marker);
  if (markerIndex < 0) return { before: "", after: "" };
  return {
    before: prompt.slice(0, markerIndex).trim(),
    after: prompt.slice(markerIndex + marker.length).trim()
  };
}

function cleanGrammarNounText(value) {
  return String(value || "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

function nounFromGrammar(grammar) {
  if (grammar.noun) return grammar.noun;
  const { after } = getGrammarPromptParts(grammar);
  const cleanedAfter = cleanGrammarNounText(after);
  const afterParts = cleanedAfter.split(/\s+/).filter(Boolean);

  if (afterParts.length >= 2 && ["der", "die", "das", "den", "dem"].includes(normalize(afterParts[0]))) {
    return afterParts.slice(1).join(" ");
  }
  if (afterParts.length) return afterParts.join(" ");

  const answerParts = cleanGrammarNounText(grammar.answer || "").split(/\s+/).filter(Boolean);
  const possibleNoun = answerParts[answerParts.length - 1] || "";
  return possibleNoun && !["der", "die", "das", "den", "dem"].includes(normalize(possibleNoun)) ? possibleNoun : "";
}

function findWordByGerman(noun) {
  const normalizedNoun = normalize(noun);
  return (data.words || []).find(word =>
    normalize(word.de) === normalizedNoun || normalize(word.plural || "") === normalizedNoun
  );
}

function caseName(grammar) {
  const raw = String(grammar.case || "").toLowerCase();
  if (raw.includes("dativ") || raw.includes("dative")) return "Dativ";
  if (raw.includes("akkusativ") || raw.includes("accusative")) return "Akkusativ";
  if (raw.includes("nominativ") || raw.includes("nominative")) return "Nominativ";
  return grammar.case || "";
}

function fullGrammarAnswer(grammar) {
  if (grammar.fullAnswer) return grammar.fullAnswer;
  const { before, after } = getGrammarPromptParts(grammar);
  const suffix = cleanGrammarNounText(after);
  const answer = grammar.answer || "";
  if (!suffix) return answer;

  const suffixParts = suffix.split(/\s+/).filter(Boolean);
  const suffixStartsWithArticle = suffixParts.length && ["der", "die", "das", "den", "dem"].includes(normalize(suffixParts[0]));

  if (suffixStartsWithArticle) return `${answer} ${suffix}`.replace(/\s+/g, " ").trim();

  const beforeParts = before.split(/\s+/).filter(Boolean);
  const prepositionBeforeBlank = beforeParts[beforeParts.length - 1] || "";
  const answerHasPreposition = String(answer).trim().split(/\s+/).length > 1;

  return `${answerHasPreposition ? "" : prepositionBeforeBlank} ${answer} ${suffix}`.replace(/\s+/g, " ").trim();
}

function grammarArticleBreakdown(grammar) {
  if (grammar.articleBreakdown) return grammar.articleBreakdown;
  const noun = nounFromGrammar(grammar);
  if (!noun) return "";

  const word = findWordByGerman(noun);
  const baseArticle = grammar.baseArticle || (word && word.article) || "";
  const changedArticle = grammar.changedArticle || articleFromAnswerPart(fullGrammarAnswer(grammar)) || articleFromAnswerPart(grammar.answer || "");
  const grammarCase = caseName(grammar);

  if (!baseArticle || !changedArticle || !grammarCase) return "";

  return `${baseArticle} ${noun} → ${changedArticle} ${noun} (${grammarCase})`;
}

function grammarFeedbackHtml(grammar, isCorrect) {
  const prefix = isCorrect ? "Correct" : "Not quite";
  const full = fullGrammarAnswer(grammar);
  const breakdown = grammarArticleBreakdown(grammar);
  const explanation = grammar.explanation || "";

  return `
    <div>${escapeHtml(prefix)}.</div>
    <div class="grammar-feedback-detail"><b>Correct:</b> ${escapeHtml(full)}</div>
    ${breakdown ? `<div class="grammar-feedback-detail">${escapeHtml(breakdown)}</div>` : ""}
    ${explanation ? `<div class="grammar-feedback-note">${escapeHtml(explanation)}</div>` : ""}
  `;
}

function checkGrammar() {
  if (!currentGrammar) return;
  const isChoice = currentGrammar.mode === "choice";
  const given = isChoice ? selectedGrammarOption : $("grammarAnswer").value;
  const feedback = $("grammarFeedback");
  const isCorrect = grammarAcceptedAnswers(currentGrammar).includes(normalize(given));

  if (!given.trim()) {
    feedback.textContent = isChoice ? "Choose an option first." : "Type an answer first.";
    feedback.className = "feedback warn";
    return;
  }

  feedback.innerHTML = grammarFeedbackHtml(currentGrammar, isCorrect);
  feedback.className = isCorrect ? "feedback good" : "feedback bad";
  recordGrammar(currentGrammar, isCorrect);
  $("grammarAnswer").disabled = true;
  document.querySelectorAll(".grammar-option").forEach(button => button.disabled = true);
}

function revealGrammar() {
  if (!currentGrammar) return;
  const feedback = $("grammarFeedback");
  feedback.innerHTML = grammarFeedbackHtml(currentGrammar, true);
  feedback.className = "feedback good";
}

function wordStats(word) {
  return progress.words[String(word.id)] || { correct: 0, wrong: 0, articleMissing: 0, articleWrong: 0, lastSeen: "" };
}

function difficultWords() {
  return data.words
    .map(word => ({ word, stats: wordStats(word) }))
    .filter(item => item.stats.wrong > 0 || item.stats.articleMissing > 0 || item.stats.articleWrong > 0)
    .sort((a, b) => (b.stats.wrong + b.stats.articleMissing + b.stats.articleWrong) - (a.stats.wrong + a.stats.articleMissing + a.stats.articleWrong));
}

function renderStats() {
  const wordTotal = Object.values(progress.words).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  const sentenceTotal = Object.values(progress.sentences).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.builders).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.grammars || {}).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  $("wordsPracticed").textContent = wordTotal;
  $("sentencesCompleted").textContent = sentenceTotal;
  $("difficultWords").textContent = difficultWords().length;
  $("todayPractice").textContent = `${progress.practiceByDate[todayKey()] || 0} min`;
}

function searchMatches(text, query) {
  return normalize(text).includes(normalize(query));
}

function renderDifficultList() {
  const query = $("difficultSearch") ? $("difficultSearch").value : "";
  const items = difficultWords().filter(({ word, stats }) => {
    const haystack = `${word.en} ${fullWordAnswer(word)} ${word.type} wrong ${stats.wrong} article missing ${stats.articleMissing} wrong article ${stats.articleWrong || 0}`;
    return searchMatches(haystack, query);
  });
  if (!items.length) {
    $("difficultList").innerHTML = `<p>No matching difficult words yet.</p>`;
    return;
  }
  const rows = [`<div class="row header-row"><b>English</b><b>German</b><b>Issues</b><b>Last seen</b></div>`];
  items.forEach(({ word, stats }) => {
    const issues = [`Wrong word: ${stats.wrong}`, `Article missing: ${stats.articleMissing}`, `Wrong article: ${stats.articleWrong || 0}`].join(" • ");
    rows.push(`<div class="row"><span>${word.en}</span><span>${fullWordAnswer(word)}</span><span>${issues}</span><span>${stats.lastSeen || "-"}</span></div>`);
  });
  $("difficultList").innerHTML = rows.join("");
}

function renderContentList() {
  const query = $("contentSearch") ? $("contentSearch").value : "";
  const rows = [];
  rows.push(`<div class="row header-row"><b>Level</b><b>English / Prompt</b><b>German / Answer</b><b>Type / Category</b></div>`);
  data.words.forEach(word => {
    const text = `${word.level} ${word.en} ${fullWordAnswer(word)} ${word.plural || ""} ${word.type} ${word.category || ""}`;
    if (!searchMatches(text, query)) return;
    const german = word.plural ? `${fullWordAnswer(word)} / die ${word.plural}` : fullWordAnswer(word);
    rows.push(`<div class="row"><span>${word.level}</span><span>${word.en}</span><span>${german}</span><span>${word.type} • ${word.category || "-"}</span></div>`);
  });
  data.sentences.forEach(sentence => {
    const text = `${sentence.level} ${sentence.en} ${sentence.de} sentence ${sentence.category || ""}`;
    if (!searchMatches(text, query)) return;
    rows.push(`<div class="row"><span>${sentence.level}</span><span>${sentence.en}</span><span>${sentence.de}</span><span>sentence • ${sentence.category || "-"}</span></div>`);
  });
  (data.grammar || []).forEach(grammar => {
    const text = `${grammar.level} ${grammar.case} ${grammar.prompt} ${grammar.answer} ${grammar.context || ""} grammar article dative accusative nominative preposition location movement ${grammar.category || ""} ${grammar.grammarTopic || ""}`;
    if (!searchMatches(text, query)) return;
    rows.push(`<div class="row"><span>${grammar.level}</span><span>${grammar.prompt}</span><span>${grammar.answer}</span><span>${grammar.case} • ${grammar.category || "-"}</span></div>`);
  });
  $("contentList").innerHTML = rows.join("");
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
  $("themeToggle").addEventListener("click", toggleTheme);

  bindTabs();
  populateCategoryFilter();
  renderContentList();
  renderStats();
  renderDifficultList();
  showWord();
  showSentence();
  showBuilder();
  showGrammar();

  $("checkWord").addEventListener("click", checkWord);
  $("nextWord").addEventListener("click", showWord);
  $("showWord").addEventListener("click", () => $("wordFeedback").textContent = fullWordAnswer(currentWord));
  $("wordAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkWord(); });

  $("checkSentence").addEventListener("click", checkSentence);
  $("nextSentence").addEventListener("click", showSentence);
  $("showSentence").addEventListener("click", () => $("sentenceFeedback").textContent = currentSentence.de);
  $("sentenceAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkSentence(); });

  $("checkBuild").addEventListener("click", checkBuild);
  $("nextBuild").addEventListener("click", showBuilder);
  $("undoBuild").addEventListener("click", () => { builtWords.pop(); renderBuilt(); });
  $("clearBuild").addEventListener("click", () => { builtWords = []; renderBuilt(); });

  $("checkGrammar").addEventListener("click", checkGrammar);
  $("nextGrammar").addEventListener("click", showGrammar);
  $("showGrammar").addEventListener("click", revealGrammar);
  $("grammarAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkGrammar(); });

  function refreshPracticeAfterFilterChange() {
    showWord();
    showSentence();
    showBuilder();
    showGrammar();
    renderContentList();
    renderDifficultList();
  }

  $("levelFilter").addEventListener("change", refreshPracticeAfterFilterChange);
  if ($("categoryFilter")) $("categoryFilter").addEventListener("change", refreshPracticeAfterFilterChange);
  if ($("grammarFocusFilter")) $("grammarFocusFilter").addEventListener("change", () => {
    showGrammar();
    renderContentList();
  });

  if ($("contentSearch")) $("contentSearch").addEventListener("input", renderContentList);
  if ($("difficultSearch")) $("difficultSearch").addEventListener("input", renderDifficultList);

  $("resetProgress").addEventListener("click", () => {
    if (!confirm("Reset all local practice history?")) return;
    progress = loadProgress();
    progress.words = {};
    progress.sentences = {};
    progress.builders = {};
    progress.grammars = {};
    progress.practiceByDate = {};
    progress.lastPracticeDate = "";
    saveProgress();
  });

  setInterval(markPracticeMinute, 60000);
}

init();
