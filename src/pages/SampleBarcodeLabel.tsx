// src/components/SampleBarcodeLabel.tsx
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Appointment } from '../lib/supabase';

interface BarcodeLabelProps {
  appointment: Appointment & { [key: string]: any };
}

interface SpecimenContainer {
  id: string;          
  name: string;        
  specimenType: string;
  matchedTests: string[]; 
}

// ── SUB-COMPONENT FOR AN ISOLATED PHYSICAL VIAL LABEL (2" x 1") ──
const VialLabel: React.FC<{ 
  appointment: any; 
  container: SpecimenContainer; 
  index: number; 
  total: number; 
}> = ({ appointment, container, index, total }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  
  const baseBookingId = appointment.booking_id || `ID-${appointment.id}`;
  const uniqueVialId = `${baseBookingId}-${container.id}`.toUpperCase().trim();
  const testsString = container.matchedTests.join(', ').toUpperCase();

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, uniqueVialId, {
          format: 'CODE128',
          width: 1.5,       // High-density line definition for 203 DPI thermal heads
          height: 24,       // Tucked slightly to guarantee zero vertical overflow on 1-inch roll heights
          displayValue: true,
          fontSize: 8,      
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode generation failed:', err);
      }
    }
  }, [uniqueVialId]);

  return (
    <div className="lis-barcode-sticker-canvas" style={styles.labelCanvas}>
      {/* Header Line: Demographics */}
      <div style={styles.headerRow}>
        <span style={styles.patientName}>{appointment.name?.substring(0, 16)}</span>
        <span style={styles.metaData}>
          {appointment.age || 'N/A'}/{appointment.gender?.[0] || 'U'}
        </span>
      </div>
      
      {/* Barcode Lane */}
      <div style={styles.barcodeWrapper}>
        <svg ref={barcodeRef}></svg>
      </div>
      
      {/* Footer Line: Container Specifics & Linked Tests */}
      <div style={styles.footerRow}>
        <span style={styles.testName} title={testsString}>
          [{container.id}] {testsString}
        </span>
        <span style={styles.vialCounter}>{index}/{total}</span>
      </div>
    </div>
  );
};

// ── MAIN EXPORT COMPONENT ──
export const SampleBarcodeLabel: React.FC<BarcodeLabelProps> = ({ appointment }) => {
  
  const NON_SPECIMEN_KEYWORDS = [
    'X-RAY', 'XRAY', 'CXR', 'MRI', 'CT SCAN', 'CAT SCAN', 'HRCT', 'NCCT', 'CECT',
    'ULTRASOUND', 'USG', 'SONOGRAPHY', 'ANOMALY SCAN', 'NT SCAN', 'MAMMOGRAPHY', 
    'DEXA', 'BONE DENSITY', 'FLUOROSCOPY', 'PET SCAN', 'ECG', 'EKG', 'ECHO', 
    'ECHOCARDIOGRAPHY', 'TMT', 'TREADMILL', 'STRESS TEST', 'HOLTER', 'PFT', 
    'SPIROMETRY', 'EEG', 'EMG', 'BERA', 'AUDIOMETRY', 'HEARING', 'ENDOSCOPY', 
    'COLONOSCOPY', 'BRONCHOSCOPY', 'CONSULTATION', 'DOCTOR FEES', 'OPD', 'PHYSICAL EXAM'
  ];

  const CONTAINER_MAPS = [
    {
      id: 'EDTA',
      name: 'EDTA Tube (Purple/Lavender Top)',
      specimenType: 'Whole Blood',
      keywords: ['CBC', 'HEMOGLOBIN', 'HAEMOGLOBIN', 'HBA1C', 'BLOOD GROUP', 'ESR', 'PLATELET', 'MALARIA', 'SMEAR', 'CBC/WBC']
    },
    {
      id: 'FLR',
      name: 'Fluoride Tube (Grey Top)',
      specimenType: 'Plasma',
      keywords: ['FASTING', 'PPBS', 'POST PRANDIAL', 'GLUCOSE', 'SUGAR', 'RBS', 'FBS']
    },
    {
      id: 'URN',
      name: 'Urine Container (Sterile Cup)',
      specimenType: 'Urine',
      keywords: ['URINE', 'URINALYSIS', 'MICROSCOPY', 'UTI', 'ALBUMIN']
    },
    {
      id: 'CIT',
      name: 'Citrate Tube (Light Blue Top)',
      specimenType: 'Plasma',
      keywords: ['PT', 'INR', 'APTT', 'COAGULATION', 'PROTHROMBIN']
    }
  ];

  const targetTests = appointment.test 
    ? appointment.test.split(',').map((t: string) => t.trim()).filter(Boolean)
    : ['STANDARD PANEL'];

  const activeContainers: { [key: string]: SpecimenContainer } = {};
  let excludedImagingCount = 0; // RESTORED: Track excluded procedural orders for explicit user feedback

  targetTests.forEach(testName => {
    const upperTest = testName.toUpperCase();

    if (NON_SPECIMEN_KEYWORDS.some(kw => upperTest.includes(kw))) {
      excludedImagingCount++;
      return;
    }

    let matched = false;
    for (const map of CONTAINER_MAPS) {
      if (map.keywords.some(kw => upperTest.includes(kw))) {
        if (!activeContainers[map.id]) {
          activeContainers[map.id] = { id: map.id, name: map.name, specimenType: map.specimenType, matchedTests: [] };
        }
        activeContainers[map.id].matchedTests.push(testName);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const serumId = 'SRM';
      if (!activeContainers[serumId]) {
        activeContainers[serumId] = {
          id: serumId,
          name: 'Serum Separator Tube (Gold/Red Top)',
          specimenType: 'Serum',
          matchedTests: []
        };
      }
      activeContainers[serumId].matchedTests.push(testName);
    }
  });

  const containersToPrint = Object.values(activeContainers);

  // Handle fallback UI if the booking contains absolutely no fluid samples
  if (containersToPrint.length === 0) {
    return (
      <div style={styles.outerContainer}>
        <div style={styles.infoBox}>
          <span style={{ fontSize: '16px', marginRight: '6.5px' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#334155', display: 'block', marginBottom: '2px' }}>
              Procedural / Imaging Order
            </strong>
            This appointment contains {excludedImagingCount} imaging or clinic procedure selection(s). Physical sample container barcodes are not required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outerContainer}>
      {/* 1. SCREEN DASHBOARD PREVIEW VIEW (Safe from print style inheritance) */}
      <div style={styles.previewContainer}>
        {containersToPrint.map((container) => (
          <div key={container.id} style={styles.queueCard}>
            <div style={styles.tubeIndicator}>
              <div style={{ ...styles.colorBadge, backgroundColor: getTubeColor(container.id) }} />
              <div>
                <span style={styles.tubeTitle}>{container.name}</span>
                <span style={styles.tubeSubtitle}>{container.specimenType} ({container.matchedTests.length} tests)</span>
              </div>
            </div>
            
            {/* Displaying static canvas representations purely for screen dashboard preview evaluation */}
            <div style={styles.previewCanvasWrapper}>
              <VialLabel appointment={appointment} container={container} index={0} total={0} />
            </div>
          </div>
        ))}
        
        {/* Subtle information alert if a hybrid booking has hidden non-specimen lines */}
        {excludedImagingCount > 0 && (
          <div style={styles.inlineAlert}>
            ℹ️ {excludedImagingCount} radiology/procedure line item(s) filtered out of this print job.
          </div>
        )}
      </div>

      <button onClick={() => window.print()} style={styles.printButton}>
        🖨️ Print Aggregated Labels ({containersToPrint.length})
      </button>

      {/* 2. ISOLATED PRINT ZONE (FIXED: Clean HTML flow context completely separated from screen UI containers) */}
      <div id="lis-isolated-print-zone">
        {containersToPrint.map((container, idx) => (
          <VialLabel 
            key={`print-${container.id}`}
            appointment={appointment} 
            container={container} 
            index={idx + 1} 
            total={containersToPrint.length} 
          />
        ))}
      </div>

      {/* Robust Hardened Thermal Print Layout Style Block */}
      <style>{`
        @page {
          size: 2in 1in;
          margin: 0 !important; 
        }
        
        /* Default state: Hide the hardware target zone while operating on the normal screen dashboard view */
        #lis-isolated-print-zone {
          display: none;
        }

        @media print {
          body, html, #root {
            background: none !important;
            background-color: transparent !important;
          }
          /* Hide all screen layout elements completely */
          body * { 
            visibility: hidden; 
          }
          
          /* Expose and open layout engine parameters for the flat print zone element specifically */
          #lis-isolated-print-zone {
            display: block !important;
          }
          #lis-isolated-print-zone *, 
          .lis-barcode-sticker-canvas, 
          .lis-barcode-sticker-canvas * { 
            visibility: visible; 
          }
          
          .lis-barcode-sticker-canvas { 
            position: relative; /* FIXED: Restores natural flowing cascading pages instead of absolute overlapping stacking */
            box-sizing: border-box !important;
            width: 2in !important;
            height: 1in !important;
            padding: 5px !important;
            margin: 0 !important;
            border: none !important; /* Strips visualization guides on physical paper feed output */
            page-break-after: always !important;
            page-break-inside: avoid !important;
            
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* FIXED: SVG scaling limit guard matrix to prevent variable-width barcode clipping over 2-inch limits */
          .lis-barcode-sticker-canvas svg {
            max-width: 100% !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

const getTubeColor = (id: string): string => {
  switch (id) {
    case 'EDTA': return '#a855f7'; 
    case 'FLR':  return '#94a3b8'; 
    case 'URN':  return '#eab308'; 
    case 'CIT':  return '#3b82f6'; 
    case 'SRM':  return '#f59e0b'; 
    default:     return '#cbd5e1';
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  outerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' },
  previewContainer: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '460px' },
  queueCard: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9', gap: '12px' },
  tubeIndicator: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  colorBadge: { width: '10px', height: '32px', borderRadius: '4px' },
  tubeTitle: { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' },
  tubeSubtitle: { display: 'block', fontSize: '10px', color: '#64748b' },
  previewCanvasWrapper: { transform: 'scale(0.85)', transformOrigin: 'right center', opacity: 0.9 },
  
  labelCanvas: { width: '2in', height: '1in', backgroundColor: '#ffffff', border: '1.5px dashed #cbd5e1', padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', fontFamily: "'Courier New', Courier, monospace", overflow: 'hidden' },
  
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1px' },
  patientName: { fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.2px' },
  metaData: { fontSize: '8px', fontWeight: 'bold', color: '#334155' },
  barcodeWrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, padding: '1px 0' },
  footerRow: { borderTop: '1px dashed #cbd5e1', paddingTop: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  testName: { fontSize: '6.5px', color: '#0f172a', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '82%' },
  vialCounter: { fontSize: '7px', color: '#0f172a', fontWeight: 'bold' },
  printButton: { padding: '8px 18px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  infoBox: { padding: '12px 14px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'flex-start', lineHeight: '1.4', maxWidth: '320px' },
  inlineAlert: { fontSize: '10.5px', color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '500' }
};

export default SampleBarcodeLabel;