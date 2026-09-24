import { describe, expect, it } from 'vitest'
import { extractFaqsFromText } from './faq-sources'

describe('extractFaqsFromText', () => {
  it('parses explicit Q/A blocks', () => {
    const faqs = extractFaqsFromText(`Q: Do you ship internationally?
A: Yes, we ship to most countries.

Q: How long is delivery?
A: Delivery usually takes 3 to 5 business days.`)
    expect(faqs.length).toBeGreaterThanOrEqual(2)
    expect(faqs[0].question).toMatch(/ship internationally/i)
    expect(faqs[0].answer).toMatch(/most countries/i)
  })

  it('builds a draft from plain paragraphs when no Q/A markup exists', () => {
    const faqs = extractFaqsFromText(
      'Chatbotistic is a WhatsApp CRM for agencies. Capture leads, book meetings, and reply faster from one inbox. Free plans include one widget and one agent.',
    )
    expect(faqs.length).toBeGreaterThan(0)
    expect(faqs[0].answer.length).toBeGreaterThan(20)
  })

  it('returns empty for blank input', () => {
    expect(extractFaqsFromText('   ')).toEqual([])
  })
})
