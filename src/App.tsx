/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, FormEvent } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  MapPin, 
  Users, 
  History, 
  PlusCircle, 
  Trophy, 
  LogOut, 
  LogIn,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  LayoutDashboard,
  Lock
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { DriverList } from './components/DriverList';
import { DestinationList } from './components/DestinationList';
import { TripHistory } from './components/TripHistory';
import { LogTrip } from './components/LogTrip';
import { syncOfficialTeam, syncOfficialDestinations } from './services/dbSetup';

type View = 'dashboard' | 'drivers' | 'destinations' | 'history' | 'log-trip';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      if (u) {
        // Automatically enable admin mode for the owner
        if (u.email === 'davidivanromeromv@gmail.com') {
          setIsAdminMode(true);
        }

        // Auto setup on auth
        const setupData = async () => {
          try {
            await syncOfficialTeam();
            await syncOfficialDestinations();
          } catch (err) {
            console.error("Auto setup error:", err);
          }
        };
        setupData();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAdminAuth = (e: FormEvent) => {
    e.preventDefault();
    if (adminCode === 'flotilla') {
      setIsAdminMode(true);
      setShowAdminInput(false);
      setAdminCode('');
    } else {
      alert('Código incorrecto');
      setAdminCode('');
    }
  };

  const toggleAdminMode = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      return;
    }
    setShowAdminInput(!showAdminInput);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-national-green text-white p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-national-yellow"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-xl p-10 rounded-[2rem] border border-white/10 shadow-2xl text-center z-10"
        >
          <div className="w-24 h-24 bg-white p-4 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
            <div className="text-national-green font-black text-2xl leading-none">National</div>
          </div>
          <h1 className="text-3xl font-black mb-2 tracking-tight uppercase">Control de Traslados</h1>
          <p className="text-green-100/70 mb-10 font-medium">CDMX Operations • Asignación Imparcial</p>
          
          <button
            onClick={loginWithGoogle}
            className="w-full bg-national-yellow text-national-green font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-950/20 active:scale-95 uppercase tracking-wider"
          >
            <LogIn size={20} />
            Acceder al Sistema
          </button>
          
          <p className="mt-10 text-[10px] text-green-200/40 uppercase tracking-[0.3em] font-black">
            National Car Rental Systems
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-national-green text-white flex flex-col p-6 z-20 border-r-4 border-national-yellow/20">
        <div className="flex items-center gap-4 mb-10">
          <div className="bg-white px-2 py-1.5 rounded-sm">
            <div className="text-national-green font-black text-lg leading-none">National</div>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="font-black text-[10px] leading-tight uppercase tracking-widest text-national-yellow">
            CDMX<br/>OFFICE
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard size={18} />}
            label="DASHBOARD"
          />
          {isAdminMode && (
            <NavItem 
              active={currentView === 'log-trip'} 
              onClick={() => setCurrentView('log-trip')}
              icon={<PlusCircle size={18} />}
              label="NUEVO TRASLADO"
            />
          )}
          <NavItem 
            active={currentView === 'history'} 
            onClick={() => setCurrentView('history')}
            icon={<History size={18} />}
            label="HISTORIAL"
          />
          <div className="pt-8 pb-3 text-[10px] font-black text-green-300/40 uppercase tracking-[0.2em]">
            CONTROL ADMIN
          </div>
          <NavItem 
            active={currentView === 'drivers'} 
            onClick={() => setCurrentView('drivers')}
            icon={<Users size={18} />}
            label="COLABORADORES"
          />
          <NavItem 
            active={currentView === 'destinations'} 
            onClick={() => setCurrentView('destinations')}
            icon={<MapPin size={18} />}
            label="DESTINOS"
          />
          <div className="space-y-1">
            <button 
              onClick={toggleAdminMode}
              className={`w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                isAdminMode 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                  : 'bg-white/5 text-white/40 hover:text-white border border-transparent'
              }`}
            >
              <Lock size={14} className={isAdminMode ? 'text-red-400' : 'text-white/20'} />
              {isAdminMode ? 'CERRAR SESIÓN ADMIN' : showAdminInput ? 'CANCELAR' : 'DESBLOQUEAR ADMIN'}
            </button>

            {showAdminInput && !isAdminMode && (
              <motion.form 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAdminAuth}
                className="px-2 pb-2"
              >
                <input 
                  autoFocus
                  type="password"
                  placeholder="Password..."
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-national-yellow/30 text-white placeholder:text-white/20"
                />
              </motion.form>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6 bg-white/5 p-3 rounded-2xl border border-white/10">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-full border border-white/20 shadow-sm" 
              alt="Avatar"
            />
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-tight truncate text-white">{user.displayName}</p>
              <p className="text-[9px] text-green-200/50 truncate font-medium">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-3 text-[10px] font-black text-white bg-white/10 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition-all uppercase tracking-widest"
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && <Dashboard onLogTrip={() => setCurrentView('log-trip')} isAdmin={isAdminMode} />}
            {currentView === 'drivers' && <DriverList isAdmin={isAdminMode} />}
            {currentView === 'destinations' && <DestinationList isAdmin={isAdminMode} />}
            {currentView === 'history' && <TripHistory isAdmin={isAdminMode} />}
            {currentView === 'log-trip' && <LogTrip onComplete={() => setCurrentView('dashboard')} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black tracking-widest transition-all ${
        active 
          ? 'bg-national-yellow text-national-green shadow-xl shadow-national-yellow/10' 
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={active ? 'text-national-green' : 'text-green-300/40'}>{icon}</span>
      {label}
    </button>
  );
}
