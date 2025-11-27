/**
 * LLTM Test Data Generator
 * Generates synthetic Amazon reports for testing LAO
 * @version 1.0
 */

const TestDataGenerator = {

  /**
   * Generate a complete test report dataset
   * @param {Object} options - Generation options
   * @returns {Object} Generated test data with metadata
   */
  generateTestReport(options = {}) {
    const defaults = {
      rowCount: 100,
      format: 'EU',
      edgeCases: [],
      reportType: 'SP_SEARCH_TERM',
      includeHeaders: true
    };

    const config = { ...defaults, ...options };

    const headers = this.getHeaders(config.reportType);
    const data = [];

    // Add headers if needed
    if (config.includeHeaders) {
      data.push(headers);
    }

    // Generate rows based on edge cases and normal distribution
    for (let i = 0; i < config.rowCount; i++) {
      const row = this.generateRow(headers, config, i);
      data.push(row);
    }

    return {
      data: data,
      headers: headers,
      metadata: {
        rowCount: config.rowCount,
        format: config.format,
        reportType: config.reportType,
        generatedAt: new Date().toISOString(),
        edgeCases: config.edgeCases
      }
    };
  },

  /**
   * Get headers for a specific report type
   */
  getHeaders(reportType) {
    const headerSets = {
      'SP_SEARCH_TERM': [
        'Campaign Name', 'Campaign Id', 'Ad Group Name', 'Ad Group Id',
        'Keyword Text', 'Keyword Id', 'Match Type', 'Customer Search Term',
        'Impressions', 'Clicks', 'Click-Thru Rate (CTR)', 'Cost Per Click (CPC)',
        'Spend', '7 Day Total Sales', '7 Day Total Orders', 'Total ACOS',
        'Total ROAS', '7 Day Conversion Rate', 'Bid', 'State'
      ],
      'SP_CAMPAIGNS': [
        'Product', 'Entity', 'Operation', 'Campaign Id', 'Campaign Name',
        'Campaign Daily Budget', 'Portfolio Id', 'Campaign Start Date',
        'Campaign End Date', 'Campaign Targeting Type', 'Campaign Status',
        'Ad Group Id', 'Ad Group Name', 'Ad Group Default Bid', 'Ad Group Status',
        'Keyword Id', 'Keyword Text', 'Match Type', 'Keyword Status', 'Bid',
        'Impressions', 'Clicks', 'Spend', '7 Day Total Sales', '7 Day Total Orders',
        'Total ACOS', 'Total ROAS', 'Conversion Rate'
      ],
      'BULK_BUILDER': [
        'Campaign Name', 'Campaign Id', 'Ad Group Name', 'Ad Group Id',
        'Keyword Text', 'Match Type', 'Customer Search Term',
        'Impressions', 'Clicks', 'Spend', '7 Day Total Sales', '7 Day Total Orders',
        'Total ACOS', 'Bid', 'State', 'Daily Budget',
        '💡 Recommendation', '📊 Confidence', '📝 Reason', '✅ Apply Change'
      ]
    };

    return headerSets[reportType] || headerSets['SP_SEARCH_TERM'];
  },

  /**
   * Generate a single data row
   */
  generateRow(headers, config, index) {
    const row = [];
    const isEdgeCase = this.shouldBeEdgeCase(config.edgeCases, index, config.rowCount);

    headers.forEach((header, colIndex) => {
      const value = this.generateCellValue(header, config, isEdgeCase, index);
      row.push(value);
    });

    return row;
  },

  /**
   * Determine if a row should be an edge case
   */
  shouldBeEdgeCase(edgeCases, index, totalRows) {
    if (edgeCases.length === 0) return null;

    // Distribute edge cases throughout the data
    const edgeCaseInterval = Math.floor(totalRows / (edgeCases.length + 1));
    const edgeCaseIndex = Math.floor(index / edgeCaseInterval);

    if (edgeCaseIndex < edgeCases.length && index % edgeCaseInterval === 0) {
      return edgeCases[edgeCaseIndex];
    }

    return null;
  },

  /**
   * Generate value for a specific cell
   */
  generateCellValue(header, config, edgeCase, rowIndex) {
    const headerLower = header.toLowerCase();

    // Handle edge cases
    if (edgeCase === LLTM_CONFIG.EDGE_CASES.ALL_ZEROS) {
      if (this.isNumericColumn(headerLower)) {
        return this.formatNumber(0, config.format);
      }
    }

    if (edgeCase === LLTM_CONFIG.EDGE_CASES.HIGH_ACOS) {
      if (headerLower.includes('acos')) {
        return this.formatNumber(this.random(200, 500), config.format);
      }
    }

    if (edgeCase === LLTM_CONFIG.EDGE_CASES.VERY_SMALL) {
      if (this.isNumericColumn(headerLower)) {
        return this.formatNumber(0.001, config.format);
      }
    }

    if (edgeCase === LLTM_CONFIG.EDGE_CASES.VERY_LARGE) {
      if (this.isNumericColumn(headerLower)) {
        return this.formatNumber(999999, config.format);
      }
    }

    if (edgeCase === LLTM_CONFIG.EDGE_CASES.SPECIAL_CHARS) {
      if (headerLower.includes('campaign') || headerLower.includes('keyword')) {
        return `Test-Campaign™-ąćęłńóśźż-${rowIndex}`;
      }
    }

    if (edgeCase === LLTM_CONFIG.EDGE_CASES.NULL_VALUES) {
      return '';
    }

    // Normal value generation
    return this.generateNormalValue(headerLower, config, rowIndex);
  },

  /**
   * Generate normal (non-edge-case) values
   */
  generateNormalValue(headerLower, config, rowIndex) {
    // Campaign and Ad Group names
    if (headerLower.includes('campaign name')) {
      return `Campaign_${Math.floor(rowIndex / 20) + 1}`;
    }

    if (headerLower.includes('campaign id')) {
      return `CAMP${String(Math.floor(rowIndex / 20) + 1).padStart(8, '0')}`;
    }

    if (headerLower.includes('ad group name')) {
      return `AdGroup_${Math.floor(rowIndex / 5) + 1}`;
    }

    if (headerLower.includes('ad group id')) {
      return `AG${String(Math.floor(rowIndex / 5) + 1).padStart(10, '0')}`;
    }

    // Keywords and search terms
    if (headerLower.includes('keyword text') || headerLower.includes('keyword')) {
      return this.generateKeyword(rowIndex);
    }

    if (headerLower.includes('keyword id')) {
      return `KW${String(rowIndex + 1).padStart(10, '0')}`;
    }

    if (headerLower.includes('search term')) {
      return this.generateSearchTerm(rowIndex);
    }

    if (headerLower.includes('match type')) {
      const types = ['broad', 'phrase', 'exact'];
      return types[rowIndex % 3];
    }

    // Metrics
    if (headerLower.includes('impressions')) {
      return this.formatNumber(this.random(100, 50000), config.format, 0);
    }

    if (headerLower.includes('clicks')) {
      return this.formatNumber(this.random(0, 500), config.format, 0);
    }

    if (headerLower.includes('ctr') || headerLower.includes('click-thru')) {
      return this.formatNumber(this.random(0.1, 15), config.format, 2) + '%';
    }

    if (headerLower.includes('cpc') || headerLower.includes('cost per click')) {
      return this.formatNumber(this.random(0.10, 5.00), config.format, 2);
    }

    if (headerLower.includes('spend') || headerLower.includes('cost')) {
      return this.formatNumber(this.random(0, 500), config.format, 2);
    }

    if (headerLower.includes('sales') || headerLower.includes('revenue')) {
      // Some rows have zero sales (for testing pause functionality)
      if (rowIndex % 5 === 0) {
        return this.formatNumber(0, config.format, 2);
      }
      return this.formatNumber(this.random(0, 2000), config.format, 2);
    }

    if (headerLower.includes('orders')) {
      if (rowIndex % 5 === 0) {
        return this.formatNumber(0, config.format, 0);
      }
      return this.formatNumber(this.random(0, 50), config.format, 0);
    }

    if (headerLower.includes('acos')) {
      return this.formatNumber(this.random(5, 100), config.format, 1) + '%';
    }

    if (headerLower.includes('roas')) {
      return this.formatNumber(this.random(0.5, 10), config.format, 2);
    }

    if (headerLower.includes('conversion')) {
      return this.formatNumber(this.random(0, 25), config.format, 1) + '%';
    }

    if (headerLower.includes('bid')) {
      return this.formatNumber(this.random(0.20, 3.00), config.format, 2);
    }

    if (headerLower.includes('budget')) {
      return this.formatNumber(this.random(10, 100), config.format, 2);
    }

    if (headerLower.includes('state') || headerLower.includes('status')) {
      return 'enabled';
    }

    // Analysis columns
    if (headerLower.includes('recommendation')) {
      const recs = ['INCREASE_BID', 'DECREASE_BID', 'PAUSE', 'ADD_NEGATIVE', 'KEEP'];
      return recs[rowIndex % 5];
    }

    if (headerLower.includes('confidence')) {
      return this.random(60, 99) + '%';
    }

    if (headerLower.includes('reason')) {
      const reasons = [
        'High ACOS - reduce bid',
        'Good performance - increase bid',
        'Zero sales - consider pause',
        'Low CTR - add as negative',
        'Optimal performance'
      ];
      return reasons[rowIndex % 5];
    }

    if (headerLower.includes('apply')) {
      return false;
    }

    // Default
    return '';
  },

  /**
   * Generate a random keyword
   */
  generateKeyword(index) {
    const keywords = [
      'wireless headphones', 'bluetooth speaker', 'phone case',
      'laptop stand', 'usb cable', 'power bank', 'mouse pad',
      'webcam hd', 'keyboard wireless', 'monitor arm'
    ];
    return keywords[index % keywords.length];
  },

  /**
   * Generate a random search term
   */
  generateSearchTerm(index) {
    const prefixes = ['best', 'cheap', 'top rated', 'professional', ''];
    const keywords = this.generateKeyword(index);
    const suffixes = ['for gaming', 'for office', '2024', 'premium', ''];

    const prefix = prefixes[index % prefixes.length];
    const suffix = suffixes[Math.floor(index / 2) % suffixes.length];

    return [prefix, keywords, suffix].filter(s => s).join(' ');
  },

  /**
   * Check if a column should contain numeric values
   */
  isNumericColumn(headerLower) {
    const numericPatterns = [
      'impressions', 'clicks', 'spend', 'sales', 'orders', 'bid',
      'budget', 'ctr', 'cpc', 'acos', 'roas', 'conversion', 'cost'
    ];
    return numericPatterns.some(pattern => headerLower.includes(pattern));
  },

  /**
   * Format a number according to locale
   */
  formatNumber(value, format, decimals = 2) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }

    const fixed = value.toFixed(decimals);

    if (format === 'EU') {
      // Replace decimal point with comma for EU format
      return fixed.replace('.', ',');
    }

    return fixed;
  },

  /**
   * Generate random number in range
   */
  random(min, max) {
    return Math.random() * (max - min) + min;
  },

  /**
   * Generate test data for row selection test
   */
  generateRowSelectionData(options = {}) {
    const defaults = {
      totalRows: 100,
      matchingRows: 15, // Rows that should match criteria
      format: 'EU',
      criteria: { minClicks: 10, minSpend: 5 }
    };

    const config = { ...defaults, ...options };
    const headers = this.getHeaders('BULK_BUILDER');
    const data = [headers];

    const clicksCol = headers.indexOf('Clicks');
    const spendCol = headers.indexOf('Spend');

    // Track how many matching rows we've created
    let matchingCreated = 0;

    for (let i = 0; i < config.totalRows; i++) {
      const row = [];
      const shouldMatch = matchingCreated < config.matchingRows &&
                          (i % Math.floor(config.totalRows / config.matchingRows) === 0);

      headers.forEach((header, colIndex) => {
        const headerLower = header.toLowerCase();

        if (headerLower.includes('clicks')) {
          const clicks = shouldMatch ?
            this.random(config.criteria.minClicks, config.criteria.minClicks + 50) :
            this.random(0, config.criteria.minClicks - 1);
          row.push(this.formatNumber(clicks, config.format, 0));
        } else if (headerLower.includes('spend')) {
          const spend = shouldMatch ?
            this.random(config.criteria.minSpend, config.criteria.minSpend + 20) :
            this.random(0, config.criteria.minSpend - 0.5);
          row.push(this.formatNumber(spend, config.format, 2));
        } else {
          row.push(this.generateNormalValue(headerLower, config, i));
        }
      });

      if (shouldMatch) matchingCreated++;
      data.push(row);
    }

    return {
      data: data,
      headers: headers,
      metadata: {
        totalRows: config.totalRows,
        expectedMatchingRows: matchingCreated,
        criteria: config.criteria,
        format: config.format
      }
    };
  },

  /**
   * Generate test data for bid changes test
   */
  generateBidChangeData(options = {}) {
    const defaults = {
      bids: [0.50, 0.75, 1.00, 1.25, 1.50, 0.60, 0.80, 0.90, 1.10, 1.30],
      changePercent: 15,
      format: 'EU'
    };

    const config = { ...defaults, ...options };
    const headers = this.getHeaders('BULK_BUILDER');
    const data = [headers];

    const bidCol = headers.indexOf('Bid');
    const applyCol = headers.indexOf('✅ Apply Change');

    config.bids.forEach((bid, i) => {
      const row = [];

      headers.forEach((header, colIndex) => {
        const headerLower = header.toLowerCase();

        if (headerLower.includes('bid') && !headerLower.includes('keyword')) {
          row.push(this.formatNumber(bid, config.format, 2));
        } else if (headerLower.includes('apply')) {
          row.push(true); // Mark for change
        } else {
          row.push(this.generateNormalValue(headerLower, config, i));
        }
      });

      data.push(row);
    });

    // Calculate expected new bids
    const expectedNewBids = config.bids.map(bid =>
      Math.round((bid * (1 + config.changePercent / 100)) * 100) / 100
    );

    return {
      data: data,
      headers: headers,
      metadata: {
        originalBids: config.bids,
        changePercent: config.changePercent,
        expectedNewBids: expectedNewBids,
        format: config.format
      }
    };
  },

  /**
   * Generate test data for pause targets test
   */
  generatePauseTargetsData(options = {}) {
    const defaults = {
      totalRows: 100,
      zeroSalesRows: 20, // Rows with zero sales
      format: 'EU',
      criteria: { minClicks: 10, minSpend: 5, sales: 0 }
    };

    const config = { ...defaults, ...options };
    const headers = this.getHeaders('BULK_BUILDER');
    const data = [headers];

    let zeroSalesCreated = 0;

    for (let i = 0; i < config.totalRows; i++) {
      const row = [];
      const shouldBeZeroSales = zeroSalesCreated < config.zeroSalesRows &&
                                 (i % Math.floor(config.totalRows / config.zeroSalesRows) === 0);

      headers.forEach((header, colIndex) => {
        const headerLower = header.toLowerCase();

        if (headerLower.includes('sales') || headerLower.includes('orders')) {
          if (shouldBeZeroSales) {
            row.push(this.formatNumber(0, config.format, headerLower.includes('orders') ? 0 : 2));
          } else {
            row.push(this.formatNumber(this.random(10, 500), config.format, headerLower.includes('orders') ? 0 : 2));
          }
        } else if (headerLower.includes('clicks')) {
          // Ensure zero-sales rows meet clicks criteria
          const clicks = shouldBeZeroSales ?
            this.random(config.criteria.minClicks + 5, 50) :
            this.random(0, 100);
          row.push(this.formatNumber(clicks, config.format, 0));
        } else if (headerLower.includes('spend')) {
          // Ensure zero-sales rows meet spend criteria
          const spend = shouldBeZeroSales ?
            this.random(config.criteria.minSpend + 2, 30) :
            this.random(0, 50);
          row.push(this.formatNumber(spend, config.format, 2));
        } else if (headerLower.includes('recommendation')) {
          row.push(shouldBeZeroSales ? 'PAUSE' : 'KEEP');
        } else {
          row.push(this.generateNormalValue(headerLower, config, i));
        }
      });

      if (shouldBeZeroSales) zeroSalesCreated++;
      data.push(row);
    }

    return {
      data: data,
      headers: headers,
      metadata: {
        totalRows: config.totalRows,
        expectedPausedRows: zeroSalesCreated,
        criteria: config.criteria,
        format: config.format
      }
    };
  },

  /**
   * Generate test data for column mapping test
   */
  generateColumnMappingData(format1 = true, options = {}) {
    const defaults = {
      rowCount: 50,
      format: 'EU'
    };

    const config = { ...defaults, ...options };

    // Two different header formats
    const headers1 = ['Keyword text', 'Match type', 'Customer search term', 'Clicks', 'Spend', 'ACOS'];
    const headers2 = ['Targeting', 'Match Type', 'Customer Search Term', 'Clicks', 'Spend', 'Total ACOS'];

    const headers = format1 ? headers1 : headers2;
    const data = [headers];

    for (let i = 0; i < config.rowCount; i++) {
      const row = headers.map((header, colIndex) => {
        const headerLower = header.toLowerCase();
        return this.generateNormalValue(headerLower, config, i);
      });
      data.push(row);
    }

    return {
      data: data,
      headers: headers,
      metadata: {
        format: format1 ? 'SP_Search_Term_Report' : 'Sponsored_Products',
        rowCount: config.rowCount,
        numberFormat: config.format
      }
    };
  },

  /**
   * Generate test data for export test
   */
  generateExportData(options = {}) {
    const defaults = {
      totalRows: 50,
      pauseRows: 10,
      bidChangeRows: 20,
      budgetChangeRows: 20,
      format: 'US' // Export should be in US format
    };

    const config = { ...defaults, ...options };
    const headers = this.getHeaders('BULK_BUILDER');
    const data = [headers];

    for (let i = 0; i < config.totalRows; i++) {
      const row = [];

      // Determine action type for this row
      let action = 'KEEP';
      if (i < config.pauseRows) {
        action = 'PAUSE';
      } else if (i < config.pauseRows + config.bidChangeRows) {
        action = 'BID_CHANGE';
      } else if (i < config.pauseRows + config.bidChangeRows + config.budgetChangeRows) {
        action = 'BUDGET_CHANGE';
      }

      headers.forEach((header, colIndex) => {
        const headerLower = header.toLowerCase();

        if (headerLower.includes('recommendation')) {
          row.push(action === 'PAUSE' ? 'PAUSE' :
                   action === 'BID_CHANGE' ? 'INCREASE_BID' : 'KEEP');
        } else if (headerLower.includes('apply')) {
          row.push(action !== 'KEEP');
        } else if (headerLower.includes('state')) {
          row.push(action === 'PAUSE' ? 'paused' : 'enabled');
        } else {
          row.push(this.generateNormalValue(headerLower, config, i));
        }
      });

      data.push(row);
    }

    return {
      data: data,
      headers: headers,
      metadata: {
        totalRows: config.totalRows,
        pauseRows: config.pauseRows,
        bidChangeRows: config.bidChangeRows,
        budgetChangeRows: config.budgetChangeRows,
        format: config.format
      }
    };
  },

  /**
   * Generate test data for budget changes test
   */
  generateBudgetChangeData(options = {}) {
    const defaults = {
      budgets: [10, 20, 30, 40, 50],
      acosValues: [15, 25, 35, 18, 45], // ACOS for each campaign
      changePercent: 20,
      acosThreshold: 20, // Only change budgets for ACOS > 20%
      format: 'EU'
    };

    const config = { ...defaults, ...options };
    const headers = this.getHeaders('BULK_BUILDER');
    const data = [headers];

    // Create 5 campaigns with multiple rows each
    config.budgets.forEach((budget, campIndex) => {
      const rowsPerCampaign = 5;

      for (let i = 0; i < rowsPerCampaign; i++) {
        const row = [];
        const rowIndex = campIndex * rowsPerCampaign + i;

        headers.forEach((header) => {
          const headerLower = header.toLowerCase();

          if (headerLower.includes('campaign name')) {
            row.push(`Campaign_${campIndex + 1}`);
          } else if (headerLower.includes('budget')) {
            row.push(this.formatNumber(budget, config.format, 2));
          } else if (headerLower.includes('acos')) {
            row.push(this.formatNumber(config.acosValues[campIndex], config.format, 1) + '%');
          } else {
            row.push(this.generateNormalValue(headerLower, config, rowIndex));
          }
        });

        data.push(row);
      }
    });

    // Calculate expected changes
    const expectedChanges = config.acosValues.filter(acos => acos > config.acosThreshold).length;
    const expectedNewBudgets = config.budgets.map((budget, i) =>
      config.acosValues[i] > config.acosThreshold ?
        Math.round(budget * (1 + config.changePercent / 100) * 100) / 100 :
        budget
    );

    return {
      data: data,
      headers: headers,
      metadata: {
        campaigns: config.budgets.length,
        originalBudgets: config.budgets,
        acosValues: config.acosValues,
        changePercent: config.changePercent,
        acosThreshold: config.acosThreshold,
        expectedChanges: expectedChanges,
        expectedNewBudgets: expectedNewBudgets,
        format: config.format
      }
    };
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { TestDataGenerator };
}
