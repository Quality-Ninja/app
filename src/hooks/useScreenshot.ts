import { useEffect, useState } from 'react'
import { errorMessage, fetchFile } from '@/lib/api'
import { useNotice } from './useNotice'

// Screenshots need the sign-in token, so they load as blobs as they come near the viewport. The blob URL is released
// when the step leaves the page.
export function useScreenshot(path: string) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [url, setUrl] = useState<string>()
  const { say } = useNotice()

  useEffect(() => {
    if (!node) return
    let active = true
    let objectUrl: string | undefined
    const load = async () => {
      try {
        const { blob } = await fetchFile(path)
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } catch (error) {
        if (active) say(errorMessage(error), true)
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void load()
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => {
      active = false
      observer.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [node, path, say])

  return { ref: setNode, url }
}
