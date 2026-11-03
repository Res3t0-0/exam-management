USE exam_management;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- TABLE 1: USER
CREATE TABLE USER (
    user_ID     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    phone       VARCHAR(15) UNIQUE,
    dob         DATE
);

-- TABLE 2: STUDENT
-- Enforces 1:1 specialization with USER via UNIQUE (user_ID)
CREATE TABLE STUDENT (
    reg_no      VARCHAR(20) PRIMARY KEY,
    user_ID     INT NOT NULL,
    semester    INT NOT NULL,
    department  VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_ID) REFERENCES USER(user_ID) ON DELETE CASCADE,
    CONSTRAINT uq_student_user UNIQUE (user_ID),
    CONSTRAINT chk_student_semester CHECK (semester BETWEEN 1 AND 8)
);

-- TABLE 3: INSTRUCTOR
-- Enforces 1:1 specialization with USER via UNIQUE (user_ID)
CREATE TABLE INSTRUCTOR (
    instructor_code VARCHAR(20) PRIMARY KEY,
    user_ID         INT NOT NULL,
    school          VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_ID) REFERENCES USER(user_ID) ON DELETE CASCADE,
    CONSTRAINT uq_instructor_user UNIQUE (user_ID)
);

-- TABLE 4: COURSE
CREATE TABLE COURSE (
    course_ID       VARCHAR(20) PRIMARY KEY,
    course_name     VARCHAR(150) NOT NULL,
    credits         INT NOT NULL,
    department      VARCHAR(100) NOT NULL,
    instructor_code VARCHAR(20),
    FOREIGN KEY (instructor_code) REFERENCES INSTRUCTOR(instructor_code) ON DELETE SET NULL,
    CONSTRAINT chk_course_credits CHECK (credits BETWEEN 1 AND 10)
);

-- TABLE 5: ENROLL  (M:N between STUDENT and COURSE)
CREATE TABLE ENROLL (
    reg_no      VARCHAR(20) NOT NULL,
    course_ID   VARCHAR(20) NOT NULL,
    PRIMARY KEY (reg_no, course_ID),
    FOREIGN KEY (reg_no)    REFERENCES STUDENT(reg_no)   ON DELETE CASCADE,
    FOREIGN KEY (course_ID) REFERENCES COURSE(course_ID) ON DELETE CASCADE
);

-- TABLE 6: EXAM
CREATE TABLE EXAM (
    exam_ID     INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    exam_date   DATE NOT NULL,
    duration    INT NOT NULL COMMENT 'in minutes',
    total_marks INT NOT NULL,
    course_ID   VARCHAR(20),
    FOREIGN KEY (course_ID) REFERENCES COURSE(course_ID) ON DELETE SET NULL,
    CONSTRAINT chk_exam_duration CHECK (duration > 0),
    CONSTRAINT chk_exam_marks    CHECK (total_marks > 0)
);

-- TABLE 7: QUESTION
-- exam_ID is NOT NULL to ensure every question belongs to an exam
CREATE TABLE QUESTION (
    question_ID   INT AUTO_INCREMENT PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type ENUM('MCQ','Short Answer','True/False','Long Answer') NOT NULL,
    marks         INT NOT NULL,
    exam_ID       INT NOT NULL,
    FOREIGN KEY (exam_ID) REFERENCES EXAM(exam_ID) ON DELETE CASCADE,
    CONSTRAINT chk_question_marks CHECK (marks > 0)
);

-- TABLE 8: ATTEMPT
-- A student can attempt a given exam only once (uq_attempt_student_exam).
-- Score cannot be negative; upper bound against EXAM.total_marks is enforced via triggers.
CREATE TABLE ATTEMPT (
    attempt_ID  INT AUTO_INCREMENT PRIMARY KEY,
    reg_no      VARCHAR(20) NOT NULL,
    exam_ID     INT NOT NULL,
    start_time  DATETIME,
    submit_time DATETIME,
    score       DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (reg_no)    REFERENCES STUDENT(reg_no) ON DELETE CASCADE,
    FOREIGN KEY (exam_ID)   REFERENCES EXAM(exam_ID)   ON DELETE CASCADE,
    CONSTRAINT uq_attempt_student_exam UNIQUE (reg_no, exam_ID),
    CONSTRAINT chk_attempt_score CHECK (score >= 0),
    CONSTRAINT chk_attempt_times CHECK (submit_time IS NULL OR start_time IS NULL OR submit_time >= start_time)
);

-- TABLE 9: RESULT
-- grade and status are filled in by triggers via fn_grade().
-- std_dev >= 0 allows grading when all students score identically (std_dev = 0).
CREATE TABLE RESULT (
    result_ID      INT AUTO_INCREMENT PRIMARY KEY,
    attempt_ID     INT NOT NULL UNIQUE,
    marks_obtained DECIMAL(6,2) NOT NULL,
    class_average  DECIMAL(6,2) NOT NULL COMMENT 'class mean for this exam',
    std_dev        DECIMAL(6,2) NOT NULL COMMENT 'class standard deviation (>= 0)',
    grade          ENUM('S','A','B','C','D','E','Fail') NOT NULL,
    status         ENUM('Pass','Fail') NOT NULL,
    FOREIGN KEY (attempt_ID) REFERENCES ATTEMPT(attempt_ID) ON DELETE CASCADE,
    CONSTRAINT chk_result_marks CHECK (marks_obtained >= 0),
    CONSTRAINT chk_result_avg   CHECK (class_average  >= 0),
    CONSTRAINT chk_result_sd    CHECK (std_dev >= 0)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================
CREATE INDEX idx_student_dept_sem ON STUDENT (department, semester);
CREATE INDEX idx_exam_date        ON EXAM (exam_date);
CREATE INDEX idx_result_grade     ON RESULT (grade);

-- ============================================================
-- 3. AUDIT TABLE
-- ============================================================
CREATE TABLE RESULT_AUDIT (
    audit_ID    INT AUTO_INCREMENT PRIMARY KEY,
    result_ID   INT NOT NULL,
    action      ENUM('UPDATE','DELETE') NOT NULL,
    old_marks   DECIMAL(6,2),
    new_marks   DECIMAL(6,2),
    old_grade   VARCHAR(4),
    new_grade   VARCHAR(4),
    changed_by  VARCHAR(100) NOT NULL,
    changed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$

-- ============================================================
-- 4. FUNCTION: Relative grading with percentage-based pass cutoff
--    Pass mark is 40% of total_marks.
--    Zero standard deviation fallback: if std_dev <= 0, passing students receive 'E'.
-- ============================================================
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
    -- Standard relative grading bands
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

-- ============================================================
-- 5. VIEWS
-- ============================================================

CREATE VIEW vw_student_results AS
SELECT s.reg_no, u.name AS student_name, s.department,
       e.exam_ID, e.title AS exam_title, e.course_ID,
       r.result_ID, r.marks_obtained, r.grade, r.status
FROM RESULT r
JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
JOIN STUDENT s ON a.reg_no     = s.reg_no
JOIN USER u    ON s.user_ID    = u.user_ID
JOIN EXAM e    ON a.exam_ID    = e.exam_ID$$

CREATE VIEW vw_exam_statistics AS
SELECT e.exam_ID, e.title AS exam_title, e.course_ID,
       COUNT(a.attempt_ID)                                   AS attempts,
       COUNT(a.submit_time)                                  AS submitted,
       COUNT(r.result_ID)                                    AS graded,
       ROUND(AVG(r.marks_obtained), 2)                       AS avg_marks,
       MIN(r.marks_obtained)                                 AS min_marks,
       MAX(r.marks_obtained)                                 AS max_marks,
       COALESCE(SUM(r.status = 'Pass'), 0)                   AS passed,
       ROUND(100 * SUM(r.status = 'Pass') / NULLIF(COUNT(r.result_ID), 0), 1) AS pass_rate
FROM EXAM e
LEFT JOIN ATTEMPT a ON a.exam_ID    = e.exam_ID
LEFT JOIN RESULT  r ON r.attempt_ID = a.attempt_ID
GROUP BY e.exam_ID, e.title, e.course_ID$$

CREATE VIEW vw_course_summary AS
SELECT c.course_ID, c.course_name, c.credits, c.department,
       COALESCE(u.name, 'Not assigned')                                  AS instructor_name,
       (SELECT COUNT(*) FROM ENROLL en WHERE en.course_ID = c.course_ID) AS enrolled_students,
       (SELECT COUNT(*) FROM EXAM   ex WHERE ex.course_ID = c.course_ID) AS exams
FROM COURSE c
LEFT JOIN INSTRUCTOR i ON c.instructor_code = i.instructor_code
LEFT JOIN USER u       ON i.user_ID         = u.user_ID$$

-- ============================================================
-- 6. STORED PROCEDURES
-- ============================================================

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

CREATE PROCEDURE sp_student_report(IN p_reg_no VARCHAR(20))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM STUDENT WHERE reg_no = p_reg_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student not found';
    END IF;

    SELECT t.exam_title, t.marks_obtained, t.grade, t.status,
           t.exam_rank, t.class_size
      FROM (SELECT v.*,
                   RANK()   OVER (PARTITION BY v.exam_ID ORDER BY v.marks_obtained DESC) AS exam_rank,
                   COUNT(*) OVER (PARTITION BY v.exam_ID)                                AS class_size
              FROM vw_student_results v) t
     WHERE t.reg_no = p_reg_no
     ORDER BY t.exam_ID;
END$$

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Grade derivation & marks validation against exam total marks on RESULT INSERT
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

-- Grade derivation & marks validation on RESULT UPDATE
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

-- Audit triggers on RESULT
CREATE TRIGGER trg_result_au AFTER UPDATE ON RESULT
FOR EACH ROW
BEGIN
    IF OLD.marks_obtained <> NEW.marks_obtained OR OLD.grade <> NEW.grade THEN
        INSERT INTO RESULT_AUDIT (result_ID, action, old_marks, new_marks, old_grade, new_grade, changed_by)
        VALUES (OLD.result_ID, 'UPDATE', OLD.marks_obtained, NEW.marks_obtained, OLD.grade, NEW.grade, USER());
    END IF;
END$$

CREATE TRIGGER trg_result_ad AFTER DELETE ON RESULT
FOR EACH ROW
BEGIN
    INSERT INTO RESULT_AUDIT (result_ID, action, old_marks, new_marks, old_grade, new_grade, changed_by)
    VALUES (OLD.result_ID, 'DELETE', OLD.marks_obtained, NULL, OLD.grade, NULL, USER());
END$$

-- Validate enrollment and score on ATTEMPT INSERT
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

-- Validate enrollment and score on ATTEMPT UPDATE
CREATE TRIGGER trg_attempt_bu BEFORE UPDATE ON ATTEMPT
FOR EACH ROW
BEGIN
    DECLARE v_course VARCHAR(20);
    DECLARE v_total  INT;
    SELECT course_ID, total_marks INTO v_course, v_total
    FROM EXAM WHERE exam_ID = NEW.exam_ID;

    -- Verify enrollment if reg_no or exam_ID is changed
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
