import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, rtdb, auth, googleProvider } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, orderBy, where, onSnapshot, arrayUnion, increment as fsIncrement, Timestamp } from 'firebase/firestore';
import { ref, onValue, runTransaction, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

// ★ 管理員 UID
const ADMIN_UID = 'aYe1g9g27SViRei2gjAxTQmt5s13';

// ============================================================
// 主色系（維持 綠 + 米白，但走官網的線條科技風）
// ============================================================
const C = {
  ink: '#123f30',        // 深墨綠（主文字/深底）
  teal: '#0d9488',       // 亮青綠（強調線條）
  tealDim: 'rgba(13,148,136,0.35)',
  line: 'rgba(18,63,48,0.22)',   // 卡片邊線
  cream: '#f4f1e6',      // 頁面底
  paper: '#fdfcf6',      // 卡片底
  gold: '#b7791f',       // 金（購物金/獎章）
  goldBg: '#f6ead2',
  red: '#c2410c',        // 事件負面/警示
};

// 切角外形（模仿官網的科技框：左上、右下切角）
const CUT = (c = 10) => `polygon(${c}px 0, 100% 0, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, 0 100%, 0 ${c}px)`;

// ============================================================
// 線條 SVG 圖示系統（取代 emoji；風格同拾獲手機的 ICONS）
// 想加新圖示：在這裡加一組 24x24 的 stroke path 即可
// ============================================================
const ICON_PATHS = {
  boat: '<path d="M2.5 14.5h13.5c2.4 0 4.3-1.2 5-3.2"/><path d="M4.5 14.5l1.6 3.4h9.6l1.5-3.4"/><path d="M19.5 12.2c1.3-.3 2.2-1.3 2.4-2.6-1.4-.2-2.6.3-3.2 1.4"/><path d="M7 11.5V9M10.5 11.5V8.2M14 11.5V9"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8.2v7.6M9.4 10.4h5.2M9.4 13.6h5.2"/>',
  stamp: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="4" stroke-dasharray="2.4 2.4"/>',
  book: '<path d="M4.5 5a2 2 0 0 1 2-2H19v18H6.5a2 2 0 0 1-2-2z"/><path d="M8.5 3v18"/><path d="M12 8h4M12 11h4"/>',
  bag: '<path d="M5.5 8h13l-1.1 11.5H6.6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  map: '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2z"/><path d="M9 4v14M15 6v14"/>',
  trophy: '<path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5H4.5a3 3 0 0 0 3 3.6M16.5 5h3a3 3 0 0 1-3 3.6"/><path d="M12 13v3.5M8.5 20h7M10.2 16.5h3.6V20h-3.6z"/>',
  medal: '<circle cx="12" cy="14.5" r="4.6"/><path d="M9 10.8 6.5 3.5h4L12 8l1.5-4.5h4L15 10.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevL: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevR: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  external: '<path d="M8.5 5.5H18.5V15.5"/><path d="M18.5 5.5 6 18"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20.2 3.2v4.4h-4.4"/>',
  flag: '<path d="M6 3v18"/><path d="M6 4.5h11l-2.6 3.5L17 11.5H6"/>',
  heart: '<path d="M12 19.5s-6.6-4.2-8.4-8.3A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8.4 3.6c-1.8 4.1-8.4 8.3-8.4 8.3z"/>',
  horn: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.8 20a7.5 7.5 0 0 1 14.4 0"/>',
  lantern: '<path d="M8.2 6.5h7.6c1.9 2.6 1.9 7.4 0 10H8.2c-1.9-2.6-1.9-7.4 0-10z"/><path d="M12 3.5v3M12 16.5v2.5M10 21h4"/><path d="M9.8 6.8c-.9 2.8-.9 6.6 0 9.4M14.2 6.8c.9 2.8.9 6.6 0 9.4"/>',
  spark: '<path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18 10.3 12.4 5 10.7 10.3 9z"/>',
  fish: '<path d="M2.5 12c3.6-4.6 9.2-4.8 13-1.2l5-2.8-1.1 4 1.1 4-5-2.8c-3.8 3.6-9.4 3.4-13-1.2z"/><circle cx="7" cy="11.2" r=".9" fill="currentColor" stroke="none"/>',
  wind: '<path d="M3 8h10.5a2.4 2.4 0 1 0-2.4-2.6"/><path d="M3 12h15a2.4 2.4 0 1 1-2.4 2.6"/><path d="M3 16h7.5a2 2 0 1 1-2 2.2"/>',
  wave: '<path d="M2.5 10.5c2-2.8 4-2.8 6 0s4 2.8 6 0 4-2.8 6 0"/><path d="M2.5 15.5c2-2.8 4-2.8 6 0s4 2.8 6 0 4-2.8 6 0"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="8.6" cy="8.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  logout: '<path d="M9.5 5H5v14h4.5"/><path d="M13.5 8l4 4-4 4M17.5 12H9"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M12 9v11M4 13h16"/><path d="M12 9c-1-2.8-3-4.2-4.6-3.4S6.6 9 9 9zM12 9c1-2.8 3-4.2 4.6-3.4S17.4 9 15 9z"/>',
  ticket: '<path d="M3.5 9V7.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1V9a3 3 0 0 0 0 6v1.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V15a3 3 0 0 0 0-6z"/><path d="M14.5 6.5v11" stroke-dasharray="2.5 2.5"/>',
};
function Icon({ name, size = 16, color = 'currentColor', sw = 1.7, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }} />
  );
}

// 官網風角落括號（掛在 position:relative 的容器內）
const Corners = ({ color = C.teal, size = 9, w = 1.5, inset = -1 }) => (
  <>
    {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h], i) => (
      <span key={i} style={{
        position: 'absolute', [v]: inset, [h]: inset, width: size, height: size, pointerEvents: 'none', zIndex: 3,
        borderTop: v === 'top' ? `${w}px solid ${color}` : 'none',
        borderBottom: v === 'bottom' ? `${w}px solid ${color}` : 'none',
        borderLeft: h === 'left' ? `${w}px solid ${color}` : 'none',
        borderRight: h === 'right' ? `${w}px solid ${color}` : 'none',
      }} />
    ))}
  </>
);

// 小型六角標籤（官網的「服」「武」那種）
const HexTag = ({ children, color = C.ink, bg = C.paper, size = 34 }) => (
  <div style={{
    width: size, height: size * 1.1, background: bg, color,
    clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', flexShrink: 0,
  }}>{children}</div>
);

// ============================================================
// 印章元件（保留噗浪圖床網址機制）
// ============================================================
function StampDesign({ stamp, size = 88, stamped = false, boothEmoji = '', rotate = 0 }) {
  if (!stamped) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `1.5px dashed ${C.line}`, background: 'rgba(18,63,48,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="stamp" size={size * 0.4} color="rgba(18,63,48,0.18)" />
      </div>
    );
  }
  const ring = {
    width: size, height: size, borderRadius: '50%', overflow: 'hidden',
    border: `1.5px solid ${C.tealDim}`, boxShadow: `0 0 0 4px ${C.paper}, 0 0 0 5px ${C.line}`,
    position: 'relative', background: '#fff', transform: `rotate(${rotate}deg)`,
  };
  if (stamp && stamp.imageUrl) {
    return (
      <div style={ring}>
        <img src={stamp.imageUrl} alt="stamp" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, background: '#f2f7f2' }}>
          {boothEmoji || <Icon name="lantern" size={size * 0.4} color={C.teal} />}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...ring, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, background: '#f2f7f2' }}>
      {boothEmoji || <Icon name="lantern" size={size * 0.4} color={C.teal} />}
    </div>
  );
}

// ============================================================
// 工具
// ============================================================
const AVATAR_COLORS = ['#b45309', '#0f766e', '#4d7c0f', '#0e7490', '#7c3aed', '#be185d', '#166534', '#a16207', '#1d4ed8', '#9f1239'];
function getAvatarColor(name) { const s = String(name || '?'); let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

// 官網風分隔線（取代波浪）
const TechDivider = ({ flip }) => (
  <svg viewBox="0 0 1200 14" preserveAspectRatio="none"
    style={{ display: 'block', width: '100%', height: 10, transform: flip ? 'scaleY(-1)' : 'none' }}>
    <path d="M0 7 H492 L508 1 H692 L708 7 H1200" fill="none" stroke={C.tealDim} strokeWidth="1.5" />
    <path d="M540 11 H660" stroke="rgba(13,148,136,0.2)" strokeWidth="1" />
  </svg>
);

const RANK_COLOR = ['#b7791f', '#7d8590', '#a05e2b'];

// ============================================================
// 龍舟賽事件（第5點需求）：管理後台每輪可套用
// 要加事件就往這個陣列加，delta 為前進點數增減
// ============================================================
const RACE_EVENTS = [
  { id: 'salmon', name: '災厄鮭襲擊', delta: -5, icon: 'fish' },
  { id: 'undertow', name: '暗流纏槳', delta: -3, icon: 'wave' },
  { id: 'wind', name: '大順風', delta: 5, icon: 'wind' },
  { id: 'bless', name: '龍神庇佑', delta: 8, icon: 'spark' },
];

// 預設攤位（試玩模式 fallback）
const DEFAULT_BOOTHS = [
  {
    id: 'booth-demo-1', side: 'top', name: '示範攤位（上排）', ownerName: '示範攤主．阿粽', emoji: '🍱',
    stamp: { imageUrl: '' },
    stampHint: '這是沒上傳印章時的預設樣式。攤主可上傳自製印章圖到噗浪，貼上圖床網址即可替換。',
    facadeImageUrl: '',
    description: '這裡是攤位介紹文字，可以寫攤位的故事、特色、主題等。建議 2-3 句話讓玩家了解這個攤位在做什麼。',
    plurkUrl: 'https://www.plurk.com/p/你的噗文網址',
    task: '這裡寫集章任務說明，例如：「到噗浪攤位留言【粽志成城】即可獲得印章與 50 元金幣」',
    items: [
      { id: 'demo-item-1', name: '示範商品 A', price: 50, description: '這裡寫商品說明，例如口味、內容物等', imageUrl: '' },
      { id: 'demo-item-2', name: '示範商品 B', price: 30, description: '商品圖片請上傳噗浪取得圖床網址', imageUrl: '' },
    ],
    stats: { stampCount: 12, salesCount: 8, salesRevenue: 360 },
  },
  {
    id: 'booth-demo-2', side: 'top', name: '小遊戲攤位', ownerName: '示範攤主．小龍', emoji: '🎮',
    stamp: { imageUrl: '' },
    stampHint: '建議製作 300×300 以上、去背 PNG 的印章圖，上傳噗浪後把圖床網址填到 stampImageUrl 欄位。',
    facadeImageUrl: '',
    description: '如果攤位有小遊戲，可以在這裡說明遊戲規則和玩法。也可以放遊戲的連結讓玩家直接進入遊玩。',
    plurkUrl: 'https://www.plurk.com/p/你的小遊戲噗文',
    task: '完成小遊戲並在噗浪截圖回報，即可獲得集章！',
    items: [
      { id: 'demo-item-3', name: '遊戲獎品', price: 100, description: '通關獎勵，限量兌換', imageUrl: '' },
    ],
    stats: { stampCount: 5, salesCount: 2, salesRevenue: 200 },
  },
  {
    id: 'booth-demo-3', side: 'bottom', name: '創作展示攤', ownerName: '示範攤主．艾草', emoji: '🎨',
    stamp: { imageUrl: '' },
    stampHint: '沒有自訂印章的攤位會用 emoji 或燈籠線條圖當作印章圖案。',
    facadeImageUrl: '',
    description: '攤位也可以用來展示創作作品，封面圖（facadeImageUrl）請上傳到噗浪取得圖床網址，建議 300×300 以上正方形圖片。',
    plurkUrl: 'https://www.plurk.com/p/你的創作噗文',
    task: '欣賞完作品後，在噗浪留下你的感想即可集章',
    items: [],
    stats: { stampCount: 3, salesCount: 0, salesRevenue: 0 },
  },
];

// 模擬龍舟賽資料（含事件示範）
const MOCK_RACE_TEAMS = [
  { id: 1, name: '南港輪胎隊', color: '#c2410c', flagImageUrl: '', outboundScore: 120, inboundScore: 0, turnSuccess: false, cheers: 88, lastRolls: [15, 20, 18, 5, 2], lastEvent: { name: '災厄鮭襲擊', delta: -5, icon: 'fish' } },
  { id: 2, name: '屈原不想下水隊', color: '#1d4ed8', flagImageUrl: 'https://images.plurk.com/2HjjzKJMBWLsFSHYdLaNAv.png', outboundScore: 200, inboundScore: 0, turnSuccess: false, cheers: 156, lastRolls: [20, 20, 20, 20, 20], lastEvent: null },
  { id: 3, name: '粽子吃到飽隊', color: '#15803d', flagImageUrl: '', outboundScore: 200, inboundScore: 60, turnSuccess: true, cheers: 342, lastRolls: [1, 3, 2, 5, 4], lastEvent: { name: '大順風', delta: 5, icon: 'wind' } },
  { id: 4, name: '極速龍舟傳說', color: '#7c3aed', flagImageUrl: 'https://images.plurk.com/2HjjzKJMBWLsFSHYdLaNAv.png', outboundScore: 200, inboundScore: 200, turnSuccess: true, cheers: 999, lastRolls: [], lastEvent: null },
];
const MOCK_BETS = [
  { username: '慶典達人', bets: { 3: 120, 2: 30 } },
  { username: '龍舟粉絲', bets: { 2: 80 } },
  { username: '愛吃粽子', bets: { 1: 50 } },
];
const MOCK_RACE_EVENTS = [
  { t: 3, team: '粽子吃到飽隊', name: '大順風', delta: 5, icon: 'wind' },
  { t: 2, team: '南港輪胎隊', name: '災厄鮭襲擊', delta: -5, icon: 'fish' },
  { t: 1, team: '屈原不想下水隊', name: '龍神庇佑', delta: 8, icon: 'spark' },
];

// ============================================================
// 錯誤邊界
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0f2922', color: '#fff', fontFamily: '"Noto Sans TC",sans-serif', textAlign: 'center' }}>
          <Icon name="boat" size={48} color="#fbbf24" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>哎呀，畫面出了點狀況</h1>
          <p style={{ fontSize: 12, color: 'rgba(167,215,195,0.7)', marginBottom: 16, maxWidth: 320 }}>請重新整理頁面試試。如果持續發生，把下面的訊息截圖回報：</p>
          <pre style={{ fontSize: 10, color: '#fca5a5', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, maxWidth: '90vw', overflow: 'auto', textAlign: 'left' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '12px 28px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#134e3a', fontSize: 14, fontWeight: 900, border: 'none', clipPath: CUT(8), cursor: 'pointer' }}>重新整理</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}

function AppInner() {
  const [booths, setBooths] = useState([]);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('entry');
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [message, setMessage] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [raceTeams, setRaceTeams] = useState([]);
  const [zoomFlagUrl, setZoomFlagUrl] = useState(null);
  const [stampReveal, setStampReveal] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [boothsLoading, setBoothsLoading] = useState(true);
  const [raceLoading, setRaceLoading] = useState(true);

  const isMobileApp = window.innerWidth < 640;   // 手機版改整頁捲動，桌面維持固定版面

  const showMsg = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // 監聽管理員登入狀態
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.uid === ADMIN_UID) {
        setAdminUser(user);
        setView('admin');
      } else {
        setAdminUser(null);
      }
    });
    return () => unsub();
  }, []);

  // 載入攤位資料（Firestore）——抽成可重複呼叫：進入預覽/登入時都會重新抓
  const loadBoothsFromCloud = useCallback(async () => {
      try {
        const boothSnap = await getDocs(collection(db, 'booths'));
        if (boothSnap.empty) { setBooths([]); setBoothsLoading(false); return; }
        const boothsData = [];
        for (const boothDoc of boothSnap.docs) {
          const b = boothDoc.data();
          const itemSnap = await getDocs(collection(db, 'booths', boothDoc.id, 'items'));
          const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          boothsData.push({ id: boothDoc.id, ...b, stamp: { imageUrl: b.stampImageUrl || '' }, items });
        }
        const stampSnap = await getDocs(collection(db, 'stampLogs'));
        const stampCount = {};
        stampSnap.docs.forEach(d => {
          const bid = d.data().boothId;
          stampCount[bid] = (stampCount[bid] || 0) + 1;
        });
        const playerSnap = await getDocs(collection(db, 'players'));
        const salesByBooth = {};
        playerSnap.docs.forEach(d => {
          const inv = d.data().inventory || [];
          inv.forEach(item => {
            const bid = item.boothId || '';
            if (!bid) return;
            if (!salesByBooth[bid]) salesByBooth[bid] = { revenue: 0, count: 0 };
            salesByBooth[bid].revenue += Number(item.price) || 0;
            salesByBooth[bid].count += 1;
          });
        });
        boothsData.forEach(b => {
          b.stats = {
            stampCount: stampCount[b.id] || 0,
            salesCount: (salesByBooth[b.id] || {}).count || 0,
            salesRevenue: (salesByBooth[b.id] || {}).revenue || 0,
          };
        });
        setBooths(boothsData);
      } catch (err) {
        console.warn('攤位載入失敗:', err);
      } finally {
        setBoothsLoading(false);
      }
  }, []);
  useEffect(() => { loadBoothsFromCloud(); }, [loadBoothsFromCloud]);

  // 遊戲參數（後台「設定」分頁可調）：初始購物金、集章獎勵金
  const [gameConfig, setGameConfig] = useState({ initialCoins: 500, stampReward: 50 });
  useEffect(() => {
    getDoc(doc(db, 'settings', 'general')).then(s => {
      if (s.exists()) {
        const d = s.data();
        setGameConfig({
          initialCoins: Number(d.initialCoins) > 0 ? Number(d.initialCoins) : 500,
          stampReward: Number(d.stampReward) > 0 ? Number(d.stampReward) : 50,
        });
      }
    }).catch(() => {});
  }, []);

  // ===== 龍舟賭盤（彩池制）=====
  const [bettingMeta, setBettingMeta] = useState({ open: false, settled: false });  // RTDB: betting
  const [allBets, setAllBets] = useState([]);                                        // Firestore: raceBets 即時同步
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'betting'), (s) => setBettingMeta(s.val() || { open: false, settled: false }));
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'raceBets'), (snap) => {
      setAllBets(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);
  const myBet = userData ? allBets.find(b => b.username === userData.username) : null;

  // 下注／加注（自由投注：可押多隊、可重複加碼，封盤前皆可）
  const placeBet = async (team, rawAmount) => {
    const amount = Math.floor(Number(rawAmount));
    if (!amount || amount <= 0) return showMsg('請輸入有效的下注金額', 'warn');
    if (userData.isDemo) return showMsg('試玩／預覽模式無法下注，請用正式玩家帳號參與', 'warn');
    if (!bettingMeta.open || bettingMeta.settled) return showMsg('賭盤目前未開放下注', 'warn');
    if (userData.coins < amount) return showMsg('購物金不足', 'warn');
    setUserData(prev => ({ ...prev, coins: prev.coins - amount }));
    try {
      await setDoc(doc(db, 'raceBets', userData.username), {
        bets: { [String(team.id)]: fsIncrement(amount) },
        names: { [String(team.id)]: team.name },
        paid: false, updatedAt: Timestamp.now(),
      }, { merge: true });
      await updateDoc(doc(db, 'players', userData.username), { coins: fsIncrement(-amount) });
      showMsg(`下注成功！$${amount} 押「${team.name}」，封盤前都能繼續加碼`, 'success');
    } catch (e) {
      setUserData(prev => ({ ...prev, coins: prev.coins + amount }));
      showMsg('下注失敗，請再試一次', 'warn');
    }
  };

  // 當 booths 更新時，同步更新打開中的攤位詳情頁
  useEffect(() => {
    if (selectedBooth) {
      const fresh = booths.find(b => b.id === selectedBooth.id);
      if (fresh) setSelectedBooth(fresh);
    }
  }, [booths]);

  // 龍舟賽況（RTDB 即時同步）
  useEffect(() => {
    const raceRef = ref(rtdb, 'race');
    const unsub = onValue(raceRef, (snapshot) => {
      const data = snapshot.val();
      setRaceLoading(false);
      if (!data) { setRaceTeams([]); return; }
      const teams = Object.entries(data).map(([key, t]) => ({
        id: key,
        name: t.name || '',
        color: t.color || '',
        flagImageUrl: t.flagImageUrl || '',
        outboundScore: Number(t.outboundScore) || 0,
        inboundScore: Number(t.inboundScore) || 0,
        turnSuccess: t.turnSuccess === true || t.turnSuccess === 'true',
        cheers: Number(t.cheers) || 0,
        lastRolls: t.lastRolls ? String(t.lastRolls).split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : [],
        lastEvent: t.lastEvent || null,   // ★ 本輪事件
      }));
      setRaceTeams(teams);
    });
    return () => unsub();
  }, []);

  // 載入排行榜
  const loadLeaderboard = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'players'));
      const players = snap.docs.map(d => {
        const data = d.data() || {};
        return {
          username: d.id,
          coins: Number(data.coins) || 0,
          stamps: Array.isArray(data.stamps) ? data.stamps : [],
          inventory: Array.isArray(data.inventory) ? data.inventory : [],
        };
      });
      players.sort((a, b) => b.stamps.length - a.stamps.length || a.username.localeCompare(b.username));
      setLeaderboard(players);
    } catch (err) { console.warn('排行榜載入失敗:', err); }
  }, []);

  // 載入集章名單
  const loadCollectors = useCallback(async (boothId) => {
    try {
      const q = query(collection(db, 'stampLogs'), where('boothId', '==', boothId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data().username);
      setCollectors([...new Set(list)]);
    } catch (err) { console.warn('集章名單載入失敗:', err); }
  }, []);

  // 註冊
  const handleRegister = async () => {
    if (!inputName.trim() || inputPin.length < 4) return showMsg('請輸入暱稱和至少4位數的密碼！', 'warn');
    setLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
      let initCoins = gameConfig.initialCoins;
      if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        if (s.registrationOpen === false) {
          return showMsg(s.registrationClosedMsg || '目前尚未開放新玩家登記', 'warn');
        }
        if (Number(s.initialCoins) > 0) initCoins = Number(s.initialCoins);
      }
      const username = inputName.trim();
      const pin = inputPin.trim();
      const existing = await getDoc(doc(db, 'players', username));
      if (existing.exists()) return showMsg('此名稱已有人使用', 'warn');
      const newPlayer = { pin, coins: initCoins, inventory: [], stamps: [], createdAt: Timestamp.now() };
      await setDoc(doc(db, 'players', username), newPlayer);
      setUserData({ username, ...newPlayer, stamps: [], inventory: [] });
      setView('home');
      loadBoothsFromCloud();
      showMsg(`歡迎來到慶典，${username}！`, 'success');
    } catch (err) {
      showMsg('註冊失敗，請檢查網路', 'warn');
    } finally { setLoading(false); }
  };

  // 登入
  const handleLogin = async () => {
    if (!inputName.trim() || !inputPin.trim()) return showMsg('請輸入暱稱和密碼！', 'warn');
    setLoading(true);
    try {
      const username = inputName.trim();
      const snap = await getDoc(doc(db, 'players', username));
      if (!snap.exists()) return showMsg('查無此暱稱', 'warn');
      const data = snap.data();
      if (data.pin !== inputPin.trim()) return showMsg('密碼不正確', 'warn');
      setUserData({ username, ...data, stamps: data.stamps || [], inventory: data.inventory || [] });
      setView('home');
      loadBoothsFromCloud();
      showMsg(`歡迎回來，${username}！`, 'success');
    } catch (err) {
      showMsg('登入失敗，請檢查網路', 'warn');
    } finally { setLoading(false); }
  };

  // 試玩
  const handleDemoLogin = () => {
    const name = `旅人_${Math.floor(Math.random() * 10000)}`;
    setBooths(DEFAULT_BOOTHS);
    setUserData({
      username: name, pin: '0000', coins: 888,
      inventory: [{ id: 'demo-1', name: '歡迎禮包', price: 0, boothName: '系統贈送', description: '試玩模式贈品，正式活動會有攤位的真實商品', imageUrl: '', date: new Date().toLocaleDateString(), stackRotation: 3 }],
      stamps: ['booth-demo-1'], createdAt: new Date().toISOString(), isDemo: true
    });
    setView('home');
    showMsg(`試玩模式啟動！（資料不會存入雲端）`, 'success');
  };

  const handleLogout = () => {
    setUserData(null); setView('entry'); setInputName(''); setInputPin(''); setIsLoginMode(true);
    showMsg('已安全登出。');
  };

  // 開啟攤位
  const openBooth = (booth) => {
    setSelectedBooth(booth);
    setCollectors([]);
    setView('booth');
    if (!userData?.isDemo) loadCollectors(booth.id);
  };
  const closeBooth = () => { setView('home'); setSelectedBooth(null); };

  // 手動刷新攤位資料
  const [refreshing, setRefreshing] = useState(false);
  const refreshBooths = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const boothSnap = await getDocs(collection(db, 'booths'));
      if (!boothSnap.empty) {
        const boothsData = [];
        for (const boothDoc of boothSnap.docs) {
          const b = boothDoc.data();
          const itemSnap = await getDocs(collection(db, 'booths', boothDoc.id, 'items'));
          const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          boothsData.push({ id: boothDoc.id, ...b, stamp: { imageUrl: b.stampImageUrl || '' }, items });
        }
        const stampSnap = await getDocs(collection(db, 'stampLogs'));
        const stampCount = {};
        stampSnap.docs.forEach(d => { const bid = d.data().boothId; stampCount[bid] = (stampCount[bid] || 0) + 1; });
        const playerSnap = await getDocs(collection(db, 'players'));
        const salesByBooth = {};
        playerSnap.docs.forEach(d => {
          (d.data().inventory || []).forEach(item => {
            const bid = item.boothId || '';
            if (!bid) return;
            if (!salesByBooth[bid]) salesByBooth[bid] = { revenue: 0, count: 0 };
            salesByBooth[bid].revenue += Number(item.price) || 0;
            salesByBooth[bid].count += 1;
          });
        });
        boothsData.forEach(b => { b.stats = { stampCount: stampCount[b.id] || 0, salesCount: (salesByBooth[b.id] || {}).count || 0, salesRevenue: (salesByBooth[b.id] || {}).revenue || 0 }; });
        setBooths(boothsData);
        showMsg('攤位資訊已更新', 'success');
      }
    } catch (err) {
      showMsg('刷新失敗', 'warn');
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  // 購買
  const buyItem = async (booth, item) => {
    if (userData.coins < item.price) return showMsg('購物金不足喔！', 'warn');

    const newItem = { ...item, boothId: booth.id, boothName: booth.name, date: new Date().toLocaleDateString(), stackRotation: Math.floor(Math.random() * 10) - 5 };
    const optimistic = { ...userData, coins: userData.coins - item.price, inventory: [...userData.inventory, newItem] };
    setUserData(optimistic);
    showMsg(`成功購買 ${item.name}！已丟進購物袋`, 'success');

    if (!userData.isDemo) {
      try {
        await updateDoc(doc(db, 'players', userData.username), {
          coins: fsIncrement(-item.price),
          inventory: arrayUnion({
            id: item.id + '_' + Date.now(),
            name: item.name,
            price: item.price,
            boothId: booth.id,
            boothName: booth.name,
            description: item.description || '',
            imageUrl: item.imageUrl || '',
            date: new Date().toLocaleDateString(),
            stackRotation: Math.floor(Math.random() * 10) - 5
          })
        });
        const snap = await getDoc(doc(db, 'players', userData.username));
        if (snap.exists()) {
          const d = snap.data();
          setUserData(prev => ({ ...prev, coins: d.coins, inventory: d.inventory || [] }));
        }
      } catch (err) { console.warn('購買同步失敗:', err); }
    }
  };

  // 集章
  const collectStamp = async (boothId) => {
    if (userData.stamps.includes(boothId)) return showMsg('這個章你已經領過囉！');

    const reward = gameConfig.stampReward;
    const optimistic = { ...userData, coins: userData.coins + reward, stamps: [...userData.stamps, boothId] };
    setUserData(optimistic);
    const booth = booths.find(b => b.id === boothId) || selectedBooth;
    if (booth) {
      setStampReveal({
        boothName: booth.name,
        boothEmoji: booth.emoji,
        stamp: booth.stamp || { imageUrl: booth.stampImageUrl || '' },
        reward,
      });
    }

    if (!userData.isDemo) {
      try {
        await updateDoc(doc(db, 'players', userData.username), {
          coins: fsIncrement(reward),
          stamps: arrayUnion(boothId)
        });
        await addDoc(collection(db, 'stampLogs'), {
          boothId,
          username: userData.username,
          timestamp: Timestamp.now()
        });
        const snap = await getDoc(doc(db, 'players', userData.username));
        if (snap.exists()) {
          const d = snap.data();
          setUserData(prev => ({ ...prev, coins: d.coins, stamps: d.stamps || [] }));
        }
        loadCollectors(boothId);
      } catch (err) { console.warn('集章同步失敗:', err); }
    }
  };

  // 管理員浮動按鈕
  const adminFloatingBtn = (adminUser && view !== 'admin') ? (
    <button onClick={() => setView('admin')} style={{
      position: 'fixed', bottom: 100, right: 16, zIndex: 999,
      padding: '10px 16px', clipPath: CUT(8),
      background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
      color: '#fff', fontSize: 11, fontWeight: 800,
      border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6
    }}><Icon name="lock" size={13} color="#fff" /> 回管理後台</button>
  ) : null;

  // 管理員後台
  if (view === 'admin' && adminUser) return (
    <AdminPanel
      adminUser={adminUser}
      onLogout={async (mode) => {
        if (mode === 'preview') {
          const name = '管理員預覽';
          setUserData({ username: name, pin: '0000', coins: 9999, inventory: [], stamps: [], isDemo: true });
          setView('home');
          loadBoothsFromCloud();   // 重新抓雲端攤位，避免殘留試玩假資料
        } else {
          await signOut(auth); setAdminUser(null); setUserData(null); setView('entry');
        }
      }}
      db={db}
      rtdb={rtdb}
    />
  );

  // 賭盤顯示資料（純試玩用示範資料，其餘皆真實）
  const usingMockRace = !!(userData && userData.isDemo && raceTeams.length === 0);
  const betTeams = usingMockRace ? MOCK_RACE_TEAMS : raceTeams;
  const betList = usingMockRace ? MOCK_BETS : allBets;
  const betMetaShow = usingMockRace ? { open: true, settled: false } : bettingMeta;
  const showBetting = usingMockRace || raceTeams.length > 0;

  // --- 入口畫面 ---
  if (view === 'entry' || !userData) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative', background: 'linear-gradient(160deg, #0f2922 0%, #134e3a 55%, #10303c 100%)' }}>
      {/* 背景格線（官網感） */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'linear-gradient(rgba(167,215,195,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(167,215,195,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(234,179,8,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />

      <div style={{ maxWidth: 380, width: '100%', position: 'relative', zIndex: 10, animation: 'fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ width: 74, height: 74, margin: '0 auto 16px', background: 'linear-gradient(135deg, #fbbf24, #d97706)', clipPath: CUT(14), display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(2deg)' }}>
            <Icon name="boat" size={40} color="#123f30" sw={1.9} />
          </div>
          <h1 style={{ fontFamily: '"Noto Serif TC", Georgia, serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>端午盛夏慶典</h1>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(167,215,195,0.55)', letterSpacing: 5, textTransform: 'uppercase', marginTop: 6 }}>— Dragon Boat Festival —</p>
        </div>

        <div style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(167,215,195,0.22)', clipPath: CUT(16), padding: '28px 24px' }}>
          <Corners color="rgba(167,215,195,0.6)" size={12} inset={4} />
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', clipPath: CUT(8), padding: 3, marginBottom: 20 }}>
            {['新玩家登記', '讀取舊檔'].map((label, i) => {
              const active = i === (isLoginMode ? 1 : 0);
              return (<button key={i} onClick={() => setIsLoginMode(i === 1)} style={{ flex: 1, padding: '10px 0', clipPath: CUT(6), fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.3s', background: active ? 'rgba(255,255,255,0.95)' : 'transparent', color: active ? '#134e3a' : 'rgba(167,215,195,0.5)' }}>{label}</button>);
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,215,195,0.7)', marginLeft: 4, letterSpacing: 2 }}>角色暱稱</label>
              <input type="text" maxLength={12} value={inputName} onChange={e => setInputName(e.target.value)} placeholder="請輸入暱稱"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '14px 16px', background: 'rgba(0,20,15,0.45)', border: '1px solid rgba(16,185,129,0.25)', clipPath: CUT(8), color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,215,195,0.7)', marginLeft: 4, letterSpacing: 2 }}>通行密碼</label>
              <input type="password" maxLength={8} value={inputPin} onChange={e => setInputPin(e.target.value)} placeholder={isLoginMode ? '輸入密碼' : '設定4位數以上密碼'}
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '14px 16px', background: 'rgba(0,20,15,0.45)', border: '1px solid rgba(16,185,129,0.25)', clipPath: CUT(8), color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', letterSpacing: 4 }} />
            </div>
          </div>

          <button onClick={isLoginMode ? handleLogin : handleRegister} disabled={loading}
            style={{ width: '100%', marginTop: 20, padding: '16px 0', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#134e3a', fontSize: 15, fontWeight: 900, border: 'none', clipPath: CUT(10), cursor: loading ? 'wait' : 'pointer', letterSpacing: 2 }}>
            {loading ? '處理中...' : isLoginMode ? '登入慶典 →' : '開始冒險 →'}
          </button>

          <button onClick={handleDemoLogin} style={{ width: '100%', marginTop: 10, padding: '13px 0', background: 'rgba(16,185,129,0.12)', color: 'rgba(167,215,195,0.85)', fontSize: 13, fontWeight: 700, border: '1px solid rgba(16,185,129,0.25)', clipPath: CUT(10), cursor: 'pointer' }}>
            快速試玩（Demo）
          </button>

          <button onClick={() => {
            signInWithPopup(auth, googleProvider).then((result) => {
              if (result.user && result.user.uid === ADMIN_UID) { setAdminUser(result.user); setView('admin'); }
              else if (result.user) { signOut(auth); showMsg('此帳號沒有管理員權限', 'warn'); }
            }).catch((err) => {
              console.error('Admin login error:', err);
              alert('登入錯誤: ' + err.code + ' - ' + err.message);
            });
          }} style={{ width: '100%', marginTop: 8, padding: '10px 0', background: 'transparent', color: 'rgba(167,215,195,0.35)', fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)', clipPath: CUT(6), cursor: 'pointer', letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="lock" size={11} /> 管理員入口
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Noto Sans TC',-apple-system,sans-serif; }
        ::placeholder { color: rgba(167,215,195,0.35); }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );

  // ============================================================
  // 主畫面
  // ============================================================
  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: '"Noto Sans TC",-apple-system,sans-serif', paddingBottom: 88, overflow: 'hidden', color: C.ink }}>
      {adminFloatingBtn}
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(253,252,246,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.line}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${C.teal}, ${C.ink})`, clipPath: CUT(9), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="boat" size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1, fontFamily: '"Noto Serif TC", serif', letterSpacing: 2 }}>河道慶典街</h1>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.teal, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{userData.username} {userData.isDemo ? '(試玩)' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, background: C.goldBg, padding: '8px 14px', clipPath: CUT(8), border: `1px solid rgba(183,121,31,0.35)` }}>
            <Icon name="coin" size={15} color={C.gold} />
            <span style={{ fontWeight: 900, color: '#8a5a12', fontSize: 14, fontFamily: 'monospace' }}>{userData.coins}</span>
          </div>
          <button onClick={handleLogout} title="登出" style={{ width: 36, height: 36, clipPath: CUT(8), border: `1px solid ${C.line}`, background: C.paper, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="logout" size={16} color={C.ink} />
          </button>
        </div>
      </header>

      {/* Toast */}
      {message && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: message.type === 'success' ? '#0f3d2e' : message.type === 'warn' ? '#7c3a12' : '#1e293b', color: '#fff', padding: '12px 22px', clipPath: CUT(10), fontSize: 12, fontWeight: 700, animation: 'fadeSlideDown 0.3s ease-out', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '90vw' }}>
          <Icon name={message.type === 'success' ? 'check' : 'spark'} size={13} color="#fff" /> {message.text}
        </div>
      )}

      {/* 集章成功確認卡 */}
      {stampReveal && (
        <div onClick={() => setStampReveal(null)} style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(15,41,34,0.78)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', animation: 'fadeIn 0.25s ease-out', padding: 24
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', width: '100%', maxWidth: 320,
            background: `linear-gradient(165deg, ${C.paper}, #fbf5e4)`,
            clipPath: CUT(18), padding: '34px 26px 26px',
            textAlign: 'center', cursor: 'default',
            animation: 'stampCardIn 0.5s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden'
          }}>
            <Corners color={C.gold} size={14} inset={6} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
            {[0, 1, 2, 3].map(i => (
              <span key={i} style={{ position: 'absolute', top: `${14 + (i % 2) * 8}%`, left: `${12 + i * 24}%`, animation: `stampCelebrate 2s ease-in-out ${i * 0.25}s infinite`, opacity: 0.55, pointerEvents: 'none' }}>
                <Icon name={i % 2 ? 'spark' : 'stamp'} size={15} color={C.gold} />
              </span>
            ))}

            <p style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 4, position: 'relative', zIndex: 2 }}>STAMP GET</p>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#8a5a12', marginBottom: 20, position: 'relative', zIndex: 2, fontFamily: '"Noto Serif TC", serif', letterSpacing: 2 }}>集章成功・獲得新印章</p>

            <div style={{ display: 'inline-block', marginBottom: 18, animation: 'stampPress 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both', position: 'relative', zIndex: 2 }}>
              <StampDesign stamp={stampReveal.stamp} size={140} stamped={true} boothEmoji={stampReveal.boothEmoji} />
            </div>

            <div style={{ position: 'relative', background: 'rgba(13,148,136,0.07)', clipPath: CUT(8), border: `1px solid ${C.tealDim}`, padding: '10px 16px', marginBottom: 12, zIndex: 2 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: C.teal, letterSpacing: 2, marginBottom: 2 }}>來自攤位</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: '"Noto Serif TC", serif' }}>{stampReveal.boothName}</p>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.goldBg, padding: '8px 18px', clipPath: CUT(8), marginBottom: 20, border: '1px solid rgba(183,121,31,0.3)', position: 'relative', zIndex: 2 }}>
              <Icon name="coin" size={15} color={C.gold} />
              <span style={{ fontSize: 15, fontWeight: 900, color: '#8a5a12', fontFamily: 'monospace' }}>+{stampReveal.reward}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8a5a12' }}>購物金</span>
            </div>

            <button onClick={() => setStampReveal(null)} style={{ width: '100%', padding: '14px 0', background: `linear-gradient(135deg, ${C.teal}, ${C.ink})`, color: '#fff', fontSize: 14, fontWeight: 900, border: 'none', clipPath: CUT(10), cursor: 'pointer', letterSpacing: 2, position: 'relative', zIndex: 2 }}>
              收下印章 ✓
            </button>
          </div>
        </div>
      )}

      {/* 旗幟放大檢視 */}
      {zoomFlagUrl && (
        <div onClick={() => setZoomFlagUrl(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(10,25,20,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ position: 'relative', animation: 'zoomIn 0.3s cubic-bezier(0.16,1,0.3,1)' }} onClick={e => e.stopPropagation()}>
            <img src={zoomFlagUrl} alt="隊伍旗幟"
              style={{ maxWidth: '85vw', maxHeight: '75vh', clipPath: CUT(14), border: '2px solid rgba(255,255,255,0.25)', objectFit: 'contain', background: '#fff' }} />
            <button onClick={() => setZoomFlagUrl(null)} style={{
              position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.75)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}><Icon name="close" size={13} color="#fff" /></button>
          </div>
        </div>
      )}

      <main style={{ height: 'calc(100vh - 152px)', position: 'relative' }}>
        {/* HOME */}
        {view === 'home' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: isMobileApp ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: `linear-gradient(${C.tealDim} 1px, transparent 1px), linear-gradient(90deg, ${C.tealDim} 1px, transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />

            {boothsLoading ? (
              <div style={{ flexShrink: 0, padding: '12px', display: 'flex', gap: 10, justifyContent: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 100, height: 100, clipPath: CUT(12), background: 'linear-gradient(90deg, #ece8d9 25%, #e3ddc9 50%, #ece8d9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                ))}
              </div>
            ) : booths.length === 0 ? (
              <div style={{ flexShrink: 0, padding: '20px 12px', textAlign: 'center' }}>
                <Icon name="lantern" size={30} color={C.teal} style={{ margin: '0 auto' }} />
                <p style={{ fontSize: 12, fontWeight: 800, color: C.teal, marginTop: 6 }}>攤位籌備中</p>
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>攤主們正在報名，敬請期待！</p>
              </div>
            ) : (
              <BoothPillRow booths={booths.filter(b => b.side === 'top')} stamps={userData.stamps} onOpen={openBooth} side="top" />
            )}

            {/* 河道賽況 */}
            <div style={{ flex: isMobileApp ? '0 0 auto' : 1, minHeight: 0, zIndex: 5, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <TechDivider />
              <div style={{ flex: isMobileApp ? '0 0 auto' : 1, minHeight: 0, overflow: isMobileApp ? 'visible' : 'hidden' }}>
                <RiverRaceTracker teams={userData.isDemo && raceTeams.length === 0 ? MOCK_RACE_TEAMS : raceTeams} onFlagClick={setZoomFlagUrl} isDemo={userData.isDemo} mockData={userData.isDemo && raceTeams.length === 0} loading={raceLoading && !userData.isDemo} />
              </div>
              <TechDivider flip />
            </div>

            {/* 賠率跑馬燈（點了進賭盤） */}
            {showBetting && (betMetaShow.open || betMetaShow.settled || betList.length > 0) && (
              <OddsMarquee teams={betTeams} bets={betList} meta={betMetaShow} onOpen={() => setView('betting')} />
            )}

            {!boothsLoading && (
              <BoothPillRow booths={booths.filter(b => b.side === 'bottom')} stamps={userData.stamps} onOpen={openBooth} side="bottom"
                extra={showBetting ? <BettingTentCard open={betMetaShow.open && !betMetaShow.settled} onOpen={() => setView('betting')} /> : null} />
            )}
          </div>
        )}

        {/* BOOTH DETAIL */}
        {view === 'booth' && selectedBooth && (
          <div style={{ height: '100%', overflowY: 'auto', background: C.paper, animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ position: 'relative', height: 200, background: `linear-gradient(135deg, ${C.ink}, #0f2922)`, display: 'flex', alignItems: 'flex-end', padding: 28, overflow: 'hidden' }}>
              {selectedBooth.facadeImageUrl && <img src={selectedBooth.facadeImageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
              <button onClick={closeBooth} style={{ position: 'absolute', top: 20, left: 20, width: 44, height: 44, clipPath: CUT(10), background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                <Icon name="chevL" size={20} color="#fff" />
              </button>
              <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 3 }}><HexTag bg="rgba(255,255,255,0.12)" color="#fff">攤</HexTag></div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>BOOTH / 攤位</p>
                <h2 style={{ fontSize: 27, fontWeight: 900, color: '#fff', fontFamily: '"Noto Serif TC", serif', letterSpacing: 1 }}>{selectedBooth.emoji ? selectedBooth.emoji + ' ' : ''}{selectedBooth.name}</h2>
                {selectedBooth.ownerName && (
                  <p style={{ marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', clipPath: CUT(6), padding: '4px 12px', letterSpacing: 1 }}>
                    <Icon name="user" size={12} color="rgba(255,255,255,0.9)" /> 攤主：{selectedBooth.ownerName}
                  </p>
                )}
              </div>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.9, color: '#4b5f56', marginBottom: 24 }}>{selectedBooth.description}</p>

              {/* 攤位即時統計 */}
              {selectedBooth.stats && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase' }}>／ 即時統計</span>
                    <button onClick={refreshBooths} disabled={refreshing} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', clipPath: CUT(6),
                      background: refreshing ? '#eee9da' : C.paper, border: `1px solid ${C.line}`,
                      fontSize: 10, fontWeight: 700, color: '#4b5f56', cursor: refreshing ? 'wait' : 'pointer',
                    }}>
                      <span style={{ display: 'inline-block', transition: 'transform 0.6s', transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)' }}><Icon name="refresh" size={11} /></span>
                      {refreshing ? '更新中' : '刷新'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { icon: 'stamp', val: selectedBooth.stats.stampCount, label: '集章人次', col: C.gold, bg: C.goldBg, bd: 'rgba(183,121,31,0.3)' },
                      { icon: 'bag', val: selectedBooth.stats.salesCount, label: '銷售件數', col: '#1d4ed8', bg: '#e4edfb', bd: 'rgba(29,78,216,0.25)' },
                      { icon: 'coin', val: '$' + selectedBooth.stats.salesRevenue, label: '銷售總額', col: '#0f766e', bg: '#e2f3ef', bd: 'rgba(15,118,110,0.25)' },
                    ].map((s, i) => (
                      <div key={i} style={{ position: 'relative', flex: 1, padding: '14px 8px', background: s.bg, clipPath: CUT(10), textAlign: 'center', border: `1px solid ${s.bd}` }}>
                        <Icon name={s.icon} size={17} color={s.col} style={{ margin: '0 auto' }} />
                        <div style={{ fontSize: 19, fontWeight: 900, color: s.col, fontFamily: 'monospace', lineHeight: 1.2, marginTop: 4 }}>{s.val}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: s.col, letterSpacing: 1, marginTop: 2, opacity: 0.8 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <a href={selectedBooth.plurkUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '16px 0', background: `linear-gradient(135deg, ${C.teal}, ${C.ink})`, color: '#fff', clipPath: CUT(10), fontWeight: 800, fontSize: 14, textDecoration: 'none', letterSpacing: 2 }}>
                前往噗浪互動 <Icon name="external" size={13} color="#fff" />
              </a>

              <div style={{ position: 'relative', margin: '24px 0', padding: 20, background: 'rgba(13,148,136,0.05)', clipPath: CUT(12), border: `1px solid ${C.tealDim}` }}>
                <Corners size={9} inset={4} />
                <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>／ 集章任務</p>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.8 }}>{selectedBooth.task}</p>
              </div>

              {/* 商品列表 */}
              <p style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, marginTop: 28 }}>／ 商品列表</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(selectedBooth.items || []).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: C.paper, clipPath: CUT(12), border: `1px solid ${C.line}` }}>
                    <div style={{ width: 56, height: 56, clipPath: CUT(10), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, overflow: 'hidden', background: 'rgba(13,148,136,0.06)', border: `1px solid ${C.tealDim}` }}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = selectedBooth.emoji || '·'; }} /> : (selectedBooth.emoji || <Icon name="gift" size={24} color={C.teal} />)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{item.name}</h4>
                      <p style={{ fontSize: 11, color: '#8a9a90' }}>{item.description}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 900, color: C.teal, fontSize: 16, fontFamily: 'monospace' }}>${item.price}</p>
                      <button onClick={() => buyItem(selectedBooth, item)} style={{ marginTop: 4, padding: '6px 16px', background: C.ink, color: '#fff', border: 'none', clipPath: CUT(6), fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>購買</button>
                    </div>
                  </div>
                ))}
                {(selectedBooth.items || []).length === 0 && <p style={{ fontSize: 12, color: '#8a9a90', textAlign: 'center', padding: '12px 0' }}>本攤沒有販售商品，純互動集章</p>}
              </div>

              {/* 印章區 */}
              <div style={{ position: 'relative', marginTop: 28, padding: 24, background: C.paper, clipPath: CUT(14), border: `1px solid ${C.line}`, textAlign: 'center' }}>
                <Corners size={10} inset={5} color={C.line} />
                <p style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>／ 本攤印章</p>
                <div style={{ display: 'inline-block', transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)', transform: userData.stamps.includes(selectedBooth.id) ? 'rotate(6deg) scale(1)' : 'rotate(0deg) scale(0.92)', opacity: userData.stamps.includes(selectedBooth.id) ? 1 : 0.4, filter: userData.stamps.includes(selectedBooth.id) ? 'none' : 'grayscale(1)', marginBottom: 16 }}>
                  <StampDesign stamp={selectedBooth.stamp} size={100} stamped={true} boothEmoji={selectedBooth.emoji} />
                </div>
                {selectedBooth.stampHint && (
                  <p style={{ fontSize: 11, color: '#8a5a12', background: 'rgba(183,121,31,0.07)', border: '1px dashed rgba(183,121,31,0.4)', clipPath: CUT(8), padding: '10px 14px', marginBottom: 16, lineHeight: 1.8, fontWeight: 600, textAlign: 'left' }}>
                    {selectedBooth.stampHint}
                  </p>
                )}
                <button disabled={userData.stamps.includes(selectedBooth.id)} onClick={() => collectStamp(selectedBooth.id)}
                  style={{ width: '100%', padding: '16px 0', clipPath: CUT(10), fontSize: 15, fontWeight: 900, border: 'none', cursor: userData.stamps.includes(selectedBooth.id) ? 'default' : 'pointer', background: userData.stamps.includes(selectedBooth.id) ? '#e8e3d4' : 'linear-gradient(135deg, #fbbf24, #d97706)', color: userData.stamps.includes(selectedBooth.id) ? '#a3a091' : '#451a03', letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name={userData.stamps.includes(selectedBooth.id) ? 'check' : 'stamp'} size={16} />
                  {userData.stamps.includes(selectedBooth.id) ? '已集章' : '領取印章與金幣'}
                </button>
              </div>

              <CollectorsList collectors={collectors} currentUser={userData.username} isStamped={userData.stamps.includes(selectedBooth.id)} />
            </div>
          </div>
        )}

        {/* BETTING：龍舟賭盤 */}
        {view === 'betting' && (
          <BettingBooth teams={betTeams} bets={betList} meta={betMetaShow} myBet={myBet}
            coins={userData.coins} isDemo={userData.isDemo} onBet={placeBet} onBack={() => setView('home')} />
        )}

        {/* INVENTORY：物理購物袋 */}
        {view === 'inventory' && (
          <PhysicsBag inventory={userData.inventory} booths={booths} />
        )}

        {/* STAMPS：翻頁集章冊 + 排行榜 */}
        {view === 'stamps' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 40px', animation: 'fadeSlideUp 0.5s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <HexTag bg={C.ink} color="#fff" size={30}>章</HexTag>
              <h2 style={{ fontSize: 26, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', letterSpacing: 3 }}>集章紀念冊</h2>
            </div>

            <StampBook booths={booths} stamps={userData.stamps} />

            {/* 進度 */}
            <div style={{ position: 'relative', background: C.paper, clipPath: CUT(12), border: `1px solid ${C.line}`, padding: '16px 20px', margin: '18px 0 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 2 }}>／ 我的進度</span>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace' }}>{userData.stamps.length} / {booths.length}</span>
              </div>
              <div style={{ height: 6, background: '#ece8d9', position: 'relative' }}>
                <div style={{ height: '100%', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)', width: `${(userData.stamps.length / (booths.length || 1)) * 100}%`, background: booths.length > 0 && userData.stamps.length === booths.length ? `linear-gradient(90deg, #fbbf24, ${C.gold})` : `linear-gradient(90deg, ${C.teal}, ${C.ink})` }} />
              </div>
              {userData.stamps.length === booths.length && booths.length > 0 && (
                <div style={{ position: 'relative', textAlign: 'center', marginTop: 14, padding: '18px', background: C.goldBg, clipPath: CUT(12), border: '1.5px solid rgba(183,121,31,0.4)', overflow: 'hidden', animation: 'eggPop 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <span key={i} style={{ position: 'absolute', left: `${10 + i * 19}%`, top: '50%', animation: `eggFloat 2.5s ease-in-out ${i * 0.3}s infinite`, opacity: 0.6, pointerEvents: 'none' }}>
                      <Icon name={['boat', 'spark', 'lantern', 'medal', 'stamp'][i]} size={17} color={C.gold} />
                    </span>
                  ))}
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <Icon name="trophy" size={34} color="#8a5a12" style={{ margin: '0 auto 4px', animation: 'eggBounce 1.5s ease-in-out infinite' }} />
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#8a5a12', fontFamily: '"Noto Serif TC", serif' }}>大功告成！</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#a16207', marginTop: 4 }}>你已蒐集全部 {booths.length} 個印章，是慶典的完美旅人！</p>
                  </div>
                </div>
              )}
            </div>

            <Leaderboard booths={booths} leaderboard={leaderboard} currentUser={userData.username} currentUserStamps={userData.stamps} onRefresh={loadLeaderboard} isDemo={userData.isDemo} />
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(253,252,246,0.95)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.line}`, padding: '8px 32px 20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
        {[
          { id: 'home', icon: 'map', label: '街道' },
          { id: 'inventory', icon: 'bag', label: '購物袋' },
          { id: 'stamps', icon: 'book', label: '集章' }
        ].map(item => {
          const active = view === item.id || (view === 'booth' && item.id === 'home');
          return (
            <button key={item.id} onClick={() => { if (item.id === 'stamps' && !userData.isDemo) loadLeaderboard(); if (view === 'booth' && item.id === 'home') closeBooth(); else setView(item.id); }}
              onMouseEnter={() => setHoveredNav(item.id)} onMouseLeave={() => setHoveredNav(null)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: active ? C.teal : '#b3ae9d', transition: 'all 0.3s', transform: active ? 'scale(1.08)' : hoveredNav === item.id ? 'scale(1.04)' : 'scale(1)' }}>
              <Icon name={item.icon} size={22} sw={active ? 1.9 : 1.6} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', opacity: active ? 1 : 0.5 }}>{item.label}</span>
              <div style={{ width: 14, height: 2, background: active ? C.teal : 'transparent', marginTop: 1 }} />
            </button>
          );
        })}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Noto Sans TC',-apple-system,sans-serif; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { display:none; }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideDown { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes zoomIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes stampCardIn { 0%{opacity:0;transform:translateY(30px) scale(0.9)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes stampPress { 0%{transform:scale(2.2) rotate(-12deg);opacity:0} 60%{transform:scale(0.92) rotate(4deg);opacity:1} 100%{transform:scale(1) rotate(0deg)} }
        @keyframes stampCelebrate { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(12deg)} }
        @keyframes eggPop { 0%{opacity:0;transform:scale(0.8)} 100%{opacity:1;transform:scale(1)} }
        @keyframes eggFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-16px) rotate(10deg)} }
        @keyframes eggBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes flipNext { 0%{transform:perspective(1200px) rotateY(-72deg);opacity:0.3} 100%{transform:perspective(1200px) rotateY(0deg);opacity:1} }
        @keyframes flipPrev { 0%{transform:perspective(1200px) rotateY(72deg);opacity:0.3} 100%{transform:perspective(1200px) rotateY(0deg);opacity:1} }
        @keyframes eventPop { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes cheerFloat { 0%{opacity:1;transform:translateY(0) scale(0.7)} 25%{transform:translateY(-14px) scale(1.15)} 100%{opacity:0;transform:translateY(-62px) scale(1.25)} }
        @keyframes boatRock { 0%,100%{transform:rotate(-8deg) translateY(0)} 50%{transform:rotate(8deg) translateY(-4px)} }
        .riverWater { background-image: radial-gradient(circle at 10px -5px, transparent 8px, rgba(255,255,255,0.5) 8.5px, transparent 10.5px); background-size: 22px 11px; animation: waterFlow 2.8s linear infinite; pointer-events: none; }
        @keyframes waterFlow { from{background-position:0 0} to{background-position:-44px 0} }
        @keyframes marqueeScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes bagDrop { 0%{transform:translateY(-440px) rotate(-6deg);opacity:0} 10%{opacity:1} 80%{transform:translateY(7px) rotate(1deg)} 100%{transform:translateY(0) rotate(0)} }
      `}</style>
    </div>
  );
}

// ============================================================
// 茄芷袋購物袋（改版：無物理碰撞）
// 商品購買後會「掉進」袋子排整齊，玩家可自由拖曳擺到喜歡的位置
// 點一下商品（不拖動）會開啟商品小卡
// ============================================================
function PhysicsBag({ inventory, booths }) {
  const areaRef = useRef(null);
  const dragRef = useRef(null);
  const posRef = useRef({});                 // 記住玩家擺放的位置（本次瀏覽期間）
  const [placed, setPlaced] = useState([]);  // {key, item, x, y, rot, delay, hasSaved}
  const [detail, setDetail] = useState(null);
  const [dropKey, setDropKey] = useState(0);

  const BODY = 92;
  const NAVY = '#1e3a8a';
  const totalSpent = inventory.reduce((s, it) => s + (Number(it.price) || 0), 0);
  const findEmoji = (item) => (booths.find(b => b.id === item.boothId || b.name === item.boothName) || {}).emoji || '';

  // 預設落點：由袋底往上、逐排置中排整齊
  useEffect(() => {
    const area = areaRef.current;
    const W = area ? area.clientWidth : 320;
    const H = area ? area.clientHeight : 360;
    const cols = Math.max(1, Math.floor((W - 12) / (BODY - 4)));
    setPlaced(inventory.map((item, i) => {
      const key = String(item.id ?? 'it') + '_' + i;
      const col = i % cols, row = Math.floor(i / cols);
      const rowCount = Math.min(inventory.length - row * cols, cols);
      const startX = Math.max(6, (W - rowCount * (BODY - 4)) / 2) + (BODY - 4) / 2;
      const def = {
        x: startX + col * (BODY - 4),
        y: Math.max(BODY / 2, H - 10 - BODY / 2 - row * (BODY - 14)),
      };
      const saved = posRef.current[key];
      return { key, item, rot: ((i * 53) % 11) - 5, delay: i * 0.13, hasSaved: !!saved, ...(saved || def) };
    }));
  }, [inventory, dropKey]);

  // 拖曳（滑鼠/觸控通用）；移動距離很小視為點擊 → 開詳情
  const onPointerDown = (e, key) => {
    e.preventDefault();
    const area = areaRef.current; if (!area) return;
    const rect = area.getBoundingClientRect();
    const target = placed.find(p => p.key === key); if (!target) return;
    dragRef.current = { key, moved: 0, lastX: e.clientX, lastY: e.clientY };
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      d.moved += Math.abs(ev.clientX - d.lastX) + Math.abs(ev.clientY - d.lastY);
      d.lastX = ev.clientX; d.lastY = ev.clientY;
      const x = Math.max(BODY / 2, Math.min(rect.width - BODY / 2, ev.clientX - rect.left));
      const y = Math.max(BODY / 2, Math.min(rect.height - BODY / 2 + 6, ev.clientY - rect.top));
      posRef.current[key] = { x, y };
      setPlaced(prev => prev.map(p => p.key === key ? { ...p, x, y, hasSaved: true } : p));
    };
    const up = () => {
      const d = dragRef.current;
      if (d && d.moved < 6) setDetail(target.item);
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '10px 20px 14px', animation: 'fadeSlideUp 0.5s ease-out' }}>
      <div style={{ width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* 資訊列 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: C.paper, clipPath: CUT(8), border: `1px solid ${C.line}`, marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', letterSpacing: 3 }}>購物袋</h2>
            <p style={{ fontSize: 8, fontWeight: 700, color: '#8a9a90', letterSpacing: 1, marginTop: 1 }}>{inventory.length} 個戰利品・拖曳可自由擺放</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.goldBg, padding: '5px 10px', clipPath: CUT(6), border: '1px solid rgba(183,121,31,0.3)' }}>
              <Icon name="coin" size={12} color={C.gold} />
              <span style={{ fontSize: 12, fontWeight: 900, color: '#8a5a12', fontFamily: 'monospace' }}>總消費 ${totalSpent}</span>
            </span>
            <button onClick={() => { posRef.current = {}; setDropKey(k => k + 1); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', clipPath: CUT(6), border: `1px solid ${C.line}`, background: C.paper, fontSize: 10, fontWeight: 800, color: C.ink, cursor: 'pointer' }}>
              <Icon name="refresh" size={11} /> 排整齊
            </button>
          </div>
        </div>

        {/* 提把（茄芷袋深藍織帶） */}
        <div style={{ height: 46, position: 'relative', flexShrink: 0, zIndex: 0 }}>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -8, width: '44%', height: 56, border: '8px solid rgba(30,58,138,0.35)', borderBottom: 'none', borderRadius: '28px 28px 0 0' }} />
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -16, width: '52%', height: 62, border: `10px solid ${NAVY}`, borderBottom: 'none', borderRadius: '32px 32px 0 0' }} />
        </div>

        {/* 袋身（紅藍綠條紋網布） */}
        <div style={{
          flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
          clipPath: 'polygon(3% 0, 97% 0, 100% 100%, 0 100%)',
          border: '1px solid rgba(30,58,138,0.3)',
          background: `repeating-linear-gradient(180deg,
            #eeb3ae 0px 30px,  #faf7ee 30px 33px,
            #adc9ee 33px 63px, #faf7ee 63px 66px,
            #b2d8ac 66px 96px, #faf7ee 96px 99px)`,
        }}>
          {/* 網布紋理 */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)', backgroundSize: '3px 3px' }} />
          {/* 直向織帶（對齊提把兩端） */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(24% - 10px)', width: 20, background: NAVY, zIndex: 1, boxShadow: 'inset 2px 0 0 rgba(255,255,255,0.15), inset -2px 0 0 rgba(0,0,0,0.2)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 'calc(24% - 10px)', width: 20, background: NAVY, zIndex: 1, boxShadow: 'inset 2px 0 0 rgba(255,255,255,0.15), inset -2px 0 0 rgba(0,0,0,0.2)' }} />
          {/* 紅色袋口滾邊 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: '#e2887f', borderBottom: '2px solid #faf7ee', zIndex: 2 }} />
          {/* 側邊小布標 */}
          <div style={{ position: 'absolute', right: 8, top: 76, zIndex: 2, background: '#dd8177', color: '#fff', fontSize: 7, fontWeight: 900, letterSpacing: 2, padding: '5px 3px', writingMode: 'vertical-rl', border: '1px solid rgba(255,255,255,0.5)' }}>盛夏慶典</div>

          {/* 商品擺放區 */}
          <div ref={areaRef} style={{ position: 'absolute', inset: '14px 0 0 0', touchAction: 'none', zIndex: 3 }}>
            {inventory.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(253,252,246,0.92)', clipPath: CUT(8), border: `1px solid ${C.line}`, padding: '14px 20px', textAlign: 'center' }}>
                  <Icon name="bag" size={34} color="#8a9a90" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#57534e' }}>茄芷袋還是空的...</p>
                  <p style={{ fontSize: 9, fontWeight: 600, color: '#8a9a90', marginTop: 2 }}>去攤位逛逛，買到的商品會掉進來喔</p>
                </div>
              </div>
            )}
            {placed.map(p => {
              const emoji = findEmoji(p.item);
              return (
                <div key={p.key + '_' + dropKey}
                  onPointerDown={(e) => onPointerDown(e, p.key)}
                  style={{ position: 'absolute', left: p.x - BODY / 2, top: p.y - BODY / 2, width: BODY, height: BODY, cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
                  <div style={{ width: '100%', height: '100%', animation: p.hasSaved ? 'none' : `bagDrop 0.75s cubic-bezier(0.25,1.1,0.4,1) ${p.delay}s both` }}>
                    <div style={{ width: '100%', height: '100%', transform: `rotate(${p.rot}deg)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: BODY - 34, height: BODY - 34, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', filter: 'drop-shadow(0 3px 5px rgba(20,20,40,0.35))' }}>
                        {p.item.imageUrl
                          ? <img src={p.item.imageUrl} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
                          : (emoji ? <span style={{ fontSize: 38 }}>{emoji}</span> : <Icon name="gift" size={40} color="#fdf6e3" sw={1.9} />)}
                      </div>
                      <div style={{ pointerEvents: 'none', textAlign: 'center', marginTop: 2, background: 'rgba(253,252,246,0.94)', clipPath: CUT(4), padding: '2px 7px', border: `1px solid rgba(30,58,138,0.3)` }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: '#33415c', lineHeight: 1.2, maxWidth: BODY - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.item.name}</p>
                        <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(51,65,92,0.6)', maxWidth: BODY - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.item.boothName || ''}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 商品詳情小卡 */}
        {detail && (
          <div onClick={() => setDetail(null)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(20,25,45,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', animation: 'fadeIn 0.2s' }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '82%', maxWidth: 280, background: C.paper, clipPath: CUT(14), padding: '24px 20px 18px', textAlign: 'center', cursor: 'default', animation: 'zoomIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              <Corners size={10} inset={5} color={C.gold} />
              <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                {detail.imageUrl
                  ? <img src={detail.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(90,60,20,0.25))' }} />
                  : <Icon name="gift" size={56} color="#a0742c" />}
              </div>
              <p style={{ fontSize: 16, fontWeight: 900, fontFamily: '"Noto Serif TC", serif' }}>{detail.name}</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.teal, marginTop: 2 }}>{detail.boothName || ''}{detail.date ? `・${detail.date}` : ''}</p>
              {detail.description && <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginTop: 8 }}>{detail.description}</p>}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, background: C.goldBg, clipPath: CUT(6), padding: '4px 12px', border: '1px solid rgba(183,121,31,0.3)' }}>
                <Icon name="coin" size={12} color={C.gold} />
                <span style={{ fontSize: 12, fontWeight: 900, color: '#8a5a12', fontFamily: 'monospace' }}>${Number(detail.price) || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 翻頁集章冊（第2點需求）
// 封面 + 每頁 4 個章，左側線圈裝訂，手機優先
// ============================================================
function StampBook({ booths, stamps }) {
  const PER_PAGE = 4;
  const pages = [];
  for (let i = 0; i < booths.length; i += PER_PAGE) pages.push(booths.slice(i, i + PER_PAGE));
  const totalPages = pages.length + 1; // 含封面
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState('flipNext');

  const go = (d) => {
    const np = page + d;
    if (np < 0 || np >= totalPages) return;
    setDir(d > 0 ? 'flipNext' : 'flipPrev');
    setPage(np);
  };

  // 線圈裝訂
  const rings = (dark) => (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 8, width: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', zIndex: 4 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ width: 15, height: 15, borderRadius: '50%', border: `2.5px solid ${dark ? 'rgba(255,255,255,0.4)' : '#9a9382'}`, background: dark ? 'rgba(0,0,0,0.25)' : C.cream, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
      ))}
    </div>
  );

  const isCover = page === 0;
  const pageBooths = isCover ? [] : pages[page - 1] || [];
  const collectedCount = stamps.length;

  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      <div style={{ perspective: 1400 }}>
        <div key={page} style={{
          position: 'relative', minHeight: 380, transformOrigin: dir === 'flipNext' ? 'left center' : 'right center',
          animation: `${dir} 0.55s cubic-bezier(0.2,0.9,0.3,1) both`,
        }}>
          {isCover ? (
            /* ===== 封面 ===== */
            <div style={{ position: 'relative', minHeight: 380, background: `linear-gradient(150deg, ${C.ink}, #0f2922 70%, #123a30)`, clipPath: CUT(16), padding: '46px 30px 30px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden' }}>
              {rings(true)}
              <Corners color="rgba(251,191,36,0.55)" size={14} inset={8} />
              <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
              <div style={{ width: 110, height: 110, borderRadius: '50%', border: '1.5px solid rgba(251,191,36,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 22 }}>
                <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', border: '1px dashed rgba(251,191,36,0.45)' }} />
                <Icon name="boat" size={52} color="#fbbf24" sw={1.5} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,215,195,0.55)', letterSpacing: 6, textTransform: 'uppercase', marginBottom: 8 }}>Stamp Rally Book</p>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: '"Noto Serif TC", serif', letterSpacing: 5, marginBottom: 6 }}>盛夏慶典<br />集章紀念冊</h3>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,0.85)', fontFamily: 'monospace', marginTop: 10 }}>{collectedCount} / {booths.length} COLLECTED</p>
              <p style={{ fontSize: 10, color: 'rgba(167,215,195,0.4)', marginTop: 18 }}>點下方「翻頁」開始翻閱 →</p>
            </div>
          ) : (
            /* ===== 內頁 ===== */
            <div style={{ position: 'relative', minHeight: 380, background: `linear-gradient(160deg, ${C.paper}, #f6f1e0)`, clipPath: CUT(16), border: `1px solid ${C.line}`, padding: '22px 18px 18px 42px', overflow: 'hidden' }}>
              {rings(false)}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(rgba(18,63,48,0.08) 1px, transparent 1px)', backgroundSize: '18px 18px', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'relative' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase' }}>Stamp Page</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.teal, fontFamily: 'monospace' }}>P.{page} / {pages.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 10px', position: 'relative' }}>
                {pageBooths.map((booth, i) => {
                  const stamped = stamps.includes(booth.id);
                  const rot = [(-5), 4, 6, -3][i % 4];
                  return (
                    <div key={booth.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: `fadeSlideUp 0.45s ease-out ${i * 0.08 + 0.15}s both` }}>
                      <div style={{ position: 'relative' }}>
                        <StampDesign stamp={booth.stamp} size={96} stamped={stamped} boothEmoji={booth.emoji} rotate={stamped ? rot : 0} />
                        {stamped && (
                          <div style={{ position: 'absolute', bottom: -4, right: -6, background: C.teal, clipPath: CUT(4), padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Icon name="check" size={9} color="#fff" sw={2.4} />
                            <span style={{ fontSize: 8, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>已收藏</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: stamped ? C.ink : '#bdb8a6', letterSpacing: 1, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booth.name}</span>
                    </div>
                  );
                })}
                {pageBooths.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#bdb8a6' }}>
                    <Icon name="lantern" size={32} color="#bdb8a6" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, fontWeight: 700 }}>攤位籌備中，還沒有印章可以蒐集</p>
                  </div>
                )}
              </div>
              <div style={{ position: 'absolute', bottom: 10, left: 42, right: 18, textAlign: 'center' }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'rgba(138,154,144,0.5)', letterSpacing: 4, textTransform: 'uppercase' }}>Dragon Boat Festival</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 翻頁控制 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={() => go(-1)} disabled={page === 0} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 16px', clipPath: CUT(8), border: `1px solid ${C.line}`, background: page === 0 ? '#ece8d9' : C.paper, color: page === 0 ? '#b3ae9d' : C.ink, fontSize: 12, fontWeight: 800, cursor: page === 0 ? 'default' : 'pointer' }}>
          <Icon name="chevL" size={13} /> 上一頁
        </button>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} onClick={() => { setDir(i > page ? 'flipNext' : 'flipPrev'); setPage(i); }} style={{ width: i === page ? 18 : 7, height: 7, background: i === page ? C.teal : '#cfc9b6', cursor: 'pointer', transition: 'all 0.3s', clipPath: CUT(2) }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={page >= totalPages - 1} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 16px', clipPath: CUT(8), border: 'none', background: page >= totalPages - 1 ? '#ece8d9' : `linear-gradient(135deg, ${C.teal}, ${C.ink})`, color: page >= totalPages - 1 ? '#b3ae9d' : '#fff', fontSize: 12, fontWeight: 800, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
          翻頁 <Icon name="chevR" size={13} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 龍舟賽位置計算（邏輯不變）
// 去程 0→200、200 折返、回程 200→0
// ============================================================
function calcRacePos(team) {
  const out = Math.min(200, Math.max(0, team.outboundScore));
  if (out < 200) return { pct: out / 200, phase: 'out', label: out === 0 ? '待命' : '衝刺' };
  if (!team.turnSuccess) return { pct: 1, phase: 'turn', label: '奪旗中' };
  const inb = Math.min(200, Math.max(0, team.inboundScore));
  if (inb < 200) return { pct: 1 - inb / 200, phase: 'in', label: '回程' };
  return { pct: 0, phase: 'done', label: '完賽' };
}

// ============================================================
// 河道賽況追蹤器（含第5點需求：每輪事件顯示）
// ============================================================
function RiverRaceTracker({ teams, onFlagClick, isDemo, mockData, loading }) {
  const [bursts, setBursts] = useState([]);   // 打氣噴發 {id, teamId, dx, rot}（可連點刷一排）
  const [localCheers, setLocalCheers] = useState({}); // 試玩/預覽模式的本地計數（不寫入資料庫）
  const [collapsed, setCollapsed] = useState(window.innerWidth < 480 && teams.length > 3);
  const [events, setEvents] = useState([]);
  const isMobile = window.innerWidth < 640;

  // 監聽事件紀錄（RTDB: raceEvents/{timestamp}）
  useEffect(() => {
    if (mockData) { setEvents(MOCK_RACE_EVENTS); return; }
    const evRef = ref(rtdb, 'raceEvents');
    const unsub = onValue(evRef, (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v)
        .map(([k, e]) => ({ t: Number(k), ...e }))
        .sort((a, b) => b.t - a.t)
        .slice(0, 6);
      setEvents(list);
    });
    return () => unsub();
  }, [mockData]);

  const doCheer = (teamId) => {
    const id = Date.now() + Math.random();
    setBursts(prev => [...prev.slice(-19), { id, teamId, dx: Math.floor(Math.random() * 44) - 22, rot: Math.floor(Math.random() * 44) - 22 }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1000);
    if (isDemo) {
      setLocalCheers(prev => ({ ...prev, [teamId]: (prev[teamId] || 0) + 1 }));
    } else {
      runTransaction(ref(rtdb, `race/${teamId}/cheers`), (cur) => (Number(cur) || 0) + 1).catch(() => {});
    }
  };

  // 依總進度排序（去程 + 折返成功才算回程）
  const sorted = [...teams].sort((a, b) => {
    const sa = Math.min(200, a.outboundScore) + (a.turnSuccess ? 200 + Math.min(200, a.inboundScore) : 0);
    const sb = Math.min(200, b.outboundScore) + (b.turnSuccess ? 200 + Math.min(200, b.inboundScore) : 0);
    return sb - sa;
  });
  const shown = collapsed ? sorted.slice(0, 3) : sorted;

  if (loading) return (
    <div style={{ height: isMobile ? 'auto' : '100%', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <Icon name="boat" size={30} color={C.tealDim} style={{ animation: 'boatRock 1.4s ease-in-out infinite' }} />
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>賽況連線中...</p>
    </div>
  );

  if (teams.length === 0) return (
    <div style={{ height: isMobile ? 'auto' : '100%', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 16, textAlign: 'center' }}>
      <Icon name="flag" size={30} color={C.tealDim} />
      <p style={{ fontSize: 12, fontWeight: 800, color: C.teal }}>龍舟賽尚未開始</p>
      <p style={{ fontSize: 10, color: '#94a3b8' }}>比賽開始後，這裡會即時顯示各隊賽況</p>
    </div>
  );

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', display: 'flex', flexDirection: 'column', padding: '6px 0 4px' }}>
      {/* 標題列 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.2s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 3, fontFamily: '"Noto Serif TC", serif' }}>龍舟爭霸 LIVE</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#8a9a90', letterSpacing: 2, textTransform: 'uppercase' }}>Dragon Race</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#8a9a90', display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="horn" size={10} color={C.red} />幫喜歡的隊伍打氣</span>
          {teams.length > 3 && isMobile && (
            <button onClick={() => setCollapsed(c => !c)} style={{ padding: '3px 9px', clipPath: CUT(5), border: `1px solid ${C.line}`, background: C.paper, fontSize: 9, fontWeight: 800, color: C.ink, cursor: 'pointer' }}>
              {collapsed ? `顯示全部 ${teams.length} 隊` : '只看前三'}
            </button>
          )}
        </div>
      </div>

      {/* 事件跑馬燈 */}
      {events.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 6, overflowX: 'auto', padding: '0 14px 6px' }}>
          {events.map((e, i) => (
            <div key={e.t + '_' + i} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', clipPath: CUT(6), background: e.delta >= 0 ? 'rgba(13,148,136,0.08)' : 'rgba(194,65,12,0.08)', border: `1px solid ${e.delta >= 0 ? C.tealDim : 'rgba(194,65,12,0.35)'}`, animation: i === 0 ? 'eventPop 0.5s cubic-bezier(0.16,1,0.3,1)' : 'none' }}>
              <Icon name={e.icon || 'spark'} size={11} color={e.delta >= 0 ? C.teal : C.red} />
              <span style={{ fontSize: 9, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap' }}>{e.team}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7a72', whiteSpace: 'nowrap' }}>{e.name}</span>
              <span style={{ fontSize: 9, fontWeight: 900, fontFamily: 'monospace', color: e.delta >= 0 ? C.teal : C.red }}>{e.delta >= 0 ? '+' : ''}{e.delta}</span>
            </div>
          ))}
        </div>
      )}

      {/* 賽道 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: isMobile ? 'visible' : 'auto', padding: '2px 14px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((team, idx) => {
          const pos = calcRacePos(team);
          const total = Math.min(200, team.outboundScore) + (team.turnSuccess ? Math.min(200, team.inboundScore) : 0);
          const heading = pos.phase === 'in' || pos.phase === 'done';   // 回程/完賽 → 船頭朝左
          return (
            <div key={team.id} style={{ position: 'relative' }}>
              {/* 打氣噴發：放在切角卡片外層，往上飄不會被裁掉 */}
              {bursts.filter(b => b.teamId === team.id).map(b => (
                <span key={b.id} style={{ position: 'absolute', top: 4, right: 18 + b.dx / 2, zIndex: 30, animation: 'cheerFloat 0.95s ease-out forwards', pointerEvents: 'none' }}>
                  <span style={{ display: 'inline-block', transform: `rotate(${b.rot}deg)` }}>
                    <Icon name="horn" size={15} color={C.red} sw={2} />
                  </span>
                </span>
              ))}
              <div style={{ position: 'relative', background: C.paper, clipPath: CUT(9), border: `1px solid ${C.line}`, padding: '7px 12px 9px' }}>
              {/* 隊伍列 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 17, height: 17, clipPath: CUT(4), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, fontFamily: 'monospace', background: idx < 3 ? RANK_COLOR[idx] : '#d5d0bf', color: '#fff', flexShrink: 0 }}>{idx + 1}</span>
                {team.flagImageUrl ? (
                  <img src={team.flagImageUrl} alt="" onClick={() => onFlagClick(team.flagImageUrl)}
                    style={{ width: 20, height: 14, objectFit: 'cover', border: `1px solid ${C.line}`, cursor: 'zoom-in', flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 20, height: 14, background: team.color || C.teal, clipPath: 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 12, fontWeight: 900, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>

                {/* 本輪事件標籤 */}
                {team.lastEvent && (
                  <span key={team.lastEvent.name + '_' + (team.lastEvent.t || 0)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', clipPath: CUT(4), background: team.lastEvent.delta >= 0 ? 'rgba(13,148,136,0.1)' : 'rgba(194,65,12,0.1)', border: `1px solid ${team.lastEvent.delta >= 0 ? C.tealDim : 'rgba(194,65,12,0.4)'}`, animation: 'eventPop 0.5s cubic-bezier(0.16,1,0.3,1)', flexShrink: 0 }}>
                    <Icon name={team.lastEvent.icon || 'spark'} size={10} color={team.lastEvent.delta >= 0 ? C.teal : C.red} />
                    <span style={{ fontSize: 8, fontWeight: 800, color: team.lastEvent.delta >= 0 ? '#0f766e' : '#9a3412', whiteSpace: 'nowrap' }}>{team.lastEvent.name} {team.lastEvent.delta >= 0 ? '+' : ''}{team.lastEvent.delta}</span>
                  </span>
                )}

                {/* 骰子 */}
                {!isMobile && team.lastRolls.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <Icon name="dice" size={11} color="#8a9a90" />
                    {team.lastRolls.slice(0, 5).map((r, i) => (
                      <span key={i} style={{ width: 15, height: 15, clipPath: CUT(3), background: r === 20 ? C.goldBg : r === 1 ? '#fde8e0' : '#eee9da', color: r === 20 ? '#8a5a12' : r === 1 ? C.red : '#57534e', fontSize: 8, fontWeight: 900, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r}</span>
                    ))}
                  </span>
                )}

                <span style={{ fontSize: 9, fontWeight: 800, color: pos.phase === 'done' ? C.gold : pos.phase === 'turn' ? C.red : C.teal, flexShrink: 0, letterSpacing: 1 }}>{pos.label}</span>

                {/* 打氣 */}
                <button onClick={() => doCheer(team.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', clipPath: CUT(5), border: '1px solid rgba(194,65,12,0.3)', background: 'rgba(194,65,12,0.05)', cursor: 'pointer', flexShrink: 0 }}>
                  <Icon name="horn" size={11} color={C.red} />
                  <span style={{ fontSize: 9, fontWeight: 900, color: C.red, fontFamily: 'monospace' }}>{team.cheers + (localCheers[team.id] || 0)}</span>
                </button>
              </div>

              {/* 河道 */}
              <div style={{ position: 'relative', height: 27, clipPath: CUT(5), border: `1px solid ${C.tealDim}`, overflow: 'hidden', background: 'linear-gradient(180deg, #cdeef2 0%, #9cd4de 45%, #7fc4d2 100%)' }}>
                {/* 兩岸（沙洲＋草邊） */}
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#e6dcae', borderBottom: '1px solid rgba(120,150,60,0.55)' }} />
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: '#e6dcae', borderTop: '1px solid rgba(120,150,60,0.55)' }} />
                {/* 流動水波 */}
                <span className="riverWater" style={{ position: 'absolute', inset: '4px 0', opacity: 0.9 }} />
                <span className="riverWater" style={{ position: 'absolute', inset: '4px 0', opacity: 0.45, transform: 'translateY(4px)', animationDuration: '3.8s', animationDirection: 'reverse' }} />
                {/* 水色深淺 */}
                <span style={{ position: 'absolute', inset: '4px 0', background: 'linear-gradient(90deg, rgba(255,255,255,0.25), transparent 30%, transparent 70%, rgba(13,90,110,0.12))' }} />
                {/* 折返浮標旗 */}
                <span style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-56%)' }}>
                  <Icon name="flag" size={12} color={pos.phase === 'turn' ? C.red : '#57727a'} />
                  <span style={{ position: 'absolute', left: 1, bottom: -3, width: 9, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
                </span>
                {/* 起/終點線 */}
                <span style={{ position: 'absolute', left: 3, top: 4, bottom: 4, width: 2, background: 'repeating-linear-gradient(180deg, #123f30 0 3px, rgba(255,255,255,0.7) 3px 6px)' }} />
                {/* 龍舟＋船尾水痕 */}
                <span style={{ position: 'absolute', top: '50%', left: `calc(6px + ${pos.pct} * (100% - 40px))`, transform: 'translateY(-50%)', transition: 'left 1.2s cubic-bezier(0.34,1.2,0.5,1)' }}>
                  <span style={{ display: 'inline-block', position: 'relative', transform: `scaleX(${heading ? -1 : 1})`, animation: 'boatRock 1.6s ease-in-out infinite' }}>
                    <span style={{ position: 'absolute', left: -13, top: '58%', opacity: 0.85 }}><Icon name="wave" size={11} color="rgba(255,255,255,0.9)" sw={2} /></span>
                    <span style={{ position: 'absolute', left: -22, top: '48%', opacity: 0.45 }}><Icon name="wave" size={9} color="rgba(255,255,255,0.9)" sw={2} /></span>
                    <Icon name="boat" size={isMobile ? 18 : 22} color={team.color || C.ink} sw={2} />
                  </span>
                </span>
              </div>

              {/* 分數列 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#8a9a90', fontFamily: 'monospace' }}>去程 {Math.min(200, team.outboundScore)}/200{team.turnSuccess ? ` ・ 回程 ${Math.min(200, team.inboundScore)}/200` : ''}</span>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.ink, fontFamily: 'monospace' }}>TOTAL {total}</span>
              </div>
              </div>
            </div>
          );
        })}
        {collapsed && sorted.length > 3 && (
          <p style={{ fontSize: 9, fontWeight: 700, color: '#8a9a90', textAlign: 'center' }}>…還有 {sorted.length - 3} 隊努力划行中</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 攤位列（白色帳篷小卡，置中排列）
// ============================================================
function MiniSquareCard({ booth, stamped, onOpen }) {
  return (
    <button onClick={() => onOpen(booth)} style={{ position: 'relative', width: 98, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
      {/* 帳篷頂棚（白色遮陽棚 + 波浪垂邊 + 頂端三角旗） */}
      <svg viewBox="0 0 106 34" width="98" height="31" style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(18,63,48,0.14))' }}>
        <path d="M53 10 V3 l8 2.4 -8 2.4" fill={C.teal} stroke="none" />
        <path d="M7 29 L17 12 Q53 4 89 12 L99 29
                 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0
                 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 Z"
          fill="#ffffff" stroke="rgba(18,63,48,0.3)" strokeWidth="1.2" />
        <path d="M31 9 L27 29 M53 7 V29 M75 9 L79 29" stroke="rgba(18,63,48,0.1)" strokeWidth="1" fill="none" />
      </svg>
      {/* 攤位本體（正方形縮圖格：玩家提供 300×300 會完整貼合） */}
      <div style={{ width: 86, height: 86, margin: '0 auto', background: '#fff', borderLeft: '3px solid #ddd6c2', borderRight: '3px solid #ddd6c2', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}>
        {booth.facadeImageUrl
          ? <img src={booth.facadeImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = booth.emoji || '🏮'; }} />
          : (booth.emoji || <Icon name="lantern" size={26} color={C.teal} />)}
        {stamped && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, clipPath: CUT(4), background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={11} color="#fff" sw={2.6} />
          </span>
        )}
      </div>
      {/* 吊掛攤位牌（攤名放這裡） */}
      <div style={{ position: 'relative', margin: '0 14px', paddingTop: 6 }}>
        <span style={{ position: 'absolute', top: 0, left: '20%', width: 1.5, height: 6, background: 'rgba(18,63,48,0.4)' }} />
        <span style={{ position: 'absolute', top: 0, right: '20%', width: 1.5, height: 6, background: 'rgba(18,63,48,0.4)' }} />
        <div style={{ position: 'relative', background: stamped ? 'rgba(13,148,136,0.08)' : '#fff', border: `1px solid ${stamped ? C.tealDim : C.line}`, clipPath: CUT(6), padding: '4px 5px 5px' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booth.name}</p>
        </div>
      </div>
    </button>
  );
}

function BoothPillRow({ booths, stamps, onOpen, side, extra }) {
  if (booths.length === 0 && !extra) return null;
  return (
    <div style={{ flexShrink: 0, padding: side === 'top' ? '10px 12px 6px' : '6px 12px 10px', display: 'flex', overflowX: 'auto', zIndex: 6, position: 'relative' }}>
      {/* 內層 margin auto：塞得下就置中，塞不下就左右捲動 */}
      <div style={{ display: 'flex', gap: 10, margin: '0 auto', padding: '0 4px' }}>
        {booths.map(b => <MiniSquareCard key={b.id} booth={b} stamped={stamps.includes(b.id)} onOpen={onOpen} />)}
        {extra || null}
      </div>
    </div>
  );
}

// ============================================================
// 集章名單
// ============================================================
function CollectorsList({ collectors, currentUser, isStamped }) {
  const list = [...new Set(collectors)];
  const meIn = list.includes(currentUser);
  const display = isStamped && !meIn ? [currentUser, ...list] : list;   // 樂觀顯示自己
  if (display.length === 0) return null;
  return (
    <div style={{ position: 'relative', marginTop: 20, padding: '18px 20px', background: C.paper, clipPath: CUT(12), border: `1px solid ${C.line}` }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>／ 已集章的旅人（{display.length}）</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {display.map((name, i) => (
          <span key={name + i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', clipPath: CUT(5), background: name === currentUser ? 'rgba(13,148,136,0.1)' : '#f3efe2', border: `1px solid ${name === currentUser ? C.tealDim : 'transparent'}` }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: getAvatarColor(name), color: '#fff', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String(name).slice(0, 1)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: name === currentUser ? C.teal : '#57534e' }}>{name}{name === currentUser ? '（你）' : ''}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 龍舟賭盤（彩池制）
// 規則：所有賭金進同一個彩池，押中冠軍者依下注比例瓜分全池
// 一人一注（首次選隊後鎖定），封盤前可加注同一隊；派彩無條件捨去
// ============================================================
// 取出一張注單的 {隊伍id: 金額} 對照（相容舊的一人一注格式）
function betDocMap(b) {
  if (b && b.bets && typeof b.bets === 'object') return b.bets;
  if (b && b.teamId != null) return { [String(b.teamId)]: Number(b.amount) || 0 };
  return {};
}
function betPool(bets) {
  const totals = {};
  let pool = 0;
  bets.forEach(b => {
    Object.entries(betDocMap(b)).forEach(([tid, a]) => {
      const v = Number(a) || 0;
      pool += v;
      totals[String(tid)] = (totals[String(tid)] || 0) + v;
    });
  });
  return { pool, totals };
}
const oddsText = (pool, teamTotal) => teamTotal > 0 ? (pool / teamTotal).toFixed(1) + 'x' : '無人押注';

// 右下角的賭盤帳篷（深綠金色特別款）
function BettingTentCard({ open, onOpen }) {
  return (
    <button onClick={onOpen} style={{ position: 'relative', width: 98, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
      <svg viewBox="0 0 106 34" width="98" height="31" style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(18,63,48,0.2))' }}>
        <path d="M53 10 V3 l8 2.4 -8 2.4" fill="#b7791f" stroke="none" />
        <path d="M7 29 L17 12 Q53 4 89 12 L99 29
                 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0
                 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 a5.75 5 0 0 1 -11.5 0 Z"
          fill="#123f30" stroke="rgba(183,121,31,0.6)" strokeWidth="1.2" />
        <path d="M31 9 L27 29 M53 7 V29 M75 9 L79 29" stroke="rgba(251,191,36,0.2)" strokeWidth="1" fill="none" />
      </svg>
      <div style={{ width: 86, height: 86, margin: '0 auto', background: 'linear-gradient(160deg, #16473a, #0f2922)', borderLeft: '3px solid #b7791f', borderRight: '3px solid #b7791f', borderBottom: '1px solid rgba(183,121,31,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative', boxSizing: 'border-box' }}>
        <Icon name="ticket" size={34} color="#fbbf24" sw={1.6} />
        <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(251,191,36,0.8)', letterSpacing: 2 }}>{open ? '開盤中' : '賭盤'}</span>
        {open && <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.2s infinite' }} />}
      </div>
      <div style={{ position: 'relative', margin: '0 14px', paddingTop: 6 }}>
        <span style={{ position: 'absolute', top: 0, left: '20%', width: 1.5, height: 6, background: 'rgba(18,63,48,0.4)' }} />
        <span style={{ position: 'absolute', top: 0, right: '20%', width: 1.5, height: 6, background: 'rgba(18,63,48,0.4)' }} />
        <div style={{ position: 'relative', background: C.goldBg, border: '1px solid rgba(183,121,31,0.45)', clipPath: CUT(6), padding: '4px 5px 5px' }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#8a5a12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>龍舟賭盤</p>
        </div>
      </div>
    </button>
  );
}

// 河道下方的賠率跑馬燈
function OddsMarquee({ teams, bets, meta, onOpen }) {
  const { pool, totals } = betPool(bets);
  const chunk = (dup) => (
    <div key={dup} style={{ display: 'flex', gap: 8, paddingRight: 8, alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', clipPath: CUT(5), background: meta.settled ? C.goldBg : meta.open ? '#123f30' : '#e8e3d4', border: '1px solid rgba(183,121,31,0.4)', flexShrink: 0 }}>
        <Icon name="ticket" size={11} color={meta.settled ? '#8a5a12' : meta.open ? '#fbbf24' : '#8a9a90'} />
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap', color: meta.settled ? '#8a5a12' : meta.open ? '#fbbf24' : '#8a9a90' }}>
          {meta.settled ? `已開獎・冠軍「${meta.winnerName || ''}」` : meta.open ? '龍舟賭盤開放中' : '賭盤已封盤'}
        </span>
      </span>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#8a5a12', whiteSpace: 'nowrap', fontFamily: 'monospace', flexShrink: 0 }}>總彩池 ${pool}</span>
      {teams.map(t => (
        <span key={dup + '_' + t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', clipPath: CUT(5), background: C.paper, border: `1px solid ${C.line}`, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, background: t.color || C.teal, flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap' }}>{t.name}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#8a9a90', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>${totals[String(t.id)] || 0}</span>
          <span style={{ fontSize: 9, fontWeight: 900, whiteSpace: 'nowrap', fontFamily: 'monospace', color: totals[String(t.id)] ? C.teal : '#b3ae9d' }}>{oddsText(pool, totals[String(t.id)] || 0)}</span>
        </span>
      ))}
      <span style={{ fontSize: 9, fontWeight: 700, color: '#b3ae9d', whiteSpace: 'nowrap', flexShrink: 0 }}>點我進入賭盤 →</span>
    </div>
  );
  return (
    <div onClick={onOpen} style={{ flexShrink: 0, overflow: 'hidden', cursor: 'pointer', padding: '5px 0 3px', zIndex: 6, position: 'relative' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'marqueeScroll 20s linear infinite' }}>
        {[0, 1].map(chunk)}
      </div>
    </div>
  );
}

// 賭盤攤位頁面
function BettingBooth({ teams, bets, meta, myBet, coins, isDemo, onBet, onBack }) {
  const [pickId, setPickId] = useState(null);
  const [amt, setAmt] = useState('');
  const { pool, totals } = betPool(bets);
  const canBet = meta.open && !meta.settled;
  const myMap = betDocMap(myBet);
  const myTotal = Object.values(myMap).reduce((s, a) => s + (Number(a) || 0), 0);
  const teamName = (tid) => {
    const t = teams.find(x => String(x.id) === String(tid));
    return t ? t.name : ((myBet && myBet.names && myBet.names[tid]) || '未知隊伍');
  };
  const effTeam = teams.find(t => String(t.id) === String(pickId));
  const sorted = [...teams].sort((a, b) => (totals[String(b.id)] || 0) - (totals[String(a.id)] || 0));

  const submit = () => {
    if (!effTeam) return;
    onBet(effTeam, amt);
    setAmt('');
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.paper, animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 150, background: 'linear-gradient(135deg, #123f30, #0f2922)', display: 'flex', alignItems: 'flex-end', padding: '24px 28px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(rgba(251,191,36,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.6) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <button onClick={onBack} style={{ position: 'absolute', top: 20, left: 20, width: 44, height: 44, clipPath: CUT(10), background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
          <Icon name="chevL" size={20} color="#fff" />
        </button>
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 3 }}><HexTag bg="rgba(251,191,36,0.15)" color="#fbbf24">賭</HexTag></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.6)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Dragon Race Betting</p>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: '"Noto Serif TC", serif', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
            龍舟賭盤
            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', clipPath: CUT(5), letterSpacing: 1, background: meta.settled ? C.goldBg : meta.open ? 'rgba(220,38,38,0.9)' : 'rgba(255,255,255,0.15)', color: meta.settled ? '#8a5a12' : '#fff' }}>
              {meta.settled ? '已開獎' : meta.open ? '開盤中 LIVE' : '已封盤'}
            </span>
          </h2>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '22px 24px 40px' }}>
        {/* ★ 警語 */}
        <div style={{ position: 'relative', padding: '12px 16px', marginBottom: 18, clipPath: CUT(8), background: 'repeating-linear-gradient(45deg, rgba(194,65,12,0.08) 0 12px, rgba(183,121,31,0.1) 12px 24px)', border: '1.5px solid rgba(194,65,12,0.45)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="horn" size={18} color={C.red} />
          <p style={{ fontSize: 12.5, fontWeight: 900, color: '#9a3412', letterSpacing: 1.5, fontFamily: '"Noto Serif TC", serif' }}>小賭怡情，大賭翔平，強賭灰飛煙滅</p>
        </div>

        {/* 彩池 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(13,148,136,0.06)', clipPath: CUT(10), border: `1px solid ${C.tealDim}`, marginBottom: 16 }}>
          <Corners size={8} inset={4} />
          <div>
            <p style={{ fontSize: 9, fontWeight: 800, color: C.teal, letterSpacing: 2 }}>／ 目前總彩池（彩池制）</p>
            <p style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: C.ink, lineHeight: 1.2 }}>${pool}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#8a9a90' }}>共 {bets.length} 位玩家下注</p>
            <p style={{ fontSize: 9, color: '#b3ae9d', marginTop: 2 }}>押中冠軍者按比例瓜分全池</p>
          </div>
        </div>

        {/* 開獎結果 */}
        {meta.settled && (
          <div style={{ position: 'relative', textAlign: 'center', padding: 18, marginBottom: 16, background: C.goldBg, clipPath: CUT(12), border: '1.5px solid rgba(183,121,31,0.45)', animation: 'eggPop 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <Icon name="trophy" size={28} color="#8a5a12" style={{ margin: '0 auto 4px' }} />
            <p style={{ fontSize: 16, fontWeight: 900, color: '#8a5a12', fontFamily: '"Noto Serif TC", serif' }}>冠軍：{meta.winnerName || '—'}</p>
            {myBet && myBet.result === 'win' && <p style={{ fontSize: 13, fontWeight: 900, color: '#0f766e', marginTop: 6 }}>恭喜押中冠軍！派彩 ${Number(myBet.payout) || 0} 已入帳</p>}
            {myBet && myBet.result === 'lose' && <p style={{ fontSize: 12, fontWeight: 800, color: '#9a3412', marginTop: 6 }}>灰飛煙滅…下次手氣會更好</p>}
            {myBet && myBet.result === 'refund' && <p style={{ fontSize: 12, fontWeight: 800, color: '#57534e', marginTop: 6 }}>本輪無人押中冠軍，賭金 ${Number(myBet.payout) || 0} 已全額退還</p>}
          </div>
        )}

        {/* 我的注單（可押多隊） */}
        {myBet && myTotal > 0 && !meta.settled && (
          <div style={{ padding: '12px 16px', background: C.paper, clipPath: CUT(10), border: `1.5px solid ${C.tealDim}`, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="ticket" size={17} color={C.teal} />
              <p style={{ fontSize: 12, fontWeight: 900, flex: 1 }}>我的注單</p>
              <p style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: C.teal }}>共 ${myTotal}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(myMap).filter(([, a]) => Number(a) > 0).map(([tid, a]) => (
                <span key={tid} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', clipPath: CUT(5), background: 'rgba(13,148,136,0.07)', border: `1px solid ${C.tealDim}` }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.ink }}>{teamName(tid)}</span>
                  <span style={{ fontSize: 10, fontWeight: 900, fontFamily: 'monospace', color: '#8a5a12' }}>${Number(a)}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, fontFamily: 'monospace', color: C.teal }}>{oddsText(pool, totals[String(tid)] || 0)}</span>
                </span>
              ))}
            </div>
            {canBet && <p style={{ fontSize: 9, color: '#b3ae9d', marginTop: 8 }}>封盤前可以自由加碼、也可以再押其他隊伍分散風險</p>}
          </div>
        )}

        {/* 選隊 */}
        <p style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>／ 選擇隊伍（可押多隊）</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {sorted.map(t => {
            const tid = String(t.id);
            const isPicked = String(pickId) === tid;
            const mine = Number(myMap[tid]) || 0;
            return (
              <div key={t.id} onClick={() => canBet && setPickId(tid)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', clipPath: CUT(8), cursor: canBet ? 'pointer' : 'default', background: isPicked ? 'rgba(13,148,136,0.08)' : C.paper, border: `1.5px solid ${isPicked ? C.teal : C.line}`, transition: 'all 0.2s' }}>
                <span style={{ width: 18, height: 18, clipPath: CUT(4), border: `1.5px solid ${isPicked ? C.teal : '#c9c4b2'}`, background: isPicked ? C.teal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isPicked && <Icon name="check" size={11} color="#fff" sw={2.6} />}
                </span>
                <span style={{ width: 18, height: 12, background: t.color || C.teal, clipPath: 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.name}
                  {mine > 0 && <span style={{ fontSize: 8, fontWeight: 900, padding: '1px 7px', clipPath: CUT(3), background: C.goldBg, color: '#8a5a12', border: '1px solid rgba(183,121,31,0.3)', flexShrink: 0 }}>我押 ${mine}</span>}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8a9a90', fontFamily: 'monospace', flexShrink: 0 }}>${totals[tid] || 0}</span>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: totals[tid] ? C.teal : '#b3ae9d', width: 62, textAlign: 'right', flexShrink: 0 }}>{oddsText(pool, totals[tid] || 0)}</span>
              </div>
            );
          })}
        </div>

        {/* 下注區 */}
        {canBet ? (
          <div style={{ position: 'relative', padding: 18, background: C.paper, clipPath: CUT(12), border: `1px solid ${C.line}` }}>
            <Corners size={9} inset={4} color={C.gold} />
            <p style={{ fontSize: 10, fontWeight: 800, color: '#8a9a90', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>／ 下注金額，可自行輸入（持有 ${coins}）</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="number" min="1" value={amt} onChange={e => setAmt(e.target.value)} placeholder="輸入金額"
                style={{ flex: 1, boxSizing: 'border-box', padding: '12px 14px', background: '#faf7ee', border: `1px solid ${C.line}`, clipPath: CUT(8), fontSize: 15, fontWeight: 800, fontFamily: 'monospace', outline: 'none', color: C.ink }} />
              <button onClick={submit} disabled={!effTeam || !amt}
                style={{ padding: '0 22px', clipPath: CUT(8), border: 'none', cursor: (!effTeam || !amt) ? 'default' : 'pointer', fontSize: 14, fontWeight: 900, letterSpacing: 2, background: (!effTeam || !amt) ? '#e8e3d4' : 'linear-gradient(135deg, #fbbf24, #d97706)', color: (!effTeam || !amt) ? '#a3a091' : '#451a03' }}>
                下注
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[50, 100, 200, 500].map(v => (
                <button key={v} onClick={() => setAmt(String((Math.floor(Number(amt)) || 0) + v))} style={{ padding: '5px 12px', clipPath: CUT(5), border: `1px solid ${C.line}`, background: '#faf7ee', fontSize: 11, fontWeight: 800, color: C.ink, cursor: 'pointer', fontFamily: 'monospace' }}>+{v}</button>
              ))}
              <button onClick={() => setAmt(String(coins))} style={{ padding: '5px 12px', clipPath: CUT(5), border: '1px solid rgba(194,65,12,0.4)', background: 'rgba(194,65,12,0.06)', fontSize: 11, fontWeight: 900, color: C.red, cursor: 'pointer' }}>全押 ${coins}</button>
            </div>
            {!effTeam && <p style={{ fontSize: 10, color: '#b3ae9d', marginTop: 8 }}>先在上面選一支隊伍</p>}
            {isDemo && <p style={{ fontSize: 10, color: C.red, fontWeight: 700, marginTop: 8 }}>※ 試玩／預覽模式僅供瀏覽，無法實際下注</p>}
          </div>
        ) : !meta.settled ? (
          <div style={{ textAlign: 'center', padding: 18, background: '#f3efe2', clipPath: CUT(10), border: `1px dashed ${C.line}` }}>
            <Icon name="lock" size={22} color="#8a9a90" style={{ margin: '0 auto 4px' }} />
            <p style={{ fontSize: 12, fontWeight: 800, color: '#57534e' }}>賭盤已封盤，等待比賽結果</p>
          </div>
        ) : null}

        <p style={{ fontSize: 9, color: '#b3ae9d', lineHeight: 1.8, marginTop: 14 }}>
          ※ 賠率為即時預估，最終派彩以封盤時的彩池計算，金額無條件捨去至整數。若冠軍隊無人押中，全部賭金原額退還。
        </p>
      </div>
    </div>
  );
}

// ============================================================
// 排行榜（第4點需求：同章數並列名次）
// 名次採「競賽排名」：3人並列第1 → 下一位是第4名
// ============================================================
function Leaderboard({ booths, leaderboard, currentUser, currentUserStamps, onRefresh, isDemo }) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (!isDemo) onRefresh(); }, []);

  const handleRefresh = async () => {
    if (refreshing || isDemo) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  // 試玩模式給假資料
  const source = isDemo ? [
    { username: '慶典達人', stamps: ['a', 'b', 'c', 'd', 'e'] },
    { username: '龍舟粉絲', stamps: ['a', 'b', 'c'] },
    { username: '愛吃粽子', stamps: ['a', 'b', 'c'] },
    { username: currentUser, stamps: currentUserStamps },
    { username: '路過旅人', stamps: ['a'] },
  ].sort((a, b) => b.stamps.length - a.stamps.length) : leaderboard;

  // ★ 並列名次計算
  const ranked = [];
  let prevCount = null, prevRank = 0;
  source.forEach((p, i) => {
    const n = p.stamps.length;
    const rank = (n === prevCount) ? prevRank : i + 1;
    prevCount = n; prevRank = rank;
    ranked.push({ ...p, rank });
  });
  const rankSize = ranked.reduce((m, p) => { m[p.rank] = (m[p.rank] || 0) + 1; return m; }, {});

  const me = ranked.find(p => p.username === currentUser);
  const better = me ? ranked.find(p => p.rank < me.rank) : null;   // 最近一個名次比我高的
  const gap = me && better ? better.stamps.length - me.stamps.length : 0;

  const medalColor = (rank) => rank <= 3 ? RANK_COLOR[rank - 1] : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="trophy" size={17} color={C.gold} />
          <h3 style={{ fontSize: 16, fontWeight: 900, fontFamily: '"Noto Serif TC", serif', letterSpacing: 2 }}>集章排行榜</h3>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#8a9a90', letterSpacing: 2, textTransform: 'uppercase' }}>Ranking</span>
        </div>
        {!isDemo && (
          <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', clipPath: CUT(6), background: refreshing ? '#eee9da' : C.paper, border: `1px solid ${C.line}`, fontSize: 10, fontWeight: 700, color: '#4b5f56', cursor: refreshing ? 'wait' : 'pointer' }}>
            <span style={{ display: 'inline-block', transition: 'transform 0.6s', transform: refreshing ? 'rotate(360deg)' : 'none' }}><Icon name="refresh" size={11} /></span>
            {refreshing ? '更新中' : '刷新'}
          </button>
        )}
      </div>

      {/* 我的名次 */}
      {me && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(13,148,136,0.06)', clipPath: CUT(10), border: `1px solid ${C.tealDim}`, marginBottom: 12 }}>
          <Corners size={8} inset={4} />
          <span style={{ width: 36, height: 36, clipPath: CUT(8), background: medalColor(me.rank) || C.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, fontFamily: 'monospace', flexShrink: 0 }}>{me.rank}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              我的名次：第 {me.rank} 名
              {rankSize[me.rank] > 1 && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', clipPath: CUT(3), background: C.goldBg, color: '#8a5a12', border: '1px solid rgba(183,121,31,0.3)' }}>並列 ×{rankSize[me.rank]}</span>}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7a72', marginTop: 2 }}>
              {me.rank === 1 ? '你目前領先全場！' : gap > 0 ? `再收集 ${gap} 個章就能追上前一名` : '與前一名同章數，衝一個章就超車！'}
            </p>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Icon name="stamp" size={13} color={C.teal} />
            <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: C.teal }}>{me.stamps.length}</span>
          </span>
        </div>
      )}

      {/* 名單 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ranked.length === 0 && <p style={{ fontSize: 11, color: '#8a9a90', textAlign: 'center', padding: '16px 0' }}>還沒有人上榜，快去集章搶頭香！</p>}
        {ranked.slice(0, 30).map((p) => {
          const isMe = p.username === currentUser;
          const mc = medalColor(p.rank);
          return (
            <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: isMe ? 'rgba(13,148,136,0.06)' : C.paper, clipPath: CUT(8), border: `1px solid ${isMe ? C.tealDim : C.line}` }}>
              {mc ? (
                <span style={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}><Icon name="medal" size={19} color={mc} sw={2} /></span>
              ) : (
                <span style={{ width: 24, textAlign: 'center', fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: '#8a9a90', flexShrink: 0 }}>{p.rank}</span>
              )}
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(p.username), color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{String(p.username).slice(0, 1)}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 900 : 700, color: isMe ? C.teal : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                {p.username}{isMe ? '（你）' : ''}
                {rankSize[p.rank] > 1 && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', clipPath: CUT(3), background: '#f3efe2', color: '#8a9a90', flexShrink: 0 }}>並列</span>}
              </span>
              {/* 章數進度條 */}
              <span style={{ width: 54, height: 4, background: '#ece8d9', flexShrink: 0, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(p.stamps.length / (booths.length || 1)) * 100}%`, background: mc || C.teal }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: mc || C.ink, width: 22, textAlign: 'right', flexShrink: 0 }}>{p.stamps.length}</span>
            </div>
          );
        })}
      </div>
      {isDemo && <p style={{ fontSize: 9, color: '#b3ae9d', textAlign: 'center', marginTop: 10 }}>（試玩模式顯示的是示範名單）</p>}
    </div>
  );
}

// ============================================================
// 管理員後台（內部工具，維持深色；賽事分頁新增「每輪事件」控制）
// ============================================================
function AdminPanel({ adminUser, onLogout, db, rtdb }) {
  const [tab, setTab] = useState('dashboard');
  const [msg, setMsg] = useState(null);
  const [boothList, setBoothList] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [settings, setSettings] = useState({ registrationOpen: true, registrationClosedMsg: '', initialCoins: 500, stampReward: 50 });
  const [teams, setTeams] = useState([]);
  const [editing, setEditing] = useState(null);        // 編輯中的攤位
  const [busy, setBusy] = useState(false);

  // 賽事控制狀態
  const [rollsInput, setRollsInput] = useState({});    // {teamId: '15,20,3'}
  const [eventSel, setEventSel] = useState({});        // {teamId: '' | preset id | 'custom'}
  const [customEvent, setCustomEvent] = useState({});  // {teamId: {name, delta}}
  const [newTeam, setNewTeam] = useState({ name: '', color: '#0d9488', flagImageUrl: '' });
  const [coinInput, setCoinInput] = useState({});      // {username: '100'}

  const toast = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 2600); };

  const loadAll = useCallback(async () => {
    try {
      const bs = await getDocs(collection(db, 'booths'));
      const arr = [];
      for (const d of bs.docs) {
        const items = (await getDocs(collection(db, 'booths', d.id, 'items'))).docs.map(x => ({ id: x.id, ...x.data() }));
        arr.push({ id: d.id, ...d.data(), items });
      }
      setBoothList(arr);
      const ps = await getDocs(collection(db, 'players'));
      setPlayerList(ps.docs.map(d => ({ username: d.id, ...d.data() })));
      const br = await getDocs(collection(db, 'betRounds'));
      setBetRounds(br.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.id) - Number(a.id)));
      const st = await getDoc(doc(db, 'settings', 'general'));
      if (st.exists()) {
        const sd = st.data();
        setSettings({
          registrationOpen: sd.registrationOpen !== false,
          registrationClosedMsg: sd.registrationClosedMsg || '',
          initialCoins: Number(sd.initialCoins) > 0 ? Number(sd.initialCoins) : 500,
          stampReward: Number(sd.stampReward) > 0 ? Number(sd.stampReward) : 50,
        });
      }
    } catch (e) { toast('資料載入失敗：' + e.message, 'err'); }
  }, [db]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 龍舟隊伍即時同步
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'race'), (snap) => {
      const v = snap.val() || {};
      setTeams(Object.entries(v).map(([k, t]) => ({
        id: k, name: t.name || '', color: t.color || '#0d9488', flagImageUrl: t.flagImageUrl || '',
        outboundScore: Number(t.outboundScore) || 0, inboundScore: Number(t.inboundScore) || 0,
        turnSuccess: t.turnSuccess === true || t.turnSuccess === 'true',
        cheers: Number(t.cheers) || 0, lastRolls: t.lastRolls || '', lastEvent: t.lastEvent || null,
      })));
    });
    return () => unsub();
  }, [rtdb]);

  // 賭盤：注單與開盤狀態即時同步
  const [adminBets, setAdminBets] = useState([]);
  const [betRounds, setBetRounds] = useState([]);   // 每輪開獎歷史
  const [betMeta, setBetMeta] = useState({ open: false, settled: false });
  const [winnerSel, setWinnerSel] = useState('');
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'raceBets'), (snap) => {
      setAdminBets(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [db]);
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'betting'), (s) => setBetMeta(s.val() || { open: false, settled: false }));
    return () => unsub();
  }, [rtdb]);

  // ---------- 攤位 ----------
  const blankBooth = () => ({ id: '', name: '', ownerName: '', emoji: '🏮', side: 'top', description: '', plurkUrl: '', task: '', stampImageUrl: '', facadeImageUrl: '', stampHint: '', items: [] });
  const saveBooth = async () => {
    if (!editing.name.trim()) return toast('攤位名稱必填', 'err');
    setBusy(true);
    try {
      const id = editing.id || ('booth-' + Date.now());
      const { items, id: _omit, ...fields } = editing;
      await setDoc(doc(db, 'booths', id), fields, { merge: true });
      // 同步商品：先刪除已移除的，再寫入現有的
      const existing = (await getDocs(collection(db, 'booths', id, 'items'))).docs.map(d => d.id);
      const keepIds = items.filter(it => it.id).map(it => it.id);
      for (const exId of existing) { if (!keepIds.includes(exId)) await deleteDoc(doc(db, 'booths', id, 'items', exId)); }
      for (const it of items) {
        const itemId = it.id || ('item-' + Date.now() + '-' + Math.floor(Math.random() * 999));
        await setDoc(doc(db, 'booths', id, 'items', itemId), { name: it.name || '', price: Number(it.price) || 0, description: it.description || '', imageUrl: it.imageUrl || '' });
      }
      toast('攤位已儲存');
      setEditing(null);
      loadAll();
    } catch (e) { toast('儲存失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };
  const deleteBooth = async (id) => {
    if (!window.confirm('確定刪除這個攤位？（商品也會一併刪除）')) return;
    setBusy(true);
    try {
      const its = await getDocs(collection(db, 'booths', id, 'items'));
      for (const d of its.docs) await deleteDoc(doc(db, 'booths', id, 'items', d.id));
      await deleteDoc(doc(db, 'booths', id));
      toast('攤位已刪除'); loadAll();
    } catch (e) { toast('刪除失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };

  // ---------- 玩家 ----------
  const [batchText, setBatchText] = useState('');
  const batchCreate = async () => {
    const lines = batchText.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return toast('請每行輸入一位玩家：暱稱,密碼（密碼可省略，預設0000）', 'err');
    setBusy(true);
    let ok = 0, skip = 0;
    try {
      for (const line of lines) {
        const [name, pin] = line.split(/[,，]/).map(s => (s || '').trim());
        if (!name) continue;
        const exist = await getDoc(doc(db, 'players', name));
        if (exist.exists()) { skip++; continue; }
        await setDoc(doc(db, 'players', name), { pin: pin || '0000', coins: Number(settings.initialCoins) > 0 ? Number(settings.initialCoins) : 500, inventory: [], stamps: [], createdAt: Timestamp.now() });
        ok++;
      }
      toast(`已建立 ${ok} 位玩家${skip ? `（略過重複 ${skip} 位）` : ''}`);
      setBatchText(''); loadAll();
    } catch (e) { toast('批次建立失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };
  const setPlayerCoins = async (username) => {
    const val = parseInt(coinInput[username]);
    if (isNaN(val)) return toast('請輸入數字', 'err');
    try {
      await updateDoc(doc(db, 'players', username), { coins: val });
      toast(`${username} 的購物金已設為 ${val}`);
      setCoinInput(p => ({ ...p, [username]: '' })); loadAll();
    } catch (e) { toast('更新失敗：' + e.message, 'err'); }
  };
  const renamePlayer = async (oldName) => {
    const input = window.prompt(`將「${oldName}」改名為：`, '');
    if (input == null) return;
    const newName = input.trim();
    if (!newName || newName === oldName) return;
    setBusy(true);
    try {
      const exist = await getDoc(doc(db, 'players', newName));
      if (exist.exists()) { toast('新名稱已有人使用', 'err'); return; }
      const oldSnap = await getDoc(doc(db, 'players', oldName));
      if (!oldSnap.exists()) { toast('找不到原玩家', 'err'); return; }
      // 複製玩家資料到新名稱
      await setDoc(doc(db, 'players', newName), oldSnap.data());
      // 集章紀錄跟著改名（排行榜與集章名單才不會斷）
      const logs = await getDocs(query(collection(db, 'stampLogs'), where('username', '==', oldName)));
      for (const d of logs.docs) await updateDoc(doc(db, 'stampLogs', d.id), { username: newName });
      // 賭盤注單跟著搬
      const betSnap = await getDoc(doc(db, 'raceBets', oldName));
      if (betSnap.exists()) {
        await setDoc(doc(db, 'raceBets', newName), betSnap.data());
        await deleteDoc(doc(db, 'raceBets', oldName));
      }
      // 最後刪除舊文件
      await deleteDoc(doc(db, 'players', oldName));
      toast(`已改名：${oldName} → ${newName}，請玩家改用新名稱＋原密碼登入`);
      loadAll();
    } catch (e) { toast('改名失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };
  const deletePlayer = async (username) => {
    if (!window.confirm(`確定刪除玩家「${username}」？`)) return;
    try { await deleteDoc(doc(db, 'players', username)); toast('已刪除'); loadAll(); }
    catch (e) { toast('刪除失敗：' + e.message, 'err'); }
  };

  // ---------- 設定 ----------
  const saveSettings = async () => {
    try {
      const payload = {
        ...settings,
        initialCoins: Number(settings.initialCoins) > 0 ? Number(settings.initialCoins) : 500,
        stampReward: Number(settings.stampReward) > 0 ? Number(settings.stampReward) : 50,
      };
      await setDoc(doc(db, 'settings', 'general'), payload, { merge: true });
      setSettings(payload);
      toast('設定已儲存（玩家端重新整理後生效）');
    } catch (e) { toast('儲存失敗：' + e.message, 'err'); }
  };

  // ---------- 龍舟賽 ----------
  const addTeam = async () => {
    if (!newTeam.name.trim()) return toast('隊伍名稱必填', 'err');
    const id = 'team-' + Date.now();
    await rtdbSet(ref(rtdb, `race/${id}`), { ...newTeam, outboundScore: 0, inboundScore: 0, turnSuccess: false, cheers: 0, lastRolls: '', lastEvent: null });
    setNewTeam({ name: '', color: '#0d9488', flagImageUrl: '' });
    toast('隊伍已加入');
  };
  const updateTeamField = (id, field, value) => rtdbSet(ref(rtdb, `race/${id}/${field}`), value);
  const deleteTeam = async (id) => {
    if (!window.confirm('確定刪除這支隊伍？')) return;
    await rtdbRemove(ref(rtdb, `race/${id}`));
    toast('隊伍已刪除');
  };

  // 取得該隊本輪事件（預設 / 自訂）
  const getEventForTeam = (teamId) => {
    const sel = eventSel[teamId] || '';
    if (!sel) return null;
    if (sel === 'custom') {
      const c = customEvent[teamId] || {};
      const d = parseInt(c.delta);
      if (!c.name || isNaN(d)) return null;
      return { name: c.name.trim(), delta: d, icon: d >= 0 ? 'spark' : 'wave' };
    }
    const p = RACE_EVENTS.find(e => e.id === sel);
    return p ? { name: p.name, delta: p.delta, icon: p.icon } : null;
  };

  // ★ 結算本輪：擲骰總和 + 事件增減（下限0），寫入 lastEvent 與事件紀錄
  const processTeamRolls = async (team) => {
    const raw = (rollsInput[team.id] || '').trim();
    const rolls = raw.split(/[,，\s]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
    if (rolls.length === 0) return toast('請先輸入本輪擲骰結果（逗號分隔）', 'err');
    const rollSum = rolls.reduce((s, n) => s + n, 0);
    const ev = getEventForTeam(team.id);
    const move = Math.max(0, rollSum + (ev ? ev.delta : 0));   // 事件後不會倒退，最低 0

    const updates = { lastRolls: rolls.join(','), lastEvent: ev ? { ...ev, t: Date.now() } : null };
    if (team.outboundScore < 200) {
      updates.outboundScore = Math.min(200, team.outboundScore + move);
    } else if (team.turnSuccess) {
      updates.inboundScore = Math.min(200, team.inboundScore + move);
    } else {
      return toast('該隊在折返點，請先切換「奪旗成功」再結算回程', 'err');
    }
    try {
      for (const [k, v] of Object.entries(updates)) await rtdbSet(ref(rtdb, `race/${team.id}/${k}`), v);
      if (ev) await rtdbSet(ref(rtdb, `raceEvents/${Date.now()}`), { team: team.name, name: ev.name, delta: ev.delta, icon: ev.icon });
      setRollsInput(p => ({ ...p, [team.id]: '' }));
      setEventSel(p => ({ ...p, [team.id]: '' }));
      toast(`${team.name}：骰點 ${rollSum}${ev ? `，${ev.name} ${ev.delta >= 0 ? '+' : ''}${ev.delta}` : ''} → 前進 ${move}`);
    } catch (e) { toast('結算失敗：' + e.message, 'err'); }
  };

  // 只歸零打氣數（不動分數與事件）
  const clearCheers = async () => {
    if (!window.confirm('確定把所有隊伍的打氣數歸零？（分數不受影響）')) return;
    try {
      for (const t of teams) await rtdbSet(ref(rtdb, `race/${t.id}/cheers`), 0);
      toast('打氣數已全部歸零');
    } catch (e) { toast('歸零失敗：' + e.message, 'err'); }
  };
  // 只清除事件紀錄（跑馬燈＋各隊事件標籤，不動分數）
  const clearEvents = async () => {
    if (!window.confirm('確定清除所有事件紀錄？跑馬燈與各隊的事件標籤都會消失（分數不受影響）')) return;
    try {
      await rtdbRemove(ref(rtdb, 'raceEvents'));
      for (const t of teams) await rtdbRemove(ref(rtdb, `race/${t.id}/lastEvent`));
      toast('事件紀錄已清除');
    } catch (e) { toast('清除失敗：' + e.message, 'err'); }
  };

  // ★ 重置比賽：分數/打氣/骰點/事件全清，含事件紀錄
  const resetRace = async () => {
    if (!window.confirm('確定重置整場比賽？所有分數、打氣數與事件紀錄都會歸零。')) return;
    try {
      for (const t of teams) {
        await rtdbSet(ref(rtdb, `race/${t.id}/outboundScore`), 0);
        await rtdbSet(ref(rtdb, `race/${t.id}/inboundScore`), 0);
        await rtdbSet(ref(rtdb, `race/${t.id}/turnSuccess`), false);
        await rtdbSet(ref(rtdb, `race/${t.id}/cheers`), 0);
        await rtdbSet(ref(rtdb, `race/${t.id}/lastRolls`), '');
        await rtdbRemove(ref(rtdb, `race/${t.id}/lastEvent`));
      }
      await rtdbRemove(ref(rtdb, 'raceEvents'));
      toast('比賽已重置');
    } catch (e) { toast('重置失敗：' + e.message, 'err'); }
  };

  // ---------- 龍舟賭盤（彩池制） ----------
  const betPoolAdmin = () => betPool(adminBets);   // 共用彩池計算（支援多隊注單）
  const openBetting = async () => {
    if (betMeta.settled && adminBets.length > 0) {
      if (!window.confirm('上一輪注單還沒清空。建議先按「清空注單」再開新盤，直接開盤會把新舊注單混在一起。仍要直接開盤？')) return;
    }
    await rtdbSet(ref(rtdb, 'betting'), { open: true, settled: false });
    toast('賭盤已開放下注');
  };
  const closeBetting = async () => {
    await rtdbSet(ref(rtdb, 'betting/open'), false);
    toast('賭盤已封盤');
  };
  // 開獎派彩：冠軍隊押注者按比例瓜分全池（無條件捨去）；無人押中則全額退還
  const settleBets = async () => {
    if (!winnerSel) return toast('請先選擇冠軍隊伍', 'err');
    const team = teams.find(t => String(t.id) === String(winnerSel));
    if (!team) return toast('找不到該隊伍', 'err');
    if (!window.confirm(`確定以「${team.name}」為冠軍開獎？派彩會直接發進玩家帳戶，無法復原。`)) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'raceBets'));
      const bets = snap.docs.map(d => ({ username: d.id, ...d.data() }));
      const { pool, totals } = betPool(bets);
      const wid = String(winnerSel);
      const winnerTotal = totals[wid] || 0;
      const roundResults = [];   // 本輪每位玩家的損益（存入歷史紀錄）
      if (winnerTotal === 0) {
        // 無人押中冠軍：每人退還其所有賭金
        for (const b of bets) {
          const staked = Object.values(betDocMap(b)).reduce((s, a) => s + (Number(a) || 0), 0);
          if (staked > 0) await updateDoc(doc(db, 'players', b.username), { coins: fsIncrement(staked) });
          await updateDoc(doc(db, 'raceBets', b.username), { paid: true, payout: staked, result: 'refund' });
          roundResults.push({ username: b.username, staked, winAmt: 0, payout: staked, net: 0, result: 'refund' });
        }
        toast(`無人押中「${team.name}」，已全額退還 ${bets.length} 筆賭金（共 $${pool}）`);
      } else {
        // 依押中金額佔比瓜分全池（押其他隊的金額視為輸掉，進入彩池）
        let paidOut = 0, winCount = 0;
        for (const b of bets) {
          const m = betDocMap(b);
          const staked = Object.values(m).reduce((s, a) => s + (Number(a) || 0), 0);
          const winAmt = Number(m[wid]) || 0;
          const payout = winAmt > 0 ? Math.floor(winAmt / winnerTotal * pool) : 0;
          if (payout > 0) { await updateDoc(doc(db, 'players', b.username), { coins: fsIncrement(payout) }); paidOut += payout; winCount++; }
          await updateDoc(doc(db, 'raceBets', b.username), { paid: true, payout, result: winAmt > 0 ? 'win' : 'lose' });
          roundResults.push({ username: b.username, staked, winAmt, payout, net: payout - staked, result: winAmt > 0 ? 'win' : 'lose' });
        }
        toast(`開獎完成！彩池 $${pool}，派彩 $${paidOut} 給 ${winCount} 位押中玩家`);
      }
      // ★ 每輪永久紀錄（清空注單也不會消失，用於賭神排行）
      await setDoc(doc(db, 'betRounds', String(Date.now())), {
        winnerId: wid, winnerName: team.name, pool, winnerTotal,
        settledAt: Timestamp.now(), results: roundResults,
      });
      await rtdbSet(ref(rtdb, 'betting'), { open: false, settled: true, winnerId: winnerSel, winnerName: team.name, pool, settledAt: Date.now() });
      setWinnerSel('');
      loadAll();
    } catch (e) { toast('開獎失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };
  const clearBets = async () => {
    const unpaid = adminBets.filter(b => !b.paid).length;
    if (!window.confirm(`確定清空全部 ${adminBets.length} 筆注單並重置賭盤？${unpaid > 0 ? `\n⚠ 其中 ${unpaid} 筆尚未開獎，清空「不會退款」，請先開獎或手動處理！` : ''}`)) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'raceBets'));
      for (const d of snap.docs) await deleteDoc(doc(db, 'raceBets', d.id));
      await rtdbSet(ref(rtdb, 'betting'), { open: false, settled: false });
      toast('注單已清空，可以開新一輪賭盤');
    } catch (e) { toast('清空失敗：' + e.message, 'err'); }
    finally { setBusy(false); }
  };

  // ---------- 樣式速記 ----------
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
  const btn = (bg = '#2563eb') => ({ padding: '9px 18px', background: bg, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' });
  const card = { background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155' };
  const lbl = { fontSize: 10, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: '"Noto Sans TC",-apple-system,sans-serif', paddingBottom: 60 }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #334155', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🛠️</span>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 900 }}>慶典管理後台</h1>
            <p style={{ fontSize: 9, color: '#64748b' }}>{adminUser.email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onLogout('preview')} style={btn('#0d9488')}>👀 以玩家視角預覽</button>
          <button onClick={() => onLogout('logout')} style={btn('#475569')}>登出</button>
        </div>
      </header>

      {msg && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: msg.type === 'err' ? '#7f1d1d' : '#14532d', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700, maxWidth: '90vw' }}>{msg.text}</div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0', overflowX: 'auto' }}>
        {[
          { id: 'dashboard', label: '📊 總覽' },
          { id: 'booths', label: '🏮 攤位管理' },
          { id: 'players', label: '👥 玩家管理' },
          { id: 'race', label: '🚣 龍舟賽控制' },
          { id: 'betlog', label: '💰 賭盤紀錄' },
          { id: 'settings', label: '⚙️ 設定' },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'booths') setEditing(null); }} style={{ flexShrink: 0, padding: '9px 16px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: tab === t.id ? '#1e293b' : 'transparent', color: tab === t.id ? '#fff' : '#64748b' }}>{t.label}</button>
        ))}
      </div>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ===== 總覽 ===== */}
        {tab === 'dashboard' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: '攤位數', val: boothList.length, icon: '🏮' },
                { label: '玩家數', val: playerList.length, icon: '👥' },
                { label: '總集章數', val: playerList.reduce((s, p) => s + (p.stamps || []).length, 0), icon: '📮' },
                { label: '龍舟隊伍', val: teams.length, icon: '🚣' },
              ].map((s, i) => (
                <div key={i} style={{ ...card, textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', margin: '4px 0' }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>各攤位集章統計</p>
              {boothList.map(b => {
                const cnt = playerList.filter(p => (p.stamps || []).includes(b.id)).length;
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #283548' }}>
                    <span style={{ fontSize: 15 }}>{b.emoji}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{b.name}</span>
                    <span style={{ width: 120, height: 5, background: '#0f172a', borderRadius: 3, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, width: `${playerList.length ? (cnt / playerList.length) * 100 : 0}%`, background: '#0d9488' }} />
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 800, width: 30, textAlign: 'right' }}>{cnt}</span>
                  </div>
                );
              })}
              {boothList.length === 0 && <p style={{ fontSize: 11, color: '#64748b' }}>還沒有攤位資料</p>}
            </div>
          </>
        )}

        {/* ===== 攤位管理 ===== */}
        {tab === 'booths' && !editing && (
          <>
            <button onClick={() => setEditing(blankBooth())} style={btn('#0d9488')}>＋ 新增攤位</button>
            {boothList.map(b => (
              <div key={b.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{b.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 800 }}>{b.name} <span style={{ fontSize: 9, color: '#64748b' }}>（{b.side === 'top' ? '上排' : '下排'}）</span></p>
                  <p style={{ fontSize: 10, color: '#94a3b8' }}>{(b.items || []).length} 項商品・ID: {b.id}</p>
                </div>
                <button onClick={() => setEditing({ ...blankBooth(), ...b, items: [...(b.items || [])] })} style={btn('#2563eb')}>編輯</button>
                <button onClick={() => deleteBooth(b.id)} style={btn('#7f1d1d')}>刪除</button>
              </div>
            ))}
          </>
        )}
        {tab === 'booths' && editing && (
          <div style={card}>
            <p style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>{editing.id ? '編輯攤位' : '新增攤位'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>攤位名稱 *</label><input style={inp} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label style={lbl}>Emoji</label><input style={inp} value={editing.emoji} onChange={e => setEditing({ ...editing, emoji: e.target.value })} /></div>
              <div><label style={lbl}>位置</label>
                <select style={inp} value={editing.side} onChange={e => setEditing({ ...editing, side: e.target.value })}>
                  <option value="top">上排</option><option value="bottom">下排</option>
                </select>
              </div>
            </div>
            {[
              ['ownerName', '攤主名稱（噗浪暱稱）'], ['description', '攤位介紹'], ['plurkUrl', '噗浪連結'], ['task', '集章任務說明'],
              ['stampImageUrl', '印章圖網址（噗浪圖床）'], ['facadeImageUrl', '封面圖網址'], ['stampHint', '印章備註（選填）'],
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={lbl}>{label}</label>
                {key === 'description' || key === 'task'
                  ? <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={editing[key]} onChange={e => setEditing({ ...editing, [key]: e.target.value })} />
                  : <input style={inp} value={editing[key]} onChange={e => setEditing({ ...editing, [key]: e.target.value })} />}
              </div>
            ))}
            <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', margin: '14px 0 8px' }}>商品（{editing.items.length}）</p>
            {editing.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1.4fr 1fr 50px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input style={inp} placeholder="商品名" value={it.name || ''} onChange={e => { const arr = [...editing.items]; arr[i] = { ...it, name: e.target.value }; setEditing({ ...editing, items: arr }); }} />
                <input style={inp} placeholder="價格" type="number" value={it.price ?? ''} onChange={e => { const arr = [...editing.items]; arr[i] = { ...it, price: e.target.value }; setEditing({ ...editing, items: arr }); }} />
                <input style={inp} placeholder="說明" value={it.description || ''} onChange={e => { const arr = [...editing.items]; arr[i] = { ...it, description: e.target.value }; setEditing({ ...editing, items: arr }); }} />
                <input style={inp} placeholder="圖片網址（建議去背PNG）" value={it.imageUrl || ''} onChange={e => { const arr = [...editing.items]; arr[i] = { ...it, imageUrl: e.target.value }; setEditing({ ...editing, items: arr }); }} />
                <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })} style={{ ...btn('#7f1d1d'), padding: '9px 0' }}>✕</button>
              </div>
            ))}
            <button onClick={() => setEditing({ ...editing, items: [...editing.items, { name: '', price: 0, description: '', imageUrl: '' }] })} style={{ ...btn('#334155'), marginBottom: 14 }}>＋ 加一項商品</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveBooth} disabled={busy} style={btn('#0d9488')}>{busy ? '儲存中...' : '💾 儲存攤位'}</button>
              <button onClick={() => setEditing(null)} style={btn('#475569')}>取消</button>
            </div>
          </div>
        )}

        {/* ===== 玩家管理 ===== */}
        {tab === 'players' && (
          <>
            <div style={card}>
              <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>批次建立玩家</p>
              <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>每行一位：「暱稱,密碼」，密碼省略時預設 0000</p>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder={'小明,1234\n小華'} value={batchText} onChange={e => setBatchText(e.target.value)} />
              <button onClick={batchCreate} disabled={busy} style={{ ...btn('#0d9488'), marginTop: 8 }}>{busy ? '建立中...' : '＋ 批次建立'}</button>
            </div>
            <div style={card}>
              <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>玩家名單（{playerList.length}）</p>
              {playerList.map(p => (
                <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #283548', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 800, minWidth: 90 }}>{p.username}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>🪙{p.coins ?? 0}・📮{(p.stamps || []).length}章・🛍️{(p.inventory || []).length}件</span>
                  <input style={{ ...inp, width: 84, padding: '6px 8px' }} placeholder="設金額" value={coinInput[p.username] || ''} onChange={e => setCoinInput(prev => ({ ...prev, [p.username]: e.target.value }))} />
                  <button onClick={() => setPlayerCoins(p.username)} style={{ ...btn('#2563eb'), padding: '7px 12px' }}>設定</button>
                  <button onClick={() => renamePlayer(p.username)} disabled={busy} style={{ ...btn('#475569'), padding: '7px 12px' }}>改名</button>
                  <button onClick={() => deletePlayer(p.username)} style={{ ...btn('#7f1d1d'), padding: '7px 12px' }}>刪除</button>
                </div>
              ))}
              {playerList.length === 0 && <p style={{ fontSize: 11, color: '#64748b' }}>還沒有玩家</p>}
            </div>
          </>
        )}

        {/* ===== 龍舟賽控制 ===== */}
        {tab === 'race' && (
          <>
            <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 140 }}><label style={lbl}>隊伍名稱</label><input style={inp} value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} /></div>
              <div><label style={lbl}>顏色</label><input type="color" style={{ ...inp, width: 60, padding: 4, height: 38 }} value={newTeam.color} onChange={e => setNewTeam({ ...newTeam, color: e.target.value })} /></div>
              <div style={{ flex: 2, minWidth: 140 }}><label style={lbl}>隊旗圖網址（選填）</label><input style={inp} value={newTeam.flagImageUrl} onChange={e => setNewTeam({ ...newTeam, flagImageUrl: e.target.value })} /></div>
              <button onClick={addTeam} style={btn('#0d9488')}>＋ 加入隊伍</button>
              <button onClick={clearCheers} style={btn('#475569')}>📣 歸零打氣</button>
              <button onClick={clearEvents} style={btn('#475569')}>🧹 清除事件紀錄</button>
              <button onClick={resetRace} style={btn('#7f1d1d')}>🔄 重置整場比賽</button>
            </div>

            {/* 賭盤控制 */}
            {(() => {
              const { pool, totals } = betPoolAdmin();
              return (
                <div style={{ ...card, border: '1px solid #b7791f' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16 }}>🎰</span>
                    <span style={{ fontSize: 13, fontWeight: 900, flex: 1 }}>龍舟賭盤（彩池制）</span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: betMeta.settled ? '#78350f' : betMeta.open ? '#14532d' : '#334155', color: '#fff' }}>
                      {betMeta.settled ? `已開獎：${betMeta.winnerName || ''}` : betMeta.open ? '開盤中' : '封盤中'}
                    </span>
                    {betMeta.open
                      ? <button onClick={closeBetting} style={btn('#b45309')}>🔒 封盤</button>
                      : <button onClick={openBetting} style={btn('#0d9488')}>🔔 開盤</button>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontFamily: 'monospace' }}>總彩池 ${pool}・共 {adminBets.length} 筆注單</div>
                  {teams.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #283548' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{t.name}</span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{adminBets.filter(b => (Number(betDocMap(b)[String(t.id)]) || 0) > 0).length} 人押・${totals[String(t.id)] || 0}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 900, color: totals[String(t.id)] ? '#34d399' : '#475569', width: 60, textAlign: 'right' }}>
                        {totals[String(t.id)] ? (pool / totals[String(t.id)]).toFixed(1) + 'x' : '—'}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select style={{ ...inp, flex: 1, minWidth: 140 }} value={winnerSel} onChange={e => setWinnerSel(e.target.value)}>
                      <option value="">— 選擇冠軍隊伍 —</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={settleBets} disabled={busy || betMeta.settled} style={btn(betMeta.settled ? '#475569' : '#b7791f')}>{busy ? '處理中...' : '🏆 開獎派彩'}</button>
                    <button onClick={clearBets} disabled={busy} style={btn('#7f1d1d')}>🗑 清空注單（開新一輪）</button>
                  </div>
                  <p style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>流程：開盤 → 玩家下注 → 開賽前封盤 → 比賽結束選冠軍開獎 → 清空注單準備下一輪。無人押中冠軍時會自動全額退款。</p>
                </div>
              );
            })()}

            {teams.map(team => {
              const sel = eventSel[team.id] || '';
              const atTurn = team.outboundScore >= 200 && !team.turnSuccess;
              return (
                <div key={team.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: team.color }} />
                    <span style={{ fontSize: 14, fontWeight: 900, flex: 1 }}>{team.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>去程 {team.outboundScore}/200・回程 {team.inboundScore}/200・💖{team.cheers}</span>
                    <button onClick={() => deleteTeam(team.id)} style={{ ...btn('#7f1d1d'), padding: '6px 10px' }}>刪除</button>
                  </div>

                  {/* 折返控制 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: atTurn ? '#f59e0b' : '#64748b' }}>{atTurn ? '⚑ 到達折返點！' : team.turnSuccess ? '✓ 已奪旗，回程中' : '去程划行中'}</span>
                    <button onClick={() => updateTeamField(team.id, 'turnSuccess', !team.turnSuccess)} style={{ ...btn(team.turnSuccess ? '#475569' : '#b45309'), padding: '6px 12px' }}>
                      {team.turnSuccess ? '取消奪旗狀態' : '標記奪旗成功'}
                    </button>
                  </div>

                  {/* 擲骰 + 事件（第5點需求） */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr auto auto', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label style={lbl}>本輪擲骰（逗號分隔）</label>
                      <input style={inp} placeholder="例：15,20,3,8" value={rollsInput[team.id] || ''} onChange={e => setRollsInput(p => ({ ...p, [team.id]: e.target.value }))} />
                    </div>
                    <div>
                      <label style={lbl}>本輪事件</label>
                      <select style={inp} value={sel} onChange={e => setEventSel(p => ({ ...p, [team.id]: e.target.value }))}>
                        <option value="">— 本輪無事件 —</option>
                        {RACE_EVENTS.map(ev => <option key={ev.id} value={ev.id}>{ev.name}（{ev.delta >= 0 ? '+' : ''}{ev.delta}）</option>)}
                        <option value="custom">✏️ 自訂事件…</option>
                      </select>
                    </div>
                    <button onClick={() => { const p = RACE_EVENTS[Math.floor(Math.random() * RACE_EVENTS.length)]; setEventSel(prev => ({ ...prev, [team.id]: p.id })); }} style={{ ...btn('#334155'), padding: '9px 12px' }} title="隨機抽一個預設事件">🎲 隨機</button>
                    <button onClick={() => processTeamRolls(team)} style={btn('#0d9488')}>結算本輪</button>
                  </div>
                  {sel === 'custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginTop: 8 }}>
                      <input style={inp} placeholder="事件名稱（例：災厄鮭襲擊）" value={(customEvent[team.id] || {}).name || ''} onChange={e => setCustomEvent(p => ({ ...p, [team.id]: { ...(p[team.id] || {}), name: e.target.value } }))} />
                      <input style={inp} type="number" placeholder="增減點數（例：-5）" value={(customEvent[team.id] || {}).delta ?? ''} onChange={e => setCustomEvent(p => ({ ...p, [team.id]: { ...(p[team.id] || {}), delta: e.target.value } }))} />
                    </div>
                  )}
                  {team.lastEvent && <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>上輪事件：{team.lastEvent.name}（{team.lastEvent.delta >= 0 ? '+' : ''}{team.lastEvent.delta}）</p>}
                </div>
              );
            })}
            {teams.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#64748b', fontSize: 12 }}>還沒有隊伍，先在上面加入吧</div>}
          </>
        )}

        {/* ===== 賭盤紀錄 ===== */}
        {tab === 'betlog' && (
          <>
            {(() => {
              const agg = {};
              betRounds.forEach(r => (r.results || []).forEach(x => {
                if (!agg[x.username]) agg[x.username] = { staked: 0, payout: 0, net: 0, wins: 0, rounds: 0 };
                const a = agg[x.username];
                a.staked += Number(x.staked) || 0;
                a.payout += Number(x.payout) || 0;
                a.net += Number(x.net) || 0;
                if (x.result === 'win') a.wins++;
                a.rounds++;
              }));
              const rank = Object.entries(agg).map(([username, v]) => ({ username, ...v })).sort((a, b) => b.net - a.net);
              return (
                <div style={{ ...card, border: '1px solid #b7791f' }}>
                  <p style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>💰 累計賭神榜（依淨損益排序）</p>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 10 }}>統計全部 {betRounds.length} 輪開獎・淨損益 = 總派彩 − 總下注</p>
                  {rank.length === 0 && <p style={{ fontSize: 11, color: '#64748b' }}>還沒有開獎紀錄，第一次開獎後這裡會自動累計</p>}
                  {rank.map((p, i) => (
                    <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #283548', flexWrap: 'wrap' }}>
                      <span style={{ width: 26, fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: i < 3 ? '#fbbf24' : '#64748b', flexShrink: 0 }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 800, minWidth: 80 }}>{p.username}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>參與 {p.rounds} 輪・中 {p.wins} 次</span>
                      <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>下注 ${p.staked}・派彩 ${p.payout}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', width: 76, textAlign: 'right', color: p.net > 0 ? '#34d399' : p.net < 0 ? '#f87171' : '#94a3b8' }}>{p.net > 0 ? '+' : ''}{p.net}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {betRounds.map(r => (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 900, flex: 1 }}>🏆 冠軍「{r.winnerName}」・彩池 ${r.pool}</span>
                  <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{new Date(Number(r.id)).toLocaleString('zh-TW', { hour12: false })}</span>
                  <button onClick={async () => {
                    if (!window.confirm('刪除這一輪的紀錄？（不影響已派彩的金額）')) return;
                    await deleteDoc(doc(db, 'betRounds', r.id));
                    toast('紀錄已刪除'); loadAll();
                  }} style={{ ...btn('#7f1d1d'), padding: '5px 10px', fontSize: 10 }}>刪除</button>
                </div>
                {(r.results || []).slice().sort((a, b) => (b.payout || 0) - (a.payout || 0)).map((x, i) => (
                  <div key={x.username + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #283548' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 8px', borderRadius: 5, flexShrink: 0, background: x.result === 'win' ? '#14532d' : x.result === 'refund' ? '#334155' : '#450a0a', color: x.result === 'win' ? '#86efac' : x.result === 'refund' ? '#cbd5e1' : '#fca5a5' }}>
                      {x.result === 'win' ? '押中' : x.result === 'refund' ? '退款' : '未中'}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{x.username}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>下注 ${x.staked}・獲得 ${x.payout}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', width: 64, textAlign: 'right', color: (x.net || 0) > 0 ? '#34d399' : (x.net || 0) < 0 ? '#f87171' : '#94a3b8' }}>{(x.net || 0) > 0 ? '+' : ''}{x.net || 0}</span>
                  </div>
                ))}
              </div>
            ))}
            {betRounds.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#64748b', fontSize: 12 }}>尚無開獎紀錄</div>}
          </>
        )}

        {/* ===== 設定 ===== */}
        {tab === 'settings' && (
          <div style={card}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={settings.registrationOpen} onChange={e => setSettings({ ...settings, registrationOpen: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 800 }}>開放新玩家登記</span>
            </label>
            <label style={lbl}>關閉登記時顯示的訊息</label>
            <input style={inp} value={settings.registrationClosedMsg} onChange={e => setSettings({ ...settings, registrationClosedMsg: e.target.value })} placeholder="目前尚未開放新玩家登記" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div>
                <label style={lbl}>初始購物金（新玩家註冊/批次建立時發放）</label>
                <input style={inp} type="number" min="1" value={settings.initialCoins} onChange={e => setSettings({ ...settings, initialCoins: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>集章獎勵金（每領一個章獲得）</label>
                <input style={inp} type="number" min="1" value={settings.stampReward} onChange={e => setSettings({ ...settings, stampReward: e.target.value })} />
              </div>
            </div>
            <p style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>※ 只影響之後的註冊與集章，不會回溯調整已發出的金額</p>
            <button onClick={saveSettings} style={{ ...btn('#0d9488'), marginTop: 12 }}>💾 儲存設定</button>
          </div>
        )}
      </main>
    </div>
  );
}
