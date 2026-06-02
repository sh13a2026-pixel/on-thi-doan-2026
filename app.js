// State Variables
let currentMode = 'menu'; // 'menu', 'practice', 'random', 'mock_test', 'view_answers'
let activeQuestions = []; // questions for the current mode
let currentQuestionIndex = 0;
let userAnswers = {}; // map of { questionId: selectedOptionLetter }
let mockTestTimer = null;
let mockTimeRemaining = 30 * 60; // 30 minutes in seconds

// LocalStorage Keys
const KEYS = {
  correctAnswersCount: 'doan_correct_cnt',
  doneAnswersCount: 'doan_done_cnt',
  streakCount: 'doan_streak_cnt',
  lastStudyDate: 'doan_last_study_date',
  savedAnswers: 'doan_saved_user_answers'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initStreak();
  updateProgressStats();
  initPWAInstall();
  initSearch();
});

// Streak logic
function initStreak() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(KEYS.lastStudyDate);
  let streak = parseInt(localStorage.getItem(KEYS.streakCount)) || 0;

  if (lastDate) {
    const last = new Date(lastDate);
    const timeDiff = new Date(today) - last;
    const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Studied consecutive day
      streak += 1;
    } else if (diffDays > 1) {
      // Missed a day
      streak = 1;
    }
  } else {
    // First time
    streak = 1;
  }

  localStorage.setItem(KEYS.streakCount, streak);
  localStorage.setItem(KEYS.lastStudyDate, today);
  document.getElementById('streakCount').innerText = streak;
}

// Progress and Statistics Updates
function updateProgressStats() {
  const total = allQuestions.length; // 95
  const done = parseInt(localStorage.getItem(KEYS.doneAnswersCount)) || 0;
  const correct = parseInt(localStorage.getItem(KEYS.correctAnswersCount)) || 0;
  
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 0;

  // Update UI Elements
  document.getElementById('progressBar').style.width = `${percent}%`;
  document.getElementById('progressPercentCount').innerText = `${percent}% hoàn thành (${done}/${total} câu)`;
  
  document.getElementById('statsCorrect').innerText = correct;
  document.getElementById('statsDone').innerText = done;
  document.getElementById('statsAccuracy').innerText = `${accuracy}%`;
}

function updateProgressOnAnswer(isCorrect) {
  let done = parseInt(localStorage.getItem(KEYS.doneAnswersCount)) || 0;
  let correct = parseInt(localStorage.getItem(KEYS.correctAnswersCount)) || 0;
  
  done = Math.min(allQuestions.length, done + 1);
  if (isCorrect) {
    correct += 1;
  }
  
  localStorage.setItem(KEYS.doneAnswersCount, done);
  localStorage.setItem(KEYS.correctAnswersCount, correct);
  updateProgressStats();
}

function resetAllProgress() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ tiến trình học tập và làm lại từ đầu không?')) {
    localStorage.setItem(KEYS.doneAnswersCount, 0);
    localStorage.setItem(KEYS.correctAnswersCount, 0);
    updateProgressStats();
    userAnswers = {};
    alert('Đã đặt lại tiến trình học tập!');
  }
}

// Change Practice Modes
function changeMode(mode) {
  currentMode = mode;
  clearInterval(mockTestTimer);
  document.getElementById('timerContainer').classList.add('hidden');
  document.getElementById('mockSubmitBlock').classList.add('hidden');
  document.getElementById('quizNavButtons').classList.remove('hidden');
  
  if (mode === 'practice') {
    // Sequential Practice Mode
    activeQuestions = JSON.parse(JSON.stringify(allQuestions));
    currentQuestionIndex = 0;
    showQuizPanel('Học trắc nghiệm');
    renderQuestion();
  } 
  else if (mode === 'random') {
    // Random / Shuffled Practice Mode
    activeQuestions = shuffle(JSON.parse(JSON.stringify(allQuestions)));
    // Also shuffle options for each question
    activeQuestions.forEach(q => {
      const originalOptions = [...q.opts];
      const correctText = originalOptions.find(o => o.startsWith(q.correct + '.'));
      q.opts = shuffle(originalOptions);
      // Re-map correct letter
      const newCorrectIdx = q.opts.findIndex(o => o === correctText);
      q.correct = String.fromCharCode(65 + newCorrectIdx);
    });
    currentQuestionIndex = 0;
    showQuizPanel('Xáo trộn câu hỏi');
    renderQuestion();
  } 
  else if (mode === 'mock_test') {
    // Mock Test Mode
    // Pull 30 random questions
    activeQuestions = shuffle(JSON.parse(JSON.stringify(allQuestions))).slice(0, 30);
    currentQuestionIndex = 0;
    userAnswers = {}; // reset user answers for exam
    showQuizPanel('Thi thử');
    
    // Start countdown timer (30 mins)
    mockTimeRemaining = 30 * 60;
    document.getElementById('timerContainer').classList.remove('hidden');
    document.getElementById('mockSubmitBlock').classList.remove('hidden');
    renderQuestion();
    startMockTimer();
  } 
  else if (mode === 'view_answers') {
    // View Answers browser mode
    showAnswersPanel();
    renderAllAnswersList();
  }
}

// Show/Hide DOM Panels
function showQuizPanel(title) {
  document.getElementById('panelTitle').innerText = title;
  document.getElementById('menuPanel').classList.add('hidden');
  document.getElementById('answersPanel').classList.add('hidden');
  document.getElementById('activePanel').classList.remove('hidden');
}

function showAnswersPanel() {
  document.getElementById('menuPanel').classList.add('hidden');
  document.getElementById('activePanel').classList.add('hidden');
  document.getElementById('answersPanel').classList.remove('hidden');
}

function goBackToMenu() {
  clearInterval(mockTestTimer);
  document.getElementById('activePanel').classList.add('hidden');
  document.getElementById('answersPanel').classList.add('hidden');
  document.getElementById('menuPanel').classList.remove('hidden');
  currentMode = 'menu';
}

// Render dynamic quiz question
function renderQuestion() {
  const q = activeQuestions[currentQuestionIndex];
  const container = document.getElementById('quizContainer');
  container.innerHTML = '';
  
  // Question text card
  const qCard = document.createElement('div');
  qCard.className = 'space-y-4';
  qCard.innerHTML = `
    <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest">Câu ${q.id}</div>
    <div class="text-slate-800 font-extrabold text-lg md:text-xl leading-relaxed">${q.text}</div>
  `;
  container.appendChild(qCard);
  
  // Options container
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'grid grid-cols-1 gap-3 mt-6';
  
  const selected = userAnswers[q.id];
  
  q.opts.forEach((opt, idx) => {
    const letter = String.fromCharCode(65 + idx);
    const content = opt.substring(2).trim();
    
    const label = document.createElement('button');
    label.className = 'option-btn';
    
    // Determine style based on selection and correct answer
    if (currentMode === 'mock_test') {
      if (selected === letter) {
        label.className += ' selected';
      }
    } else {
      if (selected) {
        const correctLetter = q.correct;
        if (letter === correctLetter) {
          label.className += ' correct';
        } else if (selected === letter) {
          label.className += ' wrong';
        } else {
          label.className += ' dimmed';
        }
      }
    }
    
    label.innerHTML = `
      <span class="option-circle">${letter}</span>
      <span style="padding-top: 2px;">${content}</span>
    `;
    
    if (!selected || currentMode === 'mock_test') {
      label.onclick = () => selectOption(q.id, letter);
    }
    optionsDiv.appendChild(label);
  });
  
  container.appendChild(optionsDiv);
  
  // Update indicator
  document.getElementById('questionIndicator').innerText = `${currentQuestionIndex + 1}/${activeQuestions.length}`;
  
  // Toggle Prev/Next buttons
  document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
  if (currentQuestionIndex === activeQuestions.length - 1) {
    document.getElementById('nextBtn').innerText = currentMode === 'mock_test' ? 'Xem lại từ đầu' : 'Hoàn thành';
  } else {
    document.getElementById('nextBtn').innerText = 'Câu sau';
  }
}

// User selects an option
function selectOption(questionId, letter) {
  const q = activeQuestions[currentQuestionIndex];
  userAnswers[questionId] = letter;
  
  if (currentMode !== 'mock_test') {
    // Immediate feedback in practice/random mode
    const isCorrect = letter === q.correct;
    updateProgressOnAnswer(isCorrect);
    
    // Re-render immediately to show colors
    renderQuestion();
    
    // Auto advance after 1 second
    if (currentQuestionIndex < activeQuestions.length - 1) {
      setTimeout(() => {
        nextQuestion();
      }, 1000);
    } else {
      setTimeout(() => {
        showCompletionModal();
      }, 800);
    }
  } else {
    // Mock test (just save and auto-advance)
    renderQuestion();
    if (currentQuestionIndex < activeQuestions.length - 1) {
      setTimeout(() => {
        nextQuestion();
      }, 200);
    }
  }
}

// Navigation
function nextQuestion() {
  if (currentQuestionIndex < activeQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  } else {
    if (currentMode === 'mock_test') {
      // Loop back to start in exam
      currentQuestionIndex = 0;
      renderQuestion();
    } else {
      showCompletionModal();
    }
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

// Completion Dialogs
function showCompletionModal() {
  let correctCount = 0;
  activeQuestions.forEach(q => {
    if (userAnswers[q.id] === q.correct) {
      correctCount++;
    }
  });
  
  const total = activeQuestions.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  
  document.getElementById('modalEmoji').innerText = accuracy >= 80 ? '🏆' : accuracy >= 50 ? '🥈' : '📚';
  document.getElementById('modalTitle').innerText = accuracy >= 80 ? 'Xuất sắc!' : accuracy >= 50 ? 'Khá tốt!' : 'Cố gắng lên!';
  document.getElementById('modalDescription').innerText = `Bạn đã hoàn thành chế độ ôn tập.`;
  document.getElementById('modalCorrectScore').innerText = `${correctCount}/${total}`;
  document.getElementById('modalAccuracy').innerText = `${accuracy}%`;
  
  document.getElementById('resultModal').classList.remove('hidden');
}

// Mock Test Logic
function startMockTimer() {
  updateTimerUI();
  mockTestTimer = setInterval(() => {
    mockTimeRemaining--;
    if (mockTimeRemaining <= 0) {
      clearInterval(mockTestTimer);
      alert('Đã hết thời gian làm bài thi!');
      submitMockTest();
    } else {
      updateTimerUI();
    }
  }, 1000);
}

function updateTimerUI() {
  const mins = Math.floor(mockTimeRemaining / 60);
  const secs = mockTimeRemaining % 60;
  document.getElementById('countdownTimer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function submitMockTest() {
  clearInterval(mockTestTimer);
  let correctCount = 0;
  const unanswered = activeQuestions.filter(q => !userAnswers[q.id]).length;
  
  if (unanswered > 0) {
    if (!confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn có muốn nộp bài thi thử không?`)) {
      startMockTimer();
      return;
    }
  }
  
  activeQuestions.forEach(q => {
    if (userAnswers[q.id] === q.correct) {
      correctCount++;
    }
  });
  
  const total = activeQuestions.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  
  document.getElementById('modalEmoji').innerText = accuracy >= 70 ? '🎉' : '🎯';
  document.getElementById('modalTitle').innerText = 'Kết quả Thi thử';
  document.getElementById('modalDescription').innerText = `Bạn đã trả lời đúng ${correctCount} trên tổng số ${total} câu hỏi.`;
  document.getElementById('modalCorrectScore').innerText = `${correctCount}/${total}`;
  document.getElementById('modalAccuracy').innerText = `${accuracy}%`;
  
  document.getElementById('resultModal').classList.remove('hidden');
}

// Modal actions
function closeModal() {
  document.getElementById('resultModal').classList.add('hidden');
}

// View answers browser render
function renderAllAnswersList(filter = '') {
  const container = document.getElementById('answersListContainer');
  container.innerHTML = '';
  
  const normalizedFilter = removeDiacritics(filter.toLowerCase());
  
  allQuestions.forEach(q => {
    const textMatch = removeDiacritics(q.text.toLowerCase()).includes(normalizedFilter);
    const optionsMatch = q.opts.some(o => removeDiacritics(o.toLowerCase()).includes(normalizedFilter));
    
    if (filter === '' || textMatch || optionsMatch) {
      const qDiv = document.createElement('div');
      qDiv.className = 'p-5 rounded-2xl border border-slate-200 bg-white/60 space-y-3';
      
      let optionsHTML = '';
      q.opts.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const isCorrect = letter === q.correct;
        const cleanContent = opt.substring(2).trim();
        
        optionsHTML += `
          <div class="flex items-start gap-2.5 p-2 rounded-xl text-xs font-medium ${isCorrect ? 'bg-emerald-50 border-l-4 border-emerald-500 font-bold text-emerald-950' : 'bg-slate-50 text-slate-600'}">
            <span class="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-full ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'} font-bold">${letter}</span>
            <span class="pt-0.5 leading-relaxed">${cleanContent}</span>
          </div>
        `;
      });
      
      qDiv.innerHTML = `
        <div class="font-extrabold text-slate-800 leading-snug">Câu ${q.id}. ${q.text}</div>
        <div class="grid grid-cols-1 gap-2">${optionsHTML}</div>
      `;
      container.appendChild(qDiv);
    }
  });
  
  if (container.children.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Không tìm thấy câu hỏi phù hợp.</div>';
  }
}

// Answers search handler
function initSearch() {
  document.getElementById('searchAnswersInput').addEventListener('input', (e) => {
    renderAllAnswersList(e.target.value);
  });
}

// Helper Array Shuffler
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Helper to remove diacritics
function removeDiacritics(text) {
  let nfkd = text.normalize('NFKD');
  let ascii = nfkd.replace(/[\u0300-\u036f]/g, "");
  return ascii.replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D');
}

// PWA Install Prompt handling
let deferredPrompt;
function initPWAInstall() {
  const installBtn = document.getElementById('installAppBtn');
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
    installBtn.classList.add('flex');
  });

  installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          installBtn.classList.add('hidden');
          installBtn.classList.remove('flex');
        }
        deferredPrompt = null;
      });
    }
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('App installed successfully');
    installBtn.classList.add('hidden');
    installBtn.classList.remove('flex');
  });
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully!', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}
