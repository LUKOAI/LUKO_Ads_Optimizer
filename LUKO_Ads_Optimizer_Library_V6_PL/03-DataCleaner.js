// ===== 03-DataCleaner.gs - PARSER LICZB NIEMIECKICH =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================

class SuperDataCleaner {
  constructor() {
    this.logger = new LukoLogger();
    this.exchangeRates = {
      'EUR': 1.0,
      'USD': 0.88,
      'GBP': 1.17, 
      'PLN': 0.23,
      'SEK': 0.092,
      'JPY': 0.0061,
      'CAD': 0.64,
      'AUD': 0.57,
      'TRY': 0.031,
      'NOK': 0.088,
      'DKK': 0.134,
      'CHF': 0.92
    };
    this.ratesLoaded = false;
  }

  // Załaduj live kursy walut
  loadExchangeRates() {
    if (this.ratesLoaded) return;
    
    const currencies = ['USD', 'GBP', 'PLN', 'SEK', 'JPY', 'CAD', 'AUD', 'TRY'];
    this.logger.log('💱 Loading live exchange rates...', 'INFO');
    
    currencies.forEach(currency => {
      try {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const tempSheet = spreadsheet.insertSheet('_temp_rate_' + Date.now());
        tempSheet.getRange('A1').setFormula(`=GOOGLEFINANCE("CURRENCY:${currency}EUR")`);
        SpreadsheetApp.flush();
        
        const rate = tempSheet.getRange('A1').getValue();
        if (rate && !isNaN(rate) && rate > 0) {
          this.exchangeRates[currency] = rate;
          this.logger.log(`💱 ${currency}/EUR: ${rate}`, 'SUCCESS');
        }
        spreadsheet.deleteSheet(tempSheet);
      } catch (error) {
        this.logger.log(`⚠️ Using fallback rate ${currency}: ${this.exchangeRates[currency]}`, 'WARNING');
      }
    });
    
    this.ratesLoaded = true;
  }

  // ========= NOWA METODA - PARSER LICZB NIEMIECKICH =========
  parseNumber(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    // Konwertuj na string
    let str = String(value).trim();
    
    // Usuń symbole walut
    str = str.replace(/[€$£¥₹]/g, '');
    str = str.replace(/\b(EUR|USD|GBP|PLN|SEK|NOK|DKK|CHF|TRY|JPY|CAD|AUD)\b/gi, '');
    
    // Usuń znak procentu (zapamiętaj że to był procent)
    let isPercent = str.includes('%');
    str = str.replace(/%/g, '');
    
    // Usuń spacje
    str = str.trim();
    
    // KLUCZOWA CZĘŚĆ - OBSŁUGA FORMATÓW NIEMIECKICH
    // Format niemiecki: 1.234.567,89 (kropki = tysiące, przecinek = dziesiętne)
    // Format USA: 1,234,567.89 (przecinki = tysiące, kropka = dziesiętne)
    
    // Sprawdź jaki to format
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    
    if (hasComma && hasDot) {
      // Mamy oba znaki - sprawdź który jest ostatni
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Przecinek jest po kropce = format niemiecki (1.234,56)
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // Kropka jest po przecinku = format USA (1,234.56)
        str = str.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // Tylko przecinek - to może być separator dziesiętny (23,45) lub tysięcy (1,234)
      // Sprawdź czy po przecinku są 3 cyfry (wtedy to tysiące)
      if (str.match(/,\d{3}(?:\D|$)/)) {
        // Po przecinku 3 cyfry = separator tysięcy
        str = str.replace(/,/g, '');
      } else {
        // Po przecinku 1-2 cyfry = separator dziesiętny
        str = str.replace(',', '.');
      }
    } else if (!hasComma && hasDot) {
      // Tylko kropka - może być dziesiętna lub tysiące
      // Jeśli po kropce są 3 cyfry, to prawdopodobnie tysiące
      if (str.match(/\.\d{3}(?:\D|$)/)) {
        str = str.replace(/\./g, '');
      }
      // Inaczej zostawiamy kropkę jako separator dziesiętny
    }
    
    // Parsuj na liczbę
    let result = parseFloat(str);
    
    if (isNaN(result)) {
      return 0;
    }
    
    // Jeśli to był procent, podziel przez 100
    if (isPercent && result > 1) {
      result = result / 100;
    }
    
    return result;
  }

  // GŁÓWNA FUNKCJA - ZSYNCHRONIZOWANE CZYSZCZENIE
  cleanReportData(rawData, headers, sheetName) {
    if (!rawData || rawData.length < 2) {
      this.logger.log(`⚠️ No data to clean in ${sheetName}`, 'WARNING');
      return rawData;
    }

    this.loadExchangeRates();
    
    this.logger.log(`🚀 SUPER CLEANING START for ${sheetName} (${rawData.length} rows)`, 'INFO');
    
    // KROK 1: Deep Copy danych (nie zmieniamy oryginału)
    let cleanedData = rawData.map(row => [...row]);
    
    // KROK 2: Identyfikuj kolumny numeryczne na podstawie nagłówków
    const numericColumns = this.identifyNumericColumns(headers);
    const currencyColumns = this.identifyCurrencyColumns(headers);
    
    this.logger.log(`📊 Numeric columns: [${Array.from(numericColumns).join(', ')}]`, 'INFO');
    this.logger.log(`💰 Currency columns: [${Array.from(currencyColumns).join(', ')}]`, 'INFO');
    
    // KROK 3: Jeśli nie znaleźliśmy kolumn numerycznych, fallback analysis
    if (numericColumns.size === 0) {
      this.logger.log(`🔍 No numeric columns found by headers, trying data analysis...`, 'WARNING');
      return this.fallbackCleaning(cleanedData, sheetName);
    }
    
    let totalCleaningOperations = 0;
    let numberConversions = 0;
    let currencyConversions = 0;
    
    // KROK 4: CZYSZCZENIE - każda komórka osobno
    for (let rowIndex = 1; rowIndex < cleanedData.length; rowIndex++) {
      for (let colIndex = 0; colIndex < cleanedData[rowIndex].length; colIndex++) {
        // Czyść tylko kolumny numeryczne
        if (!numericColumns.has(colIndex)) continue;
        
        let originalValue = cleanedData[rowIndex][colIndex];
        
        // Skip jeśli już jest dobrą liczbą
        if (typeof originalValue === 'number' && !isNaN(originalValue) && originalValue >= 0 && originalValue < 1000000) {
          continue;
        }
        
        // UŻYWAMY NOWEJ METODY parseNumber()
        let numericValue = this.parseNumber(originalValue);
        
        // Wykryj walutę jeśli to kolumna walutowa
        let currency = 'EUR';
        if (currencyColumns.has(colIndex)) {
          currency = this.detectCurrencyInValue(originalValue);
        }
        
        // Konwersja walut na EUR
        if (currency !== 'EUR' && numericValue > 0) {
          numericValue = this.convertToEUR(numericValue, currency);
          currencyConversions++;
        }
        
        // Zapisz wynik
        cleanedData[rowIndex][colIndex] = numericValue;
        numberConversions++;
        totalCleaningOperations++;
        
        // Debug log dla pierwszych kilku konwersji
        if (rowIndex <= 3 && originalValue && String(originalValue).length > 0) {
          this.logger.log(`✅ CLEANED [${rowIndex}][${colIndex}]: "${originalValue}" → ${numericValue}`, 'DEBUG');
        }
      }
    }
    
    this.logger.log(`✅ CLEANING COMPLETE for ${sheetName}:`, 'SUCCESS');
    this.logger.log(`📊 Total operations: ${totalCleaningOperations}`, 'SUCCESS');
    this.logger.log(`🔢 Number conversions: ${numberConversions}`, 'SUCCESS');
    this.logger.log(`💱 Currency conversions: ${currencyConversions}`, 'SUCCESS');
    
    // WALIDACJA: Sprawdź kilka przykładowych wartości po czyszczeniu
    this.validateCleanedData(cleanedData, numericColumns, sheetName);
    
    return cleanedData;
  }

  // POPRAWIONA identyfikacja kolumn numerycznych
  identifyNumericColumns(headers) {
    const numericColumns = new Set();
    
    // Pobierz prawdziwe nagłówki
    let headerArray = headers;
    if (Array.isArray(headers) && headers.length === 1 && Array.isArray(headers[0])) {
      headerArray = headers[0];
    }
    
    if (!Array.isArray(headerArray)) {
      this.logger.log(`❌ Invalid headers structure: ${typeof headers}`, 'ERROR');
      return numericColumns;
    }

    this.logger.log(`🔍 Analyzing ${headerArray.length} headers for numeric patterns`, 'DEBUG');

    // WZORCE NUMERYCZNE - rozszerzone z rzeczywistymi nazwami kolumn
    const numericPatterns = [
      // Podstawowe metryki
      'impression', 'click', 'spend', 'cost', 'sales', 'revenue', 'order', 'unit',
      
      // Niemieckie
      'ausgaben', 'kosten', 'verkäufe', 'umsatz', 'klick', 'impression', 'bestell', 'einheit',
      
      // Polskie
      'wydatki', 'koszty', 'sprzedaż', 'obrót', 'kliknięcia', 'wyświetlenia', 'zamówienia', 'jednostki',
      
      // Metryki obliczone
      'acos', 'roas', 'ctr', 'cvr', 'cpc', 'cpm', 'bid', 'gebot', 'stawka',
      
      // Budżety i stawki
      'budget', 'tagesbudget', 'daily', 'recommended',
      
      // Procenty i stawki
      'rate', 'prozent', 'percentage', '%',
      
      // Konwersje
      'converted', 'umgewandelt', 'konwersji',
      
      // Inne numeryczne
      'total', 'gesamt', 'day', 'tage', 'average', 'durchschnitt',
      
      // Wzorce z cyframi
      '7 day', '#', 'range', 'missed', 'estimated', 'last year'
    ];

    headerArray.forEach((header, index) => {
      const headerLower = (header || '').toString().toLowerCase().trim();
      
      if (headerLower === '') return;
      
      // Sprawdź wzorce
      let matches = false;
      numericPatterns.forEach(pattern => {
        if (headerLower.includes(pattern)) {
          matches = true;
          this.logger.log(`✅ NUMERIC PATTERN [${index}]: "${headerLower}" contains "${pattern}"`, 'DEBUG');
        }
      });
      
      // Sprawdź czy zawiera typowe numeryczne słowa kluczowe
      if (!matches) {
        const numericKeywords = ['sales', 'spend', 'cost', 'click', 'impression', 'order', 'unit', 'budget', 'bid'];
        matches = numericKeywords.some(keyword => headerLower.includes(keyword));
      }
      
      if (matches) {
        numericColumns.add(index);
        this.logger.log(`✅ ADDED NUMERIC COLUMN [${index}]: "${header}"`, 'SUCCESS');
      }
    });

    this.logger.log(`📊 Found ${numericColumns.size} numeric columns`, 'INFO');
    return numericColumns;
  }

  // Identyfikacja kolumn walutowych
  identifyCurrencyColumns(headers) {
    const currencyColumns = new Set();
    let headerArray = Array.isArray(headers) && headers.length === 1 && Array.isArray(headers[0]) ? headers[0] : headers;
    
    if (!Array.isArray(headerArray)) return currencyColumns;

    const currencyPatterns = ['spend', 'cost', 'sales', 'revenue', 'budget', 'bid', 'cpc', 'cpm', 'ausgaben', 'kosten', 'verkäufe', 'umsatz', 'wydatki', 'sprzedaż'];

    headerArray.forEach((header, index) => {
      const headerLower = (header || '').toString().toLowerCase();
      if (currencyPatterns.some(pattern => headerLower.includes(pattern))) {
        currencyColumns.add(index);
      }
    });

    return currencyColumns;
  }

  // FALLBACK cleaning gdy nie można znaleźć kolumn po nazwach
  fallbackCleaning(data, sheetName) {
    this.logger.log(`🆘 FALLBACK CLEANING for ${sheetName}`, 'WARNING');
    
    // Sprawdź każdą kolumnę czy zawiera numeryczne dane
    const potentialNumericColumns = new Set();
    
    // Analiza pierwszych 10 wierszy danych
    for (let colIndex = 0; colIndex < (data[0] || []).length; colIndex++) {
      let numericCount = 0;
      let totalCount = 0;
      
      for (let rowIndex = 1; rowIndex < Math.min(11, data.length); rowIndex++) {
        if (data[rowIndex] && data[rowIndex][colIndex] !== undefined) {
          const value = data[rowIndex][colIndex];
          totalCount++;
          
          if (this.looksNumeric(value)) {
            numericCount++;
          }
        }
      }
      
      // Jeśli >60% wartości w kolumnie wygląda numerycznie
      if (totalCount > 0 && (numericCount / totalCount) > 0.6) {
        potentialNumericColumns.add(colIndex);
        this.logger.log(`🆘 FALLBACK FOUND NUMERIC COLUMN [${colIndex}]: ${numericCount}/${totalCount} numeric values`, 'INFO');
      }
    }
    
    // Czyść tylko potencjalne kolumny numeryczne
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      for (let colIndex = 0; colIndex < data[rowIndex].length; colIndex++) {
        if (potentialNumericColumns.has(colIndex)) {
          const originalValue = data[rowIndex][colIndex];
          
          if (this.looksNumeric(originalValue)) {
            // UŻYWAMY NOWEJ METODY parseNumber()
            const numeric = this.parseNumber(originalValue);
            
            data[rowIndex][colIndex] = numeric;
            
            if (rowIndex <= 3) {
              this.logger.log(`🆘 FALLBACK [${rowIndex}][${colIndex}]: "${originalValue}" → ${numeric}`, 'DEBUG');
            }
          }
        }
      }
    }
    
    return data;
  }

  // Sprawdź czy wartość wygląda na numeryczną
  looksNumeric(value) {
    if (typeof value === 'number') return true;
    if (value === null || value === undefined) return false;
    
    const str = String(value).trim();
    if (str === '' || str === '-') return false;
    
    // Sprawdź czy zawiera cyfry i typowe znaki numeryczne
    const hasNumbers = /\d/.test(str);
    const hasNumericChars = /[\d,.\€\$£¥%]/.test(str);
    const isNotPureText = !/^[a-zA-Z\s]+$/.test(str);
    
    return hasNumbers && hasNumericChars && isNotPureText;
  }

  // Walidacja oczyszczonych danych
  validateCleanedData(cleanedData, numericColumns, sheetName) {
    this.logger.log(`🔍 VALIDATING CLEANED DATA for ${sheetName}`, 'DEBUG');
    
    let goodValues = 0;
    let totalValues = 0;
    
    for (let rowIndex = 1; rowIndex < Math.min(6, cleanedData.length); rowIndex++) {
      for (let colIndex of numericColumns) {
        if (cleanedData[rowIndex] && cleanedData[rowIndex][colIndex] !== undefined) {
          const val = cleanedData[rowIndex][colIndex];
          totalValues++;
          
          if (typeof val === 'number' && !isNaN(val) && val >= 0) {
            goodValues++;
            this.logger.log(`✅ VALID [${rowIndex}][${colIndex}]: ${val}`, 'DEBUG');
          } else {
            this.logger.log(`❌ INVALID [${rowIndex}][${colIndex}]: ${val} (type: ${typeof val})`, 'WARNING');
          }
        }
      }
    }
    
    const successRate = totalValues > 0 ? (goodValues / totalValues * 100) : 0;
    this.logger.log(`📊 VALIDATION: ${goodValues}/${totalValues} valid values (${successRate.toFixed(1)}%)`, 'INFO');
  }

  // STARE METODY (zostawione dla kompatybilności wstecznej)
  
  // ULTRA CZYSZCZENIE TEKSTU
  ultraCleanText(value) {
    if (value === null || value === undefined) return '';
    
    let str = String(value).trim();
    if (str === '' || str === '-' || str === '--') return '0';
    
    // Usuń apostrofy (powodują problemy w Google Sheets)
    str = str.replace(/'/g, '');
    
    // Usuń wszystkie symbole walut
    const currencySymbols = ['€', '$', '£', '¥', '₹', 'zł', 'kr', 'SEK', 'USD', 'EUR', 'GBP', 'PLN', 'TRY', 'JPY', 'CAD', 'AUD', 'NOK', 'DKK', 'CHF'];
    currencySymbols.forEach(symbol => {
      str = str.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    });
    
    // Usuń dodatkowe spacje
    str = str.replace(/\s+/g, '');
    
    // Usuń inne niepotrzebne znaki (zachowaj tylko cyfry, kropki, przecinki, minusy, procenty)
    str = str.replace(/[^\d,.-]/g, '');
    
    return str;
  }

  // Konwertuj EU format na US format  
  convertEUToUSFormat(value) {
    // Ta metoda nie jest już używana - zastąpiona przez parseNumber()
    return this.parseNumber(value);
  }

  // AGRESYWNA konwersja na liczbę
  forceToNumber(value) {
    // Ta metoda nie jest już używana - zastąpiona przez parseNumber()
    return this.parseNumber(value);
  }

  // Wykryj walutę w wartości
  detectCurrencyInValue(value) {
    const str = String(value || '').toLowerCase();
    if (str.includes('gbp') || str.includes('£')) return 'GBP';
    if (str.includes('usd') || str.includes('$')) return 'USD';
    if (str.includes('pln') || str.includes('zł')) return 'PLN';
    if (str.includes('sek') || str.includes('kr')) return 'SEK';
    if (str.includes('try')) return 'TRY';
    if (str.includes('jpy') || str.includes('¥')) return 'JPY';
    if (str.includes('cad')) return 'CAD';
    if (str.includes('aud')) return 'AUD';
    if (str.includes('nok')) return 'NOK';
    if (str.includes('dkk')) return 'DKK';
    if (str.includes('chf')) return 'CHF';
    return 'EUR';
  }

  // Konwertuj na EUR
  convertToEUR(value, fromCurrency) {
    if (fromCurrency === 'EUR') return value;
    const rate = this.exchangeRates[fromCurrency];
    if (!rate) {
      this.logger.log(`⚠️ Unknown currency: ${fromCurrency}, using value as-is`, 'WARNING');
      return value;
    }
    return value * rate;
  }

  // KOMPATYBILNOŚĆ WSTECZNA
  cleanAllReports(reports) { 
    this.loadExchangeRates();
    reports.forEach(report => {
      if (report && report.rawData && report.headers) {
        report.data = this.cleanReportData(report.rawData, report.headers, report.sheetName || 'Unknown');
      }
    });
    return reports;
  }
}