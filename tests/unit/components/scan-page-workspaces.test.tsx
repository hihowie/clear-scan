import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScanProcessingOverlay } from '@/components/scan-page-workspaces'

describe('ScanProcessingOverlay', () => {
  it('supports indeterminate engine loading and determinate photo progress', () => {
    const { rerender } = render(
      <ScanProcessingOverlay
        open
        progress={0}
        indeterminate
        title="首次加载图像引擎"
        label="正在下载图像引擎"
      />,
    )

    expect(screen.getByText('首次加载图像引擎')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()

    rerender(
      <ScanProcessingOverlay
        open
        progress={54.6}
        indeterminate={false}
        title="正在重新识别边缘"
        label="正在比较多种边缘候选"
      />,
    )

    expect(screen.getByText('正在重新识别边缘')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '55')
    expect(screen.getByText('55%')).toBeInTheDocument()
  })
})
