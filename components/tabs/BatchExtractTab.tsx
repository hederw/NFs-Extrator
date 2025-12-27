import React, { useState, useCallback, useEffect, useRef } from 'react';
import FolderUploader from '../FolderUploader';
import ResultsTable from '../ResultsTable';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { CogIcon } from '../icons/CogIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ExclamationIcon } from '../icons/ExclamationIcon';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import type { Layout, ExtractionResult, InvoiceData, ValidationResult, GroundTruth } from '../../types';

declare const pdfjsLib: any;
declare const XLSX: any;
declare const JSZip: any;

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
}

const GroundTruthStatus: React.FC<{ truth: GroundTruth, name: string }> = ({ truth, name }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-300 truncate" title={`Gabarito "${name}"`}>Gabarito "{name}"</p>
                    {truth.status === 'idle' && <p className="text-gray-500 text-sm truncate">{truth.message}</p>}
                    {truth.status === 'success' && <p className="text-green-400 text-sm truncate" title={truth.message}>{truth.message}</p>}
                    {truth.status === 'error' && <p className="text-red-400 text-sm truncate" title={truth.message}>{truth.message}</p>}
                </div>
                {truth.detectedColumns && truth.detectedColumns.length > 0 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                        aria-label="Mostrar/ocultar colunas detectadas"
                        aria-expanded={isExpanded}
                    >
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            {isExpanded && truth.detectedColumns && truth.detectedColumns.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 animate-fade-in">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Colunas Detectadas:</p>
                    <div className="flex flex-wrap gap-1">
                        {truth.detectedColumns.map((col, index) => (
                            <span key={index} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">{col}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    selectedLayout,
    onOpenLayoutModal,
    results,
    setResults,
    totalLiquidValue,
    hasSuccessfulResults,
    onExtractionComplete,
    files,
    setFiles,
    folderName,
    setFolderName,
    validationStatus,
    setValidationStatus,
    contasAPagar,
    setContasAPagar,
    razaoLoja,
    setRazaoLoja
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [limitWarning, setLimitWarning] = useState<string | null>(null);
    const [dailyCount, incrementDailyCount, DAILY_LIMIT] = useDailyCounter();
    const [totalTasks, setTotalTasks] = useState(0);

    const wasProcessing = useRef(false);

    useEffect(() => {
        if (isProcessing) {
            wasProcessing.current = true;
        } else if (wasProcessing.current) {
            // We just finished processing
            wasProcessing.current = false;
            if (hasSuccessfulResults) {
                onExtractionComplete();
            }
        }
    }, [isProcessing, hasSuccessfulResults, onExtractionComplete]);

    const extractPossiblePasswords = (filename: string): string[] => {
        const passwords: string[] = [];
        // Pattern 1: Any sequence of digits (many passwords are just numbers)
        const digits = filename.match(/\d{4,}/g);
        if (digits) passwords.push(...digits);
        
        // Pattern 2: Text after common separators like _ or - or space
        const parts = filename.split(/[\s_-]+/);
        parts.forEach(p => {
            if (p.length >= 4) passwords.push(p.replace(/\.pdf$/i, ''));
        });

        // Pattern 3: Explicit "SenhaXXXX"
        const explicit = filename.match(/senha[^\s_-]*/i);
        if (explicit) passwords.push(explicit[0].replace(/senha/i, ''));

        return Array.from(new Set(passwords)); // Unique values
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

        if (pageNum < 1 || pageNum > pdf.numPages) {
            throw new Error(`A página ${pageNum} não existe. O PDF tem ${pdf.numPages} páginas.`);
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
    
    const parseGroundTruthFile = (
        file: File,
        mappings: { prestador: string, valor: string },
        setter: React.Dispatch<React.SetStateAction<GroundTruth>>
    ) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
    
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
                
                let headerIndex = -1;
                let headers: string[] = [];
                
                for (let i = 0; i < rows.length; i++) {
                    const potentialHeaders = rows[i].map((cell: any) => cell ? String(cell).trim() : '');
                    if (potentialHeaders.some(h => h)) {
                        headerIndex = i;
                        headers = potentialHeaders;
                        break;
                    }
                }
                
                if (headerIndex === -1) {
                    setter({ file, data: [], status: 'error', message: `Erro: Nenhuma linha de cabeçalho encontrada.`, detectedColumns: [] });
                    return;
                }
    
                const detectedColumns = headers.filter(h => h);
                const dataRows = rows.slice(headerIndex + 1);
    
                const json = dataRows
                    .map(row => {
                        const obj: { [key: string]: any } = {};
                        headers.forEach((header, index) => {
                            if (header) {
                                 obj[header] = row[index];
                            }
                        });
                        return obj;
                    })
                    .filter(obj => Object.values(obj).some(val => val !== null && val !== undefined && String(val).trim() !== ''));
                
                if (json.length === 0) {
                     setter({ file, data: [], status: 'error', message: `Aviso: Nenhuma linha de dados encontrada.`, detectedColumns });
                     return;
                }
    
                if (!headers.includes(mappings.prestador) || !headers.includes(mappings.valor)) {
                    setter({ file, data: [], status: 'error', message: `Erro: Colunas "${mappings.prestador}" e/ou "${mappings.valor}" não encontradas.`, detectedColumns });
                    return;
                }
                
                const formattedData = json.map(row => {
                    const prestadorValue = row[mappings.prestador] ? String(row[mappings.prestador]).trim() : '';
                    const valorValue = row[mappings.valor];
                    
                    let valorLiquido: number | null = null;
                    if (valorValue !== undefined && valorValue !== null) {
                        const valueStr = String(valorValue).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
                        const parsedFloat = parseFloat(valueStr);
                        if (!isNaN(parsedFloat)) valorLiquido = parsedFloat;
                    }
    
                    return { prestador: prestadorValue, valorLiquido, numeroNota: '', dataEmissao: '' };
                }).filter(item => item.prestador && item.valorLiquido !== null) as InvoiceData[];
                
                setter({ file, data: formattedData, status: 'success', message: `✓ ${file.name} (${formattedData.length} registros válidos)`, detectedColumns });
            } catch (error) {
                console.error("Erro ao processar o arquivo de gabarito:", file.name, error);
                setter({ file, data: [], status: 'error', message: `Erro ao ler "${file.name}". Verifique o formato.`, detectedColumns: [] });
            }
        };
        reader.onerror = () => {
             setter({ file: null, data: [], status: 'error', message: `Não foi possível ler o arquivo ${file.name}.`, detectedColumns: [] });
        }
        reader.readAsArrayBuffer(file);
    };

    const handleValidateResults = () => {
        const newValidationStatus: Record<string, ValidationResult> = {};
        const successfulResults = results.filter(r => r.status === 'success' && r.data);

        for (const result of successfulResults) {
            const data = result.data as InvoiceData;
            const extractedPrestador = data.prestador.toLowerCase().trim();
            const extractedValor = data.valorLiquido;

            const foundContas = contasAPagar.data.find(gt => {
                const gtPrestador = gt.prestador.toLowerCase().trim();
                return gtPrestador.includes(extractedPrestador) || extractedPrestador.includes(gtPrestador);
            });

            if (foundContas) {
                if (Math.abs(foundContas.valorLiquido - extractedValor) < 0.01) {
                    newValidationStatus[result.id] = { status: 'OK', source: 'Contas a Pagar' };
                } else {
                    newValidationStatus[result.id] = { status: 'Divergente', source: 'Contas a Pagar', expectedValue: foundContas.valorLiquido };
                }
                continue;
            }

            const foundRazao = razaoLoja.data.find(gt => {
                 const gtPrestador = gt.prestador.toLowerCase().trim();
                 return gtPrestador.includes(extractedPrestador) || extractedPrestador.includes(gtPrestador);
            });
            
            if (foundRazao) {
                if (Math.abs(foundRazao.valorLiquido - extractedValor) < 0.01) {
                    newValidationStatus[result.id] = { status: 'OK', source: 'Razão Loja' };
                } else {
                    newValidationStatus[result.id] = { status: 'Divergente', source: 'Razão Loja', expectedValue: foundRazao.valorLiquido };
                }
                continue;
            }
            
            newValidationStatus[result.id] = { status: 'Não Encontrado', source: 'Nenhum' };
        }

        setValidationStatus(newValidationStatus);
        alert('Validação concluída! Verifique a nova coluna na tabela de resultados.');
    };

    const handleExtract = useCallback(async () => {
        if (files.length === 0 || !selectedLayout) {
            alert('Por favor, selecione uma pasta com arquivos e um layout.');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setValidationStatus(null);
        setResults([]); // Limpa resultados anteriores

        const tasks: { file: File; page: number }[] = [];
        const initialResults: ExtractionResult[] = [];

        for (const file of files) {
            tasks.push({ file, page: 1 }); // Assume only page 1 for now to match prompt requirements elsewhere or logic flow
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
            error: 'Limite diário de extrações excedido.',
        }));
        
        setResults([...resultsToProcess, ...resultsSkipped]);
        
        let processedInThisBatch = 0;
        for (const result of resultsToProcess) {
            try {
                const base64Image = await convertPdfToImage(result.file, result.pageNumber!);
                const data = await extractInvoiceDataFromImage(base64Image, selectedLayout.prompt);
                incrementDailyCount();
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'success', data } : r));
            } catch (error: any) {
                let errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
                if (error.name === 'PasswordException' || errorMessage.includes('password') || errorMessage.includes('No password given')) {
                    errorMessage = 'Arquivo protegido por senha.';
                }
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'error', error: errorMessage } : r));
            } finally {
                processedInThisBatch++;
                setProgress(processedInThisBatch);
            }
        }
        setIsProcessing(false);
    }, [files, selectedLayout, setResults, dailyCount, DAILY_LIMIT, incrementDailyCount]);


    const handleClear = () => {
        const initialGroundTruth: GroundTruth = { file: null, data: [], status: 'idle', message: 'Aguardando arquivo...' };
        setFiles([]);
        setResults([]);
        setProgress(0);
        setValidationStatus(null);
        setContasAPagar(initialGroundTruth);
        setRazaoLoja(initialGroundTruth);
        setFolderName('');
        setLimitWarning(null);
        setTotalTasks(0);
    };

    const handleFolderSelection = (fileList: FileList) => {
        handleClear();
        const allFiles = Array.from(fileList);
        
        const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        setFiles(pdfFiles);
        setLimitWarning(null);

        const contasFile = allFiles.find(f => f.name.toLowerCase().startsWith('contas a pagar'));
        if(contasFile) {
            parseGroundTruthFile(contasFile, { prestador: 'Razão Social', valor: 'Valor Pagto R$' }, setContasAPagar);
        } else {
            setContasAPagar({ file: null, data: [], status: 'idle', message: 'Arquivo não encontrado na pasta.' });
        }

        const razaoFile = allFiles.find(f => f.name.toLowerCase().startsWith('razao loja'));
        if(razaoFile) {
            parseGroundTruthFile(razaoFile, { prestador: 'Histórico', valor: 'Débito' }, setRazaoLoja);
        } else {
            setRazaoLoja({ file: null, data: [], status: 'idle', message: 'Arquivo não encontrado na pasta.' });
        }
    };
    
    const sanitizeFolderName = (name: string): string => {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_.-]/g, '_')
            .replace(/__+/g, '_');
    };

    const handleExportExcel = () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        const worksheetData = successfulResults.map(r => {
            const data = r.data as InvoiceData;
            return {
                'Nome do Arquivo': `${r.file.name}${r.pageNumber ? ` (pág. ${r.pageNumber})` : ''}`,
                'Prestador': data.prestador,
                'Número da Nota': data.numeroNota,
                'Data de Emissão': data.dataEmissao,
                'Valor Líquido': data.valorLiquido,
                'Status Validação': validationStatus?.[r.id]?.status || 'N/A',
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');
        
        const safeFolderName = sanitizeFolderName(folderName.trim()) || 'Lote';
        const fileName = `Extracao_${safeFolderName}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleDownloadRenamed = async () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há arquivos para baixar.');
            return;
        }
        const zip = new JSZip();

        // Group results by original file to avoid duplicates in the zip
        const resultsByFile = new Map<string, { file: File, results: ExtractionResult[] }>();
        for (const result of successfulResults) {
            if (!resultsByFile.has(result.file.name)) {
                resultsByFile.set(result.file.name, { file: result.file, results: [] });
            }
            resultsByFile.get(result.file.name)!.results.push(result);
        }

        // Process each original file once
        for (const { file, results: fileResults } of resultsByFile.values()) {
            // Sort results by page number to have a consistent file name
            fileResults.sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));

            const invoiceNumbers = fileResults.map(r => (r.data as InvoiceData).numeroNota).join('_');

            // Sanitize invoice numbers part for file name
            const safeInvoiceNumbers = invoiceNumbers.replace(/[^a-zA-Z0-9_-]/g, '');

            const newFileName = `NF_${safeInvoiceNumbers}_OK.pdf`;
            zip.file(newFileName, file);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'PDFs_Renomeados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };
    
    const selectedLayoutName = selectedLayout?.name || "Nenhum layout";
    const canValidate = hasSuccessfulResults && (contasAPagar.data.length > 0 || razaoLoja.data.length > 0);
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
                         <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-400">Layout Ativo</label>
                             <button
                                onClick={onOpenLayoutModal}
                                className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-semibold transition-colors text-left"
                            >
                                <CogIcon />
                                <span className="truncate flex-grow" title={selectedLayoutName}>
                                    <span className="font-bold text-blue-300">{selectedLayoutName}</span>
                                </span>
                            </button>
                        </div>
                        <button
                            onClick={handleExtract}
                            disabled={isProcessing || files.length === 0 || !selectedLayout || isLimitReached}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> Processando {progress}/{totalTasks}...</> 
                            : isLimitReached ? 'Limite diário atingido'
                            : 'Iniciar Extração'}
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
                         <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <GroundTruthStatus truth={contasAPagar} name="Contas a Pagar" />
                            <GroundTruthStatus truth={razaoLoja} name="Razao Loja" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-semibold text-blue-300">3. Resultados da Extração</h2>
                    {hasSuccessfulResults && (
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={handleValidateResults} disabled={!canValidate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-sm font-medium py-2 px-3 rounded-lg transition-colors">Validar com Planilhas</button>
                             <button onClick={handleExportExcel} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><ExcelIcon /> Exportar Excel</button>
                             <button onClick={handleDownloadRenamed} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><DownloadIcon /> Baixar PDFs</button>
                        </div>
                    )}
                </div>
                <ResultsTable results={results} setResults={setResults} validationStatus={validationStatus ?? undefined} />
                {hasSuccessfulResults && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center gap-4">
                        <span className="text-gray-400 font-semibold">Valor Líquido Total:</span>
                        <span className="text-xl font-bold text-green-400">{totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                )}
            </section>
        </div>
    );
};

export default BatchExtractTab;