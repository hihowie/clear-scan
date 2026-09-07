import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { db, updatePageMetadata } from '@/lib/db'
import type { ScanPage, ScanProject } from '@/lib/types'

export function useScanPersistence(page: ScanPage | undefined, project: ScanProject | undefined) {
  const pageRef = useRef(page)
  const projectRef = useRef(project)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    pageRef.current = page
    projectRef.current = project
  }, [page, project])

  const persistActivePage = useCallback(async (automatic = false) => {
    window.clearTimeout(timerRef.current)
    const latestPage = pageRef.current
    const latestProject = projectRef.current
    if (!latestPage || !latestProject) return
    const updatedAt = Date.now()
    try {
      // Submit the timestamp before Home/History can query the destination
      // list, even if this page is waiting behind an earlier save.
      await Promise.all([
        db.projects.update(latestProject.id, { updatedAt }),
        updatePageMetadata({ ...latestPage, updatedAt }),
      ])
    } catch (reason) {
      toast.error(automatic ? '自动保存失败' : '页面保存失败', {
        id: automatic ? 'scan-autosave-error' : 'scan-flush-error',
        description: reason instanceof Error ? reason.message : '浏览器无法写入本地存储',
      })
    }
  }, [])

  useEffect(
    () => () => {
      void persistActivePage()
    },
    [persistActivePage],
  )

  useEffect(() => {
    if (!page || !project) return
    timerRef.current = window.setTimeout(() => {
      void persistActivePage(true)
    }, 700)
    return () => window.clearTimeout(timerRef.current)
  }, [page, project, persistActivePage])

  return { pageRef, persistActivePage }
}
