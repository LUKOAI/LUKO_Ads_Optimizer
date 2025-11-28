// ===== 05-MetricsCalculator.gs - WERSJA 6.0 =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// INTELIGENTNA ANALIZA TARGETÓW BEZ SPRZEDAŻY

class MetricsCalculator {
  constructor(logger) {
    this.logger = logger || console;
    this.acosSettings = this.loadAcosSettings();
  }

  loadAcosSettings() {
    try {
      const settings = getAcosSettings();
      this.logger.log(`Loaded ACOS settings: break-even=${settings.breakEven}%`, 'INFO');
      return settings;
    } catch (error) {
      this.logger.log(`Using default ACOS settings`, 'WARNING');
      return { breakEven: 30, low: 15, high: 40 };
    }
  }

  calculateMetrics(integratedData, sourceSheet = null) {
    this.logger.log('📊 Starting metrics calculation...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetToAnalyze;
    let analysisSource = '';

    if (sourceSheet) {
      sheetToAnalyze = ss.getSheetByName(sourceSheet);
      analysisSource = sourceSheet;
    } else {
      const amazonSheet = ss.getSheetByName('tu wklejasz raport z amazon');
      const bulkSheet = ss.getSheetByName('BULK_Source');

      if (amazonSheet && amazonSheet.getLastRow() > 1) {
        sheetToAnalyze = amazonSheet;
        analysisSource = 'Amazon Report';
      } else if (bulkSheet && bulkSheet.getLastRow() > 1) {
        sheetToAnalyze = bulkSheet;
        analysisSource = 'BULK File';
      }
    }

    if (!sheetToAnalyze) {
      this.logger.log('❌ No data sheet found', 'ERROR');
      return this.getEmptyMetrics();
    }

    this.logger.log(`📋 Analyzing: ${analysisSource}`, 'INFO');

    const data = sheetToAnalyze.getDataRange().getValues();
    if (data.length < 2) return this.getEmptyMetrics();

    const headers = data[0];
    const indices = this.findColumnIndices(headers);

    const basic = this.calculateBasicMetrics(data, indices);
    const derived = this.calculateDerivedMetrics(basic);
    const totals = { ...basic, ...derived };

    const campaigns = this.analyzeCampaigns(data, headers);
    const targetAnalysis = this.analyzeTargetsExtended(data, indices, headers);

    const result = {
      source: analysisSource,
      totals,
      campaigns,
      targetAnalysis,
      analysis: this.performAdvancedAnalysis(totals, campaigns, targetAnalysis),
      evaluation: this.evaluatePerformance(totals, targetAnalysis),
      acosSettings: this.acosSettings
    };

    this.logSummary(totals, targetAnalysis);
    return result;
  }

  findColumnIndices(headers) {
    return {
      campaignName: this.findColumnIndex(headers, ['Campaign Name', 'Kampagnenname', 'Nazwa kampanii']),
      adGroupName: this.findColumnIndex(headers, ['Ad Group Name', 'Ad Group', 'Nazwa grupy']),
      keyword: this.findColumnIndex(headers, ['Keyword Text', 'Customer Search Term', 'Targeting']),
      impressions: this.findColumnIndex(headers, ['Impressions', 'Wyświetlenia']),
      clicks: this.findColumnIndex(headers, ['Clicks', 'Kliknięcia', 'Klicks']),
      spend: this.findColumnIndex(headers, ['Spend', 'Wydatki', 'Ausgaben']),
      sales: this.findColumnIndex(headers, ['Sales', '7 Day Total Sales', 'Sprzedaż', 'Verkäufe']),
      orders: this.findColumnIndex(headers, ['Orders', '7 Day Total Orders', 'Zamówienia', 'Bestellungen']),
      ctr: this.findColumnIndex(headers, ['CTR', 'Click-Thru Rate', 'Klickrate']),
      cpc: this.findColumnIndex(headers, ['CPC', 'Cost Per Click']),
      acos: this.findColumnIndex(headers, ['ACOS', 'Total Advertising Cost']),
      roas: this.findColumnIndex(headers, ['ROAS', 'Return on Advertising']),
      conversionRate: this.findColumnIndex(headers, ['Conversion Rate', '7 Day Conversion'])
    };
  }

  findColumnIndex(headers, possibleNames) {
    for (let name of possibleNames) {
      const index = headers.findIndex(h => h && h.toString().toLowerCase().includes(name.toLowerCase()));
      if (index >= 0) return index;
    }
    return -1;
  }

  calculateBasicMetrics(data, indices) {
    const totals = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || row.every(v => v === '' || v === null)) continue;

      try {
        if (indices.impressions >= 0) totals.impressions += this.parseNumber(row[indices.impressions]);
        if (indices.clicks >= 0) totals.clicks += this.parseNumber(row[indices.clicks]);
        if (indices.spend >= 0) totals.spend += this.parseCurrency(row[indices.spend]);
        if (indices.sales >= 0) totals.sales += this.parseCurrency(row[indices.sales]);
        if (indices.orders >= 0) totals.orders += this.parseNumber(row[indices.orders]);
      } catch (e) { /* skip */ }
    }

    return totals;
  }

  calculateDerivedMetrics(t) {
    return {
      ctr: t.impressions > 0 ? (t.clicks / t.impressions * 100) : 0,
      cpc: t.clicks > 0 ? (t.spend / t.clicks) : 0,
      acos: t.sales > 0 ? (t.spend / t.sales * 100) : 999,
      roas: t.spend > 0 ? (t.sales / t.spend) : 0,
      conversionRate: t.clicks > 0 ? (t.orders / t.clicks * 100) : 0,
      avgOrderValue: t.orders > 0 ? (t.sales / t.orders) : 0
    };
  }

  // ROZSZERZONA ANALIZA Z SEGMENTACJĄ WG LICZBY KLIKNIĘĆ
  analyzeTargetsExtended(data, indices, headers) {
    const st = {
      totalTargets: 0,
      zeroSalesTargets: 0,
      zeroSalesSpend: 0,
      
      // NOWA SEGMENTACJA targetów bez sprzedaży
      zeroSalesHighClicks: 0,     // >10 kliknięć - do wyłączenia
      zeroSalesHighClicksSpend: 0,
      zeroSalesMediumClicks: 0,   // 5-10 kliknięć - do redukcji stawek
      zeroSalesMediumClicksSpend: 0,
      zeroSalesLowClicks: 0,      // <5 kliknięć - za wcześnie na decyzję
      zeroSalesLowClicksSpend: 0,
      
      unprofitableTargets: 0,
      unprofitableSpend: 0,
      unprofitableSales: 0,
      highProfitTargets: 0,
      highProfitSales: 0,
      goodAcosTargets: 0,
      goodAcosSales: 0,
      goodAcosSpend: 0,
      excellentAcosTargets: 0,
      excellentAcosSales: 0,
      excellentAcosSpend: 0,
      targetsByACOS: { excellent: [], good: [], warning: [], critical: [] },
      allTargets: []
    };

    const campaignIdx = indices.campaignName;
    const adGroupIdx = indices.adGroupName;

    // Dynamiczny próg kliknięć na podstawie AOV i CPC
    const avgOrderValue = this.calculateBasicMetrics(data, indices).sales / 
                          Math.max(1, this.calculateBasicMetrics(data, indices).orders);
    const avgCPC = this.calculateBasicMetrics(data, indices).spend / 
                   Math.max(1, this.calculateBasicMetrics(data, indices).clicks);
    
    // Próg kliknięć = AOV / (CPC * 3) - czyli ile kliknięć powinno dać przynajmniej 1 zamówienie
    const clickThresholdHigh = Math.max(10, Math.min(30, avgOrderValue / (avgCPC * 3)));
    const clickThresholdMedium = clickThresholdHigh / 2;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const spend = indices.spend >= 0 ? this.parseCurrency(row[indices.spend]) : 0;
      const sales = indices.sales >= 0 ? this.parseCurrency(row[indices.sales]) : 0;
      const clicks = indices.clicks >= 0 ? this.parseNumber(row[indices.clicks]) : 0;
      const orders = indices.orders >= 0 ? this.parseNumber(row[indices.orders]) : 0;

      if (spend > 0 || clicks > 0) {
        st.totalTargets++;

        const targetACOS = sales > 0 ? (spend / sales * 100) : 999;
        const targetInfo = {
          row: i + 1,
          spend,
          sales,
          orders,
          clicks,
          acos: targetACOS,
          keyword: indices.keyword >= 0 ? row[indices.keyword] : 'Unknown',
          campaign: campaignIdx >= 0 ? row[campaignIdx] : 'Unknown',
          adGroup: adGroupIdx >= 0 ? row[adGroupIdx] : 'Unknown'
        };

        st.allTargets.push(targetInfo);

        // ANALIZA TARGETÓW BEZ SPRZEDAŻY Z SEGMENTACJĄ
        if (sales === 0 && spend > 0) {
          st.zeroSalesTargets++;
          st.zeroSalesSpend += spend;
          
          if (clicks >= clickThresholdHigh) {
            st.zeroSalesHighClicks++;
            st.zeroSalesHighClicksSpend += spend;
          } else if (clicks >= clickThresholdMedium) {
            st.zeroSalesMediumClicks++;
            st.zeroSalesMediumClicksSpend += spend;
          } else {
            st.zeroSalesLowClicks++;
            st.zeroSalesLowClicksSpend += spend;
          }
        }

        if (targetACOS > this.acosSettings.breakEven) {
          st.unprofitableTargets++;
          st.unprofitableSpend += spend;
          st.unprofitableSales += sales;
          
          if (targetACOS > this.acosSettings.breakEven * 1.5) {
            st.targetsByACOS.critical.push(targetInfo);
          } else {
            st.targetsByACOS.warning.push(targetInfo);
          }
        } else {
          st.goodAcosTargets++;
          st.goodAcosSales += sales;
          st.goodAcosSpend += spend;
          
          if (targetACOS <= this.acosSettings.breakEven / 2) {
            st.highProfitTargets++;
            st.excellentAcosTargets++;
            st.highProfitSales += sales;
            st.excellentAcosSales += sales;
            st.excellentAcosSpend += spend;
            st.targetsByACOS.excellent.push(targetInfo);
          } else {
            st.targetsByACOS.good.push(targetInfo);
          }
        }
      }
    }

    // Dodaj progi do analizy
    st.clickThresholds = {
      high: Math.round(clickThresholdHigh),
      medium: Math.round(clickThresholdMedium)
    };

    // Sortowanie
    Object.keys(st.targetsByACOS).forEach(k => {
      st.targetsByACOS[k].sort((a, b) => b.spend - a.spend);
    });

    // ANALIZA PARETO
    st.allTargets.sort((a, b) => b.sales - a.sales);
    const totalSales = st.allTargets.reduce((sum, t) => sum + t.sales, 0);
    let cumulativeSales = 0;
    let topTargetsCount = 0;
    st.paretoTargets = [];

    for (const target of st.allTargets) {
      if (target.sales > 0) {
        cumulativeSales += target.sales;
        topTargetsCount++;
        st.paretoTargets.push({
          ...target,
          salesPercent: (target.sales / totalSales * 100),
          cumulativePercent: (cumulativeSales / totalSales * 100)
        });
        
        if (cumulativeSales >= totalSales * 0.8 || topTargetsCount >= Math.ceil(st.allTargets.length * 0.2)) {
          break;
        }
      }
    }

    return st;
  }

  analyzeCampaigns(data, headers) {
    const map = new Map();
    const cIdx = this.findColumnIndex(headers, ['Campaign Name', 'Kampagnenname', 'Nazwa kampanii']);
    if (cIdx < 0) return map;

    const idx = this.findColumnIndices(headers);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[cIdx]) continue;

      const name = String(row[cIdx]);
      if (!map.has(name)) {
        map.set(name, { name, impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 });
      }
      const c = map.get(name);
      if (idx.impressions >= 0) c.impressions += this.parseNumber(row[idx.impressions]);
      if (idx.clicks >= 0) c.clicks += this.parseNumber(row[idx.clicks]);
      if (idx.spend >= 0) c.spend += this.parseCurrency(row[idx.spend]);
      if (idx.sales >= 0) c.sales += this.parseCurrency(row[idx.sales]);
      if (idx.orders >= 0) c.orders += this.parseNumber(row[idx.orders]);
    }

    map.forEach(c => {
      c.acos = c.sales > 0 ? (c.spend / c.sales * 100) : 999;
      c.roas = c.spend > 0 ? (c.sales / c.spend) : 0;
      c.ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;
      c.cpc = c.clicks > 0 ? (c.spend / c.clicks) : 0;
      c.conversionRate = c.clicks > 0 ? (c.orders / c.clicks * 100) : 0;
    });

    return map;
  }

  performAdvancedAnalysis(totals, campaigns, targetAnalysis) {
    return {
      profitability: this.analyzeProfitability(totals),
      efficiency: this.analyzeEfficiency(totals),
      campaignHealth: this.analyzeCampaignHealth(campaigns),
      targetHealth: this.analyzeTargetHealth(targetAnalysis),
      risk: this.analyzeRisk(totals, targetAnalysis),
      opportunities: this.identifyOpportunities(totals, targetAnalysis)
    };
  }

  analyzeProfitability(totals) {
    const marginPercent = this.acosSettings.breakEven / 100;
    const estimatedMargin = totals.sales * marginPercent;
    const profitLoss = estimatedMargin - totals.spend;
    const marginToBreakEven = this.acosSettings.breakEven - totals.acos;

    return {
      estimatedMargin,
      profitLoss,
      isProfitable: profitLoss > 0,
      marginPercent: totals.sales > 0 ? (profitLoss / totals.sales * 100) : 0,
      marginToBreakEven
    };
  }

  analyzeEfficiency(totals) {
    return {
      ctrStatus: totals.ctr >= 1.0 ? 'GOOD' : totals.ctr >= 0.5 ? 'AVERAGE' : 'POOR',
      cpcStatus: totals.cpc <= 0.50 ? 'GOOD' : totals.cpc <= 1.00 ? 'AVERAGE' : 'EXPENSIVE'
    };
  }

  analyzeTargetHealth(t) {
    const totalSpend = (t.zeroSalesSpend || 0) + (t.unprofitableSpend || 0) + (t.goodAcosSpend || 0);
    const totalTargets = t.totalTargets || 1;
    
    return {
      wastedSpendPercent: totalSpend > 0 ? (t.zeroSalesSpend / totalSpend * 100) : 0,
      unprofitablePercent: (t.unprofitableTargets / totalTargets * 100),
      highProfitPercent: (t.highProfitTargets / totalTargets * 100),
      immediateActionNeeded: t.zeroSalesHighClicks || 0,
      optimizationPotential: (t.zeroSalesHighClicksSpend || 0) + ((t.zeroSalesMediumClicksSpend || 0) * 0.5)
    };
  }

  identifyOpportunities(totals, t) {
    const ops = [];
    
    // Bardziej precyzyjne rekomendacje dla targetów bez sprzedaży
    if (t.zeroSalesHighClicks > 0) {
      ops.push({
        type: 'WASTE_REDUCTION',
        action: `Rozważ pauzowanie ${t.zeroSalesHighClicks} targetów z >=${t.clickThresholds.high} kliknięciami bez konwersji`,
        potentialSavings: t.zeroSalesHighClicksSpend,
        priority: 'HIGH',
        details: `Potencjalna oszczędność: €${t.zeroSalesHighClicksSpend.toFixed(2)}/mies. (przy założeniu całkowitego wstrzymania)`
      });
    }
    
    if (t.zeroSalesMediumClicks > 0) {
      ops.push({
        type: 'BID_OPTIMIZATION', 
        action: `Obniż stawki o 30-50% dla ${t.zeroSalesMediumClicks} targetów z ${t.clickThresholds.medium}-${t.clickThresholds.high} kliknięciami bez konwersji`,
        potentialSavings: t.zeroSalesMediumClicksSpend * 0.4,
        priority: 'MEDIUM',
        details: `Te targety wymagają dalszej obserwacji - może konwersja przyjdzie przy niższym CPC`
      });
    }
    
    if (t.zeroSalesLowClicks > 0 && t.zeroSalesLowClicks > 100) {
      ops.push({
        type: 'MONITORING',
        action: `Monitoruj ${t.zeroSalesLowClicks} targetów z <${t.clickThresholds.medium} kliknięciami`,
        priority: 'LOW',
        details: `Za wcześnie na decyzję - potrzeba więcej danych statystycznych`
      });
    }
    
    if (t.unprofitableTargets > 0 && t.unprofitableSpend > totals.spend * 0.3) {
      ops.push({
        type: 'ACOS_OPTIMIZATION',
        action: `Optymalizuj ${t.unprofitableTargets} targetów z ACOS > ${this.acosSettings.breakEven}%`,
        potentialSavings: t.unprofitableSpend * 0.25,
        priority: 'HIGH',
        details: `Redukcja stawek o 15-25% może poprawić rentowność`
      });
    }
    
    if (t.highProfitTargets > 0 && t.highProfitSales > 100) {
      ops.push({
        type: 'SCALING',
        action: `Zwiększ stawki dla ${t.highProfitTargets} najlepszych targetów (ACOS < ${this.acosSettings.breakEven/2}%)`,
        potentialGrowth: t.highProfitSales * 0.3,
        priority: 'OPPORTUNITY',
        details: `Możliwy wzrost sprzedaży o €${(t.highProfitSales * 0.3).toFixed(2)} przy zachowaniu rentowności`
      });
    }

    return ops;
  }

  analyzeRisk(totals, t) {
    let score = 0;
    const factors = [];

    if (totals.acos > this.acosSettings.high) { 
      score += 40; 
      factors.push(`ACOS ${totals.acos.toFixed(1)}% znacznie przekracza próg ${this.acosSettings.high}%`); 
    } else if (totals.acos > this.acosSettings.breakEven) { 
      score += 20; 
      factors.push('ACOS powyżej progu rentowności'); 
    }

    const wastePercent = totals.spend > 0 ? ((t.zeroSalesHighClicksSpend || 0) / totals.spend * 100) : 0;
    if (wastePercent > 15) {
      score += 30; 
      factors.push(`${wastePercent.toFixed(0)}% budżetu na targety z wieloma kliknięciami bez konwersji`);
    }

    if (totals.ctr < 0.5) { 
      score += 15; 
      factors.push('Bardzo niski CTR - problem z atrakcyjnością reklam'); 
    }
    
    if (totals.conversionRate < 1.0) { 
      score += 15; 
      factors.push('Niska konwersja - możliwy problem z ceną lub stroną produktu'); 
    }

    return { 
      score: Math.min(score, 100), 
      level: score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW', 
      factors 
    };
  }

  analyzeCampaignHealth(campaigns) {
    if (!campaigns || campaigns.size === 0) return { healthy: 0, warning: 0, critical: 0, total: 0 };
    let healthy = 0, warning = 0, critical = 0;

    campaigns.forEach(c => {
      if (c.acos <= this.acosSettings.breakEven) healthy++;
      else if (c.acos <= this.acosSettings.breakEven * 1.5) warning++;
      else critical++;
    });

    return { healthy, warning, critical, total: campaigns.size };
  }

  evaluatePerformance(t, targetAnalysis) {
    const acosStatus = this.evaluateAcos(t.acos);
    const roasStatus = acosStatus;
    const overallScore = this.calculateOverallScore(t);

    const recommendations = [];
    
    // INTELIGENTNE REKOMENDACJE DLA TARGETÓW BEZ SPRZEDAŻY
    if (targetAnalysis && targetAnalysis.zeroSalesHighClicks > 0) {
      const threshold = targetAnalysis.clickThresholds.high;
      recommendations.push({
        priority: 'HIGH',
        category: 'Optymalizacja kosztów',
        action: `Przeanalizuj ${targetAnalysis.zeroSalesHighClicks} targetów z ≥${threshold} kliknięciami bez sprzedaży`,
        expectedImpact: `Do €${targetAnalysis.zeroSalesHighClicksSpend.toFixed(2)} potencjalnych oszczędności (jeśli wyłączysz wszystkie)`
      });
    }
    
    if (targetAnalysis && targetAnalysis.zeroSalesMediumClicks > 0) {
      const thresholdLow = targetAnalysis.clickThresholds.medium;
      const thresholdHigh = targetAnalysis.clickThresholds.high;
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Redukcja stawek',
        action: `Obniż bidy dla ${targetAnalysis.zeroSalesMediumClicks} targetów (${thresholdLow}-${thresholdHigh} kliknięć bez sprzedaży)`,
        expectedImpact: `Redukcja kosztów o ~40% dla tych targetów`
      });
    }

    // Rekomendacje ACOS
    if (t.acos > this.acosSettings.breakEven * 1.5) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'ACOS',
        action: `PILNE: Kampanie znacznie nierentowne (ACOS ${t.acos.toFixed(1)}%)`,
        expectedImpact: `Redukcja stawek o 20-30% w kampaniach z najwyższym ACOS`
      });
    } else if (t.acos > this.acosSettings.breakEven) {
      recommendations.push({
        priority: 'HIGH',
        category: 'ACOS',
        action: `Optymalizacja ACOS - obecnie ${t.acos.toFixed(1)}% (próg: ${this.acosSettings.breakEven}%)`,
        expectedImpact: `Cel: obniżenie ACOS poniżej ${this.acosSettings.breakEven}%`
      });
    }

    // CTR i konwersja
    if (t.ctr < 0.5) {
      recommendations.push({
        priority: 'HIGH',
        category: 'CTR',
        action: 'Popraw atrakcyjność reklam - tytuły, zdjęcia, cena',
        expectedImpact: 'Docelowy CTR: >1%, obecny tylko ' + t.ctr.toFixed(2) + '%'
      });
    }

    // Skalowanie
    if (targetAnalysis && targetAnalysis.excellentAcosTargets > 5) {
      recommendations.push({
        priority: 'OPPORTUNITY',
        category: 'Skalowanie',
        action: `Zwiększ budżet dla ${targetAnalysis.excellentAcosTargets} najlepszych targetów`,
        expectedImpact: `Możliwy wzrost sprzedaży o ~30% przy zachowaniu dobrego ACOS`
      });
    }

    return {
      acosStatus,
      roasStatus,
      overallScore,
      grade: this.getGrade(overallScore),
      recommendations
    };
  }

  evaluateAcos(acos) {
    if (acos <= this.acosSettings.low) return 'EXCELLENT';
    if (acos <= this.acosSettings.breakEven) return 'GOOD';
    if (acos <= this.acosSettings.high) return 'WARNING';
    return 'CRITICAL';
  }

  calculateOverallScore(t) {
    let score = 100;
    
    if (t.acos > this.acosSettings.breakEven)
      score -= Math.min(50, (t.acos - this.acosSettings.breakEven) * 2);
    if (t.ctr < 1.0)
      score -= Math.min(20, (1.0 - t.ctr) * 20);
    if (t.cpc > 1.0)
      score -= Math.min(15, (t.cpc - 1.0) * 15);
    if (t.roas < 3)
      score -= Math.min(15, (3 - t.roas) * 5);

    return Math.max(0, Math.round(score));
  }

  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }

  parseNumber(value) {
    if (!value && value !== 0) return 0;
    if (typeof value === 'number') return value;
    let s = String(value).trim();
    s = s.replace(/[^0-9,.-]/g, '');
    if (s.includes(',')) {
      if (!s.includes('.')) {
        s = s.replace(',', '.');
      } else {
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      }
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  parseCurrency(value) {
    if (!value && value !== 0) return 0;
    if (typeof value === 'number') return value;
    let s = String(value).trim().replace(/[€$£¥₹]/g, '').trim();
    return this.parseNumber(s);
  }

  logSummary(t, ta) {
    this.logger.log(`✅ === METRICS CALCULATION COMPLETE ===`, 'SUCCESS');
    this.logger.log(`📊 ACOS: ${t.acos.toFixed(2)}% (BE: ${this.acosSettings.breakEven}%)`, 'INFO');
    this.logger.log(`💰 Sales: €${t.sales.toFixed(2)} | Spend: €${t.spend.toFixed(2)}`, 'INFO');
    
    if (ta && ta.zeroSalesHighClicks) {
      this.logger.log(`🎯 Targets for review: ${ta.zeroSalesHighClicks} with ≥${ta.clickThresholds.high} clicks & no sales`, 'INFO');
    }
  }

  getEmptyMetrics() {
    return {
      source: 'NONE',
      totals: { 
        impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, 
        ctr: 0, cpc: 0, acos: 0, roas: 0, conversionRate: 0, avgOrderValue: 0 
      },
      campaigns: new Map(),
      targetAnalysis: {
        totalTargets: 0, 
        zeroSalesTargets: 0, 
        zeroSalesSpend: 0,
        zeroSalesHighClicks: 0,
        zeroSalesHighClicksSpend: 0,
        zeroSalesMediumClicks: 0,
        zeroSalesMediumClicksSpend: 0,
        zeroSalesLowClicks: 0,
        zeroSalesLowClicksSpend: 0,
        clickThresholds: { high: 10, medium: 5 },
        unprofitableTargets: 0, 
        unprofitableSpend: 0, 
        unprofitableSales: 0,
        highProfitTargets: 0, 
        highProfitSales: 0,
        goodAcosTargets: 0, 
        goodAcosSales: 0, 
        goodAcosSpend: 0,
        excellentAcosTargets: 0, 
        excellentAcosSales: 0, 
        excellentAcosSpend: 0,
        targetsByACOS: { excellent: [], good: [], warning: [], critical: [] },
        allTargets: [],
        paretoTargets: []
      },
      analysis: null,
      evaluation: null,
      acosSettings: this.acosSettings
    };
  }
}