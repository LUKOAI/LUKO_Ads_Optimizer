/**
 * LLTM Root Cause Analyzer
 * Diagnoses test failures and suggests fixes
 * @version 1.0
 */

const RootCauseAnalyzer = {

  /**
   * Analyze a test failure and determine possible causes
   * @param {Object} testResult - The failed test result
   * @param {Object} context - Additional context (logs, sheet data)
   * @returns {Object} Analysis result with ranked causes
   */
  analyze(testResult, context = {}) {
    const analysis = {
      testId: testResult.testId,
      testName: testResult.testName,
      symptom: this.identifySymptom(testResult),
      causes: [],
      recommendedActions: [],
      relatedFiles: [],
      confidence: 0,
      historicalMatch: null
    };

    // 1. Check known issues database
    const knownIssue = this.checkKnownIssues(testResult);
    if (knownIssue) {
      analysis.causes.push({
        probability: 95,
        cause: knownIssue.cause,
        file: knownIssue.file,
        line: knownIssue.line,
        solution: knownIssue.solution,
        source: 'known_issues'
      });
      analysis.confidence = 95;
    }

    // 2. Pattern-based analysis
    const patternCauses = this.analyzePatterns(testResult);
    patternCauses.forEach(cause => {
      if (!analysis.causes.find(c => c.cause === cause.cause)) {
        analysis.causes.push(cause);
      }
    });

    // 3. Test-specific analysis
    const specificCauses = this.analyzeTestSpecific(testResult);
    specificCauses.forEach(cause => {
      if (!analysis.causes.find(c => c.cause === cause.cause)) {
        analysis.causes.push(cause);
      }
    });

    // 4. Sort causes by probability
    analysis.causes.sort((a, b) => b.probability - a.probability);

    // 5. Generate recommended actions
    analysis.recommendedActions = this.generateRecommendations(analysis.causes);

    // 6. Identify related files
    analysis.relatedFiles = this.identifyRelatedFiles(testResult);

    // 7. Update confidence
    if (analysis.causes.length > 0) {
      analysis.confidence = Math.max(analysis.confidence, analysis.causes[0].probability);
    }

    return analysis;
  },

  /**
   * Identify the primary symptom
   */
  identifySymptom(testResult) {
    // Check assertions for symptom
    if (testResult.assertions && testResult.assertions.length > 0) {
      const failed = testResult.assertions.filter(a => !a.passed);
      if (failed.length > 0) {
        return failed[0].message;
      }
    }

    // Check for common symptoms
    if (testResult.actual === 0 && testResult.expected > 0) {
      return 'Zero results when expecting non-zero';
    }

    if (testResult.anomalies && testResult.anomalies.length > 0) {
      return testResult.anomalies[0];
    }

    if (testResult.error) {
      return testResult.error;
    }

    return 'Unknown failure';
  },

  /**
   * Check against known issues database
   */
  checkKnownIssues(testResult) {
    const symptomStr = JSON.stringify(testResult).toLowerCase();

    for (const [key, issue] of Object.entries(KNOWN_ISSUES)) {
      if (issue.pattern && issue.pattern.test(symptomStr)) {
        return issue;
      }
    }

    return null;
  },

  /**
   * Analyze common failure patterns
   */
  analyzePatterns(testResult) {
    const causes = [];

    // Pattern 1: All zeros (parsing issue)
    if (this.hasAllZeros(testResult)) {
      causes.push({
        probability: 90,
        cause: 'Number parsing error - EU format not recognized',
        pattern: 'ALL_ZEROS',
        file: '15-BulkChangeManager.js',
        line: 173,
        solution: 'Replace parseFloat() with universalParser.parseNumber()',
        explanation: 'parseFloat("5,5") returns NaN in JavaScript. EU numbers use comma as decimal separator.'
      });
    }

    // Pattern 2: Column not found
    if (this.hasColumnNotFound(testResult)) {
      causes.push({
        probability: 85,
        cause: 'Column name not found in headers',
        pattern: 'COLUMN_NOT_FOUND',
        file: '04-DataIntegrator.js',
        solution: 'Add column name alias to COLUMN_ALIASES mapping',
        explanation: 'Report format may use different column names than expected.'
      });
    }

    // Pattern 3: Timeout/partial results
    if (this.hasTimeout(testResult)) {
      causes.push({
        probability: 80,
        cause: 'Timeout due to loop-based setValue() instead of batch',
        pattern: 'TIMEOUT',
        file: '15-BulkChangeManager.js',
        solution: 'Convert setValue() loops to batch setValues() operations',
        explanation: 'Individual cell updates are slow. Batch operations are 100x faster.'
      });
    }

    // Pattern 4: Function not executing
    if (this.hasFunctionNotExecuting(testResult)) {
      causes.push({
        probability: 75,
        cause: 'Function may not be executing or finding target rows',
        pattern: 'NO_EXECUTION',
        solution: 'Check function entry point and row selection logic',
        explanation: 'No changes detected despite expecting modifications.'
      });
    }

    // Pattern 5: Checkbox not found
    if (this.hasCheckboxIssue(testResult)) {
      causes.push({
        probability: 70,
        cause: 'Checkbox column name changed or missing',
        pattern: 'CHECKBOX_ISSUE',
        file: '15-BulkChangeManager.js',
        solution: 'Check "✅ Apply Change" column presence and name',
        explanation: 'Row selection depends on checkbox column.'
      });
    }

    // Pattern 6: Missing mapping
    if (this.hasMappingIssue(testResult)) {
      causes.push({
        probability: 75,
        cause: 'Data mapping between sheets failed',
        pattern: 'MAPPING_FAILED',
        file: '13-BulkMapper.js',
        solution: 'Check campaign/adgroup matching logic',
        explanation: 'Targets not matched between BULK_Source and Full_Analysis.'
      });
    }

    return causes;
  },

  /**
   * Test-specific analysis
   */
  analyzeTestSpecific(testResult) {
    const causes = [];

    switch (testResult.testId) {
      case 'T001': // Row Selection
        if (testResult.score < 100) {
          causes.push({
            probability: 70,
            cause: 'Row selection criteria not matching expected filters',
            file: '12-BulkGenerator.js',
            solution: 'Verify filter conditions: minClicks >= 10 AND minSpend >= 5'
          });
        }
        break;

      case 'T002': // Bid Changes
        if (testResult.actual && testResult.actual.zeroBids > 0) {
          causes.push({
            probability: 90,
            cause: 'Bid calculation returning 0 - parseFloat issue',
            file: '15-BulkChangeManager.js',
            line: 173,
            solution: 'Use universalParser.parseNumber() for EU format support'
          });
        }
        break;

      case 'T003': // Pause Targets
        if (testResult.score < 100 && testResult.score > 50) {
          causes.push({
            probability: 75,
            cause: 'Some targets not paused - possible timeout on large datasets',
            file: '15-BulkChangeManager.js',
            solution: 'Use batch processing for state updates'
          });
        }
        break;

      case 'T004': // Full Analysis
        if (testResult.actual && testResult.actual.matchedRows < testResult.expected.expectedMatches) {
          causes.push({
            probability: 80,
            cause: 'Target matching too strict - only exact match working',
            file: '13-BulkMapper.js',
            solution: 'Implement fuzzy matching for campaign/adgroup names'
          });
        }
        break;

      case 'T005': // Column Mapping
        causes.push({
          probability: 65,
          cause: 'Column alias not in mapping dictionary',
          file: '04-DataIntegrator.js',
          solution: 'Add new column alias to COLUMN_ALIASES'
        });
        break;

      case 'T006': // Export
        if (testResult.actual && testResult.actual.missingColumns) {
          causes.push({
            probability: 85,
            cause: 'Required Amazon columns missing from export',
            file: '17-BulkExporter.js',
            solution: 'Ensure all required Amazon columns are included'
          });
        }
        break;

      case 'T007': // Budget Changes
        if (testResult.actual && testResult.actual.changedCount === 0) {
          causes.push({
            probability: 70,
            cause: 'No campaigns matching ACOS threshold criteria',
            file: '15-BulkChangeManager.js',
            solution: 'Verify ACOS threshold and campaign aggregation logic'
          });
        }
        break;
    }

    return causes;
  },

  /**
   * Pattern detection helpers
   */
  hasAllZeros(testResult) {
    if (testResult.actual) {
      if (testResult.actual === 0 && testResult.expected > 0) return true;
      if (testResult.actual.newBids) {
        return testResult.actual.newBids.every(b => b === 0 || isNaN(b));
      }
      if (testResult.actual.changedCount === 0 && testResult.expected.changedCount > 0) return true;
    }
    return false;
  },

  hasColumnNotFound(testResult) {
    const str = JSON.stringify(testResult).toLowerCase();
    return str.includes('column not found') ||
           str.includes('indexof') && str.includes('-1') ||
           str.includes('undefined') && str.includes('column');
  },

  hasTimeout(testResult) {
    return testResult.timeout === true ||
           testResult.duration > LLTM_CONFIG.TIMEOUTS.FUNCTION_TIMEOUT ||
           (testResult.anomalies && testResult.anomalies.some(a => a.includes('timeout')));
  },

  hasFunctionNotExecuting(testResult) {
    if (testResult.actual) {
      if (testResult.actual.changedCount === 0 && testResult.expected) return true;
      if (testResult.actual.pausedCount === 0 && testResult.expected.expectedPaused > 0) return true;
    }
    return false;
  },

  hasCheckboxIssue(testResult) {
    const str = JSON.stringify(testResult).toLowerCase();
    return str.includes('apply change') && str.includes('not found') ||
           str.includes('checkbox') && (str.includes('false') || str.includes('0'));
  },

  hasMappingIssue(testResult) {
    if (testResult.actual) {
      if (testResult.actual.matchedRows === 0 && testResult.expected.expectedMatches > 0) return true;
    }
    const str = JSON.stringify(testResult).toLowerCase();
    return str.includes('no matching') || str.includes('mapping failed');
  },

  /**
   * Generate recommended actions
   */
  generateRecommendations(causes) {
    const recommendations = [];

    causes.slice(0, 3).forEach((cause, index) => {
      const rec = {
        priority: index + 1,
        action: cause.solution,
        file: cause.file || 'Unknown',
        line: cause.line || null,
        confidence: cause.probability
      };

      if (cause.explanation) {
        rec.explanation = cause.explanation;
      }

      recommendations.push(rec);
    });

    return recommendations;
  },

  /**
   * Identify files related to the failure
   */
  identifyRelatedFiles(testResult) {
    const files = [];

    // Map test IDs to relevant files
    const testFileMap = {
      'T001': ['12-BulkGenerator.js', '14-BulkAnalyzer.js'],
      'T002': ['15-BulkChangeManager.js'],
      'T003': ['15-BulkChangeManager.js'],
      'T004': ['08-FullAnalyzer.js', '13-BulkMapper.js', '14-BulkAnalyzer.js'],
      'T005': ['04-DataIntegrator.js', '13-BulkMapper.js'],
      'T006': ['17-BulkExporter.js', '16-BulkValidator.js'],
      'T007': ['15-BulkChangeManager.js']
    };

    if (testFileMap[testResult.testId]) {
      files.push(...testFileMap[testResult.testId]);
    }

    // Add files from causes
    testResult.possibleCauses?.forEach(cause => {
      if (typeof cause === 'object' && cause.file) {
        if (!files.includes(cause.file)) {
          files.push(cause.file);
        }
      }
    });

    return files;
  },

  /**
   * Compare with historical failures
   */
  compareWithHistory(testResult, history) {
    if (!history || history.length === 0) return null;

    // Find similar past failures
    const similarFailures = history.filter(h =>
      h.testId === testResult.testId &&
      h.status === LLTM_CONFIG.STATUS.FAIL
    );

    if (similarFailures.length === 0) return null;

    // Check if symptom matches any past failure
    const symptom = this.identifySymptom(testResult);
    const matches = similarFailures.filter(f =>
      this.identifySymptom(f) === symptom
    );

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      return {
        lastOccurrence: lastMatch.timestamp,
        occurrenceCount: matches.length,
        previousFix: lastMatch.fix || null,
        wasFixed: matches.some(m => m.wasFixed)
      };
    }

    return null;
  },

  /**
   * Generate detailed analysis report
   */
  generateAnalysisReport(analysis) {
    const lines = [];

    lines.push('');
    lines.push('🔍 ROOT CAUSE ANALYSIS');
    lines.push('═'.repeat(50));
    lines.push('');
    lines.push(`Test: ${analysis.testName} (${analysis.testId})`);
    lines.push(`Symptom: ${analysis.symptom}`);
    lines.push('');

    if (analysis.causes.length > 0) {
      lines.push('Possible Causes (ranked by probability):');
      lines.push('');

      analysis.causes.slice(0, 5).forEach((cause, i) => {
        lines.push(`${i + 1}. [${cause.probability}%] ${cause.cause}`);
        if (cause.file) {
          lines.push(`   File: ${cause.file}${cause.line ? ':' + cause.line : ''}`);
        }
        if (cause.solution) {
          lines.push(`   Fix: ${cause.solution}`);
        }
        if (cause.explanation) {
          lines.push(`   Note: ${cause.explanation}`);
        }
        lines.push('');
      });
    }

    if (analysis.recommendedActions.length > 0) {
      lines.push('═'.repeat(50));
      lines.push('💡 RECOMMENDED ACTIONS');
      lines.push('');

      analysis.recommendedActions.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec.action}`);
        if (rec.file) {
          lines.push(`   Location: ${rec.file}${rec.line ? ':' + rec.line : ''}`);
        }
      });
    }

    if (analysis.relatedFiles.length > 0) {
      lines.push('');
      lines.push('📁 Related Files:');
      analysis.relatedFiles.forEach(file => {
        lines.push(`   • ${file}`);
      });
    }

    if (analysis.historicalMatch) {
      lines.push('');
      lines.push('📜 Historical Context:');
      lines.push(`   Last occurrence: ${analysis.historicalMatch.lastOccurrence}`);
      lines.push(`   Total occurrences: ${analysis.historicalMatch.occurrenceCount}`);
      if (analysis.historicalMatch.previousFix) {
        lines.push(`   Previous fix: ${analysis.historicalMatch.previousFix}`);
      }
    }

    lines.push('');
    lines.push('═'.repeat(50));

    return lines.join('\n');
  },

  /**
   * Suggest code fix based on cause
   */
  suggestCodeFix(cause) {
    const fixes = {
      'NUMBER_PARSING_EU': {
        before: 'var clicks = parseFloat(row[clicksCol]);',
        after: 'var clicks = universalParser.parseNumber(row[clicksCol]);',
        file: '15-BulkChangeManager.js'
      },
      'TIMEOUT': {
        before: `targetRows.forEach(row => {
  sheet.getRange(row, stateCol).setValue('paused');
});`,
        after: `var updates = targetRows.map(row => ['paused']);
var range = sheet.getRange(targetRows[0], stateCol, targetRows.length, 1);
range.setValues(updates);`,
        file: '15-BulkChangeManager.js'
      }
    };

    return fixes[cause.pattern] || null;
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { RootCauseAnalyzer };
}
