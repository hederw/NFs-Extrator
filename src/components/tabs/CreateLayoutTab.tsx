import React, { useState } from 'react';
import FileUploader from '../FileUploader';
import Spinner from '../Spinner';
import { generateLayoutPromptFromImage } from '../../services/geminiService';
import type { Layout } from '../../types';

// Declare pdfjsLib from global scope (CDN)
declare const pdfjsLib: any;


interface CreateLayoutTabProps {
    onLayoutGenerated: (layout: Omit<Layout, 'id'>) => void;
}

const CreateLayoutTab: React.FC<CreateLayoutTabProps> = ({ onLayoutGenerated }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [layoutName, setLayoutName] = useState('');

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

    const handleFileSelected = (files: FileList) => {
        if (files.length > 0) {
            setFile(files[0]);
            setError(null);
            setGeneratedPrompt('');
            setLayoutName(files[0].name.replace('.pdf', '').replace(/_/g, ' '));
        }
    };

    const handleClear = () => {
        setFile(null);
        setError(null);
        setGeneratedPrompt('');
        setLayoutName('');
    };
    
    const handleGeneratePrompt = async () => {
        if (!file) {
            setError("Por favor, selecione um arquivo PDF de exemplo.");
            return;
        }
        
        setIsProcessing(true);
        setError(null);
        setGeneratedPrompt('');

        try {
            const base64Image = await convertPdfToImage(file);
            const prompt = await generateLayoutPromptFromImage(base64Image);
            setGeneratedPrompt(prompt);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSaveLayout = () => {
        if (!layoutName || !generatedPrompt) {
            alert("O nome do layout e o prompt gerado são obrigatórios.");
            return;
        }
        onLayoutGenerated({ name: layoutName, prompt: generatedPrompt });
        handleClear(); // Limpa o formulário após salvar
    }

    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-blue-300 mb-1">1. Envie um PDF de Exemplo</h2>
                <p className="text-gray-400 mb-4 text-sm">A IA irá analisar este arquivo para aprender a estrutura dos dados.</p>
                <FileUploader onFilesSelected={handleFileSelected} onClear={handleClear} />
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-blue-300 mb-4">2. Gere o Prompt de Extração</h2>
                 <button
                    onClick={handleGeneratePrompt}
                    disabled={!file || isProcessing}
                    className="w-full md:w-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
                >
                    {isProcessing ? <><Spinner /> Analisando Layout...</> : 'Analisar com IA'}
                </button>
                {error && <p className="text-red-400 mt-4">{error}</p>}
            </section>
            
            {generatedPrompt && (
                <section className="bg-gray-800 p-6 rounded-lg shadow-lg animate-fade-in">
                    <h2 className="text-2xl font-semibold text-blue-300 mb-4">3. Salve o Novo Layout</h2>
                     <div className="mb-4">
                        <label htmlFor="layoutName" className="block text-sm font-medium text-gray-300 mb-1">
                        Nome do Layout
                        </label>
                        <input
                            type="text"
                            id="layoutName"
                            value={layoutName}
                            onChange={(e) => setLayoutName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ex: Notas de São Paulo"
                            required
                        />
                    </div>
                     <div className="mb-4">
                        <label htmlFor="layoutPrompt" className="block text-sm font-medium text-gray-300 mb-1">
                        Prompt Gerado (editável)
                        </label>
                        <textarea
                            id="layoutPrompt"
                            value={generatedPrompt}
                            onChange={(e) => setGeneratedPrompt(e.target.value)}
                            rows={5}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            required
                        />
                    </div>
                    <button
                        onClick={handleSaveLayout}
                        className="w-full md:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors text-lg"
                    >
                        Salvar Layout e Usar
                    </button>
                </section>
            )}
        </div>
    );
};

export default CreateLayoutTab;