import React, { useState, useEffect } from 'react';
import type { ExtractionResult, InvoiceData } from '../types';
import Spinner from './Spinner';

interface ResultsTableProps {
  results: ExtractionResult[];
  setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
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


const ResultsTable: React.FC<ResultsTableProps> = ({ results, setResults }) => {
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const newUrls: Record<string, string> = {};
    results.forEach(result => {
        newUrls[result.id] = URL.createObjectURL(result.file);
    });
    setPdfUrls(newUrls);

    // Cleanup function to revoke URLs and prevent memory leaks
    return () => {
        Object.values(newUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [results]);
  
  const handleUpdate = (id: string, field: keyof InvoiceData, value: string) => {
    setResults(currentResults =>
        currentResults.map(r => {
            if (r.id === id && r.data) {
                const newValue = field === 'valorLiquido' ? parseFloat(value) || 0 : value;
                return {
                    ...r,
                    data: {
                        ...r.data,
                        [field]: newValue,
                    },
                };
            }
            return r;
        })
    );
  };


  if (results.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>Nenhum arquivo processado ainda.</p>
        <p className="text-sm">Os resultados aparecerão aqui após a extração.</p>
      </div>
    );
  }
  
  const EditableCell: React.FC<{result: ExtractionResult, field: keyof InvoiceData, type?: 'text' | 'number'}> = ({result, field, type = 'text'}) => {
    if (result.status !== 'success' || !result.data) {
        let displayValue: string | number = '-';
        if (result.data?.[field] != null) {
            if (field === 'valorLiquido') {
                displayValue = (result.data[field] as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                displayValue = result.data[field] as string;
            }
        }
        const className = field === 'valorLiquido' ? 'text-right' : '';
        return <td className={`px-4 py-3 ${className}`}>{displayValue}</td>
    }

    const value = result.data[field];
    
    return (
        <td className="px-2 py-1">
             <input
                type={type}
                step={type === 'number' ? '0.01' : undefined}
                value={value}
                onChange={(e) => handleUpdate(result.id, field, e.target.value)}
                className={`bg-gray-700/50 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-2 transition-shadow ${type === 'number' ? 'text-right' : ''}`}
                aria-label={`Editar ${field} para ${result.file.name}`}
            />
        </td>
    )
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
                <a
                  href={pdfUrls[result.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-left w-full truncate"
                  title={`Visualizar ${result.file.name}`}
                  aria-label={`Visualizar PDF ${result.file.name}`}
                >
                  {result.file.name}
                </a>
              </td>
              <td className="px-4 py-3"><StatusIndicator status={result.status} /></td>
              <EditableCell result={result} field="prestador" />
              <EditableCell result={result} field="numeroNota" />
              <EditableCell result={result} field="dataEmissao" />
              <EditableCell result={result} field="valorLiquido" type="number" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;