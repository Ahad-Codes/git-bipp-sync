import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSpaceFiles } from '../../hooks/useSpaceData';
import { tw } from '../../lib/colors';
import { BrokenFakeModule } from '../../utils/nonexistent';

/* PLACEHOLDER_APP - Replace with your custom app */

/**
 * Activity Tracker - A template app to get you started.
 * 
 * Features demonstrated:
 * - File-based data persistence with useSpaceFiles hook
 * - CRUD operations (Create, Read, Delete)
 * - Form handling and validation
 * - List rendering with loading and empty states
 */

interface Activity {
  id: string;
  date: string;
  type: string;
  duration: number;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

interface ActivityTrackerProps {
  dataFile: string; // Path to JSON data file (e.g., "data/activities.json")
}

export default function ActivityTracker({ dataFile }: ActivityTrackerProps) {
  const { data: activitiesData, update, loading } = useSpaceFiles<Activity[]>({
    dataFile,
    autoFetch: true
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: '',
    duration: 30,
    priority: 'medium' as const,
    notes: ''
  });

  const activities = activitiesData || [];

  const handleAdd = async () => {
    const activity: Activity = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...newActivity
    };
    await update([...activities, activity]);
    setNewActivity({ type: '', duration: 30, priority: 'medium', notes: '' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    await update(activities.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--space-border-default)] bg-[var(--space-surface-card)]">
        <div>
          <h2 className="font-semibold text-lg text-gray-900">Activity Tracker</h2>
          <p className="text-sm text-gray-600">Track your daily activities</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className={`px-3 py-2 ${tw.button.primary} text-sm rounded-md flex items-center gap-1`}
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="p-4 bg-[var(--space-surface-panel)] border-b border-[var(--space-border-default)]">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
              <input
                type="text"
                value={newActivity.type}
                onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                placeholder="Meeting, Task, Project, etc."
                className={tw.input.default}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={newActivity.duration}
                onChange={(e) => setNewActivity({ ...newActivity, duration: parseInt(e.target.value) })}
                className={tw.input.default}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={newActivity.priority}
                onChange={(e) => setNewActivity({ ...newActivity, priority: e.target.value as any })}
                className={tw.input.default}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={newActivity.notes}
                onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                rows={2}
                placeholder="Additional details..."
                className={tw.input.default}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className={`px-4 py-2 ${tw.button.primary} text-sm rounded-md`}
              >
                Save
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className={`px-4 py-2 ${tw.button.secondary} text-sm rounded-md`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No activities yet. Click "Add Activity" to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className={`p-3 ${tw.card.flat}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{activity.type}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        activity.priority === 'high' ? tw.priority.high :
                        activity.priority === 'medium' ? tw.priority.medium :
                        tw.priority.low
                      }`}>
                        {activity.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {activity.duration} minutes • {new Date(activity.date).toLocaleDateString()}
                    </p>
                    {activity.notes && (
                      <p className="text-sm text-gray-700 mt-2">{activity.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(activity.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {activities.length > 0 && (
        <div className="p-4 border-t border-[var(--space-border-default)] bg-[var(--space-surface-panel)]">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Activities:</span>
            <span className="font-semibold text-gray-900">{activities.length}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Total Time:</span>
            <span className="font-semibold text-gray-900">
              {activities.reduce((sum, a) => sum + a.duration, 0)} min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
