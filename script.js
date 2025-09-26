// タイピングの秋 - MVP Step 3
// 追加: 「しゃ/しゅ/しょ」= sha/sya 系許容, 促音「っ」= xtu/ltu or 子音重ね
(() => {
  'use strict';

  // ==== データ ====
  const QUESTIONS = [
    { id: 1, jp: '芋', romaji: 'imo', chunks: ['imo'] },
  ];

  // 記号・空白は無視
  const IGNORE_RE = /[\s。、，（）()「」『』…—\-!！?？:：;；・．｡､]/g;
  const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
  const isConsonant = (ch) => /^[a-z]$/.test(ch) && !VOWELS.has(ch);

  // ltu/xtu 起点判定（未定義なら追加）
  function isLtuStart(ptr) { return state.target.slice(ptr, ptr + 3) === 'ltu'; }
  function isXtuStart(ptr) { return state.target.slice(ptr, ptr + 3) === 'xtu'; }

  // 段階系の安全リセット
  function resetStage(name) {
    state[name + 'Stage'] = 0;
    state[name + 'Ptr'] = -1;
  }

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
    questionIndex: 0,  // 0..9 を順番に出す

    // 促音（xtu/ltu）入力の進捗: 0=未開始, 1= 'x'/'l' 入力済, 2='t'まで入力済
    sokuonStage: 0,
    sokuonPtr: -1, // 促音を当て込んでいる pointer 位置（ダブル子音の先頭に限定）

    ti2chiStage: 0, ti2chiPtr: -1,   // target: 'ti' を 'c' 'h' 'i' で入力する時の段階管理
    chi2tiStage: 0, chi2tiPtr: -1,   // target: 'chi' を 't' 'i' で入力する時の段階管理
    di2jiStage: 0, di2jiPtr: -1,   // target: 'di' を 'j' 'i' で入力
    ji2diStage: 0, ji2diPtr: -1,   // target: 'ji' を 'd' 'i' で入力
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
    // オーバーレイ表示（スペースで開始に戻す）
    if (overlay) {
      overlay.hidden = false;
      const sub = overlay.querySelector('.start-overlay__sub'); // ★ 追加
      if (sub) sub.style.display = 'none';                       // ★ 非表示に
    }

    // タイマー停止（動いていたら念のため止める）
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }

    // UIリセット
    if (timerEl) timerEl.textContent = '0.0';
    if (romajiLine) romajiLine.textContent = '';
    if (jpSentence) jpSentence.textContent = '';
    if (feedback) { feedback.textContent = ''; feedback.className = 'feedback'; }

    // ゲーム状態リセット
    state.q = null;
    state.target = '';
    state.pointer = 0;
    state.startedAt = 0;
    state.totalKeys = 0;
    state.correctKeys = 0;
    state.questionIndex = 0;
    state.lastAcceptedChar = '';

    // 促音系
    state.sokuonStage = 0;
    state.sokuonPtr = -1;

    // 段階管理（ti/di⇄chi/ji）
    state.ti2chiStage = 0; state.ti2chiPtr = -1;
    state.chi2tiStage = 0; state.chi2tiPtr = -1;
    state.di2jiStage = 0; state.di2jiPtr = -1;
    state.ji2diStage = 0; state.ji2diPtr = -1;
  }

  function loadQuestionByIndex(idx) {
  // 範囲外なら終了
  if (idx >= QUESTIONS.length) { finishGame(); return; }

  state.q = QUESTIONS[idx];

  // 表示用
  const chunks = Array.isArray(state.q.chunks) && state.q.chunks.length ? state.q.chunks : null;
  const displayRomaji = chunks ? chunks.join(' ') : state.q.romaji;

  // 判定用（空白・記号無視）
  state.target  = displayRomaji.toLowerCase().replace(IGNORE_RE, '');
  state.pointer = 0;

  // UI 更新
  buildRomajiLine(chunks ?? displayRomaji);
  jpSentence.textContent = state.q.jp;
  feedback.textContent = '';
  feedback.className = 'feedback';
}

  // ==== 開始 ====
  function startGame() {
    // タイマー（セッション全体）開始
    state.startedAt = performance.now();
    state.timerId = setInterval(() => {
      const sec = (performance.now() - state.startedAt) / 1000;
      timerEl.textContent = sec.toFixed(1);
    }, 100);

    overlay.hidden = true;
    state.phase = 'playing';

    state.questionIndex = 0;           // ★ 1問目
    loadQuestionByIndex(state.questionIndex);
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

    // ①-1: メインの「焼き上がり時間」行を隠す
    const bestTimeRow = bestTimeEl?.closest('.bestscore__row');
    if (bestTimeRow) bestTimeRow.hidden = true; // [hidden]{display:none !important;} が効きます

    // ①-2: 結果画面の時間ラベルを「焼き上がりにかかった時間」に変更
    const timeRow = resultTimeEl?.closest('.result-row');
    const timeLbl = timeRow?.querySelector('.result-label');
    if (timeLbl) timeLbl.textContent = '焼き上がりにかかった時間';
  });
  
  function abortToReady() {
    // 中断: 保存はしない（finishGame を呼ばない）
    resetGameView();   // 画面とカウンタを初期化（オーバーレイ再表示）
    state.phase = 'ready';
  }

  function onKeyDown(ev) {
    // スペースで開始（readyのみ）
    if (ev.code === 'Space') {
      ev.preventDefault(); // ページスクロール防止
      if (state.phase === 'ready') startGame();
      return;
    }
    
    // Esc：ready中はホームへ、playing中は中断してreadyへ
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (state.phase === 'ready') {
        showScreen('home');         // ← メイン画面へ戻す
      } else if (state.phase === 'playing') {
        abortToReady();             // ← 既に追加済みの中断関数
      }
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

    // ===== Romaji Flex: Extra Pack (①wo/o ②ti/di⇄chi/ji ③fu⇄hu & j(a/u/o)⇄jy(a/u/o)) =====

    // ① 「を」= 'wo' / 'o' 相互許容（targetが 'wo' のとき 'o' 1打で消化）
    if (state.target.slice(state.pointer, state.pointer + 2) === 'wo' && key === 'o') {
      accept(2, key);  // 'w' 'o' をまとめて消化
      return;
    }

    // ③-1 'fu' ⇄ 'hu'（h/f の挿入・相互）
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const cur = state.target[state.pointer];
      // target: f u / 入力: h (中継キー)
      if (prev === 'f' && cur === 'u' && key === 'h') {
        state.correctKeys++; markNeutralHit(); return;
      }
      // target: h u / 入力: f (中継キー)
      if (prev === 'h' && cur === 'u' && key === 'f') {
        state.correctKeys++; markNeutralHit(); return;
      }
    }

    // ③-2 'ja/ju/jo' ⇄ 'jya/jyu/jyo'（y 省略/挿入）＋ 'zya/zyu/zyo' も同様に許容
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const cur = state.target[state.pointer];
      const nxt = state.target[state.pointer + 1];
      // target: j y (a/u/o) → 入力: j + (a/u/o) で 'y' をスキップ
      if (prev === 'j' && cur === 'y' && (nxt === 'a' || nxt === 'u' || nxt === 'o') && key === nxt) {
        accept(2, key); return;
      }
      // target: z y (a/u/o) → 入力: z + (a/u/o) で 'y' をスキップ
      if (prev === 'z' && cur === 'y' && (nxt === 'a' || nxt === 'u' || nxt === 'o') && key === nxt) {
        accept(2, key); return;
      }
      // 逆方向：target: j(a/u/o) のとき、入力 'y' を中継キーとして許容（次の母音で前進）
      if (prev === 'j' && (cur === 'a' || cur === 'u' || cur === 'o') && key === 'y') {
        state.correctKeys++; markNeutralHit(); return;
      }
      // 逆方向：target: z(a/u/o) のときも同様に 'y' を中継で許容
      if (prev === 'z' && (cur === 'a' || cur === 'u' || cur === 'o') && key === 'y') {
        state.correctKeys++; markNeutralHit(); return;
      }
    }

    // ②-1 'ti' ⇄ 'chi'
    // --- target: 'ti' を 'c' 'h' 'i' で入力する（段階管理）
    if (state.target.slice(state.pointer, state.pointer + 2) === 'ti') {
      // 開始：'c'
      if (state.ti2chiStage === 0 && key === 'c') {
        state.ti2chiStage = 1; state.ti2chiPtr = state.pointer;
        state.correctKeys++; markNeutralHit(); return;
      }
      // 継続：'h'
      if (state.ti2chiStage === 1 && state.ti2chiPtr === state.pointer && key === 'h') {
        state.ti2chiStage = 2; state.correctKeys++; markNeutralHit(); return;
      }
      // 完了：'i' → 'ti' をまとめて消化
      if (state.ti2chiStage === 2 && state.ti2chiPtr === state.pointer && key === 'i') {
        accept(2, key); resetStage('ti2chi'); return;
      }
      // 想定外入力/位置ズレ
      if (state.ti2chiStage && state.ti2chiPtr !== state.pointer) resetStage('ti2chi');
    }
    // --- target: 'chi' を 't' 'i' で入力する
    if (state.target.slice(state.pointer, state.pointer + 3) === 'chi') {
      // 開始：'t'
      if (state.chi2tiStage === 0 && key === 't') {
        state.chi2tiStage = 1; state.chi2tiPtr = state.pointer;
        state.correctKeys++; markNeutralHit(); return;
      }
      // 完了：'i' → 'chi' をまとめて消化
      if (state.chi2tiStage === 1 && state.chi2tiPtr === state.pointer && key === 'i') {
        accept(3, key); resetStage('chi2ti'); return;
      }
      if (state.chi2tiStage && state.chi2tiPtr !== state.pointer) resetStage('chi2ti');
    }

    // ②-2 'di' ⇄ 'ji'
    // --- target: 'di' を 'j' 'i' で入力
    if (state.target.slice(state.pointer, state.pointer + 2) === 'di') {
      if (state.di2jiStage === 0 && key === 'j') {
        state.di2jiStage = 1; state.di2jiPtr = state.pointer;
        state.correctKeys++; markNeutralHit(); return;
      }
      if (state.di2jiStage === 1 && state.di2jiPtr === state.pointer && key === 'i') {
        accept(2, key); resetStage('di2ji'); return;
      }
      if (state.di2jiStage && state.di2jiPtr !== state.pointer) resetStage('di2ji');
    }
    // --- target: 'ji' を 'd' 'i' で入力
    if (state.target.slice(state.pointer, state.pointer + 2) === 'ji') {
      if (state.ji2diStage === 0 && key === 'd') {
        state.ji2diStage = 1; state.ji2diPtr = state.pointer;
        state.correctKeys++; markNeutralHit(); return;
      }
      if (state.ji2diStage === 1 && state.ji2diPtr === state.pointer && key === 'i') {
        accept(2, key); resetStage('ji2di'); return;
      }
      if (state.ji2diStage && state.ji2diPtr !== state.pointer) resetStage('ji2di');
    }

    // ③-3 ltu/xtu の“相互許容”（1文字目 l/x の置換受理）
    if (isLtuStart(state.pointer) && key === 'x') { accept(1, key); return; }
    if (isXtuStart(state.pointer) && key === 'l') { accept(1, key); return; }

    // A) target が 'si' のとき、キー 'h' を中継キーとして許容（= 'shi' 入力途中）
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const cur = state.target[state.pointer];
      if (prev === 's' && cur === 'i' && key === 'h') {
        state.correctKeys++;   // 正答扱い（正答率が下がらないように）
        markNeutralHit();      // 演出だけ
        return;                // pointer は進めない（次の 'i' で前進）
      }
    }

    // B) target が 'tu' のとき、キー 's' を中継キーとして許容（= 'tsu' 入力途中）
    if (state.pointer >= 1) {
      const prev = state.target[state.pointer - 1];
      const cur = state.target[state.pointer];
      if (prev === 't' && cur === 'u' && key === 's') {
        state.correctKeys++;
        markNeutralHit();
        return;
      }
    }

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
        markNeutralHit();
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
      state.questionIndex++;
      if (state.questionIndex < QUESTIONS.length) {
        loadQuestionByIndex(state.questionIndex); // 次の問題へ
      } else {
        finishGame(); // 全問終了
      }
    } else {
      showHit();
    }
  }

  function paintOkUntil(pointer) {
    const spans = romajiLine.children;
    for (let i = 0; i < spans.length; i++) {
      const inOk = i < pointer;
      spans[i].classList.toggle('ok', inOk);   // 正解領域=灰
      if (inOk) spans[i].classList.remove('ng'); // ★ 正解になったら赤を必ず解除
      else spans[i].classList.remove('ok');      // 未到達は初期（=黒）のまま
      // ※ 未到達の 'ng'（現在位置の赤）は残す → 次の正解で上の if が外してくれる
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
    return 'まだ生っぽい';
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
    if (!bestAccEl) return;
    if (best) {
      bestAccEl.textContent = `${best.accuracy}%`;
    } else {
      bestAccEl.textContent = `--%`;
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
