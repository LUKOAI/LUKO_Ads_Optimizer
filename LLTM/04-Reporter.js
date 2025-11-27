/**
 * LLTM Reporter
 * Generates test reports in Google Sheets and console output
 * @version 1.0
 */

const Reporter = {

  /**
   * Generate complete test report
   * @param {Array} testResults - Array of test results
   * @param {Object} metadata - Test run metadata
   */
  generateReport(testResults, metadata = {}) {
    const report = {
      timestamp: new Date(),
      version: LLTM_CONFIG.VERSION,
      results: testResults,
      summary: this.calculateSummary(testResults),
      metadata: metadata
    };

    // Generate both outputs
    this.generateSheetReport(report);
    this.generateConsoleReport(report);

    return report;
  },

  /**
   * Calculate summary statistics
   */
  calculateSummary(testResults) {
    const total = testResults.length;
    const passed = testResults.filter(r => r.status === LLTM_CONFIG.STATUS.PASS).length;
    const partial = testResults.filter(r => r.status === LLTM_CONFIG.STATUS.PARTIAL).length;
    const failed = testResults.filter(r =>
      r.status === LLTM_CONFIG.STATUS.FAIL || r.status === LLTM_CONFIG.STATUS.ERROR
    ).length;

    const totalScore = testResults.reduce((sum, r) => sum + (r.score || 0), 0);
    const avgScore = total > 0 ? Math.round(totalScore / total) : 0;

    const totalDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      total: total,
      passed: passed,
      partial: partial,
      failed: failed,
      skipped: total - passed - partial - failed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      avgScore: avgScore,
      totalDuration: totalDuration,
      criticalFailures: testResults.filter(r =>
        r.group === 'A' && r.status === LLTM_CONFIG.STATUS.FAIL
      ).length
    };
  },

  /**
   * Generate Google Sheets report
   */
  generateSheetReport(report) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create or get Test Results sheet
    let sheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_RESULTS);
    if (!sheet) {
      sheet = ss.insertSheet(LLTM_CONFIG.SHEETS.TEST_RESULTS);
    } else {
      sheet.clear();
    }

    // Set up header
    const headers = [
      'Test ID', 'Test Name', 'Group', 'Status', 'Score',
      'Expected', 'Actual', 'Duration (ms)', 'Assertions', 'Notes'
    ];

    // Header row
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(LLTM_CONFIG.COLORS.HEADER)
      .setFontColor(LLTM_CONFIG.COLORS.HEADER_TEXT)
      .setFontWeight('bold');

    // Data rows
    const data = report.results.map(result => [
      result.testId,
      result.testName,
      result.group || 'A',
      result.status,
      result.score + '%',
      result.expected || '',
      result.actual || '',
      result.duration || 0,
      result.assertions ? result.assertions.length : 0,
      result.summary || ''
    ]);

    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, headers.length).setValues(data);

      // Apply conditional formatting
      for (let i = 0; i < data.length; i++) {
        const statusCell = sheet.getRange(i + 2, 4);
        const scoreCell = sheet.getRange(i + 2, 5);

        // Color based on status
        const status = report.results[i].status;
        if (status === LLTM_CONFIG.STATUS.PASS) {
          statusCell.setBackground(LLTM_CONFIG.COLORS.SUCCESS);
          scoreCell.setBackground(LLTM_CONFIG.COLORS.SUCCESS);
        } else if (status === LLTM_CONFIG.STATUS.PARTIAL) {
          statusCell.setBackground(LLTM_CONFIG.COLORS.PARTIAL);
          scoreCell.setBackground(LLTM_CONFIG.COLORS.PARTIAL);
        } else {
          statusCell.setBackground(LLTM_CONFIG.COLORS.FAILURE);
          scoreCell.setBackground(LLTM_CONFIG.COLORS.FAILURE);
        }
      }
    }

    // Add summary section
    const summaryRow = data.length + 3;
    this.addSummarySection(sheet, summaryRow, report.summary);

    // Add failure details
    if (report.summary.failed > 0) {
      const failureRow = summaryRow + 8;
      this.addFailureDetails(sheet, failureRow, report.results);
    }

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    // Set column widths for better readability
    sheet.setColumnWidth(10, 300); // Notes column

    return sheet;
  },

  /**
   * Add summary section to sheet
   */
  addSummarySection(sheet, startRow, summary) {
    // Title
    sheet.getRange(startRow, 1)
      .setValue('📊 SUMMARY')
      .setFontWeight('bold')
      .setFontSize(14);

    // Summary data
    const summaryData = [
      ['Total Tests', summary.total],
      ['✅ Passed', summary.passed],
      ['⚠️ Partial', summary.partial],
      ['❌ Failed', summary.failed],
      ['Pass Rate', summary.passRate + '%'],
      ['Avg Score', summary.avgScore + '%'],
      ['Total Duration', (summary.totalDuration / 1000).toFixed(2) + 's']
    ];

    sheet.getRange(startRow + 1, 1, summaryData.length, 2).setValues(summaryData);

    // Highlight pass rate
    const passRateCell = sheet.getRange(startRow + 5, 2);
    if (summary.passRate === 100) {
      passRateCell.setBackground(LLTM_CONFIG.COLORS.SUCCESS);
    } else if (summary.passRate >= 70) {
      passRateCell.setBackground(LLTM_CONFIG.COLORS.PARTIAL);
    } else {
      passRateCell.setBackground(LLTM_CONFIG.COLORS.FAILURE);
    }
  },

  /**
   * Add failure details section
   */
  addFailureDetails(sheet, startRow, results) {
    const failures = results.filter(r =>
      r.status === LLTM_CONFIG.STATUS.FAIL || r.status === LLTM_CONFIG.STATUS.ERROR
    );

    if (failures.length === 0) return;

    // Title
    sheet.getRange(startRow, 1)
      .setValue('❌ FAILURE DETAILS')
      .setFontWeight('bold')
      .setFontSize(14)
      .setFontColor('#cc0000');

    let currentRow = startRow + 1;

    failures.forEach((failure, index) => {
      // Failure header
      sheet.getRange(currentRow, 1)
        .setValue(`${failure.testId}: ${failure.testName}`)
        .setFontWeight('bold');
      currentRow++;

      // Failed assertions
      if (failure.assertions) {
        const failedAssertions = failure.assertions.filter(a => !a.passed);
        failedAssertions.forEach(assertion => {
          sheet.getRange(currentRow, 1, 1, 4).setValues([[
            '  • ' + assertion.name,
            'Expected: ' + assertion.expected,
            'Actual: ' + assertion.actual,
            assertion.message || ''
          ]]);
          currentRow++;
        });
      }

      // Anomalies
      if (failure.anomalies && failure.anomalies.length > 0) {
        sheet.getRange(currentRow, 1)
          .setValue('  Anomalies:')
          .setFontStyle('italic');
        currentRow++;

        failure.anomalies.forEach(anomaly => {
          sheet.getRange(currentRow, 1)
            .setValue('    - ' + anomaly)
            .setFontColor('#996600');
          currentRow++;
        });
      }

      // Possible causes
      if (failure.possibleCauses && failure.possibleCauses.length > 0) {
        sheet.getRange(currentRow, 1)
          .setValue('  💡 Possible Causes:')
          .setFontStyle('italic');
        currentRow++;

        failure.possibleCauses.slice(0, 3).forEach((cause, i) => {
          sheet.getRange(currentRow, 1)
            .setValue(`    ${i + 1}. ${cause}`)
            .setFontColor('#0066cc');
          currentRow++;
        });
      }

      currentRow++; // Blank row between failures
    });
  },

  /**
   * Generate console output
   */
  generateConsoleReport(report) {
    const w = LLTM_CONFIG.CONSOLE.WIDTH;
    const sep = LLTM_CONFIG.CONSOLE.SEPARATOR.repeat(w);
    const output = [];

    // Header
    output.push('');
    output.push('🚀 LUKO LAO TEST MACHINE - RESULTS');
    output.push(sep);
    output.push(`📅 ${report.timestamp.toLocaleString()}`);
    output.push(`📦 Version: ${report.version}`);
    output.push(sep);
    output.push('');

    // Test results
    output.push('TEST RESULTS');
    output.push(sep);

    report.results.forEach((result, index) => {
      const num = `[${index + 1}/${report.results.length}]`;
      output.push(`${num} ${result.testName}`);
      output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} Status: ${result.status}`);
      output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} Score: ${result.score}%`);

      if (result.expected) {
        output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} Expected: ${result.expected}`);
      }
      if (result.actual) {
        output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} Actual: ${result.actual}`);
      }

      output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} Duration: ${result.duration}ms`);

      // Show failed assertions
      if (result.assertions) {
        const failedAssertions = result.assertions.filter(a => !a.passed);
        if (failedAssertions.length > 0) {
          failedAssertions.forEach(a => {
            output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} ❌ ${a.name}: ${a.message}`);
          });
        }
      }

      // Show anomalies
      if (result.anomalies && result.anomalies.length > 0) {
        result.anomalies.forEach(a => {
          output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET} ⚠️ ${a}`);
        });
      }

      // Show possible causes for failures
      if (result.status === LLTM_CONFIG.STATUS.FAIL && result.possibleCauses) {
        output.push(`   ${LLTM_CONFIG.CONSOLE.BULLET_LAST} 💡 Possible cause: ${result.possibleCauses[0]}`);
      }

      output.push('');
    });

    // Summary
    output.push(sep);
    output.push('📊 SUMMARY');
    output.push(sep);
    output.push(`✅ Passed:  ${report.summary.passed}/${report.summary.total} (${report.summary.passRate}%)`);
    output.push(`⚠️ Partial: ${report.summary.partial}/${report.summary.total}`);
    output.push(`❌ Failed:  ${report.summary.failed}/${report.summary.total}`);
    output.push(`⏱️  Total time: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    output.push(`📈 Avg Score: ${report.summary.avgScore}%`);
    output.push('');

    // Regression warning
    if (report.metadata.regression) {
      output.push(sep);
      output.push('⚠️ REGRESSION DETECTED!');
      output.push(`Yesterday: ${report.metadata.regression.previousScore}%`);
      output.push(`Today: ${report.summary.avgScore}%`);
      output.push(`Change: ${report.metadata.regression.change}%`);
      output.push('');

      if (report.metadata.regression.newlyFailed) {
        output.push('🔍 Newly Failed Tests:');
        report.metadata.regression.newlyFailed.forEach(test => {
          output.push(`  - ${test}`);
        });
        output.push('');
      }
    }

    // Actions
    if (report.summary.failed > 0) {
      output.push(sep);
      output.push('💡 SUGGESTED ACTIONS');
      output.push(sep);

      const failures = report.results.filter(r => r.status === LLTM_CONFIG.STATUS.FAIL);
      failures.forEach((failure, i) => {
        output.push(`${i + 1}. Fix ${failure.testName}:`);
        if (failure.possibleCauses && failure.possibleCauses[0]) {
          output.push(`   Check: ${failure.possibleCauses[0]}`);
        }
      });
      output.push('');
    }

    output.push(sep);
    output.push(`📋 Full report: ${LLTM_CONFIG.SHEETS.TEST_RESULTS}`);
    output.push(sep);

    // Log to console
    const outputStr = output.join('\n');
    console.log(outputStr);

    return outputStr;
  },

  /**
   * Generate detailed failure report
   */
  generateFailureReport(testResult) {
    const report = [];

    report.push(`❌ FAIL: ${testResult.testName} (${testResult.score}%)`);
    report.push('');
    report.push('🔍 ROOT CAUSE ANALYSIS:');
    report.push(LLTM_CONFIG.CONSOLE.SEPARATOR.repeat(50));
    report.push('');

    // Symptom
    if (testResult.assertions) {
      const failed = testResult.assertions.filter(a => !a.passed);
      if (failed.length > 0) {
        report.push(`Symptom: ${failed[0].message}`);
        report.push('');
      }
    }

    // Possible causes
    if (testResult.possibleCauses && testResult.possibleCauses.length > 0) {
      report.push('Possible Causes (ranked by probability):');
      report.push('');

      testResult.possibleCauses.forEach((cause, i) => {
        const confidence = 90 - (i * 20);
        report.push(`${i + 1}. [${confidence}% confidence] ${cause}`);
      });
    }

    // Recommended action
    report.push('');
    report.push(LLTM_CONFIG.CONSOLE.SEPARATOR.repeat(50));
    report.push('');
    report.push('💡 Recommended Action:');
    if (testResult.possibleCauses && testResult.possibleCauses[0]) {
      report.push(testResult.possibleCauses[0]);
    }

    return report.join('\n');
  },

  /**
   * Add regression info to report
   */
  addRegressionInfo(sheet, startRow, regressionData) {
    if (!regressionData) return;

    // Title
    sheet.getRange(startRow, 1)
      .setValue('⚠️ REGRESSION ANALYSIS')
      .setFontWeight('bold')
      .setFontSize(14)
      .setFontColor('#cc6600');

    const data = [
      ['Previous Score', regressionData.previousScore + '%'],
      ['Current Score', regressionData.currentScore + '%'],
      ['Change', regressionData.change + '%'],
      ['Last Pass Date', regressionData.lastPassDate || 'N/A']
    ];

    sheet.getRange(startRow + 1, 1, data.length, 2).setValues(data);

    if (regressionData.newlyFailed && regressionData.newlyFailed.length > 0) {
      sheet.getRange(startRow + data.length + 2, 1)
        .setValue('Newly Failed Tests:')
        .setFontWeight('bold');

      regressionData.newlyFailed.forEach((test, i) => {
        sheet.getRange(startRow + data.length + 3 + i, 1)
          .setValue('• ' + test)
          .setFontColor('#cc0000');
      });
    }
  },

  /**
   * Export report to JSON
   */
  exportToJSON(report) {
    return JSON.stringify(report, null, 2);
  },

  /**
   * Create trend chart (placeholder for future)
   */
  createTrendChart(sheet, startRow, historyData) {
    // This would create a chart showing test score trends over time
    // For now, just add a placeholder
    sheet.getRange(startRow, 1)
      .setValue('📈 TREND CHART (coming soon)')
      .setFontStyle('italic');
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { Reporter };
}
