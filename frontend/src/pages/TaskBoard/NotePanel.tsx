import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconButton, Button } from '@jarvis/jads';
import type { TaskNote } from '../../api/client';
import './NotePanel.css';

interface NotePanelProps {
  taskTitle: string;
  notes: TaskNote[];
  onClose: () => void;
  onCreate: (content: string) => void;
  onUpdate: (noteId: number, content: string) => void;
  onDelete: (noteId: number) => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function NotePanel({ taskTitle, notes, onClose, onCreate, onUpdate, onDelete }: NotePanelProps) {
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleCreate() {
    if (!newContent.trim()) return;
    onCreate(newContent);
    setNewContent('');
  }

  function startEdit(note: TaskNote) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  function handleSaveEdit() {
    if (editingId === null || !editContent.trim()) return;
    onUpdate(editingId, editContent);
    setEditingId(null);
    setEditContent('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
  }

  function handleDelete(noteId: number) {
    onDelete(noteId);
    setDeletingId(null);
  }

  return (
    <div className="note-panel-overlay" onClick={onClose}>
      <aside className="note-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Notes — ${taskTitle}`}>
        <header className="note-panel__header">
          <h3 className="note-panel__title">Notes — {taskTitle}</h3>
          <IconButton aria-label="Close notes panel" variant="ghost" size="sm" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="note-panel__create">
          <textarea
            className="note-panel__textarea"
            placeholder="Write a new note (markdown supported)..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
          />
          <Button onClick={handleCreate} disabled={!newContent.trim()}>
            Save
          </Button>
        </div>

        <div className="note-panel__list">
          {notes.length === 0 && (
            <p className="note-panel__empty">No notes yet.</p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="note-panel__note">
              {editingId === note.id ? (
                <div className="note-panel__edit">
                  <textarea
                    className="note-panel__textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                  />
                  <div className="note-panel__edit-actions">
                    <Button onClick={handleSaveEdit} disabled={!editContent.trim()}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : deletingId === note.id ? (
                <div className="note-panel__confirm">
                  <p>Delete this note?</p>
                  <div className="note-panel__confirm-actions">
                    <Button onClick={() => handleDelete(note.id)}>
                      Delete
                    </Button>
                    <Button variant="ghost" onClick={() => setDeletingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-panel__note-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                  </div>
                  <div className="note-panel__note-meta">
                    <span className="note-panel__note-date">
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="note-panel__note-actions">
                      <IconButton aria-label="Edit note" variant="ghost" size="sm" onClick={() => startEdit(note)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton aria-label="Delete note" variant="ghost" size="sm" onClick={() => setDeletingId(note.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
