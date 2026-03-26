-- ============================================================
-- SAMPLE DATA FOR ONLINE EXAM MANAGEMENT SYSTEM
-- ============================================================
USE exam_management;

-- USERS
INSERT INTO USER (name, email, phone, dob) VALUES
('Arjun Sharma',     'arjun@college.edu',   '9876543210', '2002-04-15'),
('Priya Nair',       'priya@college.edu',   '9876543211', '2003-01-22'),
('Kiran Mehta',      'kiran@college.edu',   '9876543212', '2002-09-08'),
('Sneha Rao',        'sneha@college.edu',   '9876543213', '2003-06-30'),
('Rahul Verma',      'rahul@college.edu',   '9876543214', '2001-11-05'),
('Dr. Anjali Gupta', 'anjali@college.edu',  '9876543215', '1985-03-20'),
('Dr. Suresh Kumar', 'suresh@college.edu',  '9876543216', '1979-07-14'),
('Dr. Meena Pillai', 'meena@college.edu',   '9876543217', '1982-12-01');

-- STUDENTS
INSERT INTO STUDENT (reg_no, user_ID, semester, department) VALUES
('CS2021001', 1, 6, 'Computer Science'),
('CS2021002', 2, 6, 'Computer Science'),
('EC2021003', 3, 4, 'Electronics'),
('ME2021004', 4, 4, 'Mechanical'),
('CS2022005', 5, 2, 'Computer Science');

-- INSTRUCTORS
INSERT INTO INSTRUCTOR (instructor_code, user_ID, school) VALUES
('INS001', 6, 'School of Computing'),
('INS002', 7, 'School of Engineering'),
('INS003', 8, 'School of Sciences');

-- COURSES
INSERT INTO COURSE (course_ID, course_name, credits, department, instructor_code) VALUES
('CS301', 'Database Management Systems', 4, 'Computer Science', 'INS001'),
('CS302', 'Operating Systems',           4, 'Computer Science', 'INS001'),
('EC201', 'Digital Electronics',         3, 'Electronics',      'INS002'),
('CS401', 'Machine Learning',            4, 'Computer Science', 'INS003'),
('ME301', 'Thermodynamics',              3, 'Mechanical',       'INS002');

-- ENROLLMENTS
INSERT INTO ENROLL (reg_no, course_ID) VALUES
('CS2021001', 'CS301'), ('CS2021001', 'CS302'), ('CS2021001', 'CS401'),
('CS2021002', 'CS301'), ('CS2021002', 'CS401'),
('EC2021003', 'EC201'),
('ME2021004', 'ME301'),
('CS2022005', 'CS301');

-- EXAMS
INSERT INTO EXAM (title, exam_date, duration, total_marks, course_ID) VALUES
('DBMS Mid-Term Exam',       '2024-10-15', 90,  100, 'CS301'),
('OS Unit Test 1',           '2024-10-20', 60,  50,  'CS302'),
('Digital Electronics Quiz', '2024-10-18', 45,  30,  'EC201'),
('ML Final Exam',            '2024-11-10', 120, 100, 'CS401'),
('Thermodynamics Mid-Term',  '2024-10-25', 90,  100, 'ME301');

-- QUESTIONS (for Exam 1: DBMS)
INSERT INTO QUESTION (question_text, question_type, marks, exam_ID) VALUES
('What is BCNF? Explain with example.',                         'Long Answer',   20, 1),
('Which of the following is a DDL command?',                    'MCQ',           5,  1),
('Normalization eliminates data redundancy. True or False?',    'True/False',    5,  1),
('Write a SQL query to find employees with salary > 50000.',    'Short Answer',  10, 1),
('Explain the difference between DELETE and TRUNCATE.',         'Short Answer',  10, 1),

-- Questions for Exam 2: OS
('What is a semaphore? How is it used?',                        'Long Answer',   15, 2),
('Define deadlock and its four necessary conditions.',          'Long Answer',   15, 2),
('Round Robin scheduling is non-preemptive. True or False?',   'True/False',    5,  2),
('Which of the following is a page replacement algorithm?',    'MCQ',           5,  2),
('What is the purpose of a page table?',                       'Short Answer',  10, 2);

-- ATTEMPTS
INSERT INTO ATTEMPT (reg_no, exam_ID, start_time, submit_time, score) VALUES
('CS2021001', 1, '2024-10-15 10:00:00', '2024-10-15 11:25:00', 92),
('CS2021002', 1, '2024-10-15 10:00:00', '2024-10-15 11:20:00', 78),
('CS2021001', 2, '2024-10-20 09:00:00', '2024-10-20 09:55:00', 45),
('CS2021002', 4, '2024-11-10 10:00:00', '2024-11-10 11:50:00', 62),
('CS2022005', 1, '2024-10-15 10:00:00', '2024-10-15 11:15:00', 38);

-- RESULTS (grade: >=90→A, 75-89→B, 50-74→C, <50→Fail)
INSERT INTO RESULT (attempt_ID, marks_obtained, grade, status) VALUES
(1, 92, 'A',    'Pass'),
(2, 78, 'B',    'Pass'),
(3, 45, 'Fail', 'Fail'),
(4, 62, 'C',    'Pass'),
(5, 38, 'Fail', 'Fail');
