
'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect, useState } from 'react'

export function FacebookPixel() {
  const [loaded, setLoaded] = useState(false)
  const pathname = usePathname()

  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

  useEffect(() => {
    if (!loaded) return
    window.fbq('track', 'PageView')
  }, [pathname, loaded])

  if (!pixelId) {
    return null
  }

  return (
    <>
      <Script
        id="fb-pixel"
        src="/scripts/facebook-pixel.js"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        data-pixel-id={pixelId}
      />
    </>
  )
}
