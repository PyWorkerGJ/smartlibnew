import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

export async function runSeeds() {
  console.log('Seeding initial development and demo data...');
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('smartlib123', salt);

  // 1. Admin user
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES (?, ?, ?, 'ADMIN')
     ON DUPLICATE KEY UPDATE name = VALUES(name);`,
    ['admin@smartlib.edu', defaultPasswordHash, 'Dr. Sarah Jenkins (Chief Librarian)']
  );

  // 2. Librarian user
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES (?, ?, ?, 'LIBRARIAN')
     ON DUPLICATE KEY UPDATE name = VALUES(name);`,
    ['librarian@smartlib.edu', defaultPasswordHash, 'Rajesh Kumar (Front Desk Staff)']
  );

  // 3. 15 Demo Students
  const demoStudents = [
    { email: 'student1@smartlib.edu', name: 'Aarav Patel', reg: 'REG-2026-001', dept: 'Computer Science', year: 3 },
    { email: 'student2@smartlib.edu', name: 'Diya Sharma', reg: 'REG-2026-002', dept: 'Electrical Eng', year: 2 },
    { email: 'student3@smartlib.edu', name: 'Vikram Rao', reg: 'REG-2026-003', dept: 'Mechanical Eng', year: 4 },
    { email: 'student4@smartlib.edu', name: 'Ananya Gupta', reg: 'REG-2026-004', dept: 'Data Science', year: 2 },
    { email: 'student5@smartlib.edu', name: 'Rohan Verma', reg: 'REG-2026-005', dept: 'Civil Eng', year: 3 },
    { email: 'student6@smartlib.edu', name: 'Isha Nair', reg: 'REG-2026-006', dept: 'Biotechnology', year: 1 },
    { email: 'student7@smartlib.edu', name: 'Kabir Mehta', reg: 'REG-2026-007', dept: 'Computer Science', year: 2 },
    { email: 'student8@smartlib.edu', name: 'Sneha Reddy', reg: 'REG-2026-008', dept: 'Chemical Eng', year: 3 },
    { email: 'student9@smartlib.edu', name: 'Aditya Joshi', reg: 'REG-2026-009', dept: 'Information Tech', year: 4 },
    { email: 'student10@smartlib.edu', name: 'Meera Iyer', reg: 'REG-2026-010', dept: 'Mathematics', year: 1 },
    { email: 'student11@smartlib.edu', name: 'Karan Singhania', reg: 'REG-2026-011', dept: 'Computer Science', year: 3 },
    { email: 'student12@smartlib.edu', name: 'Pooja Hegde', reg: 'REG-2026-012', dept: 'Physics', year: 2 },
    { email: 'student13@smartlib.edu', name: 'Arjun Nambiar', reg: 'REG-2026-013', dept: 'Design & Media', year: 1 },
    { email: 'student14@smartlib.edu', name: 'Tanvi Deshmukh', reg: 'REG-2026-014', dept: 'Economics', year: 3 },
    { email: 'student15@smartlib.edu', name: 'Varun Chopra', reg: 'REG-2026-015', dept: 'Data Science', year: 4 }
  ];

  for (const s of demoStudents) {
    const [res]: any = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES (?, ?, ?, 'STUDENT')
       ON DUPLICATE KEY UPDATE name = VALUES(name);`,
      [s.email, defaultPasswordHash, s.name]
    );

    const [uRows]: any = await pool.query('SELECT id FROM users WHERE email = ?', [s.email]);
    if (uRows.length > 0) {
      const uId = uRows[0].id;
      await pool.query(
        `INSERT INTO students (user_id, registration_number, department, year_of_study)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE department = VALUES(department), year_of_study = VALUES(year_of_study);`,
        [uId, s.reg, s.dept, s.year]
      );
    }
  }

  // 4. Seed Resources: 50 Seats (Floor 1: Main Hall & Quiet Zone, Floor 2: Collaborative Zone)
  // Floor 1: Rows 1 to 4 (4 rows x 8 cols = 32 seats)
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 8; c++) {
      const seatNum = `F1-S${(r - 1) * 8 + c}`;
      const zone = c <= 4 ? 'Silent Zone' : 'Main Reading Zone';
      const amenities = JSON.stringify({
        has_power_socket: (r + c) % 2 === 0,
        has_ethernet: r === 1,
        near_window: c === 1 || c === 8,
        accessible: r === 1 && c === 1
      });
      await pool.query(
        `INSERT INTO resources (type, identifier, name, floor, zone, capacity, amenities, layout_row, layout_col, status)
         VALUES ('SEAT', ?, ?, 1, ?, 1, ?, ?, ?, 'AVAILABLE')
         ON DUPLICATE KEY UPDATE name = VALUES(name), amenities = VALUES(amenities);`,
        [seatNum, `Seat ${seatNum}`, zone, amenities, r, c]
      );
    }
  }

  // Floor 2: Rows 1 to 3 (3 rows x 6 cols = 18 seats)
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 6; c++) {
      const seatNum = `F2-S${(r - 1) * 6 + c}`;
      const zone = 'Collaborative Zone';
      const amenities = JSON.stringify({
        has_power_socket: true,
        has_ethernet: false,
        near_window: c === 1 || c === 6,
        accessible: r === 1 && c === 1
      });
      await pool.query(
        `INSERT INTO resources (type, identifier, name, floor, zone, capacity, amenities, layout_row, layout_col, status)
         VALUES ('SEAT', ?, ?, 2, ?, 1, ?, ?, ?, 'AVAILABLE')
         ON DUPLICATE KEY UPDATE name = VALUES(name), amenities = VALUES(amenities);`,
        [seatNum, `Seat ${seatNum}`, zone, amenities, r, c]
      );
    }
  }

  // 5. Study Rooms (Floor 1 & 2)
  const studyRooms = [
    { id: 'SR-101', name: 'Study Room 101 (Alpha)', floor: 1, cap: 4, am: { whiteboard: true, monitor: true, ac: true } },
    { id: 'SR-102', name: 'Study Room 102 (Beta)', floor: 1, cap: 6, am: { whiteboard: true, monitor: true, ac: true } },
    { id: 'SR-201', name: 'Study Room 201 (Gamma)', floor: 2, cap: 4, am: { whiteboard: true, monitor: false, ac: true } }
  ];

  for (const sr of studyRooms) {
    await pool.query(
      `INSERT INTO resources (type, identifier, name, floor, zone, capacity, amenities, status)
       VALUES ('STUDY_ROOM', ?, ?, ?, 'Private Study Wing', ?, ?, 'AVAILABLE')
       ON DUPLICATE KEY UPDATE name = VALUES(name), capacity = VALUES(capacity), amenities = VALUES(amenities);`,
      [sr.id, sr.name, sr.floor, sr.cap, JSON.stringify(sr.am)]
    );
  }

  // 6. Meeting Rooms (Floor 2)
  const meetingRooms = [
    { id: 'MR-201', name: 'Conference & Discussion Suite A', floor: 2, cap: 10, am: { projector: true, video_conferencing: true, whiteboard: true, ac: true } },
    { id: 'MR-202', name: 'Innovation Hub Discussion Room', floor: 2, cap: 8, am: { smart_screen: true, whiteboard: true, ac: true } }
  ];

  for (const mr of meetingRooms) {
    await pool.query(
      `INSERT INTO resources (type, identifier, name, floor, zone, capacity, amenities, status)
       VALUES ('MEETING_ROOM', ?, ?, ?, 'Executive & Group Wing', ?, ?, 'AVAILABLE')
       ON DUPLICATE KEY UPDATE name = VALUES(name), capacity = VALUES(capacity), amenities = VALUES(amenities);`,
      [mr.id, mr.name, mr.floor, mr.cap, JSON.stringify(mr.am)]
    );
  }

  console.log('Seed data inserted successfully.');
}
