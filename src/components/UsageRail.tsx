import type { CSSProperties } from 'react'

// One hairline tick per dashboard recording the plan allows, lit up to the number used, like the extension's
// inspection rail. Decoration: the text beside it says the numbers.
export function UsageRail({ used, total }: { used: number; total: number }) {
  const style = {
    '--used': Math.min(used, total),
    '--total': total,
  } as CSSProperties
  return <div className='usage-rail' aria-hidden='true' style={style} />
}
