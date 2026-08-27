import type { GenreId, LanguageId, MoodId } from './data'
import type { RecommendationAnswers } from './recommendation'

type KeywordRule<T extends string> = {
  id: T
  keywords: string[]
}

const moodRules: KeywordRule<MoodId>[] = [
  { id: 'low', keywords: ['不开心', '难过', '低落', '伤心', '失落', '沮丧', '想哭', '痛苦', '悲伤', '糟糕', 'sad', 'depressed'] },
  { id: 'lonely', keywords: ['一个人', '孤独', '孤单', '想念', '寂寞', '分别', '失恋', 'lonely', 'miss'] },
  { id: 'anxious', keywords: ['焦虑', '紧张', '担心', '不安', '压力', '烦躁', '害怕', '慌', 'anxious', 'stress'] },
  { id: 'tired', keywords: ['没力气', '撑不住', '疲惫', '加班', '好累', '很累', '累', '困', '倦', 'tired', 'exhausted'] },
  { id: 'angry', keywords: ['生气', '愤怒', '火大', '讨厌', '不爽', '憋屈', '吵架', 'angry', 'mad'] },
  { id: 'happy', keywords: ['开心', '高兴', '快乐', '兴奋', '幸福', '庆祝', '甜蜜', '期待', '明亮', 'happy', 'joy'] },
  { id: 'calm', keywords: ['平静', '放松', '安静', '惬意', '宁静', '舒心', 'calm', 'relax'] },
  { id: 'unclear', keywords: ['说不清', '迷茫', '复杂', '混乱', '不知道', '麻木', 'unclear', 'confused'] },
]

const languageRules: KeywordRule<LanguageId>[] = [
  { id: 'mandarin', keywords: ['普通话', '中文歌', '国语', '华语'] },
  { id: 'cantonese', keywords: ['粤语', '广东话'] },
  { id: 'english', keywords: ['英语', '英文歌'] },
  { id: 'french', keywords: ['法语', '法文', '法国歌'] },
  { id: 'japanese', keywords: ['日语', '日文歌'] },
  { id: 'korean', keywords: ['韩语', '韩文歌'] },
  { id: 'other', keywords: ['其他语言', '小语种', '西班牙语', '德语', '意大利语'] },
  { id: 'random', keywords: ['不限语言', '随便什么语言', '语言随机'] },
]

const genreRules: KeywordRule<GenreId>[] = [
  { id: 'rnb', keywords: ['r&b', 'rnb', '节奏布鲁斯'] },
  { id: 'rock', keywords: ['摇滚'] },
  { id: 'folk', keywords: ['民谣'] },
  { id: 'blues', keywords: ['蓝调'] },
  { id: 'classic', keywords: ['经典', '老歌', '怀旧'] },
  { id: 'light', keywords: ['轻音乐', '纯音乐', '钢琴曲', '舒缓'] },
  { id: 'electronic', keywords: ['电子乐', '电子音乐'] },
  { id: 'rap', keywords: ['说唱', '嘻哈', 'rap'] },
  { id: 'pop', keywords: ['流行'] },
  { id: 'random', keywords: ['不限曲风', '什么类型都可以', '曲风随机'] },
]

function inferFromRules<T extends string>(
  text: string,
  rules: KeywordRule<T>[],
  fallback: T,
): T {
  const normalized = text.toLocaleLowerCase()
  let bestId = fallback
  let bestScore = 0

  for (const rule of rules) {
    const score = rule.keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword.toLocaleLowerCase()) ? keyword.length : 0),
      0,
    )

    if (score > bestScore) {
      bestId = rule.id
      bestScore = score
    }
  }

  return bestId
}

export function analyzeDescription(description: string): RecommendationAnswers {
  return {
    mood: inferFromRules(description, moodRules, 'unclear'),
    language: inferFromRules(description, languageRules, 'random'),
    genre: inferFromRules(description, genreRules, 'random'),
  }
}
