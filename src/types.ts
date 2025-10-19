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

export type ValidationStatus = 'OK' | 'Divergente' | 'Não Encontrado';

export interface ValidationResult {
    status: ValidationStatus;
    source: string;
    expectedValue?: number;
}

// FIX: Add missing types for comparison results and history.
export type FieldComparisonStatus = 'match' | 'mismatch' | 'missing';

export interface FieldComparison {
    status: FieldComparisonStatus;
    extracted: string | number | null;
    groundTruth: string | number | null;
}

export type OverallComparisonStatus = 'perfect_match' | 'partial_mismatch' | 'not_found_in_truth';

export interface ComparisonResultItem {
    numeroNota: string;
    comparisonStatus: OverallComparisonStatus;
    fields: {
        prestador: FieldComparison;
        dataEmissao: FieldComparison;
        valorLiquido: FieldComparison;
    };
}

export interface ComparisonSummary {
    total: number;
    matches: number;
    mismatches: number;
    notFound: number;
}

export interface ComparisonHistoryItem {
    id: string;
    timestamp: string;
    results: ComparisonResultItem[];
    summary: ComparisonSummary;
}
