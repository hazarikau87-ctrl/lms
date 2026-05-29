import { useState } from 'react';
import { Check, X, Trash2, FileDown, FileSpreadsheet, RotateCw } from 'lucide-react';

interface ActionBarProps {
  selectedIds: Set<number>;
  appointments: any[];
  labName?: string;
  onClearSelection: () => void;
  onBulkUpdateStatus: (status: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export default function ActionBar({
  selectedIds,
  appointments,
  labName = 'Partner Lab',
  onClearSelection,
  onBulkUpdateStatus,
  onBulkDelete,
}: ActionBarProps) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Return early if no items are selected so the floating bar stays hidden
  if (selectedIds.size === 0) return null;

  // Filter out the full object details for only the selected appointments
  const selectedRecords = appointments.filter((a) => selectedIds.has(a.id));

  // --- ACTIONS ---
  const handleAction = async (type: string, callback: () => Promise<void>) => {
    setIsProcessing(type);
    try {
      await callback();
    } catch (err) {
      console.error(`Error executing ${type}:`, err);
    } finally {
      setIsProcessing(null);
    }
  };

  // --- PDF EXPORT FUNCTION ---
  const exportToPDF = async () => {
    setIsProcessing('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF('p', 'mm', 'a4');
      doc.setFillColor(26, 115, 232);
      doc.rect(0, 0, 210, 42, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(labName.toUpperCase(), 14, 22);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Selected Report Summary | LabOps Scheduler', 14, 31);
      doc.text(`Exported on: ${new Date().toLocaleDateString('en-IN')}`, 14, 37);

      const rows = selectedRecords.map((item) => [
        item.booking_id,
        `${item.name}\n${item.age ?? 'N/A'}Y / ${item.gender || ''}\n${item.mobile || 'N/A'}`,
        item.test,
        `${item.appointment_date}\n${item.time || 'N/A'}`,
        item.remarks || '-',
        (item.status || 'Pending').toUpperCase(),
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['ID', 'Patient Details', 'Test', 'Schedule', 'Remarks', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [26, 115, 232] },
        styles: { fontSize: 9, valign: 'middle' },
      });

      doc.save(`${labName.replace(/\s+/g, '_')}_Selected_Report.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  // --- EXCEL EXPORT FUNCTION ---
  const exportToExcel = async () => {
    setIsProcessing('excel');
    try {
      const XLSX = await import('xlsx');
      
      // Clean up dataset fields to make neat spreadsheet columns
      const sheetData = selectedRecords.map((item) => ({
        'Booking ID': item.booking_id,
        'Patient Name': item.name,
        'Mobile': item.mobile,
        'WhatsApp': item.whatsapp || 'N/A',
        'Email': item.email || 'N/A',
        'Age': item.age ?? 'N/A',
        'Gender': item.gender || 'N/A',
        'Appointment Date': item.appointment_date,
        'Scheduled Time': item.time || 'N/A',
        'Prescribed Tests': item.test,
        'Booking Type': item.booking_type || item.bookingType || 'walk-in',
        'Fulfillment Address': item.address_line || item.address || 'N/A',
        'Pincode': item.pincode || 'N/A',
        'Landmark': item.landmark || 'N/A',
        'Internal Remarks': item.remarks || '',
        'Workflow Status': item.status || 'Pending',
        'Created Timestamp': item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
      }));

      // Generate Workbook structures
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Appointments');

      // Set clean grid-fitting automated widths
      const maxColWidths = Object.keys(sheetData[0] || {}).map((key) => ({
        wch: Math.max(key.length + 3, ...sheetData.map((row: any) => String(row[key] ?? '').length + 2)),
      }));
      worksheet['!cols'] = maxColWidths;

      XLSX.writeFile(workbook, `${labName.replace(/\s+/g, '_')}_Spreadsheet.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 bg-slate-900 border border-slate-800 text-white px-6 py-3.5 rounded-2xl shadow-2xl min-w-[720px] max-w-[95%] animate-[slideUp_0.2s_ease-out]">
      
      {/* Selected Indicator Counter */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onClearSelection}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          title="Clear Selection"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold tracking-wide bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-xl">
          {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} selected
        </span>
      </div>

      {/* Primary Operations Buttons */}
      <div className="flex items-center gap-2">
        <button
          disabled={!!isProcessing}
          onClick={() => handleAction('Complete', () => onBulkUpdateStatus('Completed'))}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
        >
          {isProcessing === 'Complete' ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Complete
        </button>

        <button
          disabled={!!isProcessing}
          onClick={() => handleAction('Cancel', () => onBulkUpdateStatus('Cancelled'))}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all active:scale-[0.98]"
        >
          {isProcessing === 'Cancel' ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Cancel
        </button>

        <button
          disabled={!!isProcessing}
          onClick={() => handleAction('Delete', onBulkDelete)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/40 font-semibold text-xs rounded-xl transition-all active:scale-[0.98]"
        >
          {isProcessing === 'Delete' ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Premium Export Suite */}
        <button
          disabled={!!isProcessing}
          onClick={exportToPDF}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
        >
          {isProcessing === 'pdf' ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          Export Report
        </button>

        <button
          disabled={!!isProcessing}
          onClick={exportToExcel}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
          title="Export to Microsoft Excel"
        >
          {isProcessing === 'excel' ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
          Export Excel
        </button>
      </div>
    </div>
  );
}
