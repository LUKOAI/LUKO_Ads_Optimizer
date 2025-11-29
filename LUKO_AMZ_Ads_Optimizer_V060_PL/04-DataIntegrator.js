// ===== 04-DATAINTEGRATOR-FIXED.JS - KOMPLETNY INTEGRATOR DANYCH =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 6.1 FIXED
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// FIX: Poprawione mapowanie kolumn i parsowanie walut

class UltraDataIntegrator {
  constructor(logger) {
    this.logger = logger || { log: (msg, lvl) => console.log(`[${lvl}] ${msg}`) };

    // KOMPLETNE MAPOWANIE WSZYSTKICH MOŻLIWYCH KOLUMN AMAZON
    this.columnMapping = {
      // ===== SALES/REVENUE - WSZYSTKIE WARIANTY =====
      'sales': [
        // ANGIELSKIE
        '7 Day Total Sales', '7 day total sales', '7 DAY TOTAL SALES',
        'Total Sales', 'total sales', 'TOTAL SALES',
        'Sales (converted)', 'sales (converted)', 'SALES (CONVERTED)',
        'Sales', 'sales', 'SALES',
        'Revenue', 'revenue', 'REVENUE',

        // NIEMIECKIE
        'Verkäufe (umgewandelt)', 'verkäufe (umgewandelt)', 'VERKÄUFE (UMGEWANDELT)',
        'Verkäufe', 'verkäufe', 'VERKÄUFE',
        'Umsatz (umgewandelt)', 'umsatz (umgewandelt)', 'UMSATZ (UMGEWANDELT)',
        'Umsatz', 'umsatz', 'UMSATZ',
        '7 Tage, Umsatz gesamt', '7 tage, umsatz gesamt',

        // POLSKIE
        'Sprzedaż (po konwersji)', 'sprzedaż (po konwersji)',
        'Sprzedaż', 'sprzedaż', 'SPRZEDAŻ',

        // FRANCUSKIE
        'Ventes (converties)', 'ventes (converties)', 'VENTES (CONVERTIES)',
        'Ventes', 'ventes', 'VENTES'
      ],

      // ===== SPEND/COST - WSZYSTKIE WARIANTY =====
      'spend': [
        // ANGIELSKIE
        'Spend', 'spend', 'SPEND',
        'Spend (converted)', 'spend (converted)', 'SPEND (CONVERTED)',
        'Cost', 'cost', 'COST',
        'Cost (converted)', 'cost (converted)', 'COST (CONVERTED)',
        'Total Spend', 'total spend', 'TOTAL SPEND',

        // NIEMIECKIE
        'Ausgaben (umgewandelt)', 'ausgaben (umgewandelt)', 'AUSGABEN (UMGEWANDELT)',
        'Ausgaben', 'ausgaben', 'AUSGABEN',
        'Kosten', 'kosten', 'KOSTEN',

        // POLSKIE
        'Wydatki (po konwersji)', 'wydatki (po konwersji)',
        'Wydatki', 'wydatki', 'WYDATKI'
      ],

      // ===== ORDERS - WSZYSTKIE WARIANTY =====
      'orders': [
        // ANGIELSKIE
        '7 Day Total Orders (#)', '7 day total orders (#)', '7 DAY TOTAL ORDERS (#)',
        '7 Day Total Orders', '7 day total orders',
        'Total Orders', 'total orders', 'TOTAL ORDERS',
        'Orders', 'orders', 'ORDERS',
        'Purchases', 'purchases', 'PURCHASES',

        // NIEMIECKIE
        'Bestellungen', 'bestellungen', 'BESTELLUNGEN',
        '7 Tage, Aufträge gesamt (#)', '7 tage, aufträge gesamt (#)',
        'Aufträge', 'aufträge', 'AUFTRÄGE',

        // POLSKIE
        'Zamówienia', 'zamówienia', 'ZAMÓWIENIA'
      ],

      // ===== IMPRESSIONS =====
      'impressions': [
        'Impressions', 'impressions', 'IMPRESSIONS',
        'Impressionen', 'impressionen', 'IMPRESSIONEN',
        'Wyświetlenia', 'wyświetlenia', 'WYŚWIETLENIA'
      ],

      // ===== CLICKS =====
      'clicks': [
        'Clicks', 'clicks', 'CLICKS',
        'Klicks', 'klicks', 'KLICKS',
        'Kliknięcia', 'kliknięcia', 'KLIKNIĘCIA'
      ],

      // ===== CAMPAIGN =====
      'campaign': [
        'Campaign Name', 'campaign name', 'CAMPAIGN NAME',
        'Campaign', 'campaign', 'CAMPAIGN',
        'Campaigns', 'campaigns', 'CAMPAIGNS',
        'Kampagnen-Name', 'kampagnen-name', 'KAMPAGNEN-NAME',
        'Kampagnenname', 'kampagnenname', 'KAMPAGNENNAME',
        'Kampagnen', 'kampagnen', 'KAMPAGNEN'
      ],

      // ===== ACOS =====
      'acos': [
        'Total Advertising Cost of Sales (ACOS)', 'total advertising cost of sales (acos)',
        'ACOS', 'acos',
        'Advertising Cost of Sales', 'advertising cost of sales',
        'Zugeschriebene Umsatzkosten (ACOS)', 'zugeschriebene umsatzkosten (acos)',
        'Udział kosztu reklamy w przychodach'
      ],

      // ===== ROAS =====
      'roas': [
        'Total Return on Advertising Spend (ROAS)', 'total return on advertising spend (roas)',
        'ROAS', 'roas',
        'Return on Advertising Spend', 'return on advertising spend',
        'Gesamte Rentabilität der Anzeigenkosten (ROAS)', 'gesamte rentabilität der anzeigenkosten (roas)',
        'Zwrot z wydatków na reklamę'
      ],

      // ===== CTR =====
      'ctr': [
        'Click-Thru Rate (CTR)', 'click-thru rate (ctr)', 'CLICK-THRU RATE (CTR)',
        'Click Through Rate', 'click through rate',
        'CTR', 'ctr',
        'Klickrate', 'klickrate', 'KLICKRATE'
      ],

      // ===== CPC =====
      'cpc': [
        'Cost Per Click (CPC)', 'cost per click (cpc)', 'COST PER CLICK (CPC)',
        'CPC', 'cpc',
        'Avg CPC', 'avg cpc', 'AVG CPC',
        'Kosten pro Klick', 'kosten pro klick'
      ]
    };
  }

  // GŁÓWNA FUNKCJA INTEGRACJI
  integrateData(reports) {
    this.logger.log('🔗 Starting data integration with COMPLETE column mapping...', 'INFO');

    const integratedData = {
      totals: {
        sales: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        orders: 0,
        acos: 0,
        roas: 0,
        ctr: 0,
        cpc: 0,
        conversionRate: 0,
        averageOrderValue: 0
      },
      campaigns: new Map(),
      reports: reports.length,
      rawData: []
    };

    reports.forEach((report, index) => {
      this.logger.log(`📊 Processing report ${index + 1}/${reports.length}: ${report.sheetName}`, 'INFO');

      try {
        // MAPUJ KOLUMNY Z KOMPLETNYM LOGOWANIEM
        const columnMap = this.mapColumnsAdvanced(report.headers);
        this.logColumnMapping(columnMap, report.headers);

        // SPRAWDŹ KLUCZOWE KOLUMNY
        const hasSales = columnMap.sales !== undefined;
        const hasSpend = columnMap.spend !== undefined;
        const hasOrders = columnMap.orders !== undefined;

        this.logger.log(`🔍 KEY COLUMNS: Sales=${hasSales ? 'FOUND' : 'MISSING'}, Spend=${hasSpend ? 'FOUND' : 'MISSING'}, Orders=${hasOrders ? 'FOUND' : 'MISSING'}`, 'INFO');

        if (!hasSales) {
          this.logger.log(`❌ SALES column not found! Available headers: ${report.headers.join(', ')}`, 'ERROR');
        }

        if (!hasSpend) {
          this.logger.log(`❌ SPEND column not found! Available headers: ${report.headers.join(', ')}`, 'ERROR');
        }

        // PRZETWÓRZ DANE NAWET JEŚLI BRAKUJE NIEKTÓRYCH KOLUMN
        this.processReportData(report, columnMap, integratedData);

      } catch (error) {
        this.logger.log(`❌ Error processing report ${report.sheetName}: ${error.message}`, 'ERROR');
      }
    });

    // OBLICZ FINALNE METRYKI
    this.calculateFinalMetrics(integratedData);

    this.logger.log(`✅ Integration complete - Sales: ${integratedData.totals.sales.toFixed(2)}€, Spend: ${integratedData.totals.spend.toFixed(2)}€`, 'SUCCESS');
    this.logger.log(`📊 Final ACOS: ${integratedData.totals.acos.toFixed(1)}%, ROAS: ${integratedData.totals.roas.toFixed(2)}`, 'INFO');

    return integratedData;
  }

  // ZAAWANSOWANE MAPOWANIE KOLUMN
  mapColumnsAdvanced(headers) {
    this.logger.log('🧠 Starting advanced column mapping...', 'DEBUG');

    const mapping = {};
    const usedColumns = new Set();

    // ITERUJ PRZEZ KAŻDE POLE KTÓRE CHCEMY ZNALEŹĆ
    Object.entries(this.columnMapping).forEach(([fieldName, possibleNames]) => {
      let bestMatch = null;
      let bestPriority = -1;

      // SPRAWDŹ KAŻDY HEADER
      headers.forEach((header, index) => {
        if (usedColumns.has(index)) return;

        const headerStr = (header || '').toString().trim();
        if (!headerStr) return;

        // SPRAWDŹ CZY HEADER PASUJE DO JAKIEJŚ NAZWY
        possibleNames.forEach((possibleName, priority) => {
          if (headerStr === possibleName) {
            // PRIORYTET: im wcześniej w tablicy, tym wyższy priorytet
            let currentPriority = possibleNames.length - priority;

            // BONUS dla (converted) i Total
            if (possibleName.includes('(converted)') || possibleName.includes('Total')) {
              currentPriority += 1000;
            }

            if (currentPriority > bestPriority) {
              bestMatch = { index: index, header: headerStr, priority: currentPriority };
              bestPriority = currentPriority;
            }
          }
        });
      });

      // ZAPISZ NAJLEPSZE DOPASOWANIE
      if (bestMatch) {
        mapping[fieldName] = bestMatch.index;
        usedColumns.add(bestMatch.index);

        this.logger.log(`✅ MAPPED ${fieldName} → Column ${bestMatch.index}: "${bestMatch.header}" (priority: ${bestMatch.priority})`, 'DEBUG');
      }
    });

    return mapping;
  }

  // LOGOWANIE MAPOWANIA KOLUMN
  logColumnMapping(columnMap, headers) {
    this.logger.log('📋 FINAL COLUMN MAPPING:', 'INFO');

    Object.entries(columnMap).forEach(([field, colIndex]) => {
      this.logger.log(`  ${field} → Column ${colIndex}: "${headers[colIndex]}"`, 'INFO');
    });

    // Pokaż niezmapowane kolumny
    const unmappedCols = headers
      .map((header, index) => ({ header, index }))
      .filter(col => !Object.values(columnMap).includes(col.index))
      .map(col => `"${col.header}"`)
      .slice(0, 10);

    if (unmappedCols.length > 0) {
      this.logger.log(`⚠️ Unmapped columns: ${unmappedCols.join(', ')}${unmappedCols.length < headers.length - Object.keys(columnMap).length ? '...' : ''}`, 'WARNING');
    }
  }

  // PRZETWARZANIE DANYCH RAPORTU
  processReportData(report, columnMap, integratedData) {
    const sheet = report.sheet;
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      this.logger.log(`⚠️ Sheet ${report.sheetName} has no data rows`, 'WARNING');
      return;
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const values = dataRange.getValues();

    this.logger.log(`📊 Processing ${values.length} data rows from ${report.sheetName}`, 'INFO');

    let rowsProcessed = 0;
    let salesSum = 0;
    let spendSum = 0;
    let ordersSum = 0;

    values.forEach((row, rowIndex) => {
      try {
        // WYCIĄGNIJ WARTOŚCI Z PRECYZYJNYM PARSOWANIEM
        const sales = this.parseGermanCurrency(this.getValue(row, columnMap.sales));
        const spend = this.parseGermanCurrency(this.getValue(row, columnMap.spend));
        const impressions = this.parseNumber(this.getValue(row, columnMap.impressions));
        const clicks = this.parseNumber(this.getValue(row, columnMap.clicks));
        const orders = this.parseNumber(this.getValue(row, columnMap.orders));

        // WALIDUJ DANE
        if (sales < 0 || spend < 0) {
          this.logger.log(`⚠️ Row ${rowIndex + 2}: Negative values detected - Sales: ${sales}, Spend: ${spend}`, 'WARNING');
          return;
        }

        // AGREGUJ TOTALE
        integratedData.totals.sales += sales;
        integratedData.totals.spend += spend;
        integratedData.totals.impressions += impressions;
        integratedData.totals.clicks += clicks;
        integratedData.totals.orders += orders;

        // LOKALNE SUMY DLA DEBUGOWANIA
        salesSum += sales;
        spendSum += spend;
        ordersSum += orders;

        // AGREGUJ NA POZIOMIE KAMPANII
        const campaignName = this.getValue(row, columnMap.campaign);
        if (campaignName) {
          this.aggregateCampaignData(integratedData.campaigns, campaignName, {
            sales, spend, impressions, clicks, orders
          });
        }

        rowsProcessed++;

      } catch (error) {
        this.logger.log(`❌ Error processing row ${rowIndex + 2}: ${error.message}`, 'WARNING');
      }
    });

    this.logger.log(`✅ Processed ${rowsProcessed}/${values.length} rows from ${report.sheetName}`, 'SUCCESS');
    this.logger.log(`📊 Report totals - Sales: ${salesSum.toFixed(2)}€, Spend: ${spendSum.toFixed(2)}€, Orders: ${ordersSum}`, 'INFO');

    if (spendSum > 0 && salesSum > 0) {
      const reportAcos = (spendSum / salesSum) * 100;
      this.logger.log(`📊 Report ACOS: ${reportAcos.toFixed(1)}%`, 'INFO');
    }
  }

  // POBRANIE WARTOŚCI Z WIERSZA
  getValue(row, columnIndex) {
    if (columnIndex === undefined || columnIndex >= row.length) {
      return null;
    }
    return row[columnIndex];
  }

  // PARSOWANIE NIEMIECKIEJ WALUTY (EUR format)
  parseGermanCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    let str = value.toString().trim();
    if (str === '' || str === '-' || str === 'N/A') return 0;

    // Usuń symbole walut
    str = str.replace(/[€$£¥\s]/g, '');

    // Format niemiecki: 1.234,56 → 1234.56
    if (/^\d{1,3}(?:\.\d{3})*,\d{1,2}$/.test(str)) {
      str = str.replace(/\./g, '').replace(',', '.');
      return parseFloat(str) || 0;
    }

    // Format angielski: 1,234.56 → 1234.56
    if (/^\d{1,3}(?:,\d{3})*\.\d{1,2}$/.test(str)) {
      str = str.replace(/,/g, '');
      return parseFloat(str) || 0;
    }

    // Duże liczby bez decimali
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(str)) {
      str = str.replace(/[.,]/g, '');
      return parseFloat(str) || 0;
    }

    // Zwykły format z przecinkiem jako separator dziesiętny
    if (str.includes(',') && !str.includes('.')) {
      str = str.replace(',', '.');
    }

    // Usuń wszystkie nie-numeryczne znaki
    str = str.replace(/[^\d.-]/g, '');

    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  }

  // PARSOWANIE LICZB
  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = value.toString().replace(/[^\d.-]/g, '');
    const parsed = parseInt(str) || 0;
    return parsed < 0 ? 0 : parsed;
  }

  // AGREGACJA DANYCH KAMPANII
  aggregateCampaignData(campaigns, campaignName, data) {
    if (!campaigns.has(campaignName)) {
      campaigns.set(campaignName, {
        name: campaignName,
        sales: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        orders: 0
      });
    }

    const campaign = campaigns.get(campaignName);
    campaign.sales += data.sales;
    campaign.spend += data.spend;
    campaign.impressions += data.impressions;
    campaign.clicks += data.clicks;
    campaign.orders += data.orders;
  }

  // OBLICZANIE FINALNYCH METRYK
  calculateFinalMetrics(integratedData) {
    const totals = integratedData.totals;

    // ACOS = (Spend / Sales) * 100
    if (totals.sales > 0 && totals.spend > 0) {
      totals.acos = (totals.spend / totals.sales) * 100;
      totals.roas = totals.sales / totals.spend;
    } else {
      totals.acos = 0;
      totals.roas = 0;
    }

    // CTR = (Clicks / Impressions) * 100
    if (totals.impressions > 0 && totals.clicks > 0) {
      totals.ctr = (totals.clicks / totals.impressions) * 100;
    } else {
      totals.ctr = 0;
    }

    // CPC = Spend / Clicks
    if (totals.clicks > 0 && totals.spend > 0) {
      totals.cpc = totals.spend / totals.clicks;
    } else {
      totals.cpc = 0;
    }

    // Conversion Rate = (Orders / Clicks) * 100
    if (totals.clicks > 0 && totals.orders > 0) {
      totals.conversionRate = (totals.orders / totals.clicks) * 100;
    } else {
      totals.conversionRate = 0;
    }

    // Average Order Value
    if (totals.orders > 0 && totals.sales > 0) {
      totals.averageOrderValue = totals.sales / totals.orders;
    } else {
      totals.averageOrderValue = 0;
    }

    this.logger.log(`🧮 Final metrics calculated:`, 'SUCCESS');
    this.logger.log(`  ACOS: ${totals.acos.toFixed(2)}%`, 'INFO');
    this.logger.log(`  ROAS: ${totals.roas.toFixed(2)}`, 'INFO');
    this.logger.log(`  CTR: ${totals.ctr.toFixed(2)}%`, 'INFO');
    this.logger.log(`  CPC: ${totals.cpc.toFixed(2)}€`, 'INFO');
    this.logger.log(`  Conv Rate: ${totals.conversionRate.toFixed(2)}%`, 'INFO');
  }
}