/**
 * tests/db_tests.js
 *
 * Minimal automated test suite verifying database integrity constraints,
 * grading logic, marks validation, and transaction rollback.
 *
 * Run with:
 *   node tests/db_tests.js
 */

const db = require('../db/connection');

async function runTests() {
  console.log('🧪 Starting ExamVault Database Integrity & Backend Test Suite\n');

  let passed = 0;
  let failed = 0;

  async function assertThrows(desc, fn, expectedMatch) {
    try {
      await fn();
      console.error(`❌ FAIL: ${desc} (Expected error but succeeded)`);
      failed++;
    } catch (err) {
      const msg = err.message || '';
      if (!expectedMatch || msg.includes(expectedMatch) || err.code === expectedMatch) {
        console.log(`✅ PASS: ${desc}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${desc} (Unexpected error message: "${msg}")`);
        failed++;
      }
    }
  }

  async function assertSuccess(desc, fn) {
    try {
      const res = await fn();
      console.log(`✅ PASS: ${desc}`);
      passed++;
      return res;
    } catch (err) {
      console.error(`❌ FAIL: ${desc} (${err.message})`);
      failed++;
    }
  }

  try {
    // Check connection first
    await db.query('SELECT 1');
  } catch (err) {
    console.warn('⚠️  MySQL connection failed / database is unavailable:');
    console.warn(`    ${err.message}`);
    console.warn('\n⏭️  TEST SUITE SKIPPED: Database tests require a running MySQL instance.');
    console.warn('    Please verify MySQL connection settings in .env and rerun:\n');
    console.warn('    node tests/db_tests.js\n');
    // Exit with code 1 so CI / callers do not treat unavailable DB as a passing run
    process.exit(1);
  }

  console.log('Connected to MySQL. Running test cases...\n');

  // TEST 1: Duplicate STUDENT.user_ID rejected (1:1 constraint)
  await assertThrows(
    '1. Duplicate STUDENT.user_ID rejected by UNIQUE constraint',
    async () => {
      // Pick first student's user_ID
      const [[student]] = await db.query('SELECT user_ID FROM STUDENT LIMIT 1');
      if (!student) throw new Error('No existing student found to test');
      await db.query(
        'INSERT INTO STUDENT (reg_no, user_ID, semester, department) VALUES (?, ?, ?, ?)',
        ['TEST_DUP_01', student.user_ID, 4, 'Test Dept']
      );
    },
    'ER_DUP_ENTRY'
  );

  // TEST 2: Duplicate INSTRUCTOR.user_ID rejected (1:1 constraint)
  await assertThrows(
    '2. Duplicate INSTRUCTOR.user_ID rejected by UNIQUE constraint',
    async () => {
      const [[instructor]] = await db.query('SELECT user_ID FROM INSTRUCTOR LIMIT 1');
      if (!instructor) throw new Error('No existing instructor found to test');
      await db.query(
        'INSERT INTO INSTRUCTOR (instructor_code, user_ID, school) VALUES (?, ?, ?)',
        ['TEST_INS_DUP', instructor.user_ID, 'Test School']
      );
    },
    'ER_DUP_ENTRY'
  );

  // TEST 3: Question without exam_ID rejected (NOT NULL)
  await assertThrows(
    '3. Question without exam_ID rejected',
    async () => {
      await db.query(
        'INSERT INTO QUESTION (question_text, question_type, marks, exam_ID) VALUES (?, ?, ?, NULL)',
        ['Invalid question text', 'Short Answer', 10]
      );
    },
    'ER_BAD_NULL_ERROR'
  );

  // Helper: Find a valid (exam, enrolled student) pair without an existing attempt
  let testTarget = null;
  try {
    const [rows] = await db.query(`
      SELECT e.exam_ID, e.total_marks, en.reg_no
      FROM EXAM e
      JOIN ENROLL en ON e.course_ID = en.course_ID
      LEFT JOIN ATTEMPT a ON a.exam_ID = e.exam_ID AND a.reg_no = en.reg_no
      WHERE a.attempt_ID IS NULL
      LIMIT 1
    `);
    if (rows.length > 0) {
      testTarget = rows[0];
    }
  } catch (err) {
    // Handled in individual tests
  }

  // TEST 4: Marks above exam maximum rejected by trigger
  if (!testTarget) {
    console.log('⏭️  SKIP: 4. Marks above exam total_marks rejected by trigger (Prerequisite: unattempted enrolled student & exam not found)');
  } else {
    await assertThrows(
      '4. Marks above exam total_marks rejected by trigger',
      async () => {
        await db.query(
          'INSERT INTO ATTEMPT (reg_no, exam_ID, score) VALUES (?, ?, ?)',
          [testTarget.reg_no, testTarget.exam_ID, testTarget.total_marks + 50]
        );
      },
      'cannot be negative or exceed'
    );
  }

  // TEST 5: Negative marks rejected
  if (!testTarget) {
    console.log('⏭️  SKIP: 5. Negative score on ATTEMPT rejected (Prerequisite: unattempted enrolled student & exam not found)');
  } else {
    await assertThrows(
      '5. Negative score on ATTEMPT rejected',
      async () => {
        await db.query(
          'INSERT INTO ATTEMPT (reg_no, exam_ID, score) VALUES (?, ?, ?)',
          [testTarget.reg_no, testTarget.exam_ID, -10]
        );
      },
      'Score cannot be negative'
    );
  }

  // TEST 6: Percentage-based grading: fn_grade correctly evaluates 40% threshold
  await assertSuccess(
    '6. fn_grade: 40% pass rule on 50-mark exam (score 20 is Pass, score 19 is Fail)',
    async () => {
      // 50 total marks: 40% = 20. score 19 -> Fail, score 20 -> passing grade (band-dependent)
      const [[rowFail]] = await db.query('SELECT fn_grade(19, 25, 5, 50) AS grade');
      const [[rowPass]] = await db.query('SELECT fn_grade(20, 25, 5, 50) AS grade');
      if (rowFail.grade !== 'Fail') throw new Error(`Expected Fail for score 19/50, got ${rowFail.grade}`);
      if (rowPass.grade === 'Fail') throw new Error(`Expected Pass for score 20/50, got Fail`);
    }
  );

  // TEST 7: Zero standard deviation grading fallback
  await assertSuccess(
    '7. fn_grade handles zero standard deviation (sd=0) gracefully with "E" fallback',
    async () => {
      const [[res]] = await db.query('SELECT fn_grade(75, 75, 0, 100) AS grade');
      if (res.grade !== 'E') throw new Error(`Expected 'E' for SD=0 passing score, got ${res.grade}`);
    }
  );

  // TEST 8: Transaction rollback works
  await assertSuccess(
    '8. Transaction rollback restores initial database state',
    async () => {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [insertRes] = await conn.query(
          'INSERT INTO USER (name, email, phone) VALUES (?, ?, ?)',
          ['Rollback Test User', 'rollback.test@college.edu', '0000000000']
        );
        const testUserId = insertRes.insertId;

        // Verify it exists inside transaction
        const [foundInside] = await conn.query('SELECT user_ID FROM USER WHERE user_ID = ?', [testUserId]);
        if (!foundInside.length) throw new Error('Record not found inside transaction');

        // Roll back
        await conn.rollback();

        // Verify it does NOT exist after rollback
        const [foundAfter] = await db.query('SELECT user_ID FROM USER WHERE user_ID = ?', [testUserId]);
        if (foundAfter.length) throw new Error('Record was not rolled back!');
      } finally {
        conn.release();
      }
    }
  );

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();