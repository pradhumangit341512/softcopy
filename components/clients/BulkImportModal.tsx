'use client';

import { useState, useRef } from 'react';
import { Upload, Download, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';

// Column header aliases — maps flexible Excel header names to Client fields
const COLUMN_MAP: Record<string, string> = {
  'client name': 'clientName', 'clientname': 'clientName', 'name': 'clientName', 'client': 'clientName',
  'phone': 'phone', 'mobile': 'phone', 'contact': 'phone', 'phone number': 'phone', 'mobile number': 'phone',
  'email': 'email', 'email address': 'email', 'mail': 'email',
  'company': 'companyName', 'company name': 'companyName', 'companyname': 'companyName',
  'requirement': 'requirementType', 'requirement type': 'requirementType', 'requirementtype': 'requirementType', 'type': 'requirementType',
  'inquiry': 'inquiryType', 'inquiry type': 'inquiryType', 'inquirytype': 'inquiryType',
  'budget': 'budget',
  'location': 'preferredLocation', 'preferred location': 'preferredLocation', 'preferredlocation': 'preferredLocation', 'area': 'preferredLocation',
  'address': 'address',
  'status': 'status',
  'source': 'source', 'lead source': 'source',
  'notes': 'notes', 'note': 'notes', 'remark': 'notes', 'remarks': 'notes',
  'follow up': 'followUpDate', 'follow up date': 'followUpDate', 'followupdate': 'followUpDate', 'followup': 'followUpDate',
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
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  details: {
    imported: Array<{ row: number; clientName: string; id: string }>;
    skipped: Array<{ row: number; errors: string[] }>;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function BulkImportModal({ open, onClose, onImported }: Props) {
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
      // Dynamic import to avoid bundling exceljs on pages that don't use it
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith('.csv')) {
        // CSV: parse as text, split into rows, and add to worksheet manually
        const text = new TextDecoder().decode(buffer);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const ws = workbook.addWorksheet('CSV');
        for (const line of lines) {
          ws.addRow(line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
        }
      } else {
        await workbook.xlsx.load(buffer);
      }

      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) {
        setError('File is empty or has no data rows (only header).');
        return;
      }

      // Read header row (row 1)
      const headerRow = sheet.getRow(1);
      const colMap: Record<number, string> = {};
      headerRow.eachCell((cell, colNumber) => {
        const raw = String(cell.value ?? '').trim();
        const normalized = normalizeHeader(raw);
        const field = COLUMN_MAP[normalized];
        if (field) colMap[colNumber] = field;
      });

      if (!colMap || Object.keys(colMap).length === 0) {
        setError('Could not match any column headers. Make sure your Excel has headers like: Client Name, Phone, Requirement Type, Inquiry Type');
        return;
      }

      const rows: ParsedRow[] = [];
      const maxRows = Math.min(sheet.rowCount, 5001); // +1 for header

      for (let i = 2; i <= maxRows; i++) {
        const row = sheet.getRow(i);
        const data: Record<string, unknown> = {};
        let hasAnyValue = false;

        for (const [colStr, field] of Object.entries(colMap)) {
          const col = Number(colStr);
          const cell = row.getCell(col);
          let val = cell.value;

          // Handle ExcelJS rich text
          if (val && typeof val === 'object' && 'richText' in val) {
            val = (val as { richText: Array<{ text: string }> }).richText.map((t) => t.text).join('');
          }
          // Handle date objects
          if (val instanceof Date) {
            val = val.toISOString();
          }

          if (val !== null && val !== undefined && String(val).trim() !== '') {
            hasAnyValue = true;
            data[field] = typeof val === 'number' ? val : String(val).trim();
          }
        }

        if (!hasAnyValue) continue; // Skip completely empty rows

        // Validate required fields client-side
        const errors: string[] = [];
        if (!data.clientName) errors.push('Name missing');
        if (!data.phone) errors.push('Phone missing');
        if (!data.requirementType) errors.push('Requirement type missing');
        if (!data.inquiryType) errors.push('Inquiry type missing');

        rows.push({
          rowNum: i,
          data,
          errors,
          valid: errors.length === 0,
        });
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
      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: validRows.map((r) => r.data) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setResult(data);
      setStep('done');
      onImported(); // Refresh the client list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clients');

    ws.columns = [
      { header: 'Client Name', key: 'clientName', width: 25 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Company Name', key: 'companyName', width: 20 },
      { header: 'Requirement Type', key: 'requirementType', width: 18 },
      { header: 'Inquiry Type', key: 'inquiryType', width: 15 },
      { header: 'Budget', key: 'budget', width: 12 },
      { header: 'Preferred Location', key: 'preferredLocation', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Follow Up Date', key: 'followUpDate', width: 15 },
    ];

    // Style header row
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });

    // Add a sample row
    ws.addRow({
      clientName: 'Ravi Kumar',
      phone: '+919876543210',
      email: 'ravi@example.com',
      companyName: 'Kumar Builders',
      requirementType: 'Buy',
      inquiryType: 'Direct',
      budget: 5000000,
      preferredLocation: 'Jaipur',
      address: '123 Main Street',
      status: 'New',
      source: 'WhatsApp',
      notes: 'Looking for 3BHK',
      followUpDate: '2026-05-01',
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client-import-template.xlsx';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-500" />
            {step === 'done' ? 'Import Complete' : 'Import Clients from Excel'}
          </h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center
                  cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Drag &amp; drop your Excel file here
                </p>
                <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">.xlsx, .xls, .csv — max 5,000 rows</p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium mx-auto"
              >
                <Download size={14} />
                Download sample template
              </button>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">File: <strong>{fileName}</strong></span>
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 size={14} /> {validRows.length} valid
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle size={14} /> {errorRows.length} errors
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 text-left sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.slice(0, 100).map((r) => (
                      <tr key={r.rowNum} className={r.valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2 text-gray-500">{r.rowNum}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{String(r.data.clientName || '—')}</td>
                        <td className="px-3 py-2 text-gray-600">{String(r.data.phone || '—')}</td>
                        <td className="px-3 py-2 text-gray-600">{String(r.data.requirementType || '—')}</td>
                        <td className="px-3 py-2">
                          {r.valid ? (
                            <span className="text-green-600">OK</span>
                          ) : (
                            <span className="text-red-600">{r.errors.join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedRows.length > 100 && (
                <p className="text-xs text-gray-500 text-center">
                  Showing first 100 of {parsedRows.length} rows
                </p>
              )}
            </div>
          )}

          {/* STEP 3: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                Importing {validRows.length} clients...
              </p>
              <p className="text-xs text-gray-500">Please don&apos;t close this window</p>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-900">
                    {result.imported} client{result.imported !== 1 ? 's' : ''} imported successfully
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-xs text-green-800 mt-1">
                      {result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (validation errors)
                    </p>
                  )}
                </div>
              </div>

              {result.details.skipped.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 text-xs font-medium text-red-700">
                    Skipped rows
                  </div>
                  <div className="max-h-40 overflow-auto">
                    {result.details.skipped.map((s, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs text-red-600 border-t border-red-100">
                        Row {s.row}: {s.errors.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>
                Choose different file
              </Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                Import {validRows.length} client{validRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Done</Button>
          )}
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
        </div>
      </div>
    </div>
  );
}
