const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sagasDir = path.join(rootDir, 'sagas');

function getManifest() {
  const sagas = {};
  if (!fs.existsSync(sagasDir)) return sagas;

  const sagaEntries = fs.readdirSync(sagasDir, { withFileTypes: true });
  for (const saga of sagaEntries) {
    if (!saga.isDirectory()) continue;
    const sagaKey = saga.name;
    const sagaPath = path.join(sagasDir, sagaKey);
    const booksDir = path.join(sagaPath, 'libros');

    sagas[sagaKey] = {
      id: sagaKey,
      title: sagaKey.replace(/_/g, ' ').toUpperCase(),
      books: {}
    };

    if (fs.existsSync(booksDir)) {
      const bookEntries = fs.readdirSync(booksDir, { withFileTypes: true });
      for (const book of bookEntries) {
        if (!book.isDirectory()) continue;
        const bookKey = book.name;
        const capDir = path.join(booksDir, bookKey, 'capitulos');

        sagas[sagaKey].books[bookKey] = {
          id: bookKey,
          title: bookKey.replace(/^\d+_/, '').replace(/_/g, ' ').toUpperCase(),
          chapters: []
        };

        if (fs.existsSync(capDir)) {
          const files = fs.readdirSync(capDir).filter(f => f.endsWith('.md'));

          // Orden cronológico natural: 0-prologo, 1-capitulo..., 16-capitulo..., epilogo...
          files.sort((a, b) => {
            const getNum = (name) => {
              if (name.startsWith('0-prologo')) return 0;
              if (name.startsWith('epilogo')) return 999;
              const m = name.match(/^(\d+)-/);
              return m ? parseInt(m[1], 10) : 500;
            };
            return getNum(a) - getNum(b);
          });

          sagas[sagaKey].books[bookKey].chapters = files.map(file => {
            let label = file.replace('.md', '');
            if (label.startsWith('0-prologo')) label = 'Prólogo: El precio del olvido';
            else if (label.startsWith('epilogo')) label = 'Epílogo: La sombra de los que esperan';
            else {
              label = label.replace(/^(\d+)-capitulo-/, 'Capítulo $1: ').replace(/_/g, ' ');
            }
            return {
              file,
              title: label
            };
          });
        }
      }
    }
  }
  return sagas;
}

module.exports = { getManifest, rootDir };
