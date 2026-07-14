import { useState, useEffect } from 'react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';

interface UseSpaceFilesOptions {
  dataFile: string;
  autoFetch?: boolean;
  isUserSpecific?: boolean;
  readFromTemplate?: boolean;
}

interface UseSpaceFilesReturn<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  update: (newData: T) => Promise<void>;
}

/**
 * Hook for accessing space JSON files with mode-aware routing.
 * 
 * This hook reads/writes JSON files on disk — NOT the relational workspace database.
 * For relational database access, use `useWorkspaceDB` instead.
 * 
 * - Entrepreneur mode: reads/writes to /spaces/{spaceId}/... (template data)
 * - Customer mode: reads/writes to /user/{sessionId}/... (instance data)
 * 
 * Uses SpaceRuntimeContext which transparently handles storage routing.
 */
export function useSpaceFiles<T = any>(options: UseSpaceFilesOptions): UseSpaceFilesReturn<T> {
  const { readFile, readTemplateFile, writeFile, sessionId, mode } = useSpaceRuntime();
  const { dataFile, autoFetch = true, isUserSpecific = false, readFromTemplate = false } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const reader = (readFromTemplate && mode === 'customer') ? readTemplateFile : readFile;
      const content = await reader(dataFile);
      const parsedData = content ? JSON.parse(content) : null;
      
      const isEmpty = !parsedData || 
        (Array.isArray(parsedData) && parsedData.length === 0) ||
        (typeof parsedData === 'object' && Object.keys(parsedData).length === 0);
      
      if (isEmpty) {
        setData(null);
      } else {
        setData(parsedData);
      }
    } catch (err) {
      setError(err as Error);
      console.error('[useSpaceFiles] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateData = async (newData: T) => {
    if (isUserSpecific && mode === 'customer' && !sessionId) {
      console.error(`[useSpaceFiles] Cannot update ${dataFile} - isUserSpecific=true but no sessionId`);
      throw new Error('Cannot save user data - session not initialized');
    }

    setLoading(true);
    setError(null);
    
    try {
      await writeFile(dataFile, JSON.stringify(newData, null, 2));
      setData(newData);
    } catch (err) {
      setError(err as Error);
      console.error('[useSpaceFiles] Update error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoFetch) return;

    if (mode === 'customer' && !sessionId && !readFromTemplate) {
      console.log(`[useSpaceFiles] Waiting for sessionId before fetching ${dataFile}...`);
      return;
    }

    fetchData();
  }, [dataFile, sessionId, mode, isUserSpecific, readFromTemplate]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    update: updateData,
  };
}

/** @deprecated Use `useSpaceFiles` instead. This alias exists for backward compatibility. */
export const useSpaceData = useSpaceFiles;
