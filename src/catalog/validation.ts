import type { GenreId, LanguageId, MoodId, Song } from '../data'

const concreteLanguages: Exclude<LanguageId, 'random'>[] = [
  'mandarin',
  'cantonese',
  'english',
  'french',
  'japanese',
  'korean',
  'other',
]

const concreteGenres: Exclude<GenreId, 'random'>[] = [
  'pop',
  'rock',
  'rnb',
  'folk',
  'blues',
  'classic',
  'light',
  'electronic',
  'rap',
]

const moods: MoodId[] = ['happy', 'calm', 'low', 'lonely', 'anxious', 'tired', 'angry', 'unclear']

// 情绪标签描述歌曲主要适配的状态，而不是歌曲可能引发的所有感受。
// 同一首歌最多保留两个相近或可共存的标签，避免推荐边界变得模糊。
const conflictingMoodPairs: ReadonlyArray<readonly [MoodId, MoodId]> = [
  ['happy', 'low'],
  ['happy', 'lonely'],
  ['happy', 'angry'],
  ['calm', 'anxious'],
  ['calm', 'angry'],
]

export interface CatalogStats {
  total: number
  byLanguage: Record<string, number>
  byLanguageAndGenre: Record<string, number>
}

export function getCatalogStats(catalog: Song[]): CatalogStats {
  const byLanguage: Record<string, number> = {}
  const byLanguageAndGenre: Record<string, number> = {}

  concreteLanguages.forEach((language) => {
    const languageSongs = catalog.filter((song) => song.language === language)
    byLanguage[language] = languageSongs.length
    concreteGenres.forEach((genre) => {
      byLanguageAndGenre[`${language}:${genre}`] = languageSongs.filter((song) =>
        song.genres.includes(genre),
      ).length
    })
  })

  return { total: catalog.length, byLanguage, byLanguageAndGenre }
}

export function validateCatalog(catalog: Song[], minimumPerLanguage = 32) {
  const ids = new Set<string>()

  catalog.forEach((song) => {
    if (ids.has(song.id)) throw new Error(`Duplicate song id: ${song.id}`)
    ids.add(song.id)

    if (!concreteLanguages.includes(song.language)) {
      throw new Error(`Invalid language for ${song.id}: ${song.language}`)
    }
    if (song.genres.length === 0 || song.genres.some((genre) => !concreteGenres.includes(genre))) {
      throw new Error(`Invalid genre list for ${song.id}`)
    }
    if (song.genres.includes('light') && !song.instrumental) {
      throw new Error(`Light music must be instrumental: ${song.id}`)
    }
    if (song.instrumental && !song.genres.includes('light')) {
      throw new Error(`Instrumental song must be in the light music catalog: ${song.id}`)
    }
    if (song.moods.length === 0 || song.moods.some((mood) => !moods.includes(mood))) {
      throw new Error(`Invalid mood list for ${song.id}`)
    }
    if (song.moods.length > 2) {
      throw new Error(`Song ${song.id} has more than two moods`)
    }
    if (new Set(song.moods).size !== song.moods.length) {
      throw new Error(`Song ${song.id} has duplicate moods`)
    }
    const conflictingPair = conflictingMoodPairs.find(([first, second]) =>
      song.moods.includes(first) && song.moods.includes(second),
    )
    if (conflictingPair) {
      throw new Error(`Song ${song.id} has conflicting moods: ${conflictingPair.join(' + ')}`)
    }
  })

  const stats = getCatalogStats(catalog)
  concreteLanguages.forEach((language) => {
    if ((stats.byLanguage[language] ?? 0) < minimumPerLanguage) {
      throw new Error(`Language ${language} has fewer than ${minimumPerLanguage} songs`)
    }
  })

  return stats
}
