/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'tutor' | 'student' | 'admin';
  image?: string | null;
  createdAt: string;
}

// Cached in-memory storage - survives across requests
let cachedUsers: Map<string, UserRecord> | null = null;

// Lazy-loaded modules
let fs: any = null;
let path: any = null;
let dataDir: string | null = null;
let usersFile: string | null = null;

// Require strategy to avoid static analysis picking up Node APIs
const requireModule = new Function('moduleName', "return require(moduleName)");

function initializeModules() {
  if (fs === null && typeof global !== 'undefined') {
    try {
      fs = requireModule('fs');
      path = requireModule('path');
      dataDir = path.join(requireModule('process').cwd(), '.data');
      usersFile = path.join(dataDir, 'users.json');
    } catch (err) {
      console.error('Failed to initialize modules:', err);
    }
  }
}

function ensureDataDir(): void {
  initializeModules();
  if (!fs || !dataDir) return;

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to ensure data directory:', err);
  }
}

function readUsers(): Map<string, UserRecord> {
  initializeModules();
  if (!fs || !usersFile) return new Map();

  ensureDataDir();
  try {
    if (fs.existsSync(usersFile)) {
      const data = fs.readFileSync(usersFile, 'utf-8');
      const arr: UserRecord[] = JSON.parse(data);
      return new Map(arr.map(u => [u.email, u]));
    }
  } catch (err) {
    console.error('Failed to read users file:', err);
  }
  return new Map();
}

function writeUsers(users: Map<string, UserRecord>): void {
  initializeModules();
  if (!fs || !usersFile) return;

  ensureDataDir();
  try {
    const arr = Array.from(users.values());
    fs.writeFileSync(usersFile, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write users file:', err);
  }
}

/**
 * Seed default dev users so you can log in immediately without signing up.
 * email: tutor@dev.local / password: Tutor123
 * email: student@dev.local / password: Student123
 */
function seedDevUsers(users: Map<string, UserRecord>): void {
  // Pre-computed bcrypt hashes (10 salt rounds)
  const TUTOR_HASH = '$2b$10$LD8yJjFmf23oOaeLJv7F0Ow5jhCs4fSzkVqQGVBboEbCq72wgyX96';   // "Tutor123"
  const STUDENT_HASH = '$2b$10$my7fGMS4uC.a41wH5O.8reuQufwmSNZxmJ/Xx0JPyA0TmgDYsagGO'; // "Student123"

  if (!users.has('tutor@dev.local')) {
    users.set('tutor@dev.local', {
      id: 'dev-tutor-001',
      email: 'tutor@dev.local',
      name: 'Dev Tutor',
      password: TUTOR_HASH,
      role: 'tutor',
      createdAt: new Date().toISOString(),
    });
  }
  if (!users.has('student@dev.local')) {
    users.set('student@dev.local', {
      id: 'dev-student-001',
      email: 'student@dev.local',
      name: 'Dev Student',
      password: STUDENT_HASH,
      role: 'student',
      createdAt: new Date().toISOString(),
    });
  }
}

function getUsers(): Map<string, UserRecord> {
  if (!cachedUsers) {
    cachedUsers = readUsers();
    // Always ensure dev seed users exist for local development
    seedDevUsers(cachedUsers);
    writeUsers(cachedUsers);
  }
  return cachedUsers;
}

export function getUser(email: string): UserRecord | undefined {
  return getUsers().get(email);
}

export function hasUser(email: string): boolean {
  return getUsers().has(email);
}

export function addUser(user: UserRecord): void {
  const users = getUsers();
  users.set(user.email, user);
  writeUsers(users);
}

export function getAllUsers(): UserRecord[] {
  return Array.from(getUsers().values());
}
