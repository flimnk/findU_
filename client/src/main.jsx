import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  Heart,
  Home,
  LockKeyhole,
  MapPin,
  MessageCircle,
  PlusCircle,
  Search,
  User,
  UserRound,
  CalendarDays,
  Tag
} from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
const initialAuth = JSON.parse(localStorage.getItem('findu-auth') || 'null');

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const auth = JSON.parse(localStorage.getItem('findu-auth') || 'null');
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Erro ao comunicar com o servidor.');
  return data;
}

function App() {
  const [auth, setAuth] = useState(initialAuth);
  const [screen, setScreen] = useState(initialAuth ? 'feed' : 'login');

  function persistAuth(payload) {
    localStorage.setItem('findu-auth', JSON.stringify(payload));
    setAuth(payload);
    setScreen('feed');
  }

  function logout() {
    localStorage.removeItem('findu-auth');
    setAuth(null);
    setScreen('login');
  }

  return (
    <main className="page">
      {!auth ? (
        <AuthFlow screen={screen} setScreen={setScreen} onAuth={persistAuth} />
      ) : (
        <FindUApp auth={auth} screen={screen} setScreen={setScreen} logout={logout} />
      )}
    </main>
  );
}

function AuthFlow({ screen, setScreen, onAuth }) {
  return (
    <PhoneShell compact={screen === 'login'}>
      {screen === 'register' ? (
        <RegisterScreen goBack={() => setScreen('login')} onAuth={onAuth} />
      ) : (
        <LoginScreen openRegister={() => setScreen('register')} onAuth={onAuth} />
      )}
    </PhoneShell>
  );
}

function PhoneShell({ children, compact = false }) {
  return <section className={`phone ${compact ? 'phone-compact' : ''}`}>{children}</section>;
}

function LoginScreen({ openRegister, onAuth }) {
  const [form, setForm] = useState({ identifier: 'ana.souza@unifacs.edu.br', password: 'FindU@123', remember: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      onAuth(await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="logo-tile">
        <Search size={34} />
      </div>
      <h1>FindU</h1>
      <p className="subtitle">Perdeu? Encontrou? A gente conecta.</p>

      <form onSubmit={submit} className="stack auth-form">
        <label>
          E-mail ou CPF
          <input
            value={form.identifier}
            onChange={(event) => setForm({ ...form, identifier: event.target.value })}
            placeholder="seu@universidade.edu.br ou 123.456.789-00"
            required
          />
        </label>
        <label>
          Senha
          <span className="input-icon">
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="********"
              required
            />
            <Eye size={16} />
          </span>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(event) => setForm({ ...form, remember: event.target.checked })}
          />
          Manter-me conectado
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>

      <div className="divider">ou continue com</div>
      <div className="social-grid">
        <button><span className="google-dot">G</span> Google</button>
        <button><LockKeyhole size={16} /> Apple</button>
      </div>
      <div className="auth-links">
        <button onClick={openRegister}>Criar uma conta</button>
        <span />
        <button>Esqueci minha senha</button>
      </div>
    </div>
  );
}

function RegisterScreen({ goBack, onAuth }) {
  const [institutions, setInstitutions] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    cpf: '',
    institutionId: '',
    linkCode: '',
    password: '',
    confirmPassword: '',
    terms: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/institutions').then((data) => {
      setInstitutions(data);
      setForm((current) => ({ ...current, institutionId: data[0]?.id || '' }));
    });
  }, []);

  const strong = form.password.length >= 8 && /[A-Z]/.test(form.password) && /\d/.test(form.password) && /[^A-Za-z0-9]/.test(form.password);
  const canSubmit = strong && form.password === form.confirmPassword && form.terms;

  function fillDemo() {
    setForm({
      fullName: 'Carla Mendes',
      email: `carla.mendes.${Date.now()}@universidade.edu.br`,
      cpf: '15350946056',
      institutionId: institutions[0]?.id || 'inst-unifacs',
      linkCode: '2024002',
      password: 'FindU@123',
      confirmPassword: 'FindU@123',
      terms: true
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      onAuth(await api('/api/auth/register', { method: 'POST', body: JSON.stringify(form) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="screen-scroll">
      <Header title="Criar Conta" onBack={goBack} />
      <form onSubmit={submit} className="stack padded-form">
        <button type="button" className="text-action" onClick={fillDemo}>Preencher dados demo</button>
        <label>Nome Completo<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Maria Silva" required /></label>
        <label>E-mail Institucional<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="maria@universidade.edu.br" required /></label>
        <label>CPF<input value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} placeholder="123.456.789-00" required /></label>
        <label>Universidade<select value={form.institutionId} onChange={(event) => setForm({ ...form, institutionId: event.target.value })}>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select></label>
        <label>Codigo de Vinculo (Matricula)<input value={form.linkCode} onChange={(event) => setForm({ ...form, linkCode: event.target.value })} placeholder="EX: 2024001234" required /></label>
        <label>Senha<span className="input-icon"><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimo 8 caracteres" required /><Eye size={16} /></span></label>
        <PasswordRules strong={strong} password={form.password} />
        <label>Confirmar Senha<span className="input-icon"><input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Repita a senha" required /><Eye size={16} /></span></label>
        {form.confirmPassword && form.password !== form.confirmPassword && <p className="error">As senhas digitadas nao coincidem.</p>}
        <label className="check-line">
          <input type="checkbox" checked={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.checked })} />
          Li e aceito os <a>Termos de Uso</a> e a <a>Politica de Privacidade</a>.
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={!canSubmit}>Concluir Cadastro</button>
      </form>
    </div>
  );
}

function PasswordRules({ strong, password }) {
  return (
    <ul className={`password-rules ${strong ? 'valid' : ''}`}>
      <li>{password.length >= 8 ? '✓' : '□'} Minimo 8 caracteres</li>
      <li>{/[A-Z]/.test(password) ? '✓' : '□'} Letra maiuscula</li>
      <li>{/\d/.test(password) ? '✓' : '□'} Numero</li>
      <li>{/[^A-Za-z0-9]/.test(password) ? '✓' : '□'} Caractere especial</li>
    </ul>
  );
}

function FindUApp({ auth, screen, setScreen, logout }) {
  const [meta, setMeta] = useState({ categories: [], statuses: [] });
  const [institutions, setInstitutions] = useState([]);
  const [items, setItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [filters, setFilters] = useState({ q: '', category: '' });
  const [selectedItem, setSelectedItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([api('/api/meta'), api('/api/institutions')]).then(([metaData, institutionData]) => {
      setMeta(metaData);
      setInstitutions(institutionData);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ type: '', status: '', ...filters });
    Promise.all([api(`/api/items?${params}`), api('/api/matches')]).then(([itemData, matchData]) => {
      setItems(itemData);
      setMatches(matchData);
    });
  }, [filters, refreshKey]);

  const institution = institutions.find((candidate) => candidate.id === auth.user.institutionId);

  function openDetails(item) {
    setSelectedItem(item);
    setScreen('details');
  }

  function afterCreate() {
    setRefreshKey((value) => value + 1);
    setScreen('feed');
  }

  const content = {
    feed: <FeedScreen auth={auth} items={items} institution={institution} filters={filters} setFilters={setFilters} openDetails={openDetails} logout={logout} />,
    create: <CreateItemScreen institution={institution} categories={meta.categories} goBack={() => setScreen('feed')} onCreated={afterCreate} />,
    matches: <MatchesScreen matches={matches} openDetails={(item) => openDetails(item)} />,
    profile: <ProfileScreen auth={auth} institution={institution} logout={logout} />,
    details: <DetailsScreen item={selectedItem || items[0]} institution={institution} goBack={() => setScreen('feed')} onChanged={() => setRefreshKey((value) => value + 1)} />
  }[screen] || null;

  return (
    <PhoneShell>
      {content}
      {screen !== 'details' && screen !== 'create' && (
        <BottomNav active={screen} setScreen={setScreen} />
      )}
    </PhoneShell>
  );
}

function Header({ title, onBack, right }) {
  return (
    <header className="app-header">
      {onBack && <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button>}
      <h2>{title}</h2>
      {right || <span className="header-spacer" />}
    </header>
  );
}

function FeedScreen({ auth, items, institution, filters, setFilters, openDetails, logout }) {
  const chips = ['Todos', 'Eletronicos', 'Documentos', 'Acessorios', 'Outros'];
  const visibleItems = items.length ? items : [];

  function selectChip(chip) {
    setFilters({ ...filters, category: chip === 'Todos' || chip === 'Acessorios' ? '' : chip });
  }

  return (
    <div className="screen feed-screen">
      <header className="feed-header">
        <div>
          <h1>FindU</h1>
          <p>{auth.user.fullName}</p>
        </div>
        <button className="avatar-button" onClick={logout}><UserRound size={19} /></button>
      </header>
      <label className="search-field">
        <Search size={18} />
        <input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Buscar item perdido..." />
      </label>
      <div className="chips">
        {chips.map((chip) => (
          <button key={chip} className={(chip === 'Todos' && !filters.category) || filters.category === chip ? 'active' : ''} onClick={() => selectChip(chip)}>
            {chip}
          </button>
        ))}
      </div>
      <div className="feed-list">
        {visibleItems.map((item) => <FeedItem key={item.id} item={item} institution={institution} onClick={() => openDetails(item)} />)}
        {!visibleItems.length && <p className="empty">Nenhum item encontrado.</p>}
      </div>
    </div>
  );
}

function FeedItem({ item, institution, onClick }) {
  const found = item.type === 'found';
  return (
    <button className="feed-card" onClick={onClick}>
      <span className={`status-icon ${found ? 'ok' : 'lost'}`}>{found ? <Check size={20} /> : <CircleHelp size={20} />}</span>
      <span className="feed-card-body">
        <span className="line-tags">
          <b className={found ? 'found-tag' : 'lost-tag'}>{found ? 'Encontrado' : 'Perdido'}</b>
          <small>{categoryLabel(item.category)}</small>
        </span>
        <strong>{item.name}</strong>
        <small>{locationLabel(item, institution)} • {formatDate(item.eventDate)}</small>
      </span>
      <ChevronRight size={20} />
    </button>
  );
}

function CreateItemScreen({ institution, categories, goBack, onCreated }) {
  const firstCampus = institution?.campuses?.[0];
  const [form, setForm] = useState({
    type: 'lost',
    name: '',
    category: 'Eletronicos',
    description: '',
    campusId: '',
    buildingId: '',
    eventDate: '',
    storageLocation: '',
    image: null
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (firstCampus && !form.campusId) {
      setForm((current) => ({ ...current, campusId: firstCampus.id, buildingId: firstCampus.buildings[0]?.id || '' }));
    }
  }, [firstCampus, form.campusId]);

  const campus = institution?.campuses?.find((candidate) => candidate.id === form.campusId);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null) body.append(key, value);
    });
    try {
      await api('/api/items', { method: 'POST', body });
      onCreated();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="screen-scroll create-screen">
      <Header title="Cadastrar Item" onBack={goBack} />
      <form onSubmit={submit} className="stack padded-form">
        <div className="type-switch">
          <button type="button" className={form.type === 'lost' ? 'lost-active' : ''} onClick={() => setForm({ ...form, type: 'lost' })}>Perdi</button>
          <button type="button" className={form.type === 'found' ? 'found-active' : ''} onClick={() => setForm({ ...form, type: 'found' })}>Encontrei</button>
        </div>
        <label>Nome do Objeto<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Garrafa Termica Preta" required /></label>
        <label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Descricao Detalhada<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descreva caracteristicas, marca, cor, arranhoes, adesivos..." required /></label>
        <label>Campus<select value={form.campusId} onChange={(event) => {
          const nextCampus = institution?.campuses.find((candidate) => candidate.id === event.target.value);
          setForm({ ...form, campusId: event.target.value, buildingId: nextCampus?.buildings[0]?.id || '' });
        }}><option value="">Selecione...</option>{institution?.campuses?.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
        <label>Predio / Bloco<select value={form.buildingId} onChange={(event) => setForm({ ...form, buildingId: event.target.value })}><option value="">Selecione o campus primeiro</option>{campus?.buildings?.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
        <label>Data (Perda/Achado)<input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} required /></label>
        <label className="photo-box">
          <Camera size={25} />
          <span>{form.image ? form.image.name : 'Toque para adicionar foto'}</span>
          <small>Upload JPG ou PNG ate 5MB</small>
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => setForm({ ...form, image: event.target.files?.[0] || null })} />
        </label>
        {message && <p className="error">{message}</p>}
        <button className="primary">Publicar Item</button>
      </form>
    </div>
  );
}

function DetailsScreen({ item, institution, goBack, onChanged }) {
  const [message, setMessage] = useState('');
  if (!item) {
    return <div className="screen"><Header title="Detalhes" onBack={goBack} /><p className="empty">Item nao encontrado.</p></div>;
  }

  async function claimItem() {
    setMessage('');
    try {
      await api(`/api/items/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Em processo de match' }) });
      onChanged();
      setMessage('Solicitacao registrada.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="screen details-screen">
      <Header title="Detalhes" onBack={goBack} />
      <div className="details-photo">
        {item.imageUrl ? <img src={`${API_URL}${item.imageUrl}`} alt={item.name} /> : <div className="headphone-art" />}
      </div>
      <span className={item.type === 'found' ? 'found-tag detail-tag' : 'lost-tag detail-tag'}>{item.type === 'found' ? 'Encontrado' : 'Perdido'}</span>
      <h1>{item.name}</h1>
      <p className="details-description">{item.description}</p>
      <ul className="detail-list">
        <li><MapPin size={16} /> {locationLabel(item, institution)}</li>
        <li><Tag size={16} /> {categoryLabel(item.category)}</li>
        <li><User size={16} /> {item.userId === 'usr-ana' ? 'Ana Souza' : 'Usuario FindU'}</li>
        <li><CalendarDays size={16} /> {formatDate(item.eventDate)}</li>
      </ul>
      {message && <p className="success">{message}</p>}
      <button className="primary detail-button" onClick={claimItem}><Heart size={18} /> E Meu / Encontrei</button>
    </div>
  );
}

function MatchesScreen({ matches, openDetails }) {
  return (
    <div className="screen matches-screen">
      <header className="plain-title">
        <h1>Matches</h1>
        <p>Itens perdidos x encontrados que combinam</p>
      </header>
      <div className="match-stack">
        {matches.map((match) => (
          <button key={match.id} className="match-row" onClick={() => openDetails(match.itemA)}>
            <span><Heart size={22} /></span>
            <b>{match.itemA?.name || 'Item encontrado'}</b>
            <small>Match confirmado</small>
            <MessageCircle size={18} />
          </button>
        ))}
        {!matches.length && <p className="empty">Sem matches no momento.</p>}
      </div>
    </div>
  );
}

function ProfileScreen({ auth, institution, logout }) {
  return (
    <div className="screen profile-screen">
      <header className="plain-title">
        <h1>Perfil</h1>
        <p>{institution?.name || 'Universidade'}</p>
      </header>
      <div className="profile-card">
        <UserRound size={32} />
        <strong>{auth.user.fullName}</strong>
        <span>{auth.user.email}</span>
      </div>
      <button className="secondary" onClick={logout}>Sair</button>
    </div>
  );
}

function BottomNav({ active, setScreen }) {
  const tabs = [
    ['feed', Home, 'Feed'],
    ['create', PlusCircle, 'Cadastrar'],
    ['matches', Heart, 'Matches'],
    ['profile', User, 'Perfil']
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(([id, Icon, label]) => (
        <button key={id} className={active === id ? 'active' : ''} onClick={() => setScreen(id)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function categoryLabel(category = '') {
  return category.toLowerCase();
}

function formatDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function locationLabel(item, institution) {
  const campus = institution?.campuses?.find((candidate) => candidate.id === item.campusId);
  const building = campus?.buildings?.find((candidate) => candidate.id === item.buildingId);
  return [building?.name, campus?.name].filter(Boolean).join(' - ') || 'Campus principal';
}

createRoot(document.getElementById('root')).render(<App />);
