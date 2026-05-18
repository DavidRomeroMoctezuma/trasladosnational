import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Driver } from '../types';
import { syncOfficialTeam } from '../services/dbSetup';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, UserPlus, Trash2, UserCheck, UserX, Search, Edit2, ArrowDownToLine } from 'lucide-react';

export function DriverList({ isAdmin = false }: { isAdmin?: boolean }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('queuePosition', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(docs);
    });
    return () => unsub();
  }, []);

  const addDriver = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return;
    try {
      if (editingDriver) {
        await updateDoc(doc(db, 'drivers', editingDriver.id), {
          firstName,
          lastName
        });
        setEditingDriver(null);
      } else {
        const nextPos = drivers.length > 0 ? Math.max(...drivers.map(d => d.queuePosition)) + 1 : 0;
        await addDoc(collection(db, 'drivers'), {
          firstName,
          lastName,
          totalPoints: 0,
          active: true,
          queuePosition: nextPos
        });
      }
      setFirstName('');
      setLastName('');
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  };

  const moveToBottom = async (driver: Driver) => {
    try {
      const maxPos = drivers.length > 0 ? Math.max(...drivers.map(d => d.queuePosition)) : 0;
      await updateDoc(doc(db, 'drivers', driver.id), {
        queuePosition: maxPos + 1
      });
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFirstName(driver.firstName);
    setLastName(driver.lastName);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingDriver(null);
    setFirstName('');
    setLastName('');
    setIsAdding(false);
  };

  const toggleStatus = async (driver: Driver) => {
    try {
      await updateDoc(doc(db, 'drivers', driver.id), {
        active: !driver.active
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDriver = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este colaborador? Se borrará su historial de puntos.')) return;
    try {
      await deleteDoc(doc(db, 'drivers', id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDrivers = drivers.filter(d => 
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Equipo de Colaboradores</h2>
          <p className="text-slate-500 font-medium">Gestión de personal operativo en CDMX.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-national-green text-white font-black py-4 px-8 rounded-xl flex items-center gap-3 hover:bg-green-900 transition-all shadow-xl shadow-national-green/10 uppercase text-xs tracking-widest active:scale-95"
            >
              {isAdding ? <Plus className="rotate-45" size={20} /> : <UserPlus size={20} />}
              {isAdding ? 'CANCELAR' : 'NUEVO COLABORADOR'}
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
            <form onSubmit={addDriver} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Nombre</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300"
                  placeholder="Ej. Daniel"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Apellidos</label>
                <input 
                  type="text" 
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300"
                  placeholder="Ej. Flores"
                  required
                />
              </div>
              <div className="flex items-end gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-national-green text-white font-black h-14 rounded-xl hover:bg-green-900 transition-all shadow-lg uppercase tracking-widest text-xs"
                >
                  {editingDriver ? 'Guardar Cambios' : 'Confirmar Alta'}
                </button>
                {editingDriver && (
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    className="px-6 bg-slate-100 text-slate-500 font-black h-14 rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar colaborador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntos Totales</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus Operativo</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDrivers.map((driver, index) => (
                <tr key={driver.id} className="hover:bg-green-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${driver.active ? 'bg-national-green text-white' : 'bg-slate-200 text-slate-500 shadow-inner'}`}>
                        {index + 1}
                      </div>
                      <span className="font-bold text-slate-800 text-sm">{driver.firstName} {driver.lastName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-national-green text-lg">{driver.totalPoints}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] ${
                      driver.active 
                        ? 'bg-green-100 text-national-green' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${driver.active ? 'bg-national-green animate-pulse' : 'bg-slate-400'}`} />
                      {driver.active ? 'Operativo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => moveToBottom(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-yellow bg-white border-slate-100 rounded-xl border transition-all shadow-sm"
                            title="No puede/quiere - Al final"
                          >
                            <ArrowDownToLine size={18} />
                          </button>
                          <button 
                            onClick={() => startEdit(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-green bg-white border-slate-100 rounded-xl border transition-all shadow-sm"
                            title="Editar nombre"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => toggleStatus(driver)}
                            className={`p-2.5 rounded-xl border transition-all shadow-sm ${
                              driver.active 
                                ? 'text-slate-400 hover:text-red-600 bg-white border-slate-100' 
                                : 'text-slate-400 hover:text-national-green bg-white border-slate-100'
                            }`}
                            title={driver.active ? "Desactivar" : "Activar"}
                          >
                            {driver.active ? <UserX size={18} /> : <UserCheck size={18} />}
                          </button>
                          <button 
                            onClick={() => deleteDriver(driver.id)}
                            className="p-2.5 text-slate-400 hover:text-red-600 bg-white border-slate-100 rounded-xl border transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      {!isAdmin && (
                         <button 
                          onClick={() => moveToBottom(driver)}
                          className="p-2.5 text-slate-400 hover:text-national-yellow bg-white border-slate-100 rounded-xl border transition-all shadow-sm"
                          title="No puede/quiere - Al final"
                        >
                          <ArrowDownToLine size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDrivers.length === 0 && (
            <div className="text-center py-20 bg-slate-50/50">
              <UserX size={48} className="text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Sin resultados operativos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
