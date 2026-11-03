# 📚 ExamVault — Online Exam Management System

A robust full-stack academic examination management system built with Node.js + Express backend, MySQL database, and React frontend.

---

## ⚠️ Important Database Notice

> **DESTRUCTIVE RE-INITIALIZATION WARNING:**
> The file `database/schema.sql` starts with:
> ```sql
> DROP DATABASE IF EXISTS exam_management;
> ```
> **DO NOT** run `schema.sql` against an existing database containing data you wish to keep!
>
> - **Fresh Installation:** Run `database/schema.sql` followed by `database/sample_data.sql`.
> - **Updating an Existing Database:** Run `database/migration.sql` to apply all constraints and schema updates safely without dropping existing tables or data.

---

## 📁 Folder Structure

```
exam-management/
├── database/
│   ├── schema.sql            ← Fresh installation DDL: tables, CHECKs, indexes, views, function, procedures, triggers
│   ├── migration.sql         ← Safe ALTER migration script for existing databases
│   ├── sample_data.sql       ← Initial sample records
│   ├── sample_data_large.sql ← Large test dataset
│   ├── sample_queries.sql    ← Basic SQL demonstration queries
│   └── demo_queries.sql      ← Step-by-step viva demonstration script
├── backend/
│   ├── server.js             ← Express application entry point
│   ├── package.json
│   ├── .env.example          ← Template for database credentials
│   ├── db/
│   │   └── connection.js     ← MySQL connection pool using process.env
│   ├── routes/
│   │   ├── users.js          ← CRUD: USER
│   │   ├── students.js       ← CRUD: STUDENT + linked USER (transactional)
│   │   ├── instructors.js    ← CRUD: INSTRUCTOR + linked USER (transactional)
│   │   ├── courses.js        ← CRUD: COURSE
│   │   ├── enrollments.js    ← CRUD: ENROLL (M:N)
│   │   ├── exams.js          ← CRUD: EXAM + auto-grade endpoint
│   │   ├── questions.js      ← CRUD: QUESTION (NOT NULL exam_ID)
│   │   ├── attempts.js       ← CRUD: ATTEMPT + RESULT (atomic synchronization)
│   │   └── reports.js        ← Read-only analytics built on views & window functions
│   └── tests/
│       └── db_tests.js       ← Automated database integrity test suite
├── docs/
│   ├── ER_DIAGRAM.md         ← Mermaid ER diagram with relationship semantics
│   └── DBMS_CONCEPTS.md      ← Detailed viva explanations for normalization, constraints, triggers, etc.
└── frontend/
    └── index.html            ← Single-page React application (CDN, no build step needed)
```

---

## ⚙️ Setup & Run

Requires **MySQL 8.0.16+** (earlier versions ignore CHECK constraints and do not support required window functions).

### Step 1 — Database Setup

**Option A: Fresh Setup**
```bash
mysql -u root -p
SOURCE database/schema.sql;
SOURCE database/sample_data.sql;
```

**Option B: Safe Update on Existing Database**
```bash
mysql -u root -p exam_management < database/migration.sql
```

### Step 2 — Backend Setup

1. Copy the environment template:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Open `.env` and set your MySQL password and configuration:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=exam_management
   DB_PORT=3306
   PORT=5000
   ```
3. Install dependencies and start the server:
   ```bash
   npm install
   npm start
   # Server runs on http://localhost:5000
   ```

### Step 3 — Frontend

Open `frontend/index.html` directly in any modern web browser. No compilation or bundling required!

---

## 🏅 Grading Logic

Grading uses **relative grading** based on class mean ($\mu$) and standard deviation ($\sigma$), with an absolute percentage cutoff:

$$\text{Pass Condition: } \frac{\text{marks\_obtained}}{\text{total\_marks}} \times 100 \ge 40\%$$

| Condition | Grade | Status | Notes |
|---|---|---|---|
| $\text{marks} < 0.40 \times \text{total\_marks}$ | **Fail** | Fail | Absolute 40% cutoff (evaluated first) |
| $\sigma = 0$ (or NULL) and passing | **E** | Pass | Fallback when all students get identical scores |
| $\text{marks} \ge \mu + 1.5\sigma$ | **S** | Pass | Top tier relative performance |
| $\mu + 0.5\sigma \le \text{marks} < \mu + 1.5\sigma$ | **A** | Pass | Above average |
| $\mu - 0.5\sigma \le \text{marks} < \mu + 0.5\sigma$ | **B** | Pass | Core mean band |
| $\mu - 1.5\sigma \le \text{marks} < \mu - 0.5\sigma$ | **C** | Pass | Below average |
| $\mu - 2.0\sigma \le \text{marks} < \mu - 1.5\sigma$ | **D** | Pass | Lower passing band |
| $\text{marks} < \mu - 2.0\sigma$ and passing | **E** | Pass | Passing cutoff boundary |

---

## 🧪 Automated Testing

Run the test suite from the backend directory:
```bash
node tests/db_tests.js
```
The test suite verifies:
1. Rejection of duplicate `STUDENT.user_ID` (1:1 constraint).
2. Rejection of duplicate `INSTRUCTOR.user_ID` (1:1 constraint).
3. Rejection of `QUESTION` without `exam_ID` (NOT NULL).
4. Rejection of marks exceeding `EXAM.total_marks`.
5. Rejection of negative marks.
6. Execution of the 40% percentage-based pass threshold across different exam scales.
7. Graceful fallback to grade 'E' when standard deviation is zero.
8. Transaction atomicity and rollback behavior.
