/**
 * Client-side salary-slip PDF generator (Enterprise HR plan, P3).
 * Dynamic-imports jspdf + jspdf-autotable (same pattern as the commissions
 * page) so the heavy libs aren't in the initial bundle. Used by both the admin
 * payslip view and the member "My Salary" download.
 */

import { amountInWords, type PayslipLine } from './payroll';

export interface PayslipDoc {
  companyName?: string | null;
  employeeName: string;
  designation?: string | null;
  pan?: string | null;
  slipNo?: string | null;
  period: string;
  baseSalary: number;
  allowancesTotal: number;
  commissionTotal: number;
  additions: number;
  grossEarnings: number;
  presentDays: number;
  absentUnits: number;
  paidLeaves: number;
  absenceDeduction: number;
  otherDeductions: number;
  netPay: number;
  lines: PayslipLine[];
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
const rupee = (n: number): string => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

/** Build and download the salary-slip PDF for one payslip snapshot. */
export async function downloadPayslipPdf(slip: PayslipDoc): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Header ──
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(slip.companyName || 'Company', 105, 18, { align: 'center' });
  doc.setFontSize(11).setFont('helvetica', 'normal');
  doc.text('SALARY SLIP', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text(monthLabel(slip.period), 105, 31, { align: 'center' });
  if (slip.slipNo) {
    doc.setFontSize(8).setTextColor(120);
    doc.text(`No. ${slip.slipNo}`, 196, 14, { align: 'right' });
    doc.setTextColor(0);
  }

  // ── Employee details ──
  autoTable(doc, {
    startY: 37,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ['Name', slip.employeeName, 'Designation', slip.designation || '-'],
      ['Pay period', monthLabel(slip.period), 'PAN', slip.pan || '-'],
    ],
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
  });

  // ── Attendance summary ──
  autoTable(doc, {
    startY: finalY() + 4,
    head: [['Present', 'Absent (units)', 'Paid leaves']],
    body: [[String(slip.presentDays), String(slip.absentUnits), String(slip.paidLeaves)]],
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center' },
    headStyles: { fillColor: [37, 99, 235] },
  });

  // ── Earnings & deductions ──
  const earnings = slip.lines.filter((l) => l.amount > 0);
  const deductions = slip.lines.filter((l) => l.amount < 0);
  const rows: string[][] = [];
  const maxLen = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < maxLen; i++) {
    const e = earnings[i] as PayslipLine | undefined;
    const d = deductions[i] as PayslipLine | undefined;
    rows.push([
      e ? `${e.label}${e.clientName ? ` (${e.clientName})` : ''}` : '',
      e ? rupee(e.amount) : '',
      d ? d.label : '',
      d ? rupee(-d.amount) : '',
    ]);
  }
  rows.push([
    'Gross earnings', rupee(slip.grossEarnings),
    'Total deductions', rupee(slip.grossEarnings - slip.netPay),
  ]);
  autoTable(doc, {
    startY: finalY() + 4,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
  });

  // ── Net pay ──
  const y = finalY() + 10;
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text(`Net Pay: ${rupee(slip.netPay)}`, 14, y);
  doc.setFontSize(9).setFont('helvetica', 'italic');
  doc.text(amountInWords(slip.netPay), 14, y + 6);
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120);
  doc.text('This is a computer-generated salary slip and does not require a signature.', 14, y + 14);

  doc.save(`salary-slip-${slip.employeeName.replace(/\s+/g, '-')}-${slip.period}.pdf`);
}
