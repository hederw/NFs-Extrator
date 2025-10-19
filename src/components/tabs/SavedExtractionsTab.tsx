import React, { useState } from 'react';
import type { SavedExtractionItem } from '../../types';
import ResultsTable from '../ResultsTable';
import { ExcelIcon } from '../icons/ExcelIcon';
import { InformationCircleIcon } from '../icons/InformationCircleIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { TrashIcon } from '../icons/TrashIcon';

declare const XLSX: any;

interface SavedExtractionsTabProps {
  savedExtractions: SavedExtractionItem[];
  setSavedExtractions: React.Dispatch<React.SetStateAction<SavedExtractionItem[]>>;
}

const SavedExtractionsTab: React.FC<SavedExtractionsTabProps> = ({ savedExtractions, setSavedExtractions }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem = savedExtractions.find(h => h.id === selectedId);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
  }

  const handleExportExcel = (item: SavedExtractionItem) => {
      const successfulResults = item.results.filter(r => r.status === 'success' && r.data);
      if (successfulResults.length === 0) {
          alert('Não há dados para exportar.');
          return;
      }
      const worksheetData = successfulResults.map(r => ({
          'Nome do Arquivo': r.fileName,
          'Prestador': r.data!.prestador,
          'Número da Nota': r.data!.numeroNota,
          'Data de Emissão': r.data!.dataEmissao,
          'Valor Líquido': r.data!.valorLiquido,
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');
      XLSX.writeFile(workbook, `Extracao_Salva_${item.name.replace(/ /g, '_')}.xlsx`);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a extração "${name}"?`)) {
        setSavedExtractions(prev => prev.filter(item => item.id !== id));
        if (selectedId === id) {
            setSelectedId(null);
        }
    }
  }

  if (savedExtractions.length === 0) {
    return (
        <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-semibold">Nenhuma Extração Salva</h2>
            <p className="mt-2">As extrações que você salvar usando o botão "Salvar Extração" aparecerão aqui.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-1/3 lg:w-1/4">
             <h2 className="text-2xl font-semibold text-blue-300 mb-4">Extrações Salvas</h2>
             <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {savedExtractions.map(item => (
                    <div key={item.id} className="group flex items-center gap-2">
                        <button 
                            onClick={() => setSelectedId(item.id)}
                            className={`flex-grow text-left p-3 rounded-md transition-colors ${selectedId === item.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                        >
                            <p className="font-semibold truncate" title={item.name}>{item.name}</p>
                            <p className="text-xs text-gray-400">{formatDate(item.timestamp)}</p>
                        </button>
                        <button 
                            onClick={() => handleDelete(item.id, item.name)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-md bg-red-800/50 hover:bg-red-700 text-red-300 hover:text-white transition-opacity"
                            aria-label={`Excluir extração ${item.name}`}
                        >
                            <TrashIcon />
                        </button>
                    </div>
                ))}
             </div>
        </aside>
        <main className="flex-grow">
            {selectedItem ? (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-semibold text-blue-300 truncate" title={selectedItem.name}>
                                {selectedItem.name}
                            </h2>
                             <p className="text-sm text-gray-400">Salvo em {formatDate(selectedItem.timestamp)}</p>
                        </div>
                         <div className="flex gap-2">
                            <button onClick={() => handleExportExcel(selectedItem)} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                                <ExcelIcon /> Exportar Excel
                            </button>
                            <div className="flex items-center gap-2" title="O download dos PDFs originais não está disponível para extrações salvas.">
                                <button disabled className="flex items-center gap-2 bg-gray-700 text-sm font-medium py-2 px-3 rounded-lg opacity-50 cursor-not-allowed">
                                    <DownloadIcon /> Baixar PDFs
                                </button>
                                <InformationCircleIcon />
                            </div>
                        </div>
                    </div>
                    <ResultsTable results={selectedItem.results} />
                     <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center gap-4">
                        <span className="text-gray-400 font-semibold">Valor Líquido Total:</span>
                        <span className="text-xl font-bold text-green-400">
                            {selectedItem.totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-lg h-full flex flex-col justify-center">
                    <h2 className="text-2xl font-semibold">Selecione uma extração</h2>
                    <p className="mt-2">Escolha um item da lista à esquerda para ver os detalhes.</p>
                </div>
            )}
        </main>
    </div>
  );
};

export default SavedExtractionsTab;
