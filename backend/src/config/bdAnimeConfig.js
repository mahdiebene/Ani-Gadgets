/**
 * Bangladesh-specific anime search configuration
 * 
 * This approach works better because:
 * 1. Uses locally popular anime names (not just current seasonal)
 * 2. Uses common search terms that BD sellers use
 * 3. Includes merchandise-specific keywords
 * 4. Covers both English and romanized names
 */

// Top anime that are ACTUALLY popular in Bangladesh market
const POPULAR_ANIME_BD = [
  {
    name: 'Naruto',
    aliases: ['Naruto', 'Naruto Shippuden', 'Boruto'],
    characters: ['Naruto', 'Sasuke', 'Kakashi', 'Itachi', 'Akatsuki', 'Hinata', 'Minato'],
    priority: 1
  },
  {
    name: 'Dragon Ball',
    aliases: ['Dragon Ball', 'Dragon Ball Z', 'DBZ', 'Goku'],
    characters: ['Goku', 'Vegeta', 'Gohan', 'Frieza', 'Broly', 'Trunks', 'Piccolo'],
    priority: 1
  },
  {
    name: 'One Piece',
    aliases: ['One Piece', 'Onepiece'],
    characters: ['Luffy', 'Zoro', 'Sanji', 'Nami', 'Chopper', 'Ace', 'Law', 'Shanks'],
    priority: 1
  },
  {
    name: 'Attack on Titan',
    aliases: ['Attack on Titan', 'AOT', 'Shingeki no Kyojin'],
    characters: ['Eren', 'Levi', 'Mikasa', 'Titan', 'Survey Corps'],
    priority: 1
  },
  {
    name: 'Demon Slayer',
    aliases: ['Demon Slayer', 'Kimetsu no Yaiba'],
    characters: ['Tanjiro', 'Nezuko', 'Zenitsu', 'Inosuke', 'Hashira', 'Rengoku', 'Muzan'],
    priority: 1
  },
  {
    name: 'Jujutsu Kaisen',
    aliases: ['Jujutsu Kaisen', 'JJK'],
    characters: ['Gojo', 'Itadori', 'Sukuna', 'Megumi', 'Nobara', 'Todo'],
    priority: 1
  },
  {
    name: 'My Hero Academia',
    aliases: ['My Hero Academia', 'MHA', 'Boku no Hero'],
    characters: ['Deku', 'Bakugo', 'Todoroki', 'All Might', 'Endeavor'],
    priority: 2
  },
  {
    name: 'Death Note',
    aliases: ['Death Note', 'Deathnote'],
    characters: ['Light', 'L', 'Ryuk', 'Kira', 'Misa'],
    priority: 2
  },
  {
    name: 'Tokyo Revengers',
    aliases: ['Tokyo Revengers'],
    characters: ['Mikey', 'Draken', 'Takemichi'],
    priority: 2
  },
  {
    name: 'Spy x Family',
    aliases: ['Spy x Family', 'Spy Family'],
    characters: ['Anya', 'Loid', 'Yor', 'Bond'],
    priority: 1
  },
  {
    name: 'Chainsaw Man',
    aliases: ['Chainsaw Man'],
    characters: ['Denji', 'Makima', 'Power', 'Pochita'],
    priority: 2
  },
  {
    name: 'Solo Leveling',
    aliases: ['Solo Leveling'],
    characters: ['Sung Jin Woo', 'Shadow Monarch'],
    priority: 2
  },
  {
    name: 'One Punch Man',
    aliases: ['One Punch Man', 'OPM'],
    characters: ['Saitama', 'Genos'],
    priority: 2
  },
  {
    name: 'Bleach',
    aliases: ['Bleach'],
    characters: ['Ichigo', 'Rukia', 'Aizen', 'Hollow'],
    priority: 2
  },
  {
    name: 'Hunter x Hunter',
    aliases: ['Hunter x Hunter', 'HxH'],
    characters: ['Gon', 'Killua', 'Hisoka', 'Kurapika'],
    priority: 2
  },
  {
    name: 'Fullmetal Alchemist',
    aliases: ['Fullmetal Alchemist', 'FMA'],
    characters: ['Edward', 'Alphonse', 'Roy Mustang'],
    priority: 3
  },
  {
    name: 'Pokemon',
    aliases: ['Pokemon', 'Pikachu'],
    characters: ['Pikachu', 'Ash', 'Charizard', 'Mewtwo', 'Eevee'],
    priority: 1
  },
  {
    name: 'Doraemon',
    aliases: ['Doraemon'],
    characters: ['Doraemon', 'Nobita'],
    priority: 2
  },
  {
    name: 'Haikyuu',
    aliases: ['Haikyuu', 'Haikyu'],
    characters: ['Hinata', 'Kageyama', 'Oikawa'],
    priority: 3
  },
  {
    name: 'Sword Art Online',
    aliases: ['Sword Art Online', 'SAO'],
    characters: ['Kirito', 'Asuna'],
    priority: 3
  }
];

// Common product types that sell well in BD
const PRODUCT_TYPES = [
  'figure',
  'action figure',
  'poster',
  't-shirt',
  'tshirt',
  'hoodie',
  'keychain',
  'lamp',
  'led lamp',
  'mug',
  'bag',
  'backpack',
  'phone case',
  'wallet',
  'cap',
  'mask',
  'sticker',
  'mousepad',
  'plush',
  'toy'
];

// Generic anime search terms that work well on Daraz BD
const GENERIC_ANIME_SEARCHES = [
  'anime figure',
  'anime poster',
  'anime t-shirt',
  'anime hoodie',
  'anime keychain',
  'anime lamp',
  'anime led lamp',
  'anime mug',
  'anime action figure',
  'anime backpack',
  'anime wallet',
  'manga',
  'japanese figure',
  'chibi figure',
  'funko pop anime'
];

/**
 * Generate optimized search keywords for Bangladesh market
 */
function generateBDSearchKeywords() {
  const keywords = [];
  
  // Priority 1: Generic anime searches (highest volume)
  GENERIC_ANIME_SEARCHES.forEach(term => {
    keywords.push({ term, priority: 0, source: 'generic' });
  });
  
  // Priority 2: Popular anime + product type combinations
  POPULAR_ANIME_BD.forEach(anime => {
    // Main anime name + popular product types
    ['figure', 'poster', 't-shirt', 'keychain', 'lamp'].forEach(product => {
      keywords.push({
        term: `${anime.name} ${product}`,
        priority: anime.priority,
        source: 'anime',
        anime: anime.name
      });
    });
    
    // Character-specific searches for top anime
    if (anime.priority === 1) {
      anime.characters.slice(0, 3).forEach(character => {
        keywords.push({
          term: `${character} figure`,
          priority: anime.priority,
          source: 'character',
          anime: anime.name,
          character
        });
      });
    }
  });
  
  // Sort by priority (lower = higher priority)
  keywords.sort((a, b) => a.priority - b.priority);
  
  return keywords;
}

/**
 * Get anime info from search result product name
 * Compatibility entry point; matching is maintained in ingest/animeMatcher.
 */
function detectAnimeFromProductName(productName) {
  return require('../ingest/animeMatcher').matchAnime(productName);
}

module.exports = {
  POPULAR_ANIME_BD,
  PRODUCT_TYPES,
  GENERIC_ANIME_SEARCHES,
  generateBDSearchKeywords,
  detectAnimeFromProductName
};
