const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const rootDir = process.cwd();
  const sagasDir = path.join(rootDir, 'sagas');
  const sagas = {};

  if (!fs.existsSync(sagasDir)) {
    return res.status(200).json(sagas);
  }

  const sagaEntries = fs.readdirSync(sagasDir, { withFileTypes: true });
  for (const saga of sagaEntries) {
    if (!saga.isDirectory()) continue;
    const sagaKey = saga.name;
    const booksDir = path.join(sagasDir, sagaKey, 'libros');

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
              const lines = text.split('\n');
              const firstHeading = lines.find(l => /^#{1,3}\s+(Capítulo|Prólogo|PRÓLOGO|Epílogo)/i.test(l)) || lines.find(l => /^#+\s+/.test(l));
              if (firstHeading) {
                title = firstHeading.replace(/^#+\s*/, '').trim();
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

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(sagas);
};
