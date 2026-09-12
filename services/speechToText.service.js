async function transcribe(audio) {
  return { text: audio?.text || 'Mock transcription: no audio provider configured.' };
}

module.exports = { transcribe };
