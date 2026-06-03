// src/components/SampleBarcodeLabel.tsx
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Appointment } from '../lib/supabase'; // Import the unified type from your lib

interface BarcodeLabelProps {
  appointment: Appointment & { [key: string]: any };
}

export const SampleBarcodeLabel: React.FC<BarcodeLabelProps> = ({ appointment }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  // Fallback to internal ID string representation if a custom booking string has not loaded yet
  const barcodeValue = (appointment.booking_id || `ID-${appointment.id}`).toUpperCase().trim();

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.4,
          height: 32,
          displayValue: true,
          fontSize: 10,
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode generation failed:', err);
      }
    }
  }, [barcodeValue]);

  return (
    <div style={styles.wrapper}>
      <div id="printable-vial-label" style={styles.labelCanvas}>
        <div style={styles.headerRow}>
          <span style={styles.patientName}>{appointment.name?.substring(0, 16)}</span>
          <span style={styles.metaData}>
            {appointment.age || 'N/A'}/{appointment.gender?.[0] || 'U'}
          </span>
        </div>
        
        <div style={styles.barcodeWrapper}>
          <svg ref={barcodeRef}></svg>
        </div>
        
        <div style={styles.footerRow}>
          <span style={styles.testName}>{appointment.test?.substring(0, 24) || 'Standard Panel'}</span>
        </div>
      </div>

      <button onClick={() => window.print()} style={styles.printButton}>
        🖨️ Print Label
      </button>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-vial-label, #printable-vial-label * { visibility: visible; }
          #printable-vial-label { position: absolute; left: 0; top: 0; border: none !important; }
        }
      `}</style>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: 'fit-content' },
  labelCanvas: { width: '2in', height: '1in', backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '2px' },
  patientName: { fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' },
  metaData: { fontSize: '8px', fontWeight: 'bold', color: '#475569' },
  barcodeWrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 },
  footerRow: { borderTop: '1px dashed #e2e8f0', paddingTop: '2px' },
  testName: { fontSize: '7.5px', color: '#64748b', display: 'block', whitespace: 'nowrap' },
  printButton: { padding: '4px 10px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }
};