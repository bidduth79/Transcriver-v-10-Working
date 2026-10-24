import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil } from 'lucide-react';
import type { ActiveColors } from '../../hooks/useAppTheme';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { MODAL_LAYER, MODAL_BACKDROP } from '../../constants/modalLayers';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message: string;
  defaultValue: string;
  confirmText: string;
  cancelText: string;
  isDark: boolean;
  activeColors: ActiveColors;
}

// The app's own one-line text question (instead of the browser's prompt()), looking like ConfirmModal
export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen, onClose, onSubmit, title, message, defaultValue, confirmText, cancelText, isDark, activeColors,
}) => {
  const [value, setValue] = useState(defaultValue);
  const { dialogProps, backdropProps } = useModalBehavior<HTMLFormElement>(isOpen, onClose);

  useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 ${MODAL_LAYER.dialog} flex items-center justify-center p-4 ${MODAL_BACKDROP}`}
        {...backdropProps}
      >
        <motion.form
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onSubmit={submit}
          {...dialogProps}
          className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border outline-none ${
            isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <Pencil className="w-6 h-6" />
            </div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
          </div>

          <label htmlFor="prompt-modal-input" className={`block mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {message}
          </label>
          <input
            id="prompt-modal-input"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={e => e.target.select()}
            className={`w-full mb-8 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          />

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cancelText}
            </button>
            <button type="submit" className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${activeColors.primary}`}>
              {confirmText}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
};
