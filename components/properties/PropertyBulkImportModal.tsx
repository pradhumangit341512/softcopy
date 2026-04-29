'use client';

/**
 * PropertyBulkImportModal — F13
 *
 * Excel/CSV → preview → confirm → POST /api/properties/import. Mirrors
 * the client BulkImportModal pattern almost exactly so users learn it once
 * and the maintenance footprint stays small. Differences:
 *
 *   - Column-alias map covers F10 + F11 + F12 fields (project identity,
 *     deal flow, multi-phone) with forgiving header normalization.
 *   - Sample template carries ALL the optional columns so brokers can
 *     fill what they have without guessing field names.
 *   - Server endpoint is /api/properties/import (gated by
 *     feature.bulk_inventory).
 */

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/common/Button';

// ── Column-header aliases. Lowercase + normalised whitespace before lookup.
const COLUMN_MAP: Record<string, string> = {
  // Required core
  'inventory name': 'propertyName', 'property name': 'propertyName', 'name': 'propertyName',
  'address': 'address',
  'property type': 'propertyType', 'type': 'propertyType',
  'bhk': 'bhkType', 'bhk type': 'bhkType', 'configuration': 'bhkType',
  'area': 'area', 'size': 'area',
  'description': 'description', 'remarks': 'description',
  'status': 'status',
  'asking rent': 'askingRent', 'rent': 'askingRent',
  'selling price': 'sellingPrice', 'price': 'sellingPrice', 'sale price': 'sellingPrice',
  'vacate date': 'vacateDate', 'vacate': 'vacateDate',
  // F10 project identity
  'project': 'projectName', 'project name': 'projectName',
  'sector': 'sectorNo', 'sector no': 'sectorNo', 'sector number': 'sectorNo',
  'unit': 'unitNo', 'unit no': 'unitNo', 'unit number': 'unitNo',
  'tower': 'towerNo', 'tower no': 'towerNo', 'tower number': 'towerNo',
  'typology': 'typology',
  // F11 deal flow
  'demand': 'demand', 'owner demand': 'demand',
  'payment status': 'paymentStatus', 'payment': 'paymentStatus',
  'case type': 'caseType', 'case': 'caseType', 'registry': 'caseType',
  'loan status': 'loanStatus', 'loan': 'loanStatus',
  // Owner
  'owner name': 'ownerName', 'owner': 'ownerName',
  'owner phone': 'ownerPhone', 'phone': 'ownerPhone', 'mobile': 'ownerPhone', 'contact': 'ownerPhone',
  'owner phones': 'ownerPhones', 'additional phones': 'ownerPhones', 'extra phones': 'ownerPhones',
  'owner email': 'ownerEmail', 'email': 'ownerEmail',
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
    imported: Array<{ row: number; propertyName: string; id: string }>;
    skipped: Array<{ row: number; errors: string[] }>;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function PropertyBulkImportModal({ open, onClose, onImported }: Props) {
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
      // Dynamic import — exceljs is hefty, only load when actually used.
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
        for (const line of lines) {
          ws.addRow(line.split(',').map((c) => c.trim()));
        }
      } else {
        await workbook.xlsx.load(buffer);
      }

      const ws = workbook.worksheets[0];
      if (!ws) {
        setError('No worksheet found in the file.');
        return;
      }

      // Read header row and resolve to internal field names.
      const headerRow = ws.getRow(1);
      const headerMap: Record<number, string> = {};
      headerRow.eachCell((cell, colNumber) => {
        const raw = String(cell.value ?? '');
        const normalized = normalizeHeader(raw);
        const field = COLUMN_MAP[normalized];
        if (field) headerMap[colNumber] = field;
      });

      if (Object.keys(headerMap).length === 0) {
        setError(
          'Could not match any column headers. Make sure your sheet has headers like: Inventory Name, Address, Property Type, Owner Name, Owner Phone.'
        );
        return;
      }

      const rows: ParsedRow[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const data: Record<string, unknown> = {};
        let hasAnyValue = false;

        for (const [colStr, field] of Object.entries(headerMap)) {
          const cell = row.getCell(Number(colStr));
          const v = cell.value;
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            // Handle ExcelJS rich text objects + Date instances.
            let str: unknown = v;
            if (typeof v === 'object' && v !== null && 'richText' in v) {
              const rich = v as { richText: Array<{ text: string }> };
              str = rich.richText.map((t) => t.text).join('');
            } else if (v instanceof Date) {
              str = v.toISOString().slice(0, 10);
            }
            data[field] = typeof str === 'string' ? str.trim() : str;
            hasAnyValue = true;
          }
        }

        if (!hasAnyValue) continue;

        const errors: string[] = [];
        if (!data.propertyName) errors.push('Inventory name missing');
        if (!data.address) errors.push('Address missing');
        if (!data.propertyType) errors.push('Property type missing');
        if (!data.ownerName) errors.push('Owner name missing');
        if (!data.ownerPhone) errors.push('Owner phone missing');

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
      const res = await fetch('/api/properties/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    const ws = wb.addWorksheet('Inventory');

    ws.columns = [
      { header: 'Inventory Name',   key: 'propertyName',  width: 24 },
      { header: 'Address',          key: 'address',       width: 30 },
      { header: 'Property Type',    key: 'propertyType',  width: 14 },
      { header: 'BHK',              key: 'bhkType',       width: 8 },
      { header: 'Area',             key: 'area',          width: 12 },
      { header: 'Asking Rent',      key: 'askingRent',    width: 12 },
      { header: 'Selling Price',    key: 'sellingPrice',  width: 14 },
      { header: 'Vacate Date',      key: 'vacateDate',    width: 12 },
      { header: 'Status',           key: 'status',        width: 12 },
      { header: 'Project Name',     key: 'projectName',   width: 20 },
      { header: 'Sector',           key: 'sectorNo',      width: 10 },
      { header: 'Tower',            key: 'towerNo',       width: 10 },
      { header: 'Unit No',          key: 'unitNo',        width: 10 },
      { header: 'Typology',         key: 'typology',      width: 14 },
      { header: 'Demand',           key: 'demand',        width: 12 },
      { header: 'Payment Status',   key: 'paymentStatus', width: 14 },
      { header: 'Case Type',        key: 'caseType',      width: 12 },
      { header: 'Loan Status',      key: 'loanStatus',    width: 12 },
      { header: 'Owner Name',       key: 'ownerName',     width: 20 },
      { header: 'Owner Phone',      key: 'ownerPhone',    width: 16 },
      { header: 'Owner Phones',     key: 'ownerPhones',   width: 28 },
      { header: 'Owner Email',      key: 'ownerEmail',    width: 24 },
      { header: 'Description',      key: 'description',   width: 28 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });

    ws.addRow({
      propertyName: 'Cyber Tower B-1204',
      address: 'DLF Cyber City, Gurgaon',
      propertyType: 'Flat',
      bhkType: '3BHK',
      area: '1850 sqft',
      askingRent: '',
      sellingPrice: 24000000,
      vacateDate: '2026-06-01',
      status: 'ForSale',
      projectName: 'DLF Cyber City',
      sectorNo: 'Sector 24',
      towerNo: 'Tower B',
      unitNo: 'B-1204',
      typology: '3BHK + Servant',
      demand: 25000000,
      paymentStatus: 'Pending',
      caseType: 'Transfer',
      loanStatus: 'Applied',
      ownerName: 'Rajesh Kumar',
      ownerPhone: '+919876543210',
      // Comma-separated extras — server splits on , | ;
      ownerPhones: '+919876543211, +919876543212',
      ownerEmail: 'rajesh@example.com',
      description: 'High-floor unit, north-facing, society NOC ready.',
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-import-template.xlsx';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-500" />
            {step === 'done' ? 'Import Complete' : 'Import Inventory from Excel'}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
            aria-label="Close"
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
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className="border-2 border-dashed border-gray-200 rounded-xl py-10 px-4 text-center
                  cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  Drag &amp; drop your Excel file here
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">.xlsx, .xls, .csv — max 5,000 rows</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
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
                You can close this dialog — the inventory list will refresh automatically.
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
