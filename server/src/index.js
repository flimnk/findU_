import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadDir = path.join(rootDir, 'uploads');
const dbPath = path.join(dataDir, 'findu-db.json');
const clientDistDir = path.resolve(rootDir, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistDir, 'index.html');
const PORT = process.env.PORT || 3333;
const JWT_SECRET = process.env.JWT_SECRET || 'findu-dev-secret';

const categories = ['Documentos', 'Eletronicos', 'Mochilas', 'Chaves', 'Garrafas', 'Livros', 'Outros'];
const statuses = ['Aberto', 'Em processo de match', 'Devolvido', 'Cancelado'];
const loginAttempts = new Map();

await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(uploadDir, { recursive: true });

async function readDb() {
  try {
    return JSON.parse(await fs.readFile(dbPath, 'utf8'));
  } catch {
    const passwordHash = await bcrypt.hash('FindU@123', 10);
    const now = new Date().toISOString();
    const db = {
      institutions: [
        {
          id: 'inst-unifacs',
          name: 'UNIFACS',
          cnpj: '12345678000190',
          city: 'Salvador',
          state: 'BA',
          active: true,
          campuses: [
            {
              id: 'camp-tancredo',
              name: 'Campus Tancredo Neves',
              buildings: [
                { id: 'blk-a', name: 'Bloco A' },
                { id: 'blk-b', name: 'Bloco B' },
                { id: 'eng', name: 'Predio Engenharia' }
              ]
            },
            {
              id: 'camp-paralela',
              name: 'Campus Paralela',
              buildings: [
                { id: 'lib', name: 'Biblioteca' },
                { id: 'lab', name: 'Laboratorios' }
              ]
            }
          ]
        }
      ],
      institutionalMembers: [
        { fullName: 'Ana Souza', cpf: '39053344705', linkCode: '2024001', institutionId: 'inst-unifacs', active: true },
        { fullName: 'Bruno Lima', cpf: '52998224725', linkCode: 'FUNC100', institutionId: 'inst-unifacs', active: true },
        { fullName: 'Carla Mendes', cpf: '15350946056', linkCode: '2024002', institutionId: 'inst-unifacs', active: true }
      ],
      users: [
        {
          id: 'usr-ana',
          fullName: 'Ana Souza',
          cpf: '39053344705',
          email: 'ana.souza@unifacs.edu.br',
          linkCode: '2024001',
          institutionId: 'inst-unifacs',
          passwordHash,
          suspended: false,
          lastInstitutionCheckAt: now,
          createdAt: now
        }
      ],
      items: [
        {
          id: nanoid(),
          type: 'lost',
          name: 'Carregador USB-C',
          category: 'Eletronicos',
          description: 'Carregador branco de notebook, possivelmente esquecido perto da biblioteca.',
          campusId: 'camp-paralela',
          buildingId: 'lib',
          eventDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
          storageLocation: '',
          imageUrl: '',
          status: 'Aberto',
          institutionId: 'inst-unifacs',
          userId: 'usr-ana',
          createdAt: now
        },
        {
          id: nanoid(),
          type: 'found',
          name: 'Carregador encontrado',
          category: 'Eletronicos',
          description: 'Carregador branco USB-C entregue na recepcao da biblioteca.',
          campusId: 'camp-paralela',
          buildingId: 'lib',
          eventDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
          storageLocation: 'Recepcao da Biblioteca',
          imageUrl: '',
          status: 'Aberto',
          institutionId: 'inst-unifacs',
          userId: 'usr-ana',
          createdAt: now
        }
      ],
      matches: []
    };
    recalculateMatches(db);
    await writeDb(db);
    return db;
  }
}

async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

function cleanCpf(value = '') {
  return String(value).replace(/\D/g, '');
}

function isValidCpf(value = '') {
  const cpf = cleanCpf(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) sum += Number(base[i]) * (base.length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(cpf.slice(0, 9)) === Number(cpf[9]) && calc(cpf.slice(0, 10)) === Number(cpf[10]);
}

function isStrongPassword(password = '') {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function validEventDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const min = new Date();
  min.setDate(min.getDate() - 90);
  min.setHours(0, 0, 0, 0);
  return date <= today && date >= min;
}

function institutionHasLocations(institution) {
  return institution?.campuses?.length > 0 && institution.campuses.every((campus) => campus.buildings?.length > 0);
}

function sameDayDistance(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

function wordScore(a = '', b = '') {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  let score = 0;
  for (const word of wordsA) if (wordsB.has(word)) score += 10;
  return score;
}

function buildMatchScore(a, b) {
  if (a.institutionId !== b.institutionId || a.type === b.type || a.status !== 'Aberto' || b.status !== 'Aberto') return 0;
  let score = 0;
  if (a.category === b.category) score += 40;
  if (a.campusId === b.campusId) score += 20;
  if (a.buildingId === b.buildingId) score += 15;
  const days = sameDayDistance(a.eventDate, b.eventDate);
  if (days <= 1) score += 15;
  else if (days <= 7) score += 8;
  score += Math.min(20, wordScore(`${a.name} ${a.description}`, `${b.name} ${b.description}`));
  return Math.min(score, 100);
}

function recalculateMatches(db) {
  const matches = [];
  for (const item of db.items) {
    for (const other of db.items) {
      if (item.id >= other.id) continue;
      const score = buildMatchScore(item, other);
      if (score >= 55) {
        matches.push({ id: nanoid(), itemAId: item.id, itemBId: other.id, score, createdAt: new Date().toISOString() });
      }
    }
  }
  db.matches = matches.sort((a, b) => b.score - a.score);
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function signToken(user, remember) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: remember ? '30d' : '8h' });
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Token ausente.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await readDb();
    const user = db.users.find((candidate) => candidate.id === payload.sub && !candidate.suspended);
    if (!user) return res.status(401).json({ message: 'Sessao invalida.' });
    req.db = db;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Sessao expirada ou invalida.' });
  }
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${nanoid()}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Formato invalido ou imagem muito grande (Max: 5MB).'));
  }
});

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(uploadDir));
app.use(express.static(clientDistDir));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'FindU API' }));
app.get('/api/meta', (_req, res) => res.json({ categories, statuses }));

app.get('/api/institutions', async (_req, res) => {
  const db = await readDb();
  res.json(db.institutions.filter((institution) => institution.active && institutionHasLocations(institution)));
});

app.post('/api/institutions', async (req, res) => {
  const db = await readDb();
  const { name, cnpj, city, state, campuses = [] } = req.body;
  if (!name || !cnpj || !city || !state) return res.status(400).json({ message: 'Preencha os dados obrigatorios da instituicao.' });
  if (db.institutions.some((institution) => institution.cnpj === cleanCpf(cnpj))) {
    return res.status(409).json({ message: 'Esta instituicao ja esta cadastrada no FindU.' });
  }
  const institution = {
    id: nanoid(),
    name,
    cnpj: cleanCpf(cnpj),
    city,
    state,
    active: institutionHasLocations({ campuses }),
    campuses: campuses.map((campus) => ({
      id: nanoid(),
      name: campus.name,
      buildings: (campus.buildings || []).map((building) => ({ id: nanoid(), name: building.name || building }))
    }))
  };
  db.institutions.push(institution);
  await writeDb(db);
  res.status(201).json(institution);
});

app.post('/api/auth/register', async (req, res) => {
  const db = await readDb();
  const { fullName, cpf, email, linkCode, institutionId, password, confirmPassword } = req.body;
  const normalizedCpf = cleanCpf(cpf);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'Por favor, insira um e-mail valido.' });
  if (!isValidCpf(normalizedCpf)) return res.status(400).json({ message: 'CPF invalido. Verifique os digitos.' });
  if (db.users.some((user) => user.email === normalizedEmail)) return res.status(409).json({ message: 'Este e-mail ja esta cadastrado.' });
  if (db.users.some((user) => user.cpf === normalizedCpf)) return res.status(409).json({ message: 'Este CPF ja esta vinculado a uma conta ativa.' });
  if (!/^[a-z0-9]+$/i.test(linkCode || '')) return res.status(400).json({ message: 'Codigo de vinculo invalido para a instituicao selecionada.' });
  if (!isStrongPassword(password)) return res.status(400).json({ message: 'A senha nao atende aos criterios de seguranca.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'As senhas digitadas nao coincidem.' });
  const member = db.institutionalMembers.find((candidate) =>
    candidate.institutionId === institutionId &&
    candidate.cpf === normalizedCpf &&
    candidate.linkCode.toLowerCase() === String(linkCode).toLowerCase() &&
    candidate.fullName.trim().toLowerCase() === String(fullName).trim().toLowerCase()
  );
  if (!member) {
    return res.status(403).json({ message: 'Os dados informados (Nome, CPF ou Codigo) nao coincidem com os registros da instituicao selecionada. Verifique as informacoes ou contate a secretaria/RH.' });
  }
  if (!member.active) return res.status(403).json({ message: 'Seu vinculo institucional nao esta ativo. Acesso ao sistema suspenso.' });
  const user = {
    id: nanoid(),
    fullName: fullName.trim(),
    cpf: normalizedCpf,
    email: normalizedEmail,
    linkCode,
    institutionId,
    passwordHash: await bcrypt.hash(password, 10),
    suspended: false,
    lastInstitutionCheckAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  res.status(201).json({ user: publicUser(user), token: signToken(user, false) });
});

app.post('/api/auth/login', async (req, res) => {
  const db = await readDb();
  const { identifier, password, remember } = req.body;
  const rawIdentifier = String(identifier || '').trim().toLowerCase();
  const normalizedCpf = cleanCpf(rawIdentifier);
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawIdentifier);
  const looksLikeCpf = normalizedCpf.length === 11;
  if (!looksLikeEmail && !looksLikeCpf) return res.status(400).json({ message: 'Identificador invalido (insira seu e-mail ou CPF).' });
  const key = looksLikeEmail ? rawIdentifier : normalizedCpf;
  const attempt = loginAttempts.get(key);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    const minutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return res.status(423).json({ message: `Conta temporariamente bloqueada devido a multiplas tentativas. Tente novamente em ${minutes} minutos.` });
  }
  const user = db.users.find((candidate) => looksLikeEmail ? candidate.email === rawIdentifier : candidate.cpf === normalizedCpf);
  const valid = user && await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) {
    const next = { count: (attempt?.count || 0) + 1, lockedUntil: null };
    if (next.count >= 5) next.lockedUntil = Date.now() + 15 * 60000;
    loginAttempts.set(key, next);
    return res.status(401).json({ message: 'Usuario ou senha incorretos.' });
  }
  const member = db.institutionalMembers.find((candidate) => candidate.institutionId === user.institutionId && candidate.cpf === user.cpf && candidate.linkCode === user.linkCode);
  if (!member?.active || user.suspended) return res.status(403).json({ message: 'Seu vinculo institucional nao esta ativo. Acesso ao sistema suspenso.' });
  loginAttempts.delete(key);
  res.json({ user: publicUser(user), token: signToken(user, Boolean(remember)) });
});

app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));

app.get('/api/items', auth, (req, res) => {
  const { q = '', category = '', type = '', status = '' } = req.query;
  const query = String(q).toLowerCase();
  const items = req.db.items
    .filter((item) => item.institutionId === req.user.institutionId)
    .filter((item) => !type || item.type === type)
    .filter((item) => !category || item.category === category)
    .filter((item) => !status || item.status === status)
    .filter((item) => !query || `${item.name} ${item.description}`.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.post('/api/items', auth, upload.single('image'), async (req, res) => {
  const db = req.db;
  const { type, name, category, description, campusId, buildingId, eventDate, storageLocation = '' } = req.body;
  if (!['lost', 'found'].includes(type)) return res.status(400).json({ message: 'Tipo de ocorrencia invalido.' });
  if (!name || !category || !description || !campusId || !buildingId || !eventDate) return res.status(400).json({ message: 'Preencha todos os campos obrigatorios.' });
  if (!categories.includes(category)) return res.status(400).json({ message: 'Categoria invalida.' });
  if (!validEventDate(eventDate)) return res.status(400).json({ message: 'A data da perda nao pode ser no futuro ou ter mais de 90 dias.' });
  const institution = db.institutions.find((candidate) => candidate.id === req.user.institutionId);
  const campus = institution?.campuses.find((candidate) => candidate.id === campusId);
  const building = campus?.buildings.find((candidate) => candidate.id === buildingId);
  if (!campus || !building) return res.status(400).json({ message: 'Selecione campus e bloco validos.' });
  const item = {
    id: nanoid(),
    type,
    name,
    category,
    description,
    campusId,
    buildingId,
    eventDate,
    storageLocation,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    status: 'Aberto',
    institutionId: req.user.institutionId,
    userId: req.user.id,
    createdAt: new Date().toISOString()
  };
  db.items.push(item);
  recalculateMatches(db);
  await writeDb(db);
  res.status(201).json({ item, matches: db.matches.filter((match) => match.itemAId === item.id || match.itemBId === item.id) });
});

app.patch('/api/items/:id/status', auth, async (req, res) => {
  const item = req.db.items.find((candidate) => candidate.id === req.params.id && candidate.institutionId === req.user.institutionId);
  if (!item) return res.status(404).json({ message: 'Item nao encontrado.' });
  if (!statuses.includes(req.body.status)) return res.status(400).json({ message: 'Status invalido.' });
  item.status = req.body.status;
  recalculateMatches(req.db);
  await writeDb(req.db);
  res.json(item);
});

app.get('/api/matches', auth, (req, res) => {
  const itemsById = new Map(req.db.items.map((item) => [item.id, item]));
  const matches = req.db.matches
    .map((match) => ({ ...match, itemA: itemsById.get(match.itemAId), itemB: itemsById.get(match.itemBId) }))
    .filter((match) => match.itemA?.institutionId === req.user.institutionId && match.itemB?.institutionId === req.user.institutionId);
  res.json(matches);
});

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  try {
    await fs.access(clientIndexPath);
    res.sendFile(clientIndexPath);
  } catch {
    next();
  }
});

app.use((error, _req, res, _next) => {
  res.status(400).json({ message: error.message || 'Nao foi possivel processar a requisicao.' });
});

app.listen(PORT, () => {
  console.log(`FindU API running on http://localhost:${PORT}`);
});
