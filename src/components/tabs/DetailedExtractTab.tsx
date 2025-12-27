import React, { useState, useCallback } from 'react';
import FolderUploader from '../FolderUploader';
import DetailedResultsTable from '../DetailedResultsTable';
import { ExcelIcon } from '../icons/ExcelIcon';
import { ExclamationIcon } from '../icons/ExclamationIcon';
import Spinner from '../Spinner';
import { extractDetailedInvoiceData } from '../../services/geminiService';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import type { ExtractionResult, DetailedInvoiceData } from '../../types';

declare const pdfjsLib: any;
declare const XLSX: any;

const DetailedExtractTab: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [folderName, setFolderName] = useState('');
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [totalTasks, setTotalTasks] = useState(0);
    const [limitWarning, setLimitWarning] = useState<string | null>(null);
    const [dailyCount, incrementDailyCount, DAILY_LIMIT] = useDailyCounter();

    const extractPossiblePasswords = (filename: string): string[] => {
        const passwords: string[] = [];
        const digits = filename.match(/\d{4,}/g);
        if (digits) passwords.push(...digits);
        
        const parts = filename.split(/[\s_-]+/);
        parts.forEach(p => {
            if (p.length >= 4) passwords.push(p.replace(/\.pdf$/i, ''));
        });

        const explicit = filename.match(/senha[^\s_-]*/i);
        if (explicit) {
            const match = explicit[0].replace(/senha/i, '');
            if (match) passwords.push(match);
        }

        return Array.from(new Set(passwords));
    };

    const convertPdfToImage = async (file: File, pageNum: number): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        let pdf;
        
        try {
            pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        } catch (e: any) {
            if (e.name === 'PasswordException' || e.message?.includes('password') || e.message?.includes('No password given')) {
                const hints = extractPossiblePasswords(file.name);
                let opened = false;
                for (const password of hints) {
                    try {
                        pdf = await pdfjsLib.getDocument({ data: fileBuffer, password }).promise;
                        opened = true;
                        break;
                    } catch {
                        continue;
                    }
                }
                if (!opened) throw e;
            } else {
                throw e;
            }
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (!context) throw new Error('Não foi possível obter o contexto do canvas.');
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    };

    const handleExtract = useCallback(async () => {
        if (files.length === 0) {
            alert('Por favor, selecione arquivos.');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setResults([]);

        const tasks: { file: File; page: number }[] = [];

        for (const file of files) {
            tasks.push({ file, page: 1 });
        }
        
        const remainingLimit = DAILY_LIMIT - dailyCount;
        if (tasks.length > 0 && remainingLimit <= 0) {
            alert(`Você atingiu o limite diário de ${DAILY_LIMIT} extrações.`);
            setIsProcessing(false);
            return;
        }

        const tasksToProcess = tasks.slice(0, remainingLimit);
        const tasksSkipped = tasks.slice(remainingLimit);
        setTotalTasks(tasksToProcess.length);

        if(tasksSkipped.length > 0) {
            setLimitWarning(`Atenção: ${tasksSkipped.length} arquivos serão ignorados por exceder o limite diário.`);
        }

        const resultsToProcess: ExtractionResult[] = tasksToProcess.map(({ file, page }) => ({
            id: `${file.name}-p${page}-${Date.now()}-${Math.random()}`,
            file,
            pageNumber: page,
            status: 'processing',
        }));

        const resultsSkipped: ExtractionResult[] = tasksSkipped.map(({ file, page }) => ({
            id: `${file.name}-p${page}-${Date.now()}-${Math.random()}`,
            file,
            pageNumber: page,
            status: 'error',
            error: 'Limite diário excedido.',
        }));
        
        setResults([...resultsToProcess, ...resultsSkipped]);
        
        let processedInThisBatch = 0;
        for (const result of resultsToProcess) {
            try {
                const base64Image = await convertPdfToImage(result.file, result.pageNumber!);
                const data = await extractDetailedInvoiceData(base64Image);
                incrementDailyCount();
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'success', data } : r));
            } catch (error: any) {
                const err = error as any;
                let errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
                if (err.name === 'PasswordException' || errorMessage.includes('password') || errorMessage.includes('No password given')) {
                    errorMessage = 'Arquivo protegido por senha.';
                }
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'error', error: errorMessage } : r));
            } finally {
                processedInThisBatch++;
                setProgress(processedInThisBatch);
            }
        }
        setIsProcessing(false);
    }, [files, dailyCount, DAILY_LIMIT, incrementDailyCount]);


    const handleFolderSelection = (fileList: FileList) => {
        setResults([]);
        setProgress(0);
        setLimitWarning(null);
        
        const allFiles = Array.from(fileList);
        const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        setFiles(pdfFiles);
    };
    
    const handleClear = () => {
        setFiles([]);
        setResults([]);
        setProgress(0);
        setLimitWarning(null);
        setFolderName('');
    };

    const handleExportExcel = () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        
        const worksheetData = successfulResults.map(r => {
            const d = r.data as DetailedInvoiceData;
            return {
                'Arquivo': r.file.name,
                'Número da Nota': d.numeroNota,
                'Data de Emissão': d.dataEmissao,
                'CNPJ Prestador': d.cnpjPrestador,
                'Razão Social Prestador': d.razaoSocialPrestador,
                'CNPJ Tomador': d.cnpjTomador,
                'Razão Social Tomador': d.razaoSocialTomador,
                'Local Prestação': d.localPrestacao,
                'Local Incidência': d.localIncidencia,
                'Cód. Serviço': d.codigoServico,
                'Valor Total': d.valorTotalNota,
                'Alíquota ISS': d.aliquotaIssqn,
                'INSS': d.inss,
                'ISS Retido': d.issRetido
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalhamento');
        
        const safeFolderName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Lote';
        XLSX.writeFile(workbook, `Extracao_Detalhada_${safeFolderName}.xlsx`);
    };
    
    const isLimitReached = dailyCount >= DAILY_LIMIT;

    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-semibold text-blue-300">1. Configurar</h2>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Limite Diário</p>
                                <p className={`font-bold text-lg ${isLimitReached ? 'text-red-400' : 'text-blue-300'}`}>{dailyCount} / {DAILY_LIMIT}</p>
                            </div>
                        </div>
                         <div className="bg-gray-900/50 p-3 rounded text-sm text-gray-400 border border-gray-700">
                            Esta aba extrai automaticamente: Número, Data, CNPJ e Razão (Prestador/Tomador), Locais, Código Serviço e Impostos.
                            <br/><br/>
                            <span className="text-yellow-400 text-xs">Nota: Processa apenas a 1ª página de cada arquivo.</span>
                         </div>
                        <button
                            onClick={handleExtract}
                            disabled={isProcessing || files.length === 0 || isLimitReached}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> Processando {progress}/{totalTasks}...</> 
                            : isLimitReached ? 'Limite atingido'
                            : 'Extrair Dados Detalhados'}
                        </button>
                    </div>

                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-semibold text-blue-300 mb-4">2. Selecionar Pasta</h2>
                        <FolderUploader onFilesSelected={handleFolderSelection} onClear={handleClear} onFolderNameDetected={setFolderName} />
                         {limitWarning && (
                            <div className="mt-4 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-lg flex items-center gap-2">
                                <ExclamationIcon />
                                <span>{limitWarning}</span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-semibold text-blue-300">3. Resultados Detalhados</h2>
                    {results.some(r => r.status === 'success') && (
                         <button onClick={handleExportExcel} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><ExcelIcon /> Exportar Excel</button>
                    )}
                </div>
                <DetailedResultsTable results={results} />
            </section>
        </div>
    );
};

export default DetailedExtractTab;