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

// ── SUB-COMPONENT: VIAL LABEL ──
const VialLabel: React.FC<{
  appointment: any;
  container: SpecimenContainer;
  index: number;
  total: number;
  isPreview?: boolean;
}> = ({ appointment, container, index, total, isPreview = false }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const baseBookingId = appointment.booking_id || `ID-${appointment.id}`;
  const uniqueVialId = `${baseBookingId}-${container.id}`.toUpperCase().trim();
  const testsString = container.matchedTests.join(', ').toUpperCase();

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, uniqueVialId, {
          format: 'CODE128',
          width: 2,             // Enhanced sharpness for thermal pins
          height: 32,            // Enhanced height profile for medical optical scanners
          displayValue: true,
          fontSize: 10,
          font: 'monospace',
          margin: 0,
        });
        
        // Remove hardcoded width attributes from JsBarcode to allow seamless fluid SVG container scaling
        barcodeRef.current.removeAttribute('width');
        barcodeRef.current.style.width = '100%';
        barcodeRef.current.style.height = '100%';
      } catch (err) {
        console.error('Barcode rendering failed:', err);
      }
    }
  }, [uniqueVialId]);

  return (
    <div
      className={`lis-barcode-sticker-canvas ${isPreview ? 'lis-preview-card-view' : 'lis-physical-print-view'}`}
      style={isPreview ? styles.dashboardPreviewCanvas : styles.printCanvas}
    >
      {/* Patient Demographics */}
      <div style={styles.headerRow}>
        <span style={styles.patientName}>{appointment.name?.substring(0, 16)}</span>
        <span style={styles.metaData}>
          {appointment.age || 'N/A'}/{appointment.gender?.[0]?.toUpperCase() || 'U'}
        </span>
      </div>

      {/* Fluid Barcode Wrapper */}
      <div style={styles.barcodeWrapper}>
        <svg ref={barcodeRef} viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet"></svg>
      </div>

      {/* Footer Routing Meta */}
      <div style={styles.footerRow}>
        <span style={styles.testName} title={testsString}>
          [{container.id}] {testsString}
        </span>
        <span style={styles.vialCounter}>
          {isPreview ? 'V' : `${index}/${total}`}
        </span>
      </div>
    </div>
  );
};

// ── MAIN AUTOMATION INTERFACE ──
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
      name: 'EDTA Tube (Lavender)',
      specimenType: 'Whole Blood',
      keywords: ['CBC', 'HEMOGLOBIN', 'HAEMOGLOBIN', 'HBA1C', 'BLOOD GROUP', 'ESR', 'PLATELET', 'MALARIA', 'SMEAR', 'CBC/WBC']
    },
    {
      id: 'FLR',
      name: 'Fluoride Tube (Grey)',
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
      name: 'Citrate Tube (Light Blue)',
      specimenType: 'Plasma',
      keywords: ['PT', 'INR', 'APTT', 'COAGULATION', 'PROTHROMBIN']
    }
  ];

  const targetTests = appointment.test
    ? appointment.test.split(',').map((t: string) => t.trim()).filter(Boolean)
    : ['STANDARD PANEL'];

  const activeContainers: { [key: string]: SpecimenContainer } = {};
  let excludedImagingCount = 0;

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
          name: 'Serum Tube (Red/Gold)',
          specimenType: 'Serum',
          matchedTests: []
        };
      }
      activeContainers[serumId].matchedTests.push(testName);
    }
  });

  const containersToPrint = Object.values(activeContainers);
  const baseBookingId = appointment.booking_id || `ID-${appointment.id}`;

  const triggerSystemPrint = () => {
    const defaultTitle = document.title;
    document.title = `vials_${baseBookingId.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;
    window.print();
    setTimeout(() => { document.title = defaultTitle; }, 50);
  };

  if (containersToPrint.length === 0) {
    return (
      <div style={styles.emptyAlert}>
        <span style={{ fontSize: '12px' }}>ℹ️</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b' }}>Imaging/OPD Order Only</span>
      </div>
    );
  }

  return (
    <div style={styles.workspaceWrapper}>
      
      {/* ── HIGH DENSITY SCREEN PREVIEW ROW ── */}
      <div className="lis-dashboard-vials-row" style={styles.dashboardVialsRow}>
        {containersToPrint.map((container) => (
          <div key={container.id} style={styles.dashboardWidgetCard} title={`${container.name} (${container.specimenType})`}>
            {/* Minimalist Top Identity Line */}
            <div style={styles.widgetHeader}>
              <div style={{ ...styles.microBadge, backgroundColor: getTubeColor(container.id) }} />
              <span style={styles.widgetTitle}>{container.id}</span>
            </div>
            
            {/* Auto-Scaling Vector Canvas Asset */}
            <div style={styles.widgetCanvasContainer}>
              <VialLabel
                appointment={appointment}
                container={container}
                index={0}
                total={0}
                isPreview={true}
              />
            </div>
          </div>
        ))}

        {/* Action Button */}
        <button onClick={triggerSystemPrint} style={styles.actionPrintIconBtn} title={`Print ${containersToPrint.length} Barcode Labels`}>
          🖨️
          <span style={{ fontSize: '9px', fontWeight: 'bold', display: 'block', marginTop: '1px' }}>
            {containersToPrint.length}
          </span>
        </button>
      </div>

      {/* ── ISOLATED PRINT STRIP (Hidden on Screen) ── */}
      <div id="lis-isolated-print-zone">
        {containersToPrint.map((container, idx) => (
          <VialLabel
            key={`print-isolated-${container.id}`}
            appointment={appointment}
            container={container}
            index={idx + 1}
            total={containersToPrint.length}
            isPreview={false}
          />
        ))}
      </div>

      {/* ── GLOBAL STYLE SYSTEM OVERRIDES ── */}
      <style>{`
        #lis-isolated-print-zone {
          display: none;
        }

        @media print {
          /* Clean layout slate reset */
          body * {
            visibility: hidden !important;
          }
          
          /* Suppress workspace web panels */
          .ml-16, .lis-dashboard-vials-row, #root, .lis-preview-card-view {
            display: none !important;
            visibility: hidden !important;
          }

          /* Remap print layer to viewport boundaries */
          #lis-isolated-print-zone {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 51mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          #lis-isolated-print-zone *,
          .lis-physical-print-view,
          .lis-physical-print-view * {
            visibility: visible !important;
          }

          /* Force precise layout sizing onto the printer rolls */
          .lis-physical-print-view {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            width: 51mm !important;
            height: 25mm !important;
            padding: 1.8mm 2.2mm !important;
            margin: 0 !important;
            border: none !important;
            background: #ffffff !important;
            overflow: hidden !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }

          @page {
            size: 51mm 25mm;
            margin: 0mm !important;
          }
        }
      `}</style>
    </div>
  );
};

const getTubeColor = (id: string): string => {
  switch (id) {
    case 'EDTA': return '#a855f7'; // Purple
    case 'FLR':  return '#64748b'; // Grey
    case 'URN':  return '#eab308'; // Amber Cup
    case 'CIT':  return '#3b82f6'; // Light Blue
    case 'SRM':  return '#ef4444'; // Red Serum
    default:     return '#cbd5e1';
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  workspaceWrapper: {
    width: '100%',
  },
  dashboardVialsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'stretch',
    width: '100%'
  },
  dashboardWidgetCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '5px',
    flex: '1 1 calc(25% - 6px)', // Adapts responsibly as you append 3 or 4 more status containers
    minWidth: '68px',
    maxWidth: '110px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box'
  },
  widgetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '3px'
  },
  microBadge: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    flexShrink: 0
  },
  widgetTitle: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#475569',
    fontFamily: 'monospace'
  },
  widgetCanvasContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: '4px',
    padding: '2px',
    boxSizing: 'border-box'
  },
  // High-density screen canvas layout structure
  dashboardPreviewCanvas: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontFamily: 'monospace',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  // True physical dimensions parsed only by thermal print engine
  printCanvas: {
    width: '2in',
    height: '1in',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    overflow: 'hidden'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '0.5px solid #000000',
    paddingBottom: '1px',
    lineHeight: 1
  },
  patientName: {
    fontSize: '8px',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  metaData: {
    fontSize: '8px',
    fontWeight: 'bold'
  },
  barcodeWrapper: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: '1px 0'
  },
  footerRow: {
    borderTop: '0.5px dashed #000000',
    paddingTop: '1px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    lineHeight: 1
  },
  testName: {
    fontSize: '7px',
    fontWeight: 'bold',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '75%'
  },
  vialCounter: {
    fontSize: '7px',
    fontWeight: 'bold',
    color: '#64748b',
    flexShrink: 0
  },
  actionPrintIconBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    transition: 'background-color 0.15s'
  },
  emptyAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px'
  }
};

export default SampleBarcodeLabel;