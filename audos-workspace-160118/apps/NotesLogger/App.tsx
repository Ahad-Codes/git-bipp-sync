import { useState } from 'react';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { useSpaceFiles } from '../../hooks/useSpaceData';
import { tw } from '../../lib/colors';

/* PLACEHOLDER_APP - Replace with your custom app */

/**
 * Notes Logger - A template app to get you started.
 * 
 * Features demonstrated:
 * - File-based data persistence with useSpaceFiles hook
 * - CRUD operations (Create, Read, Delete)
 * - Category filtering
 * - Loading and empty states
 */

interface Note {
  id: string;
  title: string;
  content: string;
  category: 'personal' | 'work' | 'ideas' | 'other';
  date: string;
}

interface NotesLoggerProps {
  dataFile: string; // Path to JSON data file (e.g., "data/notes.json")
}

export default function NotesLogger({ dataFile }: NotesLoggerProps) {
  const { data: notesData, update, loading } = useSpaceFiles<Note[]>({
    dataFile,
    autoFetch: true
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    category: 'personal' as const
  });

  const notes = notesData || [];

  const handleAdd = async () => {
    if (!newNote.title.trim()) return; // Validation: title is required
    
    const note: Note = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...newNote
    };

    await update([...notes, note]);
    setNewNote({ title: '', content: '', category: 'personal' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    await update(notes.filter(n => n.id !== id));
  };

  // Group notes by category for display
  const categoryCounts = notes.reduce((acc, note) => {
    acc[note.category] = (acc[note.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--space-border-default)] bg-[var(--space-surface-card)]">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-900">
            <FileText className={`w-5 h-5 ${tw.icon.primary}`} />
            Notes Logger
          </h2>
          <p className="text-sm text-gray-600">Capture your thoughts and ideas</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className={`px-3 py-2 ${tw.button.primary} text-sm rounded-md flex items-center gap-1`}
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading && !isAdding && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading notes...</p>
          </div>
        )}
        
        {isAdding && (
          <div className={`p-4 ${tw.bg.accent} rounded-lg space-y-3 mb-3 border border-[var(--space-border-default)]`}>
            <h3 className="font-medium text-blue-900">New Note</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Enter note title..."
                className={tw.input.default}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select 
                value={newNote.category} 
                onChange={(e) => setNewNote({ ...newNote, category: e.target.value as any })}
                className={tw.input.default}
              >
                <option value="personal">📝 Personal</option>
                <option value="work">💼 Work</option>
                <option value="ideas">💡 Ideas</option>
                <option value="other">📌 Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                placeholder="Write your note here..."
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                rows={4}
                className={tw.input.default}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newNote.title.trim()}
                className={`px-4 py-2 ${tw.button.primary} text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Save Note
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className={`px-4 py-2 ${tw.button.secondary} text-sm rounded-md`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">Click "New Note" to get started</p>
          </div>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className={`p-4 ${tw.card.default} mb-3`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{note.title}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    note.category === 'work' ? tw.category.work :
                    note.category === 'ideas' ? tw.category.ideas :
                    note.category === 'personal' ? tw.category.personal :
                    tw.category.other
                  }`}>
                    {note.category === 'work' ? '💼' :
                     note.category === 'ideas' ? '💡' :
                     note.category === 'personal' ? '📝' : '📌'} {note.category}
                  </span>
                </div>
                {note.content && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{note.content}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(note.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      {notes.length > 0 && (
        <div className="p-4 border-t border-[var(--space-border-default)] bg-[var(--space-surface-panel)]">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Notes:</span>
            <span className="font-semibold text-gray-900">{notes.length}</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(categoryCounts).map(([category, count]) => (
              <span key={category} className={`text-xs px-2 py-1 ${tw.badge.neutral}`}>
                {category}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
