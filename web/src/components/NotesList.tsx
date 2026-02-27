import { useState, memo } from 'react';
import type { Note } from '../types';

interface NotesListProps {
  notes: Note[];
  onAddNote: (text: string) => Promise<void>;
  disabled?: boolean;
}

export default memo(function NotesList({ notes, onAddNote, disabled }: NotesListProps) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(text);
      setInput('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {notes.length > 0 ? (
        notes.map((note) => (
          <div key={note.id} className="bg-zinc-800/50 rounded p-2">
            <p className="text-xs text-zinc-400 whitespace-pre-wrap">{note.text}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{note.createdAt}</p>
          </div>
        ))
      ) : (
        <p className="text-xs text-zinc-500">No notes yet.</p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a note..."
          className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleAdd}
          disabled={submitting || disabled}
          className="px-3 py-1.5 bg-zinc-700 text-zinc-200 text-xs rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
});
