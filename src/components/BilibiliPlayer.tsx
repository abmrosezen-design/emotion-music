import { ExternalLink, Play, X } from 'lucide-react'

export interface BilibiliVideo {
  bvid: string
  title: string
  author: string
  confidence: number
  pageUrl: string
  sourceType?: string
  upMid?: string | number | null
  upName?: string
}

interface BilibiliPlayerProps {
  songTitle: string
  video: BilibiliVideo
  active: boolean
  onOpen: () => void
  onClose: () => void
}

export default function BilibiliPlayer({ songTitle, video, active, onOpen, onClose }: BilibiliPlayerProps) {
  if (!active) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center justify-between rounded-[18px] border border-white/12 bg-white/[0.055] px-4 py-3.5 text-left transition-all hover:border-white/28 hover:bg-white/[0.1]"
      >
        <span>
          <span className="block font-body text-[12px] font-medium text-white/85">在本页播放</span>
          <span className="mt-0.5 block font-body text-[9px] tracking-[0.12em] text-white/35">由哔哩哔哩提供视频与音频</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:scale-105">
          <Play size={14} fill="currentColor" />
        </span>
      </button>
    )
  }

  const source = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(video.bvid)}&autoplay=0&danmaku=0&poster=1&refer=1`

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/14 bg-black/35">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-body text-[11px] font-medium text-white/80">正在播放：{songTitle}</p>
          <p className="mt-0.5 truncate font-body text-[9px] text-white/35">
            视频来源：{video.upName || video.author || '哔哩哔哩创作者'}
            {video.sourceType?.startsWith('trusted_up') ? ' · 指定 UP 主' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={video.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在哔哩哔哩打开视频"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭播放器"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={source}
          title={`${songTitle} - 哔哩哔哩播放器`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  )
}
