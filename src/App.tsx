import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Headphones,
  Heart,
  Lock,
  MessageCircle,
  Music2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  genreOptions,
  labels,
  languageOptions,
  moodCopy,
  moodOptions,
  type GenreId,
  type LanguageId,
  type MoodId,
  type Song,
} from './data'
import {
  getLanguagePool,
  pickRecommendedSong,
  type RecommendationAnswers,
} from './recommendation'
import { analyzeDescription } from './textAnalysis'
import GlowCursor from './components/GlowCursor'

type View = 'hero' | 'quiz' | 'result'

interface Answers {
  mood?: MoodId
  language?: LanguageId
  genre?: GenreId
}

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260510_060007_60275ce7-030c-4668-a160-8f364ec537d3.mp4'

const steps = [
  {
    eyebrow: 'FEELING',
    title: '此刻，你的心情更接近哪一种？',
    description: '不需要分析原因。选择最靠近当下的那个词就好。',
  },
  {
    eyebrow: 'LANGUAGE',
    title: '你想让哪一种语言陪着你？',
    description: '熟悉的字句，或是一种不必完全听懂的声音。',
  },
  {
    eyebrow: 'TEXTURE',
    title: '今天更想听什么样的声音？',
    description: '这是偏好，不是限制。我们会把情绪放在第一位。',
  },
]

function VideoBackdrop({ dimmed }: { dimmed: boolean }) {
  const videoBgRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (dimmed || reducedMotion || !finePointer) {
      gsap.set(videoBgRef.current, { x: 0, y: 0 })
      return
    }

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let frame = 0

    const handleMouseMove = (event: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      targetX = ((event.clientX - cx) / cx) * 20
      targetY = ((event.clientY - cy) / cy) * 20
    }

    const animate = () => {
      currentX += (targetX - currentX) * 0.06
      currentY += (targetY - currentY) * 0.06
      if (videoBgRef.current) {
        gsap.set(videoBgRef.current, { x: currentX, y: currentY })
      }
      frame = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    frame = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(frame)
    }
  }, [dimmed])

  useEffect(() => {
    const videos = videoRefs.current.filter((video): video is HTMLVideoElement => Boolean(video))
    if (videos.length < 2) return

    const fadeDuration = 1.4
    let activeIndex = 0
    let transitioning = false
    const preparedVideos = new Set<number>()

    gsap.set(videos[0], { opacity: 1 })
    gsap.set(videos[1], { opacity: 0 })

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      videos[0].loop = true
      return () => {
        videos[0].loop = false
      }
    }

    const crossfade = async (index: number) => {
      if (index !== activeIndex || transitioning) return

      const current = videos[index]
      const nextIndex = index === 0 ? 1 : 0
      const next = videos[nextIndex]
      transitioning = true

      next.currentTime = 0
      next.playbackRate = 1.25

      try {
        await next.play()
      } catch {
        transitioning = false
        return
      }

      gsap.set(next, { opacity: 0 })
      gsap.to(next, {
        opacity: 1,
        duration: fadeDuration,
        ease: 'power1.inOut',
      })
      gsap.to(current, {
        opacity: 0,
        duration: fadeDuration,
        ease: 'power1.inOut',
        onComplete: () => {
          current.pause()
          current.currentTime = 0
          activeIndex = nextIndex
          transitioning = false
        },
      })
    }

    const timeHandlers = videos.map((video, index) => () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return
      const nextIndex = index === 0 ? 1 : 0
      if (video.duration - video.currentTime <= 8 && !preparedVideos.has(nextIndex)) {
        preparedVideos.add(nextIndex)
        videos[nextIndex].preload = 'auto'
        videos[nextIndex].load()
      }
      const mediaFadeWindow = fadeDuration * video.playbackRate
      if (video.duration - video.currentTime <= mediaFadeWindow) {
        void crossfade(index)
      }
    })

    const endedHandlers = videos.map((_, index) => () => void crossfade(index))

    videos.forEach((video, index) => {
      video.addEventListener('timeupdate', timeHandlers[index])
      video.addEventListener('ended', endedHandlers[index])
    })

    return () => {
      videos.forEach((video, index) => {
        video.removeEventListener('timeupdate', timeHandlers[index])
        video.removeEventListener('ended', endedHandlers[index])
        gsap.killTweensOf(video)
      })
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      <div
        ref={videoBgRef}
        className="absolute -inset-5 origin-center scale-[1.08] will-change-transform"
      >
        {[0, 1].map((index) => (
          <video
            key={index}
            ref={(video) => {
              videoRefs.current[index] = video
            }}
            className="absolute inset-0 h-full w-full object-cover"
            src={VIDEO_URL}
            autoPlay={index === 0}
            muted
            playsInline
            preload={index === 0 ? 'auto' : 'none'}
            aria-hidden="true"
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = 1.25
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/70" />
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-700 ${
          dimmed ? 'opacity-55' : 'opacity-10'
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,transparent_22%,rgba(0,0,0,0.44)_100%)]" />
    </div>
  )
}

function Header({
  view,
  onHome,
  onPrivacy,
}: {
  view: View
  onHome: () => void
  onPrivacy: () => void
}) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-5 py-6 text-white md:px-10 md:py-8">
      <button
        type="button"
        onClick={onHome}
        className="relative z-10 text-left text-[16px] font-semibold tracking-[-0.035em] md:text-[17px]"
        aria-label="返回首页"
      >
        Emotion Music
        <sup className="ml-1 align-super text-[7px] font-medium tracking-[0.12em] text-white/55">BETA</sup>
      </button>

      {view === 'hero' ? (
        <button
          type="button"
          onClick={onPrivacy}
          className="liquid-glass rounded-full px-4 py-2.5 text-[10px] font-medium tracking-[0.12em] text-white/90 transition-colors hover:text-white md:px-5 md:text-[11px]"
        >
          隐私条款
        </button>
      ) : (
        <button
          type="button"
          onClick={onHome}
          className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition-colors hover:text-white"
          aria-label="关闭并返回首页"
        >
          <X size={17} strokeWidth={1.5} />
        </button>
      )}
    </header>
  )
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        tabIndex={-1}
        className="glass-panel relative w-full max-w-[620px] rounded-[28px] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] md:p-9"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 transition-colors hover:bg-white/[0.1] hover:text-white"
          aria-label="关闭隐私条款"
        >
          <X size={17} strokeWidth={1.5} />
        </button>

        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/75">
          <ShieldCheck size={18} strokeWidth={1.5} />
        </div>
        <p className="font-body text-[10px] font-medium tracking-[0.2em] text-white/40">PRIVACY</p>
        <h2 id="privacy-title" className="mt-2 font-hero text-[30px] font-medium tracking-[-0.035em] md:text-[36px]">
          隐私条款
        </h2>
        <p className="mt-3 font-body text-[13px] leading-relaxed text-white/55 md:text-[14px]">
          我们希望推荐贴近你的感受，也尊重每一句没有说出口的话。当前原型遵循以下原则：
        </p>

        <div className="mt-6 space-y-4 border-y border-white/10 py-6 font-body text-[13px] leading-relaxed text-white/65">
          <p><span className="mr-2 text-white">01</span>无需注册或绑定音乐账号，首页文字描述与问答选择只在当前页面中分析并用于生成本次推荐。</p>
          <p><span className="mr-2 text-white">02</span>“此刻想对你说”的内容只有在你主动勾选同意并提交后，才会匿名保存在当前浏览器。</p>
          <p><span className="mr-2 text-white">03</span>原型阶段不会将这些内容上传服务器；清除本站浏览器数据即可删除本地记录。</p>
          <p><span className="mr-2 text-white">04</span>前往网易云音乐、QQ 音乐、酷狗音乐、哔哩哔哩、抖音或 Spotify 后，将适用对应平台的隐私规则。</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-white px-6 py-3 text-[13px] font-medium text-black transition-transform hover:scale-[1.01] active:scale-[0.98]"
        >
          我知道了
        </button>
      </section>
    </div>
  )
}

function Hero({
  visible,
  onStart,
  onDescribe,
}: {
  visible: boolean
  onStart: () => void
  onDescribe: (description: string) => void
}) {
  const [description, setDescription] = useState('')

  const submitDescription = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = description.trim()
    if (trimmed) onDescribe(trimmed)
  }

  return (
    <main className="relative z-20 min-h-screen overflow-hidden">
      <div
        className={`fixed left-1/2 top-[120px] w-full -translate-x-1/2 px-5 text-center transition-all duration-1000 md:top-[76px] ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <p className="mb-4 font-serif text-[17px] italic tracking-wide text-white/70 md:text-[20px]">
          music for the feeling you are in
        </p>
        <h1 className="font-hero text-[clamp(40px,5.4vw,72px)] font-normal leading-[1.1] tracking-[-0.02em] text-white">
          不必急着变好。
        </h1>
        <h2 className="font-hero text-[clamp(40px,5.4vw,72px)] font-normal leading-[1.1] tracking-[-0.02em] text-white/55">
          让一首歌，陪你待在此刻。
        </h2>
      </div>

      <form
        onSubmit={submitDescription}
        className={`fixed left-1/2 top-[46%] w-full max-w-[680px] -translate-x-1/2 -translate-y-1/2 px-5 text-center transition-all delay-150 duration-1000 ${
          visible ? 'opacity-100' : 'translate-y-[calc(-50%+24px)] opacity-0'
        }`}
      >
        <label htmlFor="moment-description" className="mb-3 block font-body text-[11px] font-medium tracking-[0.16em] text-white/55">
          用一句话描述此刻
        </label>
        <div className="liquid-glass flex items-center gap-2 rounded-[26px] p-2 pl-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <input
            id="moment-description"
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 160))}
            placeholder="例如：今天有些疲惫，想听一首安静的法语歌……"
            className="min-w-0 flex-1 bg-transparent py-3 font-body text-[13px] text-white outline-none placeholder:text-white/32 md:text-[14px]"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="分析此刻并推荐歌曲"
            disabled={!description.trim()}
            className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-3 text-[12px] font-medium text-black transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/30 md:px-5 md:text-[13px]"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">分析并推荐</span>
            <span className="sm:hidden">推荐</span>
          </button>
        </div>
        <p className="mt-2 font-body text-[10px] text-white/35">本地分析，不会上传你的描述</p>
      </form>

      <div
        className={`fixed bottom-8 left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-5 px-5 text-center transition-all delay-300 duration-1000 md:bottom-14 md:gap-6 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <p className="max-w-[620px] font-body text-[14px] leading-relaxed text-white md:text-[15px]">
          从情绪、语言到曲风，我们为你挑一首刚好贴近当下的歌。
          <span className="text-white/55"> 每一次推荐，都不催促，只陪伴。</span>
        </p>
        <button
          type="button"
          onClick={onStart}
          className="group flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-[15px] font-medium text-black transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_32px_4px_rgba(255,255,255,0.2)] active:scale-[0.97]"
        >
          寻找此刻的歌
          <ChevronRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
        <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] text-white/70 md:text-[11px]">
          <Lock size={13} strokeWidth={1.5} />
          匿名使用 · 你的感受只属于你
        </div>
      </div>
    </main>
  )
}

function Quiz({
  step,
  answers,
  onSelect,
  onBack,
  onNext,
  panelRef,
}: {
  step: number
  answers: Answers
  onSelect: (value: MoodId | LanguageId | GenreId) => void
  onBack: () => void
  onNext: () => void
  panelRef: React.RefObject<HTMLDivElement | null>
}) {
  const currentValue = step === 0 ? answers.mood : step === 1 ? answers.language : answers.genre
  const options = step === 0 ? moodOptions : step === 1 ? languageOptions : genreOptions
  const canContinue = Boolean(currentValue)

  return (
    <main className="soft-scrollbar fixed inset-0 z-20 overflow-y-auto px-4 pb-8 pt-28 md:px-8 md:pb-12 md:pt-32">
      <div ref={panelRef} className="mx-auto w-full max-w-[980px]">
        <section className="glass-panel rounded-[28px] p-5 md:rounded-[34px] md:p-9 lg:p-11">
          <div className="mb-8 flex items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <span className="font-body text-[10px] font-medium tracking-[0.2em] text-white/45">
                STEP 0{step + 1}
              </span>
              <span className="h-px w-8 bg-white/20" />
              <span className="font-body text-[10px] font-medium tracking-[0.2em] text-white/70">
                {steps[step].eyebrow}
              </span>
            </div>
            <span className="font-serif text-[17px] italic text-white/45">陪伴，而非改变</span>
          </div>

          <div className="mb-8 h-[2px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="mb-8 md:mb-10">
            <h1 className="max-w-[720px] font-hero text-[clamp(28px,4vw,48px)] font-normal leading-[1.12] tracking-[-0.03em] text-white">
              {steps[step].title}
            </h1>
            <p className="mt-3 max-w-[580px] font-body text-[14px] leading-relaxed text-white/52 md:text-[15px]">
              {steps[step].description}
            </p>
          </div>

          <div
            className={`grid gap-2.5 ${
              step === 0
                ? 'grid-cols-2 md:grid-cols-4'
                : step === 1
                  ? 'grid-cols-2 md:grid-cols-4'
                  : 'grid-cols-2 md:grid-cols-5'
            }`}
          >
            {options.map((option) => {
              const selected = currentValue === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  data-selected={selected}
                  onClick={() => onSelect(option.id)}
                  className={`choice-card min-h-[106px] rounded-[18px] border p-4 text-left transition-all duration-300 md:min-h-[118px] md:p-5 ${
                    selected
                      ? 'border-white/60 bg-white/[0.16] shadow-[0_10px_30px_rgba(0,0,0,0.2)]'
                      : 'border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <span className="font-serif text-[22px] italic text-white/65">
                      {'symbol' in option ? option.symbol : '·'}
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                        selected ? 'border-white bg-white text-black' : 'border-white/25 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={2} />
                    </span>
                  </div>
                  <div className="font-hero text-[15px] font-medium text-white md:text-[16px]">{option.label}</div>
                  <div className="mt-1 font-body text-[11px] leading-snug text-white/43 md:text-[12px]">
                    {option.hint}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium tracking-wide text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} strokeWidth={1.5} />
              {step === 0 ? '返回首页' : '上一步'}
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={onNext}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] font-medium text-black transition-all duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/30"
            >
              {step === steps.length - 1 ? '听听此刻' : '继续'}
              {step === steps.length - 1 ? <Sparkles size={14} /> : <ArrowRight size={14} />}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function AlbumArtwork({ song }: { song: Song }) {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/15 shadow-[0_28px_80px_rgba(0,0,0,0.38)]"
      style={{
        background: `linear-gradient(145deg, ${song.accent[0]}, ${song.accent[1]})`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.32),transparent_23%),linear-gradient(160deg,transparent_30%,rgba(0,0,0,0.5))]" />
      <div className="absolute -right-[12%] top-[17%] h-[72%] w-[72%] rounded-full border border-white/20 bg-black/20 shadow-[inset_0_0_0_28px_rgba(0,0,0,0.08),inset_0_0_0_29px_rgba(255,255,255,0.08)] backdrop-blur-[1px]" />
      <div className="absolute bottom-5 left-5 right-5">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <Music2 size={16} />
        </div>
        <div className="font-hero text-[22px] font-medium tracking-[-0.03em] text-white">{song.title}</div>
        <div className="mt-1 font-body text-[12px] tracking-[0.12em] text-white/60">{song.artist}</div>
      </div>
      <div className="absolute left-5 top-5 font-body text-[9px] font-medium tracking-[0.2em] text-white/55">
        FOR THIS MOMENT
      </div>
    </div>
  )
}

function Result({
  answers,
  song,
  onAgain,
  onRestart,
  panelRef,
}: {
  answers: Required<Answers>
  song: Song
  onAgain: () => void
  onRestart: () => void
  panelRef: React.RefObject<HTMLDivElement | null>
}) {
  const [reflection, setReflection] = useState('')
  const [consent, setConsent] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null)
  const copy = moodCopy[answers.mood]
  const query = `${song.title} ${song.artist}`

  const platforms = [
    {
      name: '网易云音乐',
      short: 'NETEASE',
      url: `https://music.163.com/#/search/m/?s=${encodeURIComponent(query)}&type=1`,
    },
    {
      name: 'QQ 音乐',
      short: 'QQ MUSIC',
      url: `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(query)}`,
    },
    {
      name: '酷狗音乐',
      short: 'KUGOU',
      url: `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(query)}`,
    },
    {
      name: '哔哩哔哩',
      short: 'BILIBILI',
      url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
    },
    {
      name: '抖音',
      short: 'DOUYIN',
      url: `https://www.douyin.com/search/${encodeURIComponent(query)}?type=general`,
    },
    {
      name: 'Spotify',
      short: 'SPOTIFY',
      url: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    },
  ]

  const saveReflection = () => {
    if (!reflection.trim() || !consent) return
    try {
      const stored = localStorage.getItem('emotion-music-reflections')
      let parsed: unknown = []
      if (stored) {
        try {
          parsed = JSON.parse(stored)
        } catch {
          parsed = []
        }
      }
      const existing = Array.isArray(parsed) ? parsed.slice(-99) : []
      existing.push({
        text: reflection.trim(),
        mood: answers.mood,
        language: answers.language,
        genre: answers.genre,
        songId: song.id,
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('emotion-music-reflections', JSON.stringify(existing))
      setSaveError(false)
      setSaved(true)
    } catch {
      setSaved(false)
      setSaveError(true)
    }
  }

  return (
    <main
      data-song-language={song.language}
      className="soft-scrollbar fixed inset-0 z-20 overflow-y-auto px-4 pb-10 pt-24 md:px-8 md:pt-28"
    >
      <div ref={panelRef} className="mx-auto w-full max-w-[1180px]">
        <div className="mb-5 flex items-end justify-between px-1">
          <div>
            <div className="mb-2 flex items-center gap-2 font-body text-[10px] font-medium tracking-[0.2em] text-white/55">
              <Sparkles size={12} />
              YOUR SONG, RIGHT NOW
            </div>
            <h1 className="font-hero text-[clamp(27px,3.5vw,46px)] font-normal tracking-[-0.035em] text-white">
              给此刻的你
            </h1>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-[11px] font-medium tracking-wide text-white/55 transition-colors hover:text-white md:flex"
          >
            <RefreshCw size={13} />
            重新感受
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="glass-panel rounded-[28px] p-5 md:p-7 lg:p-8">
            <div className="grid gap-7 md:grid-cols-[220px_1fr] lg:grid-cols-[250px_1fr]">
              <AlbumArtwork song={song} />
              <div className="flex min-w-0 flex-col justify-between py-1">
                <div>
                  <p className="font-serif text-[24px] italic leading-tight text-white/82 md:text-[29px]">{copy.title}</p>
                  <p className="mt-3 font-body text-[14px] leading-relaxed text-white/52">{copy.text}</p>

                  <div className="my-6 h-px bg-white/10" />

                  <p className="font-body text-[11px] font-medium tracking-[0.16em] text-white/40">为你推荐</p>
                  <h2 className="mt-2 font-hero text-[30px] font-medium tracking-[-0.04em] text-white md:text-[36px]">
                    {song.title}
                  </h2>
                  <p className="mt-1 font-body text-[14px] text-white/58">{song.artist}</p>

                  <p className="mt-5 font-body text-[14px] leading-relaxed text-white/65">
                    <span className="text-white/35">推荐理由：</span>
                    {song.reason}
                  </p>
                </div>

                <p className="mt-6 font-body text-[12px] text-white/42">
                  你现在感到<span className="mx-1 text-white/72">{labels.moods[answers.mood]}</span>，想听
                  <span className="mx-1 text-white/72">{labels.languages[answers.language]}</span>的
                  <span className="mx-1 text-white/72">{labels.genres[answers.genre]}</span>陪伴这种情绪。
                </p>
              </div>
            </div>

            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-body text-[10px] font-medium tracking-[0.18em] text-white/40">选择常用平台搜索</p>
                <div className="flex items-center gap-2 text-[10px] text-white/35">
                  <Headphones size={12} />
                  站外收听
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {platforms.map((platform) => (
                  <a
                    key={platform.name}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-[16px] border border-white/10 bg-white/[0.045] px-4 py-3.5 transition-all hover:border-white/30 hover:bg-white/[0.1]"
                  >
                    <div>
                      <div className="font-body text-[12px] font-medium text-white/85">{platform.name}</div>
                      <div className="mt-0.5 font-body text-[8px] tracking-[0.16em] text-white/30">{platform.short}</div>
                    </div>
                    <ExternalLink size={14} className="text-white/35 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" />
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="mr-1 font-body text-[11px] text-white/40">符合此刻吗？</span>
                <button
                  type="button"
                  onClick={() => setFeedback('yes')}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] transition-all ${
                    feedback === 'yes'
                      ? 'border-white bg-white text-black'
                      : 'border-white/12 bg-white/[0.04] text-white/60 hover:text-white'
                  }`}
                >
                  <Heart size={12} fill={feedback === 'yes' ? 'currentColor' : 'none'} />
                  符合
                </button>
                <button
                  type="button"
                  onClick={() => setFeedback('no')}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] transition-all ${
                    feedback === 'no'
                      ? 'border-white bg-white text-black'
                      : 'border-white/12 bg-white/[0.04] text-white/60 hover:text-white'
                  }`}
                >
                  <X size={12} />
                  不太符合
                </button>
              </div>
              <button
                type="button"
                onClick={onAgain}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-medium text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <RefreshCw size={13} />
                换一首
              </button>
            </div>
          </section>

          <aside className="glass-panel flex flex-col rounded-[28px] p-5 md:p-7 lg:p-8">
            <div className="mb-7 w-full">
              <div className="w-full">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/70">
                  <MessageCircle size={16} strokeWidth={1.5} />
                </div>
                <h2 id="reflection-title" className="font-hero text-[24px] font-medium tracking-[-0.03em] text-white">此刻想对你说</h2>
                <p id="reflection-help" className="mt-2 w-full text-left font-body text-[13px] leading-relaxed text-white/45">
                  如果愿意，可以留下一句话。它会帮助我们写出更贴近人心的文案。
                </p>
              </div>
            </div>

            <div className="relative flex-1">
              <textarea
                aria-labelledby="reflection-title"
                aria-describedby="reflection-help reflection-count"
                value={reflection}
                onChange={(event) => {
                  setReflection(event.target.value.slice(0, 300))
                  setSaved(false)
                  setSaveError(false)
                }}
                placeholder="不用完整，也不必漂亮。写下此刻最真实的一句话……"
                className="min-h-[150px] w-full resize-none rounded-[20px] border border-white/12 bg-black/20 p-4 font-body text-[14px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/35 md:min-h-[190px]"
              />
              <span id="reflection-count" className="absolute bottom-3 right-4 text-[10px] text-white/25">{reflection.length}/300</span>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[16px] border border-white/8 bg-white/[0.025] p-3.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked)
                  setSaved(false)
                  setSaveError(false)
                }}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-white"
              />
              <span className="font-body text-[11px] leading-relaxed text-white/48">
                允许匿名用于优化文案。请勿填写姓名、电话、住址等个人敏感信息。
              </span>
            </label>

            <button
              type="button"
              disabled={!reflection.trim() || !consent || saved}
              onClick={saveReflection}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-5 py-3 text-[12px] font-medium text-white transition-all hover:bg-white/[0.13] disabled:cursor-not-allowed disabled:text-white/25"
            >
              {saved ? <Check size={14} /> : <ShieldCheck size={14} />}
              {saved ? '已匿名保存在当前浏览器' : '匿名提交这句话'}
            </button>
            {saveError && (
              <p role="status" className="mt-3 text-center font-body text-[10px] leading-relaxed text-amber-200/70">
                浏览器未能保存。请检查无痕模式或站点存储权限后重试。
              </p>
            )}
            <p className="mt-3 text-center font-body text-[10px] leading-relaxed text-white/28">
              原型阶段不会上传服务器，可随时清除浏览器数据。
            </p>

            <button
              type="button"
              onClick={onRestart}
              className="mt-5 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[11px] text-white/45 transition-colors hover:text-white md:hidden"
            >
              <RefreshCw size={12} />
              重新感受
            </button>
          </aside>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 font-body text-[9px] font-medium tracking-[0.16em] text-white/30">
          <Lock size={11} strokeWidth={1.5} />
          MUSIC COMPANIONSHIP · NOT MEDICAL ADVICE
        </div>
      </div>
    </main>
  )
}

function App() {
  const [view, setView] = useState<View>('hero')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [seenSongIds, setSeenSongIds] = useState<string[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroVisible(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!panelRef.current || view === 'hero') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(panelRef.current, { opacity: 1, y: 0, scale: 1 })
      return
    }
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 22, scale: 0.992 },
      { opacity: 1, y: 0, scale: 1, duration: 0.72, ease: 'power3.out' },
    )
    return () => {
      if (panelRef.current) gsap.killTweensOf(panelRef.current)
    }
  }, [view, step, currentSong?.id])

  const requiredAnswers = useMemo(() => {
    if (!answers.mood || !answers.language || !answers.genre) return null
    return answers as Required<Answers>
  }, [answers])

  const chooseSong = (excluded: string[] = []) => {
    if (!requiredAnswers) return
    const next = pickRecommendedSong(requiredAnswers as RecommendationAnswers, excluded)
    setCurrentSong(next)
    setSeenSongIds((previous) => [...previous, next.id])
  }

  const startQuiz = () => {
    setHeroVisible(false)
    window.setTimeout(() => {
      setView('quiz')
      setStep(0)
    }, 320)
  }

  const recommendFromDescription = (description: string) => {
    const inferredAnswers = analyzeDescription(description)
    const selectedSong = pickRecommendedSong(inferredAnswers)

    setHeroVisible(false)
    setAnswers(inferredAnswers)
    setCurrentSong(selectedSong)
    setSeenSongIds([selectedSong.id])
    window.setTimeout(() => setView('result'), 320)
  }

  const goHome = () => {
    setView('hero')
    setStep(0)
    setAnswers({})
    setCurrentSong(null)
    setSeenSongIds([])
    window.setTimeout(() => setHeroVisible(true), 100)
  }

  const selectCurrent = (value: MoodId | LanguageId | GenreId) => {
    if (step === 0) setAnswers((previous) => ({ ...previous, mood: value as MoodId }))
    if (step === 1) setAnswers((previous) => ({ ...previous, language: value as LanguageId }))
    if (step === 2) setAnswers((previous) => ({ ...previous, genre: value as GenreId }))
  }

  const back = () => {
    if (step === 0) {
      goHome()
      return
    }
    setStep((previous) => previous - 1)
  }

  const next = () => {
    const selected = step === 0 ? answers.mood : step === 1 ? answers.language : answers.genre
    if (!selected) return
    if (step < 2) {
      setStep((previous) => previous + 1)
      return
    }

    if (answers.mood && answers.language && answers.genre) {
      const completed = answers as Required<Answers>
      const selectedSong = pickRecommendedSong(completed as RecommendationAnswers)
      setCurrentSong(selectedSong)
      setSeenSongIds([selectedSong.id])
      setView('result')
    }
  }

  const chooseAnother = () => {
    if (!requiredAnswers) return
    const languagePool = getLanguagePool(requiredAnswers as RecommendationAnswers)
    const hasUnseenSong = languagePool.some((song) => !seenSongIds.includes(song.id))
    const excluded = hasUnseenSong ? seenSongIds : []
    if (!hasUnseenSong) setSeenSongIds([])
    chooseSong(excluded)
  }

  const restart = () => {
    setAnswers({})
    setCurrentSong(null)
    setSeenSongIds([])
    setStep(0)
    setView('quiz')
  }

  return (
    <GlowCursor
      color="#72D6E3"
      secondaryColor="#D6A15C"
      trailLength={36}
      trailWidth={7}
      trailTaper={0.84}
      followSpeed={0.16}
      glowIntensity={1.65}
      glowSpread={1.15}
      hotspot={0.66}
      brightness={1.15}
      opacity={0.82}
      pulseSpeed={0.9}
      noiseStrength={0.025}
      idleFade
      idleTimeout={650}
      fadeDuration={850}
      blendMode="screen"
      maxDevicePixelRatio={1.35}
    >
      <div
        className="min-h-screen overflow-x-hidden bg-black text-white"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <VideoBackdrop dimmed={view !== 'hero'} />
        <div className="grain" />
        <Header view={view} onHome={goHome} onPrivacy={() => setPrivacyOpen(true)} />
        {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

        {view === 'hero' && (
          <Hero visible={heroVisible} onStart={startQuiz} onDescribe={recommendFromDescription} />
        )}
        {view === 'quiz' && (
          <Quiz
            step={step}
            answers={answers}
            onSelect={selectCurrent}
            onBack={back}
            onNext={next}
            panelRef={panelRef}
          />
        )}
        {view === 'result' && requiredAnswers && currentSong && (
          <Result
            answers={requiredAnswers}
            song={currentSong}
            onAgain={chooseAnother}
            onRestart={restart}
            panelRef={panelRef}
          />
        )}
      </div>
    </GlowCursor>
  )
}

export default App
