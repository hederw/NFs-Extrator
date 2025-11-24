

import React, { useState, useEffect } from 'react';
import type { ExtractionResult, DetailedInvoiceData } from '../types';
import Spinner from './Spinner';

interface DetailedResultsTableProps {
  results: ExtractionResult[];
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

const DetailedResultsTable: React.FC<DetailedResultsTableProps> = ({ results }) => {
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const newUrls: Record<string, string> = {};
    results.forEach(result => {
        if ('file' in result && result.file instanceof File) {
             newUrls[result.id] = URL.createObjectURL(result.file);
        }
    });
    setPdfUrls(newUrls);

    return () => {
        Object.values(newUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [results]);
  
  const formatMoney = (val?: number) => {
      if (val === undefined || val === null) return '-';
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>Nenhum resultado para exibir.</p>
        <p className="text-sm">Os resultados detalhados aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th scope="col" className="px-3 py-2 sticky left-0 bg-gray-700 z-10">Arquivo</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Número Nota</th>
            <th scope="col" className="px-3 py-2">Data Emissão</th>
            <th scope="col" className="px-3 py-2">CNPJ Prestador</th>
            <th scope="col" className="px-3 py-2">Razão Prestador</th>
            <th scope="col" className="px-3 py-2">CNPJ Tomador</th>
            <th scope="col" className="px-3 py-2">Razão Tomador</th>
            <th scope="col" className="px-3 py-2">Loc. Prestação</th>
            <th scope="col" className="px-3 py-2">Loc. Incidência</th>
            <th scope="col" className="px-3 py-2">Cód. Serviço</th>
            <th scope="col" className="px-3 py-2 text-right">Valor Total</th>
            <th scope="col" className="px-3 py-2 text-right">Aliq. ISS</th>
            <th scope="col" className="px-3 py-2 text-right">INSS</th>
            <th scope="col" className="px-3 py-2 text-right">ISS Retido</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const data = result.data as DetailedInvoiceData | undefined;
            const displayName = result.pageNumber ? `${result.file.name} (p. ${result.pageNumber})` : result.file.name;

            return (
                <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-3 py-2 font-medium text-white whitespace-nowrap truncate max-w-[150px] sticky left-0 bg-gray-800 z-10">
                    <a
                    href={pdfUrls[result.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                    title={`Visualizar ${displayName}`}
                    >
                    {displayName}
                    </a>
                </td>
                <td className="px-3 py-2"><StatusIndicator status={result.status} /></td>
                
                {result.status === 'success' && data ? (
                    <>
                        <td className="px-3 py-2 truncate font-semibold text-blue-200">{data.numeroNota}</td>
                        <td className="px-3 py-2 truncate">{data.dataEmissao}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]" title={data.cnpjPrestador}>{data.cnpjPrestador}</td>
                        <td className="px-3 py-2 truncate max-w-[150px]" title={data.razaoSocialPrestador}>{data.razaoSocialPrestador}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]" title={data.cnpjTomador}>{data.cnpjTomador}</td>
                        <td className="px-3 py-2 truncate max-w-[150px]" title={data.razaoSocialTomador}>{data.razaoSocialTomador}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]" title={data.localPrestacao}>{data.localPrestacao}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]" title={data.localIncidencia}>{data.localIncidencia}</td>
                        <td className="px-3 py-2 truncate max-w-[100px]">{data.codigoServico}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-400">{formatMoney(data.valorTotalNota)}</td>
                        <td className="px-3 py-2 text-right">{data.aliquotaIssqn}%</td>
                        <td className="px-3 py-2 text-right">{formatMoney(data.inss)}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(data.issRetido)}</td>
                    </>
                ) : (
                    <td colSpan={13} className="px-3 py-2 text-center text-gray-600">
                        {result.status === 'error' ? result.error : '-'}
                    </td>
                )}
                </tr>
            );
        })}
        </tbody>
      </table>
    </div>
  );
};

export default DetailedResultsTable;