import React, { useState, useEffect, useRef } from 'react';
import {
  setActiveModel,
  AIModelDefinition,
  isSpeedOptimizationEnabled,
  setSpeedOptimizationEnabled,
  resetModelToClassicDefault,
} from '../../../services/ApiKeyManager.ts';

// Dropdown, info-tooltip, Speed Boost and reset state for the footer model selector
export const useModelSelector = (onKeyUpdate?: () => void) => {
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<AIModelDefinition | null>(null);
  const [speedOpt, setSpeedOpt] = useState<boolean>(() => isSpeedOptimizationEnabled());
  const [resetNotice, setResetNotice] = useState(false);
  const modelSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
        setShowModelSelect(false);
        setHoveredModel(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelSelect = (modelId: string) => {
    setActiveModel(modelId);
    setShowModelSelect(false);
    setHoveredModel(null);
    if (onKeyUpdate) onKeyUpdate();
  };

  const handleToggleSpeedOpt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !speedOpt;
    setSpeedOpt(next);
    setSpeedOptimizationEnabled(next);
    if (onKeyUpdate) onKeyUpdate();
  };

  const handleResetToDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetModelToClassicDefault();
    setSpeedOpt(false);
    setResetNotice(true);
    if (onKeyUpdate) onKeyUpdate();
    setTimeout(() => {
      setResetNotice(false);
      setShowModelSelect(false);
    }, 1200);
  };

  return {
    modelSelectRef,
    showModelSelect, setShowModelSelect,
    hoveredModel, setHoveredModel,
    speedOpt, resetNotice,
    handleModelSelect, handleToggleSpeedOpt, handleResetToDefault,
  };
};

export type ModelSelectorState = ReturnType<typeof useModelSelector>;
