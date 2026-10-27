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
            const filePath = path.join(capDir, file);
            let title = '';
            try {
              const text = fs.readFileSync(filePath, 'utf-8');
              const firstHeading = text.split('\n').find(l => l.startsWith('# '));
              if (firstHeading) {
                title = firstHeading.replace('# ', '').trim();
              }
            } catch (e) {}

            if (!title) {
              let label = file.replace('.md', '');
              if (label.startsWith('0-prologo')) label = 'Prólogo';
              else if (label.startsWith('epilogo')) label = 'Epílogo';
              else {
                label = label.replace(/^(\d+)-capitulo-/, 'Capítulo $1: ').replace(/_/g, ' ');
              }
              title = label;
            }

            return {
              file,
              title
            };
          });
        }
      }
    }
  }
  return sagas;
}

module.exports = { getManifest, rootDir };
