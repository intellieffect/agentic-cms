/**
 * Carousel PNG export utility.
 *
 * Renders each slide to a 1080×1350 PNG using html-to-image,
 * then packages them into a ZIP for download.
 */
import { toPng } from 'html-to-image'

export interface ExportOptions {
  width?: number
  height?: number
  pixelRatio?: number
}

/**
 * Render a single slide element to PNG data URL.
 */
export async function renderSlideToPng(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<string> {
  const { width = 1080, height = 1350, pixelRatio = 2 } = options
  return toPng(element, {
    width,
    height,
    pixelRatio,
    cacheBust: true,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
  })
}

/**
 * Download a data URL as a file.
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

/**
 * Convert data URL to Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i)
  return new Blob([u8arr], { type: mime })
}

/**
 * Download multiple PNGs as a ZIP.
 * Uses dynamic import to keep bundle small when not exporting.
 */
export async function downloadSlidesAsZip(
  dataUrls: string[],
  projectTitle: string
) {
  // Dynamically import JSZip-like functionality using simple manual ZIP
  // For simplicity, download each slide individually if JSZip not available
  if (dataUrls.length === 1) {
    downloadDataUrl(dataUrls[0], `${projectTitle}_slide_1.png`)
    return
  }

  // Try to use JSZip if available, otherwise download individually
  try {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    dataUrls.forEach((url, i) => {
      const blob = dataUrlToBlob(url)
      zip.file(`${projectTitle}_slide_${i + 1}.png`, blob)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.download = `${projectTitle}_carousel.zip`
    link.href = URL.createObjectURL(content)
    link.click()
    URL.revokeObjectURL(link.href)
  } catch {
    // Fallback: download each slide individually
    dataUrls.forEach((url, i) => {
      setTimeout(() => downloadDataUrl(url, `${projectTitle}_slide_${i + 1}.png`), i * 300)
    })
  }
}
