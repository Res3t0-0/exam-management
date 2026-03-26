-- ============================================================
-- ONLINE EXAM MANAGEMENT SYSTEM - DATABASE SCHEMA (BCNF)
-- ============================================================

CREATE DATABASE IF NOT EXISTS exam_management;
USE exam_management;

-- TABLE 1: USER
CREATE TABLE USER (
    user_ID     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    phone       VARCHAR(15) UNIQUE,
    dob         DATE
);

-- TABLE 2: STUDENT
CREATE TABLE STUDENT (
    reg_no      VARCHAR(20) PRIMARY KEY,
    user_ID     INT NOT NULL,
    semester    INT NOT NULL,
    department  VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_ID) REFERENCES USER(user_ID) ON DELETE CASCADE
);

-- TABLE 3: INSTRUCTOR
CREATE TABLE INSTRUCTOR (
    instructor_code VARCHAR(20) PRIMARY KEY,
    user_ID         INT NOT NULL,
    school          VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_ID) REFERENCES USER(user_ID) ON DELETE CASCADE
);

-- TABLE 4: COURSE
CREATE TABLE COURSE (
    course_ID       VARCHAR(20) PRIMARY KEY,
    course_name     VARCHAR(150) NOT NULL,
    credits         INT NOT NULL,
    department      VARCHAR(100) NOT NULL,
    instructor_code VARCHAR(20),
    FOREIGN KEY (instructor_code) REFERENCES INSTRUCTOR(instructor_code) ON DELETE SET NULL
);

-- TABLE 5: ENROLL
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
    FOREIGN KEY (course_ID) REFERENCES COURSE(course_ID) ON DELETE SET NULL
);

-- TABLE 7: QUESTION
CREATE TABLE QUESTION (
    question_ID   INT AUTO_INCREMENT PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type ENUM('MCQ','Short Answer','True/False','Long Answer') NOT NULL,
    marks         INT NOT NULL,
    exam_ID       INT,
    FOREIGN KEY (exam_ID) REFERENCES EXAM(exam_ID) ON DELETE CASCADE
);

-- TABLE 8: ATTEMPT
CREATE TABLE ATTEMPT (
    attempt_ID  INT AUTO_INCREMENT PRIMARY KEY,
    reg_no      VARCHAR(20) NOT NULL,
    exam_ID     INT NOT NULL,
    start_time  DATETIME,
    submit_time DATETIME,
    score       DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (reg_no)    REFERENCES STUDENT(reg_no) ON DELETE CASCADE,
    FOREIGN KEY (exam_ID)   REFERENCES EXAM(exam_ID)   ON DELETE CASCADE
);

-- TABLE 9: RESULT
CREATE TABLE RESULT (
    result_ID      INT AUTO_INCREMENT PRIMARY KEY,
    attempt_ID     INT NOT NULL UNIQUE,
    marks_obtained DECIMAL(6,2) NOT NULL,
    grade          ENUM('A','B','C','Fail') NOT NULL,
    status         ENUM('Pass','Fail') NOT NULL,
    FOREIGN KEY (attempt_ID) REFERENCES ATTEMPT(attempt_ID) ON DELETE CASCADE
);
