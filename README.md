# 📚 ExamVault — Online Exam Management System

A complete full-stack application with Node.js + Express backend, MySQL database, and React frontend.

---

## 📁 Folder Structure

```
exam-system/
├── database/
│   ├── schema.sql          ← CREATE TABLE statements (BCNF)
│   ├── sample_data.sql     ← INSERT sample records
│   └── sample_queries.sql  ← Demo SQL queries
├── backend/
│   ├── server.js           ← Express entry point
│   ├── package.json
│   ├── db/
│   │   └── connection.js   ← MySQL connection pool
│   └── routes/
│       ├── users.js        ← CRUD: USER table
│       ├── students.js     ← CRUD: STUDENT table
│       ├── courses.js      ← CRUD: COURSE table
│       ├── exams.js        ← CRUD: EXAM table
│       ├── questions.js    ← CRUD: QUESTION table
│       └── attempts.js     ← CRUD: ATTEMPT + RESULT + Grade Logic
└── frontend/
    └── index.html          ← React SPA (no build step needed)
```

---

## ⚙️ Setup & Run

### Step 1 — MySQL Setup
```bash
mysql -u root -p
SOURCE database/schema.sql;
SOURCE database/sample_data.sql;
```

### Step 2 — Backend Setup
```bash
cd backend
npm install
# Edit db/connection.js → set your MySQL password
npm start
# Server runs at http://localhost:5000
```

### Step 3 — Frontend
```bash
# Simply open frontend/index.html in a browser
# No build step required!
```

---

## 🔌 API Endpoints

| Method | Endpoint                         | Description                |
|--------|----------------------------------|----------------------------|
| GET    | /api/users                       | Get all users              |
| POST   | /api/users                       | Create user                |
| PUT    | /api/users/:id                   | Update user                |
| DELETE | /api/users/:id                   | Delete user                |
| GET    | /api/students                    | Get all students (JOIN)    |
| POST   | /api/students                    | Create student             |
| GET    | /api/courses                     | Get all courses (JOIN)     |
| POST   | /api/courses                     | Create course              |
| GET    | /api/exams                       | Get all exams              |
| POST   | /api/exams                       | Create exam                |
| GET    | /api/questions                   | Get all questions          |
| POST   | /api/questions                   | Create question            |
| GET    | /api/attempts                    | Get all attempts           |
| POST   | /api/attempts                    | Create attempt             |
| GET    | /api/attempts/results/all        | Get all results            |
| POST   | /api/attempts/results            | Create result (auto-grade) |

---

## 🏅 Grade Calculation Logic

| Marks Obtained | Grade | Status |
|---------------|-------|--------|
| ≥ 90          | A     | Pass   |
| 75 – 89       | B     | Pass   |
| 50 – 74       | C     | Pass   |
| < 50          | Fail  | Fail   |

Grade is automatically calculated when a result is inserted via `POST /api/attempts/results`.

---

## 🎓 Team Role Split (3–4 Members)

| Role                    | Responsibilities                                                          |
|-------------------------|---------------------------------------------------------------------------|
| **Database Designer**   | schema.sql, sample_data.sql, ER diagram, BCNF normalization proof         |
| **Backend Developer**   | server.js, routes/*.js, db/connection.js, grade logic                    |
| **Frontend Developer**  | frontend/index.html, React components, search, navigation                |
| **Integration & Testing** | Connecting front↔back, testing all CRUD ops, demo preparation         |

---

## 🎤 Viva Demo Script

### Step 1 — Show Database Creation
> "We created the database `exam_management` using MySQL. Here is the CREATE DATABASE and USE command."

### Step 2 — Show Table Creation
> "We designed 9 tables in BCNF. Each table has primary keys and foreign key constraints. For example, RESULT has a foreign key to ATTEMPT, and ATTEMPT has foreign keys to STUDENT and EXAM."

### Step 3 — Insert Sample Data
> "We inserted 5 students, 5 courses, 5 exams, 10 questions, 5 attempts, and 5 results. The data covers Computer Science, Electronics, and Mechanical departments."

### Step 4 — Execute Queries
> "We demonstrate JOIN queries — for example, fetching all results with student names and exam titles using a 5-table JOIN. We also show grade distribution using GROUP BY."

### Step 5 — Show Frontend Output
> "Our React frontend connects to the Express API. It shows all tables with search functionality. The navigation buttons (First, Previous, Next, Last) let you navigate record by record."

### Step 6 — Grade Calculation Demo
> "When we insert a result with marks_obtained = 85, the system automatically calculates Grade = B, Status = Pass. If marks < 50, Grade = Fail."

---

## 🔗 ER Design Summary

### Entities:
- **USER** — Base entity for both students and instructors
- **STUDENT** — Specialization of USER (reg_no identifies a student)
- **INSTRUCTOR** — Specialization of USER (instructor_code)
- **COURSE** — Offered by an instructor
- **EXAM** — Belongs to a course
- **QUESTION** — Part of an exam
- **ATTEMPT** — A student takes an exam attempt
- **RESULT** — One-to-one with ATTEMPT; stores calculated grade

### Relationships:
- USER ← (1:1) → STUDENT / INSTRUCTOR
- INSTRUCTOR → (1:N) → COURSE
- COURSE → (1:N) → EXAM → (1:N) → QUESTION
- STUDENT ←(M:N)→ COURSE via ENROLL
- STUDENT + EXAM → (1:1) → ATTEMPT → (1:1) → RESULT

### BCNF Verification:
All functional dependencies are determined by candidate keys only. No partial or transitive dependencies exist.
