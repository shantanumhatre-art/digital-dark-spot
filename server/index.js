
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenAI } from '@google/genai'
import * as cheerio from 'cheerio'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin(origin, callback) {
    // Allow the local Vite development ports used by this project.
    if (!origin) return callback(null, true)
    try {
      const parsed = new URL(origin)
      const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname)
      const isVitePort = Number(parsed.port) >= 5173 && Number(parsed.port) <= 5180
      return callback(null, isLocalHost && isVitePort)
    } catch {
      return callback(new Error('Origin not allowed by CORS'))
    }
  }
}))

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Digital Dark Spot API' })
})

function cleanText(html) {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg').remove()
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 18000)
}

function validPublicUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false

    const host = url.hostname.toLowerCase()

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith('169.254.')
    ) return false

    return true
  } catch {
    return false
  }
}

async function collectSources(input) {
  const collected = []

  for (const source of input.slice(0, 8)) {
    let text = String(source.text || '').trim()
    const title = String(source.title || 'Untitled source').slice(0, 160)
    const url = String(source.url || '').trim()

    if (!text && url) {
      if (!validPublicUrl(url)) {
        throw new Error(`The URL for "${title}" is not a valid public HTTP/HTTPS address.`)
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 9000)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DigitalDarkSpotResearchPrototype/1.0' }
        })

        if (!response.ok) {
          throw new Error(`Could not retrieve ${url} (HTTP ${response.status}).`)
        }

        const type = response.headers.get('content-type') || ''

        if (!type.includes('text/html') && !type.includes('text/plain')) {
          throw new Error(`"${title}" is not an HTML or plain-text page. Paste its relevant text instead.`)
        }

        const body = await response.text()
        text = type.includes('text/html')
          ? cleanText(body)
          : body.replace(/\s+/g, ' ').trim()
      } finally {
        clearTimeout(timeout)
      }
    }

    if (text) collected.push({ title, url, text: text.slice(0, 18000) })
  }

  return collected
}

const stopWords = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from',
  'your', 'are', 'was', 'were', 'will', 'would', 'could',
  'should', 'have', 'has', 'had', 'you', 'their', 'they',
  'them', 'about', 'into', 'than', 'then', 'there', 'which',
  'who', 'why', 'how', 'not', 'but', 'all', 'any', 'can',
  'may', 'also', 'some', 'more', 'most', 'other', 'each',
  'its', 'our', 'use', 'using', 'used', 'page', 'source',
  'information'
])

function words(text) {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [])
        .filter(word => !stopWords.has(word))
    )
  ]
}

// Initial relevance estimate based on shared topic terms.
// Gemini can refine this classification.
function estimateRelevance(question, source) {
  const questionWords = words(question)
  const sourceWords = new Set(words(source.text))

  if (!questionWords.length) {
    return { status: 'partially relevant', score: 0 }
  }

  const matched = questionWords.filter(word => sourceWords.has(word))
  const score = matched.length / questionWords.length

  let status = 'irrelevant'

  if (score >= 0.35) status = 'relevant'
  else if (score >= 0.15) status = 'partially relevant'

  return { status, score: Math.round(score * 100) }
}

function classifySources(question, sources) {
  return sources.map(source => ({
    ...source,
    relevance: estimateRelevance(question, source)
  }))
}

function normalizeEvidenceText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function validateFindings(items, sources, fallbackItems) {
  if (!Array.isArray(items)) return fallbackItems

  return items.slice(0, 20).map(item => {
    const evidence = (
      Array.isArray(item.evidence) ? item.evidence : []
    ).flatMap(entry => {
      const source = sources.find(
        source => source.title === String(entry.sourceTitle || '')
      )

      const excerpt = String(entry.excerpt || '').trim()

      if (!source || excerpt.length < 20 || excerpt.length > 500) return []

      if (!normalizeEvidenceText(source.text).includes(
        normalizeEvidenceText(excerpt)
      )) return []

      return [{ sourceTitle: source.title, excerpt }]
    })

    return {
      title: String(item.title || 'Untitled finding'),
      detail: String(item.detail || ''),
      sourceTitles: [...new Set([
        ...(Array.isArray(item.sourceTitles)
          ? item.sourceTitles.filter(title =>
              typeof title === 'string' && sources.some(source => source.title === title)
            )
          : []),
        ...evidence.map(entry => entry.sourceTitle)
      ])],
      evidence,
      severity: String(item.severity || 'review')
    }
  })
}

function ruleAnalysis(question, allSources) {
  const sources = classifySources(question, allSources)

  const relevantSources = sources.filter(
    source => source.relevance.status !== 'irrelevant'
  )

  const irrelevantSources = sources.filter(
    source => source.relevance.status === 'irrelevant'
  )

  // If every source is irrelevant, do not analyse them as useful evidence.
  if (!relevantSources.length) {
    return {
      mode: 'rules',
      relevanceWarning: true,
      summary: 'None of the supplied sources appears relevant to the research question. Add sources that directly discuss the topic before relying on gap or conflict analysis.',
      sources: sources.map(source => ({
        title: source.title,
        url: source.url,
        excerpt: source.text.slice(0, 260) + (source.text.length > 260 ? '…' : ''),
        words: source.text.split(/\s+/).filter(Boolean).length,
        relevance: source.relevance
      })),
      gaps: [{
        title: 'No relevant sources found',
        detail: 'The supplied material does not appear to address the research question. This is a source relevance warning, not proof that the topic itself lacks information.',
        sourceTitles: [],
        evidence: []
      }],
      conflicts: [],
      outdated: [],
      checklist: [
        'Find sources that directly address the research question.',
        'Prefer original research, official reports and authoritative publications.',
        'Check each source publication date before analysing its claims.'
      ],
      topics: words(question).slice(0, 8)
    }
  }

  const allText = relevantSources.map(source => source.text).join(' ')
  const questionWords = words(question).slice(0, 14)
  const sourceWords = new Set(words(allText))
  const missing = questionWords.filter(word => !sourceWords.has(word))

  const gaps = []

  if (irrelevantSources.length) {
    gaps.push({
      title: 'Some sources may be irrelevant',
      detail: `${irrelevantSources.map(s => s.title).join(', ')} may not directly address the research question. Review these sources before relying on their contents.`,
      sourceTitles: [],
      evidence: []
    })
  }

  const checks = [
    {
      name: 'deadline',
      questionPattern: /deadline|last date|closing date/i,
      sourcePattern: /deadline|last date|closing date|closes on|apply by/i,
      message: 'Confirm the current deadline from the latest official source.'
    },
    {
      name: 'eligibility',
      questionPattern: /eligibility|eligible|qualify/i,
      sourcePattern: /eligib|qualif|who can apply/i,
      message: 'Verify the complete eligibility criteria.'
    },
    {
      name: 'documents',
      questionPattern: /document|certificate|identity proof|marksheet/i,
      sourcePattern: /document|required papers|identity proof|marksheet|certificate/i,
      message: 'Confirm the complete list of required documents.'
    },
    {
      name: 'renewal',
      questionPattern: /renewal|renew|continuation/i,
      sourcePattern: /renew|continuation|reapply/i,
      message: 'Check the official renewal or continuation policy.'
    },
    {
      name: 'fees or funding',
      questionPattern: /amount|stipend|scholarship amount|fee|funding/i,
      sourcePattern: /amount|stipend|scholarship amount|fee|funding/i,
      message: 'Verify the award amount and payment conditions.'
    },
    {
      name: 'application process',
      questionPattern: /apply|application|submit|portal|form/i,
      sourcePattern: /apply|application|submit|portal|form/i,
      message: 'Confirm the official application steps.'
    }
  ]

  for (const check of checks) {
    if (check.questionPattern.test(question) && !check.sourcePattern.test(allText)) {
      gaps.push({
        title: `Potential gap: ${check.name}`,
        detail: check.message,
        sourceTitles: relevantSources.map(s => s.title),
        evidence: []
      })
    }
  }

  if (missing.length) {
    gaps.push({
      title: 'Research terms not clearly covered',
      detail: `These question terms were not found in the reviewed text: ${missing.slice(0, 8).join(', ')}. This is a keyword signal, not proof that information is absent.`,
      sourceTitles: [],
      evidence: []
    })
  }

  if (!gaps.length) {
    gaps.push({
      title: 'No obvious checklist gap detected',
      detail: 'The basic rules did not find a missing common topic. This does not prove the sources are complete.',
      sourceTitles: [],
      evidence: []
    })
  }

  const conflicts = []
  const datePattern = /(deadline|closes on|close on|last date|apply by)\D{0,35}(\d{1,2}\s+[A-Za-z]+\s+20\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2})/i

  const dateMatches = relevantSources.map(source => {
    const found = datePattern.exec(source.text)
    if (!found) return null
    const start = Math.max(0, found.index - 100)
    const end = Math.min(source.text.length, found.index + found[0].length + 100)
    return {
      title: source.title,
      match: found[0],
      evidence: source.text.slice(start, end).slice(0, 500)
    }
  }).filter(Boolean)

  const distinctDates = new Set(
    dateMatches.map(item => item.match.toLowerCase().replace(/\s+/g, ' ').trim())
  )

  if (dateMatches.length > 1 && distinctDates.size > 1) {
    conflicts.push({
      title: 'Different dates or deadlines',
      detail: dateMatches.map(item => `${item.title}: "${item.match}"`).join(' | ') + '. Verify the full context.',
      sourceTitles: dateMatches.map(item => item.title),
      evidence: dateMatches.map(item => ({
        sourceTitle: item.title,
        excerpt: item.evidence
      })),
      severity: 'review'
    })
  }

  const currentYear = new Date().getFullYear()
  const outdated = []

  for (const source of relevantSources) {
    const yearMatches = [...source.text.matchAll(/\b20\d{2}\b/g)]
    const years = yearMatches.map(match => Number(match[0]))

    const oldYearMatches = yearMatches.filter(match =>
      Number(match[0]) < currentYear - 1
    )
    const oldYears = oldYearMatches.map(match => Number(match[0]))

    if (oldYears.length) {
      outdated.push({
        title: `Older year reference in ${source.title}`,
        detail: `This source includes year reference(s): ${[...new Set(oldYears)].join(', ')}. Check whether the information is still current.`,
        sourceTitles: [source.title],
        evidence: oldYearMatches.slice(0, 3).map(match => {
          const start = Math.max(0, match.index - 90)
          const end = Math.min(source.text.length, match.index + match[0].length + 90)
          return {
            sourceTitle: source.title,
            excerpt: source.text.slice(start, end).slice(0, 500)
          }
        })
      })
    }

    if (!years.length) {
      outdated.push({
        title: `No clear year detected in ${source.title}`,
        detail: 'No four-digit year was detected. Check the original publication or update date.',
        sourceTitles: [source.title],
        evidence: []
      })
    }
  }

  const summary =
    `Reviewed ${relevantSources.length} relevant or partially relevant source(s) and identified ${irrelevantSources.length} potentially irrelevant source(s). ` +
    `The report contains ${gaps.length} potential gap signal(s), ${conflicts.length} comparison signal(s), and ${outdated.length} date warning(s). Treat these as prompts for verification.`

  return {
    mode: 'rules',
    relevanceWarning: irrelevantSources.length > 0,
    summary,
    sources: sources.map(source => ({
      title: source.title,
      url: source.url,
      excerpt: source.text.slice(0, 260) + (source.text.length > 260 ? '…' : ''),
      words: source.text.split(/\s+/).filter(Boolean).length,
      relevance: source.relevance
    })),
    gaps,
    conflicts,
    outdated,
    checklist: [
      'Open each original source and confirm it is relevant and authoritative.',
      'Check publication dates and whether the information is current.',
      ...gaps.slice(0, 3).map(gap => gap.detail),
      ...conflicts.map(item => `Resolve this possible conflict: ${item.title}.`),
      'Record the exact source and evidence for important decisions.'
    ],
    topics: questionWords.slice(0, 8)
  }
}

async function geminiAnalysis(question, allSources, fallback) {
  if (!process.env.GEMINI_API_KEY) {
    console.log('Gemini API key not found. Using rule-based analysis.')
    return fallback
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const prompt = `
You are an evidence-first research assistant for Digital Dark Spot.

Analyse ONLY the supplied source material.

FIRST: assess each source's relevance to the research question.
Classify each as exactly one of:
"relevant", "partially relevant", "irrelevant".

Definitions:
- relevant: directly discusses the research question.
- partially relevant: contains some useful information but does not fully address the question.
- irrelevant: does not meaningfully address the question.

IMPORTANT:
- Do not create research gaps or conflicts from irrelevant sources.
- If every source is irrelevant, return no conflicts and explain that relevant material is missing.
- Do not mistake absence of a keyword for proof that information is absent.
- Never invent facts, evidence, or citations.
- Treat findings as potential signals, not guaranteed facts.
- Use exact source titles.
- Evidence excerpts must be copied verbatim from source text.
- Never invent or paraphrase evidence excerpts.
- Every evidence excerpt must be 20 to 500 characters.
- For missing information, explain the coverage gap without inventing evidence.
- Only cite supplied source titles.
- Return valid JSON only, without Markdown fences.

Return exactly these keys:

{
  "summary": "Research summary",
  "sourceRelevance": [
    {
      "sourceTitle": "Exact source title",
      "status": "relevant",
      "reason": "Short explanation"
    }
  ],
  "gaps": [
    {
      "title": "Finding title",
      "detail": "Explanation",
      "sourceTitles": [],
      "evidence": []
    }
  ],
  "conflicts": [
    {
      "title": "Possible conflict",
      "detail": "Explain differing claims",
      "sourceTitles": [],
      "evidence": [],
      "severity": "review"
    }
  ],
  "outdated": [
    {
      "title": "Date-related warning",
      "detail": "What needs checking",
      "sourceTitles": [],
      "evidence": []
    }
  ],
  "checklist": ["Verification step"],
  "topics": ["Topic"]
}

Research question:
${question}

Sources:
${allSources.map((source, index) => `
SOURCE ${index + 1}
Title: ${source.title}
URL: ${source.url || 'Not provided'}
Text:
${source.text.slice(0, 9000)}
`).join('\n')}
`

    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
    let response
    let lastError

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        })
        lastError = null
        break
      } catch (error) {
        lastError = error
        const message = String(error?.message || '')
        const retryable = /\b(429|500|502|503|504)\b|UNAVAILABLE|high demand|temporarily unavailable/i.test(message)
        if (!retryable || attempt === 2) break
        const delay = 1000 * (attempt + 1)
        console.warn(`Gemini temporary error; retrying in ${delay}ms (attempt ${attempt + 2}/3).`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    if (lastError) throw lastError

    if (!response.text) throw new Error('Gemini returned an empty response.')

    const parsed = JSON.parse(response.text)

    // Accept classifications only for actual supplied source titles.
    const sources = fallback.sources.map(source => {
      const classification = Array.isArray(parsed.sourceRelevance)
        ? parsed.sourceRelevance.find(item => item.sourceTitle === source.title)
        : null

      const status = ['relevant', 'partially relevant', 'irrelevant']
        .includes(classification?.status)
        ? classification.status
        : source.relevance.status

      return {
        ...source,
        relevance: {
          ...source.relevance,
          status,
          reason: typeof classification?.reason === 'string'
            ? classification.reason.slice(0, 300)
            : 'Estimated from topic overlap.'
        }
      }
    })

    const relevantSources = sources.filter(
      source => source.relevance.status !== 'irrelevant'
    )

    const irrelevantSources = sources.filter(
      source => source.relevance.status === 'irrelevant'
    )

    // All sources irrelevant: do not show unrelated AI findings.
    if (!relevantSources.length) {
      return {
        ...fallback,
        mode: 'gemini',
        relevanceWarning: true,
        sources,
        summary: 'Gemini assessed all supplied sources as irrelevant to the research question. Add relevant material before interpreting gaps or conflicts.',
        gaps: [{
          title: 'No relevant sources found',
          detail: 'The supplied sources do not meaningfully address the research question. This is a source relevance warning.',
          sourceTitles: [],
          evidence: []
        }],
        conflicts: [],
        outdated: [],
        checklist: [
          'Find sources that directly address the research question.',
          'Use original research or authoritative publications where possible.',
          'Check publication dates before analysing the new sources.'
        ]
      }
    }

    const safeGaps = validateFindings(parsed.gaps, allSources, fallback.gaps)
    const safeConflicts = validateFindings(parsed.conflicts, allSources, fallback.conflicts)
    const safeOutdated = validateFindings(parsed.outdated, allSources, fallback.outdated)

    // Remove findings that cite only sources classified as irrelevant.
    const filterFindings = items => items.filter(item =>
      !item.sourceTitles.length ||
      item.sourceTitles.some(title =>
        relevantSources.some(source => source.title === title)
      )
    )

    return {
      ...fallback,
      mode: 'gemini',
      relevanceWarning: irrelevantSources.length > 0,
      summary: typeof parsed.summary === 'string'
        ? parsed.summary
        : fallback.summary,
      sources,
      gaps: filterFindings(safeGaps),
      conflicts: filterFindings(safeConflicts),
      outdated: filterFindings(safeOutdated),
      checklist: Array.isArray(parsed.checklist)
        ? parsed.checklist.filter(item => typeof item === 'string').slice(0, 20)
        : fallback.checklist,
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter(item => typeof item === 'string').slice(0, 20)
        : fallback.topics
    }
  } catch (error) {
    console.error('Gemini analysis unavailable after retry; using rules:', error.message)
    return fallback
  }
}

app.post('/api/analyze', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim()
    const input = Array.isArray(req.body?.sources) ? req.body.sources : []

    if (question.length < 6) {
      return res.status(400).json({
        error: 'Please enter a research question with at least 6 characters.'
      })
    }

    if (!input.length) {
      return res.status(400).json({ error: 'Please add at least one source.' })
    }

    if (input.length > 8) {
      return res.status(400).json({ error: 'A maximum of 8 sources is supported.' })
    }

    const sources = await collectSources(input)

    if (!sources.length) {
      return res.status(400).json({
        error: 'No readable source text was provided. Paste source text or provide a readable public webpage URL.'
      })
    }

    const fallback = ruleAnalysis(question, sources)
    const result = await geminiAnalysis(question, sources, fallback)

    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: error.message || 'Unexpected server error.'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Digital Dark Spot API running at http://localhost:${PORT}`)
})