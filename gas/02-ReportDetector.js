// ===== 02-REPORTDETECTOR.GS - KOMPLETNY DETEKTOR RAPORTÓW =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================

class UltraReportDetector {
  constructor(logger) {
    this.logger = logger;
    
    this.reportTypes = {
      // BULK/SP Report - najwyższy priorytet dla raportów z Amazon Bulk
      SP_BULK_REPORT: {
        required: ['impressions'],
        identifying: ['campaign', 'ad_group', 'targeting'],
        patterns: ['bulk', 'sp_search', 'sponsored_products'],
        excludes: [],
        priority: 110,
        description: 'Amazon SP Bulk/Search Term Report'
      },

      CAMPAIGN_REPORT: {
        required: ['campaign', 'impressions'],
        identifying: ['campaign', 'spend', 'sales'],
        patterns: ['campaign', 'SP-CAMPAIGN'],
        excludes: ['search.*term', 'keyword.*text', 'target.*expression'],
        priority: 100,
        description: 'Amazon Campaign Performance Report'
      },

      SEARCH_TERM_REPORT: {
        required: ['impressions'],
        identifying: ['customer.*search.*term', 'search.*term', 'query'],
        patterns: ['search.*term', 'suchbegriff', 'sponsored_products_search'],
        excludes: [],
        priority: 95,
        description: 'Amazon Search Term Report'
      },

      KEYWORD_REPORT: {
        required: ['keyword', 'impressions'],
        identifying: ['keyword.*text', 'schlüsselwort'],
        patterns: ['keyword', 'schlüssel'],
        excludes: ['search.*term', 'target.*expression'],
        priority: 90,
        description: 'Amazon Keyword Report'
      },

      TARGET_REPORT: {
        required: ['impressions'],
        identifying: ['target', 'targeting.*expression', 'targeting'],
        patterns: ['target', 'targeting'],
        excludes: [],
        priority: 85,
        description: 'Amazon Product Targeting Report'
      }
    };
  }

  // GŁÓWNA FUNKCJA WYKRYWANIA
  detectReports() {
    this.logger.log('🔍 STARTING REPORT DETECTION V6.0', 'INFO');
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const detectedReports = [];

    sheets.forEach(sheet => {
      const sheetName = sheet.getName();

      // Pomiń arkusze LUKO
      if (sheetName.startsWith(LUKO_CONFIG.SHEET_PREFIX)) {
        this.logger.log(`⏭️ Skipping LUKO sheet: ${sheetName}`, 'INFO');
        return;
      }

      // Pomiń puste arkusze
      if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
        this.logger.log(`⏭️ Skipping empty sheet: ${sheetName}`, 'INFO');
        return;
      }

      try {
        this.logger.log(`🔍 Analyzing sheet: ${sheetName}`, 'INFO');
        
        const headerInfo = this.detectHeaders(sheet);
        if (!headerInfo.success) {
          this.logger.log(`❌ No valid headers found in sheet: ${sheetName}`, 'WARNING');
          return;
        }

        const detectionResult = this.detectReportType(headerInfo.headers, sheetName);
        if (!detectionResult.type) {
          this.logger.log(`❓ Could not identify report type for sheet: ${sheetName}`, 'WARNING');
          return;
        }

        const dataQuality = this.assessDataQuality(sheet, headerInfo.headers);

        const report = {
          sheet: sheet,
          sheetName: sheetName,
          type: detectionResult.type,
          confidence: detectionResult.confidence,
          language: detectionResult.language,
          headers: headerInfo.headers,
          headerRow: headerInfo.headerRow,
          totalRows: sheet.getLastRow(),
          totalColumns: sheet.getLastColumn(),
          dataQuality: dataQuality
        };

        detectedReports.push(report);
        
        this.logger.log(`✅ DETECTED: ${detectionResult.type} (${(detectionResult.confidence * 100).toFixed(1)}% confidence)`, 'SUCCESS');

      } catch (error) {
        this.logger.log(`💥 Error analyzing sheet ${sheetName}: ${error.message}`, 'ERROR');
      }
    });

    this.logger.log(`🎯 DETECTION COMPLETE: Found ${detectedReports.length} valid reports`, 'SUCCESS');
    return detectedReports;
  }

  // WYKRYWANIE NAGŁÓWKÓW
  detectHeaders(sheet) {
    const maxRowsToCheck = Math.min(10, sheet.getLastRow());
    const numCols = sheet.getLastColumn();
    
    for (let row = 1; row <= maxRowsToCheck; row++) {
      try {
        const range = sheet.getRange(row, 1, 1, numCols);
        const values = range.getValues()[0];
        
        const nonEmptyCount = values.filter(val => val && val.toString().trim()).length;
        const hasTypicalHeaders = this.hasTypicalAmazonHeaders(values);
        
        if (nonEmptyCount >= 5 && hasTypicalHeaders) {
          const headers = values.map(val => val ? val.toString().trim() : '');
          
          return {
            success: true,
            headers: headers,
            headerRow: row,
            nonEmptyCount: nonEmptyCount
          };
        }
      } catch (error) {
        this.logger.log(`Error checking row ${row}: ${error.message}`, 'WARNING');
      }
    }
    
    return { success: false };
  }

  // SPRAWDZENIE CZY ZAWIERA TYPOWE NAGŁÓWKI AMAZON
  hasTypicalAmazonHeaders(values) {
    const headerStr = values.join(' ').toLowerCase();
    
    const amazonPatterns = [
      'impressions', 'clicks', 'spend', 'sales', 'campaign', 'orders',
      'impressionen', 'klicks', 'ausgaben', 'verkäufe', 'kampagnen', 'bestellungen',
      'acos', 'roas', 'ctr', 'cpc', 'asin', 'sku',
      '7 day total', 'total advertising'
    ];
    
    return amazonPatterns.some(pattern => headerStr.includes(pattern));
  }

  // WYKRYWANIE TYPU RAPORTU
  detectReportType(headers, sheetName) {
    this.logger.log(`🧠 Report type detection for: ${sheetName}`, 'DEBUG');

    const normalizedHeaders = headers.map(h => this.normalizeHeader(h));
    const headerText = normalizedHeaders.join(' ').toLowerCase();
    const nameText = sheetName.toLowerCase().replace(/[_\s]+/g, '_');

    // BONUS: Rozpoznawanie po standardowych nazwach arkuszy Amazon
    // V6.2: Dodane nowe nazwy i stare dla kompatybilności
    const sheetNamePatterns = {
      // Nowe nazwy V6.2
      'sponsored_products_search_term': 'SEARCH_TERM_REPORT',
      'sp_bulk_report': 'SP_BULK_REPORT',
      // Stare nazwy
      'sp_search_term': 'SEARCH_TERM_REPORT',
      'sp_bulk': 'SP_BULK_REPORT',
      'bulk_report': 'SP_BULK_REPORT',
      'bulk_source': 'SP_BULK_REPORT',
      // Stara polska nazwa
      'tu_wklejasz_raport': 'SEARCH_TERM_REPORT'
    };

    let sheetNameBonus = null;
    for (const [pattern, reportType] of Object.entries(sheetNamePatterns)) {
      if (nameText.includes(pattern)) {
        sheetNameBonus = reportType;
        this.logger.log(`📛 Sheet name matches pattern "${pattern}" → ${reportType}`, 'DEBUG');
        break;
      }
    }

    let bestMatch = { type: null, confidence: 0, details: {} };
    
    const sortedTypes = Object.entries(this.reportTypes)
      .sort((a, b) => b[1].priority - a[1].priority);
    
    sortedTypes.forEach(([typeName, typeConfig]) => {
      const score = this.calculateTypeScore(headerText, nameText, normalizedHeaders, typeConfig);

      // BONUS: Dodaj punkty jeśli nazwa arkusza pasuje do tego typu raportu
      if (sheetNameBonus === typeName) {
        score.total += 0.25;
        this.logger.log(`📛 +0.25 bonus za nazwę arkusza dla ${typeName}`, 'DEBUG');
      }

      this.logger.log(`📊 ${typeName}: ${score.total.toFixed(2)} points`, 'DEBUG');

      if (score.total > bestMatch.confidence) {
        bestMatch = {
          type: typeName,
          confidence: score.total,
          details: score,
          language: this.detectLanguage(headers)
        };
      }
    });
    
    // Obniżony próg do 0.35 - raporty Amazon często mają różne formaty
    if (bestMatch.confidence < 0.35) {
      this.logger.log(`❌ No type matched minimum threshold (best: ${bestMatch.type} with ${bestMatch.confidence.toFixed(2)})`, 'WARNING');
      return { type: null, confidence: 0 };
    }
    
    this.logger.log(`🎯 BEST MATCH: ${bestMatch.type} (${(bestMatch.confidence * 100).toFixed(1)}%)`, 'SUCCESS');
    return bestMatch;
  }

  // OBLICZANIE SCORE DLA TYPU RAPORTU
  calculateTypeScore(headerText, nameText, normalizedHeaders, typeConfig) {
    let score = {
      required: 0,
      identifying: 0,
      patterns: 0,
      excludes: 0,
      total: 0
    };
    
    // REQUIRED FIELDS (40% wagi)
    if (typeConfig.required) {
      const requiredFound = typeConfig.required.filter(req => 
        normalizedHeaders.some(h => h.includes(req) || this.fuzzyMatch(h, req))
      );
      score.required = (requiredFound.length / typeConfig.required.length) * 0.4;
      
      if (score.required === 0) {
        return score;
      }
    }
    
    // IDENTIFYING TERMS (30% wagi)
    if (typeConfig.identifying) {
      const identifyingFound = typeConfig.identifying.filter(term => 
        headerText.includes(term) || nameText.includes(term)
      );
      score.identifying = (identifyingFound.length / typeConfig.identifying.length) * 0.3;
    }
    
    // PATTERNS (20% wagi)
    if (typeConfig.patterns) {
      const patternMatches = typeConfig.patterns.filter(pattern => {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        return regex.test(nameText) || regex.test(headerText);
      });
      score.patterns = (patternMatches.length / typeConfig.patterns.length) * 0.2;
    }
    
    // EXCLUDES (odejmuje punkty)
    if (typeConfig.excludes) {
      const excludeMatches = typeConfig.excludes.filter(exclude => {
        const regex = typeof exclude === 'string' ? new RegExp(exclude, 'i') : exclude;
        return regex.test(headerText) || regex.test(nameText);
      });
      score.excludes = -(excludeMatches.length * 0.15);
    }
    
    // PRIORYTET BONUS (10% wagi)
    const priorityBonus = (typeConfig.priority / 100) * 0.1;
    
    score.total = score.required + score.identifying + score.patterns + score.excludes + priorityBonus;
    
    return score;
  }

  // NORMALIZACJA NAGŁÓWKA
  normalizeHeader(header) {
    if (!header) return '';
    
    return header
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[äöüß]/g, match => {
        const map = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
        return map[match] || match;
      })
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  // FUZZY MATCHING
  fuzzyMatch(str1, str2) {
    if (!str1 || !str2) return false;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.includes(shorter) || shorter.includes(longer)) return true;
    
    const similarity = this.calculateSimilarity(str1, str2);
    return similarity > 0.7;
  }

  // OBLICZANIE PODOBIEŃSTWA
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // ALGORYTM LEVENSHTEIN
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // WYKRYWANIE JĘZYKA
  detectLanguage(headers) {
    const headerText = headers.join(' ').toLowerCase();
    
    const languageMarkers = {
      'DE': ['ausgaben', 'verkäufe', 'klicks', 'impressionen', 'kampagnen', 'bestellungen'],
      'EN': ['spend', 'sales', 'clicks', 'impressions', 'campaigns', 'orders'],
      'PL': ['wydatki', 'sprzedaż', 'kliknięcia', 'wyświetlenia', 'kampanie', 'zamówienia'],
      'FR': ['dépenses', 'ventes', 'clics', 'impressions', 'campagnes', 'commandes']
    };
    
    let bestLanguage = 'EN';
    let maxMatches = 0;
    
    Object.entries(languageMarkers).forEach(([lang, markers]) => {
      const matches = markers.filter(marker => headerText.includes(marker)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestLanguage = lang;
      }
    });
    
    return maxMatches > 0 ? bestLanguage : 'EN';
  }

  // OCENA JAKOŚCI DANYCH
  assessDataQuality(sheet, headers) {
    try {
      const totalRows = sheet.getLastRow();
      const totalCols = sheet.getLastColumn();
      
      if (totalRows < 2) {
        return { score: 0, reason: 'No data rows' };
      }
      
      const sampleSize = Math.min(10, totalRows - 1);
      const sampleRange = sheet.getRange(2, 1, sampleSize, totalCols);
      const sampleData = sampleRange.getValues();
      
      let emptyRows = 0;
      let numericColumns = 0;
      
      sampleData.forEach(row => {
        const nonEmptyValues = row.filter(val => val !== null && val !== undefined && val !== '').length;
        if (nonEmptyValues === 0) emptyRows++;
      });
      
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase();
        if (headerLower.includes('impression') || headerLower.includes('click') || 
            headerLower.includes('spend') || headerLower.includes('sales') ||
            headerLower.includes('ausgaben') || headerLower.includes('verkäufe')) {
          numericColumns++;
        }
      });
      
      const dataRatio = (totalRows - 1 - emptyRows) / (totalRows - 1);
      const numericRatio = numericColumns / headers.length;
      const score = (dataRatio * 0.7) + (numericRatio * 0.3);
      
      return {
        score: score,
        totalRows: totalRows - 1,
        emptyRows: emptyRows,
        numericColumns: numericColumns,
        reason: score > 0.7 ? 'Good quality' : score > 0.4 ? 'Medium quality' : 'Low quality'
      };
      
    } catch (error) {
      this.logger.log(`Error assessing data quality: ${error.message}`, 'WARNING');
      return { score: 0.5, reason: 'Assessment failed' };
    }
  }

  // WALIDACJA RAPORTÓW
  validateReports(reports) {
    this.logger.log('📊 Validating detected reports...', 'INFO');
    
    const validReports = reports.filter(report => {
      if (report.totalRows < 2) {
        this.logger.log(`❌ Report "${report.sheetName}" rejected: No data rows`, 'WARNING');
        return false;
      }
      
      if (report.totalColumns < 3) {
        this.logger.log(`❌ Report "${report.sheetName}" rejected: Too few columns`, 'WARNING');
        return false;
      }
      
      if (report.confidence < 0.5) {
        this.logger.log(`❌ Report "${report.sheetName}" rejected: Low confidence (${(report.confidence * 100).toFixed(1)}%)`, 'WARNING');
        return false;
      }
      
      if (report.dataQuality.score < 0.3) {
        this.logger.log(`❌ Report "${report.sheetName}" rejected: Poor data quality (${report.dataQuality.score.toFixed(2)})`, 'WARNING');
        return false;
      }
      
      this.logger.log(`✅ Report "${report.sheetName}" validated successfully`, 'SUCCESS');
      return true;
    });
    
    this.logger.log(`📊 Validation complete: ${validReports.length}/${reports.length} reports passed`, validReports.length > 0 ? 'SUCCESS' : 'WARNING');
    return validReports;
  }
}