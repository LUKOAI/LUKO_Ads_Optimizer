// ===== 17-BULKEXPORTER.GS - FINALNY EKSPORT DO AMAZON =====
// Version: 6.5 - POPRAWIONE MAPOWANIE KOLUMN + TYLKO DONE
// Generuje plik BULK gotowy do wgrania do Amazon

class BulkExporter {
  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.logger = new LukoLogger();
  }
  
  /**
   * GŁÓWNA FUNKCJA - EKSPORT POŁĄCZONYCH ZMIAN
   */
  exportCombined(format, marketplace) {
    try {
      this.logger.log(`=== EKSPORT DO AMAZON ${marketplace} ===`, 'INFO');
      
      // 1. Zbierz wszystkie zmiany
      const allChanges = this.collectAllChanges();
      
      if (allChanges.rows.length === 0) {
        throw new Error('Brak zmian ze statusem DONE do eksportu. Wykonaj najpierw operacje w BULK Builder.');
      }
      
      // 2. Walidacja marketplace
      this.validateMarketplace(allChanges, marketplace);
      
      // 3. Przygotuj dane do eksportu
      const exportData = this.prepareExportData(allChanges);
      
      // 4. Eksportuj według wybranego formatu
      let result;
      
      if (format === 'sheet') {
        result = this.exportToSheet(exportData, marketplace);
      } else {
        result = this.exportToNewSpreadsheet(exportData, marketplace);
      }
      
      // 5. Alert z URL
      const ui = SpreadsheetApp.getUi();
      if (result.format === 'new') {
        ui.alert(`✅ Eksport zakończony\n\n${result.stats.total} zmian\n\n${result.newSpreadsheetUrl}`);
        
        const html = `<script>window.open('${result.newSpreadsheetUrl}');google.script.host.close();</script>`;
        ui.showModalDialog(
          HtmlService.createHtmlOutput(html).setWidth(1).setHeight(1),
          'Otwieranie...'
        );
      } else {
        ui.alert(`✅ Eksport zakończony\n\n${result.stats.total} zmian w arkuszu ${result.sheetName}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.log(`BŁĄD EKSPORTU: ${error.toString()}`, 'ERROR');
      throw error;
    }
  }
  
  /**
   * Zbierz wszystkie zmiany - TYLKO z DONE
   * KLUCZOWA ZMIANA: Eksportuj TYLKO wiersze ze statusem DONE
   */
  collectAllChanges() {
    const builderSheet = this.ss.getSheetByName('BULK_Builder');
    
    if (!builderSheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }
    
    const data = builderSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Mapuj kolumny
    const cols = this.mapColumns(headers);
    
    // POPRAWKA 1: Znajdź kolumnę ChangesDONE - szukaj różnych wariantów nazwy
    let changesDoneCol = -1;
    headers.forEach((h, i) => {
      const headerLower = h.toString().toLowerCase();
      if (headerLower === 'changesdone' || 
          headerLower === 'changes done' || 
          headerLower === 'change' ||
          headerLower === 'changes_done' ||
          headerLower === 'status done') {
        changesDoneCol = i;
      }
    });
    
    if (changesDoneCol === -1) {
      throw new Error('Brak kolumny ChangesDONE - uruchom najpierw operacje zmian');
    }
    
    // DEBUG - wyświetl nagłówki
    this.logger.log(`=== NAGŁÓWKI (${headers.length} kolumn) ===`, 'DEBUG');
    this.logger.log(`Kolumna ChangesDONE znaleziona na pozycji: ${changesDoneCol}`, 'DEBUG');
    
    // DEBUG - pokaż co znalazło
    this.logger.log(`=== ZMAPOWANE KOLUMNY ===`, 'DEBUG');
    this.logger.log(`Action column: ${cols.action}`, 'DEBUG');
    this.logger.log(`Entity column: ${cols.entity}`, 'DEBUG');
    this.logger.log(`ChangesDone column: ${changesDoneCol}`, 'DEBUG');
    
    // Znajdź gdzie kończą się kolumny Amazon (BEZ EMOJI!)
    let amazonColsEnd = headers.length;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toString().toLowerCase();
      if (header === 'apply' || header === 'action' || header === 'reason' || 
          header === 'percentvalue' || header === 'confidence' || 
          header === 'source' || header === 'status' || 
          header === 'changesdone' || header === 'changes done') {
        amazonColsEnd = i;
        break;
      }
    }
    
    this.logger.log(`Amazon columns end at: ${amazonColsEnd}`, 'DEBUG');
    
    const amazonHeaders = headers.slice(0, amazonColsEnd);
    
    const changes = {
      headers: amazonHeaders,
      rows: [],
      stats: {
        total: 0,
        paused: 0,
        bidIncreased: 0,
        bidDecreased: 0,
        activated: 0,
        skippedProductAds: 0,
        negatives: 0,
        skippedNoDone: 0
      }
    };
    
    // Lista dozwolonych akcji
    const exportableActions = ['PAUSE', 'INCREASE_BID', 'DECREASE_BID', 'ADD_NEGATIVE', 'ACTIVATE', 
                              'BUDGET_INCREASE', 'BUDGET_DECREASE', 'BUDGET_CHANGE', 'ENABLE'];
    
    // DEBUG - sprawdź pierwsze 10 wierszy
    this.logger.log(`=== SZUKAM WIERSZY ZE STATUSEM DONE ===`, 'DEBUG');
    
    // POPRAWKA 2: GŁÓWNA LOGIKA - TYLKO wiersze z DONE
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const changesDone = changesDoneCol >= 0 ? row[changesDoneCol] : '';
      const entity = cols.entity !== undefined ? row[cols.entity] : null;
      const action = cols.action !== undefined ? row[cols.action] : null;
      
      // DEBUG tylko dla pierwszych 10 wierszy
      if (i <= 10) {
        this.logger.log(`Wiersz ${i}: ChangesDONE="${changesDone}", Action="${action}", Entity="${entity}"`, 'DEBUG');
      }
      
      // KLUCZOWA ZMIANA: Eksportuj TYLKO jeśli ma akcję I status DONE
      if (exportableActions.includes(action) && changesDone === 'DONE') {
        
        // Walidacja - Product Ad nie może mieć zmian bid
        if (entity === 'Product Ad' && action && action.includes('BID')) {
          this.logger.log(`Pominięto Product Ad z bid change (wiersz ${i+1})`, 'WARNING');
          changes.stats.skippedProductAds++;
          continue;
        }
        
        // Przygotuj wiersz do eksportu
        const exportRow = [];
        for (let j = 0; j < amazonColsEnd; j++) {
          exportRow.push(row[j]);
        }
        
        // Ustaw Operation na "update"
        if (cols.operation >= 0 && cols.operation < amazonColsEnd) {
          exportRow[cols.operation] = 'update';
        }
        
        // Policz statystyki
        this.updateStats(action, entity, changes.stats);
        
        changes.rows.push({
          data: exportRow,
          action: action,
          entity: entity,
          originalRow: i + 1
        });
        
        changes.stats.total++;
        
        // DEBUG
        this.logger.log(`✅ DODANO wiersz ${i+1} ze statusem DONE: ${action} - ${entity}`, 'SUCCESS');
        
      } else if (exportableActions.includes(action) && changesDone !== 'DONE') {
        // Licznik pominiętych wierszy bez DONE
        changes.stats.skippedNoDone++;
        if (i <= 10) {
          this.logger.log(`⚠️ POMINIĘTO wiersz ${i+1} - ma akcję ${action} ale brak statusu DONE`, 'WARNING');
        }
      }
    }
    
    this.logger.log(`=== PODSUMOWANIE ===`, 'DEBUG');
    this.logger.log(`Znaleziono ${changes.stats.total} zmian z DONE do eksportu`, changes.stats.total > 0 ? 'SUCCESS' : 'WARNING');
    this.logger.log(`Pominięto ${changes.stats.skippedNoDone} wierszy bez statusu DONE`, 'INFO');
    this.logger.log(`Pominięto ${changes.stats.skippedProductAds} Product Ads z bid changes`, 'INFO');
    
    return changes;
  }
  
  /**
   * Aktualizuj statystyki
   */
  updateStats(action, entity, stats) {
    switch(action) {
      case 'PAUSE':
        stats.paused++;
        break;
      case 'INCREASE_BID':
        if (entity === 'Keyword' || entity === 'Product Targeting') {
          stats.bidIncreased++;
        }
        break;
      case 'DECREASE_BID':
        if (entity === 'Keyword' || entity === 'Product Targeting') {
          stats.bidDecreased++;
        }
        break;
      case 'ACTIVATE':
      case 'ENABLE':
        stats.activated++;
        break;
      case 'ADD_NEGATIVE':
        stats.negatives++;
        break;
      case 'BUDGET_INCREASE':
      case 'BUDGET_DECREASE':
      case 'BUDGET_CHANGE':
        if (!stats.budgetChanges) stats.budgetChanges = 0;
        stats.budgetChanges++;
        break;
    }
  }
  
  /**
   * Walidacja marketplace
   */
  validateMarketplace(changes, marketplace) {
    this.logger.log(`Walidacja dla marketplace: ${marketplace}`, 'INFO');
    
    // Tu można dodać dodatkową walidację specyficzną dla marketplace
    if (marketplace === 'DE') {
      // Sprawdź format liczb niemieckich
      this.logger.log(`Marketplace DE - sprawdzam format liczb`, 'DEBUG');
    }
  }
  
  /**
   * Przygotuj dane do eksportu
   */
  prepareExportData(changes) {
    return {
      headers: changes.headers,
      rows: changes.rows.map(r => r.data),
      stats: changes.stats
    };
  }
  
  /**
   * Eksport do nowej karty w tym arkuszu
   */
  exportToSheet(exportData, marketplace) {
    const timestamp = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd_HH-mm');
    const sheetName = `BULK_Export_${marketplace}_${timestamp}`;
    
    let exportSheet = this.ss.getSheetByName(sheetName);
    if (exportSheet) {
      this.ss.deleteSheet(exportSheet);
    }
    
    exportSheet = this.ss.insertSheet(sheetName);
    
    // Nagłówki
    exportSheet.getRange(1, 1, 1, exportData.headers.length)
      .setValues([exportData.headers])
      .setBackground('#34a853')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    
    // Dane
    if (exportData.rows.length > 0) {
      exportSheet.getRange(2, 1, exportData.rows.length, exportData.headers.length)
        .setValues(exportData.rows);
      
      this.setNumberFormats(exportSheet, exportData.headers, exportData.rows.length);
    }
    
    // Auto-resize
    exportSheet.autoResizeColumns(1, exportData.headers.length);
    
    // Zaznacz arkusz
    this.ss.setActiveSheet(exportSheet);
    
    return {
      success: true,
      sheetName: sheetName,
      stats: exportData.stats,
      format: 'sheet'
    };
  }
  
  /**
   * Eksport do nowego arkusza Google Sheets
   */
  exportToNewSpreadsheet(exportData, marketplace) {
    const timestamp = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd_HH-mm');
    const fileName = `Amazon_BULK_${marketplace}_${timestamp}`;
    
    // Utwórz nowy arkusz
    const newSpreadsheet = SpreadsheetApp.create(fileName);
    const newSheet = newSpreadsheet.getActiveSheet();
    newSheet.setName('BULK_Export');
    
    // Nagłówki
    newSheet.getRange(1, 1, 1, exportData.headers.length)
      .setValues([exportData.headers])
      .setBackground('#34a853')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    
    // Dane
    if (exportData.rows.length > 0) {
      newSheet.getRange(2, 1, exportData.rows.length, exportData.headers.length)
        .setValues(exportData.rows);
      
      this.setNumberFormats(newSheet, exportData.headers, exportData.rows.length);
    }
    
    // Auto-resize
    newSheet.autoResizeColumns(1, exportData.headers.length);
    
    // Usuń dodatkowe arkusze
    const allSheets = newSpreadsheet.getSheets();
    for (let i = 1; i < allSheets.length; i++) {
      newSpreadsheet.deleteSheet(allSheets[i]);
    }
    
    const newUrl = newSpreadsheet.getUrl();
    
    // Dodaj podsumowanie
    this.addSummaryToSheet(newSheet, exportData.stats);
    
    return {
      success: true,
      fileName: fileName,
      newSpreadsheetUrl: newUrl,
      stats: exportData.stats,
      format: 'new'
    };
  }
  
  /**
   * Dodaj podsumowanie do arkusza
   */
  addSummaryToSheet(sheet, stats) {
    const lastRow = sheet.getLastRow();
    const summaryRow = lastRow + 3;
    
    const summary = [
      ['=== PODSUMOWANIE EKSPORTU ==='],
      [`Łącznie zmian: ${stats.total}`],
      [`Pauzowanych: ${stats.paused || 0}`],
      [`Bid zwiększonych: ${stats.bidIncreased || 0}`],
      [`Bid zmniejszonych: ${stats.bidDecreased || 0}`],
      [`Aktywowanych: ${stats.activated || 0}`],
      [`Negatywów: ${stats.negatives || 0}`],
      [`Zmian budżetu: ${stats.budgetChanges || 0}`]
    ];
    
    sheet.getRange(summaryRow, 1, summary.length, 1)
      .setValues(summary)
      .setFontWeight('bold')
      .setBackground('#f0f0f0');
  }
  
  /**
   * Ustaw format tekstowy dla kolumn numerycznych
   * POPRAWKA: Napraw problem z datami interpretowanymi jako liczby
   */
  setNumberFormats(sheet, headers, numRows) {
    const budgetCol = headers.indexOf('Daily Budget') + 1;
    const bidCol = headers.indexOf('Bid') + 1;
    
    // Wymusz format tekstowy przed eksportem - POPRAWIONE
    if (budgetCol > 0) {
      const range = sheet.getRange(2, budgetCol, numRows, 1);
      range.setNumberFormat('@STRING@');
      
      // Dodatkowo sprawdź wartości
      const values = range.getValues();
      const fixed = values.map(row => {
        const val = row[0];
        if (typeof val === 'object' && val instanceof Date) {
          // To jest data - napraw na liczbę
          return [val.getDate() + '.00'];
        }
        return [String(val)];
      });
      range.setValues(fixed);
    }
    
    // Wymusz format tekstowy dla Bid - RÓWNIEŻ POPRAWIONE
    if (bidCol > 0) {
      const range = sheet.getRange(2, bidCol, numRows, 1);
      range.setNumberFormat('@STRING@');
      
      // Dodatkowo sprawdź wartości
      const values = range.getValues();
      const fixed = values.map(row => {
        const val = row[0];
        if (typeof val === 'object' && val instanceof Date) {
          // To jest data - napraw na liczbę
          return [val.getDate() + '.00'];
        }
        return [String(val)];
      });
      range.setValues(fixed);
    }
    
    // Format dla innych kolumn numerycznych
    headers.forEach((header, index) => {
      const h = header.toString().toLowerCase();
      if (h.includes('spend') || h.includes('sales') || h.includes('cpc') || 
          h.includes('cost') || h.includes('budget') || h.includes('percentage') ||
          h.includes('ausgaben') || h.includes('verkäufe') || h.includes('wydatki')) {
        
        const colIndex = index + 1;
        const range = sheet.getRange(2, colIndex, numRows, 1);
        range.setNumberFormat('@STRING@');
        
        // Również sprawdź te kolumny na obecność dat
        const values = range.getValues();
        const fixed = values.map(row => {
          const val = row[0];
          if (typeof val === 'object' && val instanceof Date) {
            // To jest data - napraw na liczbę
            return [val.getDate() + '.00'];
          }
          return [String(val)];
        });
        range.setValues(fixed);
      }
    });
  }
  
  /**
   * Mapuj kolumny - POPRAWIONE
   */
  mapColumns(headers) {
    const cols = {};
    
    headers.forEach((header, index) => {
      const h = header.toString().toLowerCase();
      
      // Emoji/dodatkowe kolumny
      if (h === 'apply' || h.includes('✅ apply')) cols.apply = index;
      if (h === 'action' || h.includes('💡 action')) cols.action = index;
      if (h === 'reason' || h.includes('📝 reason')) cols.reason = index;
      if (h === 'percentvalue' || h.includes('% change')) cols.percentValue = index;
      if (h === 'confidence' || h.includes('🎯 confidence')) cols.confidence = index;
      if (h === 'source' || h.includes('📊 source')) cols.source = index;
      if (h === 'status' || h.includes('📌 status')) cols.status = index;
      if (h === 'changesdone' || h === 'changes done' || h === 'change') cols.changesDone = index;
      
      // Podstawowe kolumny Amazon
      if (h.includes('entity')) cols.entity = index;
      if (h.includes('operation')) cols.operation = index;
      if (h.includes('state') && !h.includes('campaign') && !h.includes('ad group')) {
        cols.state = index;
      }
      
      // Bid
      if (h === 'bid' || (h.includes('bid') && !h.includes('strategy') && 
          !h.includes('default') && !h.includes('optimization') && 
          !h.includes('multiplier') && !h.includes('adjustment'))) {
        cols.bid = index;
      }
      
      // ID kolumny
      if (h.includes('campaign') && h.includes('id')) cols.campaignId = index;
      if (h.includes('ad group') && h.includes('id')) cols.adGroupId = index;
      if (h.includes('keyword') && h.includes('id')) cols.keywordId = index;
      if (h.includes('product targeting') && h.includes('id')) cols.productTargetingId = index;
      
      // Budżety
      if (h.includes('daily budget')) cols.dailyBudget = index;
      if (h === 'budget') cols.budget = index;
      
      // Nazwy
      if (h.includes('campaign name') && !h.includes('informational')) cols.campaignName = index;
      if (h.includes('ad group name') && !h.includes('informational')) cols.adGroupName = index;
    });
    
    return cols;
  }
}

// ===== KLASA POMOCNICZA - STATYSTYKI =====
class BulkStats {
  show() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet) {
      SpreadsheetApp.getUi().alert('Brak danych do analizy');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Znajdź kolumny
    const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));
    const actionCol = headers.findIndex(h => h.toString().toLowerCase() === 'action');
    const applyCol = headers.findIndex(h => h.toString().toLowerCase() === 'apply');
    const sourceCol = headers.findIndex(h => h.toString().toLowerCase() === 'source');
    const changesDoneCol = headers.findIndex(h => {
      const lower = h.toString().toLowerCase();
      return lower === 'changesdone' || lower === 'changes done' || lower === 'change';
    });
    
    // Zlicz statystyki
    const stats = {
      total: data.length - 1,
      byEntity: {},
      byAction: {},
      bySource: {},
      marked: 0,
      withChanges: 0,
      withDone: 0,
      readyToExport: 0
    };
    
    const exportableActions = ['PAUSE', 'INCREASE_BID', 'DECREASE_BID', 'ADD_NEGATIVE', 
                              'ACTIVATE', 'ENABLE', 'BUDGET_INCREASE', 'BUDGET_DECREASE', 'BUDGET_CHANGE'];
    
    for (let i = 1; i < data.length; i++) {
      const entity = data[i][entityCol] || 'Unknown';
      const action = data[i][actionCol] || 'None';
      const source = data[i][sourceCol] || 'Unknown';
      const apply = data[i][applyCol];
      const done = changesDoneCol >= 0 ? data[i][changesDoneCol] : '';
      
      stats.byEntity[entity] = (stats.byEntity[entity] || 0) + 1;
      stats.byAction[action] = (stats.byAction[action] || 0) + 1;
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;
      
      if (apply) stats.marked++;
      
      if (exportableActions.includes(action)) {
        stats.withChanges++;
      }
      
      if (done === 'DONE') {
        stats.withDone++;
        
        // Tylko ze statusem DONE i akcją będą eksportowane
        if (exportableActions.includes(action)) {
          stats.readyToExport++;
        }
      }
    }
    
    // Przygotuj wiadomość
    let message = `📊 STATYSTYKI BULK\n\n`;
    message += `📋 PODSUMOWANIE:\n`;
    message += `• Łącznie targetów: ${stats.total}\n`;
    message += `• Ze zmianami (akcja): ${stats.withChanges}\n`;
    message += `• Ze statusem DONE: ${stats.withDone}\n`;
    message += `• Gotowych do eksportu: ${stats.readyToExport} ⭐\n`;
    message += `• Zaznaczonych checkboxów: ${stats.marked}\n\n`;
    
    message += `🎯 PO TYPACH:\n`;
    Object.entries(stats.byEntity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([entity, count]) => {
        const percent = ((count / stats.total) * 100).toFixed(1);
        message += `• ${entity}: ${count} (${percent}%)\n`;
      });
    
    message += `\n💡 PO AKCJACH:\n`;
    Object.entries(stats.byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .forEach(([action, count]) => {
        const percent = ((count / stats.total) * 100).toFixed(1);
        const isDone = exportableActions.includes(action) ? ' ✅' : '';
        message += `• ${action}: ${count} (${percent}%)${isDone}\n`;
      });
    
    if (stats.readyToExport === 0) {
      message += `\n⚠️ UWAGA: Brak wierszy gotowych do eksportu!\n`;
      message += `Wykonaj najpierw operacje zmian (np. zmień stawki).`;
    }
    
    SpreadsheetApp.getUi().alert('📊 Statystyki BULK', message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ===== FUNKCJE GLOBALNE DLA MENU =====
function exportBulkToNewSpreadsheet() {
  try {
    const exporter = new BulkExporter();
    exporter.exportCombined('new', 'PL');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function exportBulkToNewSheet() {
  try {
    const exporter = new BulkExporter();
    exporter.exportCombined('sheet', 'PL');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function showBulkStats() {
  const stats = new BulkStats();
  stats.show();
}

// Funkcja do eksportu niemieckiego
function exportBulkDE() {
  try {
    const exporter = new BulkExporter();
    exporter.exportCombined('new', 'DE');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}