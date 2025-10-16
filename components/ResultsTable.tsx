import React from 'react';
import type { ExtractionResult } from '../types';
import Spinner from './Spinner';

interface ResultsTableProps {
  results: ExtractionResult[];
  onFileClick: (file: File) => void;
}

const StatusIndicator: React.FC<{ status: ExtractionResult['status'] }> = ({ status }) => {
    switch (status) {
        case 'pending':
            return <div className="flex items-center gap-2 text-gray-400">Aguardando...</div>;
        case 'processing':
            return <div className="flex items-center gap-2 text-yellow-400"><Spinner /> Processando...</div>;
        case 'success':
            return <div className="flex items-center gap-1 text-green-400">✓ Sucesso</div>;
        case 'error':
            return <div className="flex items-center gap-1 text-red-400">✗ Falha</div>;
        default:
            return null;
    }
};


const ResultsTable: React.FC<ResultsTableProps> = ({ results, onFileClick }) => {
  if (results.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>Nenhum arquivo processado ainda.</p>
        <p className="text-sm">Os resultados aparecerão aqui após a extração.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th scope="col" className="px-4 py-3">Arquivo</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Prestador</th>
            <th scope="col" className="px-4 py-3">Nº da Nota</th>
            <th scope="col" className="px-4 py-3">Data Emissão</th>
            <th scope="col" className="px-4 py-3 text-right">Valor Líquido</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700/50">
              <td className="px-4 py-3 font-medium text-white whitespace-nowrap truncate max-w-xs">
                <button
                  onClick={() => onFileClick(result.file)}
                  className="text-blue-400 hover:underline text-left w-full truncate"
                  title={`Visualizar ${result.file.name}`}
                  aria-label={`Visualizar PDF ${result.file.name}`}
                >
                  {result.file.name}
                </button>
              </td>
              <td className="px-4 py-3"><StatusIndicator status={result.status} /></td>
              <td className="px-4 py-3">{result.data?.prestador || '-'}</td>
              <td className="px-4 py-3">{result.data?.numeroNota || '-'}</td>
              <td className="px-4 py-3">{result.data?.dataEmissao || '-'}</td>
              <td className="px-4 py-3 text-right">
                {result.data?.valorLiquido != null 
                  ? result.data.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;