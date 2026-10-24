import React from 'react';
import { useModalBehavior } from '../../../hooks/useModalBehavior';
import { MODAL_LAYER, MODAL_BACKDROP } from '../../../constants/modalLayers';

interface Props {
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCancel: () => void;
}

// Full-screen "press new keys" prompt; a hidden focused input receives the key combo
export const ShortcutCaptureOverlay = ({ onKeyDown, onCancel }: Props) => {
  const { dialogProps, backdropProps } = useModalBehavior(true, onCancel);
  return (
             <div className={`fixed inset-0 ${MODAL_LAYER.dialogOverlay} ${MODAL_BACKDROP} flex items-center justify-center cursor-default`} {...backdropProps}>
                <div {...dialogProps} className="bg-slate-950 p-10 rounded-[2rem] border border-white/20 shadow-2xl text-center outline-none">
                   <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                   </div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Press New Keys</h3>
                   <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-8">Type the combination you want to use</p>
                   <input 
                     autoFocus 
                     readOnly 
                     onKeyDown={onKeyDown} 
                     className="bg-transparent border-none outline-none text-center text-transparent w-full h-0"
                   />
                   <button onClick={onCancel} className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest hover:underline">Cancel</button>
                </div>
             </div>
  );
};
