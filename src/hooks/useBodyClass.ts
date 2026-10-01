import { useLayoutEffect } from 'react'

// A class on <body> while the page is shown (before paint, so the page never flashes the wrong background).
export function useBodyClass(name: string) {
  useLayoutEffect(() => {
    document.body.classList.add(name)
    return () => document.body.classList.remove(name)
  }, [name])
}
