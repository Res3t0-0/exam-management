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

Grading is **relative**: it uses the student's marks, the class average (μ) and the class standard deviation (σ).

| Condition                          | Grade | Status |
|------------------------------------|-------|--------|
| marks < 50 (checked first)         | Fail  | Fail   |
| marks ≥ μ + 1.5σ                   | S     | Pass   |
| μ + 0.5σ ≤ marks < μ + 1.5σ        | A     | Pass   |
| μ − 0.5σ ≤ marks < μ + 0.5σ        | B     | Pass   |
| μ − 1.5σ ≤ marks < μ − 0.5σ        | C     | Pass   |
| μ − 2σ ≤ marks < μ − 1.5σ          | D     | Pass   |
| marks < μ − 2σ                     | E     | Pass   |

The lower bound of each band is inclusive. σ must be greater than 0.

Grade is automatically calculated when a result is inserted via `POST /api/attempts/results`.
Send `attempt_ID`, `marks_obtained`, `class_average` and `std_dev`. `PUT /api/attempts/results/:id` recalculates the grade; any field you leave out keeps its stored value.

---

## 🎓 Team Role Split (3–4 Members)

| Role                    | Responsibilities                                                          |
|-------------------------|---------------------------------------------------------------------------|
| **Database Designer**   | schema.sql, sample_data.sql, ER diagram, BCNF normalization proof         |
| **Backend Developer**   | server.js, routes/*.js, db/connection.js, grade logic                    |
| **Frontend Developer**  | frontend/index.html, React components, search, navigation                |
| **Integration & Testing** | Connecting front↔back, testing all CRUD ops, demo preparation         |

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
