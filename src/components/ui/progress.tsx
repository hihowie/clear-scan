import { cn } from '@/lib/utils'

export function Progress({
  value,
  indeterminate = false,
  className,
}: {
  value: number
  indeterminate?: boolean
  className?: string
}) {
  const normalizedValue = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(normalizedValue)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary',
          indeterminate
            ? 'progress-indeterminate absolute inset-y-0'
            : 'transition-[width] duration-300',
        )}
        style={indeterminate ? undefined : { width: `${normalizedValue}%` }}
      />
    </div>
  )
}
