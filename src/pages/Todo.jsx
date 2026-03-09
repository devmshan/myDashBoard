import { useState } from 'react'
import './Todo.css'

const COLORS = [
  { id: 'default', bg: '#252525', border: '#333' },
  { id: 'red', bg: '#2c1b1b', border: '#5c2b2b' },
  { id: 'orange', bg: '#2c241a', border: '#5c4a2a' },
  { id: 'yellow', bg: '#2b2a1a', border: '#5c562a' },
  { id: 'green', bg: '#1b2c1e', border: '#2b5c33' },
  { id: 'blue', bg: '#1b222c', border: '#2b3f5c' },
  { id: 'purple', bg: '#261b2c', border: '#4a2b5c' },
]

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export default function Todo() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('todo-notes')
    return saved ? JSON.parse(saved) : []
  })
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  function save(updated) {
    setNotes(updated)
    localStorage.setItem('todo-notes', JSON.stringify(updated))
  }

  function addNote() {
    if (!newTitle.trim() && !newContent.trim()) {
      setIsAdding(false)
      return
    }
    const note = {
      id: generateId(),
      title: newTitle.trim(),
      content: newContent.trim(),
      color: 'default',
      pinned: false,
      done: false,
      createdAt: Date.now(),
    }
    save([note, ...notes])
    setNewTitle('')
    setNewContent('')
    setIsAdding(false)
  }

  function deleteNote(id) {
    save(notes.filter((n) => n.id !== id))
  }

  function togglePin(id) {
    save(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)))
  }

  function toggleDone(id) {
    save(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)))
  }

  function changeColor(id, colorId) {
    save(notes.map((n) => (n.id === id ? { ...n, color: colorId } : n)))
  }

  function startEdit(note) {
    setEditingId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  function saveEdit() {
    save(
      notes.map((n) =>
        n.id === editingId
          ? { ...n, title: editTitle.trim(), content: editContent.trim() }
          : n
      )
    )
    setEditingId(null)
  }

  const pinned = notes.filter((n) => n.pinned)
  const others = notes.filter((n) => !n.pinned)

  function getColor(colorId) {
    return COLORS.find((c) => c.id === colorId) || COLORS[0]
  }

  return (
    <div className="page-container">
      <h1 className="page-title">할일</h1>

      {/* Input area */}
      <div className="todo-input-area">
        {!isAdding ? (
          <div className="todo-input-collapsed" onClick={() => setIsAdding(true)}>
            메모 작성...
          </div>
        ) : (
          <div className="todo-input-expanded">
            <input
              className="todo-input-title"
              placeholder="제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className="todo-input-content"
              placeholder="메모 작성..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
            />
            <div className="todo-input-actions">
              <button className="todo-btn-close" onClick={addNote}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <>
          <div className="todo-section-label">고정됨</div>
          <div className="todo-grid">
            {pinned.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                color={getColor(note.color)}
                onDelete={deleteNote}
                onTogglePin={togglePin}
                onToggleDone={toggleDone}
                onChangeColor={changeColor}
                onEdit={startEdit}
              />
            ))}
          </div>
        </>
      )}

      {/* Others */}
      {others.length > 0 && (
        <>
          {pinned.length > 0 && <div className="todo-section-label">기타</div>}
          <div className="todo-grid">
            {others.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                color={getColor(note.color)}
                onDelete={deleteNote}
                onTogglePin={togglePin}
                onToggleDone={toggleDone}
                onChangeColor={changeColor}
                onEdit={startEdit}
              />
            ))}
          </div>
        </>
      )}

      {notes.length === 0 && (
        <div className="todo-empty">메모가 없습니다. 위에서 새 메모를 작성해보세요.</div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="todo-modal-overlay" onClick={saveEdit}>
          <div
            className="todo-modal"
            style={{
              background: getColor(
                notes.find((n) => n.id === editingId)?.color
              ).bg,
              borderColor: getColor(
                notes.find((n) => n.id === editingId)?.color
              ).border,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              className="todo-input-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="제목"
            />
            <textarea
              className="todo-input-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="메모 작성..."
              rows={6}
            />
            <div className="todo-input-actions">
              <button className="todo-btn-close" onClick={saveEdit}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  color,
  onDelete,
  onTogglePin,
  onToggleDone,
  onChangeColor,
  onEdit,
}) {
  const [showColors, setShowColors] = useState(false)

  return (
    <div
      className={`note-card ${note.done ? 'done' : ''}`}
      style={{ background: color.bg, borderColor: color.border }}
      onClick={() => onEdit(note)}
    >
      {/* Pin button */}
      <button
        className={`note-action pin ${note.pinned ? 'active' : ''}`}
        title={note.pinned ? '고정 해제' : '고정'}
        onClick={(e) => {
          e.stopPropagation()
          onTogglePin(note.id)
        }}
      >
        📌
      </button>

      {note.title && <h4 className={note.done ? 'line-through' : ''}>{note.title}</h4>}
      {note.content && (
        <p className={note.done ? 'line-through' : ''}>{note.content}</p>
      )}

      {/* Bottom actions */}
      <div className="note-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="note-action-btn"
          title={note.done ? '완료 취소' : '완료'}
          onClick={() => onToggleDone(note.id)}
        >
          {note.done ? '↩️' : '✔️'}
        </button>
        <button
          className="note-action-btn"
          title="색상"
          onClick={() => setShowColors(!showColors)}
        >
          🎨
        </button>
        <button
          className="note-action-btn"
          title="삭제"
          onClick={() => onDelete(note.id)}
        >
          🗑️
        </button>
      </div>

      {/* Color picker */}
      {showColors && (
        <div className="note-colors" onClick={(e) => e.stopPropagation()}>
          {COLORS.map((c) => (
            <button
              key={c.id}
              className={`color-dot ${note.color === c.id ? 'selected' : ''}`}
              style={{ background: c.bg, borderColor: c.border }}
              onClick={() => {
                onChangeColor(note.id, c.id)
                setShowColors(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
