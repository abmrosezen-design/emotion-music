import {
  songs,
  type GenreId,
  type LanguageId,
  type MoodId,
  type Song,
} from './data'

export interface RecommendationAnswers {
  mood: MoodId
  language: LanguageId
  genre: GenreId
}

/**
 * A concrete language choice is a hard constraint. Only "random" may use
 * songs from multiple languages.
 */
export function getLanguagePool(
  answers: RecommendationAnswers,
  catalog: Song[] = songs,
): Song[] {
  if (answers.language === 'random') return catalog
  return catalog.filter((song) => song.language === answers.language)
}

export function pickRecommendedSong(
  answers: RecommendationAnswers,
  excludedSongIds: string[] = [],
  catalog: Song[] = songs,
): Song {
  const languagePool = getLanguagePool(answers, catalog)

  if (languagePool.length === 0) {
    throw new Error(`No songs are available for language: ${answers.language}`)
  }

  const unseenSongs = languagePool.filter((song) => !excludedSongIds.includes(song.id))
  const candidatePool = unseenSongs.length > 0 ? unseenSongs : languagePool

  const ranked = candidatePool
    .map((song) => {
      let score = song.moods.includes(answers.mood) ? 55 : 10

      if (answers.genre === 'random' || song.genres.includes(answers.genre)) {
        score += 30
      }

      // A small exploration factor varies recommendations without ever
      // bypassing the selected language pool.
      score += Math.random() * 6

      return { song, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked[0].song
}
