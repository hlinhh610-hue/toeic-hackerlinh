// ==========================================
// VocabHacker - TOEIC Vocabulary Learning App
// ==========================================

class VocabHackerApp {
  constructor() {
    this.currentView = 'dashboard';
    this.currentDay = 'all';
    this.currentCategory = 'all';
    this.viewMode = 'grid';
    this.theme = localStorage.getItem('vh-theme') || 'dark';

    // Flashcard state
    this.flashcardIndex = 0;
    this.flashcardList = [];
    this.isFlipped = false;

    // Quiz state
    this.quizQuestions = [];
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;

    // Vocab Drill state
    this.drillWords = [];
    this.drillIndex = 0;
    this.drillCorrect = 0;
    this.drillWrong = 0;
    this.drillAnswered = false;
    this.drillSelectedDays = ['all'];

    // User progress (persisted)
    this.learned = JSON.parse(localStorage.getItem('vh-learned') || '{}');
    this.starred = JSON.parse(localStorage.getItem('vh-starred') || '{}');
    this.activity = JSON.parse(localStorage.getItem('vh-activity') || '[]');
    this.streakData = JSON.parse(localStorage.getItem('vh-streak') || '{"lastDate":"","count":0}');

    // All words flat list (built on init)
    this.allWords = [];

    this.init();
  }

  init() {
    this.buildAllWords();
    this.applyTheme();
    this.populateDaysList();
    this.populateDayFilters();
    this.updateStreak();
    this.updateDashboard();
    this.setupEventListeners();
    this.renderVocabGrid();
    this.loadFlashcards();

    // Entrance animation
    document.getElementById('app').classList.add('loaded');
  }

  // ==========================================
  // Data Helpers
  // ==========================================

  buildAllWords() {
    this.allWords = [];
    const data = window.vocabData;
    if (!data) return;

    Object.keys(data).forEach(day => {
      const dayData = data[day];
      const categories = ['mainWords', 'basicWords', 'level800Words', 'level900Words'];
      categories.forEach(cat => {
        if (dayData[cat]) {
          dayData[cat].forEach((w, idx) => {
            const word = {
              _id: `${day}-${cat}-${idx}`,
              _day: day,
              _category: cat,
              english: w.english || w.word || '',
              vietnamese: w.vietnamese || w.meaning || '',
              antonym: w.antonym || '',
              exampleEn: w.exampleEn || '',
              exampleVi: w.exampleVi || '',
              part: w.part || '',
            };
            this.allWords.push(word);
          });
        }
      });
    });
  }

  getFilteredWords(day = 'all', category = 'all', status = 'all') {
    let words = this.allWords;
    if (day !== 'all') words = words.filter(w => w._day === day);
    if (category !== 'all') words = words.filter(w => w._category === category);
    if (status === 'learned') words = words.filter(w => this.learned[w._id]);
    if (status === 'starred') words = words.filter(w => this.starred[w._id]);
    if (status === 'unlearned') words = words.filter(w => !this.learned[w._id]);
    return words;
  }

  getCategoryLabel(cat) {
    const labels = {
      mainWords: 'Main 600',
      basicWords: 'Basic',
      level800Words: 'Level 800',
      level900Words: 'Level 900+'
    };
    return labels[cat] || cat;
  }

  getCategoryColor(cat) {
    const colors = {
      mainWords: '#818cf8',
      basicWords: '#34d399',
      level800Words: '#fbbf24',
      level900Words: '#f472b6'
    };
    return colors[cat] || '#818cf8';
  }

  // ==========================================
  // Theme
  // ==========================================

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (this.theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('vh-theme', this.theme);
    this.applyTheme();
  }

  // ==========================================
  // Navigation
  // ==========================================

  navigateTo(view, day = null) {
    this.currentView = view;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`[data-view="${view}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`${view}View`);
    if (viewEl) {
      viewEl.classList.add('active');
      viewEl.style.animation = 'fadeIn 0.4s ease';
    }

    // Update topbar title
    const titles = {
      dashboard: 'Dashboard',
      vocabulary: 'Vocabulary Browser',
      flashcards: 'Flashcards',
      quiz: 'Quiz',
      vocabdrill: 'Vocabulary Test',
      srs: 'Spaced Repetition'
    };
    document.getElementById('topbarTitle').textContent = titles[view] || 'Dashboard';

    // Handle day selection
    if (day) {
      this.currentDay = day;
      document.getElementById('dayFilter').value = day;
      document.getElementById('flashcardDayFilter').value = day;
      this.renderVocabGrid();
      this.loadFlashcards();
    }

    // Close mobile sidebar
    this.closeSidebar();

    // Refresh view-specific content
    if (view === 'vocabulary') this.renderVocabGrid();
    if (view === 'flashcards') this.loadFlashcards();
    if (view === 'dashboard') this.updateDashboard();
    if (view === 'srs') this.updateSRSDashboard();
  }

  // ==========================================
  // Sidebar
  // ==========================================

  populateDaysList() {
    const container = document.getElementById('daysList');
    if (!window.vocabData) return;
    const days = Object.keys(window.vocabData);
    container.innerHTML = days.map(day => {
      const dayNum = day.replace('Day ', '');
      const wordCount = this.getFilteredWords(day).length;
      const learnedCount = this.getFilteredWords(day).filter(w => this.learned[w._id]).length;
      const percent = wordCount > 0 ? Math.round((learnedCount / wordCount) * 100) : 0;
      return `
        <button class="day-btn ${this.currentDay === day ? 'active' : ''}" data-day="${day}" onclick="app.selectDay('${day}')">
          <div class="day-btn-info">
            <span class="day-btn-label">Day ${dayNum}</span>
            <span class="day-btn-count">${learnedCount}/${wordCount}</span>
          </div>
          <div class="day-btn-progress">
            <div class="day-btn-progress-fill" style="width:${percent}%"></div>
          </div>
        </button>
      `;
    }).join('');
  }

  selectDay(day) {
    this.currentDay = day;
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-day="${day}"]`);
    if (btn) btn.classList.add('active');

    // Update filters
    document.getElementById('dayFilter').value = day;
    document.getElementById('flashcardDayFilter').value = day;

    this.navigateTo('vocabulary', day);
  }

  populateDayFilters() {
    if (!window.vocabData) return;
    const days = Object.keys(window.vocabData);
    const selects = ['dayFilter', 'flashcardDayFilter', 'quizDayFilter', 'srsDayFilter'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const html = '<option value="all">All Days</option>' +
        days.map(d => `<option value="${d}">${d}</option>`).join('');
      sel.innerHTML = html;
    });

    // Populate drill day chips
    const drillPicker = document.getElementById('drillDayPicker');
    if (drillPicker) {
      const chips = days.map(d => {
        const num = d.replace('Day ', '');
        return `<button class="drill-day-chip" data-day="${d}" onclick="app.toggleDrillDay('${d}', this)">Day ${num}</button>`;
      }).join('');
      drillPicker.innerHTML = `<button class="drill-day-chip active" data-day="all" onclick="app.toggleDrillDay('all', this)">Tất cả</button>${chips}`;
    }
  }

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }

  openSidebar() {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.classList.add('sidebar-open');
  }

  // ==========================================
  // Dashboard
  // ==========================================

  updateDashboard() {
    const total = this.allWords.length;
    const learned = Object.keys(this.learned).filter(k => this.learned[k]).length;
    const starred = Object.keys(this.starred).filter(k => this.starred[k]).length;

    // Animate counters
    this.animateCounter('totalWords', total);
    this.animateCounter('learnedWords', learned);
    this.animateCounter('starredWords', starred);
    this.animateCounter('streakDays', this.streakData.count);

    // Overall progress
    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
    document.getElementById('overallPercent').textContent = percent + '%';
    document.getElementById('overallProgressBar').style.width = percent + '%';

    // Daily progress grid
    this.renderDailyProgress();

    // Recent activity
    this.renderRecentActivity();
  }

  animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  renderDailyProgress() {
    const container = document.getElementById('dailyProgressGrid');
    if (!window.vocabData || !container) return;

    const days = Object.keys(window.vocabData);
    container.innerHTML = `<div class="daily-progress-grid">${days.map(day => {
      const words = this.getFilteredWords(day);
      const learnedCount = words.filter(w => this.learned[w._id]).length;
      const total = words.length;
      const percent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;
      const dayNum = day.replace('Day ', '');

      return `
        <div class="daily-progress-item" onclick="app.selectDay('${day}')">
          <div class="dp-circle" style="--percent: ${percent}">
            <svg viewBox="0 0 36 36">
              <path class="dp-bg" d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"/>
              <path class="dp-fill" d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                stroke-dasharray="${percent}, 100"/>
            </svg>
            <span class="dp-percent">${percent}%</span>
          </div>
          <span class="dp-label">Day ${dayNum}</span>
          <span class="dp-count">${learnedCount}/${total}</span>
        </div>
      `;
    }).join('')}</div>`;
  }

  renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    if (this.activity.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Start learning to see your activity here!</p></div>';
      return;
    }

    const recent = this.activity.slice(-10).reverse();
    container.innerHTML = recent.map(a => `
      <div class="recent-activity-item">
        <span class="activity-icon">${a.type === 'learned' ? '✅' : a.type === 'starred' ? '⭐' : a.type === 'quiz' ? '📝' : '📖'}</span>
        <span class="activity-text">${a.text}</span>
        <span class="activity-time">${this.timeAgo(a.time)}</span>
      </div>
    `).join('');
  }

  timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  }

  updateStreak() {
    // IMPORTANT: Use LOCAL date, not UTC. toISOString() gives UTC date which
    // causes streak resets in timezones ahead of UTC (e.g. Vietnam UTC+7).
    const getLocalDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const today = getLocalDateStr(new Date());
    if (this.streakData.lastDate === today) return;

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateStr(yesterdayDate);

    if (this.streakData.lastDate === yesterday) {
      this.streakData.count++;
    } else {
      this.streakData.count = 1;
    }
    this.streakData.lastDate = today;
    localStorage.setItem('vh-streak', JSON.stringify(this.streakData));
  }

  // ==========================================
  // Vocabulary Grid
  // ==========================================

  renderVocabGrid() {
    const day = document.getElementById('dayFilter')?.value || 'all';
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';

    const words = this.getFilteredWords(day, category, status);
    document.getElementById('filteredCount').textContent = words.length;

    const container = document.getElementById('vocabGrid');
    if (!container) return;

    if (this.viewMode === 'list') {
      container.className = 'vocab-grid list-view';
    } else {
      container.className = 'vocab-grid';
    }

    if (words.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No words found matching your filters.</p></div>';
      return;
    }

    container.innerHTML = words.map((w, i) => {
      const isLearned = this.learned[w._id];
      const isStarred = this.starred[w._id];
      return `
        <div class="word-card ${isLearned ? 'learned' : ''} ${isStarred ? 'starred' : ''}"
             style="animation-delay: ${Math.min(i * 0.02, 0.5)}s"
             onclick="app.openWordModal('${w._id}')">
          <div class="word-card-header">
            <span class="badge" style="background: ${this.getCategoryColor(w._category)}20; color: ${this.getCategoryColor(w._category)}">${this.getCategoryLabel(w._category)}</span>
            <div class="word-card-actions" onclick="event.stopPropagation()">
              <button class="wc-action ${isLearned ? 'active' : ''}" onclick="app.toggleLearnedById('${w._id}')" title="Learned">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLearned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="wc-action star ${isStarred ? 'active' : ''}" onclick="app.toggleStarById('${w._id}')" title="Star">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
            </div>
          </div>
          <div class="word-en">${w.english}</div>
          <div class="word-vi">${w.vietnamese}</div>
          ${w.antonym ? `<div class="word-antonym">↔ ${w.antonym}</div>` : ''}
          <div class="word-day-label">${w._day}</div>
        </div>
      `;
    }).join('');
  }

  setViewMode(mode) {
    this.viewMode = mode;
    document.querySelectorAll('.view-mode').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
    this.renderVocabGrid();
  }

  testFilteredWords() {
    const day = document.getElementById('dayFilter')?.value || 'all';
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    let pool = this.getFilteredWords(day, category, status);
    
    if (pool.length === 0) {
      alert('Không có từ nào phù hợp với bộ lọc hiện tại để kiểm tra!');
      return;
    }

    // Switch to vocabdrill view but show active drill directly
    this.navigateTo('vocabdrill');

    // Shuffle words for the test
    pool = [...pool].sort(() => Math.random() - 0.5);
    this.drillWords = pool;
    this.drillIndex = 0;
    this.drillCorrect = 0;
    this.drillWrong = 0;
    this.drillAnswered = false;

    // Force hide setup and show active drill
    document.getElementById('drillSetup').classList.add('hidden');
    document.getElementById('drillResult').classList.add('hidden');
    document.getElementById('drillActive').classList.remove('hidden');

    this.showDrillQuestion();
  }

  // ==========================================
  // Word Modal
  // ==========================================

  openWordModal(wordId) {
    const word = this.allWords.find(w => w._id === wordId);
    if (!word) return;

    this._modalWordId = wordId;

    document.getElementById('modalWord').textContent = word.english;
    document.getElementById('modalMeaning').textContent = word.vietnamese;
    document.getElementById('modalExampleEn').textContent = word.exampleEn;
    document.getElementById('modalExampleVi').textContent = word.exampleVi;

    const antonymSection = document.getElementById('modalAntonymSection');
    if (word.antonym) {
      antonymSection.style.display = 'block';
      document.getElementById('modalAntonym').textContent = word.antonym;
    } else {
      antonymSection.style.display = 'none';
    }

    // Update button states
    this.updateModalButtons(wordId);

    document.getElementById('wordModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    document.getElementById('wordModal').classList.add('hidden');
    document.body.style.overflow = '';
  }

  updateModalButtons(wordId) {
    const learnedBtn = document.getElementById('modalLearnedBtn');
    const starBtn = document.getElementById('modalStarBtn');

    if (this.learned[wordId]) {
      learnedBtn.classList.add('active');
      learnedBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Learned ✓';
    } else {
      learnedBtn.classList.remove('active');
      learnedBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark as Learned';
    }

    if (this.starred[wordId]) {
      starBtn.classList.add('active');
      starBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Starred ★';
    } else {
      starBtn.classList.remove('active');
      starBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Star';
    }
  }

  toggleModalLearned() {
    if (this._modalWordId) {
      this.toggleLearnedById(this._modalWordId);
      this.updateModalButtons(this._modalWordId);
    }
  }

  toggleModalStar() {
    if (this._modalWordId) {
      this.toggleStarById(this._modalWordId);
      this.updateModalButtons(this._modalWordId);
    }
  }

  speakModalWord() {
    const word = document.getElementById('modalWord').textContent;
    this.speak(word);
  }

  // ==========================================
  // Learn / Star
  // ==========================================

  toggleLearnedById(wordId) {
    this.learned[wordId] = !this.learned[wordId];
    if (!this.learned[wordId]) delete this.learned[wordId];
    localStorage.setItem('vh-learned', JSON.stringify(this.learned));

    const word = this.allWords.find(w => w._id === wordId);
    if (word && this.learned[wordId]) {
      this.addActivity('learned', `Learned "${word.english}"`);
    }

    this.renderVocabGrid();
    this.populateDaysList();
    this.updateDashboard();
  }

  toggleStarById(wordId) {
    this.starred[wordId] = !this.starred[wordId];
    if (!this.starred[wordId]) delete this.starred[wordId];
    localStorage.setItem('vh-starred', JSON.stringify(this.starred));

    const word = this.allWords.find(w => w._id === wordId);
    if (word && this.starred[wordId]) {
      this.addActivity('starred', `Starred "${word.english}"`);
    }

    this.renderVocabGrid();
    this.updateDashboard();
  }

  addActivity(type, text) {
    this.activity.push({ type, text, time: Date.now() });
    if (this.activity.length > 50) this.activity = this.activity.slice(-50);
    localStorage.setItem('vh-activity', JSON.stringify(this.activity));
  }

  // ==========================================
  // Flashcards
  // ==========================================

  loadFlashcards() {
    const day = document.getElementById('flashcardDayFilter')?.value || 'all';
    const category = document.getElementById('flashcardCategoryFilter')?.value || 'all';
    this.flashcardList = this.getFilteredWords(day, category);
    this.flashcardIndex = 0;
    this.isFlipped = false;
    this.updateFlashcardSearchList();
    this.showFlashcard();
  }

  updateFlashcardSearchList() {
    const dataList = document.getElementById('fcSearchList');
    if (!dataList) return;
    dataList.innerHTML = this.flashcardList.map(w => `<option value="${w.english}">`).join('');
  }

  searchAndJumpFlashcard(value) {
    if (!value || !this.flashcardList) return;
    const lowerVal = value.toLowerCase().trim();
    const index = this.flashcardList.findIndex(w => w.english.toLowerCase() === lowerVal);
    if (index !== -1) {
      this.flashcardIndex = index;
      this.isFlipped = false;
      this.showFlashcard();
      const input = document.getElementById('fcSearchInput');
      if (input) {
        input.value = '';
        input.blur();
      }
    }
  }

  showFlashcard() {
    if (this.flashcardList.length === 0) {
      document.getElementById('fcWord').textContent = 'No words available';
      document.getElementById('fcVietnamese').textContent = '';
      document.getElementById('fcProgress').textContent = '0 / 0';
      return;
    }

    const word = this.flashcardList[this.flashcardIndex];
    document.getElementById('fcWord').textContent = word.english;
    document.getElementById('fcCategory').textContent = this.getCategoryLabel(word._category);
    document.getElementById('fcVietnamese').textContent = word.vietnamese;

    const antonymEl = document.getElementById('fcAntonym');
    if (word.antonym) {
      antonymEl.textContent = `↔ Antonym: ${word.antonym}`;
      antonymEl.style.display = 'block';
    } else {
      antonymEl.style.display = 'none';
    }

    document.getElementById('fcExampleEn').textContent = word.exampleEn;
    document.getElementById('fcExampleVi').textContent = word.exampleVi;
    document.getElementById('fcProgress').textContent = `${this.flashcardIndex + 1} / ${this.flashcardList.length}`;

    // Reset flip
    this.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');

    // Update action button states
    this.updateFlashcardActions();
  }

  updateFlashcardActions() {
    if (this.flashcardList.length === 0) return;
    const word = this.flashcardList[this.flashcardIndex];

    const learnedBtn = document.querySelector('.fc-action-btn.learned-btn');
    const starBtn = document.querySelector('.fc-action-btn.star-btn');

    if (learnedBtn) {
      learnedBtn.classList.toggle('active', !!this.learned[word._id]);
    }
    if (starBtn) {
      starBtn.classList.toggle('active', !!this.starred[word._id]);
    }
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    document.getElementById('flashcard').classList.toggle('flipped', this.isFlipped);
  }

  nextFlashcard() {
    if (this.flashcardList.length === 0) return;
    this.flashcardIndex = (this.flashcardIndex + 1) % this.flashcardList.length;
    this.showFlashcard();
  }

  prevFlashcard() {
    if (this.flashcardList.length === 0) return;
    this.flashcardIndex = (this.flashcardIndex - 1 + this.flashcardList.length) % this.flashcardList.length;
    this.showFlashcard();
  }

  shuffleFlashcards() {
    // Fisher-Yates shuffle
    for (let i = this.flashcardList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.flashcardList[i], this.flashcardList[j]] = [this.flashcardList[j], this.flashcardList[i]];
    }
    this.flashcardIndex = 0;
    this.updateFlashcardSearchList();
    this.showFlashcard();
  }

  markLearned() {
    if (this.flashcardList.length === 0) return;
    const word = this.flashcardList[this.flashcardIndex];
    this.toggleLearnedById(word._id);
    this.updateFlashcardActions();
  }

  toggleStar() {
    if (this.flashcardList.length === 0) return;
    const word = this.flashcardList[this.flashcardIndex];
    this.toggleStarById(word._id);
    this.updateFlashcardActions();
  }

  speakWord() {
    if (this.flashcardList.length === 0) return;
    const word = this.flashcardList[this.flashcardIndex];
    this.speak(word.english);
  }

  speak(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }

  reviewStarred() {
    // Navigate to flashcards with starred words
    this.navigateTo('flashcards');
    this.flashcardList = this.allWords.filter(w => this.starred[w._id]);
    this.flashcardIndex = 0;
    this.isFlipped = false;
    this.updateFlashcardSearchList();
    this.showFlashcard();
  }

  // ==========================================
  // Quiz
  // ==========================================

  startQuiz() {
    const day = document.getElementById('quizDayFilter')?.value || 'all';
    const category = document.getElementById('quizCategoryFilter')?.value || 'all';
    const type = document.getElementById('quizType')?.value || 'en-vi';

    let pool = this.getFilteredWords(day, category);
    if (pool.length < 4) {
      alert('Not enough words for a quiz. Select a wider range.');
      return;
    }

    // Shuffle and pick all
    pool = [...pool].sort(() => Math.random() - 0.5);
    const selected = pool;

    this.quizQuestions = selected.map(word => {
      const isEnToVi = type === 'en-vi' || (type === 'mixed' && Math.random() > 0.5);

      // Get wrong answers from the pool
      const otherWords = pool.filter(w => w._id !== word._id).sort(() => Math.random() - 0.5).slice(0, 3);
      const correctAnswer = isEnToVi ? word.vietnamese : word.english;
      const wrongAnswers = otherWords.map(w => isEnToVi ? w.vietnamese : w.english);

      const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

      return {
        question: isEnToVi ? word.english : word.vietnamese,
        questionLabel: isEnToVi ? 'What does this mean?' : 'What is the English word?',
        correctAnswer,
        options,
        word
      };
    });

    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;

    document.getElementById('quizSetup').classList.add('hidden');
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('quizActive').classList.remove('hidden');

    this.showQuizQuestion();
  }

  showQuizQuestion() {
    const q = this.quizQuestions[this.quizIndex];
    if (!q) return;

    document.getElementById('quizQuestionNum').textContent = `${this.quizIndex + 1}/${this.quizQuestions.length}`;
    document.getElementById('quizScore').textContent = this.quizScore;

    const progress = ((this.quizIndex + 1) / this.quizQuestions.length) * 100;
    document.getElementById('quizProgressFill').style.width = progress + '%';

    document.getElementById('quizQuestion').innerHTML = `
      <div class="quiz-question-label">${q.questionLabel}</div>
      <div class="quiz-question-word">${q.question}</div>
    `;

    document.getElementById('quizAnswers').innerHTML = q.options.map((opt, i) => `
      <button class="quiz-answer-btn" data-index="${i}" onclick="app.answerQuiz(${i})">
        <span class="quiz-answer-letter">${String.fromCharCode(65 + i)}</span>
        <span class="quiz-answer-text">${opt}</span>
      </button>
    `).join('');

    this.quizAnswered = false;
  }

  answerQuiz(index) {
    if (this.quizAnswered) return;
    this.quizAnswered = true;

    const q = this.quizQuestions[this.quizIndex];
    const selectedAnswer = q.options[index];
    const isCorrect = selectedAnswer === q.correctAnswer;

    if (isCorrect) this.quizScore++;

    // Highlight buttons
    const buttons = document.querySelectorAll('.quiz-answer-btn');
    buttons.forEach((btn, i) => {
      btn.classList.add('disabled');
      if (q.options[i] === q.correctAnswer) {
        btn.classList.add('correct');
      } else if (i === index && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    document.getElementById('quizScore').textContent = this.quizScore;

    // Auto advance after delay
    setTimeout(() => {
      this.quizIndex++;
      if (this.quizIndex < this.quizQuestions.length) {
        this.showQuizQuestion();
      } else {
        this.showQuizResult();
      }
    }, 1200);
  }

  showQuizResult() {
    document.getElementById('quizActive').classList.add('hidden');
    document.getElementById('quizResult').classList.remove('hidden');

    const total = this.quizQuestions.length;
    const score = this.quizScore;
    const percent = Math.round((score / total) * 100);

    document.getElementById('resultScore').textContent = score;
    document.getElementById('resultTotal').textContent = total;
    document.getElementById('resultPercent').textContent = percent + '%';

    let icon, title, message;
    if (percent >= 90) {
      icon = '🏆'; title = 'Outstanding!'; message = 'You\'re a TOEIC vocabulary master!';
    } else if (percent >= 70) {
      icon = '🎉'; title = 'Great Job!'; message = 'Keep up the excellent work!';
    } else if (percent >= 50) {
      icon = '💪'; title = 'Good Effort!'; message = 'Review the words you missed and try again.';
    } else {
      icon = '📚'; title = 'Keep Studying!'; message = 'Practice makes perfect. Review the flashcards!';
    }

    document.getElementById('resultIcon').textContent = icon;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultMessage').textContent = message;

    // Log activity
    this.addActivity('quiz', `Quiz completed: ${score}/${total} (${percent}%)`);

    // Animate result
    const card = document.querySelector('.quiz-result-card');
    if (card) card.style.animation = 'bounceIn 0.6s ease';
  }

  // ==========================================
  // Search
  // ==========================================

  handleSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!query || query.length < 2) {
      resultsEl.classList.add('hidden');
      return;
    }

    const q = query.toLowerCase();
    const results = this.allWords
      .filter(w => w.english.toLowerCase().includes(q) || w.vietnamese.toLowerCase().includes(q))
      .slice(0, 8);

    if (results.length === 0) {
      resultsEl.classList.add('hidden');
      return;
    }

    resultsEl.innerHTML = results.map(w => `
      <div class="search-result-item" onclick="app.openWordModal('${w._id}'); document.getElementById('searchResults').classList.add('hidden');">
        <span class="sr-word">${w.english}</span>
        <span class="sr-meaning">${w.vietnamese}</span>
      </div>
    `).join('');
    resultsEl.classList.remove('hidden');
  }

  // ==========================================
  // Event Listeners
  // ==========================================

  setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // Mobile sidebar
    document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => this.openSidebar());
    document.getElementById('sidebarToggle')?.addEventListener('click', () => this.closeSidebar());

    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view) this.navigateTo(view);
      });
    });

    // View mode toggles
    document.getElementById('gridViewBtn')?.addEventListener('click', () => this.setViewMode('grid'));
    document.getElementById('listViewBtn')?.addEventListener('click', () => this.setViewMode('list'));

    // Filters
    document.getElementById('dayFilter')?.addEventListener('change', () => this.renderVocabGrid());
    document.getElementById('categoryFilter')?.addEventListener('change', () => this.renderVocabGrid());
    document.getElementById('statusFilter')?.addEventListener('change', () => this.renderVocabGrid());

    // Flashcard filters
    document.getElementById('flashcardDayFilter')?.addEventListener('change', () => this.loadFlashcards());
    document.getElementById('flashcardCategoryFilter')?.addEventListener('change', () => this.loadFlashcards());

    // Search
    document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById('searchInput')?.addEventListener('focus', (e) => {
      if (e.target.value.length >= 2) this.handleSearch(e.target.value);
    });

    // Close search results on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) {
        document.getElementById('searchResults')?.classList.add('hidden');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ESC to close modal
      if (e.key === 'Escape') {
        this.closeModal();
        document.getElementById('searchResults')?.classList.add('hidden');
      }

      // Flashcard keyboard shortcuts
      if (this.currentView === 'flashcards') {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          if (this.isFlipped) {
            this.nextFlashcard();
          } else {
            this.flipCard();
          }
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prevFlashcard();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.flipCard();
        }
      }

      // Drill: Enter to submit or advance
      if (this.currentView === 'vocabdrill') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!this.drillAnswered) {
            this.submitDrillAnswer();
          } else {
            this.nextDrillWord();
          }
        }
      }

      // SRS: Space/Enter to flip; 1-4 to rate
      if (this.currentView === 'srs' && document.getElementById('srsActive') && !document.getElementById('srsActive').classList.contains('hidden')) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.flipSRSCard();
        }
        if (e.key === '1') { e.preventDefault(); this.rateSRS(1); }
        if (e.key === '2') { e.preventDefault(); this.rateSRS(2); }
        if (e.key === '3') { e.preventDefault(); this.rateSRS(3); }
        if (e.key === '4') { e.preventDefault(); this.rateSRS(4); }
      }
    });

    // Swipe support for flashcards
    let touchStartX = 0;
    let touchEndX = 0;
    const flashcardArea = document.querySelector('.flashcard-area');
    if (flashcardArea) {
      flashcardArea.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      flashcardArea.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) this.nextFlashcard();
          else this.prevFlashcard();
        }
      }, { passive: true });
    }
  }
}

// ==========================================
// Vocab Drill Methods
// ==========================================

VocabHackerApp.prototype.toggleDrillDay = function(day, btn) {
  const picker = document.getElementById('drillDayPicker');
  const chips = picker.querySelectorAll('.drill-day-chip');

  if (day === 'all') {
    // Select all
    this.drillSelectedDays = ['all'];
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  } else {
    // Remove 'all' if it was selected
    const allChip = picker.querySelector('[data-day="all"]');
    if (this.drillSelectedDays.includes('all')) {
      this.drillSelectedDays = [];
      allChip.classList.remove('active');
    }
    // Toggle this day
    if (this.drillSelectedDays.includes(day)) {
      this.drillSelectedDays = this.drillSelectedDays.filter(d => d !== day);
      btn.classList.remove('active');
    } else {
      this.drillSelectedDays.push(day);
      btn.classList.add('active');
    }
    // If nothing selected, revert to 'all'
    if (this.drillSelectedDays.length === 0) {
      this.drillSelectedDays = ['all'];
      allChip.classList.add('active');
    }
  }
};

VocabHackerApp.prototype.startVocabDrill = function() {
  const category = document.getElementById('drillCategoryFilter')?.value || 'all';
  const countVal = parseInt(document.getElementById('drillCount')?.value || '20');

  // Build word pool based on selected days
  let pool = [];
  if (this.drillSelectedDays.includes('all')) {
    pool = this.getFilteredWords('all', category);
  } else {
    this.drillSelectedDays.forEach(day => {
      pool = pool.concat(this.getFilteredWords(day, category));
    });
  }

  const status = document.getElementById('drillStatusFilter')?.value || 'all';

  if (status === 'learned') {
    pool = pool.filter(w => this.learned[w._id]);
  } else if (status === 'starred') {
    pool = pool.filter(w => this.starred[w._id]);
  } else if (status === 'unlearned') {
    pool = pool.filter(w => !this.learned[w._id]);
  }

  if (pool.length === 0) {
    alert('Không có từ nào phù hợp với các bộ lọc đã chọn! Hãy chọn lại ngày, danh mục hoặc trạng thái khác.');
    return;
  }

  // Shuffle and limit
  pool = [...pool].sort(() => Math.random() - 0.5);
  this.drillWords = pool.slice(0, Math.min(countVal, pool.length));
  this.drillIndex = 0;
  this.drillCorrect = 0;
  this.drillWrong = 0;
  this.drillAnswered = false;

  document.getElementById('drillSetup').classList.add('hidden');
  document.getElementById('drillResult').classList.add('hidden');
  document.getElementById('drillActive').classList.remove('hidden');

  this.showDrillWord();
};

VocabHackerApp.prototype.showDrillWord = function() {
  const word = this.drillWords[this.drillIndex];
  if (!word) return;

  // Update header
  const total = this.drillWords.length;
  const current = this.drillIndex + 1;
  document.getElementById('drillProgressText').textContent = `${current} / ${total}`;
  document.getElementById('drillProgressFill').style.width = `${(current / total) * 100}%`;
  document.getElementById('drillCorrectCount').textContent = this.drillCorrect;
  document.getElementById('drillWrongCount').textContent = this.drillWrong;

  // Update card content
  document.getElementById('drillEnglishWord').textContent = word.english;
  document.getElementById('drillCategoryBadge').textContent = this.getCategoryLabel(word._category);
  document.getElementById('drillDayBadge').textContent = word._day;

  // Reset input & feedback
  const input = document.getElementById('drillInput');
  input.value = '';
  input.className = 'drill-input';
  input.disabled = false;
  input.focus();

  const feedback = document.getElementById('drillFeedback');
  feedback.classList.add('hidden');
  feedback.className = 'drill-feedback hidden';

  const nextBtn = document.getElementById('drillNextBtn');
  nextBtn.classList.add('hidden');

  const card = document.getElementById('drillCard');
  card.classList.remove('correct-anim', 'wrong-anim');

  this.drillAnswered = false;
};

VocabHackerApp.prototype.submitDrillAnswer = function() {
  if (this.drillAnswered) { this.nextDrillWord(); return; }

  const input = document.getElementById('drillInput');
  const userAnswer = input.value.trim();
  if (!userAnswer) { input.focus(); return; }

  const word = this.drillWords[this.drillIndex];
  const correct = word.vietnamese;

  // Simple matching: check if any key Vietnamese word appears in user answer
  // We normalize both by removing diacritics loosely and lowercasing
  const normalize = str => str.toLowerCase()
    .replace(/[,;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const userNorm = normalize(userAnswer);
  const correctNorm = normalize(correct);

  // Extract keywords from correct answer (split by comma/semicolon)
  const correctKeywords = correctNorm.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  // Check if user answer contains at least one significant keyword
  let isCorrect = false;
  for (const kw of correctKeywords) {
    const kwWords = kw.split(' ').filter(w => w.length > 2);
    if (kwWords.length === 0) {
      if (userNorm.includes(kw)) { isCorrect = true; break; }
    } else {
      const matchCount = kwWords.filter(w => userNorm.includes(w)).length;
      if (matchCount >= Math.ceil(kwWords.length * 0.5)) { isCorrect = true; break; }
    }
  }

  this.drillAnswered = true;
  const card = document.getElementById('drillCard');
  const feedback = document.getElementById('drillFeedback');
  const nextBtn = document.getElementById('drillNextBtn');

  if (isCorrect) {
    this.drillCorrect++;
    input.className = 'drill-input correct';
    card.classList.add('correct-anim');
    feedback.className = 'drill-feedback correct-feedback';
    document.getElementById('drillFeedbackIcon').textContent = '✅';
    document.getElementById('drillFeedbackStatus').textContent = 'Chính xác! 🎉';
    document.getElementById('drillFeedbackCorrect').textContent = `Nghĩa đúng: ${correct}`;
    document.getElementById('drillFeedbackExample').textContent = word.exampleEn ? `“${word.exampleEn}”` : '';
  } else {
    this.drillWrong++;
    input.className = 'drill-input wrong';
    card.classList.add('wrong-anim');
    feedback.className = 'drill-feedback wrong-feedback';
    document.getElementById('drillFeedbackIcon').textContent = '❌';
    document.getElementById('drillFeedbackStatus').textContent = 'Chưa đúng!';
    document.getElementById('drillFeedbackCorrect').textContent = `Đáp án đúng: ${correct}`;
    document.getElementById('drillFeedbackExample').textContent = word.exampleEn ? `“${word.exampleEn}”` : '';
  }

  document.getElementById('drillCorrectCount').textContent = this.drillCorrect;
  document.getElementById('drillWrongCount').textContent = this.drillWrong;
  feedback.classList.remove('hidden');
  nextBtn.classList.remove('hidden');
  input.disabled = true;
  // No auto-advance — user must press Enter or click "Từ tiếp theo"
};

VocabHackerApp.prototype.nextDrillWord = function() {
  clearTimeout(this._drillAutoTimer);
  this.drillIndex++;
  if (this.drillIndex >= this.drillWords.length) {
    this.showDrillResult();
  } else {
    this.showDrillWord();
  }
};

VocabHackerApp.prototype.showDrillResult = function() {
  document.getElementById('drillActive').classList.add('hidden');
  document.getElementById('drillResult').classList.remove('hidden');

  const total = this.drillWords.length;
  const correct = this.drillCorrect;
  const wrong = this.drillWrong;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  document.getElementById('drillResultCorrect').textContent = correct;
  document.getElementById('drillResultWrong').textContent = wrong;
  document.getElementById('drillResultPercent').textContent = percent + '%';

  let emoji, title, msg;
  if (percent >= 90) {
    emoji = '🏆'; title = 'Xuất sắc!'; msg = 'Bạn thực sự là bậc thầy từ vựng TOEIC!';
  } else if (percent >= 70) {
    emoji = '🎉'; title = 'Rất tốt!'; msg = 'Hãy tiếp tục luyện tập để đạt được kết quả tốt hơn!';
  } else if (percent >= 50) {
    emoji = '💪'; title = 'Cố gắng tốt!'; msg = 'Hãy xem lại các từ bạn sai và thử lại!';
  } else {
    emoji = '📚'; title = 'Hãy cố gắng hơn!'; msg = 'Thực hành đều đặn sẽ giúp bạn ghi nhớ từ vựng tốt hơn.';
  }

  document.getElementById('drillResultEmoji').textContent = emoji;
  document.getElementById('drillResultTitle').textContent = title;
  document.getElementById('drillResultMsg').textContent = msg;

  this.addActivity('quiz', `Kiểm tra từ vựng: ${correct}/${total} đúng (${percent}%)`);
};

VocabHackerApp.prototype.showDrillSetup = function() {
  document.getElementById('drillActive').classList.add('hidden');
  document.getElementById('drillResult').classList.add('hidden');
  document.getElementById('drillSetup').classList.remove('hidden');
};

VocabHackerApp.prototype.quitDrill = function() {
  this.showDrillSetup();
};

// ==========================================
// Spaced Repetition System (SM-2 Algorithm)
// ==========================================
// srsData[wordId] = { easeFactor, interval, repetitions, nextReview, lastRated }

VocabHackerApp.prototype._srsLoad = function() {
  this.srsData = JSON.parse(localStorage.getItem('vh-srs') || '{}');
  
  // Migration to fix old "Tốt" ratings that got 1 day instead of 2 days
  let needsSave = false;
  for (const id in this.srsData) {
    const card = this.srsData[id];
    if (card.lastRating === 'good' && card.interval === 1 && card.repetitions === 1) {
      card.interval = 2;
      card.nextReview += 86400000; // Add 1 day
      needsSave = true;
    }
  }
  
  if (needsSave) {
    this._srsSave();
  }
};

VocabHackerApp.prototype._srsSave = function() {
  localStorage.setItem('vh-srs', JSON.stringify(this.srsData));
};

// SM-2 core: rating 1=Again,2=Hard,3=Good,4=Easy
VocabHackerApp.prototype._srsSchedule = function(card, rating) {
  let { easeFactor = 2.5, interval = 0, repetitions = 0 } = card;

  if (rating === 1) { // Again
    repetitions = 0;
    interval = 0;
  } else if (rating === 2) { // Hard
    if (repetitions === 0) {
      interval = 1;
    } else {
      repetitions = Math.max(repetitions - 1, 0);
      interval = Math.max(Math.round(interval * 1.2), 1);
    }
    easeFactor = Math.max(easeFactor - 0.15, 1.3);
  } else if (rating === 3) { // Good
    if (repetitions === 0) interval = 2;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
    easeFactor = Math.max(easeFactor + 0.1, 1.3);
  } else if (rating === 4) { // Easy
    if (repetitions === 0) interval = 4;
    else if (repetitions === 1) interval = 10;
    else interval = Math.round(interval * easeFactor * 1.3);
    repetitions++;
    easeFactor = Math.min(easeFactor + 0.15, 3.0);
  }

  const nextReview = Date.now() + interval * 86400000;
  const lastRating = ['', 'again', 'hard', 'good', 'easy'][rating];
  return { easeFactor, interval, repetitions, nextReview, lastRated: Date.now(), lastRating };
};

VocabHackerApp.prototype._srsFormatInterval = function(days) {
  if (days < 1) return '< 1 ngày';
  if (days === 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
};

VocabHackerApp.prototype.updateSRSDashboard = function() {
  if (!this.srsData) this._srsLoad();
  const now = Date.now();

  let due = 0, fresh = 0, mastered = 0;
  let buckets = { again: 0, hard: 0, good: 0, easy: 0 };

  this.allWords.forEach(w => {
    const c = this.srsData[w._id];
    if (!c) { fresh++; }
    else {
      if (c.interval >= 21) mastered++;
      if (c.nextReview <= now) due++;
      if (c.lastRating) buckets[c.lastRating]++;
    }
  });

  document.getElementById('srsDueCount').textContent = due;
  document.getElementById('srsNewCount').textContent = fresh;
  document.getElementById('srsMasteredCount').textContent = mastered;

  // Update bucket counts
  document.getElementById('bucketCountAgain').textContent = buckets.again + ' từ';
  document.getElementById('bucketCountHard').textContent  = buckets.hard  + ' từ';
  document.getElementById('bucketCountGood').textContent  = buckets.good  + ' từ';
  document.getElementById('bucketCountEasy').textContent  = buckets.easy  + ' từ';

  // Update review CTA - always visible
  const ctaEl = document.getElementById('srsReviewCTA');
  const totalLearned = this.allWords.filter(w => this.srsData[w._id]).length;
  if (ctaEl) {
    const ctaDueNum = document.getElementById('srsCtaDueNum');
    const ctaTitle = document.getElementById('srsCtaTitle');
    const ctaDesc = document.getElementById('srsCtaDesc');
    const ctaIcon = document.getElementById('srsCtaIcon');
    const ctaDueBtn = document.getElementById('srsCtaDueBtn');
    const ctaAllBtn = document.getElementById('srsCtaAllBtn');

    if (due > 0) {
      // Has due words — show urgent review
      ctaIcon.textContent = '🔔';
      ctaTitle.innerHTML = `Bạn có <span>${due}</span> từ cần ôn lại!`;
      ctaDesc.textContent = 'Những từ này đã đến hạn ôn tập. Hãy ôn ngay để không quên nhé.';
      ctaDueBtn.style.display = 'inline-flex';
      ctaDueBtn.textContent = `Ôn ${due} từ đến hạn 🚀`;
      ctaAllBtn.textContent = `Ôn tất cả ${totalLearned} từ đã học`;
      ctaEl.classList.add('srs-cta-pulse');
      ctaEl.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      ctaEl.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(245, 158, 11, 0.03))';
    } else if (totalLearned > 0) {
      // No due but has learned words — calm review option
      ctaIcon.textContent = '📖';
      ctaTitle.innerHTML = 'Chưa có từ nào đến hạn ôn tập';
      ctaDesc.textContent = `Bạn đã học ${totalLearned} từ. Bấm ôn tập để luyện lại bất cứ lúc nào!`;
      ctaDueBtn.style.display = 'none';
      ctaAllBtn.textContent = `Ôn lại ${totalLearned} từ đã học`;
      ctaEl.classList.remove('srs-cta-pulse');
      ctaEl.style.borderColor = 'rgba(129, 140, 248, 0.3)';
      ctaEl.style.background = 'linear-gradient(135deg, rgba(129, 140, 248, 0.06), rgba(99, 102, 241, 0.03))';
    } else {
      // Nothing learned yet
      ctaIcon.textContent = '✨';
      ctaTitle.innerHTML = 'Bắt đầu hành trình học từ vựng!';
      ctaDesc.textContent = 'Bấm "Bắt đầu ôn tập" ở phía dưới để bắt đầu học từ mới với thuật toán SRS.';
      ctaDueBtn.style.display = 'none';
      ctaAllBtn.style.display = 'none';
      ctaEl.classList.remove('srs-cta-pulse');
      ctaEl.style.borderColor = 'rgba(129, 140, 248, 0.2)';
      ctaEl.style.background = 'linear-gradient(135deg, rgba(129, 140, 248, 0.04), rgba(99, 102, 241, 0.02))';
    }
  }
};

// Review ONLY due words (words where nextReview <= now)
VocabHackerApp.prototype.startSRSReviewDue = function() {
  if (!this.srsData) this._srsLoad();
  const now = Date.now();

  const dueWords = this.allWords.filter(w => {
    const c = this.srsData[w._id];
    return c && c.nextReview <= now;
  }).sort(() => Math.random() - 0.5);

  if (dueWords.length === 0) {
    alert('🎉 Tuyệt vời! Không có từ nào cần ôn lại lúc này. Quay lại sau nhé!');
    return;
  }

  this._launchSRSSession(dueWords);
};

// Review ALL learned words (regardless of schedule)
VocabHackerApp.prototype.startSRSReviewAll = function() {
  if (!this.srsData) this._srsLoad();

  const learnedWords = this.allWords.filter(w => this.srsData[w._id])
    .sort(() => Math.random() - 0.5);

  if (learnedWords.length === 0) {
    alert('Chưa có từ nào đã học. Hãy bắt đầu phiên ôn tập mới!');
    return;
  }

  this._launchSRSSession(learnedWords);
};

// Shared session launcher
VocabHackerApp.prototype._launchSRSSession = function(words) {
  this.srsSession = words;
  this.srsSessionIndex = 0;
  this.srsCounters = { again: 0, hard: 0, good: 0, easy: 0 };
  this.srsFlipped = false;

  document.getElementById('srsDashboard').classList.add('hidden');
  document.getElementById('srsWordListPanel')?.classList.add('hidden');
  document.getElementById('srsResult').classList.add('hidden');
  document.getElementById('srsActive').classList.remove('hidden');

  this.showSRSCard();
};

VocabHackerApp.prototype.startSRSSession = function() {
  if (!this.srsData) this._srsLoad();
  const day = document.getElementById('srsDayFilter')?.value || 'all';
  const category = document.getElementById('srsCategoryFilter')?.value || 'all';
  const size = parseInt(document.getElementById('srsSessionSize')?.value || '20');
  const now = Date.now();

  let pool = this.getFilteredWords(day, category);

  // Separate due, new, and future
  const due = pool.filter(w => {
    const c = this.srsData[w._id];
    return c && c.nextReview <= now;
  });
  const fresh = pool.filter(w => !this.srsData[w._id]);

  // Priority: due first, then new
  let session = [...due.sort(() => Math.random() - 0.5)];
  if (session.length < size) {
    const needed = size - session.length;
    session = session.concat(fresh.sort(() => Math.random() - 0.5).slice(0, needed));
  }
  session = session.slice(0, size);

  if (session.length === 0) {
    alert('Không có từ nào cần ôn! Hãy chọn day khác hoặc quay lại sau.');
    return;
  }

  this.srsSession = session;
  this.srsSessionIndex = 0;
  this.srsCounters = { again: 0, hard: 0, good: 0, easy: 0 };
  this.srsFlipped = false;

  document.getElementById('srsDashboard').classList.add('hidden');
  document.getElementById('srsResult').classList.add('hidden');
  document.getElementById('srsActive').classList.remove('hidden');

  this.showSRSCard();
};

VocabHackerApp.prototype.showSRSCard = function() {
  if (!this.srsData) this._srsLoad();
  const word = this.srsSession[this.srsSessionIndex];
  if (!word) return;

  const total = this.srsSession.length;
  const current = this.srsSessionIndex + 1;

  // Header
  document.getElementById('srsSessionProgress').textContent = `${current} / ${total}`;
  document.getElementById('srsProgressFill').style.width = `${((current - 1) / total) * 100}%`;
  document.getElementById('srsCountAgain').textContent = `${this.srsCounters.again} lại`;
  document.getElementById('srsCountHard').textContent = `${this.srsCounters.hard} khó`;
  document.getElementById('srsCountGood').textContent = `${this.srsCounters.good} tốt`;
  document.getElementById('srsCountEasy').textContent = `${this.srsCounters.easy} dễ`;

  // Badge category
  document.getElementById('srsCategoryBadge').textContent = this.getCategoryLabel(word._category);

  // Is this card new or review?
  const card = this.srsData[word._id];
  const isNew = !card;
  document.getElementById('srsTagDue').classList.toggle('hidden', isNew);
  document.getElementById('srsTagNew').classList.toggle('hidden', !isNew);

  // Interval badge
  const intervalDays = card?.interval || 0;
  document.getElementById('srsIntervalBadge').textContent = isNew ? 'Thẻ mới' : `Ôn sau ${intervalDays}ng`;

  // Card content
  document.getElementById('srsCardWord').textContent = word.english;
  document.getElementById('srsCardWordBack').textContent = word.english;
  document.getElementById('srsCardMeaning').textContent = word.vietnamese;

  const antonymEl = document.getElementById('srsCardAntonym');
  if (word.antonym && word.antonym !== '-') {
    antonymEl.textContent = `⇔ ${word.antonym}`;
    antonymEl.style.display = 'block';
  } else {
    antonymEl.style.display = 'none';
  }

  const exEl = document.getElementById('srsCardExample');
  if (word.exampleEn) {
    exEl.innerHTML = `<em>“${word.exampleEn}”</em><br><span>${word.exampleVi || ''}</span>`;
    exEl.style.display = 'block';
  } else {
    exEl.style.display = 'none';
  }

  // Compute preview intervals for buttons
  const previewCard = card || { easeFactor: 2.5, interval: 0, repetitions: 0 };
  const previewHard = this._srsSchedule({ ...previewCard }, 2);
  const previewGood = this._srsSchedule({ ...previewCard }, 3);
  const previewEasy = this._srsSchedule({ ...previewCard }, 4);
  document.getElementById('srsIntervalHard').textContent = this._srsFormatInterval(previewHard.interval);
  document.getElementById('srsIntervalGood').textContent = this._srsFormatInterval(previewGood.interval);
  document.getElementById('srsIntervalEasy').textContent = this._srsFormatInterval(previewEasy.interval);

  // Show front, hide back
  document.getElementById('srsCardFront').classList.remove('hidden');
  document.getElementById('srsCardBack').classList.add('hidden');
  this.srsFlipped = false;

  // Click/Space to flip
  const srsCard = document.getElementById('srsCard');
  srsCard.onclick = () => this.flipSRSCard();
};

VocabHackerApp.prototype.flipSRSCard = function() {
  if (this.srsFlipped) return;
  this.srsFlipped = true;
  document.getElementById('srsCardFront').classList.add('hidden');
  document.getElementById('srsCardBack').classList.remove('hidden');
  // Remove click-to-flip handler (rating buttons take over)
  document.getElementById('srsCard').onclick = null;
};

VocabHackerApp.prototype.rateSRS = function(rating) {
  if (!this.srsFlipped) { this.flipSRSCard(); return; }
  if (!this.srsData) this._srsLoad();

  const word = this.srsSession[this.srsSessionIndex];
  const existing = this.srsData[word._id] || { easeFactor: 2.5, interval: 0, repetitions: 0 };
  this.srsData[word._id] = this._srsSchedule(existing, rating);
  this._srsSave();

  // Tally
  if (rating === 1) this.srsCounters.again++;
  else if (rating === 2) this.srsCounters.hard++;
  else if (rating === 3) this.srsCounters.good++;
  else if (rating === 4) this.srsCounters.easy++;

  // If "Again" — re-add word to end of session
  if (rating === 1) {
    this.srsSession.push(word);
  }

  this.srsSessionIndex++;
  if (this.srsSessionIndex >= this.srsSession.length) {
    this.showSRSResult();
  } else {
    this.showSRSCard();
  }
};

VocabHackerApp.prototype.showSRSResult = function() {
  document.getElementById('srsActive').classList.add('hidden');
  document.getElementById('srsResult').classList.remove('hidden');

  const { again, hard, good, easy } = this.srsCounters;
  const total = again + hard + good + easy;
  const goodRate = total > 0 ? Math.round(((good + easy) / total) * 100) : 0;

  document.getElementById('srbAgain').textContent = again;
  document.getElementById('srbHard').textContent = hard;
  document.getElementById('srbGood').textContent = good;
  document.getElementById('srbEasy').textContent = easy;

  let emoji, title;
  if (goodRate >= 80) { emoji = '🏆'; title = 'Phương pháp hiệu quả!'; }
  else if (goodRate >= 60) { emoji = '🎉'; title = 'Lưu ý các từ khó!'; }
  else { emoji = '💪'; title = 'Hãy ôn lại thường xuyên!'; }

  document.getElementById('srsResultEmoji').textContent = emoji;
  document.getElementById('srsResultTitle').textContent = title;

  // Find next due word
  const now = Date.now();
  const nextDue = Object.values(this.srsData)
    .filter(c => c.nextReview > now)
    .map(c => c.nextReview)
    .sort()[0];

  if (nextDue) {
    const hoursLeft = Math.ceil((nextDue - now) / 3600000);
    document.getElementById('srsResultNext').textContent =
      hoursLeft < 24
        ? `Từ tiếp theo sẽ đến hạn sau ${hoursLeft} giờ.`
        : `Từ tiếp theo sẽ đến hạn sau ${Math.ceil(hoursLeft / 24)} ngày.`;
  } else {
    document.getElementById('srsResultNext').textContent = 'Đã hoàn thành tất cả thẻ hôm nay!';
  }

  this.addActivity('quiz', `SRS: ${good + easy}/${total} tốt (${goodRate}%)`);
  this.updateSRSDashboard();
};

VocabHackerApp.prototype.showSRSDashboard = function() {
  document.getElementById('srsActive').classList.add('hidden');
  document.getElementById('srsResult').classList.add('hidden');
  document.getElementById('srsWordListPanel')?.classList.add('hidden');
  document.getElementById('srsDashboard').classList.remove('hidden');
  this.updateSRSDashboard();
};

VocabHackerApp.prototype.quitSRS = function() {
  this.showSRSDashboard();
};

// ==========================================
// SRS Word List (Bucket Viewer)
// ==========================================

VocabHackerApp.prototype.showSRSWordList = function(bucket) {
  if (!this.srsData) this._srsLoad();

  // Find all words in this bucket
  const bucketWords = this.allWords.filter(w => {
    const c = this.srsData[w._id];
    return c && c.lastRating === bucket;
  });

  this._srsCurrentBucket = bucket;
  this._srsCurrentBucketWords = bucketWords;

  const config = {
    again: { label: 'Lại', title: 'Danh sách từ nhóm "Lại"', cls: 'wl-badge-again' },
    hard:  { label: 'Khó', title: 'Danh sách từ nhóm "Khó"', cls: 'wl-badge-hard'  },
    good:  { label: 'Tốt', title: 'Danh sách từ nhóm "Tốt"', cls: 'wl-badge-good'  },
    easy:  { label: 'Dễ',  title: 'Danh sách từ nhóm "Dễ"',  cls: 'wl-badge-easy'  },
  }[bucket];

  document.getElementById('srsWlBadge').textContent = config.label;
  document.getElementById('srsWlBadge').className = `srs-wl-badge ${config.cls}`;
  document.getElementById('srsWlTitle').textContent = config.title;
  document.getElementById('srsWlCount').textContent = `${bucketWords.length} từ`;
  document.getElementById('srsWlSearch').value = '';

  // Hide dashboard, show word list
  document.getElementById('srsDashboard').classList.add('hidden');
  const panel = document.getElementById('srsWordListPanel');
  panel.classList.remove('hidden');

  this._renderSRSWordList(bucketWords, bucket);

  // Scroll to top of the list
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

VocabHackerApp.prototype._renderSRSWordList = function(words, bucket) {
  const grid = document.getElementById('srsWlGrid');

  if (words.length === 0) {
    grid.innerHTML = `<div class="srs-wl-empty">
      <div class="srs-wl-empty-icon">🔍</div>
      <p>Chưa có từ nào trong nhóm này.<br>Hãy ôn tập thêm để phân loại từ!</p>
    </div>`;
    return;
  }

  const intervalLabel = days => {
    if (days < 1) return '< 1 ngày';
    if (days === 1) return '1 ngày';
    if (days < 30) return `${days} ngày`;
    return `${Math.round(days / 30)} tháng`;
  };

  const now = Date.now();
  grid.innerHTML = words.map(w => {
    const c = this.srsData[w._id];
    const isDue = c && c.nextReview <= now;
    const nextStr = c ? intervalLabel(c.interval) : '—';
    return `
      <div class="srs-wl-card" data-english="${w.english.toLowerCase()}" data-vi="${w.vietnamese.toLowerCase()}">
        <div class="srs-wl-card-top">
          <span class="srs-wl-card-day">${w._day}</span>
          ${isDue ? '<span class="srs-wl-due-badge">Đến hạn</span>' : ''}
        </div>
        <div class="srs-wl-card-en">${w.english}</div>
        <div class="srs-wl-card-vi">${w.vietnamese}</div>
        ${w.antonym && w.antonym !== '-' ? `<div class="srs-wl-card-antonym">↔ ${w.antonym}</div>` : ''}
        <div class="srs-wl-card-footer">
          <span class="srs-wl-interval">⏱ Ôn sau ${nextStr}</span>
          <span class="srs-wl-reps">×${c?.repetitions || 0}</span>
        </div>
      </div>
    `;
  }).join('');
};

VocabHackerApp.prototype.filterSRSWordList = function(query) {
  const q = query.toLowerCase().trim();
  const words = q
    ? this._srsCurrentBucketWords.filter(w =>
        w.english.toLowerCase().includes(q) || w.vietnamese.toLowerCase().includes(q))
    : this._srsCurrentBucketWords;

  document.getElementById('srsWlCount').textContent = `${words.length} từ`;
  this._renderSRSWordList(words, this._srsCurrentBucket);
};

VocabHackerApp.prototype.closeSRSWordList = function() {
  document.getElementById('srsWordListPanel').classList.add('hidden');
  document.getElementById('srsDashboard').classList.remove('hidden');
};

// ==========================================
// Data Backup & Restore
// ==========================================

VocabHackerApp.prototype.exportData = function() {
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    learned: JSON.parse(localStorage.getItem('vh-learned') || '{}'),
    starred: JSON.parse(localStorage.getItem('vh-starred') || '{}'),
    activity: JSON.parse(localStorage.getItem('vh-activity') || '[]'),
    streak: JSON.parse(localStorage.getItem('vh-streak') || '{}'),
    srs: JSON.parse(localStorage.getItem('vh-srs') || '{}'),
    theme: localStorage.getItem('vh-theme') || 'dark'
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `vocabhacker-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show confirmation
  this._showToast('✅ Đã sao lưu thành công! File backup đã được tải xuống.');
};

VocabHackerApp.prototype.importData = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.learned && !data.starred && !data.srs) {
        alert('❌ File backup không hợp lệ! Vui lòng chọn file JSON đúng định dạng.');
        return;
      }

      // Confirm before overwriting
      const learnedCount = Object.keys(data.learned || {}).length;
      const starredCount = Object.keys(data.starred || {}).length;
      const srsCount = Object.keys(data.srs || {}).length;
      const streakCount = data.streak?.count || 0;

      const confirmMsg = `🔄 Khôi phục dữ liệu từ backup?\n\n` +
        `📅 Ngày backup: ${data.exportDate ? new Date(data.exportDate).toLocaleString('vi-VN') : 'Không rõ'}\n` +
        `✅ Từ đã học: ${learnedCount}\n` +
        `⭐ Từ gắn sao: ${starredCount}\n` +
        `🧠 Dữ liệu SRS: ${srsCount} từ\n` +
        `🔥 Chuỗi ngày: ${streakCount} ngày\n\n` +
        `⚠️ Dữ liệu hiện tại sẽ bị ghi đè. Tiếp tục?`;

      if (!confirm(confirmMsg)) return;

      // Restore all data
      if (data.learned) localStorage.setItem('vh-learned', JSON.stringify(data.learned));
      if (data.starred) localStorage.setItem('vh-starred', JSON.stringify(data.starred));
      if (data.activity) localStorage.setItem('vh-activity', JSON.stringify(data.activity));
      if (data.streak) localStorage.setItem('vh-streak', JSON.stringify(data.streak));
      if (data.srs) localStorage.setItem('vh-srs', JSON.stringify(data.srs));
      if (data.theme) localStorage.setItem('vh-theme', data.theme);

      this._showToast('✅ Khôi phục thành công! Đang tải lại trang...');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      alert('❌ Lỗi đọc file backup: ' + err.message);
    }
  };
  reader.readAsText(file);

  // Reset input so the same file can be selected again
  event.target.value = '';
};

// Auto-backup: save a copy to localStorage every time data changes
VocabHackerApp.prototype._autoBackup = function() {
  const backup = {
    learned: this.learned,
    starred: this.starred,
    activity: this.activity,
    streak: this.streakData,
    srs: this.srsData || {},
    backupTime: Date.now()
  };
  localStorage.setItem('vh-auto-backup', JSON.stringify(backup));
};

// Simple toast notification
VocabHackerApp.prototype._showToast = function(message) {
  // Remove existing toast
  const existing = document.querySelector('.vh-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'vh-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('vh-toast-show'));

  // Auto remove after 3s
  setTimeout(() => {
    toast.classList.remove('vh-toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
};

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new VocabHackerApp();
  app._srsLoad();

  // Request persistent storage to prevent browser from evicting IndexedDB data
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // Try restoring from IndexedDB if localStorage was wiped
  VH_DB.init().then(() => {
    VH_DB.restoreIfNeeded(app);

    // Initial flush: sync current localStorage data to IndexedDB
    // in case saves happened before DB was ready
    if (Object.keys(app.learned).length > 0 || Object.keys(app.starred).length > 0) {
      VH_DB.save({
        learned: app.learned,
        starred: app.starred,
        activity: app.activity,
        streak: app.streakData,
        srs: app.srsData || {},
        theme: app.theme,
        savedAt: Date.now()
      });
    }
  });
});

// ==========================================
// IndexedDB Persistent Storage (auto, silent)
// ==========================================
const VH_DB = {
  db: null,
  DB_NAME: 'VocabHackerDB',
  STORE: 'appdata',
  KEY: 'all',

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(this.STORE);
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => resolve(); // fail silently
    });
  },

  save(data) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(data, this.KEY);
    } catch (e) { /* silent */ }
  },

  load() {
    if (!this.db) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(this.STORE, 'readonly');
        const req = tx.objectStore(this.STORE).get(this.KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },

  // If localStorage is empty but IndexedDB has data, restore it
  async restoreIfNeeded(app) {
    const hasLocal = Object.keys(app.learned).length > 0 ||
                     Object.keys(app.starred).length > 0 ||
                     Object.keys(app.srsData || {}).length > 0;

    if (hasLocal) {
      // localStorage is fine, mirror it to IndexedDB as backup
      this.save({
        learned: app.learned,
        starred: app.starred,
        activity: app.activity,
        streak: app.streakData,
        srs: app.srsData || {},
        theme: app.theme,
        savedAt: Date.now()
      });
      return;
    }

    // localStorage is empty — try IndexedDB
    const backup = await this.load();
    if (!backup || (!backup.learned && !backup.srs)) return;

    const backupLearnedCount = Object.keys(backup.learned || {}).length;
    const backupSrsCount = Object.keys(backup.srs || {}).length;
    if (backupLearnedCount === 0 && backupSrsCount === 0) return;

    // Restore silently
    if (backup.learned) {
      app.learned = backup.learned;
      localStorage.setItem('vh-learned', JSON.stringify(backup.learned));
    }
    if (backup.starred) {
      app.starred = backup.starred;
      localStorage.setItem('vh-starred', JSON.stringify(backup.starred));
    }
    if (backup.activity) {
      app.activity = backup.activity;
      localStorage.setItem('vh-activity', JSON.stringify(backup.activity));
    }
    if (backup.streak) {
      app.streakData = backup.streak;
      localStorage.setItem('vh-streak', JSON.stringify(backup.streak));
    }
    if (backup.srs) {
      app.srsData = backup.srs;
      localStorage.setItem('vh-srs', JSON.stringify(backup.srs));
    }

    // Refresh UI
    app.renderVocabGrid();
    app.populateDaysList();
    app.updateDashboard();
    app._showToast('🔄 Dữ liệu đã được tự động khôi phục!');
  }
};

// Hook into all save points to also persist to IndexedDB
(function() {
  const origSetItem = localStorage.setItem.bind(localStorage);
  let pendingSync = false;

  localStorage.setItem = function(key, value) {
    origSetItem(key, value);
    // After any vh- save, mirror everything to IndexedDB
    if (key.startsWith('vh-') && app && VH_DB.db) {
      // Debounce: batch rapid saves into one IndexedDB write
      if (!pendingSync) {
        pendingSync = true;
        setTimeout(() => {
          pendingSync = false;
          VH_DB.save({
            learned: JSON.parse(localStorage.getItem('vh-learned') || '{}'),
            starred: JSON.parse(localStorage.getItem('vh-starred') || '{}'),
            activity: JSON.parse(localStorage.getItem('vh-activity') || '[]'),
            streak: JSON.parse(localStorage.getItem('vh-streak') || '{}'),
            srs: JSON.parse(localStorage.getItem('vh-srs') || '{}'),
            theme: localStorage.getItem('vh-theme') || 'dark',
            savedAt: Date.now()
          });
        }, 500);
      }
    }
  };
})();

