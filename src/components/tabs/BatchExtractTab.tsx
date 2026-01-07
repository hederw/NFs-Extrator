
import React, { useState } from 'react';
import FolderUploader from '../FolderUploader';
import ResultsTable from '../ResultsTable';
import { ExcelIcon } from '../icons/ExcelIcon';
import Spinner from '../Spinner';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import type { Layout, ExtractionResult, ValidationResult, GroundTruth } from '../../types';

declare const XLSX: any;

interface BatchExtractTabProps {
    selectedLayout: Layout | undefined;
    onOpenLayoutModal: () => void;
    results: ExtractionResult[];
    setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
    totalLiquidValue: number;
    hasSuccessfulResults: boolean;
    onExtractionComplete: () => void;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    folderName: string;
    setFolderName: React.Dispatch<React.SetStateAction<string>>;
    validationStatus: Record<string, ValidationResult> | null;
    setValidationStatus: React.Dispatch<React.SetStateAction<Record<string, ValidationResult> | null>>;
    contasAPagar: GroundTruth;
    setContasAPagar: React.Dispatch<React.SetStateAction<GroundTruth>>;
    razaoLoja: GroundTruth;
    setRazaoLoja: React.Dispatch<React.SetStateAction<GroundTruth>>;
    onStartExtraction: (extractAll: boolean) => void;
    isProcessingGlobal: boolean;
}

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    selectedLayout,
    onOpenLayoutModal,
    results,
    setResults,
    totalLiquidValue,
    hasSuccessfulResults,
    files,
    setFiles,
    folderName,
    setFolderName,
    onStartExtraction,
    isProcessingGlobal
}) => {
    const [extractAllPages, setExtractAllPages] = useState(false);
    const [dailyCount] = useDailyCounter();

    const handleExportExcel = () => {
        const data = results.map(r => ({
            'Arquivo': r.file.name,
            'Página': r.pageNumber || 1,
            'Status': r.status === 'success' ? 'Sucesso' : 'Falha',
            'Prestador': (r.data as any)?.prestador || '-',
            'Nº Nota': (r.data as any)?.numeroNota || '-',
            'Emissão': (r.data as any)?.dataEmissao || '-',
            'Valor Líquido': (r.data as any)?.valorLiquido || 0,
            'Erro/Motivo': r.error || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        const filename = folderName ? `Extracao_${folderName.replace(/\W/g, '_')}.xlsx` : "Extracao.xlsx";
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="flex justify-between items-center mb-2">
                             <h2 className="text-xl font-bold text-blue-400">1. Ações</h2>
                             <span className="text-xs px-2 py-1 rounded font-bold bg-blue-900 text-blue-300">
                                Hoje: {dailyCount}
                             </span>
                        </div>
                        
                        <button onClick={onOpenLayoutModal} className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors">
                            <p className="text-xs text-gray-400 uppercase font-bold">Layout IA</p>
                            <p className="text-blue-300 font-semibold truncate">{selectedLayout?.name || 'Padrão'}</p>
                        </button>

                        <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={extractAllPages} 
                                    onChange={(e) => setExtractAllPages(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Extrair todas as páginas</span>
                                    <span className="text-[10px] text-gray-500">Se desmarcado, apenas a 1ª página.</span>
                                </div>
                            </label>
                        </div>

                        <button
                            onClick={() => onStartExtraction(extractAllPages)}
                            disabled={isProcessingGlobal || files.length === 0}
                            className={`w-full py-4 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                                isProcessingGlobal ? 'bg-indigo-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700'
                            } text-white font-bold`}
                        >
                            {isProcessingGlobal ? <Spinner /> : 'Iniciar Extração'}
                        </button>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-blue-400">2. Origem dos Arquivos</h2>
                        <FolderUploader 
                            onFilesSelected={(list) => {
                                const pdfs = (Array.from(list) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
                                setFiles(pdfs);
                                if (!isProcessingGlobal) setResults([]);
                            }} 
                            onClear={() => { setFiles([]); setResults([]); }} 
                            onFolderNameDetected={setFolderName} 
                        />
                    </div>
                </div>
            </section>

            {(results.length > 0 || isProcessingGlobal) && (
                <section className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center flex-wrap gap-4 bg-gray-800/50">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-blue-400">3. Resultados</h2>
                            {folderName && <span className="text-xs text-gray-500 font-mono">Pasta: {folderName}</span>}
                        </div>
                        {hasSuccessfulResults && (
                            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 px-5 rounded-lg transition-all shadow-md">
                                <ExcelIcon /> Exportar Excel
                            </button>
                        )}
                    </div>
                    
                    <div className="p-1">
                        <ResultsTable results={results} setResults={setResults} />
                    </div>

                    {hasSuccessfulResults && (
                        <div className="p-6 bg-gray-900/40 border-t border-gray-700 flex justify-end items-center">
                            <div className="flex flex-col items-end">
                                <span className="text-gray-400 font-bold uppercase text-[10px]">Total Líquido Estimado</span>
                                <span className="text-2xl font-bold text-green-400">
                                    {totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default BatchExtractTab;
