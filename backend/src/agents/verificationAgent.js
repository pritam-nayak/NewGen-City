function verifyClosure({ resolutionNote, evidenceUrl }) {
  return Boolean(
    (typeof resolutionNote === 'string' && resolutionNote.trim()) ||
    (typeof evidenceUrl === 'string' && /^https?:\/\/\S+$/i.test(evidenceUrl))
  );
}

module.exports = { verifyClosure };
