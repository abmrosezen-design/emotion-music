import type { GenreId } from '../data'

type ConcreteGenre = Exclude<GenreId, 'random'>

// MusicBrainz song/artist exact matches with confidence >= 0.8.
// These tags supplement editorial labels at a lower recommendation weight;
// they never overwrite light-music or emotion safety rules.
export const verifiedGenreEvidence: Record<string, readonly ConcreteGenre[]> = {
  'catalog-1stbl2p': ['pop', 'rock'],
  'catalog-wj5s4p': ['pop', 'electronic'],
  'catalog-1trwsxc': ['pop', 'electronic'],
  'catalog-1ygdpi': ['rock', 'electronic', 'pop'],
  'catalog-1wctt48': ['electronic', 'pop'],
  'catalog-19filkk': ['pop', 'electronic'],
  'catalog-o3cnfq': ['pop'],
  'catalog-18rf39d': ['pop'],
  'catalog-8lpqqv': ['pop'],
  'catalog-1p3t8zo': ['pop', 'rock'],
  'instrumental-67l0hf': ['electronic', 'classic', 'light'],
  'instrumental-1obvf6u': ['light', 'electronic', 'rock'],
}
