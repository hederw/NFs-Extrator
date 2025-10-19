export interface Layout {
  id: string;
  name: string;
  prompt: string;
}

export interface InvoiceData {
  prestador: string;
  numeroNota: string;
  dataEmissao: string;
  valorLiquido: number;
}

export type ExtractionStatus = 'pending' | 'processing' | 'success' | 'error';

export interface ExtractionResult {
  id: string;
  file: File;
  status: ExtractionStatus;
  data?: InvoiceData;
  error?: string;
}

// Tipos para a funcionalidade de comparação
export type ComparisonFieldStatus = 'match' | 'mismatch' | 'missing';

export interface ComparisonField {
  status: ComparisonFieldStatus;
  extracted?: string | number;
  groundTruth?: string | number;
}

export interface ComparisonResultItem {
  numeroNota: string;
  comparisonStatus: 'perfect_match' | 'partial_mismatch' | 'not_found_in_truth';
  fields: {
    prestador: ComparisonField;
    dataEmissao: ComparisonField;
    valorLiquido: ComparisonField;
  };
}

export interface ComparisonHistoryItem {
  id: string;
  timestamp: string;
  results: ComparisonResultItem[];
  summary: {
    total: number;
    matches: number;
    mismatches: number;
  };
}

// Uma versão do ExtractionResult que pode ser armazenada com segurança no localStorage (sem o objeto File)
export interface StoredExtractionResult {
  id: string;
  fileName: string;
  status: ExtractionStatus;
  data?: InvoiceData;
  error?: string;
}

export interface SavedExtractionItem {
  id: string;
  name: string;
  timestamp: string;
  results: StoredExtractionResult[];
  totalLiquidValue: number;
}