import crypto from 'node:crypto'

/**
 * Verify the `X-Twilio-Signature` header on an inbound Twilio webhook.
 *
 * Twilio signs each request with your Auth Token. The signature is:
 *
 *   base64( HMAC-SHA1( authToken,
 *           fullUrl + concat(sortedParamName + paramValue) ) )
 *
 * where the POST body params are appended in alphabetical order by
 * name. See:
 *   https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * `fullUrl` must be the exact URL Twilio was configured to call,
 * including scheme, host, path, and any query string.
 */
export function verifyTwilioSignature(args: {
  authToken: string
  signatureHeader: string | null
  url: string
  params: Record<string, string>
}): boolean {
  const { authToken, signatureHeader, url, params } = args
  if (!authToken || !signatureHeader) return false

  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
