import { useScreenshot } from '@/hooks/useScreenshot'

// A screenshot behind the sign-in token. The link and image get their blob: URL once it has loaded (useScreenshot);
// the link opens it full size.
export function Screenshot({ path, alt }: { path: string; alt: string }) {
  const { ref, url } = useScreenshot(path)
  return (
    <a
      ref={ref}
      className='step-shot'
      href={url}
      target='_blank'
      rel='noopener'
      data-shot={path}
    >
      <img alt={alt} src={url} />
    </a>
  )
}
