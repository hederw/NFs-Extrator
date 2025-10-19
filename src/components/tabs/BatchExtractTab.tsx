import React, { useState, useCallback } from 'react';
import FileUploader from '../FileUploader';
import ResultsTable from '../ResultsTable';
import ComparisonResults from '../ComparisonResults';
import { FileIcon } from '../icons/FileIcon';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { SaveIcon } from '../icons/SaveIcon';
import { CogIcon } from '../icons/CogIcon';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
import type { Layout, ExtractionResult, InvoiceData, ComparisonResultItem, ComparisonHistoryItem } from '../../types';

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
    onSaveToHistory: (comparison: Omit<ComparisonHistoryItem, 'id' | 'timestamp'>) => void;
    onSaveExtraction: (name: string) => void;
}

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    selectedLayout,
    onOpenLayoutModal,
    results,
    setResults,
    totalLiquidValue,
    hasSuccessfulResults,
    onSaveToHistory,
    onSaveExtraction
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [groundTruthData, setGroundTruthData] = useState<InvoiceData[]>([]);
    const [comparisonResults, setComparisonResults] = useState<ComparisonResultItem[] | null>(null);

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
    
    const handleGroundTruthUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet) as any[];

            const formattedData = json.map(row => ({
                prestador: row['Remetente'] || row['prestador'] || '',
                numeroNota: String(row['Nº Documento'] || row['numeroNota'] || ''),
                dataEmissao: row['Dt. Programação'] || row['dataEmissao'] || '',
                valorLiquido: parseFloat(row['Valor Bruto'] || row['valorLiquido'] || 0),
            }));
            setGroundTruthData(formattedData);
            setComparisonResults(null);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleCompareResults = () => {
        const extractedSuccess = results.filter(r => r.status === 'success' && r.data);
        const compared: ComparisonResultItem[] = extractedSuccess.map(res => {
            const extracted = res.data!;
            const truth = groundTruthData.find(t => t.numeroNota === extracted.numeroNota);

            if (!truth) {
                return { numeroNota: extracted.numeroNota, comparisonStatus: 'not_found_in_truth', fields: {} as any };
            }

            const fields = {
                prestador: { status: extracted.prestador === truth.prestador ? 'match' : 'mismatch', extracted: extracted.prestador, groundTruth: truth.prestador },
                dataEmissao: { status: extracted.dataEmissao === truth.dataEmissao ? 'match' : 'mismatch', extracted: extracted.dataEmissao, groundTruth: truth.dataEmissao },
                valorLiquido: { status: extracted.valorLiquido === truth.valorLiquido ? 'match' : 'mismatch', extracted: extracted.valorLiquido, groundTruth: truth.valorLiquido },
            };
            const isMismatch = Object.values(fields).some(f => f.status === 'mismatch');
            return { numeroNota: extracted.numeroNota, comparisonStatus: isMismatch ? 'partial_mismatch' : 'perfect_match', fields };
        });
        setComparisonResults(compared);
    };
    
    const handleSaveHistory = () => {
        if (!comparisonResults) return;
        const summary = comparisonResults.reduce((acc, curr) => {
            acc.total++;
            if(curr.comparisonStatus === 'perfect_match') acc.matches++;
            if(curr.comparisonStatus === 'partial_mismatch') acc.mismatches++;
            return acc;
        }, { total: 0, matches: 0, mismatches: 0 });
        onSaveToHistory({ results: comparisonResults, summary });
        setComparisonResults(null);
        setGroundTruthData([]);
    };

    const handleExtract = useCallback(async () => {
        if (files.length === 0 || !selectedLayout) {
            alert('Por favor, selecione arquivos e um layout.');
            return;
        }
        setIsProcessing(true);
        setProgress(0);
        setComparisonResults(null);
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

    const handleFilesSelected = (selectedFiles: FileList) => {
        const newFiles = Array.from(selectedFiles);
        setFiles(prevFiles => {
            const updatedFiles = [...prevFiles];
            newFiles.forEach(newFile => {
                const isDuplicate = updatedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size && existingFile.lastModified === newFile.lastModified);
                if (!isDuplicate) updatedFiles.push(newFile);
            });
            return updatedFiles;
        });
        setResults([]);
        setProgress(0);
        setComparisonResults(null);
    };

    const handleClearFiles = () => {
        setFiles([]);
        setResults([]);
        setProgress(0);
        setComparisonResults(null);
        setGroundTruthData([]);
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
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');
        XLSX.writeFile(workbook, 'Extracao_Notas_Fiscais.xlsx');
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
    
    const selectedLayoutName = selectedLayout?.name || "Nenhum layout selecionado";

    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <h2 className="text-2xl font-semibold mb-4 text-blue-300">1. Configuração e Upload</h2>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Coluna da Esquerda: Configuração e Ação */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-400">Layout Ativo</label>
                             <button
                                onClick={onOpenLayoutModal}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-semibold transition-colors text-left"
                            >
                                <CogIcon />
                                <span className="truncate flex-grow"><span className="font-bold text-blue-300">{selectedLayoutName}</span></span>
                            </button>
                        </div>
                        <FileUploader onFilesSelected={handleFilesSelected} fileCount={files.length} compact />
                        <button
                            onClick={handleExtract}
                            disabled={isProcessing || files.length === 0 || !selectedLayout}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-all text-base flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> Processando {progress}/{files.length}...</> : 'Iniciar Extração'}
                        </button>
                    </div>
                    {/* Coluna da Direita: Lista de Arquivos */}
                    <div className="w-full md:w-2/3">
                        {files.length > 0 ? (
                             <div className="w-full text-sm text-gray-300">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold">{files.length} arquivo(s) para extração</h4>
                                     <button onClick={handleClearFiles} className="text-xs text-red-400 hover:text-white hover:bg-red-500 font-semibold py-1 px-2 rounded-md transition-colors">Limpar Tudo</button>
                                </div>
                                <div className="max-h-56 overflow-y-auto bg-gray-900/60 p-3 rounded-md space-y-2 border border-gray-700">
                                  {files.map((file, index) => (
                                    <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 bg-gray-800/50 p-2 rounded">
                                        <FileIcon />
                                        <span className="truncate flex-grow" title={file.name}>{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                            </div>
                        ) : <div className="flex items-center justify-center h-full bg-gray-900/30 rounded-lg border border-gray-700 p-10"><p className="text-gray-500 text-center">Aguardando arquivos...<br/>Selecione um layout e envie os PDFs para começar.</p></div>}
                    </div>
                </div>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-semibold text-blue-300">2. Resultados da Extração</h2>
                    {hasSuccessfulResults && (
                        <div className="flex gap-2 flex-wrap">
                             <button onClick={handleSave} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><SaveIcon /> Salvar Extração</button>
                             <button onClick={handleExportExcel} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><ExcelIcon /> Exportar Excel</button>
                             <button onClick={handleDownloadRenamed} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors"><DownloadIcon /> Baixar PDFs</button>
                        </div>
                    )}
                </div>
                <ResultsTable results={results} setResults={setResults} />
                {hasSuccessfulResults && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center gap-4">
                        <span className="text-gray-400 font-semibold">Valor Líquido Total:</span>
                        <span className="text-xl font-bold text-green-400">{totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                )}
            </section>
            
            {hasSuccessfulResults && (
                <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold text-blue-300 mb-2">3. Comparar com Gabarito (Opcional)</h2>
                    <p className="text-gray-400 mb-4 text-sm">Faça upload de um arquivo .xls ou .xlsx com os dados corretos para validar a extração da IA. As colunas esperadas são 'Nº Documento', 'Remetente', 'Dt. Programação' e 'Valor Bruto'.</p>
                    <div className="flex items-center gap-4">
                        <input type="file" id="groundtruth-upload" className="hidden" accept=".xlsx, .xls" onChange={(e) => e.target.files && handleGroundTruthUpload(e.target.files[0])} />
                        <label htmlFor="groundtruth-upload" className="flex-grow cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-center">
                            {groundTruthData.length > 0 ? `Gabarito Carregado (${groundTruthData.length} linhas)` : 'Selecionar Arquivo de Gabarito (.xls)'}
                        </label>
                        <button onClick={handleCompareResults} disabled={groundTruthData.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Comparar</button>
                    </div>

                    {comparisonResults && (
                        <div className="mt-6">
                             <ComparisonResults results={comparisonResults} />
                             <button onClick={handleSaveHistory} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">Salvar no Histórico</button>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default BatchExtractTab;