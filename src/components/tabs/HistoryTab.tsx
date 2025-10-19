
import React, { useState } from 'react';
import type { ComparisonHistoryItem } from '../../types';
import ComparisonResults from '../ComparisonResults';

interface HistoryTabProps {
  history: ComparisonHistoryItem[];
}

const HistoryTab: React.FC<HistoryTabProps> = ({ history }) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const selectedHistoryItem = history.find(h => h.id === selectedHistoryId);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
  }

  if (history.length === 0) {
    return (
        <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-semibold">Nenhum Histórico de Comparação</h2>
            <p className="mt-2">Os resultados das comparações que você salvar aparecerão aqui.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-1/3 lg:w-1/4">
             <h2 className="text-2xl font-semibold text-blue-300 mb-4">Comparações Salvas</h2>
             <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {history.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setSelectedHistoryId(item.id)}
                        className={`w-full text-left p-3 rounded-md transition-colors ${selectedHistoryId === item.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                        <p className="font-semibold">{formatDate(item.timestamp)}</p>
                        <p className="text-xs text-gray-400">
                            {item.summary.matches} acertos, {item.summary.mismatches} erros de {item.summary.total} totais.
                        </p>
                    </button>
                ))}
             </div>
        </aside>
        <main className="flex-grow">
            {selectedHistoryItem ? (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-2xl font-semibold text-blue-300 mb-4">
                        Detalhes da Comparação de {formatDate(selectedHistoryItem.timestamp)}
                    </h2>
                    <ComparisonResults results={selectedHistoryItem.results} />
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-lg h-full flex flex-col justify-center">
                    <h2 className="text-2xl font-semibold">Selecione um item do histórico</h2>
                    <p className="mt-2">Escolha uma comparação da lista à esquerda para ver os detalhes.</p>
                </div>
            )}
        </main>
    </div>
  );
};

export default HistoryTab;
