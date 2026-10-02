import { useQuery } from '@tanstack/react-query'
import { pingExtension } from '@/lib/extension'

// The QA Ninja extension in this browser, if any: who it's signed in as and whether it can run tests. null when it
// isn't installed. Checked again when the window regains focus, such as after installing it in another tab.
export function useExtension() {
  return useQuery({
    queryKey: ['extension'],
    queryFn: pingExtension,
    staleTime: 10_000,
    retry: false,
  })
}
