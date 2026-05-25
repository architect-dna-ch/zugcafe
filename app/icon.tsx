import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: 512, height: 512, background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 120, fontSize: 280
    }}>
      ☕
    </div>
  )
}
