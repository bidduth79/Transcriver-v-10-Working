import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_SHORTCUTS, SHORTCUT_CATEGORIES, getSavedShortcuts, saveShortcut, resetShortcuts } from '../../../services/ShortcutConfig';

// Saved overrides, search/grouping and key-capture editing for the shortcut modal
export const useShortcutEditor = (isOpen: boolean) => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [customMap, setCustomMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomMap(getSavedShortcuts());
      setSearchTerm('');
      setEditingId(null);
    }
  }, [isOpen]);

  const filteredShortcuts = useMemo(() => {
    if (!searchTerm) return DEFAULT_SHORTCUTS;
    const lower = searchTerm.toLowerCase();
    return DEFAULT_SHORTCUTS.filter(s => 
      s.label.toLowerCase().includes(lower) || 
      s.description.toLowerCase().includes(lower) ||
      (customMap[s.id] || s.defaultKeys).toLowerCase().includes(lower)
    );
  }, [searchTerm, customMap]);

  // Group by Category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, typeof DEFAULT_SHORTCUTS> = {};
    SHORTCUT_CATEGORIES.forEach(cat => groups[cat] = []);
    filteredShortcuts.forEach(s => {
      if (groups[s.category]) groups[s.category].push(s);
    });
    return groups;
  }, [filteredShortcuts]);

  const handleResetAll = () => {
    if (confirm('Are you sure you want to reset all shortcuts to default?')) {
      resetShortcuts();
      setCustomMap({});
    }
  };

  const startEditing = (id: string) => {
    setEditingId(id);
  };

  const saveEdit = (id: string, newKeyStr: string) => {
    saveShortcut(id, newKeyStr);
    setCustomMap(prev => ({ ...prev, [id]: newKeyStr }));
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingId) return;
    e.preventDefault();
    e.stopPropagation();

    // Block only modifier keys from being saved alone
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');

    let char = e.key;
    if (char === ' ') char = 'Space';
    if (char.length === 1) char = char.toUpperCase();
    if (char === 'ArrowUp') char = 'ArrowUp';
    if (char === 'ArrowDown') char = 'ArrowDown';
    
    keys.push(char);
    const keyStr = keys.join('+');

    // Conflict Check
    const conflict = DEFAULT_SHORTCUTS.find(s => {
       const currentKey = customMap[s.id] || s.defaultKeys;
       return currentKey === keyStr && s.id !== editingId;
    });

    if (conflict) {
       if (!confirm(`Shortcut "${keyStr}" is already used by "${conflict.label}". Overwrite?`)) {
         return;
       }
    }

    saveEdit(editingId, keyStr);
  };

  return {
    activeTab, setActiveTab, searchTerm, setSearchTerm, customMap, editingId, setEditingId,
    groupedShortcuts, handleResetAll, startEditing, handleKeyDown,
  };
};

export type ShortcutEditorState = ReturnType<typeof useShortcutEditor>;
