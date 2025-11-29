// ===== 4b-DATA INTEGRATOR BRIDGE - KOMPLETNY PLIK =====
// Version: 6.5 FIXED
// Łączy ReportDetector z UltraDataIntegrator

var DataIntegrator = {
  
  integrate: function(validatedReports) {
    const logger = new LukoLogger();
    const integrator = new UltraDataIntegrator(logger);
    
    // Walidacja danych wejściowych
    if (!validatedReports || !Array.isArray(validatedReports)) {
      logger.log('ERROR: Invalid reports data structure', 'ERROR');
      return {
        campaigns: [],
        keywords: [],
        searchTerms: [],
        totals: {
          impressions: 0,
          clicks: 0,
          spend: 0,
          sales: 0,
          orders: 0,
          acos: 0,
          roas: 0
        }
      };
    }
    
    // Upewnij się że każdy raport ma dane
    validatedReports.forEach(report => {
      if (!report.data) {
        if (report.validation && report.validation.data) {
          report.data = report.validation.data;
        } else if (report.sheet) {
          try {
            report.data = report.sheet.getDataRange().getValues();
          } catch (e) {
            logger.log(`Failed to get data from sheet: ${e.toString()}`, 'ERROR');
          }
        }
      }
    });
    
    // Wywołaj właściwą metodę integratora
    return integrator.integrateData(validatedReports);
  }
};

// Wrapper dla AnomalyDetector
var AnomalyDetectorWrapper = {
  
  detect: function(integratedData) {
    const detector = new AnomalyDetector();
    return detector.detectAnomalies(integratedData);
  }
};

// Ujednolicony Logger dla wszystkich modułów
if (typeof Logger === 'undefined') {
  class Logger {
    constructor() {
      this.logs = [];
    }
    
    log(message, level) {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level || 'INFO'}] ${message}`;
      
      this.logs.push(logEntry);
      console.log(logEntry);
      
      // Zapisz do arkusza debug
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName('LUKO_Debug_Log');
        if (!sheet) {
          sheet = ss.insertSheet('LUKO_Debug_Log');
          sheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Level', 'Message', 'Module']]);
        }
        sheet.appendRow([new Date(), level || 'INFO', message, 'System']);
      } catch (e) {
        // Cichy błąd - nie przerywaj działania
      }
    }
    
    getLogs() {
      return this.logs;
    }
    
    clearLogs() {
      this.logs = [];
    }
  }
}