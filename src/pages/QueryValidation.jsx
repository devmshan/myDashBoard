import { useState } from 'react'
import './QueryValidation.css'

function validateOracleQuery(sql) {
  const errors = []
  const warnings = []

  if (!sql.trim()) return { errors, warnings }

  const raw = sql
  const cleaned = removeCommentsAndStrings(sql)
  const upper = cleaned.toUpperCase()
  const lines = raw.split('\n')

  // 1. Unclosed single quotes
  const singleQuotes = (raw.match(/'/g) || []).length
  if (singleQuotes % 2 !== 0) {
    const lineNum = findUnmatchedQuoteLine(lines, "'")
    errors.push({ line: lineNum, message: '닫히지 않은 문자열(따옴표)이 있습니다.' })
  }

  // 2. Unclosed parentheses
  let parenDepth = 0
  let parenLine = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '(') {
      if (parenDepth === 0) parenLine = raw.substring(0, i).split('\n').length
      parenDepth++
    }
    if (cleaned[i] === ')') parenDepth--
    if (parenDepth < 0) {
      const ln = raw.substring(0, i).split('\n').length
      errors.push({ line: ln, message: '여는 괄호 없이 닫는 괄호 ")"가 있습니다.' })
      parenDepth = 0
    }
  }
  if (parenDepth > 0) {
    errors.push({ line: parenLine, message: `닫히지 않은 괄호가 ${parenDepth}개 있습니다.` })
  }

  // 2.5. Keyword typo detection
  checkTypos(cleaned, lines, errors)

  // Detect statement type
  const trimmedUpper = upper.trim().replace(/^\(/, '')
  const stmtType = detectStatementType(trimmedUpper)

  // 3. SELECT validation
  if (stmtType === 'SELECT') {
    if (!upper.includes('FROM') && !upper.includes('DUAL')) {
      // SELECT without FROM (allow SELECT sysdate FROM DUAL style or SELECT-only expressions)
      const hasFunction = /SELECT\s+(SYSDATE|SYSTIMESTAMP|USER|UID)\b/i.test(upper)
      if (!hasFunction) {
        warnings.push({ line: 1, message: 'SELECT 문에 FROM 절이 없습니다.' })
      }
    }

    // SELECT * without table
    if (/SELECT\s+\*\s*$/i.test(upper.trim())) {
      errors.push({ line: 1, message: 'SELECT * 뒤에 FROM 절이 필요합니다.' })
    }

    // WHERE after GROUP BY
    const groupByPos = upper.indexOf('GROUP BY')
    const wherePos = upper.indexOf('WHERE')
    if (groupByPos > -1 && wherePos > groupByPos) {
      const ln = findKeywordLine(lines, 'WHERE', groupByPos)
      errors.push({ line: ln, message: 'WHERE 절은 GROUP BY 앞에 위치해야 합니다.' })
    }

    // HAVING without GROUP BY
    if (upper.includes('HAVING') && !upper.includes('GROUP BY')) {
      const ln = findKeywordLineSimple(lines, 'HAVING')
      errors.push({ line: ln, message: 'HAVING 절은 GROUP BY와 함께 사용해야 합니다.' })
    }

    // ORDER BY before UNION/INTERSECT/MINUS (common mistake)
    const unionPos = Math.max(upper.lastIndexOf('UNION'), upper.lastIndexOf('INTERSECT'), upper.lastIndexOf('MINUS'))
    const orderByPos = upper.indexOf('ORDER BY')
    if (unionPos > -1 && orderByPos > -1 && orderByPos < unionPos) {
      const ln = findKeywordLineSimple(lines, 'ORDER BY')
      warnings.push({ line: ln, message: 'ORDER BY가 UNION/INTERSECT/MINUS 앞에 있으면 전체 결과가 아닌 첫 번째 쿼리에만 적용됩니다.' })
    }
  }

  // 4. INSERT validation
  if (stmtType === 'INSERT') {
    if (!upper.includes('INTO')) {
      errors.push({ line: 1, message: 'INSERT 문에 INTO 키워드가 필요합니다.' })
    }
    if (!upper.includes('VALUES') && !upper.includes('SELECT')) {
      errors.push({ line: 1, message: 'INSERT 문에 VALUES 또는 SELECT 절이 필요합니다.' })
    }
    // Column count vs value count
    const colMatch = cleaned.match(/INSERT\s+INTO\s+\w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i)
    if (colMatch) {
      const cols = colMatch[1].split(',').filter(s => s.trim()).length
      const vals = colMatch[2].split(',').filter(s => s.trim()).length
      if (cols !== vals) {
        errors.push({ line: 1, message: `컬럼 수(${cols})와 값 수(${vals})가 일치하지 않습니다.` })
      }
    }
  }

  // 5. UPDATE validation
  if (stmtType === 'UPDATE') {
    if (!upper.includes('SET')) {
      errors.push({ line: 1, message: 'UPDATE 문에 SET 절이 필요합니다.' })
    }
    if (!upper.includes('WHERE')) {
      warnings.push({ line: 1, message: 'WHERE 절이 없으면 모든 행이 업데이트됩니다.' })
    }
  }

  // 6. DELETE validation
  if (stmtType === 'DELETE') {
    if (!upper.includes('FROM')) {
      errors.push({ line: 1, message: 'DELETE 문에 FROM 절이 필요합니다.' })
    }
    if (!upper.includes('WHERE')) {
      warnings.push({ line: 1, message: 'WHERE 절이 없으면 모든 행이 삭제됩니다.' })
    }
  }

  // 7. Common Oracle errors
  // Double comma
  const doubleCommaMatch = cleaned.match(/,\s*,/)
  if (doubleCommaMatch) {
    const pos = cleaned.indexOf(doubleCommaMatch[0])
    const ln = raw.substring(0, pos).split('\n').length
    errors.push({ line: ln, message: '연속된 쉼표(,,)가 있습니다.' })
  }

  // Trailing comma before FROM/WHERE/GROUP/ORDER/SET/VALUES
  const trailingComma = cleaned.match(/,\s*(FROM|WHERE|GROUP|ORDER|HAVING|SET|VALUES|INTO|ON|JOIN|UNION|INTERSECT|MINUS)\b/i)
  if (trailingComma) {
    const pos = cleaned.indexOf(trailingComma[0])
    const ln = raw.substring(0, pos).split('\n').length
    errors.push({ line: ln, message: `"${trailingComma[1]}" 앞에 불필요한 쉼표가 있습니다.` })
  }

  // = NULL instead of IS NULL
  const eqNull = cleaned.match(/[^!<>]=\s*NULL/i)
  if (eqNull) {
    const pos = cleaned.indexOf(eqNull[0])
    const ln = raw.substring(0, pos).split('\n').length
    warnings.push({ line: ln, message: '"= NULL" 대신 "IS NULL"을 사용하세요.' })
  }

  // != NULL instead of IS NOT NULL
  const neqNull = cleaned.match(/(!=|<>)\s*NULL/i)
  if (neqNull) {
    const pos = cleaned.indexOf(neqNull[0])
    const ln = raw.substring(0, pos).split('\n').length
    warnings.push({ line: ln, message: '"!= NULL" 대신 "IS NOT NULL"을 사용하세요.' })
  }

  // Oracle-specific: missing table alias in subquery
  const subqueryNoAlias = cleaned.match(/\)\s+(WHERE|AND|OR|GROUP|ORDER|HAVING)\b/i)
  if (subqueryNoAlias && cleaned.includes('(') && /SELECT/i.test(cleaned)) {
    // Only warn if it looks like an inline view
    const beforeParen = cleaned.substring(0, cleaned.indexOf(subqueryNoAlias[0]))
    if (/FROM\s*\(/i.test(beforeParen) || /JOIN\s*\(/i.test(beforeParen)) {
      const pos = cleaned.indexOf(subqueryNoAlias[0])
      const ln = raw.substring(0, pos).split('\n').length
      errors.push({ line: ln, message: '인라인 뷰(서브쿼리)에 별칭(alias)이 필요합니다.' })
    }
  }

  // Empty IN clause
  if (/IN\s*\(\s*\)/i.test(cleaned)) {
    const pos = cleaned.search(/IN\s*\(\s*\)/i)
    const ln = raw.substring(0, pos).split('\n').length
    errors.push({ line: ln, message: 'IN 절이 비어 있습니다.' })
  }

  // AND/OR at start without condition
  const danglingLogic = cleaned.match(/\b(AND|OR)\s*$/i)
  if (danglingLogic) {
    errors.push({ line: lines.length, message: `"${danglingLogic[1]}" 뒤에 조건이 없습니다.` })
  }

  // WHERE without condition
  if (/WHERE\s*$/i.test(upper.trim()) || /WHERE\s*(ORDER|GROUP|HAVING|;)/i.test(upper)) {
    const ln = findKeywordLineSimple(lines, 'WHERE')
    errors.push({ line: ln, message: 'WHERE 절에 조건이 없습니다.' })
  }

  // 8. Common developer mistakes

  // SELECT column without comma separation (e.g., SELECT a b FROM)
  const selectToFrom = upper.match(/SELECT\s+([\s\S]*?)\s+FROM\b/)
  if (selectToFrom) {
    const cols = selectToFrom[1]
    // Two identifiers without comma between (not keywords, not aliases with AS)
    const badCols = cols.match(/\b([A-Z_]\w*)\s+([A-Z_]\w*)\b/g)
    if (badCols) {
      for (const m of badCols) {
        const parts = m.split(/\s+/)
        const aliasKeywords = ['AS', 'ASC', 'DESC', 'OVER', 'PARTITION', 'BETWEEN', 'AND', 'OR', 'NOT', 'IN', 'IS', 'LIKE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'DISTINCT', 'ALL', 'ESCAPE']
        if (!aliasKeywords.includes(parts[0]) && !aliasKeywords.includes(parts[1])) {
          // Could be alias — skip if second word is likely alias
        }
      }
    }
  }

  // Missing join condition (JOIN without ON)
  const joinNoOn = cleaned.match(/\bJOIN\s+\w+(\s+\w+)?\s+(WHERE|JOIN|LEFT|RIGHT|INNER|FULL|CROSS|GROUP|ORDER|HAVING)\b/i)
  if (joinNoOn && !/CROSS\s+JOIN/i.test(joinNoOn[0]) && !/NATURAL\s+JOIN/i.test(cleaned)) {
    const pos = cleaned.search(/\bJOIN\s+\w+(\s+\w+)?\s+(WHERE|JOIN|LEFT|RIGHT|INNER|FULL|CROSS|GROUP|ORDER|HAVING)\b/i)
    const ln = raw.substring(0, pos).split('\n').length
    errors.push({ line: ln, message: 'JOIN 뒤에 ON 절이 없습니다.' })
  }

  // BETWEEN without AND
  const betweenMatch = cleaned.match(/\bBETWEEN\b/gi)
  if (betweenMatch) {
    const betweenCount = betweenMatch.length
    const betweenAndCount = (cleaned.match(/\bBETWEEN\b[\s\S]*?\bAND\b/gi) || []).length
    if (betweenAndCount < betweenCount) {
      const pos = cleaned.search(/\bBETWEEN\b/i)
      const ln = raw.substring(0, pos).split('\n').length
      warnings.push({ line: ln, message: 'BETWEEN 뒤에 AND가 필요합니다.' })
    }
  }

  // GROUP BY with SELECT *
  if (upper.includes('GROUP BY') && /SELECT\s+\*/i.test(upper)) {
    errors.push({ line: 1, message: 'GROUP BY를 사용할 때 SELECT *는 사용할 수 없습니다.' })
  }

  // DISTINCT with ORDER BY column not in SELECT
  // (just warn about common pitfall)

  // Using reserved words as alias without quotes
  const reservedAsAlias = cleaned.match(/\b(FROM|WHERE|SELECT|TABLE|INDEX|ORDER|GROUP|COLUMN|NUMBER|DATE|SIZE|LEVEL|ROW|TYPE|NAME|VALUE|KEY|STATUS|COMMENT)\s*(?=,|\s+FROM\b)/gi)

  // Duplicate table alias
  const aliasMatches = [...cleaned.matchAll(/\b(?:FROM|JOIN)\s+(\w+)\s+(\w+)\b/gi)]
  const aliases = aliasMatches.map(m => m[2].toUpperCase()).filter(a => !['ON','WHERE','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','NATURAL','JOIN','GROUP','ORDER','HAVING','SET','AND','OR'].includes(a))
  const aliasSeen = {}
  for (const a of aliases) {
    if (aliasSeen[a]) {
      warnings.push({ line: 1, message: `테이블 별칭 "${a}"이 중복 사용되었습니다.` })
    }
    aliasSeen[a] = true
  }

  // Oracle: missing semicolon (just info)
  const trimmed = raw.trim()
  if (trimmed.length > 0 && !trimmed.endsWith(';') && !trimmed.endsWith('/')) {
    warnings.push({ line: lines.length, message: '문장 끝에 세미콜론(;)이 없습니다.' })
  }

  // Oracle: ROWNUM misuse with ORDER BY
  if (upper.includes('ROWNUM') && upper.includes('ORDER BY')) {
    if (!upper.includes('(') || upper.indexOf('ROWNUM') < upper.indexOf('ORDER BY')) {
      warnings.push({
        line: findKeywordLineSimple(lines, 'ROWNUM'),
        message: 'ROWNUM과 ORDER BY를 함께 사용하면 정렬 전에 행이 제한됩니다. 서브쿼리로 감싸는 것을 권장합니다.',
      })
    }
  }

  // Oracle: NVL vs NVL2 argument count
  const nvlCalls = [...cleaned.matchAll(/\bNVL\s*\(([^()]*)\)/gi)]
  for (const m of nvlCalls) {
    const argCount = m[1].split(',').length
    if (argCount !== 2) {
      const pos = m.index
      const ln = raw.substring(0, pos).split('\n').length
      errors.push({ line: ln, message: `NVL 함수는 인자가 2개 필요합니다. (현재 ${argCount}개)` })
    }
  }

  const nvl2Calls = [...cleaned.matchAll(/\bNVL2\s*\(([^()]*)\)/gi)]
  for (const m of nvl2Calls) {
    const argCount = m[1].split(',').length
    if (argCount !== 3) {
      const pos = m.index
      const ln = raw.substring(0, pos).split('\n').length
      errors.push({ line: ln, message: `NVL2 함수는 인자가 3개 필요합니다. (현재 ${argCount}개)` })
    }
  }

  // DECODE argument check (minimum 3)
  const decodeCalls = [...cleaned.matchAll(/\bDECODE\s*\(([^()]*)\)/gi)]
  for (const m of decodeCalls) {
    const argCount = m[1].split(',').length
    if (argCount < 3) {
      const pos = m.index
      const ln = raw.substring(0, pos).split('\n').length
      errors.push({ line: ln, message: `DECODE 함수는 최소 3개의 인자가 필요합니다. (현재 ${argCount}개)` })
    }
  }

  return { errors, warnings }
}

// Typo detection for common SQL keywords
const KEYWORD_TYPOS = {
  // WHERE typos
  WEHERE: 'WHERE', WHEER: 'WHERE', WEHRE: 'WHERE', WHRE: 'WHERE', WHER: 'WHERE',
  WHRERE: 'WHERE', WHHERE: 'WHERE', WWHERE: 'WHERE', WIERE: 'WHERE', WHEREE: 'WHERE',
  WHEARE: 'WHERE', WAHERE: 'WHERE',
  // SELECT typos
  SELCET: 'SELECT', SLECT: 'SELECT', SELCT: 'SELECT', SELET: 'SELECT', SEELCT: 'SELECT',
  SLEECT: 'SELECT', SELEECT: 'SELECT', SELECCT: 'SELECT', SELECTT: 'SELECT',
  // FROM typos
  FORM: 'FROM', FOMR: 'FROM', FRON: 'FROM', FROME: 'FROM', RFOM: 'FROM', FRIOM: 'FROM',
  FROMT: 'FROM', FRMO: 'FROM',
  // INSERT typos
  INSRET: 'INSERT', INSRT: 'INSERT', INSETR: 'INSERT', INSERTT: 'INSERT', ISNERT: 'INSERT',
  INERT: 'INSERT', INSERET: 'INSERT',
  // UPDATE typos
  UDPATE: 'UPDATE', UPADTE: 'UPDATE', UPDAET: 'UPDATE', UPDTAE: 'UPDATE', UPATE: 'UPDATE',
  UPDTE: 'UPDATE', UDATE: 'UPDATE',
  // DELETE typos
  DELTE: 'DELETE', DELEET: 'DELETE', DELEETE: 'DELETE', DEELTE: 'DELETE', DELEET: 'DELETE',
  DETELE: 'DELETE', DLELTE: 'DELETE',
  // GROUP BY typos
  GRUOP: 'GROUP', GROPU: 'GROUP', GROUUP: 'GROUP', GOURP: 'GROUP', GROP: 'GROUP',
  // ORDER BY typos
  OREDR: 'ORDER', ORDR: 'ORDER', ODRER: 'ORDER', OREDER: 'ORDER', ODER: 'ORDER',
  OERDER: 'ORDER',
  // JOIN typos
  JION: 'JOIN', JOING: 'JOIN', JOINN: 'JOIN', JIOIN: 'JOIN',
  // INNER typos
  INNNER: 'INNER', INER: 'INNER', INEER: 'INNER',
  // LEFT typos
  LETF: 'LEFT', LFET: 'LEFT', LEEFT: 'LEFT',
  // RIGHT typos
  RIGTH: 'RIGHT', RIHGT: 'RIGHT', RIIGHT: 'RIGHT',
  // OUTER typos
  OUTTER: 'OUTER', OUTR: 'OUTER', OTER: 'OUTER',
  // HAVING typos
  HAVNG: 'HAVING', HAIVNG: 'HAVING', HVAIN: 'HAVING', AHVING: 'HAVING',
  // VALUES typos
  VALUSE: 'VALUES', VLAUES: 'VALUES', VALEUS: 'VALUES', VALUESS: 'VALUES', VAULES: 'VALUES',
  // INTO typos
  ITNO: 'INTO', INOT: 'INTO',
  // BETWEEN typos
  BEWTEEN: 'BETWEEN', BETWEN: 'BETWEEN', BEETWEEN: 'BETWEEN', BETWEEEN: 'BETWEEN',
  BETWEE: 'BETWEEN', BETEWEN: 'BETWEEN',
  // DISTINCT typos
  DISTICT: 'DISTINCT', DISINCT: 'DISTINCT', DISITNCT: 'DISTINCT', DITINCT: 'DISTINCT',
  // EXISTS typos
  EXSITS: 'EXISTS', EXITS: 'EXISTS', EXISITS: 'EXISTS', EXSIST: 'EXISTS',
  // CREATE typos
  CRAETE: 'CREATE', CERATE: 'CREATE', CRATE: 'CREATE', CREAT: 'CREATE',
  // TABLE typos
  TALBE: 'TABLE', TABEL: 'TABLE', TABL: 'TABLE',
  // INDEX typos
  IDNEX: 'INDEX', INDX: 'INDEX', INDE: 'INDEX',
  // COMMIT typos
  COMIT: 'COMMIT', COMMTI: 'COMMIT', COMMMIT: 'COMMIT',
  // ROLLBACK typos
  ROLBACK: 'ROLLBACK', ROLLBAKC: 'ROLLBACK', ROOLBACK: 'ROLLBACK',
  // ALTER typos
  ATLER: 'ALTER', ALTR: 'ALTER', ALER: 'ALTER',
  // TRUNCATE typos
  TRUNCAT: 'TRUNCATE', TRUNACTE: 'TRUNCATE', TRUANCATE: 'TRUNCATE',
}

function checkTypos(cleaned, lines, errors) {
  // Extract all words (potential keywords)
  const words = [...cleaned.matchAll(/\b([A-Za-z_]\w*)\b/g)]
  for (const match of words) {
    const word = match[1].toUpperCase()
    if (KEYWORD_TYPOS[word]) {
      const pos = match.index
      const ln = cleaned.substring(0, pos).split('\n').length
      errors.push({
        line: ln,
        message: `"${match[1]}" → "${KEYWORD_TYPOS[word]}" 오타가 의심됩니다.`,
      })
    }
  }
}

function removeCommentsAndStrings(sql) {
  // Remove single-line comments
  let result = sql.replace(/--.*$/gm, '')
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')
  // Replace string literals with placeholder
  result = result.replace(/'[^']*'/g, "'X'")
  return result
}

function detectStatementType(upper) {
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) return 'SELECT'
  if (upper.startsWith('INSERT')) return 'INSERT'
  if (upper.startsWith('UPDATE')) return 'UPDATE'
  if (upper.startsWith('DELETE')) return 'DELETE'
  if (upper.startsWith('MERGE')) return 'MERGE'
  if (upper.startsWith('CREATE')) return 'CREATE'
  if (upper.startsWith('ALTER')) return 'ALTER'
  if (upper.startsWith('DROP')) return 'DROP'
  return 'UNKNOWN'
}

function findUnmatchedQuoteLine(lines, char) {
  let count = 0
  for (let i = 0; i < lines.length; i++) {
    count += (lines[i].match(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    if (count % 2 !== 0) return i + 1
  }
  return 1
}

function findKeywordLineSimple(lines, keyword) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes(keyword)) return i + 1
  }
  return 1
}

function findKeywordLine(lines, keyword, afterPos) {
  let charCount = 0
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1
    if (charCount > afterPos && lines[i].toUpperCase().includes(keyword)) return i + 1
  }
  return findKeywordLineSimple(lines, keyword)
}

export default function QueryValidation() {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState(null)

  function handleValidate() {
    const r = validateOracleQuery(sql)
    setResult(r)
  }

  function handleClear() {
    setSql('')
    setResult(null)
  }

  const errorLines = new Set()
  const warningLines = new Set()
  if (result) {
    result.errors.forEach((e) => errorLines.add(e.line))
    result.warnings.forEach((w) => warningLines.add(w.line))
  }

  return (
    <div className="page-container">
      <h1 className="page-title">쿼리검증</h1>
      <p className="qv-desc">Oracle SQL 쿼리의 구문을 검증합니다.</p>

      <div className="qv-editor-area">
        {/* Line numbers + highlights */}
        <div className="qv-editor-wrapper">
          <div className="qv-line-numbers">
            {(sql || ' ').split('\n').map((_, i) => (
              <div
                key={i}
                className={`qv-line-num ${errorLines.has(i + 1) ? 'error' : ''} ${warningLines.has(i + 1) ? 'warning' : ''}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            className="qv-textarea"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="Oracle SQL 쿼리를 입력하세요..."
            spellCheck={false}
          />
        </div>
        <div className="qv-actions">
          <button className="qv-btn primary" onClick={handleValidate}>
            검증
          </button>
          <button className="qv-btn" onClick={handleClear}>
            초기화
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="qv-results">
          {result.errors.length === 0 && result.warnings.length === 0 && (
            <div className="qv-result-item success">
              <span className="qv-result-badge success">OK</span>
              구문 오류가 발견되지 않았습니다.
            </div>
          )}
          {result.errors.map((e, i) => (
            <div key={`e-${i}`} className="qv-result-item error">
              <span className="qv-result-badge error">ERROR</span>
              <span className="qv-result-line">Line {e.line}</span>
              {e.message}
            </div>
          ))}
          {result.warnings.map((w, i) => (
            <div key={`w-${i}`} className="qv-result-item warning">
              <span className="qv-result-badge warning">WARN</span>
              <span className="qv-result-line">Line {w.line}</span>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
