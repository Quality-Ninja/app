import { useEffect, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { useNotice } from '@/hooks/useNotice'
import { useToast } from '@/hooks/useToast'
import { CheckIcon, CopyIcon } from './icons'

// Copy XPath: the glyph turns into a check for 1.5s and a toast confirms what was copied.
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(0)
  const toast = useToast()
  const { say } = useNotice()

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(0), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    if (!navigator.clipboard) {
      say(
        'Copying needs a secure connection. Select the XPath and copy it instead.',
        true
      )
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(Date.now())
      toast('XPath copied', text)
    } catch (error) {
      say(errorMessage(error), true)
    }
  }

  return (
    <button
      type='button'
      className='quiet compact'
      data-copy={text}
      data-copied={copied ? 'true' : undefined}
      onClick={copy}
    >
      <CopyIcon />
      <CheckIcon />
      Copy XPath<span className='sr-only'> {label}</span>
    </button>
  )
}
