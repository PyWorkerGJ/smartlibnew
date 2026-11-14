import { pool } from './pool.js';
export async function runMigrations() {
    console.log('Running database schema migrations...');
    const queries = [
        // 1. Users table
        `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role ENUM('STUDENT', 'LIBRARIAN', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_role (role),
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 2. Student profiles table
        `CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      registration_number VARCHAR(50) NOT NULL UNIQUE,
      department VARCHAR(100) DEFAULT 'Computer Science',
      year_of_study INT DEFAULT 1,
      phone VARCHAR(20) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_students_reg (registration_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 3. Resources table (Seat, Study Room, Meeting Room)
        `CREATE TABLE IF NOT EXISTS resources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('SEAT', 'STUDY_ROOM', 'MEETING_ROOM') NOT NULL,
      identifier VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      floor INT NOT NULL DEFAULT 1,
      zone VARCHAR(50) NOT NULL DEFAULT 'Main Hall',
      capacity INT NOT NULL DEFAULT 1,
      amenities JSON NULL,
      layout_row INT NULL,
      layout_col INT NULL,
      status ENUM('AVAILABLE', 'MAINTENANCE', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_resources_type (type),
      INDEX idx_resources_status (status),
      INDEX idx_resources_floor_zone (floor, zone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 4. Booking rules table
        `CREATE TABLE IF NOT EXISTS booking_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_key VARCHAR(100) NOT NULL UNIQUE,
      rule_value VARCHAR(255) NOT NULL,
      description VARCHAR(255) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 5. Reservations table
        `CREATE TABLE IF NOT EXISTS reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      resource_id INT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status ENUM('PENDING', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
      cancelled_at DATETIME NULL,
      expired_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT,
      INDEX idx_res_resource_time (resource_id, start_time, end_time),
      INDEX idx_res_student_status (student_id, status),
      INDEX idx_res_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 6. Active and historical sessions table
        `CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_id INT NOT NULL UNIQUE,
      student_id INT NOT NULL,
      resource_id INT NOT NULL,
      check_in_time DATETIME NOT NULL,
      scheduled_end_time DATETIME NOT NULL,
      actual_end_time DATETIME NULL,
      status ENUM('ACTIVE', 'RELEASED_MANUAL', 'RELEASED_AUTO', 'RELEASED_FORCE') NOT NULL DEFAULT 'ACTIVE',
      extended_minutes INT NOT NULL DEFAULT 0,
      checked_in_by_user_id INT NULL,
      released_by_user_id INT NULL,
      release_reason VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT,
      INDEX idx_sessions_status (status),
      INDEX idx_sessions_student (student_id, status),
      INDEX idx_sessions_resource (resource_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 7. Library physical check-in audit records
        `CREATE TABLE IF NOT EXISTS library_checkins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      reservation_id INT NOT NULL,
      student_id INT NOT NULL,
      registration_number VARCHAR(50) NOT NULL,
      operator_id INT NOT NULL,
      check_in_time DATETIME NOT NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_checkins_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        // 8. System audit logs table
        `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_action (action),
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];
    for (const query of queries) {
        await pool.query(query);
    }
    // Insert default booking rules if not exist
    const defaultRules = [
        ['grace_period_minutes', '15', 'Minutes after start time before no-show expiration'],
        ['max_seat_duration_minutes', '180', 'Maximum duration for a single seat booking'],
        ['max_room_duration_minutes', '120', 'Maximum duration for a study/meeting room booking'],
        ['max_extension_minutes', '60', 'Maximum extension duration per session'],
        ['max_active_seat_reservations', '1', 'Maximum active/pending seat reservations per student'],
        ['max_active_room_reservations', '1', 'Maximum active/pending room reservations per student'],
        ['advance_booking_days', '3', 'How many days in advance a reservation can be made']
    ];
    for (const [key, value, desc] of defaultRules) {
        await pool.query(`INSERT INTO booking_rules (rule_key, rule_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description);`, [key, value, desc]);
    }
    console.log('Database schema migrations completed successfully.');
}
