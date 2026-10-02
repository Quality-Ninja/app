// UI icons: small inline SVGs on a 24px grid, 2px stroke, round caps (design/design.md), sized by CSS.
import type { ReactNode } from 'react'

function Icon({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      {children}
    </svg>
  )
}

export const BackIcon = () => (
  <Icon className='icon-back'>
    <path d='m12 19-7-7 7-7M19 12H5' />
  </Icon>
)

export const CopyIcon = () => (
  <Icon className='icon-copy'>
    <rect x='9' y='9' width='12' height='12' rx='2' />
    <path d='M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' />
  </Icon>
)

export const CheckIcon = () => (
  <Icon className='icon-done'>
    <path d='M20 6 9 17l-5-5' />
  </Icon>
)

export const PlayIcon = () => (
  <Icon className='icon-play'>
    <path d='M7 5v14l11-7z' />
  </Icon>
)
