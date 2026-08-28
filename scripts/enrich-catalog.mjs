import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cachePath = resolve(projectRoot, 'scripts/.cache/musicbrainz-tags.json')
const manifestPath = resolve(projectRoot, 'scripts/.cache/catalog-manifest.json')
const outputPath = resolve(projectRoot, 'src/catalog/external-tags.json')
const reportPath = resolve(projectRoot, 'docs/CATALOG_ENRICHMENT_REPORT.zh-CN.md')
const userAgent = 'EmotionMusicPrototype/1.0 (https://github.com/abmrosezen-design/emotion-music)'

const genreMap = new Map([
  ['pop', 'pop'], ['art pop', 'pop'], ['dance pop', 'pop'], ['dream pop', 'pop'],
  ['mandopop', 'pop'], ['cantopop', 'pop'], ['c-pop', 'pop'], ['j-pop', 'pop'], ['k-pop', 'pop'],
  ['rock', 'rock'], ['alternative rock', 'rock'], ['indie rock', 'rock'], ['art rock', 'rock'],
  ['post-rock', 'rock'], ['hard rock', 'rock'], ['soft rock', 'rock'],
  ['r&b', 'rnb'], ['rnb', 'rnb'], ['rhythm and blues', 'rnb'], ['soul', 'rnb'], ['neo-soul', 'rnb'],
  ['folk', 'folk'], ['folk rock', 'folk'], ['indie folk', 'folk'], ['singer-songwriter', 'folk'], ['acoustic', 'folk'],
  ['blues', 'blues'], ['electric blues', 'blues'], ['soul blues', 'blues'],
  ['classical', 'classic'], ['baroque', 'classic'], ['romantic', 'classic'], ['oldies', 'classic'],
  ['instrumental', 'light'], ['piano', 'light'], ['ambient', 'light'], ['new age', 'light'],
  ['neoclassical', 'light'], ['post-classical', 'light'], ['orchestral', 'light'],
  ['electronic', 'electronic'], ['electronica', 'electronic'], ['synthpop', 'electronic'],
  ['dance', 'electronic'], ['house', 'electronic'], ['techno', 'electronic'],
  ['rap', 'rap'], ['hip-hop', 'rap'], ['hip hop', 'rap'], ['alternative hip-hop', 'rap'],
])

const moodMap = new Map([
  ['happy', 'happy'], ['cheerful', 'happy'], ['upbeat', 'happy'], ['joyful', 'happy'], ['feel good', 'happy'],
  ['calm', 'calm'], ['chill', 'calm'], ['relaxing', 'calm'], ['mellow', 'calm'], ['peaceful', 'calm'],
  ['soothing', 'calm'], ['dreamy', 'calm'],
  ['sad', 'low'], ['melancholy', 'low'], ['melancholic', 'low'], ['depressive', 'low'], ['bittersweet', 'low'],
  ['lonely', 'lonely'], ['loneliness', 'lonely'],
  ['anxious', 'anxious'], ['anxiety', 'anxious'], ['tense', 'anxious'], ['unsettling', 'anxious'],
  ['sleepy', 'tired'], ['sleep', 'tired'], ['tired', 'tired'],
  ['angry', 'angry'], ['aggressive', 'angry'], ['rage', 'angry'],
  ['introspective', 'unclear'], ['reflective', 'unclear'], ['atmospheric', 'unclear'],
])

const conflictPairs = [
  ['happy', 'low'], ['happy', 'lonely'], ['happy', 'angry'], ['calm', 'anxious'], ['calm', 'angry'],
]

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const normalize = (value) => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[’‘`]/g, "'")
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

function artistNames(recording) {
  return (recording['artist-credit'] ?? []).map((credit) => credit.artist?.name ?? credit.name).filter(Boolean)
}

function selectBestMatch(song, recordings) {
  const wantedTitle = normalize(song.title)
  const wantedArtist = normalize(song.artist)
  return recordings
    .map((recording) => {
      const titleExact = normalize(recording.title) === wantedTitle
      const artists = artistNames(recording)
      const artistExact = artists.some((artist) => normalize(artist) === wantedArtist)
      const artistContains = artists.some((artist) => {
        const normalizedArtist = normalize(artist)
        return normalizedArtist.includes(wantedArtist) || wantedArtist.includes(normalizedArtist)
      })
      const adjustedScore = Number(recording.score ?? 0) + (titleExact ? 12 : 0) + (artistExact ? 12 : artistContains ? 5 : 0)
      return { recording, titleExact, artistExact, artistContains, adjustedScore }
    })
    .sort((first, second) => second.adjustedScore - first.adjustedScore)[0]
}

function mapTags(rawTags, mapping) {
  const scores = new Map()
  rawTags.forEach(({ name, count }) => {
    const mapped = mapping.get(normalize(name))
    if (!mapped) return
    scores.set(mapped, (scores.get(mapped) ?? 0) + Math.max(1, Number(count ?? 1)))
  })
  return [...scores.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([id, score]) => ({ id, score }))
}

function removeMoodConflicts(mappedMoods) {
  const accepted = []
  for (const mood of mappedMoods) {
    const conflicts = accepted.some((acceptedMood) =>
      conflictPairs.some(([first, second]) =>
        (first === mood.id && second === acceptedMood.id) || (second === mood.id && first === acceptedMood.id),
      ),
    )
    if (!conflicts) accepted.push(mood)
    if (accepted.length === 2) break
  }
  return accepted
}

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function fetchMusicBrainz(song) {
  const query = `recording:"${song.title.replaceAll('"', '')}" AND artist:"${song.artist.replaceAll('"', '')}"`
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': userAgent, accept: 'application/json' } })
    if (response.ok) return response.json()
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`)
    await wait((attempt + 1) * 1800)
  }
  throw new Error('MusicBrainz request failed after retries')
}

async function main() {
  const server = await createServer({ root: projectRoot, server: { middlewareMode: true }, appType: 'custom' })
  let songs
  try {
    ;({ songs } = await server.ssrLoadModule('/src/data.ts'))
  } finally {
    await server.close()
  }

  await mkdir(dirname(cachePath), { recursive: true })
  await writeFile(
    manifestPath,
    `${JSON.stringify(songs.map(({ id, title, artist, genres, moods, instrumental }) => ({ id, title, artist, genres, moods, instrumental: Boolean(instrumental) })), null, 2)}\n`,
    'utf8',
  )
  const cache = await loadJson(cachePath, {})
  const evidence = {}
  let fetched = 0

  for (let index = 0; index < songs.length; index += 1) {
    const song = songs[index]
    let payload = cache[song.id]
    if (!payload) {
      const requestStartedAt = Date.now()
      try {
        payload = await fetchMusicBrainz(song)
      } catch (error) {
        payload = { error: error instanceof Error ? error.message : String(error), recordings: [] }
      }
      cache[song.id] = payload
      fetched += 1
      await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
      await wait(Math.max(0, 1100 - (Date.now() - requestStartedAt)))
    }

    const best = selectBestMatch(song, payload.recordings ?? [])
    if (!best) {
      evidence[song.id] = { status: payload.error ? 'fetch_error' : 'not_found', source: 'musicbrainz', externalTags: [], mappedGenres: [], mappedMoods: [] }
    } else {
      const rawTags = (best.recording.tags ?? [])
        .filter((tag) => Number(tag.count ?? 0) > 0)
        .map((tag) => ({ name: tag.name, count: Number(tag.count ?? 1) }))
        .sort((first, second) => second.count - first.count)
      const mappedGenres = mapTags(rawTags, genreMap)
      const mappedMoods = removeMoodConflicts(mapTags(rawTags, moodMap))
      const identityConfidence = best.titleExact && best.artistExact ? 1 : best.titleExact && best.artistContains ? 0.88 : 0.55
      const tagConfidence = Math.min(1, rawTags.reduce((total, tag) => total + tag.count, 0) / 6)
      evidence[song.id] = {
        status: identityConfidence >= 0.88 ? (rawTags.length ? 'matched' : 'matched_without_tags') : 'low_confidence',
        source: 'musicbrainz',
        mbid: best.recording.id,
        matchedTitle: best.recording.title,
        matchedArtist: artistNames(best.recording).join(' & '),
        matchScore: Number(best.recording.score ?? 0),
        confidence: Number((identityConfidence * tagConfidence).toFixed(3)),
        externalTags: rawTags,
        mappedGenres,
        mappedMoods,
      }
    }

    if ((index + 1) % 10 === 0 || index + 1 === songs.length) {
      console.log(`processed=${index + 1}/${songs.length} fetched=${fetched}`)
    }
  }

  const matched = Object.values(evidence).filter((item) => item.status === 'matched')
  const genreEvidence = matched.filter((item) => item.mappedGenres.length > 0)
  const moodEvidence = matched.filter((item) => item.mappedMoods.length > 0)
  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'MusicBrainz public API',
    totalSongs: songs.length,
    summary: {
      matched: matched.length,
      withGenreEvidence: genreEvidence.length,
      withHighConfidenceGenreEvidence: genreEvidence.filter((item) => Number(item.confidence ?? 0) >= 0.8).length,
      withMoodEvidence: moodEvidence.length,
      lowConfidence: Object.values(evidence).filter((item) => item.status === 'low_confidence').length,
      unavailable: Object.values(evidence).filter((item) => ['not_found', 'fetch_error'].includes(item.status)).length,
    },
    songs: evidence,
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, `# 曲库外部标签核对报告\n\n` +
    `生成时间：${output.generatedAt}\n\n` +
    `- 曲库总数：${songs.length}\n` +
    `- 歌曲与艺人准确匹配且存在标签：${output.summary.matched}\n` +
    `- 获得曲风证据：${output.summary.withGenreEvidence}\n` +
    `- 达到 0.8 置信度并进入推荐算法：${output.summary.withHighConfidenceGenreEvidence}\n` +
    `- 获得情绪证据：${output.summary.withMoodEvidence}\n` +
    `- 低置信度匹配：${output.summary.lowConfidence}\n` +
    `- 未找到或请求失败：${output.summary.unavailable}\n\n` +
    `自动应用规则：外部标签不覆盖人工标签。只有置信度达到 0.8 的曲风证据才以较低权重补强推荐；情绪标签只有在出现明确情绪词时才参与；仍执行最多两个情绪及冲突情绪校验。\n`, 'utf8')
  console.log(JSON.stringify(output.summary))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
