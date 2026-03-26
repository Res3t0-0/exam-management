ONLINE EXAM SYSTEM - README (RUN ON NEW LAPTOP)

This guide explains how to run the project on another laptop where
Node.js and MySQL are already installed.

  --------------------------------------------------
  STEP 1: Copy Project
  --------------------------------------------------
  Copy the entire folder: exam-system/

  --------------------------------------------------

STEP 2: Start MySQL

Run: net start MySQL80

  --------------------------------------------------
  STEP 3: Login to MySQL
  --------------------------------------------------
  mysql -u root -p

  --------------------------------------------------

STEP 4: Create Database

CREATE DATABASE exam_management; USE exam_management;

  --------------------------------------------------
  STEP 5: Load Tables and Data
  --------------------------------------------------
  SOURCE database/schema.sql; SOURCE
  database/sample_data.sql;

  Check: SHOW TABLES;
  --------------------------------------------------

STEP 6: Setup Backend

cd backend npm install

  --------------------------------------------------
  STEP 7: Configure Database Connection
  --------------------------------------------------
  Open file: backend/db/connection.js

  Edit: password: ‘YOUR_PASSWORD’
  --------------------------------------------------

STEP 8: Run Backend

npm run dev

OR: npm start

Expected Output: Server running on port 5000

  --------------------------------------------------
  STEP 9: Test Backend
  --------------------------------------------------
  Open browser: http://localhost:5000/api/students

  --------------------------------------------------

STEP 10: Run Frontend

Open: frontend/index.html

  --------------------------------------------------
  FINAL CHECK
  --------------------------------------------------
  - Data is displayed - APIs are working - Grade
  calculation works

  --------------------------------------------------

COMMON ISSUES

MySQL not running: → net start MySQL80

Wrong password: → Update connection.js

Port issue: → Change port in server.js

  ------
  DONE
  ------
