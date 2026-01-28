/**
 * Custom Jest reporter that lists all failing test file paths at the end of the test run
 */
class FailedTestsReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunComplete(contexts, results) {
    const failedTests = results.testResults.filter((result) => result.numFailingTests > 0);

    if (failedTests.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('FAILED TEST FILES:');
      console.log('='.repeat(60));

      failedTests.forEach((test) => {
        console.log(`  ${test.testFilePath}`);
      });

      console.log('='.repeat(60));
      console.log(`Total failed files: ${failedTests.length}`);
      console.log('='.repeat(60) + '\n');
    }
  }
}

module.exports = FailedTestsReporter;
