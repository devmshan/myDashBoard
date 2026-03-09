import { useState } from 'react'
import './QueryFormat.css'

// ─── Common utilities ───

function preserveLiterals(sql) {
  const preserved = []
  let processed = sql
  processed = processed.replace(/'([^']|'')*'/g, (m) => { preserved.push(m); return `__S${preserved.length - 1}__` })
  processed = processed.replace(/\/\*[\s\S]*?\*\//g, (m) => { preserved.push(m); return `__C${preserved.length - 1}__` })
  processed = processed.replace(/--.*$/gm, (m) => { preserved.push(m); return `__L${preserved.length - 1}__` })
  return { processed, preserved }
}

function restoreLiterals(str, preserved) {
  let result = str
  for (let i = preserved.length - 1; i >= 0; i--) {
    result = result.replace(new RegExp(`__[SCL]${i}__`, 'g'), preserved[i])
  }
  return result
}

function normalize(sql) {
  let s = sql.replace(/\s+/g, ' ').trim()
  let semi = false
  if (s.endsWith(';')) { semi = true; s = s.slice(0, -1).trim() }
  return { normalized: s, hasSemicolon: semi }
}

const ALL_KW = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  'MERGE INTO', 'USING', 'WHEN MATCHED THEN', 'WHEN NOT MATCHED THEN',
  'UNION ALL', 'UNION', 'INTERSECT', 'MINUS', 'WITH',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN',
  'NATURAL JOIN', 'JOIN', 'ON', 'AND', 'OR',
  'WHEN', 'THEN', 'ELSE', 'END', 'CASE',
  'AS', 'IN', 'NOT', 'NULL', 'IS', 'LIKE', 'BETWEEN', 'EXISTS',
  'DISTINCT', 'ALL', 'ANY', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
  'NVL', 'NVL2', 'DECODE', 'TO_CHAR', 'TO_DATE', 'TO_NUMBER',
  'SYSDATE', 'SYSTIMESTAMP', 'ROWNUM', 'ROWID', 'DUAL',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'SUBSTR', 'INSTR', 'LENGTH', 'TRIM', 'LTRIM', 'RTRIM',
  'UPPER', 'LOWER', 'REPLACE', 'LPAD', 'RPAD',
  'OVER', 'PARTITION BY', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
  'TRUNC', 'ROUND', 'CEIL', 'FLOOR', 'MOD', 'ABS',
  'LISTAGG', 'WITHIN GROUP', 'CONNECT BY', 'START WITH', 'PRIOR',
  'FETCH FIRST', 'ROWS ONLY', 'OFFSET',
]

function uppercaseKeywords(sql) {
  let result = sql
  for (const kw of ALL_KW) {
    const regex = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi')
    result = result.replace(regex, kw)
  }
  return result
}

function finalize(str, hasSemicolon) {
  let result = str.split('\n').map(l => l.trimEnd()).join('\n')
  if (hasSemicolon) result = result.trimEnd() + ';'
  return result
}

// ─── Depth-aware tokenizer ───
function tokenizeTopLevel(sql) {
  const tokens = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (buf.trim()) tokens.push({ type: 'text', value: buf.trim() })
    buf = ''
  }

  while (i < sql.length) {
    if (sql[i] === '(') {
      flush()
      let depth = 1
      let start = i
      i++
      while (i < sql.length && depth > 0) {
        if (sql[i] === '(') depth++
        if (sql[i] === ')') depth--
        i++
      }
      tokens.push({ type: 'paren', value: sql.substring(start, i) })
    } else if (sql[i] === ',') {
      flush()
      tokens.push({ type: 'comma', value: ',' })
      i++
    } else {
      buf += sql[i]
      i++
    }
  }
  flush()
  return tokens
}

// ─── Clause keywords (sorted longest-first for greedy matching) ───
const MAJOR_KW = [
  'WHEN MATCHED THEN', 'WHEN NOT MATCHED THEN',
  'UNION ALL', 'UNION', 'INTERSECT', 'MINUS',
  'INSERT INTO', 'DELETE FROM', 'MERGE INTO',
  'WITH', 'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
  'VALUES', 'UPDATE', 'SET', 'USING',
]

const SUB_KW = [
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN',
  'NATURAL JOIN', 'JOIN',
]

// All clause-level keywords sorted by length desc (greedy match)
const CLAUSE_KW = [...MAJOR_KW, ...SUB_KW, 'ON', 'AND', 'OR']
  .sort((a, b) => b.length - a.length)

function matchKeywordAt(text, keywords) {
  const upper = text.toUpperCase()
  for (const kw of keywords) {
    if (upper.startsWith(kw)) {
      const afterKw = text[kw.length]
      if (!afterKw || /\s/.test(afterKw)) {
        return { keyword: kw, rest: text.substring(kw.length).trim() }
      }
    }
  }
  return null
}

// ─── Parse into clauses ───
function parseIntoClauses(tokens) {
  const parts = []

  for (const t of tokens) {
    if (t.type === 'paren') {
      parts.push(t)
    } else if (t.type === 'comma') {
      parts.push(t)
    } else {
      const words = t.value.split(/\s+/)
      for (const w of words) {
        if (w) parts.push({ type: 'word', value: w })
      }
    }
  }

  const clauses = []
  let currentKeyword = ''
  let currentItems = []

  function flushClause() {
    if (currentKeyword || currentItems.length > 0) {
      clauses.push({ keyword: currentKeyword, items: [...currentItems] })
    }
    currentItems = []
  }

  let i = 0
  while (i < parts.length) {
    const part = parts[i]

    if (part.type === 'paren') {
      currentItems.push(part.value)
      i++
      continue
    }

    if (part.type === 'comma') {
      currentItems.push(',')
      i++
      continue
    }

    // Try to match the longest keyword by looking ahead
    let bestMatch = null
    let bestConsumed = 0

    // Try combining words starting from current position
    for (let len = Math.min(5, parts.length - i); len >= 1; len--) {
      // Check all words from i to i+len-1 are 'word' type
      let allWords = true
      let combined = ''
      for (let j = 0; j < len; j++) {
        if (parts[i + j].type !== 'word') { allWords = false; break }
        combined += (j > 0 ? ' ' : '') + parts[i + j].value
      }
      if (!allWords) continue

      const m = matchKeywordAt(combined, CLAUSE_KW)
      if (m && m.keyword === combined.toUpperCase().substring(0, m.keyword.length)) {
        // Verify it consumed all the words we combined (no leftover partial)
        const kwWordCount = m.keyword.split(/\s+/).length
        if (kwWordCount === len || (kwWordCount <= len && !m.rest)) {
          bestMatch = m
          bestConsumed = kwWordCount
          break // Longest first, so first match is best
        }
        if (kwWordCount <= len) {
          bestMatch = { keyword: m.keyword, rest: '' }
          bestConsumed = kwWordCount
          break
        }
      }
    }

    // Also try single word match
    if (!bestMatch) {
      const m = matchKeywordAt(part.value, CLAUSE_KW)
      if (m) {
        bestMatch = m
        bestConsumed = 1
      }
    }

    if (bestMatch) {
      const isMain = MAJOR_KW.includes(bestMatch.keyword)
      const isSub = SUB_KW.includes(bestMatch.keyword)
      const isLogic = ['AND', 'OR', 'ON'].includes(bestMatch.keyword)

      if (isMain || isSub || isLogic) {
        flushClause()
        currentKeyword = bestMatch.keyword
        if (bestMatch.rest) currentItems.push(bestMatch.rest)
      } else {
        currentItems.push(bestMatch.keyword)
        if (bestMatch.rest) currentItems.push(bestMatch.rest)
      }
      i += bestConsumed
    } else {
      currentItems.push(part.value)
      i++
    }
  }
  flushClause()

  return clauses
}

// ─── Format paren block (subquery or expression) ───
// context: 'select' means this paren is inside a SELECT column list (scalar subquery)
function formatParenBlock(block, baseIndent, style, context) {
  const inner = block.substring(1, block.length - 1).trim()
  if (/^\s*SELECT\b/i.test(inner)) {
    // Scalar subquery in SELECT clause → keep inline (one line)
    if (context === 'select') {
      const oneline = inner.replace(/\s+/g, ' ').trim()
      return '(' + uppercaseKeywords(oneline) + ')'
    }
    const formatted = style === 'right'
      ? formatRightAligned(inner, false)
      : formatLeftAligned(inner, false)
    const lines = formatted.split('\n')
    const indented = lines.map(l => baseIndent + l).join('\n')
    const closingIndent = baseIndent.length >= 4 ? baseIndent.substring(0, baseIndent.length - 4) : ''
    return '(\n' + indented + '\n' + closingIndent + ')'
  }
  return '(' + inner + ')'
}

// Split clause items by comma
function splitByComma(items) {
  const groups = []
  let current = []
  for (const item of items) {
    if (item === ',') {
      groups.push(current)
      current = []
    } else {
      current.push(item)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

// ─── Style 1: Left-aligned (US style) ───

function formatLeftAligned(sql, isRoot = true) {
  if (!sql.trim()) return ''

  let input = sql
  let preserved = []
  let hasSemicolon = false

  if (isRoot) {
    const lit = preserveLiterals(sql)
    input = lit.processed
    preserved = lit.preserved
    const norm = normalize(input)
    input = norm.normalized
    hasSemicolon = norm.hasSemicolon
  }

  input = uppercaseKeywords(input)
  const tokens = tokenizeTopLevel(input)
  const clauses = parseIntoClauses(tokens)

  const IND = '    '
  const lines = []

  for (const clause of clauses) {
    const kw = clause.keyword
    const isMain = MAJOR_KW.includes(kw)
    const isSub = SUB_KW.includes(kw)
    const isLogic = ['AND', 'OR'].includes(kw)
    const isOn = kw === 'ON'
    const hasComma = clause.items.some(it => it === ',')

    // Determine base indent
    let prefix = ''
    if (isSub) prefix = IND
    else if (isOn) prefix = IND + IND
    else if (isLogic) prefix = IND

    // SELECT clause scalar subqueries → inline
    const parenCtx = kw === 'SELECT' ? 'select' : undefined

    if (hasComma) {
      const groups = splitByComma(clause.items)
      const childIndent = prefix + IND
      lines.push(prefix + kw)
      for (let g = 0; g < groups.length; g++) {
        const colStr = groups[g].map(it =>
          it.startsWith('(') ? formatParenBlock(it, childIndent, 'left', parenCtx) : it
        ).join(' ').trim()
        lines.push(childIndent + colStr + (g < groups.length - 1 ? ',' : ''))
      }
    } else {
      const itemStr = clause.items.map(it =>
        it.startsWith('(') ? formatParenBlock(it, prefix + IND, 'left', parenCtx) : it
      ).join(' ').trim()

      if (isMain) {
        lines.push(kw + (itemStr ? ' ' + itemStr : ''))
      } else if (isSub) {
        lines.push(IND + kw + (itemStr ? ' ' + itemStr : ''))
      } else if (isOn) {
        lines.push(IND + IND + kw + (itemStr ? ' ' + itemStr : ''))
      } else if (isLogic) {
        lines.push(IND + kw + (itemStr ? ' ' + itemStr : ''))
      } else {
        lines.push(prefix + kw + (itemStr ? ' ' + itemStr : ''))
      }
    }
  }

  let result = lines.join('\n')
  if (isRoot) {
    result = restoreLiterals(result, preserved)
    result = finalize(result, hasSemicolon)
  }
  return result
}

// ─── Style 2: Right-aligned (Korean SI style) ───

function formatRightAligned(sql, isRoot = true) {
  if (!sql.trim()) return ''

  let input = sql
  let preserved = []
  let hasSemicolon = false

  if (isRoot) {
    const lit = preserveLiterals(sql)
    input = lit.processed
    preserved = lit.preserved
    const norm = normalize(input)
    input = norm.normalized
    hasSemicolon = norm.hasSemicolon
  }

  input = uppercaseKeywords(input)
  const tokens = tokenizeTopLevel(input)
  const clauses = parseIntoClauses(tokens)

  const PAD = 16 // enough for "LEFT OUTER JOIN"
  const lines = []

  for (const clause of clauses) {
    const kw = clause.keyword
    const hasComma = clause.items.some(it => it === ',')
    const paddedKw = kw.padStart(PAD)
    const parenCtx = kw === 'SELECT' ? 'select' : undefined

    if (hasComma) {
      const groups = splitByComma(clause.items)
      for (let g = 0; g < groups.length; g++) {
        const colStr = groups[g].map(it =>
          it.startsWith('(') ? formatParenBlock(it, ' '.repeat(PAD + 2), 'right', parenCtx) : it
        ).join(' ').trim()
        if (g === 0) {
          lines.push(paddedKw + ' ' + colStr)
        } else {
          lines.push(' '.repeat(PAD) + ', ' + colStr)
        }
      }
    } else {
      const itemStr = clause.items.map(it =>
        it.startsWith('(') ? formatParenBlock(it, ' '.repeat(PAD + 1), 'right', parenCtx) : it
      ).join(' ').trim()
      lines.push(paddedKw + (itemStr ? ' ' + itemStr : ''))
    }
  }

  let result = lines.join('\n')
  if (isRoot) {
    result = restoreLiterals(result, preserved)
    result = finalize(result, hasSemicolon)
  }
  return result
}

// ─── Component ───

const STYLES = [
  { id: 'left', label: '좌측 정렬 (US)', desc: '키워드 좌측, 들여쓰기 4칸' },
  { id: 'right', label: '우측 정렬 (한국 SI)', desc: '키워드 우측, leading comma' },
]

export default function QueryFormat() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [style, setStyle] = useState('left')

  function handleFormat() {
    const formatter = style === 'right' ? formatRightAligned : formatLeftAligned
    setOutput(formatter(input))
    setCopied(false)
  }

  function handleClear() {
    setInput('')
    setOutput('')
    setCopied(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleMinify() {
    if (!input.trim()) return
    let minified = input
    minified = minified.replace(/--.*$/gm, '')
    minified = minified.replace(/\/\*[\s\S]*?\*\//g, '')
    minified = minified.replace(/\s+/g, ' ').trim()
    setOutput(minified)
    setCopied(false)
  }

  return (
    <div className="page-container">
      <h1 className="page-title">쿼리정렬</h1>
      <p className="qf-desc">Oracle SQL 쿼리를 보기 좋게 정렬합니다. 중간 공백 제거, 뒷공백 제거, 키워드 대문자 변환, 줄바꿈 정렬.</p>

      <div className="qf-style-selector">
        {STYLES.map((s) => (
          <button
            key={s.id}
            className={`qf-style-btn ${style === s.id ? 'active' : ''}`}
            onClick={() => setStyle(s.id)}
          >
            <span className="qf-style-label">{s.label}</span>
            <span className="qf-style-desc">{s.desc}</span>
          </button>
        ))}
      </div>

      <div className="qf-actions">
        <button className="qf-btn primary" onClick={handleFormat}>정렬</button>
        <button className="qf-btn" onClick={handleMinify}>한줄로</button>
        <button className="qf-btn" onClick={handleClear}>초기화</button>
      </div>

      <div className="qf-panels">
        <div className="qf-panel">
          <div className="qf-panel-header">
            <span>입력</span>
            <span className="qf-char-count">{input.length} chars</span>
          </div>
          <textarea
            className="qf-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="정렬할 Oracle SQL 쿼리를 붙여넣으세요..."
            spellCheck={false}
          />
        </div>
        <div className="qf-panel">
          <div className="qf-panel-header">
            <span>결과</span>
            <div className="qf-panel-actions">
              {output && (
                <button className="qf-copy-btn" onClick={handleCopy}>
                  {copied ? '복사됨!' : '복사'}
                </button>
              )}
              <span className="qf-char-count">{output.length} chars</span>
            </div>
          </div>
          <pre className="qf-output">{output || '정렬된 쿼리가 여기에 표시됩니다.'}</pre>
        </div>
      </div>
    </div>
  )
}
