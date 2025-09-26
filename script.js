// タイピングの秋 - MVP Step 3
// 追加: 「しゃ/しゅ/しょ」= sha/sya 系許容, 促音「っ」= xtu/ltu or 子音重ね
(() => {
  'use strict';

  // ==== データ（ダミー）====
  // 本番はあなたの焼き芋文章10本に差し替え
  const QUESTIONS = [
    { id: 1, jp: '芋', romaji: 'imo', chunks: ['imo'] },
    { id: 2, jp: '焼き芋', romaji: 'yakiimo', chunks: ['yakiimo'] },
    { id: 3, jp: 'ホクホクの焼き芋', romaji: 'hokuhokunoyakiimo', chunks: ['hokuhoku', 'no', 'yakiimo'] },
    { id: 4, jp: 'ホクホクの焼き芋をほおばる', romaji: 'hokuhokunoyakiimowohoobaru', chunks: ['hokuhoku', 'no', 'yakiimo', 'wo', 'hoobaru'] },
    {
      id: 5, jp: 'ホクホクの焼き芋をほおばると自然に笑顔になる',
      romaji: 'hokuhokunoyakiimowohoobarutoshizenniegaoninaru',
      chunks: ['hokuhoku', 'no', 'yakiimo', 'wo', 'hoobaruto', 'shizenni', 'egaoni', 'naru']
    },
    { id: 6, jp: 'ホクホクの焼き芋を作りたい', romaji: 'hokuhokunoyakiimowotukuritai', chunks: ['hokuhoku', 'no', 'yakiimo', 'wo', 'tukuritai'] },
    {
      id: 7, jp: 'ホクホクの焼き芋を作るためにタイピングを頑張ります',
      romaji: 'hokuhokunoyakiimowotukurutamenitaipinnguwogannbarimasu',
      chunks: ['hokuhoku', 'no', 'yakiimo', 'wo', 'tukuru', 'tameni', 'taipinngu', 'wo', 'gannbarimasu']
    },
    {
      id: 8, jp: 'ホクホクの焼き芋を作るのは難しい', romaji: 'hokuhokunoyakiimowotukurunohamuzukasii',
      chunks: ['hokuhoku', 'no', 'yakiimo', 'wo', 'tukurunoha', 'muzukasii']
    },
    {
      id: 9, jp: 'ホクホクの焼き芋まであと少し', romaji: 'hokuhokunoyakiimomadeatosukosi',
      chunks: ['hokuhoku', 'no', 'yakiimo', 'made', 'atosukosi']
    },
    {
      id: 10, jp: '焼き芋が完成しましたっっ', romaji: 'yakiimogakannseisimasitaltultu',
      chunks: ['yakiimo', 'ga', 'kannseisimasita', 'ltultu']
    },
  ];

  // 記号・空白は無視
  const IGNORE_RE = /[\s。、，（）()「」『』…—\-!！?？:：;；・．｡､]/g;
  const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
  const isConsonant = (ch) => /^[a-z]$/.test(ch) && !VOWELS.has(ch);

  // ==== 参照 ====
  let screens, overlay, timerEl, romajiLine, jpSentence, feedback;
  let resultAccuracyEl, resultTimeEl, resultGradeEl, bestAccEl, bestTimeEl;

  // ==== 状態 ====
  const state = {
    phase: 'home',       // 'home' | 'ready' | 'playing' | 'finished'
    q: null,
    target: '',
    pointer: 0,
    startedAt: 0,
    timerId: null,
    totalKeys: 0,
    correctKeys: 0,
    lastAcceptedChar: '',

    // 促音（xtu/ltu）入力の進捗: 0=未開始, 1= 'x'/'l' 入力済, 2='t'まで入力済
    sokuonStage: 0,
    sokuonPtr: -1, // 促音を当て込んでいる pointer 位置（ダブル子音の先頭に限定）
  };

  // ==== 画面遷移 ====
  function showScreen(name) {
    Object.values(screens).forEach(sec => { if (sec) sec.hidden = true; });
    const target = screens[name];
    if (target) target.hidden = false;
    state.phase = (name === 'game') ? 'ready' : (name === 'result' ? 'finished' : 'home');
    if (name === 'game') resetGameView();
  }

  function resetGameView() {
    overlay && overlay.removeAttribute('hidden');
    timerEl && (timerEl.textContent = '0.0');
    romajiLine && (romajiLine.textContent = '');
    jpSentence && (jpSentence.textContent = '');
    if (feedback) { feedback.textContent = ''; feedback.className = 'feedback'; }

    state.q = null;
    state.target = '';
    state.pointer = 0;
    state.startedAt = 0;
    state.totalKeys = 0;
    state.correctKeys = 0;
    state.lastAcceptedChar = '';
    state.sokuonStage = 0;
    state.sokuonPtr = -1;

    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  // ==== 開始 ====
  function startGame() {
    state.q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

    // 表示用：chunks があれば使用
    const chunks = Array.isArray(state.q.chunks) && state.q.chunks.length ? state.q.chunks : null;
    const displayRomaji = chunks ? chunks.join(' ') : state.q.romaji;

    // 判定用：空白や記号は無視（従来どおり）
    state.target = displayRomaji.toLowerCase().replace(IGNORE_RE, '');

    // ローマ字行を描画（chunksがあれば“見た目スペース”つき）
    buildRomajiLine(chunks ?? displayRomaji);

    jpSentence.textContent = state.q.jp;

    // タイマー開始（従来どおり）
    state.startedAt = performance.now();
    state.timerId = setInterval(() => {
      const sec = (performance.now() - state.startedAt) / 1000;
      timerEl.textContent = sec.toFixed(1);
    }, 100);

    overlay.setAttribute('hidden', 'true');
    state.phase = 'playing';
  }

  function buildRomajiLine(input) {
    romajiLine.textContent = '';

    // input が chunks の配列ならそれを使う。文字列なら従来処理
    if (Array.isArray(input)) {
      for (const chunk of input) {
        for (let i = 0; i < chunk.length; i++) {
          const span = document.createElement('span');
          span.textContent = chunk[i];
          // かたまりの最後の文字に “word break” 用の余白クラス
          if (i === chunk.length - 1) span.classList.add('wb');
          romajiLine.appendChild(span);
        }
      }
    } else {
      const s = input.replace(IGNORE_RE, '');
      for (let i = 0; i < s.length; i++) {
        const span = document.createElement('span');
        span.textContent = s[i];
        romajiLine.appendChild(span);
      }
    }
  }

  // ==== 入力 ====
  document.addEventListener('DOMContentLoaded', () => {
    // 要素
    screens = {
      home: document.getElementById('screen-home'),
      game: document.getElementById('screen-game'),
      result: document.getElementById('screen-result'),
    };
    overlay = document.getElementById('start-overlay');
    timerEl = document.getElementById('timer');
    romajiLine = document.getElementById('romaji-line');
    jpSentence = document.getElementById('jp-sentence');
    feedback = document.getElementById('feedback');
    resultAccuracyEl = document.getElementById('result-accuracy');
    resultTimeEl = document.getElementById('result-time');
    resultGradeEl = document.getElementById('yakiimo-grade');
    bestAccEl = document.getElementById('best-accuracy');
    bestTimeEl = document.getElementById('best-time');

    // クリックで画面遷移
    document.addEventListener('click', (ev) => {
      const el = ev.target instanceof Element ? ev.target : null;
      if (!el) return;
      const a = el.closest('[data-action]');
      if (!a) return;
      const action = a.getAttribute('data-action');
      switch (action) {
        case 'goto-game': showScreen('game'); break;
        case 'back-home': showScreen('home'); break;
        case 'retry': showScreen('game'); break;
      }
    });

    // キー入力
    document.addEventListener('keydown', onKeyDown);

    // 初期表示
    showScreen('home');
    renderBest();
  });

  function onKeyDown(ev) {
    // スペースで開始（readyのみ）
    if (ev.code === 'Space') {
      ev.preventDefault(); // ページスクロール防止
      if (state.phase === 'ready') startGame();
      return;
    }
    if (state.phase !== 'playing') return;

    const key = ev.key.length === 1 ? ev.key.toLowerCase() : '';
    if (!/[a-z]/.test(key)) return;

    state.totalKeys++;

    // 促音の進行中（xtu/ltu）を先に処理
    if (handleSokuonProgress(key)) return;

    if (state.pointer >= state.target.length) return;
    const expected = state.target[state.pointer];

    // 通常一致
    if (key === expected) {
      accept(1, key);
      return;
    }

    // ---- 柔軟一致ルール ----

    // 1) 'shi' ←→ 'si'
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const next2 = state.target.slice(state.pointer, state.pointer + 2);
      if (prev === 's' && next2 === 'hi' && key === 'i') {
        accept(2, key); // 'hi' をまとめて消化
        return;
      }
    }

    // 2) 'tsu' ←→ 'tu'
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const next2 = state.target.slice(state.pointer, state.pointer + 2);
      if (prev === 't' && next2 === 'su' && key === 'u') {
        accept(2, key); // 'su' をまとめて消化
        return;
      }
    }

    // 3) 'nn' ←→ 'n'
    if (state.target.slice(state.pointer, state.pointer + 2) === 'nn' && key === 'n') {
      accept(2, key); // 'nn' を1打で許容
      return;
    }

    // 4) 「しゃ/しゅ/しょ」系: 'sha','shu','sho','she' ←→ 'sya','syu','syo','sye'
    //    基準表記が 's' + 'h' + VOWEL のとき、'y' を押したら 'h' を置換的に許容
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const cur = state.target[state.pointer];
      const nxt = state.target[state.pointer + 1];
      if (prev === 's' && cur === 'h' && VOWELS.has(nxt) && key === 'y') {
        // 'y' を受理（ 'h' を消化扱い ）
        accept(1, key); // 'h' を1文字分進める → 次は母音（a/u/o/e/i）
        return;
      }
    }

    // 5) 促音「っ」: 子音重ね（基準表記がダブル子音）のとき、'x' or 'l' から始まる 'xtu/ltu' を許容
    //    まず開始判定: pointer がダブル子音先頭なら 'x'/'l' で促音開始
    if (maybeStartSokuon(key)) return;

    // 不一致
    showMiss();
  }

  // ==== 促音（xtu/ltu）の処理 ====
  // - ダブル子音の先頭にいる時だけ有効
  // - 入力 'x' or 'l' -> stage=1, 't' -> stage=2, 'u' -> accept(1)
  function isDoubleConsonantPtr(ptr) {
    const a = state.target[ptr], b = state.target[ptr + 1];
    return !!a && a === b && isConsonant(a);
  }

  function maybeStartSokuon(key) {
    if (state.sokuonStage !== 0) return false; // 既に進行中
    if (!isDoubleConsonantPtr(state.pointer)) return false;
    if (key === 'x' || key === 'l') {
      state.sokuonStage = 1;
      state.sokuonPtr = state.pointer;
      markNeutralHit();   // 見た目のヒット演出
      state.correctKeys++; // 正打としてカウント（前進はまだしない）
      return true;
    }
    return false;
  }

  function handleSokuonProgress(key) {
    if (state.sokuonStage === 0) return false;
    // 途中で pointer が進んだ／位置が変わったらリセット
    if (state.sokuonPtr !== state.pointer || !isDoubleConsonantPtr(state.pointer)) {
      state.sokuonStage = 0; state.sokuonPtr = -1;
      return false;
    }
    if (state.sokuonStage === 1) {
      if (key === 't') {
        state.sokuonStage = 2;
        state.correctKeys++;
        markNeutralHit();
        return true;
      } else {
        // 期待通りでない → 失敗としてステート破棄
        state.sokuonStage = 0; state.sokuonPtr = -1;
        showMiss();
        return true;
      }
    }
    if (state.sokuonStage === 2) {
      if (key === 'u') {
        state.correctKeys++;
        markNeutralHit();
        // ここで「ダブル子音の1文字分を消化」
        accept(1, key);
        state.sokuonStage = 0; state.sokuonPtr = -1;
        return true;
      } else {
        state.sokuonStage = 0; state.sokuonPtr = -1;
        showMiss();
        return true;
      }
    }
    return false;
  }

  // ==== 共通表示 ====
  function accept(advance, lastKey) {
    state.correctKeys++;
    const start = state.pointer;
    state.pointer += advance;
    state.lastAcceptedChar = lastKey;

    paintOkUntil(state.pointer);

    if (state.pointer >= state.target.length) {
      finishGame();
    } else {
      showHit();
    }
  }

  function paintOkUntil(pointer) {
    const spans = romajiLine.children;
    for (let i = 0; i < spans.length; i++) {
      spans[i].classList.toggle('ok', i < pointer);
      if (i >= pointer) spans[i].classList.remove('ng');
    }
  }

  function showMiss() {
    const spans = romajiLine.children;
    const i = Math.min(state.pointer, spans.length - 1);
    if (spans[i]) spans[i].classList.add('ng');
    if (feedback) { feedback.textContent = '💧 水がかかった...'; feedback.className = 'feedback error'; }
  }
  function showHit() {
    if (feedback) { feedback.textContent = '🔥 火が強くなった！'; feedback.className = 'feedback success'; }
  }
  function markNeutralHit() { // 促音途中のポジティブ演出
    if (feedback) { feedback.textContent = '🔥 火が強くなった！'; feedback.className = 'feedback success'; }
  }

  // ==== 終了・結果 ====
  function finishGame() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    const elapsed = ((performance.now() - state.startedAt) / 1000);
    const timeSec = Number(elapsed.toFixed(1));
    const accuracy = state.totalKeys > 0 ? Math.round((state.correctKeys / state.totalKeys) * 100) : 0;

    setResult(accuracy, timeSec);
    maybeSaveBest(accuracy, timeSec);
    showScreen('result');
  }

  function setResult(accuracy, timeSec) {
    resultAccuracyEl && (resultAccuracyEl.textContent = `${accuracy}%`);
    resultTimeEl && (resultTimeEl.textContent = `${timeSec.toFixed(1)}秒`);
    resultGradeEl && (resultGradeEl.textContent = gradeText(accuracy));
  }

  function gradeText(acc) {
    if (acc === 100) return '完璧な焼き芋';
    if (acc >= 90) return '美味しそうな焼き芋';
    if (acc >= 80) return '少し焦げ気味';
    return 'まだ生っぽい'; // <80% は包含（あなたの合意どおり）
  }

  // ==== ベストスコア ====
  function loadBest() {
    try {
      const raw = localStorage.getItem('bestScore');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return (typeof obj?.accuracy === 'number' && typeof obj?.timeSec === 'number') ? obj : null;
    } catch (_) { return null; }
  }
  function renderBest() {
    const best = loadBest();
    if (!bestAccEl || !bestTimeEl) return;
    if (best) {
      bestAccEl.textContent = `${best.accuracy}%`;
      bestTimeEl.textContent = `${best.timeSec.toFixed(1)}秒`;
    } else {
      bestAccEl.textContent = `--%`;
      bestTimeEl.textContent = `--秒`;
    }
  }
  function maybeSaveBest(accuracy, timeSec) {
    const prev = loadBest();
    let should = false;
    if (!prev) should = true;
    else if (accuracy > prev.accuracy) should = true;
    else if (accuracy === prev.accuracy && timeSec < prev.timeSec) should = true;

    if (should) {
      localStorage.setItem('bestScore', JSON.stringify({ accuracy, timeSec, at: new Date().toISOString() }));
    }
    renderBest();
  }
})();
