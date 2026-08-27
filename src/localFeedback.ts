import { genreOptions, type GenreId, type LanguageId, type MoodId, type Song } from './data'

const STORAGE_KEY = 'emotion-music-local-preferences-v1'
const MAX_EVENTS = 200
const MAX_DISLIKED_SONGS = 200

export const feedbackReasonOptions = [
  { id: 'mood_mismatch', label: '情绪不匹配' },
  { id: 'genre_mismatch', label: '曲风不匹配' },
  { id: 'too_energetic', label: '节奏太强' },
  { id: 'too_calm', label: '节奏太平静' },
  { id: 'artist_dislike', label: '不喜欢这位歌手' },
  { id: 'already_heard', label: '已经听过' },
  { id: 'language_wrong', label: '语言不正确' },
  { id: 'other', label: '其他' },
] as const

export type FeedbackReason = (typeof feedbackReasonOptions)[number]['id']
export type LocalFeedbackAction = 'impression' | 'like' | 'dislike' | 'swap' | 'platform_click'

interface SongFeedbackStats {
  likes: number
  dislikes: number
  swaps: number
  platformClicks: number
}

interface LocalFeedbackEvent {
  id: string
  recommendationId: string
  songId: string
  mood: MoodId
  language: LanguageId
  genre: GenreId
  action: LocalFeedbackAction
  reasons: FeedbackReason[]
  createdAt: string
}

export interface LocalPreferenceProfile {
  version: 1
  preferredEnergy: number | null
  energySamples: number
  genreWeights: Partial<Record<GenreId, number>>
  artistWeights: Record<string, number>
  songStats: Record<string, SongFeedbackStats>
  dislikedSongIds: string[]
  events: LocalFeedbackEvent[]
  updatedAt: string
}

export interface LocalFeedbackInput {
  recommendationId: string
  song: Song
  answers: {
    mood: MoodId
    language: LanguageId
    genre: GenreId
  }
  action: LocalFeedbackAction
  reasons?: FeedbackReason[]
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const finiteOr = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function createRecommendationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createDefaultPreferenceProfile(): LocalPreferenceProfile {
  return {
    version: 1,
    preferredEnergy: null,
    energySamples: 0,
    genreWeights: {},
    artistWeights: {},
    songStats: {},
    dislikedSongIds: [],
    events: [],
    updatedAt: new Date().toISOString(),
  }
}

export function loadLocalPreferenceProfile(): LocalPreferenceProfile {
  const fallback = createDefaultPreferenceProfile()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const source = parsed as Partial<LocalPreferenceProfile>

    const genreWeights: Partial<Record<GenreId, number>> = {}
    for (const option of genreOptions) {
      const value = source.genreWeights?.[option.id]
      if (typeof value === 'number' && Number.isFinite(value)) genreWeights[option.id] = clamp(value, -2, 2)
    }

    const artistWeights: Record<string, number> = {}
    if (source.artistWeights && typeof source.artistWeights === 'object') {
      for (const [artist, value] of Object.entries(source.artistWeights).slice(0, 300)) {
        if (typeof value === 'number' && Number.isFinite(value)) artistWeights[artist] = clamp(value, -2, 2)
      }
    }

    const songStats: Record<string, SongFeedbackStats> = {}
    if (source.songStats && typeof source.songStats === 'object') {
      for (const [songId, stats] of Object.entries(source.songStats).slice(0, 300)) {
        if (!stats || typeof stats !== 'object') continue
        const candidate = stats as Partial<SongFeedbackStats>
        songStats[songId] = {
          likes: Math.max(0, finiteOr(candidate.likes)),
          dislikes: Math.max(0, finiteOr(candidate.dislikes)),
          swaps: Math.max(0, finiteOr(candidate.swaps)),
          platformClicks: Math.max(0, finiteOr(candidate.platformClicks)),
        }
      }
    }

    return {
      version: 1,
      preferredEnergy: typeof source.preferredEnergy === 'number'
        ? clamp(source.preferredEnergy, 0, 1)
        : null,
      energySamples: Math.max(0, finiteOr(source.energySamples)),
      genreWeights,
      artistWeights,
      songStats,
      dislikedSongIds: Array.isArray(source.dislikedSongIds)
        ? source.dislikedSongIds.filter((id): id is string => typeof id === 'string').slice(-MAX_DISLIKED_SONGS)
        : [],
      events: Array.isArray(source.events)
        ? source.events.filter((event): event is LocalFeedbackEvent => Boolean(event && typeof event === 'object')).slice(-MAX_EVENTS)
        : [],
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : fallback.updatedAt,
    }
  } catch {
    return fallback
  }
}

export function saveLocalPreferenceProfile(profile: LocalPreferenceProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    return true
  } catch {
    return false
  }
}

export function clearLocalPreferenceProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage may be unavailable in private browsing; the in-memory profile is still reset.
  }
}

function updateEnergyPreference(profile: LocalPreferenceProfile, target: number, strength = 1) {
  const sampleCount = Math.min(profile.energySamples, 20)
  const current = profile.preferredEnergy ?? target
  profile.preferredEnergy = clamp((current * sampleCount + target * strength) / (sampleCount + strength), 0, 1)
  profile.energySamples = sampleCount + strength
}

function updateWeight(weights: Record<string, number>, key: string, delta: number) {
  weights[key] = clamp((weights[key] ?? 0) + delta, -2, 2)
}

export function recordLocalFeedback(
  current: LocalPreferenceProfile,
  input: LocalFeedbackInput,
): LocalPreferenceProfile {
  const profile: LocalPreferenceProfile = {
    ...current,
    genreWeights: { ...current.genreWeights },
    artistWeights: { ...current.artistWeights },
    songStats: { ...current.songStats },
    dislikedSongIds: [...current.dislikedSongIds],
    events: [...current.events],
  }
  const existingStats = profile.songStats[input.song.id] ?? {
    likes: 0,
    dislikes: 0,
    swaps: 0,
    platformClicks: 0,
  }
  const stats = { ...existingStats }
  profile.songStats[input.song.id] = stats
  const reasons = input.reasons ?? []

  if (input.action === 'like') {
    stats.likes += 1
    profile.dislikedSongIds = profile.dislikedSongIds.filter((id) => id !== input.song.id)
    input.song.genres.forEach((genre) => updateWeight(profile.genreWeights as Record<string, number>, genre, 0.12))
    updateWeight(profile.artistWeights, input.song.artist, 0.1)
    updateEnergyPreference(profile, input.song.energy)
  }

  if (input.action === 'platform_click') {
    stats.platformClicks += 1
    input.song.genres.forEach((genre) => updateWeight(profile.genreWeights as Record<string, number>, genre, 0.04))
    updateWeight(profile.artistWeights, input.song.artist, 0.04)
  }

  if (input.action === 'swap') stats.swaps += 1

  if (input.action === 'dislike') {
    stats.dislikes += 1
    profile.dislikedSongIds = [...profile.dislikedSongIds.filter((id) => id !== input.song.id), input.song.id]
      .slice(-MAX_DISLIKED_SONGS)
    if (reasons.includes('genre_mismatch')) {
      input.song.genres.forEach((genre) => updateWeight(profile.genreWeights as Record<string, number>, genre, -0.18))
      if (input.answers.genre !== 'random') {
        updateWeight(profile.genreWeights as Record<string, number>, input.answers.genre, 0.12)
      }
    }
    if (reasons.includes('artist_dislike')) updateWeight(profile.artistWeights, input.song.artist, -0.8)
    if (reasons.includes('too_energetic')) updateEnergyPreference(profile, input.song.energy - 0.2, 2)
    if (reasons.includes('too_calm')) updateEnergyPreference(profile, input.song.energy + 0.2, 2)
  }

  profile.events = [
    ...profile.events,
    {
      id: createRecommendationId(),
      recommendationId: input.recommendationId,
      songId: input.song.id,
      mood: input.answers.mood,
      language: input.answers.language,
      genre: input.answers.genre,
      action: input.action,
      reasons,
      createdAt: new Date().toISOString(),
    },
  ].slice(-MAX_EVENTS)
  profile.updatedAt = new Date().toISOString()
  return profile
}

export function getLocalPreferenceScore(song: Song, profile?: LocalPreferenceProfile) {
  if (!profile) return 0
  const stats = profile.songStats[song.id]
  let score = 0

  if (stats) {
    const explicitCount = stats.likes + stats.dislikes
    const sentiment = (stats.likes + stats.platformClicks * 0.35 - stats.dislikes) / (explicitCount + 2)
    const swapRate = stats.swaps / (explicitCount + stats.swaps + 3)
    score += sentiment * 14 - swapRate * 4
  }

  if (song.genres.length > 0) {
    const genrePreference = song.genres.reduce((total, genre) => total + (profile.genreWeights[genre] ?? 0), 0)
      / song.genres.length
    score += genrePreference * 3
  }

  score += (profile.artistWeights[song.artist] ?? 0) * 3
  if (profile.preferredEnergy !== null && profile.energySamples > 0) {
    score -= Math.abs(song.energy - profile.preferredEnergy) * 10
  }

  return score
}
