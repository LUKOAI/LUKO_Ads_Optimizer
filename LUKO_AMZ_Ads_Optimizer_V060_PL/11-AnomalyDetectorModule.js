// ===== ANOMALY DETECTOR V2.0 - ZSYNCHRONIZOWANY =====
// ZAAWANSOWANY MODUŁ: Znajduje przyczyny problemów w kampaniach
// OPCJONALNY: Może być używany przez FullAnalyzer dla głębszej analizy

class AnomalyDetector {
  constructor() {
    this.logger = new LukoLogger();
    
    // Pobierz ustawienia ACOS
    try {
      const props = PropertiesService.getScriptProperties();
      this.breakEvenAcos = Number(props.getProperty('BREAK_EVEN_ACOS')) || 25;
      this.lowAcos = Number(props.getProperty('LOW_ACOS')) || 15;
      this.highAcos = Number(props.getProperty('HIGH_ACOS')) || 40;
    } catch (error) {
      this.breakEvenAcos = 25;
      this.lowAcos = 15;
      this.highAcos = 40;
    }
    
    // PROGI WYKRYWANIA ANOMALII
    this.thresholds = {
      // Statistical thresholds
      standardDeviations: 2.0,
      minimumSampleSize: 5,
      
      // Performance thresholds  
      acosVariationThreshold: 20,     // % różnica ACOS = anomalia
      ctrDropThreshold: 50,           // % spadek CTR = anomalia  
      cpcSpikeThreshold: 30,          // % wzrost CPC = anomalia
      impressionDropThreshold: 40,    // % spadek impressions = anomalia
      
      // Significance thresholds
      minSpendForAnalysis: 10,        // Min spend €  
      minClicksForCTR: 50,           // Min clicks dla CTR analysis
      minImpressionsForAnalysis: 100, // Min impressions
      
      // Time-based thresholds
      weekOverWeekChangeThreshold: 25,
      dayOfWeekVariation: 40
    };
    
    // TYPY ANOMALII
    this.anomalyTypes = {
      KEYWORD_PERFORMANCE_GAP: {
        description: 'Ten sam keyword ma drastycznie różne ACOS w różnych miejscach',
        severity: 'HIGH',
        minVariation: 20
      },
      KEYWORD_CPC_SPIKE: {
        description: 'CPC dla keyword wzrósł znacznie powyżej normy',
        severity: 'MEDIUM',
        minVariation: 30
      },
      KEYWORD_CTR_DROP: {
        description: 'CTR spadł dramatycznie dla keyword',
        severity: 'HIGH',
        minVariation: 50
      },
      CAMPAIGN_IMPRESSION_LOSS: {
        description: 'Kampania straciła znacznie impressions',
        severity: 'HIGH',
        minVariation: 40
      },
      CANNIBALIZATION_DETECTED: {
        description: 'Kampanie konkurują o te same keywords',
        severity: 'MEDIUM',
        minVariation: 0
      },
      HIGH_SPEND_NO_SALES: {
        description: 'Wysokie wydatki bez żadnych zamówień',
        severity: 'HIGH',
        minVariation: 100
      }
    };
  }

  // ===== GŁÓWNA FUNKCJA WYKRYWANIA =====
  detectAnomalies(integratedData) {
    this.logger.log('🔍 Starting anomaly detection...', 'INFO');
    
    const anomalies = {
      detected: [],
      summary: {
        total: 0,
        byType: {},
        bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        totalImpact: 0
      },
      insights: []
    };
    
    try {
      // KROK 1: Wykryj anomalie keyword-level
      const keywordAnomalies = this.detectKeywordAnomalies(integratedData.keywords || {});
      anomalies.detected.push(...keywordAnomalies);
      
      // KROK 2: Wykryj anomalie campaign-level
      const campaignAnomalies = this.detectCampaignAnomalies(integratedData.campaigns || {});
      anomalies.detected.push(...campaignAnomalies);
      
      // KROK 3: Wykryj cannibalization
      const cannibalizationAnomalies = this.detectCannibalization(integratedData);
      anomalies.detected.push(...cannibalizationAnomalies);
      
      // KROK 4: Generuj insights z przyczynami
      anomalies.insights = this.generateInsights(anomalies.detected, integratedData);
      
      // KROK 5: Oblicz summary
      this.calculateAnomalySummary(anomalies);
      
      this.logger.log(`✅ Anomaly detection complete: Found ${anomalies.detected.length} anomalies`, 'SUCCESS');
      
    } catch (error) {
      this.logger.log(`❌ Error in anomaly detection: ${error.message}`, 'ERROR');
    }
    
    return anomalies;
  }

  // ===== KEYWORD ANOMALY DETECTION =====
  detectKeywordAnomalies(keywords) {
    const anomalies = [];
    
    // Grupuj keywords po nazwie
    const keywordGroups = {};
    Object.entries(keywords).forEach(([key, data]) => {
      const keywordName = key.split('|')[0].toLowerCase().trim();
      if (!keywordGroups[keywordName]) {
        keywordGroups[keywordName] = [];
      }
      keywordGroups[keywordName].push({ key, ...data });
    });
    
    // ANOMALIA 1: PERFORMANCE GAP
    Object.entries(keywordGroups).forEach(([keywordName, instances]) => {
      if (instances.length < 2) return;
      
      const performanceGap = this.checkKeywordPerformanceGap(keywordName, instances);
      if (performanceGap) {
        anomalies.push(performanceGap);
      }
    });
    
    // ANOMALIA 2: WASTE KEYWORDS
    Object.entries(keywords).forEach(([key, data]) => {
      const keywordName = key.split('|')[0];
      
      if (this.safeNumber(data.spend) >= this.thresholds.minSpendForAnalysis && 
          this.safeNumber(data.orders) === 0) {
        anomalies.push(this.createWasteAnomaly(keywordName, data));
      }
    });
    
    return anomalies;
  }

  checkKeywordPerformanceGap(keywordName, instances) {
    const validInstances = instances.filter(i => 
      this.safeNumber(i.sales) > 0 && 
      this.safeNumber(i.spend) > 0 && 
      this.safeNumber(i.acos) < 999
    );
    
    if (validInstances.length < 2) return null;
    
    const acosValues = validInstances.map(i => this.safeNumber(i.acos));
    const minAcos = Math.min(...acosValues);
    const maxAcos = Math.max(...acosValues);
    const acosRange = maxAcos - minAcos;
    
    if (acosRange >= this.thresholds.acosVariationThreshold) {
      const avgSpend = validInstances.reduce((sum, i) => sum + this.safeNumber(i.spend), 0) / validInstances.length;
      
      return {
        type: 'KEYWORD_PERFORMANCE_GAP',
        severity: acosRange > 50 ? 'HIGH' : 'MEDIUM',
        keyword: keywordName,
        variation: acosRange,
        instances: validInstances.length,
        metrics: {
          acosRange: acosRange,
          minAcos: minAcos,
          maxAcos: maxAcos,
          avgSpend: avgSpend
        },
        evidence: {
          acosVariation: `${acosRange.toFixed(1)}% ACOS range`,
          campaigns: validInstances.map(i => ({
            campaign: i.key.split('|')[1] || 'Unknown',
            acos: this.safeNumber(i.acos).toFixed(1),
            spend: this.safeNumber(i.spend).toFixed(2)
          }))
        },
        estimatedImpact: avgSpend * (acosRange / 100),
        confidence: this.calculateConfidence(acosRange, this.thresholds.acosVariationThreshold),
        possibleCauses: [
          'Different match types (broad vs exact)',
          'Different campaign structures',
          'Varying competition levels',
          'Product relevance differences'
        ],
        recommendations: [
          'Consolidate keyword to single campaign',
          'Standardize match types',
          'Review campaign structures',
          'Test different placements'
        ]
      };
    }
    
    return null;
  }

  createWasteAnomaly(keywordName, data) {
    const spend = this.safeNumber(data.spend);
    const clicks = this.safeNumber(data.clicks);
    const impressions = this.safeNumber(data.impressions);
    
    return {
      type: 'HIGH_SPEND_NO_SALES',
      severity: spend > 50 ? 'HIGH' : 'MEDIUM',
      keyword: keywordName,
      variation: 100,
      metrics: {
        spend: spend,
        clicks: clicks,
        impressions: impressions,
        wasteAmount: spend
      },
      evidence: {
        wasteDetails: `€${spend.toFixed(2)} spent, ${clicks} clicks, 0 orders`,
        efficiency: 'Complete waste - no conversions'
      },
      estimatedImpact: spend,
      confidence: 1.0,
      possibleCauses: [
        'Irrelevant search intent',
        'Poor product-keyword match',
        'Non-commercial keywords',
        'Competitor searches'
      ],
      recommendations: [
        'Add as negative keyword',
        'Review keyword relevance',
        'Check search intent',
        'Analyze search terms'
      ]
    };
  }

  // ===== CAMPAIGN ANOMALY DETECTION =====
  detectCampaignAnomalies(campaigns) {
    const anomalies = [];
    
    // Oblicz benchmarki
    const campaignMetrics = Object.values(campaigns);
    const avgCTR = this.calculateAverage(campaignMetrics.map(c => this.safeNumber(c.ctr)));
    const avgCVR = this.calculateAverage(campaignMetrics.map(c => this.safeNumber(c.cvr)));
    const avgAcos = this.calculateAverage(campaignMetrics.map(c => this.safeNumber(c.acos)).filter(a => a < 999));
    
    Object.entries(campaigns).forEach(([key, data]) => {
      const campaignName = key.split('|')[0];
      const impressions = this.safeNumber(data.impressions);
      const clicks = this.safeNumber(data.clicks);
      const spend = this.safeNumber(data.spend);
      const acos = this.safeNumber(data.acos);
      const ctr = this.safeNumber(data.ctr);
      const cvr = this.safeNumber(data.cvr);
      
      // ANOMALIA 1: CTR znacznie poniżej średniej
      if (impressions > this.thresholds.minImpressionsForAnalysis && 
          ctr < avgCTR * 0.5 && avgCTR > 0) {
        anomalies.push({
          type: 'CAMPAIGN_LOW_CTR',
          severity: ctr < avgCTR * 0.3 ? 'HIGH' : 'MEDIUM',
          campaign: campaignName,
          variation: ((avgCTR - ctr) / avgCTR * 100),
          metrics: {
            actualCTR: ctr,
            avgCTR: avgCTR,
            impressions: impressions,
            clicks: clicks
          },
          evidence: {
            performance: `CTR ${ctr.toFixed(3)}% vs avg ${avgCTR.toFixed(3)}%`,
            impressions: `${impressions} impressions, ${clicks} clicks`
          },
          estimatedImpact: impressions * (avgCTR - ctr) / 100 * 0.5,
          confidence: 0.7,
          possibleCauses: [
            'Poor ad relevance',
            'Broad targeting',
            'Weak ad copy',
            'Wrong audience'
          ],
          recommendations: [
            'Review and improve ad copy',
            'Refine targeting',
            'Test new creatives',
            'Check keyword relevance'
          ]
        });
      }
      
      // ANOMALIA 2: ACOS znacznie powyżej break-even
      if (spend > this.thresholds.minSpendForAnalysis && 
          acos > this.breakEvenAcos * 2) {
        anomalies.push({
          type: 'CAMPAIGN_HIGH_ACOS',
          severity: acos > this.breakEvenAcos * 3 ? 'HIGH' : 'MEDIUM',
          campaign: campaignName,
          variation: ((acos - this.breakEvenAcos) / this.breakEvenAcos * 100),
          metrics: {
            actualAcos: acos,
            breakEvenAcos: this.breakEvenAcos,
            spend: spend,
            sales: this.safeNumber(data.sales)
          },
          evidence: {
            acosIssue: `ACOS ${acos.toFixed(1)}% vs break-even ${this.breakEvenAcos}%`,
            financials: `€${spend.toFixed(2)} spent, €${this.safeNumber(data.sales).toFixed(2)} sales`
          },
          estimatedImpact: spend * 0.5, // Assume 50% could be saved
          confidence: 0.8,
          possibleCauses: [
            'Bids too high for competition',
            'Poor keyword selection',
            'Low conversion rate',
            'Market changes'
          ],
          recommendations: [
            'Reduce bids by 20-30%',
            'Pause worst keywords',
            'Review targeting strategy',
            'Optimize product listings'
          ]
        });
      }
    });
    
    return anomalies;
  }

  // ===== CANNIBALIZATION DETECTION =====
  detectCannibalization(integratedData) {
    const anomalies = [];
    const keywordCampaignMap = {};
    
    // Map keywords to campaigns
    Object.entries(integratedData.keywords || {}).forEach(([key, data]) => {
      const keywordName = key.split('|')[0].toLowerCase();
      const campaignName = key.split('|')[1] || 'Unknown';
      
      if (!keywordCampaignMap[keywordName]) {
        keywordCampaignMap[keywordName] = [];
      }
      
      keywordCampaignMap[keywordName].push({
        campaign: campaignName,
        spend: this.safeNumber(data.spend),
        clicks: this.safeNumber(data.clicks),
        cpc: this.safeNumber(data.cpc),
        acos: this.safeNumber(data.acos)
      });
    });
    
    // Find overlapping keywords
    Object.entries(keywordCampaignMap).forEach(([keyword, campaigns]) => {
      if (campaigns.length > 1) {
        const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
        const potentialSavings = this.calculateCannibalizedCost(campaigns);
        
        if (potentialSavings > 10) { // Min €10 potential savings
          anomalies.push({
            type: 'CANNIBALIZATION_DETECTED',
            severity: potentialSavings > 50 ? 'HIGH' : 'MEDIUM',
            keyword: keyword,
            variation: campaigns.length,
            metrics: {
              campaignCount: campaigns.length,
              totalSpend: totalSpend,
              potentialSavings: potentialSavings
            },
            evidence: {
              campaigns: campaigns.map(c => c.campaign),
              wasteDetails: `€${potentialSavings.toFixed(2)} potential savings`,
              competition: `${campaigns.length} campaigns competing`
            },
            estimatedImpact: potentialSavings,
            confidence: 0.8,
            possibleCauses: [
              'Poor campaign structure',
              'Overlapping keyword lists',
              'Lack of negative keywords',
              'Multiple product variants'
            ],
            recommendations: [
              'Consolidate to single campaign',
              'Add cross-campaign negatives',
              'Review campaign structure',
              'Implement single keyword rule'
            ]
          });
        }
      }
    });
    
    return anomalies;
  }

  calculateCannibalizedCost(campaigns) {
    const validCampaigns = campaigns.filter(c => c.clicks > 0 && c.cpc > 0);
    if (validCampaigns.length < 2) return 0;
    
    const minCPC = Math.min(...validCampaigns.map(c => c.cpc));
    const totalClicks = validCampaigns.reduce((sum, c) => sum + c.clicks, 0);
    const actualSpend = validCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const optimalSpend = minCPC * totalClicks;
    
    return Math.max(0, actualSpend - optimalSpend);
  }

  // ===== INSIGHT GENERATION =====
  generateInsights(anomalies, integratedData) {
    const insights = [];
    
    // Group anomalies by type
    const anomaliesByType = {};
    anomalies.forEach(anomaly => {
      if (!anomaliesByType[anomaly.type]) {
        anomaliesByType[anomaly.type] = [];
      }
      anomaliesByType[anomaly.type].push(anomaly);
    });
    
    // Generate insights for each type
    Object.entries(anomaliesByType).forEach(([type, typeAnomalies]) => {
      const insight = this.generateTypeInsight(type, typeAnomalies, integratedData);
      if (insight) {
        insights.push(insight);
      }
    });
    
    // Generate cross-cutting insights
    const crossInsights = this.generateCrossInsights(anomalies, integratedData);
    insights.push(...crossInsights);
    
    return insights;
  }

  generateTypeInsight(type, anomalies, integratedData) {
    const count = anomalies.length;
    const totalImpact = anomalies.reduce((sum, a) => sum + (a.estimatedImpact || 0), 0);
    
    switch (type) {
      case 'HIGH_SPEND_NO_SALES':
        return {
          type: 'WASTE_PATTERN',
          title: 'Systematic Waste Detected',
          description: `${count} keywords are generating zero sales despite spending €${totalImpact.toFixed(2)}`,
          priority: 'HIGH',
          actionable: true,
          impact: totalImpact,
          recommendation: 'Implement comprehensive negative keyword strategy',
          timeframe: 'Immediate',
          confidence: 0.9
        };
        
      case 'KEYWORD_PERFORMANCE_GAP':
        return {
          type: 'STRUCTURE_ISSUE',
          title: 'Campaign Structure Problems',
          description: `${count} keywords show inconsistent performance across campaigns`,
          priority: 'MEDIUM',
          actionable: true,
          impact: totalImpact,
          recommendation: 'Reorganize campaign structure for better control',
          timeframe: '1-2 weeks',
          confidence: 0.7
        };
        
      case 'CANNIBALIZATION_DETECTED':
        return {
          type: 'EFFICIENCY_ISSUE',
          title: 'Internal Competition Detected',
          description: `${count} keywords are competing against themselves`,
          priority: 'MEDIUM',
          actionable: true,
          impact: totalImpact,
          recommendation: 'Consolidate overlapping keywords',
          timeframe: '3-5 days',
          confidence: 0.8
        };
        
      default:
        return null;
    }
  }

  generateCrossInsights(anomalies, integratedData) {
    const insights = [];
    
    // Overall performance insight
    const highSeverityCount = anomalies.filter(a => a.severity === 'HIGH').length;
    const totalImpact = anomalies.reduce((sum, a) => sum + (a.estimatedImpact || 0), 0);
    
    if (highSeverityCount > 0) {
      insights.push({
        type: 'OVERALL_HEALTH',
        title: 'Performance Health Assessment',
        description: `${highSeverityCount} critical issues found with €${totalImpact.toFixed(2)} at risk`,
        priority: highSeverityCount > 3 ? 'CRITICAL' : 'HIGH',
        actionable: true,
        impact: totalImpact,
        recommendation: 'Address critical issues first, then optimize structure',
        timeframe: 'This week',
        confidence: 0.8
      });
    }
    
    // Efficiency insight
    const wasteAnomalies = anomalies.filter(a => a.type === 'HIGH_SPEND_NO_SALES');
    if (wasteAnomalies.length > 0) {
      const wasteTotal = wasteAnomalies.reduce((sum, a) => sum + (a.estimatedImpact || 0), 0);
      const totalSpend = integratedData.summary?.spend || 1;
      const wastePercentage = (wasteTotal / totalSpend) * 100;
      
      if (wastePercentage > 15) {
        insights.push({
          type: 'EFFICIENCY_WARNING',
          title: 'High Waste Percentage',
          description: `${wastePercentage.toFixed(1)}% of spend generates no sales`,
          priority: 'HIGH',
          actionable: true,
          impact: wasteTotal,
          recommendation: 'Urgent negative keyword cleanup required',
          timeframe: 'Today',
          confidence: 1.0
        });
      }
    }
    
    return insights;
  }

  // ===== HELPER METHODS =====
  
  safeNumber(value) {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }
  
  calculateAverage(values) {
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }
  
  calculateConfidence(actualVariation, threshold) {
    if (actualVariation < threshold) return 0;
    
    const excessVariation = actualVariation - threshold;
    const maxVariation = threshold * 3; // Assume 3x threshold is max
    const possibleExcess = maxVariation - threshold;
    
    return Math.min(0.3 + (excessVariation / possibleExcess) * 0.7, 1.0);
  }
  
  calculateAnomalySummary(anomalies) {
    anomalies.summary.total = anomalies.detected.length;
    
    anomalies.detected.forEach(anomaly => {
      // Count by type
      if (!anomalies.summary.byType[anomaly.type]) {
        anomalies.summary.byType[anomaly.type] = 0;
      }
      anomalies.summary.byType[anomaly.type]++;
      
      // Count by severity
      anomalies.summary.bySeverity[anomaly.severity]++;
      
      // Sum estimated impact
      anomalies.summary.totalImpact += anomaly.estimatedImpact || 0;
    });
    
    this.logger.log(`📊 Anomaly summary: ${anomalies.summary.total} total, €${anomalies.summary.totalImpact.toFixed(2)} impact`, 'INFO');
  }

  // ===== PUBLIC API FOR INTEGRATION =====
  
  // Może być używane przez FullAnalyzer
  quickAnalyze(integratedData) {
    try {
      const result = this.detectAnomalies(integratedData);
      
      // Return simplified format for integration
      return {
        anomaliesFound: result.detected.length,
        criticalIssues: result.summary.bySeverity.HIGH,
        totalImpact: result.summary.totalImpact,
        topInsights: result.insights.slice(0, 3),
        quickWins: result.detected
          .filter(a => a.confidence > 0.8 && a.estimatedImpact > 20)
          .slice(0, 5)
      };
    } catch (error) {
      this.logger.log(`Error in quick analyze: ${error.message}`, 'ERROR');
      return {
        anomaliesFound: 0,
        criticalIssues: 0,
        totalImpact: 0,
        topInsights: [],
        quickWins: []
      };
    }
  }
}