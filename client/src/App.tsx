
import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, BrainCircuit, Check, ChevronRight,
  CircleHelp, Clock3, FileSearch, FileText, Globe2, Layers3, Link2,
  LoaderCircle, Plus, Radar, Search, ShieldCheck, Sparkles, Trash2,
  UploadCloud, X, ExternalLink, Eye
} from 'lucide-react'

type Relevance = {
  status: 'relevant' | 'partially relevant' | 'irrelevant' | string
  score?: number
  reason?: string
}

type Evidence = {
  sourceTitle: string
  excerpt: string
}

type Source = {
  id: string
  title: string
  url: string
  text: string
}

type Finding = {
  title: string
  detail: string
  sourceTitles?: string[]
  severity?: string
  evidence?: Evidence[]
}

type Analysis = {
  mode: string
  summary: string
  sources: {
    title: string
    url: string
    excerpt: string
    words: number
    relevance?: Relevance
  }[]
  gaps: Finding[]
  conflicts: Finding[]
  outdated: Finding[]
  checklist: string[]
  topics: string[]
  relevanceWarning?: string
}

const demoSources: Source[] = [
  {
    id: 'demo-1',
    title: 'Example University Scholarship Notice',
    url: 'https://example.edu/scholarships/notice',
    text: 'The scholarship is open to undergraduate students enrolled full time. Applicants must submit an application form, proof of admission, and the previous semester marksheet. Applications close on 30 November 2026. Selected students will be informed by email. The award is available for the academic year 2026-27.'
  },
  {
    id: 'demo-2',
    title: 'Student Support Information Page',
    url: 'https://example.org/student-support',
    text: 'Students applying for the undergraduate scholarship must be enrolled full time. Required documents include the application form, proof of admission, identity proof, and previous semester marksheet. The application deadline listed on this page is 15 December 2026. Renewal information is not included on this page.'
  }
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function relevanceLabel(status?: string) {
  if (!status) return 'Not classified'
  return status.replace(/\b\w/g, letter => letter.toUpperCase())
}

function relevanceClass(status?: string) {
  if (status === 'relevant') return 'relevance-relevant'
  if (status === 'partially relevant') return 'relevance-partial'
  if (status === 'irrelevant') return 'relevance-irrelevant'
  return 'relevance-unknown'
}

export default function App() {
  const [question, setQuestion] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const canAnalyse = question.trim().length > 5 && sources.length > 0 && !busy

  const totalFindings = useMemo(
    () => analysis
      ? analysis.gaps.length + analysis.conflicts.length + analysis.outdated.length
      : 0,
    [analysis]
  )

  function addSource() {
    if (!title.trim() || !sourceText.trim()) {
      setError('Add a source title and its text. A URL is optional for pasted material.')
      return
    }

    setSources(prev => [
      ...prev,
      {
        id: uid(),
        title: title.trim(),
        url: url.trim(),
        text: sourceText.trim()
      }
    ])

    setTitle('')
    setUrl('')
    setSourceText('')
    setError('')
    setAnalysis(null)
  }

  function loadDemo() {
    setQuestion('What should a student verify before applying for this scholarship?')
    setSources(demoSources)
    setAnalysis(null)
    setError('')
  }

  async function analyse() {
    if (!canAnalyse) return

    setBusy(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sources })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed. Please try again.')
      }

      setAnalysis(data)
      setActiveTab('overview')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not connect to the analysis server. Is the backend running?'
      )
    } finally {
      setBusy(false)
    }
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id))
    setAnalysis(null)
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Radar size={23} /></div>
          <div>
            <div className="brand-name">DARK<span>SPOT</span></div>
            <div className="brand-sub">RESEARCH INTELLIGENCE</div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active">
          <Layers3 size={17} /> Research workspace
        </button>
        <button className="nav-item" onClick={loadDemo}>
          <FileText size={17} /> Demo project <span className="nav-tag">TRY</span>
        </button>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-head"><span className="pulse-dot" /> SYSTEM STATUS</div>
            <div className="system-state">Analysis engine ready</div>
            <div className="system-foot">LOCAL PROTOTYPE · V1.0</div>
          </div>

          <div className="profile">
            <div className="avatar">DS</div>
            <div><strong>Researcher</strong><small>Personal workspace</small></div>
            <div className="profile-dots">···</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} /> <span>New research</span>
          </div>
          <div className="top-actions">
            <span className="secure"><ShieldCheck size={14} /> Evidence-first analysis</span>
            <div className="top-avatar">DS</div>
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-line" /> INTELLIGENCE THAT FINDS WHAT'S MISSING
          </div>
          <h1>See beyond the <span>available.</span></h1>
          <p className="hero-copy">
            Explore multiple sources. Uncover information gaps, conflicting claims,
            and details that deserve a second look.
          </p>
          <div className="hero-meta">
            <span><Sparkles size={14} /> AI-assisted research</span>
            <i />
            <span><Globe2 size={14} /> Multi-source review</span>
            <i />
            <span><ShieldCheck size={14} /> Traceable evidence</span>
          </div>
        </section>

        <section className="research-grid">
          <div className="panel question-panel">
            <div className="panel-heading">
              <div className="step-icon"><Search size={17} /></div>
              <div>
                <div className="panel-title">Define your research goal</div>
                <div className="panel-sub">What do you need to find out?</div>
              </div>
              <span className="step-number">01</span>
            </div>

            <label className="field-label" htmlFor="question">RESEARCH QUESTION</label>
            <textarea
              id="question"
              className="question-input"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. What should I verify before applying for this scholarship?"
            />

            <div className="question-footer">
              <span>{question.length} characters</span>
              <button className="text-button" onClick={loadDemo}>
                <Sparkles size={13} /> Load sample research
              </button>
            </div>
          </div>

          <div className="panel source-panel">
            <div className="panel-heading">
              <div className="step-icon"><Link2 size={17} /></div>
              <div>
                <div className="panel-title">Build your source set</div>
                <div className="panel-sub">Add source text to compare evidence</div>
              </div>
              <span className="step-number">02</span>
            </div>

            <div className="source-form">
              <div className="two-fields">
                <div>
                  <label className="field-label">SOURCE TITLE</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Official scholarship notice"
                  />
                </div>
                <div>
                  <label className="field-label">
                    SOURCE URL <span className="optional">OPTIONAL</span>
                  </label>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <label className="field-label">SOURCE CONTENT</label>
              <textarea
                className="source-input"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                placeholder="Paste relevant text from the source here..."
              />

              <button className="add-source" onClick={addSource}>
                <Plus size={15} /> Add source to workspace
              </button>
            </div>

            <div className="source-list">
              <div className="source-list-head">
                <span>ADDED SOURCES</span>
                <span className="count-pill">{sources.length} SOURCES</span>
              </div>

              {sources.length === 0 ? (
                <div className="empty-sources">
                  <UploadCloud size={19} />
                  <span>No sources added yet</span>
                  <small>Add text above or load the sample project</small>
                </div>
              ) : (
                sources.map((s, i) => (
                  <div className="source-row" key={s.id}>
                    <div className="file-icon"><FileText size={16} /></div>
                    <div className="source-info">
                      <strong>{s.title}</strong>
                      <small>{s.url || 'Pasted source'} · {s.text.split(/\s+/).length} words</small>
                    </div>
                    <span className="source-index">0{i + 1}</span>
                    <button
                      className="icon-button"
                      aria-label="Remove source"
                      onClick={() => removeSource(s.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}

        <div className="analyse-row">
          <div className="analyse-note">
            <Activity size={16} />
            <span>More sources can improve comparison coverage.</span>
          </div>
          <button className="analyse-button" disabled={!canAnalyse} onClick={analyse}>
            {busy ? (
              <><LoaderCircle className="spin" size={17} /> Analysing evidence...</>
            ) : (
              <><BrainCircuit size={17} /> Analyse research <ArrowUpRight size={16} /></>
            )}
          </button>
        </div>

        {analysis ? (
          <section className="results">
            <div className="results-heading">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-line" /> ANALYSIS COMPLETE
                </div>
                <h2>Research intelligence report</h2>
                <p>Review the evidence and decide what needs verification.</p>
              </div>
              <div className="mode-pill">
                <span className="pulse-dot" />
                {analysis.mode === 'gemini' ? 'AI-ASSISTED ANALYSIS' : 'RULE-BASED PROTOTYPE'}
              </div>
            </div>

            <div className="metrics">
              <Metric icon={<FileSearch size={18} />} label="Sources reviewed" value={analysis.sources.length.toString()} tone="blue" />
              <Metric icon={<CircleHelp size={18} />} label="Potential gaps" value={analysis.gaps.length.toString()} tone="purple" />
              <Metric icon={<AlertTriangle size={18} />} label="Possible conflicts" value={analysis.conflicts.length.toString()} tone="orange" />
              <Metric icon={<Clock3 size={18} />} label="Date warnings" value={analysis.outdated.length.toString()} tone="pink" />
            </div>

            <div className="tabs">
              {[
                ['overview', 'Overview'],
                ['gaps', 'Information gaps'],
                ['conflicts', 'Conflicts'],
                ['checklist', 'Verify next']
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={activeTab === id ? 'tab active-tab' : 'tab'}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                  {id === 'gaps' && <span>{analysis.gaps.length}</span>}
                  {id === 'conflicts' && <span>{analysis.conflicts.length}</span>}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="result-columns">
                <div className="panel result-panel">
                  <div className="result-title"><Sparkles size={17} /> Research summary</div>
                  <p className="summary-text">{analysis.summary}</p>
                  <div className="topics">
                    <span className="field-label">TOPICS FOUND</span>
                    <div className="topic-chips">
                      {analysis.topics.map(t => <span key={t}>{t}</span>)}
                    </div>
                  </div>
                </div>

                <div className="panel result-panel">
                  <div className="result-title"><Radar size={17} /> Signals to investigate</div>
                  <FindingList
                    items={[
                      ...analysis.gaps.slice(0, 2),
                      ...analysis.conflicts.slice(0, 2),
                      ...analysis.outdated.slice(0, 1)
                    ]}
                    sources={analysis.sources}
                  />
                </div>
              </div>
            )}

            {activeTab === 'gaps' && (
              <div className="panel result-panel">
                <div className="result-title"><CircleHelp size={17} /> Potential information gaps</div>
                <FindingList items={analysis.gaps} sources={analysis.sources} />
              </div>
            )}

            {activeTab === 'conflicts' && (
              <div className="panel result-panel">
                <div className="result-title"><AlertTriangle size={17} /> Possible conflicting claims</div>
                <FindingList items={analysis.conflicts} sources={analysis.sources} />
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="panel result-panel">
                <div className="result-title"><Check size={17} /> Your verification checklist</div>
                <div className="checklist">
                  {analysis.checklist.map((item, i) => <CheckItem key={i} text={item} />)}
                </div>
              </div>
            )}

            {/* Evidence Explorer */}
            <div className="panel evidence-panel">
              <div className="result-title">
                <ShieldCheck size={17} />
                Evidence Explorer
                <span className="evidence-note">SOURCE RELEVANCE & ORIGINAL MATERIAL</span>
              </div>

              <p className="summary-text">
                Inspect each source's relevance and the material collected for this analysis.
                Relevance labels are classifications, not proof that a source is accurate.
              </p>

              {analysis.relevanceWarning && (
                <div className="error-banner">
                  <AlertTriangle size={16} />
                  {analysis.relevanceWarning}
                </div>
              )}

              {analysis.sources.map((s, i) => (
                <div className="evidence-row" key={`${s.title}-${i}`}>
                  <div className="evidence-num">0{i + 1}</div>

                  <div className="evidence-content">
                    <strong>{s.title}</strong>

                    <div style={{ margin: '8px 0' }}>
                      <span className={`relevance-label ${relevanceClass(s.relevance?.status)}`}>
                        {relevanceLabel(s.relevance?.status)}
                      </span>
                    </div>

                    {s.relevance?.reason && (
                      <p>{s.relevance.reason}</p>
                    )}

                    <p>{s.excerpt || 'No source excerpt was returned.'}</p>
                    <small>{s.words} words reviewed</small>
                  </div>

                  {s.url && (
                    <a className="open-source" href={s.url} target="_blank" rel="noreferrer">
                      Open source <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="panel evidence-panel">
              <div className="result-title">
                <Eye size={17} /> Finding-level evidence
                <span className="evidence-note">EXPAND TO INSPECT</span>
              </div>

              <p className="summary-text">
                These are the excerpts attached to individual findings by the analysis.
                A missing excerpt means the finding still needs manual verification.
              </p>

              <FindingList
                items={[
                  ...analysis.gaps,
                  ...analysis.conflicts,
                  ...analysis.outdated
                ]}
                sources={analysis.sources}
                expandedByDefault={false}
              />
            </div>

            <div className="disclaimer">
              <ShieldCheck size={15} />
              <span>
                Findings are potential signals, not guaranteed facts. Verify important
                details using the original sources, especially official and current documents.
              </span>
            </div>
          </section>
        ) : (
          <section className="empty-report">
            <div className="radar-graphic">
              <div className="radar-ring ring-one" />
              <div className="radar-ring ring-two" />
              <div className="radar-ring ring-three" />
              <div className="radar-sweep" />
              <div className="radar-core"><Radar size={29} /></div>
              <span className="radar-point point-one" />
              <span className="radar-point point-two" />
              <span className="radar-point point-three" />
            </div>
            <div className="empty-title">Your research canvas is ready</div>
            <p>Define a question and add source material. Your intelligence report will appear here.</p>
            <div className="empty-steps">
              <span><b>01</b> Ask a question</span>
              <ChevronRight size={14} />
              <span><b>02</b> Add sources</span>
              <ChevronRight size={14} />
              <span><b>03</b> Discover gaps</span>
            </div>
          </section>
        )}

        <footer>
          <div className="footer-brand"><Radar size={15} /> DIGITAL DARK SPOT</div>
          <span>BUILT FOR BETTER RESEARCH · PROTOTYPE 1.0</span>
          <span>Evidence first. Assumptions labelled.</span>
        </footer>
      </main>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  )
}

function FindingList({
  items,
  sources,
  expandedByDefault = true
}: {
  items: Finding[]
  sources: Analysis['sources']
  expandedByDefault?: boolean
}) {
  if (!items.length) {
    return (
      <div className="no-findings">
        <Check size={17} />
        No signals detected by this analysis. This does not prove the sources are complete.
      </div>
    )
  }

  return (
    <div className="finding-list">
      {items.map((f, i) => {
        const evidence = f.evidence || []

        return (
          <details className="finding" key={`${f.title}-${i}`} open={expandedByDefault}>
            <summary style={{ cursor: 'pointer' }}>
              <div className="finding-dot" />
              <div>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
                {f.sourceTitles?.length ? (
                  <small>Sources: {f.sourceTitles.join(', ')}</small>
                ) : null}
              </div>
            </summary>

            <div className="finding-evidence">
              <strong>Supporting excerpts</strong>

              {evidence.length > 0 ? (
                evidence.map((item, j) => {
                  const matchingSource = sources.find(
                    source => source.title === item.sourceTitle
                  )

                  return (
                    <div className="evidence-excerpt" key={`${item.sourceTitle}-${j}`}>
                      <div className="evidence-excerpt-heading">
                        <FileText size={14} />
                        <strong>{item.sourceTitle}</strong>
                      </div>
                      <blockquote>{item.excerpt}</blockquote>

                      {matchingSource?.url && (
                        <a
                          className="open-source"
                          href={matchingSource.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View original source <ArrowUpRight size={13} />
                        </a>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="no-evidence">
                  No exact supporting excerpt was returned for this finding.
                  Check the listed sources manually before relying on it.
                </p>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false)

  return (
    <label className={checked ? 'check-item checked' : 'check-item'}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => setChecked(e.target.checked)}
      />
      <span className="custom-check">{checked && <Check size={12} />}</span>
      <span>{text}</span>
    </label>
  )
}
