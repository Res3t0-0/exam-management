// server.js — Online Exam Management System Backend
const express = require('express');
const cors    = require('cors');
const app     = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users',       require('./routes/users'));
app.use('/api/students',    require('./routes/students'));
app.use('/api/instructors', require('./routes/instructors'));
app.use('/api/courses',     require('./routes/courses'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/exams',       require('./routes/exams'));
app.use('/api/questions',   require('./routes/questions'));
app.use('/api/attempts',    require('./routes/attempts'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: '📚 Online Exam Management System API',
    status: 'running',
    endpoints: [
      'GET/POST        /api/users',
      'GET/POST        /api/students',
      'GET/POST        /api/instructors',
      'GET/POST        /api/courses',
      'GET/POST/DELETE /api/enrollments',
      'GET/POST        /api/exams',
      'GET/POST        /api/questions',
      'GET/POST        /api/attempts',
      'GET/POST        /api/attempts/results/all',
    ]
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('📚 Online Exam Management System API Ready\n');
});
