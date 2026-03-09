import './Home.css'

export default function Home() {
  return (
    <div className="page-container">
      <h1 className="page-title">👋 반갑습니다</h1>
      <p className="home-desc">In to the BLUE에 오신 것을 환영합니다.</p>

      <div className="home-cards">
        <div className="home-card">
          <div className="home-card-icon">✅</div>
          <div>
            <h3>할일</h3>
            <p>오늘의 할일을 관리하세요</p>
          </div>
        </div>
        <div className="home-card">
          <div className="home-card-icon">🔍</div>
          <div>
            <h3>쿼리검증</h3>
            <p>SQL 쿼리의 유효성을 검증합니다</p>
          </div>
        </div>
        <div className="home-card">
          <div className="home-card-icon">📐</div>
          <div>
            <h3>쿼리정렬</h3>
            <p>SQL 쿼리를 보기 좋게 정렬합니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}
