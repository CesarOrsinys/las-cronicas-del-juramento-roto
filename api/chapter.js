const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { saga, book, chapter } = req.query;

  if (!saga || !book || !chapter) {
    return res.status(400).json({ error: 'Parámetros saga, book y chapter requeridos' });
  }

  const rootDir = process.cwd();
  // Sanitizar path para evitar directory traversal
  const safeChapter = path.basename(chapter);
  const safeBook = path.basename(book);
  const safeSaga = path.basename(saga);

  const filePath = path.join(rootDir, 'sagas', safeSaga, 'libros', safeBook, 'capitulos', safeChapter);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ content });
  } else {
    return res.status(404).json({ error: 'Capítulo no encontrado' });
  }
};
