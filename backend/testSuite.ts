import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function testSuite() {
  console.log('--- 🧪 STARTING SMARTLIB BACKEND INTEGRATION & VERIFICATION TESTS ---');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  assert.strictEqual(health.status, 'ok', 'Health endpoint status must be ok');
  console.log('✅ Health check passed: Database connected');

  // 2. Auth test: Login Student 1
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@smartlib.edu', password: 'smartlib123' })
  });
  assert.strictEqual(studentLoginRes.status, 200, 'Student 1 login must succeed');
  const student1Data = await studentLoginRes.json();
  const tokenStudent1 = student1Data.token;
  console.log(`✅ Student 1 login passed: ${student1Data.user.name} (${student1Data.student.registration_number})`);

  // 3. Auth test: Login Student 2
  const student2LoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student2@smartlib.edu', password: 'smartlib123' })
  });
  const student2Data = await student2LoginRes.json();
  const tokenStudent2 = student2Data.token;
  console.log(`✅ Student 2 login passed: ${student2Data.user.name} (${student2Data.student.registration_number})`);

  // 4. Auth test: Login Librarian
  const libLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'librarian@smartlib.edu', password: 'smartlib123' })
  });
  const libData = await libLoginRes.json();
  const tokenLibrarian = libData.token;
  console.log(`✅ Librarian login passed: ${libData.user.name}`);

  // 5. Query Resources
  const resList = await fetch(`${BASE_URL}/resources`);
  const resources = await resList.json();
  assert.ok(resources.length >= 50, 'Must have at least 50 resources');
  const testSeat = resources.find(r => r.type === 'SEAT' && r.status === 'AVAILABLE');
  assert.ok(testSeat, 'Available seat found');
  console.log(`✅ Resource listing verified: ${resources.length} total resources. Testing with seat ${testSeat.identifier}`);

  // 6. Test Single & Overlapping Reservations (Concurrency check)
  const startTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 62 * 60 * 1000).toISOString();

  // Student 1 books testSeat
  const bookRes1 = await fetch(`${BASE_URL}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenStudent1}`
    },
    body: JSON.stringify({
      resourceId: testSeat.id,
      startTime,
      endTime
    })
  });
  assert.strictEqual(bookRes1.status, 201, 'Student 1 reservation must succeed');
  const reservation1 = await bookRes1.json();
  console.log(`✅ Student 1 reserved ${testSeat.identifier} [${startTime} to ${endTime}]: ID ${reservation1.id}`);

  // Concurrent / Overlapping attempt by Student 2 on same seat & overlapping interval
  const bookRes2 = await fetch(`${BASE_URL}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenStudent2}`
    },
    body: JSON.stringify({
      resourceId: testSeat.id,
      startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString()
    })
  });
  assert.strictEqual(bookRes2.status, 409, 'Overlapping reservation MUST be rejected with HTTP 409 Conflict');
  console.log('✅ Overlapping reservation rejected with HTTP 409 Conflict (Double-booking prevented!)');

  // 7. Front Desk Physical Check-In
  const checkinRes = await fetch(`${BASE_URL}/frontdesk/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenLibrarian}`
    },
    body: JSON.stringify({
      registrationNumber: student1Data.student.registration_number
    })
  });
  assert.strictEqual(checkinRes.status, 200, 'Librarian front desk check-in must succeed');
  const checkinData = await checkinRes.json();
  const sessionId = checkinData.data.sessionId;
  console.log(`✅ Front-desk check-in completed for ${student1Data.student.registration_number}. Session ID: ${sessionId}`);

  // 8. Session Extension
  const extendRes = await fetch(`${BASE_URL}/sessions/${sessionId}/extend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenStudent1}`
    },
    body: JSON.stringify({ minutes: 30 })
  });
  assert.strictEqual(extendRes.status, 200, 'Session extension must succeed');
  const extendData = await extendRes.json();
  console.log(`✅ Session extension verified: Extended by 30 mins to ${extendData.newScheduledEndTime}`);

  // 9. Manual Release
  const releaseRes = await fetch(`${BASE_URL}/sessions/${sessionId}/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenStudent1}`
    }
  });
  assert.strictEqual(releaseRes.status, 200, 'Session release must succeed');
  console.log(`✅ Session release verified. Seat is now available again.`);

  // 10. Admin Analytics & Audit Logs verification
  const analyticsRes = await fetch(`${BASE_URL}/admin/analytics`, {
    headers: { 'Authorization': `Bearer ${tokenLibrarian}` }
  });
  assert.strictEqual(analyticsRes.status, 403, 'Librarian cannot access full admin analytics (Role isolation works)');

  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartlib.edu', password: 'smartlib123' })
  });
  const adminToken = (await adminLoginRes.json()).token;

  const adminAnalytics = await (await fetch(`${BASE_URL}/admin/analytics`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  })).json();
  assert.ok(adminAnalytics.summary.totalReservations >= 1, 'Total reservations tracked');
  console.log(`✅ Admin analytics verified: Total reservations=${adminAnalytics.summary.totalReservations}, Completed=${adminAnalytics.summary.completedReservations}`);

  const auditRes = await (await fetch(`${BASE_URL}/admin/audit-logs`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  })).json();
  assert.ok(auditRes.length >= 4, 'Audit logs tracked multiple actions');
  console.log(`✅ Audit logs verified: ${auditRes.length} audit entries captured.`);

  console.log('--- 🎉 ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

testSuite().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

