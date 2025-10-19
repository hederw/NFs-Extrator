
import React from 'react';
import type { ComparisonResultItem } from '../types';

interface ComparisonResultsProps {
  results: ComparisonResultItem[];
}

const statusStyles = {
    match: 'text-green-400 bg-green-900/30',
    mismatch: 'text-red-400 bg-red-900/30 font-bold',
    missing: 'text-yellow-400 bg-yellow-900/30',
};

const ComparisonResults: React.FC<ComparisonResultsProps> = ({ results }) => {

    const summary = results.reduce((acc, curr) => {
        acc.total++;
        if (curr.comparisonStatus === 'perfect_match') acc.matches++;
        if (curr.comparisonStatus === 'partial_mismatch') acc.mismatches++;
        if (curr.comparisonStatus === 'not_found_in_truth') acc.notFound++;
        return acc;
    }, { total: 0, matches: 0, mismatches: 0, notFound: 0 });

    const formatValue = (value: any) => {
        if (typeof value === 'number') {
            return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return value ?? '-';
    };


  return (
    <div className="mt-6">
        <div className="mb-4 p-4 bg-gray-900 rounded-lg flex justify-around text-center">
            <div>
                <p className="text-2xl font-bold text-green-400">{summary.matches}</p>
                <p className="text-sm text-gray-400">Correspondências</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-red-400">{summary.mismatches}</p>
                <p className="text-sm text-gray-400">Divergências</p>
            </div>
             <div>
                <p className="text-2xl font-bold text-yellow-400">{summary.notFound}</p>
                <p className="text-sm text-gray-400">Não Encontrados</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-blue-400">{summary.total}</p>
                <p className="text-sm text-gray-400">Total</p>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                    <tr>
                        <th scope="col" className="px-4 py-3">Nº da Nota</th>
                        <th scope="col" className="px-4 py-3">Campo</th>
                        <th scope="col" className="px-4 py-3">Valor Extraído (IA)</th>
                        <th scope="col" className="px-4 py-3">Valor Correto (Gabarito)</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                    </tr>
                </thead>
                <tbody>
                {results.map(item => (
                    <React.Fragment key={item.numeroNota}>
                        {item.comparisonStatus === 'not_found_in_truth' ? (
                            <tr className="border-b border-gray-700 bg-yellow-900/30">
                                <td className="px-4 py-3 font-medium">{item.numeroNota}</td>
                                <td colSpan={4} className="px-4 py-3 text-yellow-400">Nota fiscal não encontrada no arquivo de gabarito.</td>
                            </tr>
                        ) : (
                           <>
                             <tr className="border-t border-l border-r border-gray-700">
                                <td rowSpan={4} className="px-4 py-3 font-medium align-top border-r border-gray-700">{item.numeroNota}</td>
                                <td className="px-4 py-3 font-semibold">Prestador</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.prestador.status]}`}>{formatValue(item.fields.prestador.extracted)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.prestador.status]}`}>{formatValue(item.fields.prestador.groundTruth)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.prestador.status]}`}>{item.fields.prestador.status}</td>
                             </tr>
                              <tr className="border-l border-r border-gray-700">
                                <td className="px-4 py-3 font-semibold">Data Emissão</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.dataEmissao.status]}`}>{formatValue(item.fields.dataEmissao.extracted)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.dataEmissao.status]}`}>{formatValue(item.fields.dataEmissao.groundTruth)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.dataEmissao.status]}`}>{item.fields.dataEmissao.status}</td>
                             </tr>
                             <tr className="border-l border-r border-b border-gray-700">
                                <td className="px-4 py-3 font-semibold">Valor Líquido</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.valorLiquido.status]}`}>{formatValue(item.fields.valorLiquido.extracted)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.valorLiquido.status]}`}>{formatValue(item.fields.valorLiquido.groundTruth)}</td>
                                <td className={`px-4 py-3 ${statusStyles[item.fields.valorLiquido.status]}`}>{item.fields.valorLiquido.status}</td>
                             </tr>
                           </>
                        )}
                    </React.Fragment>
                ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default ComparisonResults;
