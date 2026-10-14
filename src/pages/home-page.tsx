import {
  ArrowRight,
  Check,
  CreditCard,
  FileStack,
  FileText,
  LockKeyhole,
  Plane,
  ScanLine,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProjectCard } from '@/components/project-card'
import { useScannerNavigation } from '@/hooks/use-scanner-navigation'
import { useProjectSummaries } from '@/hooks/use-projects'
import type { ScanMode } from '@/lib/types'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

export function HomePage() {
  useLocale()
  const modes: Array<{
    mode: ScanMode
    title: string
    description: string
    detail: string
    icon: typeof CreditCard
    tone: string
  }> = [
    {
      mode: 'id-card',
      title: messages.idCardScan,
      description: messages.idCardDescription,
      detail: messages.idCardDetail,
      icon: CreditCard,
      tone: 'from-emerald-50 to-teal-100/70 text-emerald-800',
    },
    {
      mode: 'passport',
      title: messages.passportScan,
      description: messages.passportDescription,
      detail: messages.passportDetail,
      icon: Plane,
      tone: 'from-amber-50 to-orange-100/70 text-amber-800',
    },
    {
      mode: 'document',
      title: messages.documentScan,
      description: messages.documentDescription,
      detail: messages.documentDetail,
      icon: FileText,
      tone: 'from-sky-50 to-cyan-100/70 text-sky-800',
    },
  ]
  const openScanner = useScannerNavigation()
  const { summaries, loading } = useProjectSummaries(4)

  return (
    <div className="pb-16 pt-8 sm:pt-12 lg:pb-24 lg:pt-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-[#edf7f1] px-6 py-10 sm:px-10 lg:grid lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-14 lg:py-14">
        <div className="relative z-10 max-w-2xl">
          <Badge className="mb-5 bg-white/75">
            <ShieldCheck className="size-3.5" /> {messages.privacyBadge}
          </Badge>
          <h1 className="text-balance text-4xl font-bold leading-[1.12] tracking-[-0.04em] sm:text-5xl lg:text-[3.4rem]">
            {messages.heroLead} <br className="hidden sm:block" />
            {messages.heroSecond} <span className="text-primary">{messages.heroHighlight}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            {messages.heroDescription}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => openScanner('/scan/document')}>
              <ScanLine className="size-5" /> {messages.startScan}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('scan-modes')?.scrollIntoView()}
            >
              {messages.chooseScanType} <ArrowRight />
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> {messages.noSignup}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> {messages.worksOffline}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> {messages.noWatermark}
            </span>
          </div>
        </div>

        <div className="relative mx-auto mt-12 w-full max-w-lg lg:mt-0">
          <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative rotate-[1.5deg] rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-[0_30px_80px_rgba(24,70,50,.16)] backdrop-blur">
            <div className="paper-grid relative aspect-[4/3] overflow-hidden rounded-[1.4rem] p-7">
              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />{' '}
                {messages.edgesDetected}
              </div>
              <div className="mx-auto mt-7 flex h-[78%] w-[76%] rotate-[-2deg] flex-col rounded-sm bg-[#fffef8] p-6 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="size-9 rounded-full bg-emerald-100" />
                  <div className="space-y-2">
                    <div className="h-2 w-28 rounded bg-slate-300" />
                    <div className="h-1.5 w-20 rounded bg-slate-200" />
                  </div>
                </div>
                <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-1.5 rounded bg-slate-200" />
                    ))}
                  </div>
                  <div className="rounded bg-emerald-50" />
                </div>
              </div>
              <span className="absolute left-[10%] top-[18%] size-5 border-l-2 border-t-2 border-emerald-400" />
              <span className="absolute right-[9%] top-[16%] size-5 border-r-2 border-t-2 border-emerald-400" />
              <span className="absolute bottom-[9%] left-[12%] size-5 border-b-2 border-l-2 border-emerald-400" />
              <span className="absolute bottom-[10%] right-[10%] size-5 border-b-2 border-r-2 border-emerald-400" />
            </div>
            <div className="grid grid-cols-3 gap-2 px-1 pb-1 pt-4 text-center text-[10px] font-semibold text-muted-foreground">
              <span>
                <Sparkles className="mx-auto mb-1 size-4 text-primary" />
                {messages.autoEnhance}
              </span>
              <span>
                <FileStack className="mx-auto mb-1 size-4 text-primary" />
                {messages.multiPagePdf}
              </span>
              <span>
                <LockKeyhole className="mx-auto mb-1 size-4 text-primary" />
                {messages.localProcessing}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="scan-modes" className="pt-14 sm:pt-20">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Scan modes</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {messages.whatToScan}
            </h2>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">{messages.scanTypesHint}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {modes.map((mode) => (
            <button
              key={mode.mode}
              type="button"
              onClick={() => openScanner(`/scan/${mode.mode}`)}
              className="group text-left"
            >
              <Card className="h-full overflow-hidden p-2 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/25 group-hover:shadow-[0_20px_50px_rgba(18,59,42,.09)]">
                <div
                  className={`relative flex aspect-[16/8] items-center justify-center overflow-hidden rounded-[1.25rem] bg-gradient-to-br ${mode.tone}`}
                >
                  <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
                  <mode.icon className="relative size-16 stroke-[1.2] transition duration-300 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{mode.title}</h3>
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-white">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground/75">{mode.description}</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{mode.detail}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <section className="pt-14 sm:pt-20">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
              Recent scans
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{messages.recentScans}</h2>
          </div>
          {summaries.length > 0 && (
            <Button asChild variant="ghost">
              <Link to="/history">
                {messages.viewAll} <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : summaries.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaries.map((summary) => (
              <ProjectCard key={summary.project.id} summary={summary} />
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center border-dashed px-6 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <FileStack />
            </div>
            <h3 className="mt-4 font-semibold">{messages.noHistory}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{messages.recentEmpty}</p>
          </Card>
        )}
      </section>

      <section className="mt-14 grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-3 sm:p-8">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-bold">{messages.noUpload}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {messages.noUploadDescription}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-bold">{messages.offlineAfterSetup}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {messages.offlineAfterSetupDescription}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-bold">{messages.clearAnytime}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {messages.clearAnytimeDescription}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
