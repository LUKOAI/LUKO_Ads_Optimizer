/**
 * BULK EXPORTER - Eksport do formatu Amazon
 * Tworzenie pliku gotowego do importu
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkExporter = {
  
  /**
   * Główna funkcja eksportu
   */
  exportToAmazon() {
    Logger.log('=== BULK EXPORTER START ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const builderSheet = ss.getSheetByName('BULK_Builder');
    
    if (!builderSheet || builderSheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('❌ Brak danych do eksportu');
      return;
    }
    
    // Walidacja przed eksportem
    const isValid = BulkValidator.runValidation();
    if (!isValid) {
      const ui = SpreadsheetApp.getUi();
      const result = ui.alert(
        '⚠️ Błędy walidacji',
        'Znaleziono błędy podczas walidacji. Kontynuować mimo to?',
        ui.ButtonSet.YES_NO
      );
      
      if (result !== ui.Button.YES) {
        return;
      }
    }
    
    // Przygotuj dane do eksportu
    const exportData = this.prepareExportData(builderSheet);
    
    // Wybierz format eksportu
    const format = this.selectExportFormat();
    
    if (format === 'GOOGLE_SHEETS') {
      this.exportToGoogleSheets(exportData);
    } else if (format === 'EXCEL_DOWNLOAD') {
      this.prepareExcelDownload(exportData);
    } else if (format === 'CSV') {
      this.exportToCSV(exportData);
    }
  },
  
  /**
   * Przygotowanie danych do eksportu
   */
  prepareExportData(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Znajdź kolumny do usunięcia (analityczne)
    const columnsToRemove = [];
    headers.forEach((header, index) => {
      if (header.toString().includes('🎯') || 
          header.toString().includes('💡') || 
          header.toString().includes('📊') ||
          header.toString().includes('💰') ||
          header.toString().includes('✅')) {
        columnsToRemove.push(index);
      }
    });
    
    // Znajdź kolumnę checkbox
    const checkboxCol = headers.indexOf('✅ Apply Change');
    
    // Filtruj dane - tylko zaznaczone wiersze
    const filteredData = [];
    
    // Zawsze dodaj nagłówki
    const cleanHeaders = headers.filter((_, index) => !columnsToRemove.includes(index));
    filteredData.push(cleanHeaders);
    
    // Dodaj tylko zmienione wiersze
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Sprawdź czy wiersz jest zaznaczony do eksportu
      if (checkboxCol >= 0 && row[checkboxCol] === true) {
        const cleanRow = row.filter((_, index) => !columnsToRemove.includes(index));
        filteredData.push(cleanRow);
      }
    }
    
    // Jeśli nie ma zaznaczonych, weź wszystkie zmodyfikowane
    if (filteredData.length === 1) {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        // Sprawdź czy był jakikolwiek modification
        const hasChange = this.checkForModifications(row, headers);
        
        if (hasChange) {
          const cleanRow = row.filter((_, index) => !columnsToRemove.includes(index));
          filteredData.push(cleanRow);
        }
      }
    }
    
    Logger.log(`Prepared ${filteredData.length - 1} rows for export`);
    
    return filteredData;
  },
  
  /**
   * Sprawdzenie czy wiersz był modyfikowany
   */
  checkForModifications(row, headers) {
    // Sprawdź kolumny które mogą wskazywać na modyfikację
    const stateCol = headers.indexOf('State');
    const bidCol = headers.indexOf('Bid');
    const budgetCol = headers.indexOf('Daily Budget');
    
    // Tu można dodać bardziej zaawansowaną logikę
    // np. porównanie z oryginalnymi wartościami
    
    return true; // Domyślnie eksportuj wszystko
  },
  
  /**
   * Wybór formatu eksportu
   */
  selectExportFormat() {
    const ui = SpreadsheetApp.getUi();
    
    const result = ui.alert(
      '📤 Format eksportu',
      'Wybierz format eksportu:\n\n' +
      '• OK = Nowy arkusz Google Sheets\n' +
      '• Anuluj = Przygotuj do pobrania Excel',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (result === ui.Button.OK) {
      return 'GOOGLE_SHEETS';
    } else {
      return 'EXCEL_DOWNLOAD';
    }
  },
  
  /**
   * Eksport do nowego arkusza Google Sheets
   */
  exportToGoogleSheets(data) {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const fileName = `BULK_Export_${timestamp}`;
    
    // Utwórz nowy arkusz
    const newSpreadsheet = SpreadsheetApp.create(fileName);
    const newSheet = newSpreadsheet.getActiveSheet();
    
    // Wstaw dane
    if (data.length > 0 && data[0].length > 0) {
      newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      
      // Formatowanie
      newSheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
      newSheet.setFrozenRows(1);
      
      // Autosize kolumn
      for (let i = 1; i <= data[0].length; i++) {
        newSheet.autoResizeColumn(i);
      }
    }
    
    // Pobierz URL
    const url = newSpreadsheet.getUrl();
    
    // Zapisz informację o eksporcie
    this.logExport(fileName, url, data.length - 1);
    
    // Pokaż link
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family: Arial; padding: 20px;">
        <h3>✅ Eksport zakończony!</h3>
        <p>Wyeksportowano <strong>${data.length - 1}</strong> wierszy.</p>
        <p>
          <a href="${url}" target="_blank" style="
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            display: inline-block;
            margin: 10px 0;
          ">Otwórz plik eksportu</a>
        </p>
        <h4>Następne kroki:</h4>
        <ol>
          <li>Otwórz plik eksportu</li>
          <li>Pobierz jako Excel (File → Download → Microsoft Excel)</li>
          <li>Wgraj do Amazon Seller Central</li>
          <li>Bulk Operations → Upload spreadsheet</li>
        </ol>
        <hr>
        <small>Plik: ${fileName}</small>
      </div>`
    ).setWidth(500).setHeight(400);
    
    SpreadsheetApp.getUi().showModalDialog(html, '📤 Eksport BULK');
  },
  
  /**
   * Przygotowanie do pobrania Excel
   */
  prepareExcelDownload(data) {
    // Utwórz tymczasowy arkusz w obecnym pliku
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = new Date().toISOString().slice(0, 10);
    const exportSheetName = `EXPORT_${timestamp}`;
    
    // Usuń stary eksport jeśli istnieje
    const oldExport = ss.getSheetByName(exportSheetName);
    if (oldExport) {
      ss.deleteSheet(oldExport);
    }
    
    // Utwórz nowy arkusz
    const exportSheet = ss.insertSheet(exportSheetName);
    
    // Wstaw dane
    if (data.length > 0 && data[0].length > 0) {
      exportSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      
      // Formatowanie
      exportSheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
      exportSheet.setFrozenRows(1);
    }
    
    // Przenieś arkusz na początek
    ss.setActiveSheet(exportSheet);
    ss.moveActiveSheet(1);
    
    // Instrukcje
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '📥 Przygotowano do pobrania',
      `Arkusz "${exportSheetName}" jest gotowy do pobrania.\n\n` +
      'Instrukcja:\n' +
      '1. Przejdź do arkusza EXPORT (pierwszy arkusz)\n' +
      '2. File → Download → Microsoft Excel (.xlsx)\n' +
      '3. Wgraj plik do Amazon Seller Central\n\n' +
      `Wyeksportowano ${data.length - 1} wierszy.`,
      ui.ButtonSet.OK
    );
  },
  
  /**
   * Eksport do CSV
   */
  exportToCSV(data) {
    // Konwersja do CSV
    let csvContent = '';
    
    data.forEach((row, index) => {
      const rowData = row.map(cell => {
        // Escapowanie wartości z przecinkami lub cudzysłowami
        if (cell && cell.toString().includes(',') || cell.toString().includes('"')) {
          return `"${cell.toString().replace(/"/g, '""')}"`;
        }
        return cell || '';
      });
      
      csvContent += rowData.join(',') + '\n';
    });
    
    // Zapisz w arkuszu tekstowym
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let csvSheet = ss.getSheetByName('EXPORT_CSV');
    
    if (!csvSheet) {
      csvSheet = ss.insertSheet('EXPORT_CSV');
    } else {
      csvSheet.clear();
    }
    
    csvSheet.getRange(1, 1).setValue(csvContent);
    
    SpreadsheetApp.getUi().alert(
      '📄 CSV Export',
      'Dane CSV zostały wygenerowane w arkuszu EXPORT_CSV.\n' +
      'Skopiuj zawartość i zapisz jako plik .csv',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  },
  
  /**
   * Logowanie eksportu
   */
  logExport(fileName, url, rowCount) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('BULK_ExportLog');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('BULK_ExportLog');
      logSheet.getRange(1, 1, 1, 5).setValues([
        ['Timestamp', 'File Name', 'URL', 'Rows Exported', 'Status']
      ]);
    }
    
    const lastRow = logSheet.getLastRow() + 1;
    logSheet.getRange(lastRow, 1, 1, 5).setValues([
      [new Date(), fileName, url, rowCount, 'SUCCESS']
    ]);
    
    // Zachowaj tylko ostatnie 50 wpisów
    if (lastRow > 51) {
      logSheet.deleteRow(2);
    }
  },
  
  /**
   * Eksport tylko negatywnych słów
   */
  exportNegatives() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const negativesSheet = ss.getSheetByName('BULK_Negatives');
    
    if (!negativesSheet || negativesSheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('ℹ️ Brak negatywnych słów do eksportu');
      return;
    }
    
    const data = negativesSheet.getDataRange().getValues();
    this.exportToGoogleSheets(data);
  },
  
  /**
   * Tworzenie szablonu importu
   */
  createImportTemplate() {
    const templates = {
      'SP_KEYWORDS': [
        ['Product', 'Entity', 'Operation', 'Campaign ID', 'Ad Group ID', 
         'Campaign Name', 'Ad Group Name', 'Portfolio Name', 'State', 'Bid', 
         'Keyword Text', 'Match Type']
      ],
      'SP_CAMPAIGNS': [
        ['Product', 'Entity', 'Operation', 'Campaign ID', 'Campaign Name', 
         'Portfolio Name', 'State', 'Daily Budget', 'Start Date', 'End Date', 
         'Targeting Type', 'Bidding Strategy']
      ],
      'NEGATIVE_KEYWORDS': [
        ['Product', 'Entity', 'Operation', 'Campaign ID', 'Ad Group ID',
         'Campaign Name', 'Ad Group Name', 'Keyword Text', 'Match Type', 'State']
      ]
    };
    
    const ui = SpreadsheetApp.getUi();
    const choices = Object.keys(templates).map(key => key.replace('_', ' ')).join('\n');
    
    const response = ui.prompt(
      'Wybierz szablon',
      `Dostępne szablony:\n${choices}\n\nWpisz nazwę:`,
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() === ui.Button.OK) {
      const templateName = response.getResponseText().toUpperCase().replace(' ', '_');
      
      if (templates[templateName]) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const templateSheet = ss.insertSheet(`Template_${templateName}`);
        
        const headers = templates[templateName];
        templateSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
        templateSheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
        
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `Szablon ${templateName} utworzony`,
          'BULK Exporter',
          3
        );
      }
    }
  }
};