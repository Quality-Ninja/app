import { useEffect } from 'react'

// Sets the tab title. null leaves it alone, so an error page can set its own.
export function useTitle(title: string | null) {
  useEffect(() => {
    if (title) document.title = title
  }, [title])
}
