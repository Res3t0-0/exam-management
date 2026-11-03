# DBMS Concepts Used in ExamVault

This document explains where each database concept lives in the project, why it was chosen, and how to demonstrate and explain it during a DBMS viva.

---

## 1. Concept Mapping Matrix

| Concept | Implementation in ExamVault | Demo Query / Action |
|---|---|---|
| **Primary Keys** | `USER.user_ID`, `STUDENT.reg_no`, `COURSE.course_ID`, etc. | `SHOW KEYS FROM STUDENT;` |
| **Foreign Keys & Cascades** | `ON DELETE CASCADE` (`ENROLL`, `ATTEMPT`, `RESULT`, `QUESTION`); `ON DELETE SET NULL` (`COURSE.instructor_code`, `EXAM.course_ID`) | Try deleting a course and observe `EXAM.course_ID` become NULL |
| **Composite Keys** | `ENROLL(reg_no, course_ID)` models M:N relationship | Demo 2.1 in `demo_queries.sql` |
| **1:1 Specialization Constraints** | `UNIQUE(user_ID)` in `STUDENT` and `INSTRUCTOR` | Attempt to insert duplicate `user_ID` |
| **Check Constraints** | `semester BETWEEN 1 AND 8`, `credits BETWEEN 1 AND 10`, `score >= 0`, `std_dev >= 0` | Attempt to set `semester = 12` |
| **Indexes** | `idx_student_dept_sem`, `idx_exam_date`, `idx_result_grade` | `EXPLAIN SELECT ...` with & without index |
| **Views** | `vw_student_results`, `vw_exam_statistics`, `vw_course_summary` | `SELECT * FROM vw_exam_statistics;` |
| **Stored Function** | `fn_grade(marks, avg, sd, total_marks)`: 40% percentage cutoff + relative bands + zero SD fallback | `SELECT fn_grade(85, 65, 12, 100);` |
| **Stored Procedures** | `sp_grade_exam(exam_ID)` (bulk transaction + grading); `sp_student_report(reg_no)` (window function ranking) | `CALL sp_grade_exam(1);` |
| **Triggers (6 total)** | Grade derivation (`trg_result_bi`, `trg_result_bu`), Audit trail (`trg_result_au`, `trg_result_ad`), Enrollment rule & score validation (`trg_attempt_bi`, `trg_attempt_bu`) | Update a result and inspect `RESULT_AUDIT` |
| **Transactions & ACID** | Student/Instructor multi-table insert/update; Attempt-Result atomic score synchronization | Rollback demo in `demo_queries.sql` |
| **Window Functions** | `RANK() OVER (PARTITION BY ...)` in `sp_student_report` and top students report | `GET /api/reports/top-students` |

---

## 2. Triggers Architecture

ExamVault implements 6 triggers to enforce rules that standard declarative constraints cannot handle:

1. **`trg_attempt_bi` (BEFORE INSERT on ATTEMPT)**:
   - Verifies the student is actively enrolled in the course associated with the exam.
   - Enforces that `score <= EXAM.total_marks` and `score >= 0`.
2. **`trg_attempt_bu` (BEFORE UPDATE on ATTEMPT)**:
   - Verifies enrollment if `reg_no` or `exam_ID` is updated.
   - Validates that modified score does not exceed `EXAM.total_marks` or drop below 0.
3. **`trg_result_bi` (BEFORE INSERT on RESULT)**:
   - Validates that `marks_obtained` does not exceed `EXAM.total_marks`.
   - Derives `grade` and `status` via `fn_grade(...)`.
4. **`trg_result_bu` (BEFORE UPDATE on RESULT)**:
   - Re-validates marks against `EXAM.total_marks` and recalculates `grade` and `status`.
5. **`trg_result_au` (AFTER UPDATE on RESULT)**:
   - Appends an audit entry to `RESULT_AUDIT` recording previous marks/grade, new marks/grade, and timestamp.
6. **`trg_result_ad` (AFTER DELETE on RESULT)**:
   - Logs the deletion in `RESULT_AUDIT` so marks history survives record removal.

---

## 3. Top 20 Likely Professor Viva Questions & Answers

### Q1: Why did you create the `ENROLL` table?
- **Answer:** A student can enroll in multiple courses, and a course can have many students (Many-to-Many / M:N relationship). In relational database theory, an M:N relationship cannot be represented with foreign keys directly on either entity without causing redundancy or multi-valued attributes. `ENROLL` serves as an associative (junction) table with a composite primary key `(reg_no, course_ID)`.
- **Where to show:** `database/schema.sql` (line 68).

### Q2: How do you enforce a 1:1 relationship between `USER` and `STUDENT`?
- **Answer:** `STUDENT.user_ID` is defined as a Foreign Key referencing `USER(user_ID)`, and it is decorated with a `UNIQUE` constraint (`uq_student_user`). This allows any user to be a student at most once, preventing one person from holding multiple student records.
- **Where to show:** `database/schema.sql` (lines 40–47).

### Q3: What happens when a referenced student is deleted?
- **Answer:** Thanks to `ON DELETE CASCADE` defined on foreign keys in `ENROLL` and `ATTEMPT`, deleting a student automatically cascades and removes their enrollments, exam attempts, and subsequent results without leaving orphaned records.
- **Where to show:** `database/schema.sql` (lines 72, 110).

### Q4: What is the difference between `DELETE` and `TRUNCATE`?
- **Answer:** `DELETE` is a DML statement that removes rows one by one, logs each deletion, fires `AFTER DELETE` triggers, and can be rolled back. `TRUNCATE` is a DDL command that deallocates data pages, resets `AUTO_INCREMENT` counters, does not fire per-row triggers, and cannot be executed if foreign keys reference the table.
- **Where to show:** Discuss in context of `trg_result_ad` logging row deletes in `RESULT_AUDIT`.

### Q5: What is the difference between a View and a Base Table?
- **Answer:** A base table stores physical data on disk. A view is a stored named SQL query that generates a virtual table dynamically upon execution. In ExamVault, `vw_exam_statistics` joins `EXAM`, `ATTEMPT`, and `RESULT` with aggregate functions (`AVG`, `MIN`, `MAX`) to present pre-aggregated statistics without duplicate physical storage.
- **Where to show:** `database/schema.sql` (views section).

### Q6: Why do you need indexes, and which indexes did you create?
- **Answer:** An index speeds up record retrieval by creating a B-Tree lookup structure instead of performing a full table scan ($O(N)$ vs $O(\log N)$). We created:
  - `idx_student_dept_sem` on `STUDENT(department, semester)` for multi-column student filtering.
  - `idx_exam_date` on `EXAM(exam_date)` for schedule range queries.
  - `idx_result_grade` on `RESULT(grade)` for grade distribution filtering.
- **Where to show:** `database/schema.sql` (lines 135–140).

### Q7: What happens when a transaction fails midway?
- **Answer:** The ACID principle of **Atomicity** ensures all-or-nothing execution. In `sp_grade_exam` and backend routes (e.g. `students.js`), if an error occurs, an `EXIT HANDLER` or `catch` block invokes `ROLLBACK`, undoing all pending changes and leaving the database in its previous valid state.
- **Where to show:** `backend/routes/students.js` (`withTransaction`) and `sp_grade_exam` in `database/schema.sql`.

### Q8: Why are database triggers useful? Give an example from your project.
- **Answer:** Triggers enforce business logic at the DBMS engine level regardless of which client, script, or route writes the data. For example, `trg_result_bi` ensures that no application or manual query can insert a grade that disagrees with `fn_grade()` or exceeds `EXAM.total_marks`.
- **Where to show:** `database/schema.sql` (`trg_result_bi`).

### Q9: What is the difference between a Stored Procedure and a Stored Function?
- **Answer:**
  - A **Stored Function** (`fn_grade`) must return a single value, cannot execute transactions, and can be called directly within SQL statements like `SELECT` or `WHERE`.
  - A **Stored Procedure** (`sp_grade_exam`) is invoked via `CALL`, can accept `IN`/`OUT` parameters, can return full result sets, and can manage transactions (`START TRANSACTION`, `COMMIT`, `ROLLBACK`).
- **Where to show:** Compare `fn_grade` and `sp_grade_exam` in `database/schema.sql`.

### Q10: How did you implement normalization up to 3NF / BCNF?
- **Answer:**
  - **1NF:** All attributes are atomic; no repeating arrays or comma-delimited fields.
  - **2NF:** Multi-column keys (`ENROLL`) have no partial dependencies because all attributes in `ENROLL` form the composite key.
  - **3NF:** No transitive dependencies between non-key attributes exist (e.g., student name and instructor department are not duplicated across exams or attempts).
  - **BCNF:** For every non-trivial functional dependency $X \to Y$, determinant $X$ is a candidate key.
- **Where to show:** `docs/ER_DIAGRAM.md`.

### Q11: What is the purpose of the `RESULT_AUDIT` table?
- **Answer:** It maintains an append-only audit log maintained by database triggers of grade and mark adjustments for academic integrity. Crucially, `RESULT_AUDIT` intentionally does **not** have a foreign key to `RESULT`, ensuring audit records survive even if a result or attempt is deleted.
- **Where to show:** `database/schema.sql` (`RESULT_AUDIT`).

### Q12: How do you prevent invalid marks from being inserted?
- **Answer:**
  - A `CHECK (marks_obtained >= 0)` constraint prevents negative marks.
  - Because MySQL `CHECK` constraints cannot reference another table (`EXAM.total_marks`), `BEFORE INSERT/UPDATE` triggers (`trg_result_bi`, `trg_attempt_bi`) query `EXAM.total_marks` and signal SQLSTATE '45000' if `marks > total_marks`.
- **Where to show:** `trg_attempt_bi` and `trg_result_bi` in `database/schema.sql`.

### Q13: How does relative grading work in your system?
- **Answer:** It evaluates student performance relative to the cohort mean ($\mu$) and standard deviation ($\sigma$). The passing condition is $\ge 40\%$ of total marks. Passing scores are partitioned into bands (S, A, B, C, D, E). If all students get identical marks ($\sigma = 0$), the system falls back to awarding grade 'E' to all passing students.
- **Where to show:** `fn_grade` in `database/schema.sql`.

### Q14: How do you ensure ATTEMPT score and RESULT marks stay synchronized?
- **Answer:** They are synchronized inside atomic transactions. In `backend/routes/attempts.js`, updating an attempt score updates the corresponding `RESULT.marks_obtained` (triggering grade recalculation), and modifying a result updates `ATTEMPT.score`.
- **Where to show:** `backend/routes/attempts.js` (`PUT /api/attempts/:id`).

### Q15: What is the purpose of the `SAVEPOINT` command?
- **Answer:** A savepoint allows rolling back a portion of a transaction to a named checkpoint without aborting the entire transaction.
- **Where to show:** Demo 7.2 in `database/demo_queries.sql`.
