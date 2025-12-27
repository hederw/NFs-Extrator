import React, { useState, useEffect } from 'react';
import type { ExtractionResult, InvoiceData, StoredExtractionResult, ValidationResult } from '../types';
import Spinner from './Spinner';

interface ResultsTableProps {
  results: (ExtractionResult | StoredExtractionResult)[];
  setResults?: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
  validationStatus?: Record<string, ValidationResult>;
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

const ValidationBadge: React.FC<{ validation?: ValidationResult }> = ({ validation }) => {
    if (!validation) return <span className="text-gray-500">-</span>;

    const { status, source, expectedValue } = validation;
    let bgColor, textColor, text, title;

    switch (status) {
        case 'OK':
            bgColor = 'bg-green-800/50';
            textColor = 'text-green-300';
            text = '✓ OK';
            title = `Encontrado em: ${source}`;
            break;
        case 'Divergente':
            bgColor = 'bg-orange-800/50';
            textColor = 'text-orange-300';
            text = '⚠ Divergente';
            title = `Encontrado em: ${source}, Valor esperado: ${expectedValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
            break;
        case 'Não Encontrado':
            bgColor = 'bg-red-800/50';
            textColor = 'text-red-300';
            text = '✗ Não Encontrado';
            title = 'Não encontrado em nenhum gabarito';
            break;
    }

    return (
        <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${bgColor} ${textColor}`}
            title={title}
        >
            {text}
        </span>
    );
};

const ResultsTable: React.FC<ResultsTableProps> = ({ results, setResults, validationStatus }) => {
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const newUrls: Record<string, string> = {};
    results.forEach(result => {
        if ('file' in result && result.file instanceof File) {
             newUrls[result.id] = URL.createObjectURL(result.file);
        }
    });
    setPdfUrls(newUrls);

    // Cleanup function to revoke URLs and prevent memory leaks
    return () => {
        Object.values(newUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [results]);
  
  const handleUpdate = (id: string, field: keyof InvoiceData, value: string) => {
    if(!setResults) return;

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
        <p>Nenhum resultado para exibir.</p>
        <p className="text-sm">Os resultados aparecerão aqui.</p>
      </div>
    );
  }
  
  const EditableCell: React.FC<{result: ExtractionResult | StoredExtractionResult, field: keyof InvoiceData, type?: 'text' | 'number'}> = ({result, field, type = 'text'}) => {
    const isEditable = !!setResults;
    // Fix TS7053 by casting data to any for dynamic indexing
    const data = result.data as any;
    const value = data?.[field];

    const displayValue = () => {
        if (value == null || value === "") return '-';
        if (field === 'valorLiquido') {
            return (value as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return value as string;
    }
    
    if (!isEditable || result.status !== 'success' || !result.data) {
        const className = field === 'valorLiquido' ? 'text-right' : '';
        return <td className={`px-4 py-3 ${className}`}>{displayValue()}</td>
    }
    
    return (
        <td className="px-2 py-1">
             <input
                type={type}
                step={type === 'number' ? '0.01' : undefined}
                value={value ?? ''}
                onChange={(e) => handleUpdate(result.id, field, e.target.value)}
                className={`bg-gray-700/50 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-2 transition-shadow ${type === 'number' ? 'text-right' : ''}`}
                aria-label={`Editar ${field}`}
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
            <th scope="col" className="px-4 py-3">Validação</th>
            <th scope="col" className="px-4 py-3">Prestador</th>
            <th scope="col" className="px-4 py-3">Nº da Nota</th>
            <th scope="col" className="px-4 py-3">Data Emissão</th>
            <th scope="col" className="px-4 py-3 text-right">Valor Líquido</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const isStored = !('file' in result);
            const fileName = isStored ? result.fileName : result.file.name;
            const displayName = result.pageNumber ? `${fileName} (pág. ${result.pageNumber})` : fileName;
            const validation = validationStatus?.[result.id];

            return (
                <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3 font-medium text-white whitespace-nowrap truncate max-w-xs">
                    {isStored ? (
                        <span title={displayName}>{displayName}</span>
                    ) : (
                        <a
                        href={pdfUrls[result.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-left w-full truncate"
                        title={`Visualizar ${displayName}`}
                        aria-label={`Visualizar PDF ${displayName}`}
                        >
                        {displayName}
                        </a>
                    )}
                </td>
                <td className="px-4 py-3"><StatusIndicator status={result.status} /></td>
                <td className="px-4 py-3"><ValidationBadge validation={validation} /></td>
                <EditableCell result={result} field="prestador" />
                <EditableCell result={result} field="numeroNota" />
                <EditableCell result={result} field="dataEmissao" />
                <EditableCell result={result} field="valorLiquido" type="number" />
                </tr>
            );
        })}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;