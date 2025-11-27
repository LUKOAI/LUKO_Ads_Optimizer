/**
 * BULK VALIDATOR - Walidacja danych przed eksportem
 * Sprawdza poprawność i kompletność zmian
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkValidator = {
  
  /**
   * Główna funkcja walidacji
   */
  runValidation() {
    Logger.log('=== BULK VALIDATOR START ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet || sheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('❌ Brak danych do walidacji');
      return false;
    }
    
    const validationResults = {
      errors: [],
      warnings: [],
      info: [],
      stats: {
        totalRows: 0,
        modifiedRows: 0,
        validRows: 0,
        errorRows: 0
      }
    };
    
    // Pobierz dane
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Identyfikuj kolumny
    const columns = this.identifyColumns(headers);
    
    // Waliduj każdy wiersz
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      
      validationResults.stats.totalRows++;
      
      // Sprawdź czy wiersz był modyfikowany
      const wasModified = this.checkIfModified(row, columns);
      if (wasModified) {
        validationResults.stats.modifiedRows++;
      }
      
      // Walidacja wiersza
      const rowValidation = this.validateRow(row, columns, rowNum);
      
      if (rowValidation.errors.length > 0) {
        validationResults.errors.push(...rowValidation.errors);
        validationResults.stats.errorRows++;
      } else {
        validationResults.stats.validRows++;
      }
      
      if (rowValidation.warnings.length > 0) {
        validationResults.warnings.push(...rowValidation.warnings);
      }
    }
    
    // Walidacja specyficzna dla typu raportu
    const reportType = PropertiesService.getScriptProperties().getProperty('BULK_REPORT_TYPE');
    this.validateReportSpecific(data, columns, reportType, validationResults);
    
    // Sprawdź duplikaty
    this.checkDuplicates(data, columns, validationResults);
    
    // Walidacja zakresów
    this.validateRanges(data, columns, validationResults);
    
    // Pokaż raport walidacji
    this.showValidationReport(validationResults);
    
    // Zapisz wyniki
    this.saveValidationResults(validationResults);
    
    return validationResults.errors.length === 0;
  },
  
  /**
   * Identyfikacja kolumn
   */
  identifyColumns(headers) {
    const columns = {};
    
    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      
      // Podstawowe kolumny
      if (h.includes('product')) columns.product = index;
      else if (h.includes('entity')) columns.entity = index;
      else if (h.includes('operation')) columns.operation = index;
      else if (h.includes('campaign id')) columns.campaignId = index;
      else if (h.includes('ad group id')) columns.adGroupId = index;
      else if (h.includes('keyword id')) columns.keywordId = index;
      else if (h.includes('campaign name')) columns.campaignName = index;
      else if (h.includes('ad group name')) columns.adGroupName = index;
      else if (h.includes('state')) columns.state = index;
      else if (h.includes('status')) columns.status = index;
      else if (h.includes('bid')) columns.bid = index;
      else if (h.includes('daily budget')) columns.budget = index;
      else if (h.includes('keyword text')) columns.keywordText = index;
      else if (h.includes('match type')) columns.matchType = index;
      
      // Kolumny analityczne
      if (h.includes('apply change')) columns.applyChange = index;
      if (h.includes('recommendation')) columns.recommendation = index;
      if (h.includes('% change')) columns.percentChange = index;
    });
    
    return columns;
  },
  
  /**
   * Sprawdzenie czy wiersz był modyfikowany
   */
  checkIfModified(row, columns) {
    // Sprawdź checkbox "Apply Change"
    if (columns.applyChange !== undefined) {
      return row[columns.applyChange] === true;
    }
    
    // Sprawdź czy jest wypełniona kolumna "% Change"
    if (columns.percentChange !== undefined && row[columns.percentChange]) {
      return true;
    }
    
    return false;
  },
  
  /**
   * Walidacja pojedynczego wiersza
   */
  validateRow(row, columns, rowNum) {
    const errors = [];
    const warnings = [];
    
    // Sprawdź wymagane ID dla update
    if (columns.operation !== undefined && row[columns.operation] === 'update') {
      if (!row[columns.campaignId]) {
        errors.push(`Wiersz ${rowNum}: Brak Campaign ID dla operacji update`);
      }
      
      if (columns.entity !== undefined) {
        const entity = row[columns.entity];
        
        if (entity === 'Ad Group' && !row[columns.adGroupId]) {
          errors.push(`Wiersz ${rowNum}: Brak Ad Group ID dla Ad Group`);
        }
        
        if (entity === 'Keyword' && !row[columns.keywordId]) {
          errors.push(`Wiersz ${rowNum}: Brak Keyword ID dla Keyword`);
        }
      }
    }
    
    // Walidacja stawek
    if (columns.bid !== undefined && row[columns.bid]) {
      const bid = parseFloat(row[columns.bid]);
      
      if (isNaN(bid)) {
        errors.push(`Wiersz ${rowNum}: Nieprawidłowa wartość stawki`);
      } else if (bid < 0.02) {
        errors.push(`Wiersz ${rowNum}: Stawka ${bid} poniżej minimum (0.02)`);
      } else if (bid > 100) {
        warnings.push(`Wiersz ${rowNum}: Stawka ${bid} bardzo wysoka (>100)`);
      }
    }
    
    // Walidacja budżetu
    if (columns.budget !== undefined && row[columns.budget]) {
      const budget = parseFloat(row[columns.budget]);
      
      if (isNaN(budget)) {
        errors.push(`Wiersz ${rowNum}: Nieprawidłowa wartość budżetu`);
      } else if (budget < 1) {
        errors.push(`Wiersz ${rowNum}: Budżet ${budget} poniżej minimum (1)`);
      } else if (budget > 1000000) {
        warnings.push(`Wiersz ${rowNum}: Budżet ${budget} bardzo wysoki`);
      }
    }
    
    // Walidacja stanu
    if (columns.state !== undefined && row[columns.state]) {
      const validStates = ['enabled', 'paused', 'archived'];
      if (!validStates.includes(row[columns.state].toLowerCase())) {
        errors.push(`Wiersz ${rowNum}: Nieprawidłowy stan: ${row[columns.state]}`);
      }
    }
    
    // Walidacja Match Type
    if (columns.matchType !== undefined && row[columns.matchType]) {
      const validTypes = ['exact', 'phrase', 'broad', 'negative exact', 'negative phrase'];
      if (!validTypes.includes(row[columns.matchType].toLowerCase())) {
        warnings.push(`Wiersz ${rowNum}: Nieprawidłowy match type: ${row[columns.matchType]}`);
      }
    }
    
    return { errors, warnings };
  },
  
  /**
   * Walidacja specyficzna dla typu raportu
   */
  validateReportSpecific(data, columns, reportType, results) {
    switch(reportType) {
      case 'SP_CAMPAIGNS':
        // Sprawdź targeting type
        if (columns.targetingType !== undefined) {
          for (let i = 1; i < data.length; i++) {
            const targetingType = data[i][columns.targetingType];
            if (targetingType && !['manual', 'auto'].includes(targetingType.toLowerCase())) {
              results.warnings.push(`Wiersz ${i+1}: Nieznany targeting type: ${targetingType}`);
            }
          }
        }
        break;
        
      case 'SB_CAMPAIGNS':
        // Sprawdź brand entity ID
        if (columns.brandEntityId !== undefined) {
          for (let i = 1; i < data.length; i++) {
            if (!data[i][columns.brandEntityId] && data[i][columns.operation] === 'create') {
              results.errors.push(`Wiersz ${i+1}: Brak Brand Entity ID dla nowej kampanii SB`);
            }
          }
        }
        break;
    }
  },
  
  /**
   * Sprawdzanie duplikatów
   */
  checkDuplicates(data, columns, results) {
    const seen = new Map();
    
    for (let i = 1; i < data.length; i++) {
      let key = '';
      
      // Twórz klucz na podstawie ID
      if (columns.campaignId !== undefined) {
        key += data[i][columns.campaignId] || '';
      }
      if (columns.adGroupId !== undefined) {
        key += '_' + (data[i][columns.adGroupId] || '');
      }
      if (columns.keywordId !== undefined) {
        key += '_' + (data[i][columns.keywordId] || '');
      }
      
      if (key && key !== '__') {
        if (seen.has(key)) {
          results.warnings.push(
            `Duplikat: Wiersze ${seen.get(key)} i ${i+1} mają te same ID`
          );
        } else {
          seen.set(key, i + 1);
        }
      }
    }
  },
  
  /**
   * Walidacja zakresów wartości
   */
  validateRanges(data, columns, results) {
    let totalBudget = 0;
    let maxBid = 0;
    let minBid = Infinity;
    
    for (let i = 1; i < data.length; i++) {
      if (columns.budget !== undefined) {
        totalBudget += parseFloat(data[i][columns.budget]) || 0;
      }
      
      if (columns.bid !== undefined && data[i][columns.bid]) {
        const bid = parseFloat(data[i][columns.bid]);
        if (!isNaN(bid)) {
          maxBid = Math.max(maxBid, bid);
          minBid = Math.min(minBid, bid);
        }
      }
    }
    
    if (totalBudget > 10000) {
      results.warnings.push(`⚠️ Całkowity budżet: €${totalBudget.toFixed(2)} - bardzo wysoki!`);
    }
    
    if (maxBid > 10) {
      results.warnings.push(`⚠️ Najwyższa stawka: €${maxBid.toFixed(2)} - sprawdź czy to zamierzone`);
    }
    
    results.info.push(`📊 Zakres stawek: €${minBid.toFixed(2)} - €${maxBid.toFixed(2)}`);
    results.info.push(`💰 Łączny budżet: €${totalBudget.toFixed(2)}`);
  },
  
  /**
   * Pokaż raport walidacji
   */
  showValidationReport(results) {
    const ui = SpreadsheetApp.getUi();
    
    let message = '📋 RAPORT WALIDACJI\n';
    message += '═══════════════════════\n\n';
    
    message += `📊 STATYSTYKI:\n`;
    message += `• Wszystkich wierszy: ${results.stats.totalRows}\n`;
    message += `• Zmodyfikowanych: ${results.stats.modifiedRows}\n`;
    message += `• Poprawnych: ${results.stats.validRows}\n`;
    message += `• Z błędami: ${results.stats.errorRows}\n\n`;
    
    if (results.errors.length > 0) {
      message += `❌ BŁĘDY (${results.errors.length}):\n`;
      results.errors.slice(0, 5).forEach(error => {
        message += `• ${error}\n`;
      });
      if (results.errors.length > 5) {
        message += `... i ${results.errors.length - 5} więcej\n`;
      }
      message += '\n';
    }
    
    if (results.warnings.length > 0) {
      message += `⚠️ OSTRZEŻENIA (${results.warnings.length}):\n`;
      results.warnings.slice(0, 3).forEach(warning => {
        message += `• ${warning}\n`;
      });
      if (results.warnings.length > 3) {
        message += `... i ${results.warnings.length - 3} więcej\n`;
      }
      message += '\n';
    }
    
    if (results.info.length > 0) {
      message += `ℹ️ INFORMACJE:\n`;
      results.info.forEach(info => {
        message += `• ${info}\n`;
      });
    }
    
    const title = results.errors.length > 0 ? 
      '❌ Walidacja nieudana' : 
      '✅ Walidacja pomyślna';
    
    if (results.errors.length > 0) {
      ui.alert(title, message, ui.ButtonSet.OK);
    } else {
      const result = ui.alert(
        title,
        message + '\n\nCzy chcesz przejść do eksportu?',
        ui.ButtonSet.YES_NO
      );
      
      if (result === ui.Button.YES) {
        BulkExporter.exportToAmazon();
      }
    }
  },
  
  /**
   * Zapisz wyniki walidacji
   */
  saveValidationResults(results) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let validationSheet = ss.getSheetByName('BULK_Validation');
    
    if (!validationSheet) {
      validationSheet = ss.insertSheet('BULK_Validation');
    } else {
      validationSheet.clear();
    }
    
    // Nagłówki
    validationSheet.getRange(1, 1, 1, 3).setValues([
      ['Type', 'Count', 'Details']
    ]);
    
    let row = 2;
    
    // Statystyki
    validationSheet.getRange(row, 1, 1, 3).setValues([
      ['STATISTICS', '', JSON.stringify(results.stats)]
    ]);
    row++;
    
    // Błędy
    if (results.errors.length > 0) {
      results.errors.forEach(error => {
        validationSheet.getRange(row, 1, 1, 3).setValues([
          ['ERROR', '', error]
        ]);
        validationSheet.getRange(row, 1, 1, 3).setBackground('#ffcccc');
        row++;
      });
    }
    
    // Ostrzeżenia
    if (results.warnings.length > 0) {
      results.warnings.forEach(warning => {
        validationSheet.getRange(row, 1, 1, 3).setValues([
          ['WARNING', '', warning]
        ]);
        validationSheet.getRange(row, 1, 1, 3).setBackground('#ffe6cc');
        row++;
      });
    }
    
    // Informacje
    if (results.info.length > 0) {
      results.info.forEach(info => {
        validationSheet.getRange(row, 1, 1, 3).setValues([
          ['INFO', '', info]
        ]);
        validationSheet.getRange(row, 1, 1, 3).setBackground('#e6f3ff');
        row++;
      });
    }
    
    // Timestamp
    validationSheet.getRange(row + 1, 1, 1, 3).setValues([
      ['Validated at:', new Date().toLocaleString(), '']
    ]);
  }
};