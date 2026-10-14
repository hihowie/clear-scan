import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { db, updatePageMetadata } from '@/lib/db'
import type { ScanPage, ScanProject } from '@/lib/types'
import { messages } from '@/lib/i18n'

export function useScanPersistence(page: ScanPage | undefined, project: ScanProject | undefined) {
  const pageRef = useRef(page)
  const projectRef = useRef(project)

  const persistActivePage = useCallback(async (automatic = false) => {
    const latestPage = pageRef.current
    const latestProject = projectRef.current
    if (!latestPage || !latestProject) return
    const updatedAt = Date.now()
    try {
      // Submit the timestamp before Home/History can query the destination
      // list, even if this page is waiting behind an earlier metadata write.
      await Promise.all([
        db.projects.update(latestProject.id, { updatedAt }),
        updatePageMetadata({ ...latestPage, updatedAt }),
      ])
    } catch (reason) {
      toast.error(automatic ? messages.autosaveFailed : messages.pageSaveFailed, {
        id: automatic ? 'scan-autosave-error' : 'scan-flush-error',
        description: reason instanceof Error ? reason.message : messages.storageWriteFailed,
      })
    }
  }, [])

  useEffect(() => {
    const previous = pageRef.current
    pageRef.current = page
    projectRef.current = project
    // Metadata is small and must survive a reload immediately after an edit.
    // Loading or selecting an already stored page does not create a new edit.
    if (page && page.id === previous?.id && page !== previous) void persistActivePage(true)
  }, [page, project, persistActivePage])

  useEffect(() => {
    const flush = () => {
      void persistActivePage()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flush()
    }
  }, [persistActivePage])

  return { pageRef, persistActivePage }
}
