import './Home.css'

const SHORTCUTS = [
  { id: 'todo', icon: '✅', label: '할일', desc: '오늘의 할일을 관리하세요' },
  { id: 'query-validation', icon: '🔍', label: '쿼리검증', desc: 'Oracle SQL 오류를 검증합니다' },
  { id: 'query-format', icon: '📐', label: '쿼리정렬', desc: 'SQL 쿼리를 보기 좋게 정렬합니다' },
  { id: 'lunch-picker', icon: '🍽️', label: '점메추', desc: '룰렛으로 점심 메뉴를 추천받으세요' },
]

function getGreeting(hour) {
  if (hour < 6) return '늦은 밤이에요'
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후에요'
  return '좋은 저녁이에요'
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

export default function Home({ now, onNavigate }) {
  const greeting = getGreeting(now.getHours())
  const month = now.getMonth() + 1
  const date = now.getDate()
  const day = WEEKDAY[now.getDay()]

  return (
    <div className="home">
      <div className="home-cover">
        <div className="home-cover-gradient" />
      </div>

      <div className="home-body">
        <div className="home-greeting-area">
          <div className="home-date">{month}월 {date}일 {day}요일</div>
          <h1 className="home-greeting">{greeting} 👋</h1>
        </div>

        <div className="home-section">
          <div className="home-section-title">바로가기</div>
          <div className="home-shortcuts">
            {SHORTCUTS.map((item) => (
              <button
                key={item.id}
                className="home-shortcut"
                onClick={() => onNavigate(item.id)}
              >
                <div className="home-shortcut-icon">{item.icon}</div>
                <div className="home-shortcut-info">
                  <div className="home-shortcut-label">{item.label}</div>
                  <div className="home-shortcut-desc">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
