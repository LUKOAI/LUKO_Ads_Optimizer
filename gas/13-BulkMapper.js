/**
 * BULK MAPPER - System mapowania danych między raportami
 * Łączy dane z normalnej analizy z danymi BULK
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkMapper = {
  
  /**
   * Główna funkcja mapowania
   * Próbuje połączyć dane z LUKO_Full_Analysis z BULK_Source
   */
  mapCampaigns() {
    Logger.log('=== BULK MAPPER START ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bulkSource = ss.getSheetByName('BULK_Source');
    const fullAnalysis = ss.getSheetByName('LUKO_Full_Analysis');
    
    if (!bulkSource || bulkSource.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('❌ Brak danych w BULK_Source!');
      return null;
    }
    
    if (!fullAnalysis || fullAnalysis.getLastRow() < 2) {
      Logger.log('Brak LUKO_Full_Analysis - będzie analiza od zera');
      return this.createFreshMapping(bulkSource);
    }
    
    // Pobieranie danych
    const bulkData = bulkSource.getDataRange().getValues();
    const analysisData = fullAnalysis.getDataRange().getValues();
    
    // Identyfikacja kolumn kluczowych
    const bulkColumns = this.identifyBulkColumns(bulkData[0]);
    const analysisColumns = this.identifyAnalysisColumns(analysisData[0]);
    
    Logger.log('Bulk columns: ' + JSON.stringify(bulkColumns));
    Logger.log('Analysis columns: ' + JSON.stringify(analysisColumns));
    
    // Tworzenie mapy kampanii
    const mappingResult = {
      matched: [],      // Kampanie zmapowane
      bulkOnly: [],     // Tylko w BULK
      analysisOnly: [], // Tylko w analizie
      mappingTable: {}, // Tabela mapowań ID -> dane
      confidence: 0     // Pewność mapowania 0-100%
    };
    
    // Mapowanie po Campaign ID i nazwie
    for (let i = 1; i < bulkData.length; i++) {
      const bulkRow = bulkData[i];
      if (!bulkRow[bulkColumns.campaignId]) continue;
      
      const campaignId = String(bulkRow[bulkColumns.campaignId]);
      const campaignName = bulkRow[bulkColumns.campaignName] || '';
      const adGroupId = bulkRow[bulkColumns.adGroupId] ? String(bulkRow[bulkColumns.adGroupId]) : '';
      const keywordId = bulkRow[bulkColumns.keywordId] ? String(bulkRow[bulkColumns.keywordId]) : '';
      
      // Szukanie w analizie
      let matchFound = false;
      
      for (let j = 1; j < analysisData.length; j++) {
        const analysisRow = analysisData[j];
        
        // Próba dopasowania po różnych kryteriach
        const match = this.tryMatch(
          bulkRow, analysisRow, 
          bulkColumns, analysisColumns,
          campaignId, campaignName, adGroupId
        );
        
        if (match.isMatch) {
          mappingResult.matched.push({
            bulkRowIndex: i,
            analysisRowIndex: j,
            campaignId: campaignId,
            campaignName: campaignName,
            matchType: match.type,
            confidence: match.confidence,
            bulkData: bulkRow,
            analysisData: analysisRow,
            metrics: this.extractMetrics(analysisRow, analysisColumns)
          });
          
          // Zapisz do tabeli mapowań
          const key = this.createMappingKey(campaignId, adGroupId, keywordId);
          mappingResult.mappingTable[key] = {
            bulkRow: i,
            analysisRow: j,
            metrics: this.extractMetrics(analysisRow, analysisColumns)
          };
          
          matchFound = true;
          break;
        }
      }
      
      if (!matchFound) {
        mappingResult.bulkOnly.push({
          rowIndex: i,
          campaignId: campaignId,
          campaignName: campaignName,
          data: bulkRow
        });
      }
    }
    
    // Znajdź elementy tylko w analizie
    for (let j = 1; j < analysisData.length; j++) {
      const analysisRow = analysisData[j];
      const campaignName = analysisRow[analysisColumns.campaignName] || '';
      
      const isMatched = mappingResult.matched.some(m => 
        m.analysisRowIndex === j
      );
      
      if (!isMatched && campaignName) {
        mappingResult.analysisOnly.push({
          rowIndex: j,
          campaignName: campaignName,
          data: analysisRow,
          metrics: this.extractMetrics(analysisRow, analysisColumns)
        });
      }
    }
    
    // Oblicz pewność mapowania
    const totalBulk = bulkData.length - 1;
    const matched = mappingResult.matched.length;
    mappingResult.confidence = Math.round((matched / totalBulk) * 100);
    
    // Zapisz wyniki mapowania
    this.saveMappingResults(mappingResult);
    
    // Pokaż raport
    this.showMappingReport(mappingResult);
    
    return mappingResult;
  },
  
  /**
   * Próba dopasowania wierszy
   */
  tryMatch(bulkRow, analysisRow, bulkCols, analysisCols, campaignId, campaignName, adGroupId) {
    // Priorytet 1: Dokładne Campaign ID
    if (analysisCols.campaignId >= 0) {
      const analysisCampaignId = String(analysisRow[analysisCols.campaignId] || '');
      if (analysisCampaignId && analysisCampaignId === campaignId) {
        // Sprawdź też Ad Group ID jeśli dostępne
        if (adGroupId && analysisCols.adGroupId >= 0) {
          const analysisAdGroupId = String(analysisRow[analysisCols.adGroupId] || '');
          if (analysisAdGroupId === adGroupId) {
            return { isMatch: true, type: 'EXACT_ID', confidence: 100 };
          }
        }
        return { isMatch: true, type: 'CAMPAIGN_ID', confidence: 90 };
      }
    }
    
    // Priorytet 2: Nazwa kampanii
    if (campaignName && analysisCols.campaignName >= 0) {
      const analysisCampaignName = analysisRow[analysisCols.campaignName] || '';
      
      // Dokładne dopasowanie nazwy
      if (analysisCampaignName === campaignName) {
        return { isMatch: true, type: 'EXACT_NAME', confidence: 85 };
      }
      
      // Częściowe dopasowanie (podobieństwo)
      const similarity = this.calculateSimilarity(campaignName, analysisCampaignName);
      if (similarity > 0.8) {
        return { isMatch: true, type: 'SIMILAR_NAME', confidence: Math.round(similarity * 80) };
      }
    }
    
    // Priorytet 3: Keyword text dla search term reports
    if (bulkCols.keywordText >= 0 && analysisCols.keywordText >= 0) {
      const bulkKeyword = bulkRow[bulkCols.keywordText] || '';
      const analysisKeyword = analysisRow[analysisCols.keywordText] || '';
      
      if (bulkKeyword && bulkKeyword === analysisKeyword) {
        // Sprawdź też czy kampania się zgadza
        if (campaignName && analysisCols.campaignName >= 0) {
          const analysisCampaignName = analysisRow[analysisCols.campaignName] || '';
          if (this.calculateSimilarity(campaignName, analysisCampaignName) > 0.7) {
            return { isMatch: true, type: 'KEYWORD_MATCH', confidence: 75 };
          }
        }
      }
    }
    
    return { isMatch: false };
  },
  
  /**
   * Identyfikacja kolumn w BULK
   */
  identifyBulkColumns(headers) {
    const columns = {};
    
    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      
      if (h.includes('campaign id')) columns.campaignId = index;
      else if (h.includes('campaign name')) columns.campaignName = index;
      else if (h.includes('ad group id')) columns.adGroupId = index;
      else if (h.includes('ad group name')) columns.adGroupName = index;
      else if (h.includes('keyword id')) columns.keywordId = index;
      else if (h.includes('keyword text')) columns.keywordText = index;
      else if (h.includes('bid')) columns.bid = index;
      else if (h.includes('state')) columns.state = index;
      else if (h.includes('status')) columns.status = index;
      else if (h.includes('daily budget')) columns.budget = index;
      else if (h.includes('impressions')) columns.impressions = index;
      else if (h.includes('clicks')) columns.clicks = index;
      else if (h.includes('spend')) columns.spend = index;
      else if (h.includes('sales')) columns.sales = index;
      else if (h.includes('orders')) columns.orders = index;
      else if (h.includes('acos')) columns.acos = index;
      else if (h.includes('roas')) columns.roas = index;
      else if (h.includes('cpc')) columns.cpc = index;
    });
    
    return columns;
  },
  
  /**
   * Identyfikacja kolumn w analizie
   */
  identifyAnalysisColumns(headers) {
    const columns = {};
    
    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      
      // Polska wersja
      if (h.includes('kampanie') || h.includes('campaign')) columns.campaignName = index;
      else if (h.includes('grupa') || h.includes('ad group')) columns.adGroupName = index;
      else if (h.includes('targetowanie') || h.includes('targeting')) columns.targeting = index;
      else if (h.includes('wyświetlenia') || h.includes('impressions')) columns.impressions = index;
      else if (h.includes('kliknięcia') || h.includes('clicks')) columns.clicks = index;
      else if (h.includes('wydatki') || h.includes('spend')) columns.spend = index;
      else if (h.includes('sprzedaż') || h.includes('sales')) columns.sales = index;
      else if (h.includes('zamówienia') || h.includes('orders')) columns.orders = index;
      else if (h.includes('acos')) columns.acos = index;
      else if (h.includes('roas')) columns.roas = index;
      else if (h.includes('ctr')) columns.ctr = index;
      else if (h.includes('cpc')) columns.cpc = index;
      
      // ID jeśli są
      if (h === 'campaign id') columns.campaignId = index;
      if (h === 'ad group id') columns.adGroupId = index;
    });
    
    return columns;
  },
  
  /**
   * Zapisz wyniki mapowania
   */
  saveMappingResults(mappingResult) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let mappingSheet = ss.getSheetByName('BULK_Mapping');
    
    if (!mappingSheet) {
      mappingSheet = ss.insertSheet('BULK_Mapping');
    } else {
      mappingSheet.clear();
    }
    
    // Nagłówki
    const headers = [
      'Mapping Type', 'Campaign ID', 'Campaign Name', 'Ad Group', 
      'Match Confidence', 'BULK Row', 'Analysis Row', 
      'Impressions', 'Clicks', 'Spend', 'Sales', 'Orders', 'ACOS', 'Status'
    ];
    
    mappingSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    mappingSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    let row = 2;
    
    // Dodaj zmapowane
    mappingResult.matched.forEach(match => {
      const data = [
        match.matchType,
        match.campaignId,
        match.campaignName,
        match.bulkData[match.bulkData.findIndex(h => h && h.toString().includes('Ad Group'))] || '',
        match.confidence + '%',
        match.bulkRowIndex + 1,
        match.analysisRowIndex + 1,
        match.metrics.impressions || 0,
        match.metrics.clicks || 0,
        match.metrics.spend || 0,
        match.metrics.sales || 0,
        match.metrics.orders || 0,
        match.metrics.acos || 0,
        '✅ Mapped'
      ];
      
      mappingSheet.getRange(row, 1, 1, data.length).setValues([data]);
      mappingSheet.getRange(row, 1, 1, data.length).setBackground('#ccffcc');
      row++;
    });
    
    // Dodaj tylko w BULK
    mappingResult.bulkOnly.forEach(item => {
      const data = [
        'BULK_ONLY',
        item.campaignId,
        item.campaignName,
        '',
        '0%',
        item.rowIndex + 1,
        '-',
        '', '', '', '', '', '',
        '⚠️ No Analysis'
      ];
      
      mappingSheet.getRange(row, 1, 1, data.length).setValues([data]);
      mappingSheet.getRange(row, 1, 1, data.length).setBackground('#ffffcc');
      row++;
    });
    
    // Dodaj tylko w analizie
    mappingResult.analysisOnly.forEach(item => {
      const data = [
        'ANALYSIS_ONLY',
        '',
        item.campaignName,
        '',
        '0%',
        '-',
        item.rowIndex + 1,
        item.metrics.impressions || 0,
        item.metrics.clicks || 0,
        item.metrics.spend || 0,
        item.metrics.sales || 0,
        item.metrics.orders || 0,
        item.metrics.acos || 0,
        '❌ Not in BULK'
      ];
      
      mappingSheet.getRange(row, 1, 1, data.length).setValues([data]);
      mappingSheet.getRange(row, 1, 1, data.length).setBackground('#ffcccc');
      row++;
    });
  },
  
  /**
   * Pokaż raport mapowania
   */
  showMappingReport(mappingResult) {
    const ui = SpreadsheetApp.getUi();
    
    const report = `
📊 RAPORT MAPOWANIA BULK ↔ ANALIZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Zmapowane: ${mappingResult.matched.length} kampanii/targetów
⚠️ Tylko w BULK: ${mappingResult.bulkOnly.length}
❌ Tylko w Analizie: ${mappingResult.analysisOnly.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Pewność mapowania: ${mappingResult.confidence}%

${mappingResult.confidence < 50 ? 
  '⚠️ UWAGA: Niska pewność mapowania!\nZalecana analiza od zera.' : 
  mappingResult.confidence > 80 ?
    '✅ Wysokie dopasowanie - można używać danych z analizy!' :
    '📊 Średnie dopasowanie - sprawdź wyniki mapowania'
}

Szczegóły w arkuszu: BULK_Mapping
    `;
    
    const result = ui.alert('Mapowanie Zakończone', report, ui.ButtonSet.OK_CANCEL);
    
    if (result === ui.Button.OK) {
      // Przejdź do kolejnego kroku
      BulkAnalyzer.runAnalysis(mappingResult);
    }
  },
  
  /**
   * Oblicz podobieństwo stringów (Levenshtein)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0;
    
    // Simplified similarity based on common characters
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / Math.max(len1, len2);
  },
  
  /**
   * Wyciągnij metryki z wiersza analizy
   */
  extractMetrics(row, columns) {
    const metrics = {};
    
    if (columns.impressions >= 0) metrics.impressions = this.parseNumber(row[columns.impressions]);
    if (columns.clicks >= 0) metrics.clicks = this.parseNumber(row[columns.clicks]);
    if (columns.spend >= 0) metrics.spend = this.parseNumber(row[columns.spend]);
    if (columns.sales >= 0) metrics.sales = this.parseNumber(row[columns.sales]);
    if (columns.orders >= 0) metrics.orders = this.parseNumber(row[columns.orders]);
    if (columns.acos >= 0) metrics.acos = this.parseNumber(row[columns.acos]);
    if (columns.roas >= 0) metrics.roas = this.parseNumber(row[columns.roas]);
    if (columns.ctr >= 0) metrics.ctr = this.parseNumber(row[columns.ctr]);
    if (columns.cpc >= 0) metrics.cpc = this.parseNumber(row[columns.cpc]);
    
    return metrics;
  },
  
  /**
   * Parsowanie liczb z różnych formatów
   */
  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Usuń walutę i spacje
    value = String(value).replace(/[€$£¥]/g, '').trim();
    
    // Obsługa liczb niemieckich (23.456,78)
    if (value.includes(',') && value.includes('.')) {
      if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
        value = value.replace(/\./g, '').replace(',', '.');
      }
    } else if (value.includes(',')) {
      // Sprawdź czy przecinek to separator dziesiętny czy tysięcy
      const parts = value.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        value = value.replace(',', '.');
      } else {
        value = value.replace(/,/g, '');
      }
    }
    
    // Usuń procenty
    value = value.replace('%', '');
    
    return parseFloat(value) || 0;
  },
  
  /**
   * Twórz klucz mapowania
   */
  createMappingKey(campaignId, adGroupId, keywordId) {
    return `${campaignId}_${adGroupId}_${keywordId}`;
  }
};