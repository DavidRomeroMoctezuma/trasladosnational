import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Driver, Destination, Trip, ServiceType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  MapPin, 
  User, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Clock,
  Sparkles,
  Repeat,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

interface LogTripProps {
  onComplete: () => void;
}

export function LogTrip({ onComplete }: LogTripProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDestId, setSelectedDestId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('subida');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New States for custom billing and acceptance choices
  const [tripStatus, setTripStatus] = useState<'completed' | 'denied'>('completed');
  const [foodAllowance, setFoodAllowance] = useState<number | ''>('');
  const [deniedReason, setDeniedReason] = useState<'no quiso' | 'esta en turno' | 'tiene chofereada' | 'sin opcion por faltas'>('no quiso');
  const [offeredType, setOfferedType] = useState<'short' | 'long'>('short');

  useEffect(() => {
    const unsubDrivers = onSnapshot(query(collection(db, 'drivers'), orderBy('queuePosition', 'asc')), (snap) => {
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    });
    const unsubDests = onSnapshot(collection(db, 'destinations'), (snap) => {
      setDestinations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination)));
      setLoading(false);
    });
    return () => {
      unsubDrivers();
      unsubDests();
    };
  }, []);

  useEffect(() => {
    if (selectedDest) {
      setOfferedType(selectedDest.type);
    }
  }, [selectedDestId]);

  const selectedDest = destinations.find(d => d.id === selectedDestId);
  
  // Sorting: Purely based on queuePosition for active drivers
  const prioritizedDrivers = [...drivers].filter(d => d.active);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || !selectedDestId || !selectedDest) return;
    
    setSubmitting(true);
    const driver = drivers.find(d => d.id === selectedDriverId)!;
    
    try {
      if (tripStatus === 'completed') {
        const finalPayment = serviceType === 'ambos' ? selectedDest.paymentAmount * 2 : selectedDest.paymentAmount;
        const tripData = {
          driverId: selectedDriverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          destinationId: selectedDestId,
          destinationName: selectedDest.name,
          pointsEarned: selectedDest.pointsValue,
          paymentAmount: finalPayment,
          date: new Date().toISOString(),
          serviceType,
          status: 'completed' as const,
          foodAllowance: foodAllowance === '' ? 0 : Number(foodAllowance)
        };

        await addDoc(collection(db, 'trips'), tripData);
        
        // Update driver: add points, increment completed trips AND move to the bottom of the queue
        const maxPos = drivers.length > 0 ? Math.max(...drivers.map(d => d.queuePosition)) : 0;
        await updateDoc(doc(db, 'drivers', selectedDriverId), {
          totalPoints: increment(selectedDest.pointsValue),
          queuePosition: maxPos + 1,
          tripsCompleted: increment(1)
        });
      } else {
        // Log denial
        const tripData = {
          driverId: selectedDriverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          destinationId: 'denied_trip',
          destinationName: `TRASLADO NEGADO (${offeredType === 'short' ? 'CORTO' : 'LARGO'})`,
          pointsEarned: 0,
          paymentAmount: 0,
          serviceType: 'subida' as const,
          date: new Date().toISOString(),
          status: 'denied' as const,
          offeredType,
          deniedReason
        };

        await addDoc(collection(db, 'trips'), tripData);

        // Move to bottom of queue and increment denial counter
        const maxPos = drivers.length > 0 ? Math.max(...drivers.map(d => d.queuePosition)) : 0;
        await updateDoc(doc(db, 'drivers', selectedDriverId), {
          queuePosition: maxPos + 1,
          tripsDenied: increment(1)
        });
      }

      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'trips/drivers');
      alert('Error al registrar el traslado o negación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Registrar Traslado</h2>
          <p className="text-slate-500 font-medium">Asignación secuencial basada en orden de llegada.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Step 1: Destination Selection */}
        <div className="flex flex-col gap-6">
          <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-2 h-full bg-national-yellow" />
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-slate-100 p-4 rounded-2xl text-slate-600">
                <MapPin size={28} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Paso 1</h3>
                <p className="text-[10px] font-black text-national-green uppercase tracking-widest mt-1">Seleccionar Destino</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {destinations.map(dest => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setSelectedDestId(dest.id)}
                  className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col ${
                    selectedDestId === dest.id 
                      ? 'border-national-green bg-green-50 shadow-lg shadow-green-900/5' 
                      : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg">{dest.name}</h4>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-widest ${
                      selectedDestId === dest.id ? 'bg-national-green text-white' : (dest.type === 'short' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                    }`}>
                      {dest.type === 'short' ? 'CERCANO' : 'LEJANO'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-auto justify-between w-full">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black font-mono text-national-green">+{dest.pointsValue}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">SERV</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-black font-mono ${selectedDestId === dest.id ? 'text-national-green' : 'text-slate-900'}`}>{formatCurrency(dest.paymentAmount)}</span>
                    </div>
                  </div>
                </button>
              ))}
              {destinations.length === 0 && !loading && (
                <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configura destinos primero</p>
                </div>
              )}
            </div>
          </section>

          {/* New Sub-Step: Service Type Selection */}
          <AnimatePresence>
            {selectedDestId && (
              <motion.section 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-national-green/10 p-3 rounded-xl text-national-green">
                      <Repeat size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Servicio</h4>
                      <p className="text-sm font-bold text-slate-900">Selecciona la modalidad del traslado</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2">
                    {[
                      { id: 'subida', label: 'Subida', icon: ArrowUp },
                      { id: 'bajada', label: 'Bajada', icon: ArrowDown },
                      { id: 'ambos', label: 'Ambos', icon: ArrowUpDown },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setServiceType(type.id as ServiceType)}
                        className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl transition-all gap-2 ${
                          serviceType === type.id 
                            ? 'bg-white text-national-green shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <type.icon size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                      </button>
                    ))}
                  </div>

                  {serviceType === 'ambos' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-3"
                    >
                      <Sparkles className="text-national-green" size={16} />
                      <p className="text-[10px] font-bold text-green-800 uppercase tracking-tight">
                        Se pagará el doble ({formatCurrency(selectedDest.paymentAmount * 2)}) por servicio completo.
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Step 2: Driver Selection */}
        <section className={`bg-national-dark text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden transition-all flex flex-col ${!selectedDestId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="absolute top-0 right-0 w-2 h-full bg-national-yellow" />
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-white/10 p-4 rounded-2xl text-white">
              <User size={28} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Paso 2</h3>
              <p className="text-[10px] font-black text-national-yellow uppercase tracking-widest mt-1">Asignar Personal</p>
            </div>
          </div>

          {selectedDestId && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-8 flex items-start gap-4"
            >
              <div className="bg-national-yellow/20 p-2 rounded-xl">
                <Clock size={18} className="text-national-yellow" />
              </div>
              <p className="text-[11px] font-medium leading-relaxed">
                El despacho sigue un orden secuencial (Fila). El primero disponible tiene prioridad.
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {prioritizedDrivers.map((driver, index) => (
              <button
                key={driver.id}
                type="button"
                onClick={() => setSelectedDriverId(driver.id)}
                className={`w-full p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${
                  selectedDriverId === driver.id 
                    ? 'border-national-yellow bg-white/10 shadow-[0_0_40px_rgba(255,204,0,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                      selectedDriverId === driver.id ? 'bg-national-yellow text-national-green' : 'bg-white/10 text-white/40'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-black text-lg uppercase tracking-tight">{driver.firstName} {driver.lastName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Servicios</span>
                        <span className="text-sm font-black font-mono text-national-yellow mr-2">{driver.totalPoints}</span>
                        {driver.billingStatus === 'delayed' ? (
                          <span className="text-[8px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            ⚠️ RETRAZO DE TICKETS
                          </span>
                        ) : (
                          <span className="text-[8px] bg-green-500/20 text-green-300 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            ✓ AL CORRIENTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="bg-national-yellow text-national-green px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                      Siguiente en Fila
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Action options when driver is selected */}
          <AnimatePresence>
            {selectedDriverId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-white/10 space-y-4 text-left"
              >
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Estatus de Respuesta</label>
                  <div className="flex bg-white/5 p-1 rounded-xl gap-2">
                    <button
                      type="button"
                      onClick={() => setTripStatus('completed')}
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        tripStatus === 'completed'
                          ? 'bg-national-yellow text-national-green font-bold shadow-md'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      ✓ Aceptó
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripStatus('denied')}
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        tripStatus === 'denied'
                          ? 'bg-red-500 text-white font-bold shadow-md'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      ✗ Negó
                    </button>
                  </div>
                </div>

                {tripStatus === 'completed' ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Dinero para Comida ($ MXN)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-white/45 font-mono text-xs">$</span>
                      <input
                        type="number"
                        placeholder="Ej. 500"
                        value={foodAllowance}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFoodAllowance(val === '' ? '' : Number(val));
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-national-yellow font-mono font-bold text-white text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-white/40">Monto entregado al colaborador para sus viáticos de comida.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Razón de Negación</label>
                      <select
                        value={deniedReason}
                        onChange={(e) => setDeniedReason(e.target.value as any)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-national-yellow font-bold text-white text-xs cursor-pointer"
                      >
                        <option value="no quiso" className="text-white bg-slate-800">No quiso realizar el viaje</option>
                        <option value="esta en turno" className="text-white bg-slate-800">Está en turno operativo</option>
                        <option value="tiene chofereada" className="text-white bg-slate-800">Tiene chofereada activa</option>
                        <option value="sin opcion por faltas" className="text-white bg-slate-800">Sin opción por faltas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Tipo de Traslado Ofrecido</label>
                      <div className="flex bg-white/5 p-1 rounded-xl gap-2">
                        <button
                          type="button"
                          onClick={() => setOfferedType('short')}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            offeredType === 'short'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          CORTO (Cercano)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferedType('long')}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            offeredType === 'long'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          LARGO (Lejano)
                        </button>
                      </div>
                      <p className="text-[10px] text-white/40 mt-1.5">Al registrar la negación, se acumulará en su historial y el colaborador descenderá al final de la fila.</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 pt-8 border-t border-white/10">
            <button
              type="submit"
              disabled={!selectedDriverId || submitting}
              className={`w-full font-black py-5 px-8 rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 disabled:opacity-30 active:scale-95 transition-all cursor-pointer ${
                tripStatus === 'denied'
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-950/10'
                  : 'bg-national-yellow text-national-green hover:bg-yellow-400 shadow-national-yellow/10'
              }`}
            >
              {submitting ? 'PROCESANDO...' : (tripStatus === 'denied' ? 'REGISTRAR NEGACIÓN' : 'REGISTRAR TRASLADO')}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

const Trophy = ({ size, strokeWidth }: { size: number, strokeWidth: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55.44 1 1 1h2c.55 0 1-.45 1-1v-2.34"/><path d="M12 2v10.6"/><path d="M12 2C7 2 7 7 7 7s0 5 5 5 5-5 5-5 0-5-5-5z"/></svg>
);
