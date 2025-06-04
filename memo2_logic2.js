// ================= 初期化とパスワード認証 =================
let questions = JSON.parse(localStorage.getItem('questions') || '[]');
let fillQuestions = JSON.parse(localStorage.getItem('fillQuestions') || '[]');

questions.forEach(q => {
  q.score = q.score ?? 0;
  q.category = q.category ?? '';
  q.answerCount = q.answerCount ?? 0;
  q.correctCount = q.correctCount ?? 0;
  q.origin = q.origin ?? true;
});

fillQuestions.forEach(q => {
  q.score = q.score ?? 0;
  q.answerCount = q.answerCount ?? 0;
  q.correctCount = q.correctCount ?? 0;
});

const password = prompt("パスワードを入力してください：");
if (password !== "2410") {
  document.body.innerHTML = '<h2>アクセスが拒否されました。</h2>';
  throw new Error("パスワード不正");
}

let currentQueue = [];
let currentIndex = 0;
let showAnswerToggle = false;
let isFillAnswered = false;


// ================= ユーティリティ =================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ================= タブ切り替え =================
function switchTab(index) {
  document.querySelectorAll('.tab').forEach((tab, i) => tab.classList.toggle('active', i === index));
  document.querySelectorAll('.content').forEach((content, i) => content.classList.toggle('active', i === index));
  if (index === 2) {
    renderList();
    setTimeout(renderFillList, 0);
    switchConfirmTab('normal');
  }
  if (index === 0) updateCategoryOptions();
  if (index === 3) renderChart();
}

function switchConfirmTab(mode) {
  const tabs = document.querySelectorAll('.sub-tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  if (mode === 'normal') {
    document.getElementById('normalListSection').style.display = 'block';
    document.getElementById('fillListSection').style.display = 'none';
    tabs[0].classList.add('active');
  } else {
    document.getElementById('normalListSection').style.display = 'none';
    document.getElementById('fillListSection').style.display = 'block';
    tabs[1].classList.add('active');
  }
}

// ================= カテゴリ選択肢の更新 =================
function updateCategoryOptions() {
  const select = document.getElementById('categorySelect');
  if (!select) return;
  const categories = [...new Set(questions.filter(q => q.origin).map(q => q.category || '未分類'))];
  select.innerHTML = '<option value="">すべてのカテゴリ</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

// ================= 音声入力機能 =================
function startSpeechRecognition(targetId) {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'ja-JP';
  recognition.onresult = function(event) {
    const text = event.results[0][0].transcript;
    document.getElementById(targetId).value += text;
  };
  recognition.start();
}

// ================= 通常問題：保存 =================
function saveQuestion() {
  const q = document.getElementById('newQuestion').value.trim();
  const a = document.getElementById('newAnswer').value.trim();
  const c = document.getElementById('newCategory').value.trim();
  if (q && a) {
    questions.push({ question: q, answer: a, category: c, queue: 0, origin: true, score: 0, answerCount: 0, correctCount: 0 });
    localStorage.setItem('questions', JSON.stringify(questions));
    document.getElementById('newQuestion').value = '';
    document.getElementById('newAnswer').value = '';
    document.getElementById('newCategory').value = '';
  }
}

// ================= 通常問題：出題ロジック =================
function startExercise() {
  const weighted = [];
  questions.forEach((q, i) => {
    if (!q.origin) return;
    const weight = Math.max(1, 10 - q.score);
    for (let j = 0; j < weight; j++) weighted.push({ ...q, index: i });
  });
  shuffle(weighted);
  currentQueue = weighted;
  currentIndex = 0;
  nextQuestion();
}

function startLowScoreExercise() {
  const lowScore = questions.map((q, i) => ({ ...q, index: i })).filter(q => q.origin && q.score <= -3);
  if (lowScore.length === 0) return alert('スコア-3以下の問題がありません');
  const weighted = [];
  lowScore.forEach(q => {
    const weight = Math.max(1, 10 - q.score);
    for (let j = 0; j < weight; j++) weighted.push(q);
  });
  shuffle(weighted);
  currentQueue = weighted;
  currentIndex = 0;
  nextQuestion();
}

function startExerciseByCategory() {
  const selected = document.getElementById('categorySelect').value;
  const filtered = questions.map((q, i) => ({ ...q, index: i })).filter(q => q.origin && (!selected || (q.category || '未分類') === selected));
  if (filtered.length === 0) return alert('該当カテゴリに問題がありません');
  const weighted = [];
  filtered.forEach(q => {
    const weight = Math.max(1, 10 - q.score);
    for (let j = 0; j < weight; j++) weighted.push(q);
  });
  shuffle(weighted);
  currentQueue = weighted;
  currentIndex = 0;
  nextQuestion();
}

function nextQuestion() {
  if (currentIndex >= currentQueue.length) {
    alert('全問終了');
    return;
  }
  const q = currentQueue[currentIndex];
  document.getElementById('exerciseQuestion').innerHTML =
    `Q${q.index + 1}: <span id="questionText">${q.question}</span> <span class="edit-icon" onclick="editField('questionText', ${q.index}, 'question')">✏️</span>`;
  document.getElementById('exerciseAnswer').value = '';
  document.getElementById('correctAnswer').innerHTML =
    `<span id="answerText"></span> <span class="edit-icon" onclick="editField('answerText', ${q.index}, 'answer')">✏️</span>`;
  showAnswerToggle = false;
}

function gradeAnswer(grade) {
  const q = currentQueue[currentIndex];
  const delta = grade === 'maru' ? 1 : grade === 'sankaku' ? -0.5 : -1;
  questions[q.index].score += delta;
  questions[q.index].answerCount++;
  if (grade === 'maru') questions[q.index].correctCount++;
  localStorage.setItem('questions', JSON.stringify(questions));
  currentIndex++;
  nextQuestion();
}

// ================= Enterキーで解答表示切替 =================
function checkEnter(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    showAnswerToggle = !showAnswerToggle;
    const answerDisplay = document.getElementById('answerText');
    answerDisplay.textContent = showAnswerToggle ? '正解: ' + currentQueue[currentIndex].answer : '';
  }
}

// ================= 穴埋め問題：保存 =================
function saveFillQuestion() {
  const html = document.getElementById('newFillQuestion').innerHTML.trim();
  if (!html) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const spans = doc.querySelectorAll('span[style*="rgb(221, 0, 0)"]');
  const answers = Array.from(spans).map(span => span.textContent.trim());
  fillQuestions.push({ html, answers });
  localStorage.setItem('fillQuestions', JSON.stringify(fillQuestions));
  document.getElementById('newFillQuestion').innerHTML = '';
}

// ================= 穴埋め問題：出題 =================
function startFillExercise() {
  if (fillQuestions.length === 0) return alert('穴埋め問題がありません');
  const weighted = [];
  fillQuestions.forEach((q, i) => {
    const weight = Math.max(1, 10 - (q.score ?? 0));
    for (let j = 0; j < weight; j++) weighted.push({ ...q, index: i });
  });
  shuffle(weighted);
  currentQueue = weighted;
  currentIndex = 0;
  showFillQuestion();
}

function showFillQuestion() {
  const q = currentQueue[currentIndex];
  const parser = new DOMParser();
  const doc = parser.parseFromString(q.html, 'text/html');
  const spans = doc.querySelectorAll('span[style*="rgb(221, 0, 0)"]');
  const inputArea = document.getElementById('fillInputs');
  inputArea.innerHTML = '';
  isFillAnswered = false;

  spans.forEach((span, i) => {
    span.textContent = '____';
    const input = document.createElement('input');
    input.className = 'input-blank';
    input.dataset.index = i;

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const inputs = inputArea.querySelectorAll('input');
        const currentInputIndex = [...inputs].indexOf(input);

        if (!isFillAnswered) {
          const next = inputs[currentInputIndex + 1];
          if (next) {
            next.focus();
          } else {
            checkFillAnswer(); // 判定だけ
          }
        } else {
          currentIndex++;
          if (currentIndex < currentQueue.length) {
            showFillQuestion();
          } else {
            alert('全問終了');
          }
        }
      }
    });

    inputArea.appendChild(input);
  });

  document.getElementById('fillQuestionDisplay').innerHTML = `<strong>Q${q.index + 1}:</strong> ` + doc.body.innerHTML;
  document.getElementById('fillResult').textContent = '';

  // 🔽追加：最初の入力欄に自動フォーカス
  const firstInput = inputArea.querySelector('input');
  if (firstInput) firstInput.focus();
}
function checkFillAnswer() {
  const inputs = document.querySelectorAll('#fillInputs input');
  const userAnswers = Array.from(inputs).map(input => input.value.trim());
  const correctAnswers = currentQueue[currentIndex].answers;
  let allCorrect = true;
  const feedback = [];

  for (let i = 0; i < correctAnswers.length; i++) {
    if (userAnswers[i] !== correctAnswers[i]) {
      allCorrect = false;
      inputs[i].style.color = 'red'; // ✳️ 不正解を赤色に
    } else {
      inputs[i].style.color = 'black'; // ✳️ 正解は黒に戻す（前の状態をリセット）
    }
    feedback.push(`(${userAnswers[i]} / ${correctAnswers[i]})`);
  }

  const resultText = allCorrect ? '正解！' : `不正解: ${feedback.join(' , ')}`;
  document.getElementById('fillResult').textContent = resultText;

  const index = currentQueue[currentIndex].index;
  fillQuestions[index].answerCount = (fillQuestions[index].answerCount ?? 0) + 1;
  if (allCorrect) fillQuestions[index].correctCount = (fillQuestions[index].correctCount ?? 0) + 1;
  fillQuestions[index].score = (fillQuestions[index].score ?? 0) + (allCorrect ? 1 : -1);

  localStorage.setItem('fillQuestions', JSON.stringify(fillQuestions));
  isFillAnswered = true;
}

// ================= 通常問題：編集・削除 =================
function editQuestion(index, field, value) {
  questions[index][field] = value;
  localStorage.setItem('questions', JSON.stringify(questions));
}

function deleteQuestion(index) {
  if (confirm('この問題を削除しますか？')) {
    questions.splice(index, 1);
    localStorage.setItem('questions', JSON.stringify(questions));
    renderList();
  }
}

function renderList() {
  const list = document.getElementById('questionList');
  list.innerHTML = '';
  const grouped = {};
  questions.forEach((qa, i) => {
    if (!qa.origin) return;
    const cat = qa.category || '未分類';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...qa, index: i });
  });
  let count = 1;
  Object.keys(grouped).forEach(cat => {
    const groupTitle = document.createElement('h3');
    groupTitle.textContent = `カテゴリ: ${cat}`;
    list.appendChild(groupTitle);
    grouped[cat].forEach(qa => {
      const scoreClass = qa.score <= -3 ? 'red' : (qa.score >= 3 ? 'green' : '');
      const rate = (qa.answerCount > 0) ? ((qa.correctCount / qa.answerCount) * 100).toFixed(1) : '0.0';
      const li = document.createElement('li');
      li.innerHTML = `Q${count++}: <input value="${qa.question}" onchange="editQuestion(${qa.index}, 'question', this.value)">
        ／ A: <input value="${qa.answer}" onchange="editQuestion(${qa.index}, 'answer', this.value)">
        ／ カテゴリ: <input value="${qa.category}" onchange="editQuestion(${qa.index}, 'category', this.value)">
        <span class="score ${scoreClass}">（${qa.score}）</span>
        回答数: ${qa.answerCount} ／ 正答率: ${rate}%
        <button onclick="deleteQuestion(${qa.index})">🗑削除</button>`;
      list.appendChild(li);
    });
  });
}


// ================= 穴埋め問題：編集・削除 =================
function renderFillList() {
  const list = document.getElementById('fillQuestionList');
  list.innerHTML = '';
  fillQuestions.forEach((q, i) => {
    const scoreClass = q.score <= -3 ? 'red' : (q.score >= 3 ? 'green' : '');
    const rate = (q.answerCount > 0)
      ? ((q.correctCount / q.answerCount) * 100).toFixed(1)
      : '0.0';
    const li = document.createElement('li');
    li.innerHTML = `問題${i + 1}: ${q.html}<br>答え: ${q.answers.join(', ')} 
      <span class="score ${scoreClass}">（${q.score}）</span> 
      回答数: ${q.answerCount} ／ 正答率: ${rate}% 
      <button onclick="deleteFillQuestion(${i})">🗑削除</button>`;
    list.appendChild(li);
  });
}

// ================= データ保存・エクスポート =================
function downloadQuestions() {
  const original = questions.filter(q => q.origin);
  const blob = new Blob([JSON.stringify(original, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ================= データインポート =================
function uploadQuestions() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) return alert('ファイルを選択してください');
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error();
      questions = data.map(q => ({
        ...q,
        origin: true,
        score: q.score ?? 0,
        category: q.category ?? '',
        answerCount: q.answerCount ?? 0,
        correctCount: q.correctCount ?? 0
      }));
      localStorage.setItem('questions', JSON.stringify(questions));
      alert('インポート完了');
      renderList();
    } catch {
      alert('不正なデータです');
    }
  };
  reader.readAsText(file);
}


// ================= グラフ描画（Chart.js） =================
function renderChart() {
  const categoryStats = {};
  questions.forEach(q => {
    if (!q.origin) return;
    const cat = q.category || '未分類';
    if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 };
    const s = q.score ?? 0;
    const absS = Math.abs(s);
    if (absS > 0) {
      categoryStats[cat].total += absS;
      if (s > 0) categoryStats[cat].correct += s;
    }
  });
  const labels = Object.keys(categoryStats);
  const data = labels.map(cat => {
    const { correct, total } = categoryStats[cat];
    const rate = total === 0 ? 0 : correct / total;
    return parseFloat((rate * 100).toFixed(2));
  });

  const ctx = document.getElementById('scoreChart').getContext('2d');
  if (window.scoreChartInstance) window.scoreChartInstance.destroy();
  window.scoreChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: '正答率（％）', data: data }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: value => value + '%' }
        }
      }
    }
  });
}
function downloadAllData() {
  const exportData = {
    questions: questions.filter(q => q.origin),
    fillQuestions: fillQuestions
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memo2_all_data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function uploadAllData() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) return alert('ファイルを選択してください');
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.questions) || !Array.isArray(data.fillQuestions)) throw new Error();

      // 通常問題を整形
      questions = data.questions.map(q => ({
        ...q,
        origin: true,
        score: q.score ?? 0,
        category: q.category ?? '',
        answerCount: q.answerCount ?? 0,
        correctCount: q.correctCount ?? 0
      }));

      // 穴埋め問題をそのまま格納
      fillQuestions = data.fillQuestions;

      // 保存＆画面更新
      localStorage.setItem('questions', JSON.stringify(questions));
      localStorage.setItem('fillQuestions', JSON.stringify(fillQuestions));

      alert('インポート完了');
      renderList();
      renderFillList();
    } catch {
      alert('不正なデータです');
    }
  };
  reader.readAsText(file);
}
