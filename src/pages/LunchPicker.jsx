import { useState, useRef } from 'react'
import './LunchPicker.css'

const MENUS = [
  { name: '돈까스', place: '경양식당', color: '#e8d5b7' },
  { name: '짜장면', place: '홍콩반점', color: '#d4bfaa' },
  { name: '김치찌개', place: '김씨네밥상', color: '#f0c8c8' },
  { name: '쌀국수', place: '포베이', color: '#c8e0c8' },
  { name: '치킨', place: 'BBQ', color: '#f5deb3' },
  { name: '떡볶이', place: '신전떡볶이', color: '#f4c2c2' },
  { name: '초밥', place: '스시웨이', color: '#c8d8e8' },
  { name: '감자탕', place: '왕감자탕', color: '#e0d0c0' },
  { name: '햄버거', place: '맥도날드', color: '#f5e6c8' },
  { name: '칼국수', place: '손칼국수', color: '#d8e8d8' },
  { name: '제육볶음', place: '한솥도시락', color: '#ecc8b0' },
  { name: '부대찌개', place: '놀부부대찌개', color: '#e0c8c0' },
]

const TOTAL = MENUS.length
const ARC = 360 / TOTAL

export default function LunchPicker() {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const wheelRef = useRef(null)

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    setResult(null)

    const extraSpins = 360 * (5 + Math.floor(Math.random() * 3))
    const randomAngle = Math.random() * 360
    const newRotation = rotation + extraSpins + randomAngle

    setRotation(newRotation)

    setTimeout(() => {
      const finalAngle = newRotation % 360
      // 화살표가 위(0도)에 있으므로, 해당 각도에 맞는 메뉴 계산
      const idx = Math.floor(((360 - finalAngle + ARC / 2) % 360) / ARC) % TOTAL
      setResult(MENUS[idx])
      setSpinning(false)
    }, 4000)
  }

  const reset = () => {
    setResult(null)
  }

  return (
    <div className="page-container">
      <h1 className="page-title">점메추</h1>
      <p className="lp-desc">룰렛을 돌려서 오늘의 점심 메뉴를 정해보세요!</p>

      <div className="lp-wheel-area">
        <div className="lp-arrow">▼</div>
        <div className="lp-wheel-wrapper">
          <svg
            ref={wheelRef}
            className="lp-wheel"
            viewBox="0 0 300 300"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {MENUS.map((item, i) => {
              const startAngle = i * ARC
              const endAngle = startAngle + ARC
              const startRad = (Math.PI / 180) * (startAngle - 90)
              const endRad = (Math.PI / 180) * (endAngle - 90)
              const x1 = 150 + 140 * Math.cos(startRad)
              const y1 = 150 + 140 * Math.sin(startRad)
              const x2 = 150 + 140 * Math.cos(endRad)
              const y2 = 150 + 140 * Math.sin(endRad)
              const largeArc = ARC > 180 ? 1 : 0

              const midRad = (Math.PI / 180) * (startAngle + ARC / 2 - 90)
              const textX = 150 + 90 * Math.cos(midRad)
              const textY = 150 + 90 * Math.sin(midRad)
              const textRotate = startAngle + ARC / 2

              return (
                <g key={i}>
                  <path
                    d={`M150,150 L${x1},${y1} A140,140 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={item.color}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRotate}, ${textX}, ${textY})`}
                    fill="#37352f"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="'Noto Sans KR', sans-serif"
                  >
                    {item.name}
                  </text>
                </g>
              )
            })}
            <circle cx="150" cy="150" r="22" fill="#fff" stroke="#e8e7e4" strokeWidth="2" />
          </svg>
        </div>

        <button className="lp-spin-btn" onClick={spin} disabled={spinning}>
          {spinning ? '돌리는 중...' : '돌리기!'}
        </button>
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
