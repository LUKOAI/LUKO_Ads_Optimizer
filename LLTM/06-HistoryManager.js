/**
 * LLTM History Manager
 * Manages test history and regression detection
 * @version 1.0
 */

const HistoryManager = {

  /**
   * Save test results to history
   * @param {Object} report - Complete test report
   */
  saveToHistory(report) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let historySheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_HISTORY);

    if (!historySheet) {
      historySheet = ss.insertSheet(LLTM_CONFIG.SHEETS.TEST_HISTORY);
      this.initializeHistorySheet(historySheet);
    }

    // Add new entry
    const entry = this.createHistoryEntry(report);
    const lastRow = historySheet.getLastRow();

    historySheet.getRange(lastRow + 1, 1, 1, entry.length).setValues([entry]);

    // Clean old entries
    this.cleanOldEntries(historySheet);

    return entry;
  },

  /**
   * Initialize history sheet with headers
   */
  initializeHistorySheet(sheet) {
    const headers = [
      'Timestamp', 'Version', 'Total Tests', 'Passed', 'Partial', 'Failed',
      'Pass Rate', 'Avg Score', 'Duration (s)', 'Critical Failures',
      'Test Details JSON'
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(LLTM_CONFIG.COLORS.HEADER)
      .setFontColor(LLTM_CONFIG.COLORS.HEADER_TEXT)
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
  },

  /**
   * Create a history entry from report
   */
  createHistoryEntry(report) {
    return [
      report.timestamp.toISOString(),
      report.version || LLTM_CONFIG.VERSION,
      report.summary.total,
      report.summary.passed,
      report.summary.partial,
      report.summary.failed,
      report.summary.passRate + '%',
      report.summary.avgScore + '%',
      (report.summary.totalDuration / 1000).toFixed(2),
      report.summary.criticalFailures || 0,
      JSON.stringify(report.results.map(r => ({
        id: r.testId,
        name: r.testName,
        status: r.status,
        score: r.score
      })))
    ];
  },

  /**
   * Clean entries older than retention period
   */
  cleanOldEntries(sheet) {
    const keepDays = LLTM_CONFIG.HISTORY.KEEP_DAYS;
    const maxEntries = LLTM_CONFIG.HISTORY.MAX_ENTRIES;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    const rowsToDelete = [];

    for (let i = data.length - 1; i >= 1; i--) {
      const entryDate = new Date(data[i][0]);
      if (entryDate < cutoffDate) {
        rowsToDelete.push(i + 1);
      }
    }

    // Delete old rows (from bottom to top to preserve indices)
    rowsToDelete.forEach(row => {
      sheet.deleteRow(row);
    });

    // Also limit by max entries
    const currentRows = sheet.getLastRow();
    if (currentRows > maxEntries + 1) {
      const rowsToRemove = currentRows - maxEntries - 1;
      sheet.deleteRows(2, rowsToRemove);
    }
  },

  /**
   * Get test history
   * @param {number} limit - Number of entries to retrieve
   * @returns {Array} History entries
   */
  getHistory(limit = 30) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_HISTORY);

    if (!historySheet || historySheet.getLastRow() < 2) {
      return [];
    }

    const data = historySheet.getDataRange().getValues();
    const headers = data[0];

    const entries = [];
    const startRow = Math.max(1, data.length - limit);

    for (let i = data.length - 1; i >= startRow; i--) {
      const row = data[i];
      entries.push({
        timestamp: new Date(row[0]),
        version: row[1],
        totalTests: row[2],
        passed: row[3],
        partial: row[4],
        failed: row[5],
        passRate: parseInt(row[6]),
        avgScore: parseInt(row[7]),
        duration: parseFloat(row[8]),
        criticalFailures: row[9],
        testDetails: row[10] ? JSON.parse(row[10]) : []
      });
    }

    return entries;
  },

  /**
   * Detect regression compared to previous runs
   * @param {Object} currentReport - Current test report
   * @returns {Object} Regression analysis
   */
  detectRegression(currentReport) {
    const history = this.getHistory(LLTM_CONFIG.REGRESSION.COMPARE_LAST_N);

    if (history.length === 0) {
      return {
        isRegression: false,
        message: 'No previous test history for comparison'
      };
    }

    const currentScore = currentReport.summary.avgScore;
    const previousScores = history.map(h => h.avgScore);
    const avgPreviousScore = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;

    const scoreDiff = currentScore - avgPreviousScore;
    const threshold = LLTM_CONFIG.REGRESSION.THRESHOLD_PERCENT;

    const result = {
      isRegression: scoreDiff < -threshold,
      currentScore: currentScore,
      previousScore: Math.round(avgPreviousScore),
      change: Math.round(scoreDiff),
      comparedWith: history.length,
      lastPassDate: null,
      newlyFailed: [],
      newlyPassed: []
    };

    // Find newly failed tests
    if (history.length > 0) {
      const previousRun = history[0];

      currentReport.results.forEach(current => {
        const previous = previousRun.testDetails.find(t => t.id === current.testId);

        if (previous) {
          if (current.status === LLTM_CONFIG.STATUS.FAIL &&
              previous.status !== LLTM_CONFIG.STATUS.FAIL) {
            result.newlyFailed.push(current.testName);
          }

          if (current.status === LLTM_CONFIG.STATUS.PASS &&
              previous.status !== LLTM_CONFIG.STATUS.PASS) {
            result.newlyPassed.push(current.testName);
          }
        }
      });

      // Find last date all tests passed
      for (const entry of history) {
        if (entry.passed === entry.totalTests) {
          result.lastPassDate = entry.timestamp.toLocaleDateString();
          break;
        }
      }
    }

    return result;
  },

  /**
   * Get trend data for charts
   * @param {number} days - Number of days to include
   * @returns {Object} Trend data
   */
  getTrendData(days = 14) {
    const history = this.getHistory(days);

    if (history.length === 0) {
      return { labels: [], scores: [], passRates: [] };
    }

    const labels = [];
    const scores = [];
    const passRates = [];
    const passed = [];
    const failed = [];

    history.reverse().forEach(entry => {
      labels.push(entry.timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }));
      scores.push(entry.avgScore);
      passRates.push(entry.passRate);
      passed.push(entry.passed);
      failed.push(entry.failed);
    });

    return {
      labels: labels,
      scores: scores,
      passRates: passRates,
      passed: passed,
      failed: failed,
      summary: {
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        avgPassRate: Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length),
        trend: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0
      }
    };
  },

  /**
   * Get failure history for a specific test
   * @param {string} testId - Test ID to look up
   * @returns {Array} History of this test's results
   */
  getTestHistory(testId) {
    const history = this.getHistory(30);
    const testHistory = [];

    history.forEach(entry => {
      const testResult = entry.testDetails.find(t => t.id === testId);
      if (testResult) {
        testHistory.push({
          timestamp: entry.timestamp,
          status: testResult.status,
          score: testResult.score
        });
      }
    });

    return testHistory;
  },

  /**
   * Check if a test has been consistently failing
   * @param {string} testId - Test ID to check
   * @param {number} threshold - Number of consecutive failures
   * @returns {boolean} True if consistently failing
   */
  isConsistentlyFailing(testId, threshold = 3) {
    const testHistory = this.getTestHistory(testId);

    if (testHistory.length < threshold) return false;

    const recentResults = testHistory.slice(0, threshold);
    return recentResults.every(r =>
      r.status === LLTM_CONFIG.STATUS.FAIL ||
      r.status === LLTM_CONFIG.STATUS.ERROR
    );
  },

  /**
   * Get flaky tests (intermittent failures)
   * @returns {Array} List of flaky tests
   */
  getFlakyTests() {
    const history = this.getHistory(14);
    if (history.length < 5) return [];

    const testResults = {};

    // Collect all test results
    history.forEach(entry => {
      entry.testDetails.forEach(test => {
        if (!testResults[test.id]) {
          testResults[test.id] = { name: test.name, results: [] };
        }
        testResults[test.id].results.push(test.status);
      });
    });

    // Find tests with mixed results
    const flakyTests = [];

    Object.entries(testResults).forEach(([id, data]) => {
      const hasPass = data.results.some(r => r === LLTM_CONFIG.STATUS.PASS);
      const hasFail = data.results.some(r =>
        r === LLTM_CONFIG.STATUS.FAIL || r === LLTM_CONFIG.STATUS.ERROR
      );

      if (hasPass && hasFail) {
        const failRate = data.results.filter(r =>
          r === LLTM_CONFIG.STATUS.FAIL || r === LLTM_CONFIG.STATUS.ERROR
        ).length / data.results.length;

        if (failRate > 0.2 && failRate < 0.8) {
          flakyTests.push({
            id: id,
            name: data.name,
            failRate: Math.round(failRate * 100) + '%',
            sampleSize: data.results.length
          });
        }
      }
    });

    return flakyTests;
  },

  /**
   * Generate summary statistics
   * @returns {Object} Summary stats
   */
  getSummaryStats() {
    const history = this.getHistory(30);

    if (history.length === 0) {
      return {
        totalRuns: 0,
        avgPassRate: 0,
        avgScore: 0,
        bestRun: null,
        worstRun: null,
        lastRun: null,
        trend: 'unknown'
      };
    }

    const passRates = history.map(h => h.passRate);
    const scores = history.map(h => h.avgScore);

    return {
      totalRuns: history.length,
      avgPassRate: Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length),
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      bestRun: {
        score: Math.max(...scores),
        date: history[scores.indexOf(Math.max(...scores))].timestamp
      },
      worstRun: {
        score: Math.min(...scores),
        date: history[scores.indexOf(Math.min(...scores))].timestamp
      },
      lastRun: history[0],
      trend: scores.length >= 2 ?
        (scores[0] > scores[scores.length - 1] ? 'improving' :
         scores[0] < scores[scores.length - 1] ? 'declining' : 'stable') :
        'unknown'
    };
  },

  /**
   * Export history to JSON
   */
  exportHistory() {
    const history = this.getHistory();
    return JSON.stringify(history, null, 2);
  },

  /**
   * Clear all history
   */
  clearHistory() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_HISTORY);

    if (historySheet) {
      historySheet.clear();
      this.initializeHistorySheet(historySheet);
    }
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { HistoryManager };
}
