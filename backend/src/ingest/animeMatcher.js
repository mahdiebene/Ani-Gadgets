const { POPULAR_ANIME_BD } = require('../config/bdAnimeConfig');

const ambiguous = new Set(['light', 'ace', 'law', 'power', 'bond', 'ash', 'titan', 'hollow', 'trunks', 'bleach']);
const normalizeText = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const contains = (text, token) => (` ${text} `).includes(` ${normalizeText(token)} `);

function matchAnime(productName) {
  const text = normalizeText(productName);
  const animeContext = /\b(anime|manga|otaku|cosplay)\b/.test(text);
  // Explicit series aliases win over character names from other series.
  for (const anime of POPULAR_ANIME_BD) {
    for (const alias of anime.aliases) {
      if (normalizeText(alias).length < 3 || (ambiguous.has(normalizeText(alias)) && !animeContext)) continue;
      if (contains(text, alias)) return { name: anime.name, matched: alias, priority: anime.priority };
    }
  }
  for (const anime of POPULAR_ANIME_BD) {
    for (const character of anime.characters) {
      const token = normalizeText(character);
      if (token.length < 3 || (ambiguous.has(token) && !animeContext)) continue;
      if (contains(text, token)) return { name: anime.name, matched: character, character, priority: anime.priority };
    }
  }
  return animeContext ? { name: 'Anime', matched: 'generic', priority: 5 } : null;
}

module.exports = { matchAnime, normalizeText };