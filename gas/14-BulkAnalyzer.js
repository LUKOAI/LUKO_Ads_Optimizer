/**
 * BULK ANALYZER - Szczegółowa analiza targetów
 * Wykorzystuje dane z mapowania lub robi analizę od zera
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkAnalyzer = {
  
  /**
   * Główna funkcja analizy
   */
  runAnalysis(mappingResult = null) {
    Logger.log('=== BULK ANALYZER START ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bulkSource = ss.getSheetByName('BULK_Source');
    
    if (!bulkSource || bulkSource.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert('❌ Brak danych w BULK_Source!');
      return;
    }
    
    // Jeśli nie ma mapowania, spróbuj utworzyć
    if (!mappingResult) {
      mappingResult = BulkMapper.mapCampaigns();
    }
    
    const bulkData = bulkSource.getDataRange().getValues();
    const headers = bulkData[0];
    const columns = BulkMapper.identifyBulkColumns(headers);
    
    // Pobierz ustawienia ACOS
    const breakEvenACOS = this.getBreakEvenACOS();
    
    // Analiza każdego targetu
    const analysis = {
      summary: {
        totalTargets: 0,
        activeTargets: 0,
        pausedTargets: 0,
        totalSpend: 0,
        totalSales: 0,
        totalOrders: 0,
        totalClicks: 0,
        totalImpressions: 0,
        overallACOS: 0,
        overallROAS: 0
      },
      segments: {
        lossMakers: [],      // ACOS > 2x break even
        highACOS: [],        // ACOS > break even
        optimal: [],         // ACOS około break even
        profitable: [],      // ACOS < break even
        zeroSales: [],       // Kliknięcia bez sprzedaży
        noImpressions: [],   // Bez wyświetleń
        lowCTR: [],          // CTR < 0.1%
        highPerformers: []   // Top 20% ROAS
      },
      pareto: {
        revenue80: [],       // Targety generujące 80% przychodu
        orders80: [],        // Targety generujące 80% zamówień
        spend80: [],         // Targety pochłaniające 80% budżetu
        clicks80: []         // Targety generujące 80% kliknięć
      },
      recommendations: [],
      campaigns: {}           // Analiza per kampania
    };
    
    // Przetwarzanie danych
    for (let i = 1; i < bulkData.length; i++) {
      const row = bulkData[i];
      if (!row[0]) continue; // Pomiń puste wiersze
      
      const target = this.parseTargetData(row, columns, i);
      
      // Dodaj dane z mapowania jeśli istnieją
      if (mappingResult && mappingResult.mappingTable) {
        const key = BulkMapper.createMappingKey(
          target.campaignId, 
          target.adGroupId, 
          target.keywordId
        );
        
        if (mappingResult.mappingTable[key]) {
          target.analysisMetrics = mappingResult.mappingTable[key].metrics;
        }
      }
      
      // Klasyfikacja targetu
      this.classifyTarget(target, analysis, breakEvenACOS);
      
      // Agregacja per kampania
      if (!analysis.campaigns[target.campaignName]) {
        analysis.campaigns[target.campaignName] = {
          name: target.campaignName,
          id: target.campaignId,
          targets: [],
          totalSpend: 0,
          totalSales: 0,
          totalOrders: 0,
          totalClicks: 0,
          totalImpressions: 0,
          campaignACOS: 0,
          budget: target.budget,
          budgetUtilization: 0
        };
      }
      
      analysis.campaigns[target.campaignName].targets.push(target);
      analysis.campaigns[target.campaignName].totalSpend += target.spend;
      analysis.campaigns[target.campaignName].totalSales += target.sales;
      analysis.campaigns[target.campaignName].totalOrders += target.orders;
      analysis.campaigns[target.campaignName].totalClicks += target.clicks;
      analysis.campaigns[target.campaignName].totalImpressions += target.impressions;
    }
    
    // Obliczenia Pareto (80/20)
    this.calculateParetoDistribution(analysis);
    
    // Generowanie rekomendacji
    this.generateRecommendations(analysis, breakEvenACOS);
    
    // Tworzenie arkusza z wynikami
    this.createAnalysisSheet(analysis, headers);
    
    // Pokaż podsumowanie
    this.showAnalysisSummary(analysis);
    
    return analysis;
  },
  
  /**
   * Parsowanie danych targetu
   */
  parseTargetData(row, columns, rowIndex) {
    const target = {
      rowIndex: rowIndex,
      campaignId: row[columns.campaignId] || '',
      campaignName: row[columns.campaignName] || '',
      adGroupId: row[columns.adGroupId] || '',
      adGroupName: row[columns.adGroupName] || '',
      keywordId: row[columns.keywordId] || '',
      keywordText: row[columns.keywordText] || '',
      bid: BulkMapper.parseNumber(row[columns.bid]),
      state: row[columns.state] || row[columns.status] || 'enabled',
      impressions: BulkMapper.parseNumber(row[columns.impressions]),
      clicks: BulkMapper.parseNumber(row[columns.clicks]),
      spend: BulkMapper.parseNumber(row[columns.spend]),
      sales: BulkMapper.parseNumber(row[columns.sales]),
      orders: BulkMapper.parseNumber(row[columns.orders]),
      acos: BulkMapper.parseNumber(row[columns.acos]),
      roas: BulkMapper.parseNumber(row[columns.roas]),
      cpc: BulkMapper.parseNumber(row[columns.cpc]),
      budget: BulkMapper.parseNumber(row[columns.budget]),
      originalRow: row
    };
    
    // Oblicz metryki jeśli brakuje
    if (!target.acos && target.spend > 0 && target.sales > 0) {
      target.acos = (target.spend / target.sales) * 100;
    }
    
    if (!target.roas && target.spend > 0) {
      target.roas = target.sales / target.spend;
    }
    
    if (!target.cpc && target.clicks > 0) {
      target.cpc = target.spend / target.clicks;
    }
    
    target.ctr = target.impressions > 0 ? (target.clicks / target.impressions) * 100 : 0;
    target.conversionRate = target.clicks > 0 ? (target.orders / target.clicks) * 100 : 0;
    
    return target;
  },
  
  /**
   * Klasyfikacja targetu
   */
  classifyTarget(target, analysis, breakEvenACOS) {
    analysis.summary.totalTargets++;
    
    if (target.state === 'enabled') {
      analysis.summary.activeTargets++;
    } else {
      analysis.summary.pausedTargets++;
    }
    
    analysis.summary.totalSpend += target.spend;
    analysis.summary.totalSales += target.sales;
    analysis.summary.totalOrders += target.orders;
    analysis.summary.totalClicks += target.clicks;
    analysis.summary.totalImpressions += target.impressions;
    
    // Klasyfikacja po wydajności
    if (target.clicks > 5 && target.orders === 0) {
      analysis.segments.zeroSales.push(target);
      target.classification = 'ZERO_SALES';
      target.recommendation = 'PAUSE';
      target.recommendationReason = `${target.clicks} kliknięć bez sprzedaży`;
      
    } else if (target.acos > breakEvenACOS * 2) {
      analysis.segments.lossMakers.push(target);
      target.classification = 'LOSS_MAKER';
      target.recommendation = 'ADD_NEGATIVE';
      target.recommendationReason = `ACOS ${target.acos.toFixed(1)}% > 2x break even`;
      
    } else if (target.acos > breakEvenACOS) {
      analysis.segments.highACOS.push(target);
      target.classification = 'HIGH_ACOS';
      target.recommendation = 'DECREASE_BID';
      target.suggestedBidChange = -20;
      target.recommendationReason = `ACOS ${target.acos.toFixed(1)}% > break even`;
      
    } else if (Math.abs(target.acos - breakEvenACOS) <= 5) {
      analysis.segments.optimal.push(target);
      target.classification = 'OPTIMAL';
      target.recommendation = 'MONITOR';
      target.recommendationReason = 'ACOS w optymalnym zakresie';
      
    } else if (target.acos < breakEvenACOS && target.acos > 0) {
      analysis.segments.profitable.push(target);
      target.classification = 'PROFITABLE';
      target.recommendation = 'INCREASE_BID';
      target.suggestedBidChange = 25;
      target.recommendationReason = `ACOS ${target.acos.toFixed(1)}% < break even - można skalować`;
      
    } else if (target.impressions === 0) {
      analysis.segments.noImpressions.push(target);
      target.classification = 'NO_IMPRESSIONS';
      target.recommendation = 'INCREASE_BID';
      target.suggestedBidChange = 50;
      target.recommendationReason = 'Brak wyświetleń - stawka za niska';
      
    } else if (target.ctr < 0.1) {
      analysis.segments.lowCTR.push(target);
      target.classification = 'LOW_CTR';
      target.recommendation = 'REVIEW_RELEVANCE';
      target.recommendationReason = `CTR ${target.ctr.toFixed(2)}% - niska trafność`;
    }
    
    // High performers (top 20% ROAS)
    if (target.roas > 5) {
      analysis.segments.highPerformers.push(target);
    }
  },
  
  /**
   * Obliczenia Pareto
   */
  calculateParetoDistribution(analysis) {
    // Wszystkie aktywne targety
    const allTargets = [];
    
    Object.values(analysis.segments).forEach(segment => {
      segment.forEach(target => {
        if (!allTargets.find(t => t.rowIndex === target.rowIndex)) {
          allTargets.push(target);
        }
      });
    });
    
    // 80% przychodów
    const sortedByRevenue = [...allTargets].sort((a, b) => b.sales - a.sales);
    const totalRevenue = allTargets.reduce((sum, t) => sum + t.sales, 0);
    let cumulativeRevenue = 0;
    
    for (const target of sortedByRevenue) {
      cumulativeRevenue += target.sales;
      analysis.pareto.revenue80.push(target);
      if (cumulativeRevenue >= totalRevenue * 0.8) break;
    }
    
    // 80% zamówień
    const sortedByOrders = [...allTargets].sort((a, b) => b.orders - a.orders);
    const totalOrders = allTargets.reduce((sum, t) => sum + t.orders, 0);
    let cumulativeOrders = 0;
    
    for (const target of sortedByOrders) {
      cumulativeOrders += target.orders;
      analysis.pareto.orders80.push(target);
      if (cumulativeOrders >= totalOrders * 0.8) break;
    }
    
    // 80% wydatków
    const sortedBySpend = [...allTargets].sort((a, b) => b.spend - a.spend);
    const totalSpend = allTargets.reduce((sum, t) => sum + t.spend, 0);
    let cumulativeSpend = 0;
    
    for (const target of sortedBySpend) {
      cumulativeSpend += target.spend;
      analysis.pareto.spend80.push(target);
      if (cumulativeSpend >= totalSpend * 0.8) break;
    }
  },
  
  /**
   * Generowanie rekomendacji
   */
  generateRecommendations(analysis, breakEvenACOS) {
    const recommendations = [];
    
    // 1. Natychmiastowe akcje - targety ze stratami
    if (analysis.segments.zeroSales.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'PAUSE_ZERO_SALES',
        targets: analysis.segments.zeroSales.length,
        impact: analysis.segments.zeroSales.reduce((sum, t) => sum + t.spend, 0),
        description: `Spauzuj ${analysis.segments.zeroSales.length} targetów bez sprzedaży`,
        expectedSaving: analysis.segments.zeroSales.reduce((sum, t) => sum + t.spend, 0)
      });
    }
    
    // 2. Dodanie negatywów
    if (analysis.segments.lossMakers.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'ADD_NEGATIVES',
        targets: analysis.segments.lossMakers.length,
        impact: analysis.segments.lossMakers.reduce((sum, t) => sum + t.spend, 0),
        description: `Dodaj ${analysis.segments.lossMakers.length} słów do negatywnych`,
        expectedSaving: analysis.segments.lossMakers.reduce((sum, t) => sum + t.spend, 0) * 0.7
      });
    }
    
    // 3. Optymalizacja stawek
    const bidOptimizationTargets = [
      ...analysis.segments.highACOS,
      ...analysis.segments.profitable
    ];
    
    if (bidOptimizationTargets.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'OPTIMIZE_BIDS',
        targets: bidOptimizationTargets.length,
        description: `Zoptymalizuj stawki dla ${bidOptimizationTargets.length} targetów`,
        expectedImprovement: 'ACOS -5%, Przychody +10%'
      });
    }
    
    // 4. Kampanie z niewykorzystanym budżetem
    Object.values(analysis.campaigns).forEach(campaign => {
      if (campaign.budget > 0) {
        const utilization = (campaign.totalSpend / campaign.budget) * 100;
        if (utilization < 80 && campaign.campaignACOS < breakEvenACOS) {
          recommendations.push({
            priority: 'LOW',
            action: 'INCREASE_BUDGET',
            campaignName: campaign.name,
            currentBudget: campaign.budget,
            suggestedBudget: campaign.budget * 1.3,
            description: `Zwiększ budżet kampanii "${campaign.name}" (wykorzystanie ${utilization.toFixed(0)}%)`
          });
        }
      }
    });
    
    analysis.recommendations = recommendations;
  },
  
  /**
   * Tworzenie arkusza z analizą
   */
  createAnalysisSheet(analysis, originalHeaders) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let builderSheet = ss.getSheetByName('BULK_Builder');
    
    if (!builderSheet) {
      builderSheet = ss.insertSheet('BULK_Builder');
    } else {
      builderSheet.clear();
    }
    
    // Kopiuj oryginalne nagłówki i dodaj kolumny analityczne
    const headers = [...originalHeaders];
    headers.push(
      '🎯 Classification',
      '💡 Recommendation', 
      '% Change',
      '📊 Reason',
      '💰 Expected Impact',
      '✅ Apply Change'
    );
    
    builderSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    builderSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Formatowanie nagłówków
    builderSheet.setFrozenRows(1);
    builderSheet.getRange(1, 1, 1, originalHeaders.length).setBackground('#e8f4f8');
    builderSheet.getRange(1, originalHeaders.length + 1, 1, 6).setBackground('#fff2cc');
    
    // Wypełnianie danymi
    let row = 2;
    const allTargets = [];
    
    // Zbierz wszystkie targety z klasyfikacją
    Object.values(analysis.segments).forEach(segment => {
      segment.forEach(target => {
        if (!allTargets.find(t => t.rowIndex === target.rowIndex)) {
          allTargets.push(target);
        }
      });
    });
    
    // Sortuj po priorytecie rekomendacji
    allTargets.sort((a, b) => {
      const priority = {
        'PAUSE': 1,
        'ADD_NEGATIVE': 2,
        'DECREASE_BID': 3,
        'INCREASE_BID': 4,
        'MONITOR': 5,
        'REVIEW_RELEVANCE': 6
      };
      return (priority[a.recommendation] || 99) - (priority[b.recommendation] || 99);
    });
    
    // Dodaj do arkusza
    allTargets.forEach(target => {
      const rowData = [...target.originalRow];
      
      // Dodaj kolumny analityczne
      rowData.push(
        target.classification,
        target.recommendation,
        target.suggestedBidChange ? `${target.suggestedBidChange}%` : '',
        target.recommendationReason,
        target.recommendation === 'PAUSE' ? `-€${target.spend.toFixed(2)}` : 
          target.recommendation === 'INCREASE_BID' ? `+${(target.sales * 0.1).toFixed(2)}€` : '',
        false // Checkbox domyślnie odznaczony
      );
      
      builderSheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
      
      // Kolorowanie według rekomendacji
      const recommendationCell = builderSheet.getRange(row, originalHeaders.length + 2);
      switch(target.recommendation) {
        case 'PAUSE':
          recommendationCell.setBackground('#ffcccc');
          break;
        case 'ADD_NEGATIVE':
          recommendationCell.setBackground('#ff9999');
          break;
        case 'DECREASE_BID':
          recommendationCell.setBackground('#ffe6cc');
          break;
        case 'INCREASE_BID':
          recommendationCell.setBackground('#ccffcc');
          break;
        case 'MONITOR':
          recommendationCell.setBackground('#e6f3ff');
          break;
      }
      
      // Dodaj checkbox
      const checkboxRange = builderSheet.getRange(row, headers.length);
      checkboxRange.insertCheckboxes();
      
      row++;
    });
    
    // Autosize kolumn
    builderSheet.autoResizeColumns(1, headers.length);
  },
  
  /**
   * Pokaż podsumowanie analizy
   */
  showAnalysisSummary(analysis) {
    const ui = SpreadsheetApp.getUi();
    
    const summary = `
📊 ANALIZA BULK - PODSUMOWANIE
═══════════════════════════════════════

📈 STATYSTYKI OGÓLNE:
- Targety ogółem: ${analysis.summary.totalTargets}
- Aktywne: ${analysis.summary.activeTargets}
- Wstrzymane: ${analysis.summary.pausedTargets}
- Wydatki: €${analysis.summary.totalSpend.toFixed(2)}
- Przychody: €${analysis.summary.totalSales.toFixed(2)}
- ACOS: ${((analysis.summary.totalSpend / analysis.summary.totalSales) * 100).toFixed(1)}%
- ROAS: ${(analysis.summary.totalSales / analysis.summary.totalSpend).toFixed(2)}

🎯 SEGMENTACJA:
- Przynoszące straty: ${analysis.segments.lossMakers.length}
- Wysokie ACOS: ${analysis.segments.highACOS.length}
- Optymalne: ${analysis.segments.optimal.length}
- Zyskowne: ${analysis.segments.profitable.length}
- Bez sprzedaży: ${analysis.segments.zeroSales.length}

📊 ANALIZA PARETO:
- 80% przychodów: ${analysis.pareto.revenue80.length} targetów
- 80% zamówień: ${analysis.pareto.orders80.length} targetów
- 80% wydatków: ${analysis.pareto.spend80.length} targetów

💡 TOP REKOMENDACJE:
${analysis.recommendations.slice(0, 3).map(r => 
  `• [${r.priority}] ${r.description}`
).join('\n')}

✅ Przejdź do arkusza BULK_Builder
   aby przejrzeć i zastosować zmiany.
    `;
    
    ui.alert('Analiza Zakończona', summary, ui.ButtonSet.OK);
  },
  
  /**
   * Pobierz break even ACOS
   */
  getBreakEvenACOS() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = ss.getSheetByName('ACOS_Settings');
    
    if (settingsSheet && settingsSheet.getLastRow() >= 2) {
      const value = settingsSheet.getRange(2, 2).getValue();
      if (value && !isNaN(value)) {
        return parseFloat(value);
      }
    }
    
    // Domyślna wartość
    return 25;
  }
};