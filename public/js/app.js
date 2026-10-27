// Estado de la aplicación
const state = {
  manifest: null,
  currentSaga: null,
  currentBook: null,
  currentChapterIndex: 0,
  fontSize: 18,
  theme: 'dark', // dark | sepia | light
  // TTS State
  tts: {
    synth: window.speechSynthesis || null,
    voices: [],
    selectedVoice: null,
    rate: 1.0,
    isPlaying: false,
    isPaused: false,
    paragraphs: [],
    currentParagraphIndex: 0,
    currentUtterance: null
  }
};

// Elementos del DOM
const elSagaSelect = document.getElementById('sagaSelect');
const elBookSelect = document.getElementById('bookSelect');
const elChapterSelect = document.getElementById('chapterSelect');
const elChapterTitle = document.getElementById('chapterTitle');
const elStoryBody = document.getElementById('storyBody');
const elChapterBadge = document.getElementById('chapterBadge');
const elReadingTime = document.getElementById('readingTime');
const elProgressBar = document.getElementById('readingProgress');
const elPrevBtn = document.getElementById('prevChapterBtn');
const elNextBtn = document.getElementById('nextChapterBtn');
const elChapterCounter = document.getElementById('chapterCounter');

// Elementos TTS
const elTtsPlayBtn = document.getElementById('ttsPlayBtn');
const elTtsBtnLabel = document.getElementById('ttsBtnLabel');
const elTtsPanel = document.getElementById('ttsPanel');
const elTtsPauseResumeBtn = document.getElementById('ttsPauseResumeBtn');
const elTtsStopBtn = document.getElementById('ttsStopBtn');
const elTtsRateSelect = document.getElementById('ttsRateSelect');
const elTtsVoiceSelect = document.getElementById('ttsVoiceSelect');
const elTtsCloseBtn = document.getElementById('ttsCloseBtn');
const elTtsStatusText = document.getElementById('ttsStatusText');

// Inicialización
async function initApp() {
  setupEventListeners();
  loadPreferences();
  initTts();
  await fetchManifest();
}

// Cargar preferencias guardadas en LocalStorage
function loadPreferences() {
  const savedTheme = localStorage.getItem('wattpad_theme');
  if (savedTheme) setTheme(savedTheme);

  const savedSize = localStorage.getItem('wattpad_fontsize');
  if (savedSize) setFontSize(parseInt(savedSize, 10));
}

// Cargar árbol de sagas, libros y capítulos desde el backend
async function fetchManifest() {
  try {
    const res = await fetch('/api/manifest');
    state.manifest = await res.json();
    populateSagas();
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    elStoryBody.innerHTML = '<p class="error-msg">Error conectando con la biblioteca de sagas.</p>';
  }
}

// Poblar selector de sagas
function populateSagas() {
  elSagaSelect.innerHTML = '';
  const sagaKeys = Object.keys(state.manifest);
  if (sagaKeys.length === 0) return;

  sagaKeys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = state.manifest[key].title;
    elSagaSelect.appendChild(opt);
  });

  // Seleccionar la primera o la guardada
  const savedSaga = localStorage.getItem('wattpad_last_saga');
  state.currentSaga = (savedSaga && state.manifest[savedSaga]) ? savedSaga : sagaKeys[0];
  elSagaSelect.value = state.currentSaga;

  populateBooks();
}

// Poblar selector de libros
function populateBooks() {
  elBookSelect.innerHTML = '';
  const saga = state.manifest[state.currentSaga];
  if (!saga || !saga.books) return;

  const bookKeys = Object.keys(saga.books);
  if (bookKeys.length === 0) return;

  bookKeys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = saga.books[key].title;
    elBookSelect.appendChild(opt);
  });

  const savedBook = localStorage.getItem('wattpad_last_book');
  state.currentBook = (savedBook && saga.books[savedBook]) ? savedBook : bookKeys[0];
  elBookSelect.value = state.currentBook;

  populateChapters();
}

// Poblar selector de capítulos
function populateChapters() {
  elChapterSelect.innerHTML = '';
  const book = state.manifest[state.currentSaga].books[state.currentBook];
  if (!book || !book.chapters || book.chapters.length === 0) {
    elStoryBody.innerHTML = '<p>No hay capítulos redactados en este libro todavía.</p>';
    return;
  }

  book.chapters.forEach((chap, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = chap.title;
    elChapterSelect.appendChild(opt);
  });

  const savedChapterIdx = localStorage.getItem('wattpad_last_chapter_idx');
  const targetIdx = (savedChapterIdx !== null && book.chapters[savedChapterIdx]) ? parseInt(savedChapterIdx, 10) : 0;
  loadChapter(targetIdx);
}

// Cargar y renderizar un capítulo
async function loadChapter(index) {
  stopTts();
  const book = state.manifest[state.currentSaga].books[state.currentBook];
  if (!book || !book.chapters[index]) return;

  state.currentChapterIndex = index;
  elChapterSelect.value = index;

  // Guardar estado en localStorage
  localStorage.setItem('wattpad_last_saga', state.currentSaga);
  localStorage.setItem('wattpad_last_book', state.currentBook);
  localStorage.setItem('wattpad_last_chapter_idx', index);

  const chapter = book.chapters[index];
  elChapterBadge.textContent = state.manifest[state.currentSaga].title;
  elChapterTitle.textContent = chapter.title;
  elChapterCounter.textContent = `${index + 1} de ${book.chapters.length}`;

  // Actualizar botones de navegación
  elPrevBtn.disabled = (index <= 0);
  elNextBtn.disabled = (index >= book.chapters.length - 1);

  elStoryBody.innerHTML = '<p style="text-align:center; color:var(--text-dim);">Cargando pergamino...</p>';

  try {
    const res = await fetch(`/api/chapter?saga=${state.currentSaga}&book=${state.currentBook}&chapter=${chapter.file}`);
    const data = await res.json();
    if (data.content) {
      renderMarkdown(data.content);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      elStoryBody.innerHTML = '<p>No se pudo cargar el texto del capítulo.</p>';
    }
  } catch (err) {
    console.error('Error cargando capítulo:', err);
    elStoryBody.innerHTML = '<p class="error-msg">Error de conexión al cargar el texto.</p>';
  }
}

// Convertidor ligero y elegante de Markdown a HTML para lectura limpia
function renderMarkdown(md) {
  // Limpiar título h1 duplicado si ya lo mostramos arriba
  let cleanMd = md.replace(/^#\s+[^\n]+\n/m, '');

  // Calcular tiempo de lectura estimado
  const wordCount = md.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 220); // 220 palabras por minuto
  elReadingTime.textContent = `~${minutes} min de lectura (${wordCount.toLocaleString()} palabras)`;

  // Parseo de bloques básicos
  const lines = cleanMd.split('\n');
  let html = '';
  let inBlockquote = false;

  for (let line of lines) {
    line = line.trim();

    // Separadores
    if (line === '---' || line === '***') {
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      html += '<hr>';
      continue;
    }

    // Encabezados h2, h3
    if (line.startsWith('## ')) {
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      html += `<h2 style="font-family:var(--font-serif); margin:2rem 0 1rem; color:var(--accent-orange);">${line.substring(3)}</h2>`;
      continue;
    }
    if (line.startsWith('### ')) {
      if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
      html += `<h3 style="font-family:var(--font-serif); margin:1.5rem 0 0.8rem;">${line.substring(4)}</h3>`;
      continue;
    }

    // Citas o pensamientos
    if (line.startsWith('> ')) {
      if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
      html += `<p>${formatInline(line.substring(2))}</p>`;
      continue;
    } else if (inBlockquote && line === '') {
      html += '</blockquote>';
      inBlockquote = false;
      continue;
    }

    // Párrafos normales
    if (line.length > 0) {
      html += `<p class="story-paragraph" data-p-index="">${formatInline(line)}</p>`;
    }
  }

  if (inBlockquote) html += '</blockquote>';
  elStoryBody.innerHTML = html;

  // Enumerar párrafos reales y restaurar marcapáginas si existe
  setupParagraphBookmarks();
}

// Formateo en línea (negritas, cursivas, diálogos y guiones largos)
function formatInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/—\s*/g, '— '); // Asegurar espacio tras raya de diálogo
}

// ==========================================================================
// Marcapáginas persistente (LocalStorage + SessionStorage)
// ==========================================================================
function getBookmarkKey() {
  return `bookmark_${state.currentSaga}_${state.currentBook}_${state.currentChapterIndex}`;
}

function setupParagraphBookmarks() {
  const pList = Array.from(elStoryBody.querySelectorAll('p'));
  pList.forEach((p, idx) => {
    p.setAttribute('data-p-index', idx);

    // Evento Click / Tap para móviles y escritorio: poner marcapáginas
    p.addEventListener('click', (e) => {
      // Guardar marcapáginas en localStorage y sessionStorage
      saveBookmark(idx, p);
      
      // Si el TTS está reproduciendo o se quiere iniciar desde aquí
      if (state.tts.isPlaying) {
        state.tts.currentParagraphIndex = idx;
        speakParagraph(idx);
      }
    });
  });

  // Restaurar marcapáginas previo si existe para este capítulo
  restoreChapterBookmark(pList);
}

function saveBookmark(paragraphIndex, targetElement) {
  const bookmarkData = {
    saga: state.currentSaga,
    book: state.currentBook,
    chapterIndex: state.currentChapterIndex,
    paragraphIndex: paragraphIndex,
    snippet: targetElement ? targetElement.textContent.trim().substring(0, 60) : '',
    timestamp: Date.now()
  };

  // Guardar tanto en localStorage (persistencia indefinida) como en sessionStorage (sesión actual)
  const key = getBookmarkKey();
  localStorage.setItem(key, JSON.stringify(bookmarkData));
  sessionStorage.setItem(key, JSON.stringify(bookmarkData));

  // Guardar también como último marcapáginas global de lectura
  localStorage.setItem('wattpad_last_global_bookmark', JSON.stringify(bookmarkData));

  // Indicador visual del marcapáginas en el DOM
  highlightBookmark(paragraphIndex);
  showBookmarkNotification(`🔖 Marcapáginas guardado en párrafo ${paragraphIndex + 1}`);
}

function highlightBookmark(paragraphIndex) {
  const pList = elStoryBody.querySelectorAll('p');
  pList.forEach(p => p.classList.remove('user-bookmark'));
  const target = pList[paragraphIndex];
  if (target) {
    target.classList.add('user-bookmark');
  }
}

function restoreChapterBookmark(pList) {
  const key = getBookmarkKey();
  const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    const idx = data.paragraphIndex;
    if (idx !== undefined && pList[idx]) {
      highlightBookmark(idx);
      
      // Auto-desplazar suavemente hasta el párrafo marcado
      setTimeout(() => {
        pList[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);

      // Si el usuario presiona "Escuchar", arrancará desde este marcapáginas
      state.tts.currentParagraphIndex = idx;
    }
  } catch (err) {
    console.error('Error restaurando marcapáginas:', err);
  }
}

// Pequeño aviso visual flotante de confirmación
function showBookmarkNotification(msg) {
  let notif = document.getElementById('bookmarkNotif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'bookmarkNotif';
    notif.className = 'bookmark-toast';
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  notif.classList.add('show');
  clearTimeout(notif._timer);
  notif._timer = setTimeout(() => {
    notif.classList.remove('show');
  }, 2200);
}

// Configuración de temas
function setTheme(theme) {
  state.theme = theme;
  document.body.className = '';
  if (theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`);
  }
  localStorage.setItem('wattpad_theme', theme);
}

// Configuración de tamaño de fuente
function setFontSize(deltaOrSize) {
  if (typeof deltaOrSize === 'number' && deltaOrSize > 25) {
    state.fontSize = deltaOrSize;
  } else {
    state.fontSize = Math.min(26, Math.max(14, state.fontSize + deltaOrSize));
  }
  elStoryBody.style.fontSize = `${state.fontSize}px`;
  localStorage.setItem('wattpad_fontsize', state.fontSize);
}

// Listeners y eventos
function setupEventListeners() {
  // Selectores en cascada
  elSagaSelect.addEventListener('change', (e) => {
    state.currentSaga = e.target.value;
    populateBooks();
  });

  elBookSelect.addEventListener('change', (e) => {
    state.currentBook = e.target.value;
    populateChapters();
  });

  elChapterSelect.addEventListener('change', (e) => {
    loadChapter(parseInt(e.target.value, 10));
  });

  // Botones de anterior y siguiente (Estilo Wattpad)
  elPrevBtn.addEventListener('click', () => {
    if (state.currentChapterIndex > 0) {
      loadChapter(state.currentChapterIndex - 1);
    }
  });

  elNextBtn.addEventListener('click', () => {
    const book = state.manifest[state.currentSaga].books[state.currentBook];
    if (state.currentChapterIndex < book.chapters.length - 1) {
      loadChapter(state.currentChapterIndex + 1);
    }
  });

  // Control de fuentes
  document.getElementById('zoomInBtn').addEventListener('click', () => setFontSize(2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => setFontSize(-2));

  // Temas (Oscuro, Sepia, Claro)
  document.getElementById('themeBtn').addEventListener('click', () => {
    const themes = ['dark', 'sepia', 'light'];
    const nextIdx = (themes.indexOf(state.theme) + 1) % themes.length;
    setTheme(themes[nextIdx]);
  });

  // Barra de progreso según scroll
  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0) {
      const progress = (window.scrollY / totalHeight) * 100;
      elProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  });

  // Listeners de Audio y TTS (Texto a Voz Accesible)
  if (elTtsPlayBtn) {
    elTtsPlayBtn.addEventListener('click', toggleTts);
  }
  if (elTtsPauseResumeBtn) {
    elTtsPauseResumeBtn.addEventListener('click', pauseResumeTts);
  }
  if (elTtsStopBtn) {
    elTtsStopBtn.addEventListener('click', stopTts);
  }
  if (elTtsCloseBtn) {
    elTtsCloseBtn.addEventListener('click', () => {
      stopTts();
      elTtsPanel.hidden = true;
    });
  }
  if (elTtsRateSelect) {
    elTtsRateSelect.addEventListener('change', (e) => {
      state.tts.rate = parseFloat(e.target.value);
      if (state.tts.isPlaying && !state.tts.isPaused) {
        // Reiniciar párrafo actual con la nueva velocidad
        speakParagraph(state.tts.currentParagraphIndex);
      }
    });
  }
  if (elTtsVoiceSelect) {
    elTtsVoiceSelect.addEventListener('change', (e) => {
      const voiceURI = e.target.value;
      state.tts.selectedVoice = state.tts.voices.find(v => v.voiceURI === voiceURI) || null;
      if (state.tts.isPlaying && !state.tts.isPaused) {
        speakParagraph(state.tts.currentParagraphIndex);
      }
    });
  }
}

// ==========================================================================
// Motor de Accesibilidad TTS (Web Speech API Nativa y Gratuita)
// ==========================================================================
function initTts() {
  if (!('speechSynthesis' in window)) {
    if (elTtsPlayBtn) {
      elTtsPlayBtn.style.display = 'none';
    }
    return;
  }

  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Cargar catálogo de voces instaladas en el navegador/dispositivo
function loadVoices() {
  const allVoices = window.speechSynthesis.getVoices();
  if (!allVoices || allVoices.length === 0) return;

  state.tts.voices = allVoices;

  // Filtrar o priorizar voces en español (es-ES, es-MX, es-419, etc.)
  const spanishVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith('es'));
  const voicesPool = spanishVoices.length > 0 ? spanishVoices : allVoices;

  // Función para calificar qué tan natural es una voz
  const getNaturalScore = (voice) => {
    const name = voice.name.toLowerCase();
    let score = 0;
    // Voces Neural / Natural de Edge y Windows (las de mayor realismo humano)
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 100;
    // Voces Google de Chrome en Android/PC (alta calidad)
    if (name.includes('google')) score += 50;
    // Voces Microsoft de escritorio modernas (Helena, Sabina, Álvaro, Jorge)
    if (name.includes('microsoft')) score += 30;
    // Si no es sintetizador sintético básico antiguo
    if (!name.includes('desktop') && !name.includes('mobile')) score += 10;
    return score;
  };

  // Ordenar de mayor a menor calidad/naturalidad
  voicesPool.sort((a, b) => getNaturalScore(b) - getNaturalScore(a));

  elTtsVoiceSelect.innerHTML = '';
  voicesPool.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    const isNatural = getNaturalScore(v) >= 30 ? '✨ ' : '';
    opt.textContent = `${isNatural}${v.name} (${v.lang})`;
    elTtsVoiceSelect.appendChild(opt);
  });

  // Elegir por defecto la voz de máxima calidad detectada
  state.tts.selectedVoice = voicesPool[0];
  if (state.tts.selectedVoice) {
    elTtsVoiceSelect.value = state.tts.selectedVoice.voiceURI;
  }
}

// Alternar reproducción / parada
function toggleTts() {
  if (!('speechSynthesis' in window)) {
    alert('Tu navegador no soporta síntesis de voz (Web Speech API).');
    return;
  }

  if (state.tts.isPlaying) {
    stopTts();
  } else {
    startTts();
  }
}

// Iniciar lectura secuencial desde el marcapáginas o primer párrafo visible
function startTts() {
  window.speechSynthesis.cancel();

  // Obtener todos los párrafos de la historia
  const pElements = Array.from(elStoryBody.querySelectorAll('p'));
  if (pElements.length === 0) return;

  state.tts.paragraphs = pElements;

  // Si existe un marcapáginas previo restaurado, arrancar desde ahí
  let startIndex = state.tts.currentParagraphIndex || 0;
  if (startIndex < 0 || startIndex >= pElements.length) {
    startIndex = 0;
  }
  state.tts.currentParagraphIndex = startIndex;
  state.tts.isPlaying = true;
  state.tts.isPaused = false;

  elTtsPanel.hidden = false;
  elTtsPanel.classList.add('playing');
  elTtsPlayBtn.classList.add('is-active');
  elTtsBtnLabel.textContent = 'Detener';
  elTtsPauseResumeBtn.textContent = '⏸️';

  speakParagraph(startIndex);
}

// Leer un párrafo específico y resaltar visualmente
function speakParagraph(index) {
  if (index >= state.tts.paragraphs.length) {
    stopTts();
    updateTtsStatus('Lectura del capítulo finalizada');
    return;
  }

  window.speechSynthesis.cancel();

  // Limpiar resaltados previos
  state.tts.paragraphs.forEach(p => p.classList.remove('tts-active-paragraph'));

  const pEl = state.tts.paragraphs[index];
  pEl.classList.add('tts-active-paragraph');

  // Auto-scroll suave para personas con visión reducida
  pEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const textToRead = pEl.textContent.trim();
  if (!textToRead) {
    // Si el párrafo está vacío, avanzar al siguiente
    speakParagraph(index + 1);
    return;
  }

  updateTtsStatus(`Leyendo párrafo ${index + 1} de ${state.tts.paragraphs.length}`);

  // Preprocesar el texto para pausas literarias más naturales (puntos suspensivos, comas y guiones largos)
  const cleanText = textToRead
    .replace(/—\s*/g, ', ') // Convertir guiones de diálogo en pausas respiratorias
    .replace(/\.{3}/g, '... ') // Pausa en puntos suspensivos
    .replace(/\s+/g, ' ');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = state.tts.rate * 0.95; // Ligera modulación para evitar atropello robótico
  utterance.pitch = 0.98; // Tono ligeramente más cálido y humano
  utterance.lang = state.tts.selectedVoice ? state.tts.selectedVoice.lang : 'es-ES';
  if (state.tts.selectedVoice) {
    utterance.voice = state.tts.selectedVoice;
  }

  utterance.onend = () => {
    if (state.tts.isPlaying && !state.tts.isPaused) {
      state.tts.currentParagraphIndex = index + 1;
      speakParagraph(index + 1);
    }
  };

  utterance.onerror = (e) => {
    console.warn('TTS Utterance error:', e);
    if (state.tts.isPlaying && !state.tts.isPaused) {
      state.tts.currentParagraphIndex = index + 1;
      speakParagraph(index + 1);
    }
  };

  state.tts.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

// Pausar o reanudar
function pauseResumeTts() {
  if (!state.tts.isPlaying) return;

  if (state.tts.isPaused) {
    // Reanudar
    window.speechSynthesis.resume();
    state.tts.isPaused = false;
    elTtsPauseResumeBtn.textContent = '⏸️';
    elTtsPanel.classList.add('playing');
    updateTtsStatus(`Reanudando párrafo ${state.tts.currentParagraphIndex + 1}`);
  } else {
    // Pausar
    window.speechSynthesis.pause();
    state.tts.isPaused = true;
    elTtsPauseResumeBtn.textContent = '▶️';
    elTtsPanel.classList.remove('playing');
    updateTtsStatus('Lectura en pausa');
  }
}

// Detener por completo la síntesis de voz
function stopTts() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  state.tts.isPlaying = false;
  state.tts.isPaused = false;
  state.tts.currentParagraphIndex = 0;

  if (state.tts.paragraphs) {
    state.tts.paragraphs.forEach(p => p.classList.remove('tts-active-paragraph'));
  }

  if (elTtsPanel) {
    elTtsPanel.classList.remove('playing');
  }
  if (elTtsPlayBtn) {
    elTtsPlayBtn.classList.remove('is-active');
  }
  if (elTtsBtnLabel) {
    elTtsBtnLabel.textContent = 'Escuchar';
  }
  if (elTtsPauseResumeBtn) {
    elTtsPauseResumeBtn.textContent = '⏸️';
  }
  updateTtsStatus('Listo para leer en voz alta');
}

// Actualizar texto informativo de estado
function updateTtsStatus(msg) {
  if (elTtsStatusText) {
    elTtsStatusText.textContent = msg;
  }
}

// Lanzar al cargar
document.addEventListener('DOMContentLoaded', initApp);

