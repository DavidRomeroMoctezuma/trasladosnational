import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Destination, TripType } from '../types';
import { syncOfficialDestinations } from '../services/dbSetup';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, MapPin, Trash2, Edit2, TrendingUp, TrendingDown, Info } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

export function DestinationList({ isAdmin = false }: { isAdmin?: boolean }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<TripType>('short');
  const [points, setPoints] = useState(1);
  const [payment, setPayment] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'destinations'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination));
      setDestinations(docs);
    });
    return () => unsub();
  }, []);

  const addDestination = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await addDoc(collection(db, 'destinations'), {
        name,
        type,
        pointsValue: points,
        paymentAmount: payment
      });
      setName('');
      setPayment(0);
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDestination = async (id: string) => {
    if (!confirm('¿Eliminar este destino?')) return;
    try {
      await deleteDoc(doc(db, 'destinations', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Catalogo de Destinos</h2>
          <p className="text-slate-500 font-medium">Configuración de rutas y puntajes en CDMX.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-national-green text-white font-black py-4 px-8 rounded-xl flex items-center gap-3 hover:bg-green-900 transition-all shadow-xl shadow-national-green/10 uppercase text-xs tracking-widest active:scale-95"
            >
              {isAdding ? <Plus className="rotate-45" size={20} /> : <MapPin size={20} />}
              {isAdding ? 'CANCELAR' : 'NUEVO DESTINO'}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl"
          >
            <form onSubmit={addDestination} className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Ciudad / Lugar</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300"
                  placeholder="Ej. Queretaro"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Tipo de Viaje</label>
                <div className="relative">
                  <select 
                    value={type}
                    onChange={e => {
                      const newType = e.target.value as TripType;
                      setType(newType);
                      setPoints(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold appearance-none text-sm"
                  >
                    <option value="short">Cercano (Tráfico)</option>
                    <option value="long">Lejano (Lujoso)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Valor (Servicios)</label>
                <input 
                  type="number" 
                  value={points}
                  onChange={e => setPoints(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Pago ($)</label>
                <input 
                  type="number" 
                  value={payment}
                  onChange={e => setPayment(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300"
                  required
                />
              </div>
              <div className="md:col-span-5 flex flex-col md:flex-row items-center justify-between bg-national-green/5 p-6 rounded-2xl border border-national-green/10 gap-4">
                <div className="flex items-center gap-3 text-xs text-national-green font-bold uppercase tracking-wide">
                  <Info size={18} />
                  <span>
                    Cada traslado cuenta como 1 servicio realizado para el colaborador.
                  </span>
                </div>
                <button 
                  type="submit"
                  className="w-full md:w-auto bg-national-green text-white font-black h-12 px-10 rounded-xl hover:bg-green-900 transition-all shadow-lg uppercase tracking-widest text-xs"
                >
                  Registrar Destino
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {destinations.map(dest => (
          <div key={dest.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
            <div className={`absolute top-0 right-0 w-3 h-full ${dest.type === 'short' ? 'bg-national-yellow' : 'bg-national-green'}`} />
            
            <div className="flex items-start justify-between mb-6">
              <div className={`p-4 rounded-2xl ${dest.type === 'short' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {dest.type === 'short' ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => deleteDestination(dest.id)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-1 uppercase tracking-tighter">{dest.name}</h3>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-8 ${dest.type === 'short' ? 'text-amber-600' : 'text-emerald-600'}`}>
              Ruta {dest.type === 'short' ? 'Cercana / CDMX' : 'Foránea / Larga'}
            </p>

            <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Valor</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-national-green font-mono">+{dest.pointsValue}</span>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">SERV</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Pago</p>
                <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(dest.paymentAmount)}</p>
              </div>
            </div>
          </div>
        ))}
        {destinations.length === 0 && (
          <div className="md:col-span-3 text-center py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2rem]">
            <MapPin size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay destinos en el catálogo</p>
          </div>
        )}
      </div>
    </div>
  );
}
