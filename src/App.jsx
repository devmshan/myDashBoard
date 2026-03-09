import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Todo from './pages/Todo'
import QueryValidation from './pages/QueryValidation'
import QueryFormat from './pages/QueryFormat'
import LunchPicker from './pages/LunchPicker'
import './App.css'

const NAV_ITEMS = [
  { id: 'home', label: '홈', icon: '🏠' },
  { id: 'todo', label: '할일', icon: '✅' },
]

const TOOL_ITEMS = [
  { id: 'query-validation', label: '쿼리검증', icon: '🔍' },
  { id: 'query-format', label: '쿼리정렬', icon: '📐' },
  { id: 'lunch-picker', label: '점메추', icon: '🍽️' },
]

const PAGE_MAP = {
  home: Home,
  todo: Todo,
  'query-validation': QueryValidation,
  'query-format': QueryFormat,
  'lunch-picker': LunchPicker,
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const [now, setNow] = useState(new Date())
  const ActiveComponent = PAGE_MAP[activePage]

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = now.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🌊</div>
          <span className="sidebar-logo-text">In to the BLUE</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="sidebar-section-label">도구</div>
          {TOOL_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <div className="top-bar">
          <span className="server-time">{timeStr}</span>
        </div>
        {activePage === 'home' ? (
          <Home now={now} onNavigate={setActivePage} />
        ) : (
          <ActiveComponent />
        )}
      </main>
    </div>
  )
}

export default App
