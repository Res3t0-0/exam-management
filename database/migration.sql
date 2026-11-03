-- ============================================================
-- SAFE MIGRATION SCRIPT FOR EXISTING EXAM_MANAGEMENT DATABASE
-- ============================================================
-- Use this script to update an existing database WITHOUT dropping
-- tables or deleting existing data.
--
-- IMPORTANT SAFETY PRECAUTIONS:
-- 1. Always take a complete backup before running migrations:
--      mysqldump -u root -p exam_management > exam_management_backup.sql
-- 2. Test this migration on a copy of the database first.
-- 3. Note: In MySQL, DDL statements (ALTER TABLE, CREATE TRIGGER) cause
--    implicit commits and are NOT fully transactional. If a DDL statement
--    fails midway, previous DDL changes remain in effect.
-- 4. Step 1 below performs preflight checks. ALL diagnostic queries
--    must return ZERO invalid rows before proceeding to Step 2.
--
-- Instructions:
--   mysql -u root -p exam_management < database/migration.sql
-- ============================================================

USE exam_management;

-- ------------------------------------------------------------
-- STEP 1: PREFLIGHT DIAGNOSTIC CHECKS
-- ------------------------------------------------------------
-- Verify that existing data conforms to the new constraints.
-- ALL queries below must return 0 rows before applying ALTER TABLE.
-- If any query returns rows, resolve the data conflicts manually before continuing.

-- 1.1 Check for duplicate STUDENT.user_ID values
SELECT user_ID, COUNT(*) AS student_count
FROM STUDENT
GROUP BY user_ID
HAVING COUNT(*) > 1;

-- 1.2 Check for duplicate INSTRUCTOR.user_ID values
SELECT user_ID, COUNT(*) AS instructor_count
FROM INSTRUCTOR
GROUP BY user_ID
HAVING COUNT(*) > 1;

-- 1.3 Check for QUESTION rows with NULL exam_ID
SELECT question_ID, question_text
FROM QUESTION
WHERE exam_ID IS NULL;

-- 1.4 Check for ATTEMPT scores exceeding their exam's total_marks
SELECT a.attempt_ID, a.reg_no, a.exam_ID, a.score, e.total_marks
FROM ATTEMPT a
JOIN EXAM e ON a.exam_ID = e.exam_ID
WHERE a.score > e.total_marks;

-- 1.5 Check for RESULT marks exceeding the corresponding exam's total_marks
SELECT r.result_ID, r.attempt_ID, r.marks_obtained, e.total_marks
FROM RESULT r
JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
JOIN EXAM e ON a.exam_ID = e.exam_ID
WHERE r.marks_obtained > e.total_marks;

-- 1.6 Check for attempts by students not enrolled in the exam's course
SELECT a.attempt_ID, a.reg_no, a.exam_ID, e.course_ID
FROM ATTEMPT a
JOIN EXAM e ON a.exam_ID = e.exam_ID
WHERE e.course_ID IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ENROLL en
    WHERE en.reg_no = a.reg_no AND en.course_ID = e.course_ID
  );

-- ------------------------------------------------------------
-- STEP 2: APPLY UNIQUE CONSTRAINTS (1:1 with USER)
-- ------------------------------------------------------------
-- Enforce 1:1 specialization for STUDENT and INSTRUCTOR
ALTER TABLE STUDENT
    ADD CONSTRAINT uq_student_user UNIQUE (user_ID);

ALTER TABLE INSTRUCTOR
    ADD CONSTRAINT uq_instructor_user UNIQUE (user_ID);

-- ------------------------------------------------------------
-- STEP 3: ENFORCE NOT NULL ON QUESTION.exam_ID
-- ------------------------------------------------------------
ALTER TABLE QUESTION
    MODIFY COLUMN exam_ID INT NOT NULL;

-- ------------------------------------------------------------
-- STEP 4: ADJUST CHECK CONSTRAINTS
-- ------------------------------------------------------------
-- Remove hardcoded 100 upper-bound on ATTEMPT score (handled by trigger against EXAM.total_marks)
ALTER TABLE ATTEMPT
    DROP CHECK chk_attempt_score;

ALTER TABLE ATTEMPT
    ADD CONSTRAINT chk_attempt_score CHECK (score >= 0);

-- Allow std_dev >= 0 in RESULT for zero-variance cohorts
ALTER TABLE RESULT
    DROP CHECK chk_result_sd;

ALTER TABLE RESULT
    ADD CONSTRAINT chk_result_sd CHECK (std_dev >= 0);

-- ------------------------------------------------------------
-- STEP 5: UPDATE FUNCTION & PROCEDURES
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_grade;
DROP PROCEDURE IF EXISTS sp_grade_exam;

DELIMITER $$

CREATE FUNCTION fn_grade(p_marks DECIMAL(6,2), p_avg DECIMAL(6,2), p_sd DECIMAL(6,2), p_total INT)
RETURNS VARCHAR(4)
DETERMINISTIC
NO SQL
BEGIN
    -- Below 40% of exam total marks is Fail
    IF p_marks < (0.40 * p_total) THEN
        RETURN 'Fail';
    -- Fallback rule when SD is 0 or NULL (all scores identical)
    ELSEIF p_sd IS NULL OR p_sd <= 0 THEN
        RETURN 'E';
    -- Relative grading bands
    ELSEIF p_marks >= p_avg + 1.5 * p_sd THEN
        RETURN 'S';
    ELSEIF p_marks >= p_avg + 0.5 * p_sd THEN
        RETURN 'A';
    ELSEIF p_marks >= p_avg - 0.5 * p_sd THEN
        RETURN 'B';
    ELSEIF p_marks >= p_avg - 1.5 * p_sd THEN
        RETURN 'C';
    ELSEIF p_marks >= p_avg - 2.0 * p_sd THEN
        RETURN 'D';
    ELSE
        RETURN 'E';
    END IF;
END$$

CREATE PROCEDURE sp_grade_exam(IN p_exam_ID INT)
BEGIN
    DECLARE v_n   INT;
    DECLARE v_avg DECIMAL(6,2);
    DECLARE v_sd  DECIMAL(6,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM EXAM WHERE exam_ID = p_exam_ID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exam not found';
    END IF;

    SELECT COUNT(*), ROUND(AVG(score), 2), ROUND(STDDEV_POP(score), 2)
      INTO v_n, v_avg, v_sd
      FROM ATTEMPT
     WHERE exam_ID = p_exam_ID AND submit_time IS NOT NULL;

    IF v_n = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No submitted attempts to grade for this exam';
    END IF;

    -- Zero standard deviation is safely handled by fn_grade fallback rule
    IF v_sd IS NULL THEN
        SET v_sd = 0;
    END IF;

    START TRANSACTION;

    INSERT INTO RESULT (attempt_ID, marks_obtained, class_average, std_dev, grade, status)
    SELECT attempt_ID, score, v_avg, v_sd, 'Fail', 'Fail'
      FROM ATTEMPT
     WHERE exam_ID = p_exam_ID AND submit_time IS NOT NULL
    ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained),
                            class_average  = VALUES(class_average),
                            std_dev        = VALUES(std_dev);

    COMMIT;

    SELECT r.grade, COUNT(*) AS students
      FROM RESULT r
      JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
     WHERE a.exam_ID = p_exam_ID
     GROUP BY r.grade
     ORDER BY FIELD(r.grade, 'S', 'A', 'B', 'C', 'D', 'E', 'Fail');
END$$

-- ------------------------------------------------------------
-- STEP 6: UPDATE TRIGGERS
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_result_bi;
DROP TRIGGER IF EXISTS trg_result_bu;
DROP TRIGGER IF EXISTS trg_attempt_bi;
DROP TRIGGER IF EXISTS trg_attempt_bu;

CREATE TRIGGER trg_result_bi BEFORE INSERT ON RESULT
FOR EACH ROW
BEGIN
    DECLARE v_total INT DEFAULT 100;
    SELECT e.total_marks INTO v_total
    FROM ATTEMPT a JOIN EXAM e ON a.exam_ID = e.exam_ID
    WHERE a.attempt_ID = NEW.attempt_ID;

    IF NEW.marks_obtained < 0 OR NEW.marks_obtained > COALESCE(v_total, 100) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'marks_obtained cannot be negative or exceed the exam total_marks';
    END IF;

    SET NEW.grade  = fn_grade(NEW.marks_obtained, NEW.class_average, NEW.std_dev, COALESCE(v_total, 100));
    SET NEW.status = IF(NEW.grade = 'Fail', 'Fail', 'Pass');
END$$

CREATE TRIGGER trg_result_bu BEFORE UPDATE ON RESULT
FOR EACH ROW
BEGIN
    DECLARE v_total INT DEFAULT 100;
    SELECT e.total_marks INTO v_total
    FROM ATTEMPT a JOIN EXAM e ON a.exam_ID = e.exam_ID
    WHERE a.attempt_ID = NEW.attempt_ID;

    IF NEW.marks_obtained < 0 OR NEW.marks_obtained > COALESCE(v_total, 100) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'marks_obtained cannot be negative or exceed the exam total_marks';
    END IF;

    SET NEW.grade  = fn_grade(NEW.marks_obtained, NEW.class_average, NEW.std_dev, COALESCE(v_total, 100));
    SET NEW.status = IF(NEW.grade = 'Fail', 'Fail', 'Pass');
END$$

CREATE TRIGGER trg_attempt_bi BEFORE INSERT ON ATTEMPT
FOR EACH ROW
BEGIN
    DECLARE v_course VARCHAR(20);
    DECLARE v_total  INT;
    SELECT course_ID, total_marks INTO v_course, v_total
    FROM EXAM WHERE exam_ID = NEW.exam_ID;

    IF v_course IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM ENROLL WHERE reg_no = NEW.reg_no AND course_ID = v_course) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student is not enrolled in the course of this exam';
    END IF;

    IF NEW.score IS NOT NULL AND (NEW.score < 0 OR NEW.score > COALESCE(v_total, 100)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Score cannot be negative or exceed the exam total_marks';
    END IF;
END$$

CREATE TRIGGER trg_attempt_bu BEFORE UPDATE ON ATTEMPT
FOR EACH ROW
BEGIN
    DECLARE v_course VARCHAR(20);
    DECLARE v_total  INT;
    SELECT course_ID, total_marks INTO v_course, v_total
    FROM EXAM WHERE exam_ID = NEW.exam_ID;

    -- Verify enrollment if reg_no or exam_ID is modified
    IF (OLD.reg_no <> NEW.reg_no OR OLD.exam_ID <> NEW.exam_ID) THEN
        IF v_course IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ENROLL WHERE reg_no = NEW.reg_no AND course_ID = v_course) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student is not enrolled in the course of this exam';
        END IF;
    END IF;

    IF NEW.score IS NOT NULL AND (NEW.score < 0 OR NEW.score > COALESCE(v_total, 100)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Score cannot be negative or exceed the exam total_marks';
    END IF;
END$$

DELIMITER ;

-- ------------------------------------------------------------
-- STEP 7: POST-MIGRATION RECALCULATION INSTRUCTION
-- ------------------------------------------------------------
-- Existing RESULT rows may reflect grades from the previous policy.
-- To recalculate grades using the updated 40% percentage rule and zero-SD
-- handling, run sp_grade_exam for each exam with submitted attempts:
--
-- Example:
--   CALL sp_grade_exam(1);
--   CALL sp_grade_exam(2);
--   CALL sp_grade_exam(3);
--
-- Or run a query to identify all exams with submitted attempts:
--   SELECT DISTINCT exam_ID FROM ATTEMPT WHERE submit_time IS NOT NULL;
-- and invoke sp_grade_exam for each ID.
--
-- Alternatively, this can be triggered via the frontend Reports page
-- by clicking the "⚙ Grade" button next to each exam under Exam Statistics.
-- ------------------------------------------------------------

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
