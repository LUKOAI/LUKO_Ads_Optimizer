/**
 * BULK CHANGE MANAGER - Zarządzanie zmianami w targetach
 * Interaktywne dialogi i precyzyjne modyfikacje
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkChangeManager = {
  
  /**
   * Pauzowanie targetów bez sprzedaży
   */
  pauseZeroSales() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet || sheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('❌ Brak danych w BULK_Builder. Uruchom najpierw analizę.');
      return;
    }
    
    // Znajdź kolumny
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const recommendationCol = headers.indexOf('💡 Recommendation') + 1;
    const stateCol = headers.indexOf('State') + 1;
    const checkboxCol = headers.indexOf('✅ Apply Change') + 1;
    
    if (recommendationCol === 0 || stateCol === 0) {
      SpreadsheetApp.getUi().alert('❌ Nie znaleziono wymaganych kolumn');
      return;
    }
    
    // Sprawdź czy są zaznaczone wiersze
    const selectedRows = BulkGenerator.getSelectedRows();
    let targetRows = [];
    
    if (selectedRows) {
      // Użyj tylko zaznaczonych
      for (let i = selectedRows.start; i <= selectedRows.end; i++) {
        targetRows.push(i);
      }
    } else {
      // Znajdź wszystkie z rekomendacją PAUSE
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][recommendationCol - 1] === 'PAUSE') {
          targetRows.push(i + 1); // +1 bo getValues() indeksuje od 0
        }
      }
    }
    
    if (targetRows.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ Brak targetów do spauzowania');
      return;
    }
    
    // Pokaż potwierdzenie
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      '⏸️ Pauzowanie Targetów',
      `Znaleziono ${targetRows.length} targetów do spauzowania.\n\n` +
      'Czy na pewno chcesz je spauzować?',
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      // Zastosuj zmiany
      let pausedCount = 0;
      targetRows.forEach(row => {
        sheet.getRange(row, stateCol).setValue('paused');
        if (checkboxCol > 0) {
          sheet.getRange(row, checkboxCol).setValue(true);
        }
        // Kolorowanie
        sheet.getRange(row, stateCol).setBackground('#ffcccc');
        pausedCount++;
      });
      
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Spauzowano ${pausedCount} targetów`,
        'BULK Change Manager',
        3
      );
      
      // Log zmian
      this.logChange('PAUSE', pausedCount, targetRows);
    }
  },
  
  /**
   * Dialog zmiany stawek
   */
  showBidDialog() {
    const html = HtmlService.createHtmlOutputFromFile('BidAdjustmentDialog')
      .setWidth(500)
      .setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(html, '📊 Dostosuj Stawki');
  },
  
  /**
   * Zastosuj zmiany stawek
   */
  applyBidChanges(changeType, value, targetGroup) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet) {
      return { success: false, message: 'Brak arkusza BULK_Builder' };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const bidCol = headers.indexOf('Bid') + 1;
    const recommendationCol = headers.indexOf('💡 Recommendation') + 1;
    const changeCol = headers.indexOf('% Change') + 1;
    const checkboxCol = headers.indexOf('✅ Apply Change') + 1;
    
    // Określ docelowe wiersze
    let targetRows = [];
    const data = sheet.getDataRange().getValues();
    
    switch(targetGroup) {
      case 'selected':
        const selectedRows = BulkGenerator.getSelectedRows();
        if (selectedRows) {
          for (let i = selectedRows.start; i <= selectedRows.end; i++) {
            targetRows.push(i);
          }
        }
        break;
        
      case 'loss':
        for (let i = 1; i < data.length; i++) {
          const recommendation = data[i][recommendationCol - 1];
          if (recommendation === 'DECREASE_BID' || recommendation === 'ADD_NEGATIVE') {
            targetRows.push(i + 1);
          }
        }
        break;
        
      case 'profit':
        for (let i = 1; i < data.length; i++) {
          if (data[i][recommendationCol - 1] === 'INCREASE_BID') {
            targetRows.push(i + 1);
          }
        }
        break;
        
      case 'zero':
        for (let i = 1; i < data.length; i++) {
          if (data[i][recommendationCol - 1] === 'PAUSE') {
            targetRows.push(i + 1);
          }
        }
        break;
        
      case 'all':
        for (let i = 2; i <= sheet.getLastRow(); i++) {
          targetRows.push(i);
        }
        break;
    }
    
    if (targetRows.length === 0) {
      return { success: false, message: 'Nie znaleziono targetów do modyfikacji' };
    }
    
    // Zastosuj zmiany
    let modifiedCount = 0;
    
    targetRows.forEach(row => {
      const currentBid = parseFloat(sheet.getRange(row, bidCol).getValue()) || 0;
      let newBid = currentBid;
      
      switch(changeType) {
        case 'percent_increase':
          newBid = currentBid * (1 + parseFloat(value) / 100);
          break;
        case 'percent_decrease':
          newBid = currentBid * (1 - parseFloat(value) / 100);
          break;
        case 'amount_increase':
          newBid = currentBid + parseFloat(value);
          break;
        case 'amount_decrease':
          newBid = currentBid - parseFloat(value);
          break;
        case 'set_bid':
          newBid = parseFloat(value);
          break;
      }
      
      // Walidacja zakresu
      newBid = Math.max(0.02, Math.min(100, newBid));
      
      // Zapisz zmiany
      sheet.getRange(row, bidCol).setValue(newBid.toFixed(2));
      
      // Zapisz informację o zmianie
      if (changeCol > 0) {
        const percentChange = ((newBid - currentBid) / currentBid * 100).toFixed(1);
        sheet.getRange(row, changeCol).setValue(percentChange + '%');
      }
      
      // Zaznacz checkbox
      if (checkboxCol > 0) {
        sheet.getRange(row, checkboxCol).setValue(true);
      }
      
      // Kolorowanie
      const changeCell = sheet.getRange(row, bidCol);
      if (newBid > currentBid) {
        changeCell.setBackground('#ccffcc'); // Zielony dla zwiększenia
      } else if (newBid < currentBid) {
        changeCell.setBackground('#ffe6cc'); // Pomarańczowy dla zmniejszenia
      }
      
      modifiedCount++;
    });
    
    // Log zmian
    this.logChange('BID_CHANGE', modifiedCount, targetRows, {
      changeType: changeType,
      value: value
    });
    
    return { 
      success: true, 
      message: `Zmodyfikowano stawki dla ${modifiedCount} targetów` 
    };
  },
  
  /**
   * Dodawanie negatywnych słów kluczowych
   */
  addNegatives() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet) {
      SpreadsheetApp.getUi().alert('❌ Brak arkusza BULK_Builder');
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const keywordCol = headers.indexOf('Keyword Text') + 1;
    const searchTermCol = headers.indexOf('Customer Search Term') + 1;
    const recommendationCol = headers.indexOf('💡 Recommendation') + 1;
    const adGroupCol = headers.indexOf('Ad Group Name') + 1;
    const campaignCol = headers.indexOf('Campaign Name') + 1;
    
    // Zbierz targety do dodania jako negatywy
    const negativesToAdd = [];
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][recommendationCol - 1] === 'ADD_NEGATIVE') {
        const keyword = data[i][searchTermCol - 1] || data[i][keywordCol - 1];
        const adGroup = data[i][adGroupCol - 1];
        const campaign = data[i][campaignCol - 1];
        
        if (keyword) {
          negativesToAdd.push({
            keyword: keyword,
            adGroup: adGroup,
            campaign: campaign,
            row: i + 1
          });
        }
      }
    }
    
    if (negativesToAdd.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ Brak słów do dodania jako negatywne');
      return;
    }
    
    // Utwórz arkusz z negatywami
    let negativesSheet = ss.getSheetByName('BULK_Negatives');
    if (!negativesSheet) {
      negativesSheet = ss.insertSheet('BULK_Negatives');
    } else {
      negativesSheet.clear();
    }
    
    // Nagłówki dla negatywów (format Amazon)
    const negHeaders = [
      'Product', 'Entity', 'Operation', 'Campaign ID', 'Ad Group ID',
      'Campaign Name', 'Ad Group Name', 'Keyword Text', 'Match Type', 'State'
    ];
    
    negativesSheet.getRange(1, 1, 1, negHeaders.length).setValues([negHeaders]);
    
    // Wypełnij danymi
    let negRow = 2;
    negativesToAdd.forEach(item => {
      const negData = [
        'Sponsored Products',
        'Negative Keyword',
        'create',
        '', // Campaign ID - do uzupełnienia
        '', // Ad Group ID - do uzupełnienia
        item.campaign,
        item.adGroup,
        item.keyword,
        'negative exact', // lub 'negative phrase'
        'enabled'
      ];
      
      negativesSheet.getRange(negRow, 1, 1, negData.length).setValues([negData]);
      negRow++;
      
      // Oznacz w Builder
      sheet.getRange(item.row, recommendationCol).setValue('NEGATIVE_ADDED');
      sheet.getRange(item.row, recommendationCol).setBackground('#ff9999');
    });
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Dodano ${negativesToAdd.length} negatywnych słów do arkusza BULK_Negatives`,
      'BULK Change Manager',
      5
    );
    
    // Pokaż instrukcje
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '✅ Negatywne słowa przygotowane',
      `Dodano ${negativesToAdd.length} słów do arkusza BULK_Negatives.\n\n` +
      '⚠️ WAŻNE:\n' +
      '1. Uzupełnij Campaign ID i Ad Group ID\n' +
      '2. Wybierz Match Type (exact/phrase)\n' +
      '3. Eksportuj arkusz i wgraj do Amazon',
      ui.ButtonSet.OK
    );
  },
  
  /**
   * Przenoszenie do pozytywnych
   */
  moveToPositives() {
    // Podobna logika jak dla negatywów, ale tworzenie nowych targetów
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '🚧 W budowie',
      'Funkcja przenoszenia do pozytywnych słów jest w przygotowaniu.\n\n' +
      'Obecnie możesz:\n' +
      '1. Skopiować dobrze działające search terms\n' +
      '2. Dodać je ręcznie jako nowe keywords w Amazon',
      ui.ButtonSet.OK
    );
  },
  
  /**
   * Zmiana budżetów kampanii
   */
  adjustBudgets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');
    
    if (!sheet) {
      SpreadsheetApp.getUi().alert('❌ Brak arkusza BULK_Builder');
      return;
    }
    
    // Agreguj dane po kampaniach
    const campaigns = {};
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const campaignCol = headers.indexOf('Campaign Name');
    const budgetCol = headers.indexOf('Daily Budget');
    const spendCol = headers.indexOf('Spend');
    const acosCol = headers.indexOf('ACOS');
    
    for (let i = 1; i < data.length; i++) {
      const campaignName = data[i][campaignCol];
      if (!campaignName) continue;
      
      if (!campaigns[campaignName]) {
        campaigns[campaignName] = {
          name: campaignName,
          budget: parseFloat(data[i][budgetCol]) || 0,
          totalSpend: 0,
          avgACOS: [],
          rows: []
        };
      }
      
      campaigns[campaignName].totalSpend += parseFloat(data[i][spendCol]) || 0;
      campaigns[campaignName].avgACOS.push(parseFloat(data[i][acosCol]) || 0);
      campaigns[campaignName].rows.push(i + 1);
    }
    
    // Pokaż dialog z sugestiami
    const html = HtmlService.createTemplateFromFile('BudgetAdjustmentDialog');
    html.campaigns = campaigns;
    
    const htmlOutput = html.evaluate()
      .setWidth(600)
      .setHeight(500);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💰 Dostosuj Budżety Kampanii');
  },
  
  /**
   * Logowanie zmian
   */
  logChange(type, count, rows, details = {}) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('BULK_ChangeLog');
    
    if (!logSheet) {
      logSheet = ss.insertSheet('BULK_ChangeLog');
      logSheet.getRange(1, 1, 1, 5).setValues([
        ['Timestamp', 'Change Type', 'Affected Rows', 'Count', 'Details']
      ]);
    }
    
    const lastRow = logSheet.getLastRow() + 1;
    const logData = [
      new Date(),
      type,
      rows.slice(0, 10).join(', ') + (rows.length > 10 ? '...' : ''),
      count,
      JSON.stringify(details)
    ];
    
    logSheet.getRange(lastRow, 1, 1, 5).setValues([logData]);
  }
};

/**
 * Funkcje wywoływane z HTML
 */
function applyBidChanges(changeType, value, targetGroup) {
  return BulkChangeManager.applyBidChanges(changeType, value, targetGroup);
}