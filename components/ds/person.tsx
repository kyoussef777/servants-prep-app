import Link from 'next/link'
import { getPersonInitials } from '@/lib/person-name'
import { cn } from '@/lib/utils'

/** Initials disc; photos when we have one. Accent tint, so it follows the ministry. */
export function Initials({
  name,
  imageUrl,
  size = 28,
  className,
}: {
  name?: string | null
  imageUrl?: string | null
  size?: number
  className?: string
}) {
  const style = { width: size, height: size, fontSize: size <= 28 ? 11 : 12 }
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" style={style} className={cn('shrink-0 rounded-full object-cover', className)} />
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-tint font-semibold tracking-[0.02em] text-accent-ink',
        className
      )}
    >
      {getPersonInitials(name)}
    </span>
  )
}

/** People's names lead every table (research finding 01). */
export function PersonCell({
  name,
  meta,
  href,
  onClick,
  imageUrl,
  className,
}: {
  name: string
  meta?: React.ReactNode
  href?: string
  onClick?: () => void
  imageUrl?: string | null
  className?: string
}) {
  const nameNode = href ? (
    <Link href={href} className="truncate font-medium text-ink no-underline hover:underline">
      {name}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className="cursor-pointer truncate text-left font-medium text-ink hover:underline">
      {name}
    </button>
  ) : (
    <span className="truncate font-medium text-ink">{name}</span>
  )
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Initials name={name} imageUrl={imageUrl} />
      <div className="flex min-w-0 flex-col leading-[1.3]">
        {nameNode}
        {meta && <span className="truncate text-xs text-ink-3">{meta}</span>}
      </div>
    </div>
  )
}
