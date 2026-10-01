import type { ReactNode } from 'react'

// Lit like the header, with a ghost trail: two ring nodes and the gold waypoint the path will lead to.
export function EmptyState({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className='empty-state'>
      <svg
        className='trail-art'
        viewBox='0 0 220 96'
        aria-hidden='true'
        focusable='false'
      >
        <path
          className='trail-line'
          d='M10 84c40 0 44-34 84-34s44-34 84-34h22'
        />
        <circle className='trail-node' cx='10' cy='84' r='4.5' />
        <circle className='trail-node' cx='94' cy='50' r='4.5' />
        <rect
          className='trail-waypoint'
          x='202'
          y='9'
          width='10'
          height='10'
          rx='1'
          transform='rotate(45 207 14)'
        />
      </svg>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
