const data = window.LEARNING_DATA;
const STORAGE_KEY = "deTrainerPractice";
let currentWord = null;
let currentSentence = null;
let currentBuild = null;
let currentGrammar = null;
let currentGoethe = null;
let currentVerb = null;
let currentGoetheDirection = "de-en";
let selectedGrammarOption = "";
let builtWords = [];
let sessionStarted = Date.now();
const lastPickedByMode = {};

const $ = (id) => document.getElementById(id);

const answerButtonPairs = {
  checkWord: "showWord",
  checkGoethe: "showGoethe",
  checkSentence: "showSentence",
  checkGrammar: "showGrammar",
  checkVerb: "showVerb"
};

function setCheckLocked(buttonId, locked) {
  const isLocked = Boolean(locked);
  const button = $(buttonId);
  if (button) {
    button.disabled = isLocked;
    button.classList.toggle("is-disabled", isLocked);
  }

  const pairedShowButton = answerButtonPairs[buttonId];
  if (pairedShowButton) {
    const showButton = $(pairedShowButton);
    if (showButton) {
      showButton.disabled = isLocked;
      showButton.classList.toggle("is-disabled", isLocked);
    }
  }
}

function isCheckLocked(buttonId) {
  const button = $(buttonId);
  return Boolean(button && button.disabled);
}

let progress = loadProgress();

function loadProgress() {
  const defaults = {
    words: {},
    sentences: {},
    builders: {},
    grammars: {},
    goethe: {},
    verbs: {},
    mistakes: [],
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

function toggleTheme(event) {
  if (event) event.preventDefault();
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
}

function bindThemeToggle() {
  const toggle = $("themeToggle");
  if (!toggle) return;
  toggle.disabled = false;
  toggle.style.pointerEvents = "auto";
  toggle.addEventListener("click", toggleTheme);
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

function normalizeForCaseCheck(value) {
  return String(value || "")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCapitalizationIssue(answer, expected) {
  const answerCase = normalizeForCaseCheck(answer);
  const expectedCase = normalizeForCaseCheck(expected);
  if (!answerCase || !expectedCase) return false;
  return answerCase !== expectedCase && answerCase.toLocaleLowerCase("de-DE") === expectedCase.toLocaleLowerCase("de-DE");
}

function nounCapitalizationReminder() {
  return "German nouns are always capitalized.";
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
    ...(data.grammar || []).map(item => item.category),
    ...(data.verbConjugations || []).map(item => item.category)
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

function pick(items, mode = "default") {
  const list = filtered(items);
  const source = list.length ? list : items;
  if (!source || !source.length) return null;

  const lastId = lastPickedByMode[mode];
  const candidates = source.length > 1
    ? source.filter(item => String(item.id) !== String(lastId))
    : source;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)] || source[0];
  lastPickedByMode[mode] = chosen && chosen.id;
  return chosen;
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

function fullGoethePrompt(word) {
  return word.article ? `${word.article} ${word.de}` : word.de;
}

function acceptedEnglishAnswers(entry) {
  return String(entry.en || "")
    .split(/[;/,]/)
    .map(value => normalize(value))
    .filter(Boolean);
}

function acceptedGermanAnswers(entry) {
  const full = fullGoethePrompt(entry);
  const answers = [full];
  if (entry.article) answers.push(entry.de);
  return answers.map(normalize).filter(Boolean);
}

function goetheAnswerForDirection(entry, direction) {
  return direction === "en-de" ? fullGoethePrompt(entry) : entry.en;
}

function goethePromptForDirection(entry, direction) {
  return direction === "en-de" ? entry.en : fullGoethePrompt(entry);
}

function goetheDirectionLabel(direction) {
  return direction === "en-de" ? "English → German" : "German → English";
}

function getGoetheDirectionForQuestion() {
  const selected = $("goetheDirection") ? $("goetheDirection").value : "de-en";
  if (selected === "mixed") return Math.random() < 0.5 ? "de-en" : "en-de";
  return selected;
}

function goetheEntriesForPractice() {
  return filtered(data.goetheWords || []).filter(entry => entry.de && entry.en);
}

function recordGoethe(entry, correct, direction = currentGoetheDirection) {
  const id = `${entry.id}:${direction}`;
  const item = progress.goethe[id] || { correct: 0, wrong: 0, lastSeen: "", direction };
  correct ? item.correct += 1 : item.wrong += 1;
  item.lastSeen = todayKey();
  item.direction = direction;
  progress.goethe[id] = item;
  markPracticeMinute();
  saveProgress();
}

function showGoethe() {
  const entries = goetheEntriesForPractice();
  currentGoethe = pick(entries);
  currentGoetheDirection = getGoetheDirectionForQuestion();
  if (!currentGoethe) {
    if ($("goethePrompt")) $("goethePrompt").textContent = "No Goethe vocabulary available.";
    return;
  }

  const isEnglishToGerman = currentGoetheDirection === "en-de";
  $("goethePromptLabel").textContent = isEnglishToGerman ? "English" : "German";
  $("goethePrompt").textContent = goethePromptForDirection(currentGoethe, currentGoetheDirection);
  $("goetheMeta").textContent = `${currentGoethe.level} • ${goetheDirectionLabel(currentGoetheDirection)} • ${currentGoethe.source || "Goethe word list"}`;
  $("goetheAnswer").value = "";
  $("goetheAnswer").disabled = false;
  $("goetheAnswer").placeholder = isEnglishToGerman ? "German answer" : "English meaning";
  $("goetheFeedback").textContent = "";
  $("goetheFeedback").className = "feedback";
  setCheckLocked("checkGoethe", false);
}

function checkGoethe() {
  if (isCheckLocked("checkGoethe")) return;
  if (!currentGoethe) return;
  const rawAnswer = $("goetheAnswer").value.trim();
  const answer = normalize(rawAnswer);
  const feedback = $("goetheFeedback");

  if (!rawAnswer) {
    feedback.textContent = "Type an answer first.";
    feedback.className = "feedback warn";
    return;
  }

  if (currentGoetheDirection === "en-de") {
    const fullAnswerText = fullGoethePrompt(currentGoethe);
    const fullAnswer = normalize(fullAnswerText);
    const possible = acceptedGermanAnswers(currentGoethe);
    const isFullyCorrect = answer === fullAnswer;
    const isAcceptedWithoutArticle = currentGoethe.article && answer === normalize(currentGoethe.de);
    const isCorrect = isFullyCorrect || possible.includes(answer);
    const capitalizationIssue = isCorrect && hasCapitalizationIssue(rawAnswer, isAcceptedWithoutArticle ? currentGoethe.de : fullAnswerText);

    if (isFullyCorrect && !capitalizationIssue) {
      feedback.textContent = `Correct: ${fullAnswerText}`;
      feedback.className = "feedback good";
    } else if (capitalizationIssue) {
      feedback.innerHTML = `Correct word, but check capitalization.<br><br><b>Your answer:</b> ${escapeHtml(rawAnswer)}<br><b>Correct:</b> ${escapeHtml(fullAnswerText)}<br>${escapeHtml(nounCapitalizationReminder())}`;
      feedback.className = "feedback warn";
    } else if (isAcceptedWithoutArticle) {
      feedback.textContent = `Correct word, article missing: ${fullAnswerText}`;
      feedback.className = "feedback warn";
    } else {
      feedback.textContent = `Not quite. Correct: ${fullAnswerText}`;
      feedback.className = "feedback bad";
    }
    if (!isCorrect || capitalizationIssue || isAcceptedWithoutArticle) {
      recordMistake("goethe", {
        itemId: `${currentGoethe.id}:${currentGoetheDirection}`,
        level: currentGoethe.level,
        category: currentGoethe.category,
        prompt: goethePromptForDirection(currentGoethe, currentGoetheDirection),
        expected: fullAnswerText,
        given: rawAnswer,
        issue: capitalizationIssue ? "Capitalization" : (isAcceptedWithoutArticle ? "Article missing" : "Wrong answer")
      });
    }
    recordGoethe(currentGoethe, isCorrect, currentGoetheDirection);
    $("goetheAnswer").disabled = true;
    setCheckLocked("checkGoethe", true);
    return;
  }

  const accepted = acceptedEnglishAnswers(currentGoethe);
  const isCorrect = accepted.includes(answer);
  feedback.textContent = isCorrect
    ? `Correct: ${currentGoethe.en}`
    : `Not quite. Correct: ${currentGoethe.en}`;
  feedback.className = isCorrect ? "feedback good" : "feedback bad";
  if (!isCorrect) {
    recordMistake("goethe", {
      itemId: `${currentGoethe.id}:${currentGoetheDirection}`,
      level: currentGoethe.level,
      category: currentGoethe.category,
      prompt: goethePromptForDirection(currentGoethe, currentGoetheDirection),
      expected: currentGoethe.en,
      given: rawAnswer,
      issue: "Wrong answer"
    });
  }
  recordGoethe(currentGoethe, isCorrect, currentGoetheDirection);
  $("goetheAnswer").disabled = true;
  setCheckLocked("checkGoethe", true);
}

function revealGoethe() {
  if (isCheckLocked("checkGoethe")) return;
  if (!currentGoethe) return;
  const expected = goetheAnswerForDirection(currentGoethe, currentGoetheDirection);
  const feedback = $("goetheFeedback");
  feedback.textContent = expected;
  feedback.className = "feedback good";
  const input = $("goetheAnswer");
  const given = input ? input.value : "";
  recordMistake("goethe", {
    itemId: `${currentGoethe.id}:${currentGoetheDirection}`,
    level: currentGoethe.level,
    category: currentGoethe.category,
    prompt: goethePromptForDirection(currentGoethe, currentGoetheDirection),
    expected,
    given,
    issue: "Show answer"
  });
  recordGoethe(currentGoethe, false, currentGoetheDirection);
  if (input) input.disabled = true;
  setCheckLocked("checkGoethe", true);
}


function recordWord(word, correct, articleMissing = false, articleWrong = false, capitalizationMistake = false) {
  const id = String(word.id);
  const item = progress.words[id] || { correct: 0, wrong: 0, articleMissing: 0, articleWrong: 0, capitalizationMistakes: 0, lastSeen: "" };
  if (correct) item.correct += 1;
  else item.wrong += 1;
  if (articleMissing) item.articleMissing += 1;
  if (articleWrong) item.articleWrong += 1;
  if (capitalizationMistake) item.capitalizationMistakes = (item.capitalizationMistakes || 0) + 1;
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

function mistakeKey(tab, itemId, expected, prompt) {
  return [tab, itemId || "", normalize(expected || ""), normalize(prompt || "")].join("|");
}

function recordMistake(tab, details) {
  if (!progress.mistakes || !Array.isArray(progress.mistakes)) progress.mistakes = [];
  const key = mistakeKey(tab, details.itemId, details.expected, details.prompt);
  let item = progress.mistakes.find(entry => entry.key === key);
  if (!item) {
    item = {
      key,
      tab,
      itemId: details.itemId || "",
      level: details.level || "",
      category: details.category || "",
      prompt: details.prompt || "",
      expected: details.expected || "",
      lastAnswer: "",
      issue: "",
      count: 0,
      lastSeen: ""
    };
    progress.mistakes.push(item);
  }
  item.count += 1;
  item.lastAnswer = details.given || "";
  item.issue = details.issue || "Wrong answer";
  item.level = details.level || item.level || "";
  item.category = details.category || item.category || "";
  item.lastSeen = todayKey();
  progress.mistakes = progress.mistakes.slice(-800);
}

function tabLabel(tab) {
  const labels = {
    words: "Words",
    sentences: "Sentences",
    builders: "Sentence Builder",
    grammars: "Grammar",
    goethe: "Goethe Words",
    verbs: "Verb Conjugation"
  };
  return labels[tab] || tab;
}

function mistakeSortValue(item) {
  const order = { words: 1, goethe: 2, sentences: 3, builders: 4, grammars: 5, verbs: 6 };
  return order[item.tab] || 99;
}

function showWord() {
  currentWord = pick(data.words, "words");
  $("wordPrompt").textContent = currentWord.en;
  $("wordAnswer").value = "";
  $("wordAnswer").disabled = false;
  $("wordFeedback").textContent = "";
  $("wordFeedback").className = "feedback";
  setCheckLocked("checkWord", false);
}

function splitArticleAnswer(value) {
  const rawParts = String(value || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const normalizedParts = normalize(value).split(" ").filter(Boolean);
  if (normalizedParts.length < 2) {
    return { article: "", word: normalize(value), rawWord: String(value || "").trim() };
  }
  return {
    article: normalizedParts[0],
    word: normalizedParts.slice(1).join(" "),
    rawWord: rawParts.slice(1).join(" ")
  };
}

function checkWord() {
  if (isCheckLocked("checkWord")) return;
  if (!currentWord) return;
  const input = $("wordAnswer");
  const rawAnswer = input.value;
  const answer = normalize(rawAnswer);
  const possible = acceptedWordAnswers(currentWord).map(normalize);
  const fullAnswerText = fullWordAnswer(currentWord);
  const fullAnswer = normalize(fullAnswerText);
  const feedback = $("wordFeedback");
  let mistakeIssue = "";

  if (answer === fullAnswer) {
    const capitalizationIssue = hasCapitalizationIssue(rawAnswer, fullAnswerText);
    if (capitalizationIssue && currentWord.type === "noun") {
      feedback.innerHTML = `Correct word, but remember capitalization.<br><br><b>Your answer:</b> ${escapeHtml(rawAnswer)}<br><b>Correct:</b> ${escapeHtml(fullAnswerText)}<br>${nounCapitalizationReminder()}`;
      feedback.className = "feedback warn";
      mistakeIssue = "Capitalization";
      recordWord(currentWord, true, false, false, true);
    } else {
      feedback.textContent = `Correct: ${fullAnswerText}`;
      feedback.className = "feedback good";
      recordWord(currentWord, true, false, false, false);
    }
  } else if (possible.includes(answer)) {
    const capitalizationIssue = hasCapitalizationIssue(rawAnswer, currentWord.de);
    const extra = capitalizationIssue && currentWord.type === "noun" ? ` ${nounCapitalizationReminder()}` : "";
    feedback.textContent = `Correct word, article missing: ${fullAnswerText}.${extra}`;
    feedback.className = "feedback warn";
    mistakeIssue = capitalizationIssue && currentWord.type === "noun" ? "Article missing + capitalization" : "Article missing";
    recordWord(currentWord, true, true, false, capitalizationIssue && currentWord.type === "noun");
  } else if (currentWord.article) {
    const given = splitArticleAnswer(input.value);
    const correctWordOnly = normalize(currentWord.de);
    const correctPlural = normalize(currentWord.plural || "");
    const wordIsCorrect = given.word === correctWordOnly || (correctPlural && given.word === correctPlural);
    if (wordIsCorrect && given.article && given.article !== normalize(currentWord.article)) {
      const capitalizationIssue = currentWord.type === "noun" && hasCapitalizationIssue(given.rawWord, currentWord.de);
      if (capitalizationIssue) {
        feedback.innerHTML = `Correct word, but two issues found:<br><br>• Wrong article<br>• Noun should be capitalized<br><br><b>Your answer:</b> ${escapeHtml(rawAnswer)}<br><b>Correct:</b> ${escapeHtml(fullAnswerText)}`;
      } else {
        feedback.innerHTML = `Correct word, wrong article.<br><br><b>Your answer:</b> ${escapeHtml(rawAnswer)}<br><b>Correct:</b> ${escapeHtml(fullAnswerText)}`;
      }
      feedback.className = "feedback warn";
      mistakeIssue = capitalizationIssue ? "Wrong article + capitalization" : "Wrong article";
      recordWord(currentWord, true, false, true, capitalizationIssue);
    } else {
      feedback.textContent = `Not quite. Correct: ${fullAnswerText}`;
      feedback.className = "feedback bad";
      mistakeIssue = "Wrong word";
      recordWord(currentWord, false, false, false, false);
    }
  } else {
    feedback.textContent = `Not quite. Correct: ${fullAnswerText}`;
    feedback.className = "feedback bad";
    mistakeIssue = "Wrong word";
    recordWord(currentWord, false, false, false, false);
  }
  if (mistakeIssue) {
    recordMistake("words", {
      itemId: currentWord.id,
      level: currentWord.level,
      category: currentWord.category || currentWord.type,
      prompt: currentWord.en,
      expected: fullAnswerText,
      given: rawAnswer,
      issue: mistakeIssue
    });
  }
  input.disabled = true;
  setCheckLocked("checkWord", true);
}

function revealWord() {
  if (isCheckLocked("checkWord")) return;
  if (!currentWord) return;
  const expected = fullWordAnswer(currentWord);
  const feedback = $("wordFeedback");
  feedback.textContent = expected;
  feedback.className = "feedback good";
  const input = $("wordAnswer");
  const given = input ? input.value : "";
  recordMistake("words", {
    itemId: currentWord.id,
    level: currentWord.level,
    category: currentWord.category || currentWord.type,
    prompt: currentWord.en,
    expected,
    given,
    issue: "Show answer"
  });
  recordWord(currentWord, false, false, false, false);
  if (input) input.disabled = true;
  setCheckLocked("checkWord", true);
}

function sentenceStyleText(sentence) {
  const style = sentence.formality || sentence.style || "neutral";
  if (style === "formal") return "Expected style: formal Sie";
  if (style === "informal") return "Expected style: informal du";
  return "Expected style: neutral / everyday";
}

function filteredSentences() {
  const styleFilter = $("sentenceStyleFilter") ? $("sentenceStyleFilter").value : "all";
  const base = filtered(data.sentences);
  return base.filter(sentence => {
    const style = sentence.formality || sentence.style || "neutral";
    return styleFilter === "all" || style === styleFilter;
  });
}

function pickSentence(mode) {
  const list = filteredSentences();
  const source = list.length ? list : data.sentences;
  const lastId = lastPickedByMode[mode];
  const candidates = source.length > 1 ? source.filter(item => String(item.id) !== String(lastId)) : source;
  const picked = candidates[Math.floor(Math.random() * candidates.length)] || source[0];
  lastPickedByMode[mode] = picked && picked.id;
  return picked;
}

function renderSentenceContext(elementId, sentence) {
  const el = $(elementId);
  if (!el || !sentence) return;
  const style = sentenceStyleText(sentence);
  const note = sentence.context || sentence.meaning || "";
  el.textContent = note ? `${style} • ${note}` : style;
  el.style.display = "block";
}

function showSentence() {
  currentSentence = pickSentence("sentences");
  $("sentencePrompt").textContent = currentSentence.en;
  renderSentenceContext("sentenceContext", currentSentence);
  $("sentenceAnswer").value = "";
  $("sentenceAnswer").disabled = false;
  $("sentenceFeedback").textContent = "";
  $("sentenceFeedback").className = "feedback";
  setCheckLocked("checkSentence", false);
}

function checkSentence() {
  if (isCheckLocked("checkSentence")) return;
  if (!currentSentence) return;
  const rawAnswer = $("sentenceAnswer").value;
  const answer = normalize(rawAnswer);
  const correct = normalize(currentSentence.de);
  const feedback = $("sentenceFeedback");
  const isCorrect = answer === correct;
  const capitalizationIssue = isCorrect && hasCapitalizationIssue(rawAnswer, currentSentence.de);

  if (isCorrect && capitalizationIssue) {
    feedback.innerHTML = `Correct sentence, but check capitalization.<br><br><b>Your answer:</b> ${escapeHtml(rawAnswer)}<br><b>Correct:</b> ${escapeHtml(currentSentence.de)}<br>${nounCapitalizationReminder()}`;
    feedback.className = "feedback warn";
  } else {
    feedback.textContent = isCorrect ? `Correct: ${currentSentence.de}` : `Not quite. Correct: ${currentSentence.de}`;
    feedback.className = isCorrect ? "feedback good" : "feedback bad";
  }
  if (!isCorrect || capitalizationIssue) {
    recordMistake("sentences", {
      itemId: currentSentence.id,
      level: currentSentence.level,
      category: currentSentence.category,
      prompt: currentSentence.en,
      expected: currentSentence.de,
      given: rawAnswer,
      issue: capitalizationIssue ? "Capitalization" : "Wrong sentence"
    });
  }
  recordSentence("sentences", currentSentence, isCorrect);
  $("sentenceAnswer").disabled = true;
  setCheckLocked("checkSentence", true);
}

function revealSentence() {
  if (isCheckLocked("checkSentence")) return;
  if (!currentSentence) return;
  const feedback = $("sentenceFeedback");
  feedback.textContent = currentSentence.de;
  feedback.className = "feedback good";
  const input = $("sentenceAnswer");
  const given = input ? input.value : "";
  recordMistake("sentences", {
    itemId: currentSentence.id,
    level: currentSentence.level,
    category: currentSentence.category,
    prompt: currentSentence.en,
    expected: currentSentence.de,
    given,
    issue: "Show answer"
  });
  recordSentence("sentences", currentSentence, false);
  if (input) input.disabled = true;
  setCheckLocked("checkSentence", true);
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
  currentBuild = pickSentence("builder");
  builtWords = [];
  $("builderPrompt").textContent = currentBuild.en;
  renderSentenceContext("builderContext", currentBuild);
  $("builderFeedback").textContent = "";
  $("builderFeedback").className = "feedback";
  setCheckLocked("checkBuild", false);
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
  if (isCheckLocked("checkBuild")) return;
  if (!currentBuild) return;
  const built = normalize(builtWords.map(item => item.word).join(" "));
  const correct = normalize(currentBuild.de);
  const feedback = $("builderFeedback");
  const isCorrect = built === correct;
  feedback.textContent = isCorrect ? `Correct: ${currentBuild.de}` : `Not quite. Correct: ${currentBuild.de}`;
  feedback.className = isCorrect ? "feedback good" : "feedback bad";
  if (!isCorrect) {
    recordMistake("builders", {
      itemId: currentBuild.id,
      level: currentBuild.level,
      category: currentBuild.category,
      prompt: currentBuild.en,
      expected: currentBuild.de,
      given: builtWords.map(item => item.word).join(" "),
      issue: "Wrong word order"
    });
  }
  recordSentence("builders", currentBuild, isCorrect);
  setCheckLocked("checkBuild", true);
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
  const grammarItems = filteredGrammarItems();
  const grammarSource = grammarItems.length ? grammarItems : (data.grammar || []);
  const lastId = lastPickedByMode.grammar;
  const candidates = grammarSource.length > 1
    ? grammarSource.filter(item => String(item.id) !== String(lastId))
    : grammarSource;
  currentGrammar = candidates[Math.floor(Math.random() * candidates.length)] || grammarSource[0] || null;
  lastPickedByMode.grammar = currentGrammar && currentGrammar.id;
  selectedGrammarOption = "";
  const prompt = $("grammarPrompt");
  const label = $("grammarCaseLabel");
  const options = $("grammarOptions");
  const context = $("grammarContext");
  const input = $("grammarAnswer");
  const feedback = $("grammarFeedback");

  if (!currentGrammar) {
    prompt.textContent = "No grammar questions available.";
    const grammarChars = $("grammarSpecialChars");
    if (grammarChars) grammarChars.style.display = "none";
    return;
  }

  label.textContent = `${currentGrammar.case || "Grammar"} • ${currentGrammar.level} • ${currentGrammar.category || "mixed"}`;
  prompt.textContent = currentGrammar.prompt;
  if (context) {
    const contextText = grammarPromptHint(currentGrammar);
    context.textContent = contextText;
    context.style.display = contextText ? "block" : "none";
  }
  feedback.textContent = "";
  feedback.className = "feedback";
  setCheckLocked("checkGrammar", false);
  input.value = "";
  input.disabled = false;
  options.innerHTML = "";

  const isChoice = currentGrammar.mode === "choice";
  input.style.display = isChoice ? "none" : "block";
  options.style.display = isChoice ? "flex" : "none";
  const grammarChars = $("grammarSpecialChars");
  if (grammarChars) grammarChars.style.display = isChoice ? "none" : "flex";

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

function grammarPromptHint(grammar) {
  const topic = grammar.grammarTopic || grammar.category || "";
  const grammarCase = grammar.case || "";
  const parts = [];

  if (grammar.mode === "choice") parts.push("Pick the missing word.");
  else parts.push("Type the missing word or phrase.");

  if (topic === "formality" || grammar.formality) {
    const style = grammar.formality || grammar.style || "";
    if (style === "formal") parts.push("Use formal Sie.");
    else if (style === "informal") parts.push("Use informal du/ihr.");
    else parts.push("Use natural everyday German.");
    return parts.join(" ");
  }

  if (topic === "location-movement") {
    const raw = `${grammarCase} ${grammar.context || ""}`.toLowerCase();
    if (raw.includes("movement") || raw.includes("direction")) {
      parts.push("Meaning: movement or direction.");
    } else if (raw.includes("location") || raw.includes("already")) {
      parts.push("Meaning: already there / location.");
    }
    if (grammarCase) parts.push(`Case focus: ${grammarCase}.`);
    return parts.join(" ");
  }

  if (topic === "prepositions" || String(grammar.category || "").includes("preposition")) {
    parts.push("Choose the natural preposition.");
    return parts.join(" ");
  }

  if (topic === "articles" || String(grammar.category || "").includes("article")) {
    if (grammarCase) parts.push(`Case focus: ${grammarCase}.`);
    return parts.join(" ");
  }

  if (grammarCase) parts.push(`Case focus: ${grammarCase}.`);
  return parts.join(" ");
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
  if (isCheckLocked("checkGrammar")) return;
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

  const typedCapitalizationIssue = !isChoice && isCorrect && [currentGrammar.answer, ...(currentGrammar.accepted || [])]
    .some(expected => hasCapitalizationIssue(given, expected));

  feedback.innerHTML = grammarFeedbackHtml(currentGrammar, isCorrect);
  if (typedCapitalizationIssue) {
    feedback.innerHTML += `<div class="grammar-feedback-note">${escapeHtml(nounCapitalizationReminder())}</div>`;
  }
  feedback.className = typedCapitalizationIssue ? "feedback warn" : (isCorrect ? "feedback good" : "feedback bad");
  if (!isCorrect || typedCapitalizationIssue) {
    recordMistake("grammars", {
      itemId: currentGrammar.id,
      level: currentGrammar.level,
      category: currentGrammar.category || currentGrammar.grammarTopic,
      prompt: currentGrammar.prompt,
      expected: fullGrammarAnswer(currentGrammar),
      given,
      issue: typedCapitalizationIssue ? "Capitalization" : "Wrong grammar answer"
    });
  }
  recordGrammar(currentGrammar, isCorrect);
  $("grammarAnswer").disabled = true;
  document.querySelectorAll(".grammar-option").forEach(button => button.disabled = true);
  setCheckLocked("checkGrammar", true);
}

function revealGrammar() {
  if (isCheckLocked("checkGrammar")) return;
  if (!currentGrammar) return;
  const feedback = $("grammarFeedback");
  feedback.innerHTML = grammarFeedbackHtml(currentGrammar, true);
  feedback.className = "feedback good";
  const input = $("grammarAnswer");
  const given = currentGrammar.mode === "choice" ? selectedGrammarOption : (input ? input.value : "");
  recordMistake("grammars", {
    itemId: currentGrammar.id,
    level: currentGrammar.level,
    category: currentGrammar.category || currentGrammar.grammarTopic,
    prompt: currentGrammar.prompt,
    expected: fullGrammarAnswer(currentGrammar),
    given,
    issue: "Show answer"
  });
  recordGrammar(currentGrammar, false);
  if (input) input.disabled = true;
  document.querySelectorAll(".grammar-option").forEach(button => button.disabled = true);
  setCheckLocked("checkGrammar", true);
}

function wordStats(word) {
  const stats = progress.words[String(word.id)] || {};
  return {
    correct: stats.correct || 0,
    wrong: stats.wrong || 0,
    articleMissing: stats.articleMissing || 0,
    articleWrong: stats.articleWrong || 0,
    capitalizationMistakes: stats.capitalizationMistakes || 0,
    lastSeen: stats.lastSeen || ""
  };
}

function legacyWordMistakes() {
  return data.words
    .map(word => ({ word, stats: wordStats(word) }))
    .filter(item => item.stats.wrong > 0 || item.stats.articleMissing > 0 || item.stats.articleWrong > 0 || item.stats.capitalizationMistakes > 0)
    .map(({ word, stats }) => ({
      key: `legacy-word-${word.id}`,
      tab: "words",
      itemId: word.id,
      level: word.level,
      category: word.category || word.type,
      prompt: word.en,
      expected: fullWordAnswer(word),
      lastAnswer: "",
      issue: [`Wrong word: ${stats.wrong}`, `Article missing: ${stats.articleMissing}`, `Wrong article: ${stats.articleWrong || 0}`, `Capitalization: ${stats.capitalizationMistakes || 0}`].join(" • "),
      count: stats.wrong + stats.articleMissing + stats.articleWrong + stats.capitalizationMistakes,
      lastSeen: stats.lastSeen || ""
    }));
}

function difficultWords() {
  const stored = Array.isArray(progress.mistakes) ? progress.mistakes : [];
  const byKey = new Map();
  [...legacyWordMistakes(), ...stored].forEach(item => {
    if (!item || !item.key) return;
    const existing = byKey.get(item.key);
    if (!existing || (item.lastSeen || "") >= (existing.lastSeen || "")) {
      byKey.set(item.key, item);
    }
  });
  return [...byKey.values()].sort((a, b) => {
    const tabSort = mistakeSortValue(a) - mistakeSortValue(b);
    if (tabSort) return tabSort;
    return (b.count || 0) - (a.count || 0) || String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
  });
}

function renderStats() {
  const wordTotal = Object.values(progress.words).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.goethe || {}).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.verbs || {}).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  const sentenceTotal = Object.values(progress.sentences).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.builders).reduce((sum, item) => sum + item.correct + item.wrong, 0)
    + Object.values(progress.grammars || {}).reduce((sum, item) => sum + item.correct + item.wrong, 0);
  $("wordsPracticed").textContent = wordTotal;
  $("sentencesCompleted").textContent = sentenceTotal;
  $("difficultWords").textContent = difficultWords().length;
  $("todayPractice").textContent = `${progress.practiceByDate[todayKey()] || 0} min`;
}

function filteredVerbConjugations() {
  const tense = $("verbTenseFilter") ? $("verbTenseFilter").value : "all";
  return filtered(data.verbConjugations || []).filter(item => tense === "all" || item.tense === tense);
}

function recordVerb(verb, correct) {
  const id = String(verb.id);
  const item = progress.verbs[id] || { correct: 0, wrong: 0, lastSeen: "" };
  correct ? item.correct += 1 : item.wrong += 1;
  item.lastSeen = todayKey();
  progress.verbs[id] = item;
  markPracticeMinute();
  saveProgress();
}

function verbPromptText(verb) {
  return `${verb.verb} → ${verb.tenseLabel || verb.tense} → ${verb.person} form`;
}

function showVerb() {
  const items = filteredVerbConjugations();
  currentVerb = pick(items.length ? items : (data.verbConjugations || []), "verbs");
  const prompt = $("verbPrompt");
  const meta = $("verbMeta");
  const input = $("verbAnswer");
  const feedback = $("verbFeedback");

  if (!currentVerb) {
    if (prompt) prompt.textContent = "No verb conjugation questions available.";
    return;
  }

  prompt.textContent = currentVerb.verb;
  if (meta) {
    meta.textContent = `${currentVerb.meaning || "verb"} • ${currentVerb.tenseLabel || currentVerb.tense} • ${currentVerb.person} form • ${currentVerb.level}`;
    meta.style.display = "block";
  }
  input.value = "";
  input.disabled = false;
  feedback.textContent = "";
  feedback.className = "feedback";
  setCheckLocked("checkVerb", false);
}


function verbPersonPronouns(person) {
  const raw = String(person || "").trim();
  if (raw === "er/sie/es") return ["er", "sie", "es"];
  if (raw === "sie/Sie") return ["sie", "Sie"];
  return raw ? [raw] : [];
}

function acceptedVerbAnswers(verb) {
  const answer = String(verb.answer || "").trim();
  const answers = [answer];
  verbPersonPronouns(verb.person).forEach(pronoun => {
    answers.push(`${pronoun} ${answer}`);
  });
  return [...new Set(answers.map(normalize))];
}

function displayVerbAnswer(verb) {
  const pronouns = verbPersonPronouns(verb.person);
  const answer = String(verb.answer || "").trim();
  if (!pronouns.length) return answer;
  if (pronouns.length === 1) return `${pronouns[0]} ${answer}`;
  return `${pronouns.join(" / ")} ${answer}`;
}

function checkVerb() {
  if (isCheckLocked("checkVerb")) return;
  if (!currentVerb) return;
  const input = $("verbAnswer");
  const rawAnswer = input.value;
  const answer = normalize(rawAnswer);
  const feedback = $("verbFeedback");

  if (!rawAnswer.trim()) {
    feedback.textContent = "Type an answer first.";
    feedback.className = "feedback warn";
    return;
  }

  const isCorrect = acceptedVerbAnswers(currentVerb).includes(answer);
  const shownAnswer = displayVerbAnswer(currentVerb);
  if (isCorrect) {
    feedback.innerHTML = `Correct: ${escapeHtml(shownAnswer)}`;
    feedback.className = "feedback good";
  } else {
    feedback.innerHTML = `Not quite.<br><br><b>${escapeHtml(verbPromptText(currentVerb))}</b><br><b>Correct:</b> ${escapeHtml(shownAnswer)}<br><span class="grammar-feedback-note">You can type only the verb form or include a matching pronoun.</span>`;
    feedback.className = "feedback bad";
  }
  if (!isCorrect) {
    recordMistake("verbs", {
      itemId: currentVerb.id,
      level: currentVerb.level,
      category: currentVerb.tense || "verb",
      prompt: verbPromptText(currentVerb),
      expected: displayVerbAnswer(currentVerb),
      given: rawAnswer,
      issue: "Wrong conjugation"
    });
  }
  recordVerb(currentVerb, isCorrect);
  input.disabled = true;
  setCheckLocked("checkVerb", true);
}

function revealVerb() {
  if (isCheckLocked("checkVerb")) return;
  if (!currentVerb) return;
  const feedback = $("verbFeedback");
  const expected = displayVerbAnswer(currentVerb);
  feedback.innerHTML = `<b>${escapeHtml(verbPromptText(currentVerb))}</b><br>Correct: ${escapeHtml(expected)}<br><span class="grammar-feedback-note">You can type only the verb form or include a matching pronoun.</span>`;
  feedback.className = "feedback good";
  const input = $("verbAnswer");
  const given = input ? input.value : "";
  recordMistake("verbs", {
    itemId: currentVerb.id,
    level: currentVerb.level,
    category: currentVerb.tense || "verb",
    prompt: verbPromptText(currentVerb),
    expected,
    given,
    issue: "Show answer"
  });
  recordVerb(currentVerb, false);
  if (input) input.disabled = true;
  setCheckLocked("checkVerb", true);
}

function searchMatches(text, query) {
  return normalize(text).includes(normalize(query));
}

function renderDifficultList() {
  const query = $("difficultSearch") ? $("difficultSearch").value : "";
  const items = difficultWords().filter(item => {
    const haystack = `${tabLabel(item.tab)} ${item.level || ""} ${item.category || ""} ${item.prompt || ""} ${item.expected || ""} ${item.lastAnswer || ""} ${item.issue || ""}`;
    return searchMatches(haystack, query);
  });
  if (!items.length) {
    $("difficultList").innerHTML = `<p>No matching difficult items yet.</p>`;
    return;
  }

  const rows = [];
  let currentTab = "";
  items.forEach(item => {
    if (item.tab !== currentTab) {
      currentTab = item.tab;
      rows.push(`<div class="row header-row difficult-section-row"><b>${escapeHtml(tabLabel(currentTab))}</b><b>Prompt</b><b>Correct answer</b><b>Issue</b></div>`);
    }
    const meta = [item.level, item.category].filter(Boolean).join(" • ");
    const issue = `${item.issue || "Wrong answer"} (${item.count || 1}×)${item.lastSeen ? ` • ${item.lastSeen}` : ""}`;
    rows.push(`<div class="row"><span>${escapeHtml(meta || "-")}</span><span>${escapeHtml(item.prompt || "-")}<br><small>Your last answer: ${escapeHtml(item.lastAnswer || "-")}</small></span><span>${escapeHtml(item.expected || "-")}</span><span>${escapeHtml(issue)}</span></div>`);
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
    const sentenceStyle = sentence.formality || sentence.style || "neutral";
    const text = `${sentence.level} ${sentence.en} ${sentence.de} sentence ${sentence.category || ""} ${sentenceStyle} ${sentence.context || ""}`;
    if (!searchMatches(text, query)) return;
    rows.push(`<div class="row"><span>${sentence.level}</span><span>${sentence.en}</span><span>${sentence.de}</span><span>sentence • ${sentence.category || "-"} • ${sentenceStyle}</span></div>`);
  });
  (data.grammar || []).forEach(grammar => {
    const text = `${grammar.level} ${grammar.case} ${grammar.prompt} ${grammar.answer} ${grammar.context || ""} grammar article dative accusative nominative preposition location movement ${grammar.category || ""} ${grammar.grammarTopic || ""}`;
    if (!searchMatches(text, query)) return;
    rows.push(`<div class="row"><span>${grammar.level}</span><span>${grammar.prompt}</span><span>${grammar.answer}</span><span>${grammar.case} • ${grammar.category || "-"}</span></div>`);
  });
  (data.verbConjugations || []).forEach(verb => {
    const text = `${verb.level} ${verb.verb} ${verb.meaning || ""} ${verb.tenseLabel || verb.tense} ${verb.person} ${verb.answer} verb conjugation ${verb.category || ""}`;
    if (!searchMatches(text, query)) return;
    rows.push(`<div class="row"><span>${verb.level}</span><span>${verb.verb} → ${verb.tenseLabel || verb.tense} → ${verb.person}</span><span>${verb.answer}</span><span>verb conjugation</span></div>`);
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

function insertAtCursor(input, text) {
  if (!input || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const nextPosition = start + text.length;
  input.focus();
  input.setSelectionRange(nextPosition, nextPosition);
}

function bindSpecialCharacterButtons() {
  document.querySelectorAll(".char-btn[data-target][data-insert]").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.target);
      insertAtCursor(input, button.dataset.insert);
    });
  });
}

function init() {
  const savedTheme = localStorage.getItem("deTrainerTheme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
  bindThemeToggle();

  bindSpecialCharacterButtons();
  bindTabs();
  populateCategoryFilter();
  renderContentList();
  renderStats();
  renderDifficultList();
  showWord();
  showGoethe();
  showSentence();
  showBuilder();
  showGrammar();
  showVerb();

  $("checkWord").addEventListener("click", checkWord);
  $("nextWord").addEventListener("click", showWord);
  $("showWord").addEventListener("click", revealWord);
  $("wordAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkWord(); });

  $("checkGoethe").addEventListener("click", checkGoethe);
  $("nextGoethe").addEventListener("click", showGoethe);
  $("showGoethe").addEventListener("click", revealGoethe);
  $("goetheAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkGoethe(); });
  const goetheDirection = $("goetheDirection");
  if (goetheDirection) goetheDirection.addEventListener("change", showGoethe);

  $("checkSentence").addEventListener("click", checkSentence);
  $("nextSentence").addEventListener("click", showSentence);
  $("showSentence").addEventListener("click", revealSentence);
  $("sentenceAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkSentence(); });

  $("checkBuild").addEventListener("click", checkBuild);
  $("nextBuild").addEventListener("click", showBuilder);
  $("undoBuild").addEventListener("click", () => { builtWords.pop(); renderBuilt(); });
  $("clearBuild").addEventListener("click", () => { builtWords = []; renderBuilt(); });

  $("checkGrammar").addEventListener("click", checkGrammar);
  $("nextGrammar").addEventListener("click", showGrammar);
  $("showGrammar").addEventListener("click", revealGrammar);
  $("grammarAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkGrammar(); });

  $("checkVerb").addEventListener("click", checkVerb);
  $("nextVerb").addEventListener("click", showVerb);
  $("showVerb").addEventListener("click", revealVerb);
  $("verbAnswer").addEventListener("keydown", e => { if (e.key === "Enter") checkVerb(); });

  function refreshPracticeAfterFilterChange() {
    showWord();
    showGoethe();
    showSentence();
    showBuilder();
    showGrammar();
    showVerb();
    renderContentList();
    renderDifficultList();
  }

  $("levelFilter").addEventListener("change", refreshPracticeAfterFilterChange);
  if ($("categoryFilter")) $("categoryFilter").addEventListener("change", refreshPracticeAfterFilterChange);
  if ($("sentenceStyleFilter")) $("sentenceStyleFilter").addEventListener("change", () => {
    showSentence();
    showBuilder();
    renderContentList();
  });
  if ($("grammarFocusFilter")) $("grammarFocusFilter").addEventListener("change", () => {
    showGrammar();
    renderContentList();
  });
  if ($("verbTenseFilter")) $("verbTenseFilter").addEventListener("change", () => {
    showVerb();
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
    progress.goethe = {};
    progress.verbs = {};
    progress.mistakes = [];
    progress.practiceByDate = {};
    progress.lastPracticeDate = "";
    saveProgress();
  });

  setInterval(markPracticeMinute, 60000);
}

init();
