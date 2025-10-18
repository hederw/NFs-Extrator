import React, { useState } from 'react';
import type { Layout } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';

interface LayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (layout: Omit<Layout, 'id'>) => void;
  layouts: Layout[];
  selectedLayoutId: string;
  onSelectLayout: (id: string) => void;
  onDeleteLayout: (id: string) => void;
}

const LayoutModal: React.FC<LayoutModalProps> = ({ isOpen, onClose, onSave, layouts, selectedLayoutId, onSelectLayout, onDeleteLayout }) => {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && prompt) {
      onSave({ name, prompt });
      setName('');
      setPrompt('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex-shrink-0 mb-6">
            <h2 className="text-2xl font-bold text-blue-300">Gerenciar Layouts de Extração</h2>
            <p className="text-sm text-gray-400">Selecione, edite, exclua ou crie um novo layout.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 overflow-y-auto">
            {/* Seção de Seleção */}
            <div className="flex-1">
                <h3 className="text-lg font-semibold mb-3 text-gray-300 border-b border-gray-700 pb-2">Layouts Salvos</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {layouts.map(layout => (
                        <div key={layout.id} className="group flex items-center gap-2">
                            <button
                                onClick={() => onSelectLayout(layout.id)}
                                className={`flex-grow text-left p-3 rounded-md transition-colors flex items-center justify-between ${
                                    selectedLayoutId === layout.id
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                }`}
                            >
                                <span className="truncate">{layout.name}</span>
                                {selectedLayoutId === layout.id && <CheckIcon />}
                            </button>
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteLayout(layout.id)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-2 rounded-md bg-red-800/50 hover:bg-red-700 text-red-300 hover:text-white transition-opacity"
                                aria-label={`Excluir layout ${layout.name}`}
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Seção de Criação */}
            <div className="flex-1 md:border-l md:pl-6 border-gray-700">
                 <h3 className="text-lg font-semibold mb-3 text-gray-300 border-b border-gray-700 pb-2">Criar Novo Layout</h3>
                 <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="layoutName" className="block text-sm font-medium text-gray-300 mb-1">
                        Nome do Layout
                        </label>
                        <input
                        type="text"
                        id="layoutName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Ex: Notas de São Paulo"
                        required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="layoutPrompt" className="block text-sm font-medium text-gray-300 mb-1">
                        Prompt de Extração
                        </label>
                        <textarea
                        id="layoutPrompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={5}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Ex: O número da nota está no canto superior direito..."
                        required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
                    >
                        Salvar Novo Layout
                    </button>
                 </form>
            </div>
        </div>

        <div className="flex-shrink-0 mt-6 pt-4 border-t border-gray-700 flex justify-end">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors"
            >
                Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutModal;
