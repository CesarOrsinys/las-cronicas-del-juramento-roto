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
    audioElement: new Audio(),
    engine: 'neural', // 'neural' (Azure Edge Server) | 'local' (WebSpeech fallback)
    neuralVoices: [
      { id: 'es-ES-AlvaroNeural', name: '✨ Álvaro (España - Narrador Cálido)' },
      { id: 'es-ES-RaquelNeural', name: '✨ Raquel (España - Narradora Expresiva)' },
      { id: 'es-MX-DaliaNeural', name: '✨ Dalia (México - Suave y Melódica)' },
      { id: 'es-MX-JorgeNeural', name: '✨ Jorge (México - Profundo)' },
      { id: 'es-CO-GonzaloNeural', name: '✨ Gonzalo (Colombia - Neutro)' },
      { id: 'es-AR-TomasNeural', name: '✨ Tomás (Argentina - Natural)' }
    ],
    selectedNeuralVoice: 'es-ES-AlvaroNeural',
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
// Motor TTS Híbrido: Azure Edge Neural (Servidor) + Fallback WebSpeech
// ==========================================================================
function initTts() {
  // Cargar catálogo de voces neuronales garantizadas de alta fidelidad
  loadNeuralAndLocalVoices();
}

function loadNeuralAndLocalVoices() {
  elTtsVoiceSelect.innerHTML = '';

  // 1. Añadir voces neuronales de Azure Edge (funcionan en cualquier móvil/navegador)
  const groupNeural = document.createElement('optgroup');
  groupNeural.label = '👑 Voces Neuronales Humanas (Streaming HD)';
  state.tts.neuralVoices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = `neural:${v.id}`;
    opt.textContent = v.name;
    groupNeural.appendChild(opt);
  });
  elTtsVoiceSelect.appendChild(groupNeural);

  // 2. Añadir voces locales del dispositivo como alternativa
  if ('speechSynthesis' in window) {
    const allVoices = window.speechSynthesis.getVoices() || [];
    const spanishVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith('es'));
    if (spanishVoices.length > 0) {
      const groupLocal = document.createElement('optgroup');
      groupLocal.label = '📱 Voces locales del navegador';
      spanishVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = `local:${v.voiceURI}`;
        opt.textContent = `${v.name} (${v.lang})`;
        groupLocal.appendChild(opt);
      });
      elTtsVoiceSelect.appendChild(groupLocal);
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        // Refrescar lista manteniendo la selección actual
        const currentVal = elTtsVoiceSelect.value;
        loadNeuralAndLocalVoices();
        if (currentVal) elTtsVoiceSelect.value = currentVal;
      };
    }
  }

  // Por defecto: Álvaro Neural (Narrador literario de España)
  elTtsVoiceSelect.value = 'neural:es-ES-AlvaroNeural';
  state.tts.engine = 'neural';
  state.tts.selectedNeuralVoice = 'es-ES-AlvaroNeural';
}

// Alternar reproducción / parada
function toggleTts() {
  if (state.tts.isPlaying) {
    stopTts();
  } else {
    startTts();
  }
}

// Iniciar lectura secuencial desde el marcapáginas o primer párrafo visible
function startTts() {
  stopTtsAudio();

  const pElements = Array.from(elStoryBody.querySelectorAll('p'));
  if (pElements.length === 0) return;

  state.tts.paragraphs = pElements;

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

// Leer un párrafo específico usando Azure Neural TTS o Local
function speakParagraph(index) {
  if (index >= state.tts.paragraphs.length) {
    stopTts();
    updateTtsStatus('Lectura del capítulo finalizada');
    return;
  }

  stopTtsAudio();

  // Limpiar resaltados previos
  state.tts.paragraphs.forEach(p => p.classList.remove('tts-active-paragraph'));

  const pEl = state.tts.paragraphs[index];
  pEl.classList.add('tts-active-paragraph');

  // Auto-scroll suave centrado en el párrafo leído
  pEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const textToRead = pEl.textContent.trim();
  if (!textToRead) {
    speakParagraph(index + 1);
    return;
  }

  updateTtsStatus(`Leyendo párrafo ${index + 1} de ${state.tts.paragraphs.length}`);

  // Verificar si usamos el motor neuronal de streaming o el local
  const voiceSelection = elTtsVoiceSelect ? elTtsVoiceSelect.value : 'neural:es-ES-AlvaroNeural';

  if (voiceSelection.startsWith('neural:')) {
    const voiceId = voiceSelection.replace('neural:', '');
    speakWithNeuralServer(textToRead, voiceId, index);
  } else {
    const voiceURI = voiceSelection.replace('local:', '');
    speakWithLocalSynth(textToRead, voiceURI, index);
  }
}

// Reproducción con Azure Neural TTS (Audio MP3 streaming del servidor)
function speakWithNeuralServer(text, voiceId, index) {
  state.tts.engine = 'neural';
  const audio = state.tts.audioElement;

  // Modulación de velocidad
  const rateParam = state.tts.rate;
  const url = `/api/tts?voice=${encodeURIComponent(voiceId)}&rate=${encodeURIComponent(rateParam)}&text=${encodeURIComponent(text)}`;

  audio.src = url;
  audio.playbackRate = 1.0;

  audio.onended = () => {
    if (state.tts.isPlaying && !state.tts.isPaused) {
      state.tts.currentParagraphIndex = index + 1;
      speakParagraph(index + 1);
    }
  };

  audio.onerror = (e) => {
    console.warn('Error en streaming neuronal, recurriendo a voz local:', e);
    // Fallback a síntesis local si falla la red
    speakWithLocalSynth(text, null, index);
  };

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn('Error iniciando audio neuronal:', err);
    });
  }
}

// Reproducción con WebSpeech local como respaldo
function speakWithLocalSynth(text, voiceURI, index) {
  state.tts.engine = 'local';
  if (!('speechSynthesis' in window)) return;

  const cleanText = text
    .replace(/—\s*/g, ', ')
    .replace(/\.{3}/g, '... ')
    .replace(/\s+/g, ' ');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = state.tts.rate * 0.95;
  utterance.pitch = 0.98;
  utterance.lang = 'es-ES';

  if (voiceURI) {
    const v = (window.speechSynthesis.getVoices() || []).find(x => x.voiceURI === voiceURI);
    if (v) utterance.voice = v;
  }

  utterance.onend = () => {
    if (state.tts.isPlaying && !state.tts.isPaused) {
      state.tts.currentParagraphIndex = index + 1;
      speakParagraph(index + 1);
    }
  };

  utterance.onerror = (e) => {
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
    if (state.tts.engine === 'neural') {
      state.tts.audioElement.play();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    state.tts.isPaused = false;
    elTtsPauseResumeBtn.textContent = '⏸️';
    elTtsPanel.classList.add('playing');
    updateTtsStatus(`Reanudando párrafo ${state.tts.currentParagraphIndex + 1}`);
  } else {
    // Pausar
    if (state.tts.engine === 'neural') {
      state.tts.audioElement.pause();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    state.tts.isPaused = true;
    elTtsPauseResumeBtn.textContent = '▶️';
    elTtsPanel.classList.remove('playing');
    updateTtsStatus('Lectura en pausa');
  }
}

// Detener audio
function stopTtsAudio() {
  if (state.tts.audioElement) {
    state.tts.audioElement.pause();
    state.tts.audioElement.removeAttribute('src');
    state.tts.audioElement.load();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function stopTts() {
  stopTtsAudio();

  state.tts.isPlaying = false;
  state.tts.isPaused = false;
  state.tts.currentParagraphIndex = 0;

  if (state.tts.paragraphs) {
    state.tts.paragraphs.forEach(p => p.classList.remove('tts-active-paragraph'));
  }

  if (elTtsPanel) elTtsPanel.classList.remove('playing');
  if (elTtsPlayBtn) elTtsPlayBtn.classList.remove('is-active');
  if (elTtsBtnLabel) elTtsBtnLabel.textContent = 'Escuchar';
  if (elTtsPauseResumeBtn) elTtsPauseResumeBtn.textContent = '⏸️';
  updateTtsStatus('Listo para leer con voz humana HD');
}

// Actualizar texto informativo de estado
function updateTtsStatus(msg) {
  if (elTtsStatusText) {
    elTtsStatusText.textContent = msg;
  }
}

// Lanzar al cargar
document.addEventListener('DOMContentLoaded', initApp);

