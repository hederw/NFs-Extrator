import React, { useState, useCallback } from 'react';
import FileUploader from '../FileUploader';
import ResultsTable from '../ResultsTable';
import { FileIcon } from '../icons/FileIcon';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
import type { Layout, ExtractionResult } from '../../types';

// Declare pdfjsLib, XLSX, and JSZip from global scope (CDN)
declare const pdfjsLib: any;
declare const XLSX: any;
declare const JSZip: any;

interface BatchExtractTabProps {
    selectedLayout: Layout | undefined;
    results: ExtractionResult[];
    setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
    totalLiquidValue: number;
    hasSuccessfulResults: boolean;
}

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    selectedLayout,
    results,
    setResults,
    totalLiquidValue,
    hasSuccessfulResults
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const convertPdfToImage = async (file: File): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error('Não foi possível obter o contexto do canvas.');
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    };

    const handleExtract = useCallback(async () => {
        if (files.length === 0 || !selectedLayout) {
            alert('Por favor, selecione arquivos e um layout na aba "Criar e Gerenciar Layouts".');
            return;
        }

        setIsProcessing(true);
        setProgress(0);

        const initialResults: ExtractionResult[] = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            status: 'processing',
        }));
        setResults(initialResults);

        const processFileAndUpdateState = async (result: ExtractionResult) => {
            try {
                const base64Image = await convertPdfToImage(result.file);
                const data = await extractInvoiceDataFromImage(base64Image, selectedLayout.prompt);
                setResults(current => current.map(r => 
                    r.id === result.id ? { ...r, status: 'success', data } : r
                ));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
                setResults(current => current.map(r => 
                    r.id === result.id ? { ...r, status: 'error', error: errorMessage } : r
                ));
            } finally {
                setProgress(p => p + 1);
            }
        };
        
        // Process files sequentially to avoid rate limiting issues
        for (const result of initialResults) {
            await processFileAndUpdateState(result);
        }

        setIsProcessing(false);
    }, [files, selectedLayout, setResults]);

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
    };

     const handleFilesSelected = (selectedFiles: FileList) => {
        setFiles(Array.from(selectedFiles));
        setResults([]);
        setProgress(0);
    };

    // FIX: Correct arrow function syntax from `()_=>` to `() =>`.
    const handleClearFiles = () => {
        setFiles([]);
        setResults([]);
        setProgress(0);
    };


    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <h2 className="text-2xl font-semibold mb-4 text-blue-300">1. Upload de Arquivos e Extração</h2>
                 <div className="flex flex-col md:flex-row gap-4 items-start">
                    {/* Coluna Esquerda: Uploader e Botão */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                       <FileUploader onFilesSelected={handleFilesSelected} fileCount={files.length} compact />
                       <button
                            onClick={handleExtract}
                            disabled={isProcessing || files.length === 0 || !selectedLayout}
                            className="w-auto self-start bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-all text-base flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> Processando {progress}/{files.length}...</> : 'Iniciar Extração'}
                        </button>
                    </div>

                    {/* Coluna Direita: Lista de Arquivos */}
                    <div className="w-full md:w-2/3">
                        {files.length > 0 ? (
                             <div className="w-full text-sm text-gray-300">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold">{files.length} arquivo(s) selecionado(s)</h4>
                                     <button
                                        onClick={handleClearFiles}
                                        className="text-xs text-red-400 hover:text-white hover:bg-red-500 font-semibold py-1 px-2 rounded-md transition-colors flex items-center"
                                        aria-label="Limpar arquivos selecionados"
                                    >
                                        Limpar
                                    </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto bg-gray-900/60 p-3 rounded-md space-y-2 border border-gray-700">
                                  {files.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-gray-800/50 p-2 rounded">
                                        <FileIcon />
                                        <span className="truncate flex-grow" title={file.name}>{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center justify-center h-full bg-gray-900/30 rounded-lg border border-gray-700">
                                <p className="text-gray-500">Aguardando arquivos...</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-blue-300">2. Resultados da Extração</h2>
                    {hasSuccessfulResults && (
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                                <ExcelIcon /> Exportar Excel
                            </button>
                            <button onClick={handleDownloadRenamed} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                                <DownloadIcon /> Baixar PDFs
                            </button>
                        </div>
                    )}
                </div>
                <ResultsTable results={results} setResults={setResults} />
                {hasSuccessfulResults && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center gap-4">
                        <span className="text-gray-400 font-semibold">Valor Líquido Total:</span>
                        <span className="text-xl font-bold text-green-400">
                            {totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
};

export default BatchExtractTab;