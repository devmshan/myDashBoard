import { useState, useRef, useEffect, useCallback } from 'react'
import './LunchPicker.css'

const MENUS = [
  { name: '돈까스', place: '경양식당', color: '#f6e4c4' },
  { name: '짜장면', place: '홍콩반점', color: '#d4c1a8' },
  { name: '김치찌개', place: '킹과식당', color: '#f7b7b7' },
  { name: '쌀국수', place: '포베이', color: '#b8e6ce' },
  { name: '치킨', place: '지코바', color: '#ffe0a0' },
  { name: '떡볶이', place: '동떡이', color: '#ffadad' },
  { name: '파스타', place: '스파게티스토리', color: '#a8d4f0' },
  { name: '뼈해장국', place: '감성뼈다귀', color: '#e8cdb5' },
  { name: '햄버거', place: '맥도날드', color: '#ffe5a0' },
  { name: '중국집', place: '츠바오', color: '#f0c8a0' },
  { name: '칼국수', place: '이모네손칼국수', color: '#c2e8c2' },
  { name: '제육볶음', place: '한솥도시락', color: '#f5c4a1' },
  { name: '부대찌개', place: '할머니부대찌개', color: '#f2b5b5' },
  { name: '쌀국수', place: '미스사이공', color: '#a8e8d8' },
  { name: '돈까스', place: '한조', color: '#e8d8b8' },
  { name: '햄버거', place: '온더덱', color: '#ffd480' },
  { name: '중국집', place: '마차이짬뽕', color: '#dbb8e8' },
  { name: '된장찌개', place: '박군한우', color: '#c8d8a0' },
  { name: '순대국', place: '평창순대국', color: '#e0c0d8' },
  { name: '칼국수', place: '최가네칼국수', color: '#b0d8e8' },
  { name: '족발', place: '우만동족발', color: '#e8c8d0' },
]

const ITEM_HEIGHT = 72
const VISIBLE_ITEMS = 3

function shuffleArray(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function buildReel() {
  const items = []
  for (let i = 0; i < 8; i++) {
    items.push(...shuffleArray(MENUS))
  }
  return items
}

export default function LunchPicker() {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [resultIdx, setResultIdx] = useState(-1)
  const [leverPulled, setLeverPulled] = useState(false)
  const reelRef = useRef(null)
  const animRef = useRef(null)
  const offsetRef = useRef(0)
  const speedRef = useRef(0)
  const reelItemsRef = useRef(buildReel())
  const [reelItems, setReelItems] = useState(reelItemsRef.current)
  const [displayOffset, setDisplayOffset] = useState(0)

  const animate = useCallback(() => {
    const speed = speedRef.current

    if (speed < 0.5) {
      // 자연 감속 후 현재 위치에서 가장 가까운 아이템에 스냅
      const nearestIdx = Math.round(offsetRef.current / ITEM_HEIGHT)
      const clampedIdx = Math.max(0, Math.min(nearestIdx, reelItemsRef.current.length - 1))
      const snapOffset = clampedIdx * ITEM_HEIGHT
      offsetRef.current = snapOffset
      setDisplayOffset(snapOffset)
      setSpinning(false)
      setLeverPulled(false)
      setResultIdx(clampedIdx)
      setResult(reelItemsRef.current[clampedIdx])
      return
    }

    offsetRef.current += speed
    speedRef.current *= 0.988

    setDisplayOffset(offsetRef.current)
    animRef.current = requestAnimationFrame(animate)
  }, [])

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    setResult(null)
    setResultIdx(-1)
    setLeverPulled(true)

    // 새 릴 생성 - ref와 state 동시에 업데이트
    const items = buildReel()
    reelItemsRef.current = items
    setReelItems(items)

    // 시작 위치와 속도 설정 (충분히 스크롤되도록)
    offsetRef.current = 0
    speedRef.current = 30 + Math.random() * 15

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <div className="page-container">
      <h1 className="page-title">점메추</h1>
      <p className="lp-desc">레버를 당겨서 오늘의 점심 메뉴를 정해보세요!</p>

      <div className="lp-machine">
        {/* 머신 상단 장식 */}
        <div className="lp-machine-top">
          <span className="lp-machine-light lp-light-1" data-spinning={spinning} />
          <span className="lp-machine-label">LUNCH PICKER</span>
          <span className="lp-machine-light lp-light-2" data-spinning={spinning} />
        </div>

        <div className="lp-machine-body">
          {/* 릴 디스플레이 */}
          <div className="lp-reel-frame">
            <div className="lp-reel-highlight" />
            <div className="lp-reel-shadow-top" />
            <div className="lp-reel-shadow-bottom" />
            <div
              ref={reelRef}
              className="lp-reel-strip"
              style={{
                transform: `translateY(${-displayOffset + ITEM_HEIGHT}px)`,
              }}
            >
              {reelItems.map((item, i) => (
                <div
                  key={i}
                  className={`lp-reel-item ${!spinning && result && i === resultIdx ? 'lp-reel-item-selected' : ''}`}
                  style={{ height: ITEM_HEIGHT, background: item.color }}
                >
                  <span className="lp-reel-name">{item.name}</span>
                  <span className="lp-reel-place">{item.place}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 레버 */}
          <div className="lp-lever-area">
            <button
              className={`lp-lever ${leverPulled ? 'lp-lever-pulled' : ''}`}
              onClick={spin}
              disabled={spinning}
              aria-label="레버 당기기"
            >
              <div className="lp-lever-stick" />
              <div className="lp-lever-knob" />
            </button>
          </div>
        </div>

        {/* 버튼 */}
        <div className="lp-machine-bottom">
          <button className="lp-spin-btn" onClick={spin} disabled={spinning}>
            {spinning ? '돌리는 중...' : '🎰 레버 당기기!'}
          </button>
        </div>
      </div>

      {result && (
        <div className="lp-result">
          <div className="lp-result-card">
            <div className="lp-result-title">오늘의 점심은</div>
            <div className="lp-result-menu">{result.name}</div>
            <div className="lp-result-place">{result.place}</div>
            <button className="lp-retry-btn" onClick={spin}>다시 돌리기</button>
          </div>
        </div>
      )}
    </div>
  )
}
