// Estado de la aplicación
const state = {
  manifest: null,
  currentSaga: null,
  currentBook: null,
  currentChapterIndex: 0,
  fontSize: 18,
  theme: 'dark' // dark | sepia | light
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

// Inicialización
async function initApp() {
  setupEventListeners();
  loadPreferences();
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
      html += `<p>${formatInline(line)}</p>`;
    }
  }

  if (inBlockquote) html += '</blockquote>';
  elStoryBody.innerHTML = html;
}

// Formateo en línea (negritas, cursivas, diálogos y guiones largos)
function formatInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/—\s*/g, '— '); // Asegurar espacio tras raya de diálogo
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

  // Atajos de teclado (Flechas izquierda y derecha para cambiar capítulo)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') elNextBtn.click();
    if (e.key === 'ArrowLeft') elPrevBtn.click();
  });
}

// Lanzar al cargar
document.addEventListener('DOMContentLoaded', initApp);
