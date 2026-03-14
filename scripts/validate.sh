#!/bin/bash

# AnyToNotebookLM Validation Script
# Tests all major functionality and error scenarios

set -e

echo "🧪 AnyToNotebookLM Validation Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="$3"
    local description="$4"
    
    echo -e "\n${YELLOW}Testing: $test_name${NC}"
    echo "Description: $description"
    echo "Command: $command"
    
    if eval "$command"; then
        local actual_exit_code=$?
        if [ "$actual_exit_code" -eq "$expected_exit_code" ]; then
            echo -e "${GREEN}✅ PASS${NC} - Exit code $actual_exit_code (expected $expected_exit_code)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAIL${NC} - Exit code $actual_exit_code (expected $expected_exit_code)"
            ((TESTS_FAILED++))
        fi
    else
        local actual_exit_code=$?
        if [ "$actual_exit_code" -eq "$expected_exit_code" ]; then
            echo -e "${GREEN}✅ PASS${NC} - Exit code $actual_exit_code (expected $expected_exit_code)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAIL${NC} - Exit code $actual_exit_code (expected $expected_exit_code)"
            ((TESTS_FAILED++))
        fi
    fi
}

# Change to project directory
cd /home/moltrpi5/projects/AnyToNotebookLM

# Build the project first
echo -e "\n${YELLOW}Building project...${NC}"
npm run build

# Test 1: Help command
run_test "Help Command" "node dist/cli.js --help" 0 "Should display help information"

# Test 2: Missing required arguments
run_test "Missing Arguments" "node dist/cli.js" 1 "Should fail when required arguments are missing"

# Test 3: Invalid notebook ID
run_test "Invalid Notebook ID" "node dist/cli.js 'https://example.com' --notebook-id 'invalid-uuid'" 20 "Should fail with invalid notebook ID"

# Test 4: Invalid URL (should fail extraction)
run_test "Invalid URL" "node dist/cli.js 'https://invalid-url-that-does-not-exist.com' --notebook-id '95ce9853-1994-49ec-9e7e-641e7044409f' --dry-run" 10 "Should fail when URL returns no content"

# Test 5: Valid URL with dry run
run_test "Valid URL Dry Run" "node dist/cli.js 'https://example.com' --notebook-id '95ce9853-1994-49ec-9e7e-641e7044409f' --dry-run" 0 "Should succeed with valid URL in dry run mode"

# Test 6: Valid URL with output file
run_test "Valid URL with Output" "node dist/cli.js 'https://example.com' --notebook-id '95ce9853-1994-49ec-9e7e-641e7044409f' --out /tmp/validation_test.md" 0 "Should succeed and write to output file"

# Test 7: Valid URL with full upload
run_test "Valid URL Full Upload" "node dist/cli.js 'https://httpbin.org/json' --notebook-id '95ce9853-1994-49ec-9e7e-641e7044409f' --title 'Validation Test'" 0 "Should succeed with full upload to NotebookLM"

# Test 8: Custom title
run_test "Custom Title" "node dist/cli.js 'https://example.com' --notebook-id '95ce9853-1994-49ec-9e7e-641e7044409f' --title 'Custom Validation Title' --dry-run" 0 "Should succeed with custom title"

# Cleanup test files
rm -f /tmp/validation_test.md

# Summary
echo -e "\n===================================="
echo -e "🏁 Validation Summary"
echo -e "===================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! AnyToNotebookLM is working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the implementation.${NC}"
    exit 1
fi
