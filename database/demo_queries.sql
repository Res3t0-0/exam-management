-- ============================================================
-- DEMO SCRIPT — DBMS practices in ExamVault
-- ============================================================
-- Setup (once, before the demo):
--     mysql -u root -p < database/schema.sql
--     mysql -u root -p < database/sample_data_large.sql
-- Then open the mysql client (or MySQL Workbench) and run the blocks below ONE AT A TIME,
-- explaining each as you go. Every block is safe: the ones that change data wrap the
-- change in a transaction and ROLLBACK, and the failing ones are meant to fail.
-- (Written for the large sample data: examples use student CS2021001, course CS301, exams 1, 3 and 10.)
-- ============================================================
USE exam_management;


-- ############################################################
-- PART 1 — WHAT THE DATABASE CONTAINS
-- ############################################################

-- DEMO 1.1  Tables and views
SHOW FULL TABLES;

-- DEMO 1.2  Triggers: which table, which event, before or after
SELECT trigger_name, action_timing, event_manipulation AS event, event_object_table AS on_table
FROM information_schema.triggers
WHERE trigger_schema = DATABASE()
ORDER BY event_object_table, action_timing, event_manipulation;

-- DEMO 1.3  Stored function and procedures
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = DATABASE();

-- DEMO 1.4  CHECK constraints (data-integrity rules enforced by the DBMS itself)
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = DATABASE() AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;


-- ############################################################
-- PART 2 — QUERYING: JOINS, AGGREGATES, SUBQUERIES, WINDOW FUNCTIONS
-- ############################################################

-- DEMO 2.1  INNER JOIN across 4 tables: who is enrolled in CS301
SELECT s.reg_no, u.name, s.semester, c.course_name
FROM ENROLL en
JOIN STUDENT s ON en.reg_no   = s.reg_no
JOIN USER u    ON s.user_ID   = u.user_ID
JOIN COURSE c  ON en.course_ID = c.course_ID
WHERE c.course_ID = 'CS301'
ORDER BY s.reg_no
LIMIT 8;

-- DEMO 2.2  LEFT JOIN: keeps courses that have no instructor (HS101 shows 'Not assigned')
SELECT c.course_ID, c.course_name, COALESCE(u.name, 'Not assigned') AS instructor
FROM COURSE c
LEFT JOIN INSTRUCTOR i ON c.instructor_code = i.instructor_code
LEFT JOIN USER u       ON i.user_ID = u.user_ID
ORDER BY (u.name IS NULL) DESC, c.course_ID
LIMIT 5;

-- DEMO 2.3  GROUP BY + HAVING: departments by average marks (only those with > 20 graded results)
SELECT department, COUNT(*) AS results, ROUND(AVG(marks_obtained), 2) AS avg_marks,
       SUM(status = 'Fail') AS failed
FROM vw_student_results
GROUP BY department
HAVING COUNT(*) > 20
ORDER BY avg_marks DESC;

-- DEMO 2.4  Correlated subquery: students who beat the class average in exam 1
SELECT v.reg_no, v.student_name, v.marks_obtained, v.grade
FROM vw_student_results v
WHERE v.exam_ID = 1
  AND v.marks_obtained > (SELECT AVG(x.marks_obtained)
                          FROM vw_student_results x
                          WHERE x.exam_ID = v.exam_ID)
ORDER BY v.marks_obtained DESC
LIMIT 5;

-- DEMO 2.5  NOT EXISTS: students enrolled in a course who have not yet attempted its exam
SELECT en.reg_no, ex.exam_ID, ex.title
FROM ENROLL en
JOIN EXAM ex ON ex.course_ID = en.course_ID
WHERE NOT EXISTS (SELECT 1 FROM ATTEMPT a
                  WHERE a.reg_no = en.reg_no AND a.exam_ID = ex.exam_ID)
ORDER BY ex.exam_ID, en.reg_no
LIMIT 5;

-- DEMO 2.6  Window functions: top 3 per exam with ROW_NUMBER and RANK (ties share a rank)
SELECT exam_ID, exam_title, reg_no, student_name, marks_obtained, pos, rnk
FROM (SELECT v.*,
             ROW_NUMBER() OVER (PARTITION BY exam_ID ORDER BY marks_obtained DESC) AS pos,
             RANK()       OVER (PARTITION BY exam_ID ORDER BY marks_obtained DESC) AS rnk
      FROM vw_student_results v
      WHERE exam_ID IN (1, 3)) t
WHERE pos <= 3
ORDER BY exam_ID, pos;


-- ############################################################
-- PART 3 — VIEWS  (a stored, named query: simplifies queries and hides tables)
-- ############################################################

-- DEMO 3.1  Per-exam statistics in one line: the view hides 3 joins and a GROUP BY
SELECT * FROM vw_exam_statistics WHERE exam_ID <= 5;

-- DEMO 3.2  Course summary
SELECT * FROM vw_course_summary ORDER BY enrolled_students DESC LIMIT 5;

-- DEMO 3.3  One student's results through the view
SELECT exam_title, marks_obtained, grade, status
FROM vw_student_results
WHERE reg_no = 'CS2021001'
ORDER BY exam_ID;


-- ############################################################
-- PART 4 — STORED FUNCTION: the grading rule lives in the database
-- ############################################################

-- DEMO 4.1  fn_grade(marks, class_average, std_dev) with class average 65 and SD 12
--           cutoffs: S >= 83, A >= 71, B >= 59, C >= 47, D >= 41, E below; marks < 50 is always Fail
SELECT marks, fn_grade(marks, 65, 12) AS grade
FROM (SELECT 95 AS marks UNION ALL SELECT 83 UNION ALL SELECT 75 UNION ALL SELECT 60
      UNION ALL SELECT 52 UNION ALL SELECT 49) t;


-- ############################################################
-- PART 5 — TRIGGERS  (each block undoes itself with ROLLBACK)
-- ############################################################

-- DEMO 5.1  trg_result_bi: grade and status are computed by the database.
--           We insert a result WITHOUT grade or status and the trigger fills them in.
START TRANSACTION;
INSERT INTO ATTEMPT (reg_no, exam_ID, start_time, submit_time, score)
VALUES ('CS2023039', 1, '2026-09-14 09:00:00', '2026-09-14 10:20:00', 85);
INSERT INTO RESULT (attempt_ID, marks_obtained, class_average, std_dev)
VALUES (LAST_INSERT_ID(), 85, 65, 12);
SELECT result_ID, marks_obtained, class_average, std_dev, grade, status
FROM RESULT ORDER BY result_ID DESC LIMIT 1;
ROLLBACK;

-- DEMO 5.2  trg_result_bu: even a wrong grade written by hand is corrected.
--           We try to force grade 'S' on a failing mark; the trigger recomputes it.
START TRANSACTION;
UPDATE RESULT SET marks_obtained = 30, grade = 'S', status = 'Pass' WHERE result_ID = 1;
SELECT result_ID, marks_obtained, grade, status FROM RESULT WHERE result_ID = 1;
ROLLBACK;

-- DEMO 5.3  trg_result_au / trg_result_ad: the audit trail writes itself.
--           (RESULT_AUDIT is empty before this block and empty again after the ROLLBACK.
--            The audit_ID numbers do not start at 1 because AUTO_INCREMENT counters are never rolled back.)
SELECT COUNT(*) AS audit_rows_before FROM RESULT_AUDIT;
START TRANSACTION;
UPDATE RESULT SET marks_obtained = 40 WHERE result_ID = 2;
DELETE FROM RESULT WHERE result_ID = 3;
SELECT audit_ID, result_ID, action, old_marks, new_marks, old_grade, new_grade, changed_by
FROM RESULT_AUDIT ORDER BY audit_ID;
ROLLBACK;
SELECT COUNT(*) AS audit_rows_after FROM RESULT_AUDIT;

-- DEMO 5.4  trg_attempt_bi (business rule): CS2021001 is not enrolled in the course of exam 10.
--           EXPECTED ERROR: Student is not enrolled in the course of this exam
INSERT INTO ATTEMPT (reg_no, exam_ID, start_time) VALUES ('CS2021001', 10, '2026-09-20 09:00:00');


-- ############################################################
-- PART 6 — STORED PROCEDURES
-- ############################################################

-- DEMO 6.1  sp_grade_exam: computes class average + SD and grades every submitted attempt
--           in ONE transaction, then returns the grade distribution.
--           (Run it outside an open transaction: the procedure starts its own.)
CALL sp_grade_exam(3);

-- DEMO 6.2  sp_student_report: one student's report card with rank in each exam (window function inside)
CALL sp_student_report('CS2021001');

-- DEMO 6.3  Error handling: the procedure validates its input and raises a clean error.
--           EXPECTED ERROR: Exam not found
CALL sp_grade_exam(9999);


-- ############################################################
-- PART 7 — TRANSACTIONS (ACID)
-- ############################################################

-- DEMO 7.1  Atomicity: change something, look at it, then ROLLBACK and it is as if nothing happened
SELECT credits FROM COURSE WHERE course_ID = 'CS301';
START TRANSACTION;
UPDATE COURSE SET credits = 9 WHERE course_ID = 'CS301';
SELECT credits AS credits_inside_transaction FROM COURSE WHERE course_ID = 'CS301';
ROLLBACK;
SELECT credits AS credits_after_rollback FROM COURSE WHERE course_ID = 'CS301';

-- DEMO 7.2  SAVEPOINT: undo only part of a transaction
START TRANSACTION;
UPDATE COURSE SET credits = 3 WHERE course_ID = 'CS301';
SAVEPOINT after_first_change;
UPDATE COURSE SET credits = 2 WHERE course_ID = 'CS302';
ROLLBACK TO SAVEPOINT after_first_change;
SELECT course_ID, credits FROM COURSE WHERE course_ID IN ('CS301', 'CS302') ORDER BY course_ID;
ROLLBACK;
SELECT course_ID, credits FROM COURSE WHERE course_ID IN ('CS301', 'CS302') ORDER BY course_ID;


-- ############################################################
-- PART 8 — INTEGRITY CONSTRAINTS (every block below is MEANT TO FAIL)
-- ############################################################

-- DEMO 8.1  CHECK: semester must be 1..8
--           EXPECTED ERROR: constraint chk_student_semester failed
UPDATE STUDENT SET semester = 12 WHERE reg_no = 'CS2021001';

-- DEMO 8.2  CHECK: standard deviation must be > 0 (it is a divisor of the grading bands)
--           EXPECTED ERROR: constraint chk_result_sd failed
UPDATE RESULT SET std_dev = 0 WHERE result_ID = 1;

-- DEMO 8.3  CHECK across two columns: cannot submit before starting
--           EXPECTED ERROR: constraint chk_attempt_times failed
UPDATE ATTEMPT SET start_time = '2026-09-14 10:00:00', submit_time = '2000-01-01 00:00:00' WHERE attempt_ID = 1;

-- DEMO 8.4  UNIQUE (reg_no, exam_ID): one attempt per student per exam
--           EXPECTED ERROR: Duplicate entry ... uq_attempt_student_exam
INSERT INTO ATTEMPT (reg_no, exam_ID) VALUES ('CS2021001', 1);

-- DEMO 8.5  FOREIGN KEY: cannot enrol a student who does not exist
--           EXPECTED ERROR: a foreign key constraint fails
INSERT INTO ENROLL (reg_no, course_ID) VALUES ('NOPE00001', 'CS301');


-- ############################################################
-- PART 9 — INDEXES
-- ############################################################

-- DEMO 9.1  All indexes on STUDENT (the primary key, the FK on user_ID and our composite index)
SHOW INDEX FROM STUDENT;

-- DEMO 9.2  EXPLAIN: with the composite index the optimiser reads far fewer rows than the table holds
--           (look at the key and rows columns)
EXPLAIN SELECT reg_no FROM STUDENT WHERE department = 'Computer Science' AND semester = 6;

-- DEMO 9.3  Same query with the index switched off: the optimiser must scan every row
EXPLAIN SELECT reg_no FROM STUDENT IGNORE INDEX (idx_student_dept_sem)
WHERE department = 'Computer Science' AND semester = 6;


-- ############################################################
-- PART 10 — SECURITY: GRANT / REVOKE through views
-- ############################################################
-- Run these from a SHELL (they switch MySQL user), not inside the mysql prompt:
--
--   mysql -u root -p -e "CREATE USER 'exam_viewer'@'localhost' IDENTIFIED BY 'Viewer@123'; GRANT SELECT ON exam_management.vw_exam_statistics TO 'exam_viewer'@'localhost'; GRANT SELECT ON exam_management.vw_course_summary TO 'exam_viewer'@'localhost';"
--
--   mysql -u exam_viewer -pViewer@123 exam_management -e "SELECT course_ID, instructor_name FROM vw_course_summary LIMIT 3"   -- works
--   mysql -u exam_viewer -pViewer@123 exam_management -e "SELECT * FROM STUDENT LIMIT 3"                                     -- ERROR 1142: SELECT command denied
--   mysql -u exam_viewer -pViewer@123 exam_management -e "UPDATE COURSE SET credits = 1"                                     -- ERROR 1142: UPDATE command denied
--
--   mysql -u root -p -e "DROP USER 'exam_viewer'@'localhost'"        -- clean up


-- ############################################################
-- FINAL CHECK — the demo left the data untouched
-- ############################################################
-- Expected on the large sample: results = 629, audit rows = 0, CS301 credits = 4, student CS2021001 present = 1
SELECT (SELECT COUNT(*) FROM RESULT)       AS results,
       (SELECT COUNT(*) FROM RESULT_AUDIT) AS audit_rows,
       (SELECT credits FROM COURSE WHERE course_ID = 'CS301')       AS cs301_credits,
       (SELECT COUNT(*) FROM STUDENT WHERE reg_no = 'CS2021001')    AS student_present;
