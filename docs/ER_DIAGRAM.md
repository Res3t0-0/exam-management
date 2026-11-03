# ER Diagram — ExamVault (Online Exam Management System)

```mermaid
erDiagram
    USER {
        INT user_ID PK
        VARCHAR name
        VARCHAR email UK
        VARCHAR phone UK
        DATE dob
    }
    STUDENT {
        VARCHAR reg_no PK
        INT user_ID FK, UK "1:1 specialization"
        INT semester "CHECK 1 to 8"
        VARCHAR department
    }
    INSTRUCTOR {
        VARCHAR instructor_code PK
        INT user_ID FK, UK "1:1 specialization"
        VARCHAR school
    }
    COURSE {
        VARCHAR course_ID PK
        VARCHAR course_name
        INT credits "CHECK 1 to 10"
        VARCHAR department
        VARCHAR instructor_code FK
    }
    ENROLL {
        VARCHAR reg_no PK, FK
        VARCHAR course_ID PK, FK
    }
    EXAM {
        INT exam_ID PK
        VARCHAR title
        DATE exam_date
        INT duration "CHECK > 0"
        INT total_marks "CHECK > 0"
        VARCHAR course_ID FK
    }
    QUESTION {
        INT question_ID PK
        TEXT question_text
        ENUM question_type
        INT marks "CHECK > 0"
        INT exam_ID FK "NOT NULL"
    }
    ATTEMPT {
        INT attempt_ID PK
        VARCHAR reg_no FK "UNIQUE with exam_ID"
        INT exam_ID FK "UNIQUE with reg_no"
        DATETIME start_time
        DATETIME submit_time "CHECK >= start_time"
        DECIMAL score "CHECK >= 0, validated <= total_marks by trigger"
    }
    RESULT {
        INT result_ID PK
        INT attempt_ID FK, UK
        DECIMAL marks_obtained "CHECK >= 0, validated <= total_marks by trigger"
        DECIMAL class_average "CHECK >= 0"
        DECIMAL std_dev "CHECK >= 0"
        ENUM grade "set by trigger"
        ENUM status "set by trigger"
    }
    RESULT_AUDIT {
        INT audit_ID PK
        INT result_ID "no FK, outlives deletes"
        ENUM action
        DECIMAL old_marks
        DECIMAL new_marks
        VARCHAR old_grade
        VARCHAR new_grade
        VARCHAR changed_by
        TIMESTAMP changed_at
    }

    USER       ||--o| STUDENT    : "1:1 specialization"
    USER       ||--o| INSTRUCTOR : "1:1 specialization"
    INSTRUCTOR |o--o{ COURSE     : teaches
    STUDENT    ||--o{ ENROLL     : enrolls
    COURSE     ||--o{ ENROLL     : "has enrolments"
    COURSE     |o--o{ EXAM       : "has exams"
    EXAM       ||--o{ QUESTION   : contains
    STUDENT    ||--o{ ATTEMPT    : makes
    EXAM       ||--o{ ATTEMPT    : "is attempted in"
    ATTEMPT    ||--o| RESULT     : "is graded as"
    RESULT     ||..o{ RESULT_AUDIT : "logged by triggers"
```

---

## Normalization Analysis (1NF, 2NF, 3NF & BCNF)

### First Normal Form (1NF)
- **Criterion:** Every column contains only atomic (indivisible) values, and each record is unique.
- **In ExamVault:**
  - No repeating groups or comma-separated lists (e.g. `phone`, `credits`, and multiple enrollments are not packed into a single string).
  - Every table possesses an explicit primary key.

### Second Normal Form (2NF)
- **Criterion:** The table is in 1NF and contains no **partial functional dependencies** (no non-prime attribute depends on a proper subset of a composite candidate key).
- **In ExamVault:**
  - The only table with a composite candidate key is `ENROLL(reg_no, course_ID)`.
  - `ENROLL` contains no non-prime attributes; its candidate key is $(reg\_no, course\_ID)$ and the entire tuple consists of prime attributes. Hence, no partial functional dependency is possible.
  - All other tables have single-column primary keys, which automatically satisfies 2NF.

### Third Normal Form (3NF)
- **Criterion:** The table is in 2NF and contains no **transitive functional dependencies** ($X \to Y$ where $Y$ is a non-prime attribute and $X$ is not a superkey).
- **In ExamVault:**
  - In `STUDENT`, all non-prime attributes (`semester`, `department`) depend directly on `reg_no`.
  - In `COURSE`, `course_name`, `credits`, and `department` depend directly on `course_ID`.
  - Derived attributes like calculated grades are not permanently stored as independent unlinked facts: `grade` and `status` in `RESULT` are strictly governed and synchronized by `BEFORE INSERT/UPDATE` database triggers tied to the primary key.

### Boyce-Codd Normal Form (BCNF) Analysis
- **Criterion:** A relation is in BCNF if and only if for every non-trivial functional dependency $X \to Y$, determinant $X$ is a **superkey**.
- **Case 1: `USER`**
  - Primary & Alternate Keys: $\{user\_ID\}$, $\{email\}$, $\{phone\}$.
  - Functional Dependencies: $user\_ID \to name, email, phone, dob$; $email \to user\_ID, name, phone, dob$; $phone \to user\_ID, name, email, dob$.
  - Because every determinant is a superkey (enforced by PRIMARY KEY and UNIQUE constraints), `USER` satisfies BCNF under these stated dependencies.
- **Case 2: `STUDENT`**
  - Candidate Keys: $\{reg\_no\}$ (PK), $\{user\_ID\}$ (enforced by UNIQUE `uq_student_user`).
  - Functional Dependencies: $reg\_no \to user\_ID, semester, department$; $user\_ID \to reg\_no, semester, department$.
  - Each determinant is a candidate key. Hence, `STUDENT` satisfies BCNF.
- **Case 3: `INSTRUCTOR`**
  - Candidate Keys: $\{instructor\_code\}$ (PK), $\{user\_ID\}$ (enforced by UNIQUE `uq_instructor_user`).
  - Functional Dependencies: $instructor\_code \to user\_ID, school$; $user\_ID \to instructor\_code, school$.
  - Each determinant is a candidate key. Hence, `INSTRUCTOR` satisfies BCNF.
- **Case 4: `ENROLL`**
  - Candidate Key: $\{ (reg\_no, course\_ID) \}$.
  - Contains only the composite key; no non-trivial dependencies where determinant is not a superkey. Satisfies BCNF.
- **Case 5: `COURSE`, `EXAM`, `QUESTION`, `ATTEMPT`, `RESULT`**
  - In each table, the designated primary key ($course\_ID$, $exam\_ID$, $question\_ID$, $attempt\_ID$, $result\_ID$) functionally determines all other attributes.
  - In `ATTEMPT`, $(reg\_no, exam\_ID)$ is also a candidate key via UNIQUE `uq_attempt_student_exam`, and it determines $attempt\_ID, start\_time, submit\_time, score$.
  - In `RESULT`, $attempt\_ID$ is also a candidate key via UNIQUE.
  - Across all documented functional dependencies, determinants are candidate keys. Thus, the schema is normalized to 3NF / BCNF to the extent justified by these documented dependencies and constraints.
