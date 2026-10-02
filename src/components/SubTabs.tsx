import { type KeyboardEvent, useRef } from 'react'

// In-page tabs on the underline style of the site header's tabs. The open tab is the URL's (?tab=), so choosing one
// navigates; arrow keys, Home, and End move between tabs and open them. The page renders one panel, labelled by the
// open tab: give it the id `${id}-panel`.
export function SubTabs<T extends string>({
  id,
  label,
  tabs,
  current,
  onSelect,
}: {
  id: string
  label: string
  tabs: readonly { value: T; label: string }[]
  current: T
  onSelect: (value: T) => void
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>())

  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    const tab = tabs[next].value
    buttons.current.get(tab)?.focus()
    onSelect(tab)
  }

  return (
    <div role='tablist' aria-label={label} className='tabs sub-tabs'>
      {tabs.map((tab, index) => {
        const selected = tab.value === current
        return (
          <button
            key={tab.value}
            ref={(node) => {
              if (node) buttons.current.set(tab.value, node)
              else buttons.current.delete(tab.value)
            }}
            type='button'
            role='tab'
            id={`${id}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={selected ? `${id}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            data-tab={tab.value}
            onClick={() => onSelect(tab.value)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
