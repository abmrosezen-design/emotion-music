import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(projectRoot, 'scripts/.cache/catalog-manifest.json')
const cachePath = resolve(projectRoot, 'scripts/.cache/bilibili-search.json')
const outputPath = resolve(projectRoot, 'src/catalog/bilibili-videos.json')
const reportPath = resolve(projectRoot, 'docs/BILIBILI_PLAYBACK_REPORT.zh-CN.md')
const searchEndpoint = 'https://api.bilibili.com/x/web-interface/search/type'
const minimumConfidence = 0.72

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum)
const decodeHtml = (value = '') => value
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')

const normalize = (value = '') => decodeHtml(String(value))
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[’‘`]/g, "'")
  .replace(/[^\p{L}\p{N}]+/gu, '')

const parseDuration = (duration = '') => String(duration)
  .split(':')
  .map(Number)
  .reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0)

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

function scoreCandidate(song, candidate) {
  const wantedTitle = normalize(song.title)
  const wantedArtist = normalize(song.artist)
  const candidateTitle = normalize(candidate.title)
  const candidateAuthor = normalize(candidate.author)
  const candidateDescription = normalize(candidate.description)
  const searchable = `${candidateTitle}${candidateAuthor}${candidateDescription}`
  const displayText = `${decodeHtml(candidate.title)} ${decodeHtml(candidate.description)}`
  const exactTitle = Boolean(wantedTitle && candidateTitle.includes(wantedTitle))
  const artistMatch = Boolean(wantedArtist && searchable.includes(wantedArtist))
  const veryShortTitle = wantedTitle.length <= 5
  const duration = parseDuration(candidate.duration)

  let score = exactTitle ? 52 : 0
  if (artistMatch) score += 32
  if (/官方|official|音乐|歌曲|mv|audio|完整版/i.test(displayText)) score += 7
  if (/无损|hi.?res|高音质|lyrics?|中字/i.test(displayText)) score += 3
  if (/翻唱|cover|教学|教程|reaction|伴奏|纯人声|sped.?up|slowed|remix/i.test(displayText)) score -= song.instrumental ? 12 : 46
  if (/琴谱|鼓谱|简谱|乐谱|附谱|吉他谱|贝斯谱|架子鼓|光遇|我的\s*世界|minecraft|sky|翻弹|舞蹈|原创振付|踊ってみた|有氧|燃脂/i.test(displayText)) score -= song.instrumental ? 12 : 48
  if (!song.instrumental && /instrumental|纯音乐|无人声/i.test(displayText)) score -= 48
  if (/合集|歌单|playlist|一小时|1小时|循环/i.test(displayText)) score -= 24
  if (duration > 0 && duration < 55) score -= 24
  if (duration > 1200) score -= 18
  if (veryShortTitle && !artistMatch) score -= 26
  if (!exactTitle) score -= 20

  return {
    score,
    confidence: Number(clamp(score / 94, 0, 1).toFixed(3)),
    exactTitle,
    artistMatch,
  }
}

function selectBestMatch(song, results = []) {
  return results
    .filter((candidate) => /^BV[\dA-Za-z]+$/.test(candidate.bvid ?? ''))
    .map((candidate) => ({ candidate, ...scoreCandidate(song, candidate) }))
    .sort((first, second) => second.score - first.score)[0]
}

async function fetchSearch(song) {
  const keyword = `${song.title} ${song.artist} 音乐`
  const url = new URL(searchEndpoint)
  url.searchParams.set('search_type', 'video')
  url.searchParams.set('page', '1')
  url.searchParams.set('page_size', '10')
  url.searchParams.set('keyword', keyword)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        referer: 'https://www.bilibili.com/',
        'user-agent': 'Mozilla/5.0 EmotionMusicPrototype/1.0',
      },
    })
    if (response.ok) {
      const payload = await response.json()
      if (payload.code === 0) return payload
      if (payload.code !== -412) throw new Error(`Bilibili API ${payload.code}: ${payload.message}`)
    } else if (response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status}`)
    }
    await wait((attempt + 1) * 1600)
  }
  throw new Error('Bilibili search failed after retries')
}

async function main() {
  const songs = await loadJson(manifestPath, [])
  if (!Array.isArray(songs) || songs.length === 0) {
    throw new Error('Missing catalog manifest. Run catalog:enrich:musicbrainz once before matching Bilibili videos.')
  }

  await mkdir(dirname(cachePath), { recursive: true })
  const cache = await loadJson(cachePath, {})
  const retryErrors = process.argv.includes('--retry-errors')
  const matches = {}
  let fetched = 0

  for (let index = 0; index < songs.length; index += 1) {
    const song = songs[index]
    let payload = cache[song.id]
    if (!payload || (retryErrors && payload.error)) {
      const requestStartedAt = Date.now()
      try {
        payload = await fetchSearch(song)
      } catch (error) {
        payload = { error: error instanceof Error ? error.message : String(error), data: { result: [] } }
      }
      cache[song.id] = payload
      fetched += 1
      await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
      await wait(Math.max(0, 420 - (Date.now() - requestStartedAt)))
    }

    const best = selectBestMatch(song, payload.data?.result ?? [])
    if (best && best.confidence >= minimumConfidence) {
      matches[song.id] = {
        bvid: best.candidate.bvid,
        title: decodeHtml(best.candidate.title).replace(/\s+/g, ' ').trim(),
        author: best.candidate.author,
        confidence: best.confidence,
        exactTitle: best.exactTitle,
        artistMatch: best.artistMatch,
        pageUrl: best.candidate.arcurl || `https://www.bilibili.com/video/${best.candidate.bvid}`,
      }
    }

    if ((index + 1) % 10 === 0 || index + 1 === songs.length) {
      console.log(`processed=${index + 1}/${songs.length} matched=${Object.keys(matches).length} fetched=${fetched}`)
    }
  }

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'Bilibili public video search',
    minimumConfidence,
    totalSongs: songs.length,
    matchedSongs: Object.keys(matches).length,
    videos: matches,
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, `# B 站站内播放匹配报告\n\n` +
    `生成时间：${output.generatedAt}\n\n` +
    `- 曲库总数：${output.totalSongs}\n` +
    `- 达到播放阈值的 BV 号：${output.matchedSongs}\n` +
    `- 自动匹配阈值：${output.minimumConfidence}\n\n` +
    `网页只对达到阈值的条目显示站内播放入口；未匹配或低置信度条目继续使用 B 站搜索链接。BV 号可能因视频下架而失效，需定期重新运行匹配脚本。\n`, 'utf8')
  console.log(JSON.stringify({ totalSongs: output.totalSongs, matchedSongs: output.matchedSongs, fetched }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
