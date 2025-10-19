import React, { useState, useCallback } from 'react';
import FolderUploader from '../FolderUploader';
import ResultsTable from '../ResultsTable';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { SaveIcon } from '../icons/SaveIcon';
import { CogIcon } from '../icons/CogIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
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
    onSaveExtraction: (name: string) => void;
}

const initialGroundTruth: GroundTruth = { file: null, data: [], status: 'idle', message: 'Aguardando arquivo...' };

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
    onSaveExtraction
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [validationStatus, setValidationStatus] = useState<Record<string, ValidationResult> | null>(null);
    const [folderName, setFolderName] = useState('');

    const [contasAPagar, setContasAPagar] = useState<GroundTruth>(initialGroundTruth);
    const [razaoLoja, setRazaoLoja] = useState<GroundTruth>(initialGroundTruth);


    const convertPdfToImage = async (file: File): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const page = await pdf.getPage(1);
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
                
                // Find the first non-empty row to use as header
                for (let i = 0; i < rows.length; i++) {
                    const potentialHeaders = rows[i].map((cell: any) => cell ? String(cell).trim() : '');
                    if (potentialHeaders.some(h => h)) { // if the row is not completely empty
                        headerIndex = i;
                        headers = potentialHeaders;
                        break;
                    }
                }
                
                if (headerIndex === -1) {
                    setter({ file, data: [], status: 'error', message: `Erro: Nenhuma linha de cabeçalho encontrada. O arquivo parece estar vazio.`, detectedColumns: [] });
                    return;
                }
    
                const detectedColumns = headers.filter(h => h); // All non-empty cells in the header row
                const dataRows = rows.slice(headerIndex + 1);
    
                const json = dataRows
                    .map(row => {
                        const obj: { [key: string]: any } = {};
                        headers.forEach((header, index) => {
                            if (header) { // Only map columns with a header
                                 obj[header] = row[index];
                            }
                        });
                        return obj;
                    })
                    .filter(obj => Object.values(obj).some(val => val !== null && val !== undefined && String(val).trim() !== ''));
                
                if (json.length === 0) {
                     setter({ file, data: [], status: 'error', message: `Aviso: Nenhuma linha de dados encontrada após o cabeçalho.`, detectedColumns });
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
            const extractedPrestador = result.data!.prestador.toLowerCase().trim();
            const extractedValor = result.data!.valorLiquido;

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
        const initialResults: ExtractionResult[] = files.map(file => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, status: 'processing' }));
        setResults(initialResults);

        for (const result of initialResults) {
            try {
                const base64Image = await convertPdfToImage(result.file);
                const data = await extractInvoiceDataFromImage(base64Image, selectedLayout.prompt);
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'success', data } : r));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
                setResults(current => current.map(r => r.id === result.id ? { ...r, status: 'error', error: errorMessage } : r));
            } finally {
                setProgress(p => p + 1);
            }
        }
        setIsProcessing(false);
    }, [files, selectedLayout, setResults]);

    const handleClear = () => {
        setFiles([]);
        setResults([]);
        setProgress(0);
        setValidationStatus(null);
        setContasAPagar(initialGroundTruth);
        setRazaoLoja(initialGroundTruth);
        setFolderName('');
    };

    const handleFolderSelection = (fileList: FileList) => {
        handleClear();
        const allFiles = Array.from(fileList);
        
        const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        setFiles(pdfFiles);
        
        const contasFile = allFiles.find(f => f.name.toLowerCase().startsWith('contas a pagar'));
        if(contasFile) {
            parseGroundTruthFile(contasFile, { prestador: 'Razão Social', valor: 'Valor Pagto R$' }, setContasAPagar);
        } else {
            setContasAPagar({ ...initialGroundTruth, message: 'Arquivo não encontrado na pasta.' });
        }

        const razaoFile = allFiles.find(f => f.name.toLowerCase().startsWith('razao loja'));
        if(razaoFile) {
            parseGroundTruthFile(razaoFile, { prestador: 'Histórico', valor: 'Débito' }, setRazaoLoja);
        } else {
            setRazaoLoja({ ...initialGroundTruth, message: 'Arquivo não encontrado na pasta.' });
        }
    };


    const handleExportExcel = () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        const worksheetData = successfulResults.map(r => ({
            'Nome do Arquivo': r.file.name,
            'Prestador': r.data!.prestador,
            'Número da Nota': r.data!.numeroNota,
            'Data de Emissão': r.data!.dataEmissao,
            'Valor Líquido': r.data!.valorLiquido,
            'Status Validação': validationStatus?.[r.id]?.status || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');
        
        const safeFolderName = folderName.trim().replace(/[^a-zA-Z0-9_.-]/g, '_') || 'Lote';
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
        for (const result of successfulResults) {
            const newFileName = `NF ${result.data!.numeroNota} OK.pdf`;
            zip.file(newFileName, result.file);
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

    const handleSave = () => {
        const name = window.prompt("Digite um nome para salvar esta extração:");
        if (name) {
            onSaveExtraction(name);
        }
    };
    
    const selectedLayoutName = selectedLayout?.name || "Nenhum layout";
    const canValidate = hasSuccessfulResults && (contasAPagar.data.length > 0 || razaoLoja.data.length > 0);

    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <h2 className="text-2xl font-semibold text-blue-300">1. Configurar</h2>
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
                            disabled={isProcessing || files.length === 0 || !selectedLayout}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> Processando {progress}/{files.length}...</> : 'Iniciar Extração'}
                        </button>
                    </div>

                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-semibold text-blue-300 mb-4">2. Selecionar Pasta</h2>
                        <FolderUploader onFilesSelected={handleFolderSelection} onClear={handleClear} onFolderNameDetected={setFolderName} />
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
                             <button onClick={handleSave} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><SaveIcon /> Salvar Extração</button>
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