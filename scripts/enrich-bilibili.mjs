import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(projectRoot, 'scripts/.cache/catalog-manifest.json')
const cachePath = resolve(projectRoot, 'scripts/.cache/bilibili-search.json')
const trustedUpCachePath = resolve(projectRoot, 'scripts/.cache/bilibili-up-videos.json')
const outputPath = resolve(projectRoot, 'src/catalog/bilibili-videos.json')
const reportPath = resolve(projectRoot, 'docs/BILIBILI_PLAYBACK_REPORT.zh-CN.md')
const searchEndpoint = 'https://api.bilibili.com/x/web-interface/search/type'
const minimumConfidence = 0.72
const trustedUpMids = ['229733301', '3493093607213343', '9666167']
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]
const requestHeaders = {
  accept: 'application/json',
  referer: 'https://www.bilibili.com/',
  'user-agent': 'Mozilla/5.0 EmotionMusicPrototype/1.0',
}
let anonymousCookie = ''

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
  const bracketedTitles = [...decodeHtml(candidate.title).matchAll(/《([^》]+)》/g)]
    .map((match) => normalize(match[1]))
  const exactTitle = Boolean(wantedTitle && candidateTitle.includes(wantedTitle))
  const artistMatch = Boolean(wantedArtist && searchable.includes(wantedArtist))
  const veryShortTitle = wantedTitle.length <= 5
  const duration = parseDuration(candidate.duration)

  let score = exactTitle ? 52 : 0
  if (artistMatch) score += 32
  if (bracketedTitles.length > 0) {
    if (bracketedTitles[0] === wantedTitle) score += 8
    else if (bracketedTitles[0].includes(wantedTitle)) score += artistMatch ? 2 : -30
    else if (bracketedTitles.some((title) => title.includes(wantedTitle))) score -= 42
  }
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

function getMixinKey(origin) {
  return mixinKeyEncTab.map((index) => origin[index]).join('').slice(0, 32)
}

async function getWbiKeys() {
  const response = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: withAnonymousCookie() })
  if (!response.ok) throw new Error(`Bilibili nav HTTP ${response.status}`)
  const payload = await response.json()
  if (!payload.data?.wbi_img) throw new Error(`Bilibili nav ${payload.code}: ${payload.message}`)
  const filename = (url) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
  return {
    imgKey: filename(payload.data.wbi_img.img_url),
    subKey: filename(payload.data.wbi_img.sub_url),
  }
}

function withAnonymousCookie(referer = requestHeaders.referer) {
  return anonymousCookie
    ? { ...requestHeaders, referer, cookie: anonymousCookie }
    : { ...requestHeaders, referer }
}

async function prepareAnonymousSession() {
  const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi', { headers: requestHeaders })
  if (!response.ok) return
  const payload = await response.json()
  if (payload.code !== 0 || !payload.data?.b_3) return
  const timestamp = Math.floor(Date.now() / 1000)
  anonymousCookie = `buvid3=${payload.data.b_3}; buvid4=${payload.data.b_4 ?? ''}; b_nut=${timestamp}`
}

function signWbi(params, { imgKey, subKey }) {
  const values = { ...params, wts: Math.floor(Date.now() / 1000) }
  const query = Object.keys(values)
    .sort()
    .map((key) => {
      const value = String(values[key]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')
  const wRid = createHash('md5').update(query + getMixinKey(imgKey + subKey)).digest('hex')
  return `${query}&w_rid=${wRid}`
}

async function fetchTrustedUpPage(mid, page, wbiKeys) {
  const query = signWbi({ mid, pn: page, ps: 50, order: 'pubdate' }, wbiKeys)
  const url = `https://api.bilibili.com/x/space/wbi/arc/search?${query}`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: withAnonymousCookie(`https://space.bilibili.com/${mid}/`) })
    if (response.ok) {
      const payload = await response.json()
      if (payload.code === 0 && payload.data) return payload
      if (![ -352, -412 ].includes(payload.code)) throw new Error(`Bilibili UP API ${payload.code}: ${payload.message}`)
    } else if (response.status !== 412 && response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status}`)
    }
    await wait((attempt + 1) * 2200)
  }
  throw new Error(`Bilibili UP ${mid} page ${page} failed after retries`)
}

function normalizeUpVideo(video, mid, upName) {
  return {
    bvid: video.bvid,
    title: video.title,
    author: video.author || upName,
    description: video.description || '',
    duration: video.length || '',
    arcurl: `https://www.bilibili.com/video/${video.bvid}`,
    mid,
    upName: video.author || upName,
    sourceType: 'trusted_up',
  }
}

async function loadTrustedUpVideos() {
  const cache = await loadJson(trustedUpCachePath, {})
  const refresh = process.argv.includes('--refresh-trusted-ups')
  if (process.argv.includes('--cache-only')) {
    return { cache, videos: trustedUpMids.flatMap((mid) => cache[mid]?.videos ?? []) }
  }
  await prepareAnonymousSession()
  const wbiKeys = await getWbiKeys()
  const allVideos = []

  for (const mid of trustedUpMids) {
    const existing = refresh ? null : cache[mid]
    const entry = existing ?? { mid, name: '', total: 0, nextPage: 1, complete: false, videos: [] }
    const seen = new Set(entry.videos.map((video) => video.bvid))

    while (!entry.complete && entry.nextPage <= 120) {
      const page = entry.nextPage
      try {
        const payload = await fetchTrustedUpPage(mid, page, wbiKeys)
        const videos = payload.data.list?.vlist ?? []
        entry.total = Number(payload.data.page?.count ?? entry.total ?? 0)
        entry.name = videos[0]?.author || entry.name || mid
        videos.forEach((video) => {
          if (!video.bvid || seen.has(video.bvid)) return
          seen.add(video.bvid)
          entry.videos.push(normalizeUpVideo(video, mid, entry.name))
        })
        entry.nextPage = page + 1
        entry.complete = videos.length < 50 || entry.videos.length >= entry.total
        entry.updatedAt = new Date().toISOString()
        cache[mid] = entry
        await writeFile(trustedUpCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
        console.log(`trusted_up=${mid} name=${entry.name} videos=${entry.videos.length}/${entry.total} page=${page}`)
        await wait(1800)
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error)
        cache[mid] = entry
        await writeFile(trustedUpCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
        console.warn(entry.error)
        break
      }
    }

    allVideos.push(...entry.videos)
  }

  return { cache, videos: allVideos }
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
      headers: withAnonymousCookie(),
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
  const trustedUpData = await loadTrustedUpVideos()
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

    const trustedBest = selectBestMatch(song, trustedUpData.videos)
    const globalBest = selectBestMatch(song, payload.data?.result ?? [])
    const best = trustedBest?.confidence >= minimumConfidence ? trustedBest : globalBest
    if (best && best.confidence >= minimumConfidence) {
      matches[song.id] = {
        bvid: best.candidate.bvid,
        title: decodeHtml(best.candidate.title).replace(/\s+/g, ' ').trim(),
        author: best.candidate.author,
        confidence: best.confidence,
        exactTitle: best.exactTitle,
        artistMatch: best.artistMatch,
        sourceType: best.candidate.sourceType ?? 'global_search',
        upMid: best.candidate.mid ?? null,
        upName: best.candidate.upName ?? best.candidate.author,
        pageUrl: best.candidate.arcurl || `https://www.bilibili.com/video/${best.candidate.bvid}`,
      }
    }

    if ((index + 1) % 10 === 0 || index + 1 === songs.length) {
      console.log(`processed=${index + 1}/${songs.length} matched=${Object.keys(matches).length} fetched=${fetched}`)
    }
  }

  const output = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'Bilibili public video search',
    minimumConfidence,
    totalSongs: songs.length,
    matchedSongs: Object.keys(matches).length,
    trustedUpMids,
    trustedUps: trustedUpMids.map((mid) => ({
      mid,
      name: trustedUpData.cache[mid]?.name || mid,
      indexedVideos: trustedUpData.cache[mid]?.videos?.length ?? 0,
      totalVideos: trustedUpData.cache[mid]?.total ?? 0,
      complete: Boolean(trustedUpData.cache[mid]?.complete),
    })),
    trustedUpVideos: trustedUpData.videos.length,
    trustedUpMatches: Object.values(matches).filter((match) => match.sourceType === 'trusted_up').length,
    videos: matches,
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, `# B 站站内播放匹配报告\n\n` +
    `生成时间：${output.generatedAt}\n\n` +
    `- 曲库总数：${output.totalSongs}\n` +
    `- 达到播放阈值的 BV 号：${output.matchedSongs}\n` +
    `- 指定可信 UP 主：${output.trustedUps.map((up) => `${up.name}（${up.mid}，已索引 ${up.indexedVideos}/${up.totalVideos}）`).join('；')}\n` +
    `- 已索引可信 UP 投稿：${output.trustedUpVideos}\n` +
    `- 来自可信 UP 的匹配：${output.trustedUpMatches}\n` +
    `- 自动匹配阈值：${output.minimumConfidence}\n\n` +
    `网页只对达到阈值的条目显示站内播放入口；未匹配或低置信度条目继续使用 B 站搜索链接。BV 号可能因视频下架而失效，需定期重新运行匹配脚本。\n`, 'utf8')
  console.log(JSON.stringify({ totalSongs: output.totalSongs, matchedSongs: output.matchedSongs, trustedUpMatches: output.trustedUpMatches, fetched }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
