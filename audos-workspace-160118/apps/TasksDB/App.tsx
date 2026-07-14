import { useEffect, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { tw } from '../../lib/colors';

/* CANONICAL TEMPLATE - Copy this pattern for new apps that need persistence */

/**
 * Tasks (WorkspaceDB) — the canonical persistence pattern for new apps.
 *
 * Why this app exists:
 * - Demonstrates `useWorkspaceDB` for reads and `window.__workspaceDb` for writes.
 * - These exact identifiers trigger the platform to auto-inject the WorkspaceDB SDK
 *   at compile time. No imports, no config — just reference them.
 * - Each visitor gets their own rows automatically (session scoping). Use
 *   `{ shared: true }` only for catalog/reference data that everyone should see.
 *
 * The `tasks` table is created on first write. To pre-create it (recommended),
 * ask Otto to run db_create_table for `tasks` with columns: title (text),
 * done (boolean, default false). The `id`, `session_id`, `created_at`, and
 * `updated_at` columns are added automatically.
 */

interface Task {
  id: number;
  title: string;
  done: boolean;
  created_at?: string;
}

declare global {
  interface Window {
    useWorkspaceDB: <T = any>(
      table: string,
      options?: { shared?: boolean; limit?: number; offset?: number; orderBy?: { column: string; direction: 'asc' | 'desc' }; filters?: Array<{ column: string; operator: string; value: any }> }
    ) => { data: T[]; loading: boolean; error: Error | null; total: number; refresh: () => void };
    __workspaceDb: any;
  }
}

function hasWorkspaceDbAuth(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__workspaceDb?.token && window.useWorkspaceDB);
}

function useWorkspaceDbReady(): boolean {
  const [ready, setReady] = useState(() => hasWorkspaceDbAuth());

  useEffect(() => {
    if (ready || typeof window === 'undefined') return;
    const intervalId = window.setInterval(() => {
      if (hasWorkspaceDbAuth()) {
        setReady(true);
        window.clearInterval(intervalId);
      }
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [ready]);

  return ready;
}

function TasksDbUnavailable() {
  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between p-4 border-b border-[var(--space-border-default)] bg-[var(--space-surface-card)]">
        <div>
          <h2 className="font-semibold text-lg text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-600">Stored in WorkspaceDB</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-gray-900">Workspace data is unavailable in this preview.</p>
          <p className="text-xs text-gray-500 mt-1">Open the workspace with an active session to load saved tasks.</p>
        </div>
      </div>
    </div>
  );
}

function TasksDbInner() {
  // READ: useWorkspaceDB returns { data, loading, error, refresh }.
  // Default scoping is per-visitor (session-scoped). Use { shared: true } for
  // catalog data that all visitors should see.
  const { data: tasks, loading, error, refresh } = window.useWorkspaceDB<Task>('tasks', {
    orderBy: { column: 'created_at', direction: 'desc' },
    limit: 100,
  });

  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  // WRITE: window.__workspaceDb.from(table).insert / update / delete.
  // session_id is filled in automatically.
  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await window.__workspaceDb.from('tasks').insert({ title, done: false });
      setNewTitle('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (task: Task) => {
    await window.__workspaceDb.from('tasks').update(task.id, { done: !task.done });
    refresh();
  };

  const handleDelete = async (id: number) => {
    await window.__workspaceDb.from('tasks').delete(id);
    refresh();
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between p-4 border-b border-[var(--space-border-default)] bg-[var(--space-surface-card)]">
        <div>
          <h2 className="font-semibold text-lg text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-600">Stored in WorkspaceDB (PostgreSQL)</p>
        </div>
      </div>

      <div className="p-4 border-b border-[var(--space-border-default)] bg-[var(--space-surface-panel)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="What needs doing?"
            className={tw.input.default}
          />
          <button
            onClick={handleAdd}
            disabled={busy || !newTitle.trim()}
            className={`px-3 py-2 ${tw.button.primary} text-sm rounded-md flex items-center gap-1 disabled:opacity-50`}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading tasks…</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 text-sm">Error: {error.message}</div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No tasks yet. Add one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className={`p-3 ${tw.card.flat} flex items-center justify-between`}>
                <button
                  onClick={() => handleToggle(task)}
                  className={`flex items-center gap-3 flex-1 text-left ${task.done ? 'opacity-60 line-through' : ''}`}
                >
                  <span className={`w-5 h-5 rounded border flex items-center justify-center ${task.done ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                    {task.done && <Check className="w-3 h-3" />}
                  </span>
                  <span className="text-gray-900">{task.title}</span>
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TasksDB() {
  const workspaceDbReady = useWorkspaceDbReady();
  if (!workspaceDbReady) return <TasksDbUnavailable />;
  return <TasksDbInner />;
}
