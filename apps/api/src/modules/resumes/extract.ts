import { extractText, getDocumentProxy } from 'unpdf'
import { AppError } from '../../lib/errors'
import { ERROR_CODES } from '@copilot/shared'

const EXTRACT_TIMEOUT_MS = 15_000
/** Enough for any real resume; keeps hostile PDFs from producing megabytes of text. */
const MAX_TEXT_CHARS = 100_000

export const hasPdfMagic = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 // %PDF

export const unreadablePdf = () =>
  new AppError(
    422,
    ERROR_CODES.VALIDATION,
    "We couldn't read text from this PDF. It may be a scanned image — export a text-based PDF and try again.",
  )

/** PDF bytes → plain text (pdf.js via unpdf). Throws 422 for scanned/broken/empty PDFs. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  let timer: NodeJS.Timeout | undefined
  try {
    const work = (async () => {
      // pdf.js may detach the buffer it is given — pass a copy.
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      return (await extractText(pdf, { mergePages: true })).text
    })()
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('PDF extraction timed out')), EXTRACT_TIMEOUT_MS)
    })
    const text = (await Promise.race([work, timeout])).slice(0, MAX_TEXT_CHARS)
    if (text.trim().length < 40) throw new Error('empty')
    return text
  } catch {
    throw unreadablePdf()
  } finally {
    clearTimeout(timer)
  }
}
