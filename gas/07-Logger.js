// ===== 07-LOGGER.GS - KOMPLETNY LOGGER =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================

class LukoLogger {
  constructor() {
    this.logs = [];
    this.startTime = new Date();
  }
  
  log(message, level = 'INFO') {
    const timestamp = new Date();
    const entry = {
      timestamp: timestamp,
      level: level,
      message: message,
      timeFromStart: ((timestamp - this.startTime) / 1000).toFixed(2) + 's'
    };
    
    this.logs.push(entry);
    
    // Loguj do konsoli tylko ważne wiadomości (nie DEBUG)
    if (level !== 'DEBUG' || this.isDebugMode()) {
      console.log(`[${entry.timeFromStart}] ${level}: ${message}`);
    }
  }
  
  isDebugMode() {
    try {
      const props = PropertiesService.getScriptProperties();
      return props.getProperty('DEBUG_MODE') === 'true';
    } catch (error) {
      return false;
    }
  }
  
  getLogs() {
    return this.logs;
  }
  
  getLogsSummary() {
    const duration = ((new Date() - this.startTime) / 1000).toFixed(2);
    const logCount = this.logs.length;
    
    return {
      duration: duration + 's',
      totalLogs: logCount,
      errors: this.logs.filter(log => log.level === 'ERROR').length,
      warnings: this.logs.filter(log => log.level === 'WARNING').length,
      success: this.logs.filter(log => log.level === 'SUCCESS').length,
      info: this.logs.filter(log => log.level === 'INFO').length
    };
  }
  
  saveToSheet() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let debugSheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.DEBUG);
      
      if (!debugSheet) {
        debugSheet = ss.insertSheet(LUKO_CONFIG.SHEETS.DEBUG);
      } else {
        debugSheet.clear();
      }
      
      // Nagłówki
      debugSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Level', 'Message', 'Time from Start']]);
      debugSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1a73e8').setFontColor('white');
      
      // Logi
      if (this.logs.length > 0) {
        const logData = this.logs.map(log => [
          log.timestamp.toLocaleString('pl-PL'),
          log.level,
          log.message,
          log.timeFromStart
        ]);
        
        debugSheet.getRange(2, 1, logData.length, 4).setValues(logData);
        
        // Kolorowanie według poziomów
        logData.forEach((logRow, index) => {
          const rowNum = index + 2;
          const level = logRow[1];
          
          if (level === 'ERROR') {
            debugSheet.getRange(rowNum, 1, 1, 4).setBackground('#fce8e6');
          } else if (level === 'WARNING') {
            debugSheet.getRange(rowNum, 1, 1, 4).setBackground('#fce8b2');
          } else if (level === 'SUCCESS') {
            debugSheet.getRange(rowNum, 1, 1, 4).setBackground('#d7f3d0');
          } else if (level === 'DEBUG') {
            debugSheet.getRange(rowNum, 1, 1, 4).setBackground('#f5f5f5');
          }
        });
      }
      
      // Podsumowanie na górze
      const summary = this.getLogsSummary();
      debugSheet.getRange(1, 6).setValue('📊 PODSUMOWANIE LOGÓW');
      debugSheet.getRange(1, 6).setFontWeight('bold').setBackground('#e8f0fe');
      
      debugSheet.getRange(2, 6).setValue(`Czas wykonania: ${summary.duration}`);
      debugSheet.getRange(3, 6).setValue(`Łączne logi: ${summary.totalLogs}`);
      debugSheet.getRange(4, 6).setValue(`Błędy: ${summary.errors}`);
      debugSheet.getRange(5, 6).setValue(`Ostrzeżenia: ${summary.warnings}`);
      debugSheet.getRange(6, 6).setValue(`Sukcesy: ${summary.success}`);
      
      // Formatowanie
      debugSheet.autoResizeColumns(1, 6);
      
      // Ustaw szerokość kolumny Message
      debugSheet.setColumnWidth(3, 500);
      
      this.log('Debug logs saved to sheet', 'INFO');
      
    } catch (error) {
      console.error('Failed to save debug logs:', error);
    }
  }
  
  enableDebugMode() {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('DEBUG_MODE', 'true');
      this.log('Debug mode enabled', 'INFO');
    } catch (error) {
      console.error('Failed to enable debug mode:', error);
    }
  }
  
  disableDebugMode() {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('DEBUG_MODE', 'false');
      this.log('Debug mode disabled', 'INFO');
    } catch (error) {
      console.error('Failed to disable debug mode:', error);
    }
  }
}

// FUNKCJA DIAGNOSTYCZNA - dodaj na końcu pliku 07-Logger.gs
function debugDataParsing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('tu wklejasz raport z amazon');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Brak arkusza z danymi!');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Znajdź kolumny Spend i Sales
  const spendIdx = headers.indexOf('Spend');
  const salesIdx = headers.indexOf('7 Day Total Sales');
  
  Logger.log('=== DEBUG PARSOWANIA DANYCH ===');
  Logger.log(`Kolumna Spend: ${spendIdx}`);
  Logger.log(`Kolumna Sales: ${salesIdx}`);
  
  let totalSpend = 0;
  let totalSales = 0;
  let sampleRows = [];
  
  // Przejdź przez pierwsze 10 wierszy jako przykład
  for (let i = 1; i < Math.min(11, data.length); i++) {
    const spendRaw = data[i][spendIdx];
    const salesRaw = data[i][salesIdx];
    
    Logger.log(`Wiersz ${i}: Spend raw="${spendRaw}" | Sales raw="${salesRaw}"`);
    
    // Parsuj wartości
    const spendParsed = parseEuropeanCurrency(spendRaw);
    const salesParsed = parseEuropeanCurrency(salesRaw);
    
    Logger.log(`Wiersz ${i}: Spend parsed=${spendParsed} | Sales parsed=${salesParsed}`);
    
    sampleRows.push({
      row: i,
      spendRaw: spendRaw,
      spendParsed: spendParsed,
      salesRaw: salesRaw,
      salesParsed: salesParsed
    });
  }
  
  // Zlicz WSZYSTKIE wiersze
  for (let i = 1; i < data.length; i++) {
    totalSpend += parseEuropeanCurrency(data[i][spendIdx]);
    totalSales += parseEuropeanCurrency(data[i][salesIdx]);
  }
  
  const acos = totalSales > 0 ? (totalSpend / totalSales * 100) : 0;
  
  // Pokaż wyniki
  const result = `
ANALIZA DANYCH (${data.length - 1} wierszy):
=====================================
Total Spend: €${totalSpend.toFixed(2)}
Total Sales: €${totalSales.toFixed(2)}
ACOS: ${acos.toFixed(2)}%

PRZYKŁADOWE WIERSZE:
${sampleRows.map(r => 
  `Wiersz ${r.row}: "${r.spendRaw}" → ${r.spendParsed} | "${r.salesRaw}" → ${r.salesParsed}`
).join('\n')}
`;
  
  Logger.log(result);
  SpreadsheetApp.getUi().alert(result);
}

// POPRAWIONA FUNKCJA parsowania walut europejskich
function parseEuropeanCurrency(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  let str = String(value).trim();
  
  // Usuń symbol waluty
  str = str.replace(/[€$]/g, '').trim();
  
  // Obsłuż format europejski: "0,05" → 0.05
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }
  // Format z tysiącami: "1.234,56" → 1234.56
  else if (str.includes('.') && str.includes(',')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Niemiecki format
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Amerykański format
      str = str.replace(/,/g, '');
    }
  }
  
  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}