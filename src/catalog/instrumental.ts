import type { GenreId, MoodId, Song } from '../data'

type InstrumentalProfile = 'serene' | 'melancholy' | 'hopeful' | 'reflective' | 'restless' | 'intense'
type ConcreteGenre = Exclude<GenreId, 'random'>
type InstrumentalSeed = readonly [
  title: string,
  artist: string,
  genres: readonly ConcreteGenre[],
  profile: InstrumentalProfile,
]

const profileDefaults: Record<
  InstrumentalProfile,
  { moods: MoodId[]; energy: number; reason: string; accent: [string, string] }
> = {
  serene: {
    moods: ['calm', 'tired'],
    energy: 0.22,
    reason: '没有人声打断思绪，舒缓的器乐线条让呼吸慢慢回到自己的节奏。',
    accent: ['#8da8a2', '#263743'],
  },
  melancholy: {
    moods: ['low', 'lonely'],
    energy: 0.3,
    reason: '克制的器乐旋律接住低落，不解释，也不催促，只给情绪留一处安静空间。',
    accent: ['#968797', '#293142'],
  },
  hopeful: {
    moods: ['happy', 'calm'],
    energy: 0.58,
    reason: '明亮的旋律在无人声的空间里自然舒展，让此刻多一点轻盈和开阔。',
    accent: ['#b39a68', '#33464b'],
  },
  reflective: {
    moods: ['unclear', 'calm'],
    energy: 0.42,
    reason: '层层展开的器乐声像一次不被打扰的回望，陪你把复杂感受慢慢理清。',
    accent: ['#8697a7', '#303442'],
  },
  restless: {
    moods: ['anxious', 'unclear'],
    energy: 0.64,
    reason: '流动的节拍承接停不下来的思绪，不需要歌词，也能让混乱逐渐找到秩序。',
    accent: ['#718f9d', '#27313e'],
  },
  intense: {
    moods: ['angry', 'anxious'],
    energy: 0.86,
    reason: '强烈的器乐推进为积压的能量打开出口，让情绪在安全的声场里得到释放。',
    accent: ['#a67662', '#282d3b'],
  },
}

function stableInstrumentalId(title: string, artist: string) {
  const source = `instrumental:${title}:${artist}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `instrumental-${(hash >>> 0).toString(36)}`
}

const instrumentalSeeds: InstrumentalSeed[] = [
  ['River Flows in You', 'Yiruma', ['light', 'classic'], 'serene'],
  ['Kiss the Rain', 'Yiruma', ['light', 'classic'], 'melancholy'],
  ['May Be', 'Yiruma', ['light', 'classic'], 'reflective'],
  ['Experience', 'Ludovico Einaudi', ['light', 'classic'], 'restless'],
  ['Una Mattina', 'Ludovico Einaudi', ['light', 'classic'], 'reflective'],
  ['I Giorni', 'Ludovico Einaudi', ['light', 'classic'], 'serene'],
  ["Comptine d'un autre été", 'Yann Tiersen', ['light', 'classic'], 'melancholy'],
  ["La valse d'Amélie", 'Yann Tiersen', ['light', 'classic'], 'hopeful'],
  ['Merry Christmas Mr. Lawrence', '坂本龍一', ['light', 'classic'], 'melancholy'],
  ['Energy Flow', '坂本龍一', ['light', 'classic'], 'serene'],
  ['Summer', '久石让', ['light', 'classic'], 'hopeful'],
  ['The Rain', '久石让', ['light', 'classic'], 'melancholy'],
  ['The Wind Forest', '久石让', ['light', 'classic'], 'serene'],
  ['The Path of the Wind', '久石让', ['light', 'classic'], 'hopeful'],
  ['Clair de lune', 'Claude Debussy', ['light', 'classic'], 'serene'],
  ['Arabesque No. 1', 'Claude Debussy', ['light', 'classic'], 'hopeful'],
  ['Gymnopédie No. 1', 'Erik Satie', ['light', 'classic'], 'serene'],
  ['Gnossienne No. 1', 'Erik Satie', ['light', 'classic'], 'reflective'],
  ['Nocturne Op. 9 No. 2', 'Frédéric Chopin', ['light', 'classic'], 'melancholy'],
  ['Prelude Op. 28 No. 15 “Raindrop”', 'Frédéric Chopin', ['light', 'classic'], 'reflective'],
  ['Prelude in C Major, BWV 846', 'Johann Sebastian Bach', ['light', 'classic'], 'serene'],
  ['Air on the G String', 'Johann Sebastian Bach', ['light', 'classic'], 'serene'],
  ['Moonlight Sonata: I. Adagio sostenuto', 'Ludwig van Beethoven', ['light', 'classic'], 'melancholy'],
  ['Für Elise', 'Ludwig van Beethoven', ['light', 'classic'], 'reflective'],
  ['Canon in D', 'Johann Pachelbel', ['light', 'classic'], 'hopeful'],
  ['The Four Seasons: Spring', 'Antonio Vivaldi', ['light', 'classic'], 'hopeful'],
  ['Eine kleine Nachtmusik', 'Wolfgang Amadeus Mozart', ['light', 'classic'], 'hopeful'],
  ['Adagio for Strings', 'Samuel Barber', ['light', 'classic'], 'melancholy'],
  ['Recuerdos de la Alhambra', 'Francisco Tárrega', ['light', 'classic'], 'serene'],
  ['Capricho Árabe', 'Francisco Tárrega', ['light', 'classic'], 'reflective'],
  ['Asturias (Leyenda)', 'Isaac Albéniz', ['light', 'classic'], 'intense'],
  ['Cavatina', 'Stanley Myers', ['light', 'classic'], 'serene'],
  ['Romance Anónimo', 'Anonymous', ['light', 'classic'], 'melancholy'],
  ['Europa (Earth’s Cry Heaven’s Smile)', 'Santana', ['light', 'rock'], 'intense'],
  ['Always with Me, Always with You', 'Joe Satriani', ['light', 'rock'], 'hopeful'],
  ['For the Love of God', 'Steve Vai', ['light', 'rock'], 'intense'],
  ['Apache', 'The Shadows', ['light', 'rock', 'classic'], 'hopeful'],
  ['Chariots of Fire', 'Vangelis', ['light', 'electronic', 'classic'], 'hopeful'],
  ['Time', 'Hans Zimmer', ['light', 'classic'], 'restless'],
  ['Cornfield Chase', 'Hans Zimmer', ['light', 'classic'], 'hopeful'],
  ['On the Nature of Daylight', 'Max Richter', ['light', 'classic'], 'melancholy'],
  ['Spiegel im Spiegel', 'Arvo Pärt', ['light', 'classic'], 'serene'],
  ['Arrival of the Birds', 'The Cinematic Orchestra', ['light', 'classic'], 'hopeful'],
  ['A Walk', 'Tycho', ['light', 'electronic'], 'serene'],
  ['Your Hand in Mine', 'Explosions in the Sky', ['light', 'rock'], 'hopeful'],
  ['Near Light', 'Ólafur Arnalds', ['light', 'electronic'], 'reflective'],
  ['Says', 'Nils Frahm', ['light', 'electronic'], 'restless'],
  ['I Can Almost See You', 'Hammock', ['light', 'rock'], 'serene'],
  ['Auto Rock', 'Mogwai', ['light', 'rock'], 'intense'],
]

export const instrumentalSongs: Song[] = instrumentalSeeds.map(
  ([title, artist, genres, profile]) => {
    const defaults = profileDefaults[profile]
    return {
      id: stableInstrumentalId(title, artist),
      title,
      artist,
      language: 'other',
      genres: [...genres],
      moods: [...defaults.moods],
      energy: defaults.energy,
      instrumental: true,
      reason: defaults.reason,
      accent: defaults.accent,
    }
  },
)
