'use client';

/**
 * BrokerReqBulkImportModal — F15
 *
 * Tighter-scoped sibling of PropertyBulkImportModal. Same upload → preview →
 * import flow but with broker-requirement columns. The two modals share
 * almost no state shape; the duplication is intentional — a generic
 * "BulkImportModal" would have to learn every domain's column-alias map
 * and validation, and we'd save ~150 lines of one-time scaffolding.
 */

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/common/Button';

const COLUMN_MAP: Record<string, string> = {
  'broker name': 'brokerName', 'name': 'brokerName', 'broker': 'brokerName',
  'company': 'brokerCompany', 'broker company': 'brokerCompany', 'firm': 'brokerCompany',
  'contact': 'contact', 'phone': 'contact', 'mobile': 'contact',
  'email': 'email', 'mail': 'email',
  'status': 'status',
  'requirement': 'requirement', 'requirements': 'requirement', 'need': 'requirement',
  'source': 'source',
  'follow up': 'followUpDate', 'follow up date': 'followUpDate', 'followup': 'followUpDate',
  'remark': 'remark', 'remarks': 'remark', 'note': 'remark', 'notes': 'remark',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface ParsedRow {
  rowNum: number;
  data: Record<string, unknown>;
  errors: string[];
  valid: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  details: {
    imported: Array<{ row: number; brokerName: string; id: string }>;
    skipped: Array<{ row: number; errors: string[] }>;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function BrokerReqBulkImportModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const validRows = parsedRows.filter((r) => r.valid);
  const errorRows = parsedRows.filter((r) => !r.valid);

  function reset() {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setResult(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please select an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    setFileName(file.name);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(buffer);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setError('CSV file is empty or has only a header row.');
          return;
        }
        const ws = workbook.addWorksheet('CSV');
        for (const line of lines) ws.addRow(line.split(',').map((c) => c.trim()));
      } else {
        await workbook.xlsx.load(buffer);
      }

      const ws = workbook.worksheets[0];
      if (!ws) {
        setError('No worksheet found in the file.');
        return;
      }

      const headerRow = ws.getRow(1);
      const headerMap: Record<number, string> = {};
      headerRow.eachCell((cell, colNumber) => {
        const raw = String(cell.value ?? '');
        const field = COLUMN_MAP[normalizeHeader(raw)];
        if (field) headerMap[colNumber] = field;
      });

      if (Object.keys(headerMap).length === 0) {
        setError('Could not match any column headers. Make sure your sheet has headers like: Broker Name, Contact, Requirement.');
        return;
      }

      const rows: ParsedRow[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const data: Record<string, unknown> = {};
        let hasAny = false;
        for (const [colStr, field] of Object.entries(headerMap)) {
          const cell = row.getCell(Number(colStr));
          const v = cell.value;
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            let str: unknown = v;
            if (typeof v === 'object' && v !== null && 'richText' in v) {
              const rich = v as { richText: Array<{ text: string }> };
              str = rich.richText.map((t) => t.text).join('');
            } else if (v instanceof Date) {
              str = v.toISOString().slice(0, 10);
            }
            data[field] = typeof str === 'string' ? str.trim() : str;
            hasAny = true;
          }
        }
        if (!hasAny) continue;

        const errors: string[] = [];
        if (!data.brokerName) errors.push('Broker name missing');
        if (!data.contact) errors.push('Contact missing');
        if (!data.requirement) errors.push('Requirement missing');

        rows.push({ rowNum: i, data, errors, valid: errors.length === 0 });
      }

      if (rows.length === 0) {
        setError('No data rows found in the file.');
        return;
      }
      setParsedRows(rows);
      setStep('preview');
    } catch (err) {
      setError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleImport() {
    setStep('importing');
    setError(null);
    try {
      const res = await fetch('/api/broker-requirements/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows.map((r) => r.data) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setStep('done');
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Broker Requirements');
    ws.columns = [
      { header: 'Broker Name',    key: 'brokerName',    width: 22 },
      { header: 'Company',        key: 'brokerCompany', width: 20 },
      { header: 'Contact',        key: 'contact',       width: 16 },
      { header: 'Email',          key: 'email',         width: 24 },
      { header: 'Status',         key: 'status',        width: 10 },
      { header: 'Requirement',    key: 'requirement',   width: 40 },
      { header: 'Source',         key: 'source',        width: 14 },
      { header: 'Follow Up Date', key: 'followUpDate',  width: 14 },
      { header: 'Remark',         key: 'remark',        width: 30 },
    ];
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });
    ws.addRow({
      brokerName: 'Anjali Mehta',
      brokerCompany: 'Urban Deals',
      contact: '+919876543210',
      email: 'anjali@urbandeals.in',
      status: 'Hot',
      requirement: '3 BHK in DLF Cyber Sector 24, ₹2.5Cr budget, registry case preferred',
      source: 'Referral',
      followUpDate: '2026-05-05',
      remark: 'Brought repeat customers last year, prioritise.',
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'broker-requirements-template.xlsx';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-500" />
            {step === 'done' ? 'Import Complete' : 'Import Broker Requirements'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-gray-200 rounded-xl py-10 px-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">Drag &amp; drop your Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">.xlsx, .xls, .csv — max 5,000 rows</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Download size={14} /> Download sample template
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="font-medium text-gray-700">{fileName}</span>{' '}
                <span className="text-gray-400">— {parsedRows.length} rows scanned</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700">Will import</p>
                  <p className="text-lg font-bold text-emerald-700">{validRows.length}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700">Will skip (errors)</p>
                  <p className="text-lg font-bold text-amber-700">{errorRows.length}</p>
                </div>
              </div>

              {errorRows.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-amber-700 font-medium">
                    Show {errorRows.length} skipped row{errorRows.length !== 1 ? 's' : ''}
                  </summary>
                  <ul className="mt-2 space-y-1 text-gray-600">
                    {errorRows.slice(0, 50).map((r) => (
                      <li key={r.rowNum} className="px-2 py-1 bg-gray-50 rounded">
                        Row {r.rowNum}: {r.errors.join(', ')}
                      </li>
                    ))}
                    {errorRows.length > 50 && (
                      <li className="text-gray-400 italic">…and {errorRows.length - 50} more</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-10">
              <div className="animate-spin h-10 w-10 border-b-2 border-blue-500 rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-600">Importing {validRows.length} rows…</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={18} />
                <p className="font-semibold">{result.imported} imported, {result.skipped} skipped</p>
              </div>
              <p className="text-xs text-gray-500">
                You can close this dialog — the list will refresh automatically.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>Re-upload</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                Import {validRows.length} rows
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={handleClose}>Close</Button>}
          {step === 'upload' && <Button variant="outline" onClick={handleClose}>Cancel</Button>}
        </div>
      </div>
    </div>
  );
}
