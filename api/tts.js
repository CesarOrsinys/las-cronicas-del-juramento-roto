const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

module.exports = async (req, res) => {
  // Configurar CORS y cabeceras
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const text = req.query.text || (req.body && req.body.text);
  const voice = req.query.voice || (req.body && req.body.voice) || 'es-ES-AlvaroNeural';
  const rate = req.query.rate || (req.body && req.body.rate) || '0%';

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Parámetro text requerido' });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Ajustar opciones si se solicita velocidad
    const options = {};
    if (rate && rate !== '1' && rate !== '0%') {
      options.rate = rate.toString().includes('%') ? rate : `${Math.round((parseFloat(rate) - 1) * 100)}%`;
    }

    const { audioStream } = tts.toStream(text, options);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400'); // Cacheable 24h

    audioStream.pipe(res);

    audioStream.on('error', (err) => {
      console.error('Error en audioStream de EdgeTTS:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error transmitiendo audio neuronal' });
      }
    });

  } catch (error) {
    console.error('Error generando TTS neuronal:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error conectando con Edge Neural TTS' });
    }
  }
};
