import {
  songs,
  type GenreId,
  type LanguageId,
  type MoodId,
  type Song,
} from './data'
import { getLocalPreferenceScore, type LocalPreferenceProfile } from './localFeedback'
import { verifiedGenreEvidence } from './catalog/verified-tags'

export interface RecommendationAnswers {
  mood: MoodId
  language: LanguageId
  genre: GenreId
}

/**
 * Light music uses its own instrumental-only pool, so language is irrelevant.
 * For every other genre, a concrete language remains a hard constraint.
 */
export function getLanguagePool(
  answers: RecommendationAnswers,
  catalog: Song[] = songs,
): Song[] {
  if (answers.genre === 'light') {
    return catalog.filter((song) => song.instrumental && song.genres.includes('light'))
  }
  if (answers.language === 'random') return catalog
  return catalog.filter((song) => song.language === answers.language)
}

export function pickRecommendedSong(
  answers: RecommendationAnswers,
  excludedSongIds: string[] = [],
  catalog: Song[] = songs,
  profile?: LocalPreferenceProfile,
): Song {
  const languagePool = getLanguagePool(answers, catalog)

  if (languagePool.length === 0) {
    throw new Error(`No songs are available for language: ${answers.language}`)
  }

  const unseenSongs = languagePool.filter((song) => !excludedSongIds.includes(song.id))
  const initialPool = unseenSongs.length > 0 ? unseenSongs : languagePool
  const locallyAllowed = initialPool.filter((song) => !profile?.dislikedSongIds.includes(song.id))
  const candidatePool = locallyAllowed.length > 0 ? locallyAllowed : initialPool

  const ranked = candidatePool
    .map((song) => {
      let score = song.moods.includes(answers.mood) ? 55 : 10

      const editorialGenreMatch = song.genres.includes(answers.genre as Exclude<GenreId, 'random'>)
      const externalGenreMatch = verifiedGenreEvidence[song.id]?.includes(
        answers.genre as Exclude<GenreId, 'random'>,
      )

      if (answers.genre === 'random' || editorialGenreMatch) {
        score += 30
      } else if (externalGenreMatch) {
        // External evidence supports discovery but stays below an editorial tag.
        score += 18
      }

      score += getLocalPreferenceScore(song, profile)

      // A small exploration factor varies recommendations without ever
      // bypassing the selected candidate pool.
      score += Math.random() * 6

      return { song, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked[0].song
}
