import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Driver } from '../types';
import { syncOfficialTeam } from '../services/dbSetup';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, UserPlus, Trash2, UserCheck, UserX, Search, Edit2, ArrowDownToLine, History, Calendar, MapPin, AlertCircle, X, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function DriverList({ isAdmin = false }: { isAdmin?: boolean }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [billingStatus, setBillingStatus] = useState<'ok' | 'delayed'>('ok');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // States for individual collaborator history modal
  const [selectedDriverForHistory, setSelectedDriverForHistory] = useState<Driver | null>(null);
  const [driverTripsHistory, setDriverTripsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('queuePosition', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(docs);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedDriverForHistory) {
      setDriverTripsHistory([]);
      return;
    }
    setLoadingHistory(true);
    const q = query(
      collection(db, 'trips'),
      where('driverId', '==', selectedDriverForHistory.id),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDriverTripsHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingHistory(false);
    }, (error) => {
      console.error("Error fetching individual history:", error);
      setLoadingHistory(false);
    });
    return () => unsub();
  }, [selectedDriverForHistory]);

  const addDriver = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return;
    try {
      if (editingDriver) {
        await updateDoc(doc(db, 'drivers', editingDriver.id), {
          firstName,
          lastName,
          billingStatus
        });
        setEditingDriver(null);
      } else {
        const nextPos = drivers.length > 0 ? Math.max(...drivers.map(d => d.queuePosition)) + 1 : 0;
        await addDoc(collection(db, 'drivers'), {
          firstName,
          lastName,
          totalPoints: 0,
          active: true,
          queuePosition: nextPos,
          billingStatus
        });
      }
      setFirstName('');
      setLastName('');
      setBillingStatus('ok');
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
    setBillingStatus(driver.billingStatus || 'ok');
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingDriver(null);
    setFirstName('');
    setLastName('');
    setBillingStatus('ok');
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
            <form onSubmit={addDriver} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Nombre</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300 animate-fade-in"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold placeholder:text-slate-300 animate-fade-in"
                  placeholder="Ej. Flores"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Facturación / Tickets</label>
                <select
                  value={billingStatus}
                  onChange={e => setBillingStatus(e.target.value as 'ok' | 'delayed')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-national-green/5 transition-all font-bold cursor-pointer"
                >
                  <option value="ok">AL CORRIENTE (FACTURA / REPORTE OK)</option>
                  <option value="delayed">CON DEMORAS (CON RETRASOS / TICKETS PENDIENTES)</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-national-green text-white font-black h-14 rounded-xl hover:bg-green-900 transition-all shadow-lg uppercase tracking-widest text-xs cursor-pointer"
                >
                  {editingDriver ? 'Guardar' : 'Confirmar'}
                </button>
                {editingDriver && (
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    className="px-6 bg-slate-100 text-slate-500 font-black h-14 rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs cursor-pointer"
                  >
                    X
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
                <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizados</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Negados</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturación / Tickets</th>
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
                  <td className="px-8 py-6 text-center">
                    <span className="font-mono font-bold text-slate-700 text-base">{driver.tripsCompleted || 0}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="font-mono font-bold text-red-500 text-base">{driver.tripsDenied || 0}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight ${
                      driver.billingStatus === 'delayed'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-green-50 text-national-green border border-green-150'
                    }`}>
                      {driver.billingStatus === 'delayed' ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Con demoras (Pendiente)</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-national-green" />
                          <span>Al corriente (OK)</span>
                        </>
                      )}
                    </span>
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
                            onClick={() => setSelectedDriverForHistory(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-green bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="Ver Historial Individual"
                          >
                            <History size={18} />
                          </button>
                          <button 
                            onClick={() => moveToBottom(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-yellow bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="No puede/quiere - Al final"
                          >
                            <ArrowDownToLine size={18} />
                          </button>
                          <button 
                            onClick={() => startEdit(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-green bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="Editar nombre"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => toggleStatus(driver)}
                            className={`p-2.5 rounded-xl border transition-all shadow-sm cursor-pointer ${
                              driver.active 
                                ? 'text-slate-400 hover:text-red-600 bg-white border-slate-100' 
                                : 'text-slate-300 hover:text-national-green bg-white border-slate-100'
                            }`}
                            title={driver.active ? "Desactivar" : "Activar"}
                          >
                            {driver.active ? <UserX size={18} /> : <UserCheck size={18} />}
                          </button>
                          <button 
                            onClick={() => deleteDriver(driver.id)}
                            className="p-2.5 text-slate-400 hover:text-red-600 bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      {!isAdmin && (
                        <>
                          <button 
                            onClick={() => setSelectedDriverForHistory(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-green bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="Ver Historial Individual"
                          >
                            <History size={18} />
                          </button>
                          <button 
                            onClick={() => moveToBottom(driver)}
                            className="p-2.5 text-slate-400 hover:text-national-yellow bg-white border-slate-100 rounded-xl border transition-all shadow-sm cursor-pointer"
                            title="No puede/quiere - Al final"
                          >
                            <ArrowDownToLine size={18} />
                          </button>
                        </>
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

      {/* Individual History Slide-over/Modal */}
      <AnimatePresence>
        {selectedDriverForHistory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] max-w-2xl w-full p-8 shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col h-[80vh] max-h-[700px]"
            >
              <button
                onClick={() => setSelectedDriverForHistory(null)}
                className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="w-12 h-12 bg-national-green/10 text-national-green rounded-xl flex items-center justify-center">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial Individual</h3>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                    {selectedDriverForHistory.firstName} {selectedDriverForHistory.lastName}
                  </h4>
                </div>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Puntos</p>
                  <p className="text-2xl font-black font-mono text-national-green mt-1">
                    {selectedDriverForHistory.totalPoints}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Completados</p>
                  <p className="text-2xl font-black font-mono text-slate-800 mt-1">
                    {selectedDriverForHistory.tripsCompleted || 0}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Negados</p>
                  <p className="text-2xl font-black font-mono text-red-600 mt-1">
                    {selectedDriverForHistory.tripsDenied || 0}
                  </p>
                </div>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loadingHistory ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-national-green border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : driverTripsHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <History className="text-slate-200 mb-3" size={48} />
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sin registros históricos</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {driverTripsHistory.map((trip) => {
                      const isDenied = trip.status === 'denied';
                      return (
                        <div 
                          key={trip.id} 
                          className={`p-5 rounded-2xl border transition-all ${
                            isDenied 
                              ? 'border-red-100 bg-red-50/20' 
                              : 'border-slate-100 bg-white hover:border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="flex items-center gap-2">
                              {isDenied ? (
                                <AlertCircle size={14} className="text-red-500" />
                              ) : (
                                <MapPin size={14} className="text-national-green" />
                              )}
                              <span className={`font-black uppercase tracking-tight text-sm ${
                                isDenied ? 'text-red-700' : 'text-slate-800'
                              }`}>
                                {isDenied 
                                  ? `TRASLADO NEGADO (${trip.offeredType === 'short' ? 'CORTO' : 'LARGO'})` 
                                  : trip.destinationName
                                }
                              </span>
                            </div>

                            {!isDenied && (
                              <span className="text-xs bg-green-50 text-national-green px-2 py-1 rounded-lg font-black font-mono">
                                +{trip.pointsEarned} SERV
                              </span>
                            )}
                          </div>

                          {isDenied && (
                            <div className="bg-red-50/50 p-2.5 rounded-xl border border-red-100/30 mb-2 flex items-center gap-2">
                              <span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase tracking-wider">
                                Razón
                              </span>
                              <span className="text-xs font-bold text-red-600 uppercase tracking-tight">
                                "{trip.deniedReason || 'No especificado'}"
                              </span>
                            </div>
                          )}

                          {!isDenied && trip.foodAllowance !== undefined && trip.foodAllowance > 0 && (
                            <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/30 mb-2 flex items-center justify-between">
                              <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-wider">
                                Viáticos de Comida
                              </span>
                              <span className="text-xs font-black font-mono text-amber-600">
                                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(trip.foodAllowance)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100/50 mt-2 font-semibold font-mono">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} />
                              <span>
                                {format(new Date(trip.date), "dd MMMM yyyy, HH:mm", { locale: es })}
                              </span>
                            </div>
                            {!isDenied && (
                              <span className="uppercase tracking-wider font-extrabold text-[9px] text-national-green bg-green-50 px-2 py-0.5 rounded">
                                {trip.serviceType || 'subida'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Close footer button */}
              <div className="pt-4 border-t border-slate-100 mt-6 font-sans">
                <button
                  onClick={() => setSelectedDriverForHistory(null)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  Cerrar Historial
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
