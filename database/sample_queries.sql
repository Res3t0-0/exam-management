-- ============================================================
-- SAMPLE QUERIES — Online Exam Management System
-- ============================================================
USE exam_management;

-- ── 1. All students with their full names ──────────────────────
SELECT s.reg_no, u.name, u.email, s.semester, s.department
FROM STUDENT s
JOIN USER u ON s.user_ID = u.user_ID;

-- ── 2. All courses with instructor names ──────────────────────
SELECT c.course_ID, c.course_name, c.credits, c.department,
       u.name AS instructor_name
FROM COURSE c
LEFT JOIN INSTRUCTOR i ON c.instructor_code = i.instructor_code
LEFT JOIN USER u ON i.user_ID = u.user_ID;

-- ── 3. Students enrolled in a specific course (CS301) ─────────
SELECT s.reg_no, u.name, s.semester
FROM ENROLL e
JOIN STUDENT s ON e.reg_no = s.reg_no
JOIN USER u ON s.user_ID = u.user_ID
WHERE e.course_ID = 'CS301';

-- ── 4. All exam attempts with scores ──────────────────────────
SELECT a.attempt_ID, u.name AS student, e.title AS exam,
       a.start_time, a.submit_time, a.score
FROM ATTEMPT a
JOIN STUDENT s ON a.reg_no = s.reg_no
JOIN USER u ON s.user_ID = u.user_ID
JOIN EXAM e ON a.exam_ID = e.exam_ID
ORDER BY a.score DESC;

-- ── 5. Results with grades (Pass/Fail) ────────────────────────
SELECT r.result_ID, u.name AS student, e.title AS exam,
       r.marks_obtained, r.grade, r.status
FROM RESULT r
JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
JOIN STUDENT s ON a.reg_no = s.reg_no
JOIN USER u ON s.user_ID = u.user_ID
JOIN EXAM e ON a.exam_ID = e.exam_ID
ORDER BY r.marks_obtained DESC;

-- ── 6. Students who PASSED all their exams ────────────────────
SELECT DISTINCT u.name, s.reg_no
FROM RESULT r
JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
JOIN STUDENT s ON a.reg_no = s.reg_no
JOIN USER u ON s.user_ID = u.user_ID
WHERE r.status = 'Pass'
  AND s.reg_no NOT IN (
    SELECT DISTINCT a2.reg_no FROM RESULT r2
    JOIN ATTEMPT a2 ON r2.attempt_ID = a2.attempt_ID
    WHERE r2.status = 'Fail'
  );

-- ── 7. Questions per exam ──────────────────────────────────────
SELECT e.title, COUNT(q.question_ID) AS num_questions,
       SUM(q.marks) AS total_question_marks
FROM EXAM e
LEFT JOIN QUESTION q ON e.exam_ID = q.exam_ID
GROUP BY e.exam_ID, e.title;

-- ── 8. Average score per exam ─────────────────────────────────
SELECT e.title, ROUND(AVG(a.score), 2) AS avg_score,
       MAX(a.score) AS highest, MIN(a.score) AS lowest
FROM EXAM e
JOIN ATTEMPT a ON e.exam_ID = a.exam_ID
GROUP BY e.exam_ID, e.title;

-- ── 9. Grade distribution ─────────────────────────────────────
SELECT grade, COUNT(*) AS count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM RESULT), 1) AS percentage
FROM RESULT
GROUP BY grade
ORDER BY FIELD(grade, 'A', 'B', 'C', 'Fail');

-- ── 10. Student report card ───────────────────────────────────
SELECT u.name, s.reg_no, e.title AS exam,
       r.marks_obtained, r.grade, r.status
FROM RESULT r
JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
JOIN STUDENT s ON a.reg_no = s.reg_no
JOIN USER u ON s.user_ID = u.user_ID
JOIN EXAM e ON a.exam_ID = e.exam_ID
WHERE s.reg_no = 'CS2021001'
ORDER BY r.marks_obtained DESC;
