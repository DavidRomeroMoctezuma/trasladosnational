import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, increment, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Driver, Trip } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, TrendingDown, Clock, Plus, CheckCircle2, UserX, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

interface DashboardProps {
  onLogTrip: () => void;
  isAdmin?: boolean;
}

export function Dashboard({ onLogTrip, isAdmin = false }: DashboardProps) {
  const [queueDrivers, setQueueDrivers] = useState<Driver[]>([]);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for denying a driver
  const [denyingDriver, setDenyingDriver] = useState<Driver | null>(null);
  const [offeredType, setOfferedType] = useState<'short' | 'long'>('short');
  const [deniedReason, setDeniedReason] = useState<'no quiso' | 'esta en turno' | 'tiene chofereada' | 'sin opcion por faltas'>('no quiso');
  const [submittingDenial, setSubmittingDenial] = useState(false);

  useEffect(() => {
    const queueQuery = query(collection(db, 'drivers'), orderBy('queuePosition', 'asc'), limit(20));
    const tripsQuery = query(collection(db, 'trips'), orderBy('date', 'desc'), limit(5));

    const unsubDrivers = onSnapshot(queueQuery, (snap) => {
      setQueueDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    });

    const unsubTrips = onSnapshot(tripsQuery, (snap) => {
      setRecentTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip)));
      setLoading(false);
    });

    return () => {
      unsubDrivers();
      unsubTrips();
    };
  }, []);

  const handleDenySubmit = async () => {
    if (!denyingDriver || submittingDenial) return;
    setSubmittingDenial(true);
    try {
      const tripData = {
        driverId: denyingDriver.id,
        driverName: `${denyingDriver.firstName} ${denyingDriver.lastName}`,
        destinationId: 'denied_trip',
        destinationName: `TRASLADO NEGADO (${offeredType === 'short' ? 'CORTO' : 'LARGO'})`,
        pointsEarned: 0,
        paymentAmount: 0,
        serviceType: 'subida',
        date: new Date().toISOString(),
        status: 'denied',
        offeredType,
        deniedReason
      };

      await addDoc(collection(db, 'trips'), tripData);

      // Move to bottom of queue and increment denial counter
      const maxPos = queueDrivers.length > 0 ? Math.max(...queueDrivers.map(d => d.queuePosition)) : 0;
      await updateDoc(doc(db, 'drivers', denyingDriver.id), {
        queuePosition: maxPos + 1,
        tripsDenied: increment(1)
      });

      setDenyingDriver(null);
      setOfferedType('short');
      setDeniedReason('no quiso');
    } catch (err) {
      console.error("Error logging trip denial:", err);
      alert('Error al registrar la negación');
    } finally {
      setSubmittingDenial(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Vista General</h2>
          <p className="text-slate-500 font-medium">Panel de administración de operaciones CDMX.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <button
              onClick={onLogTrip}
              className="bg-national-green text-white font-black py-4 px-8 rounded-xl flex items-center gap-3 hover:bg-green-900 transition-all shadow-xl shadow-national-green/10 uppercase text-xs tracking-widest active:scale-95"
            >
              <Plus size={18} />
              Registrar Traslado
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Leaderboard/Queue */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                <Clock size={16} className="text-national-green" />
                Fila de Asignación
              </h3>
              <span className="text-[10px] font-black bg-national-yellow text-national-green px-3 py-1 rounded-full uppercase tracking-widest">
                Próximos en Turno
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead className="bg-white text-[10px] uppercase font-black text-slate-400">
                  <tr>
                    <th className="px-4 xl:px-6 py-4 whitespace-nowrap">Orden</th>
                    <th className="px-4 xl:px-6 py-4 whitespace-nowrap">Nombre</th>
                    <th className="px-4 xl:px-6 py-4 text-center whitespace-nowrap">Realizados</th>
                    <th className="px-4 xl:px-6 py-4 text-center whitespace-nowrap">Negados</th>
                    <th className="px-4 xl:px-6 py-4 text-center whitespace-nowrap">Puntos</th>
                    <th className="px-4 xl:px-6 py-4 text-right whitespace-nowrap">Estatus</th>
                    <th className="px-4 xl:px-6 py-4 text-right whitespace-nowrap">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {queueDrivers.map((driver, index) => (
                    <tr 
                      key={driver.id}
                      className="hover:bg-green-50/50 transition-colors group"
                    >
                      <td className="px-4 xl:px-6 py-5 whitespace-nowrap">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            index === 0 ? 'bg-national-green text-white animate-pulse' : 
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {index + 1}
                          </div>
                      </td>
                      <td className="px-4 xl:px-6 py-5">
                        <div className="flex items-center gap-4 whitespace-nowrap">
                          <div>
                            <p className="font-bold text-slate-900 whitespace-nowrap">{driver.firstName} {driver.lastName}</p>
                            {driver.billingStatus === 'delayed' ? (
                              <p className="text-[9px] text-amber-600 uppercase tracking-wide font-extrabold mt-0.5 whitespace-nowrap">⚠️ Retraso de Tickets/Facturación</p>
                            ) : (
                              <p className="text-[9px] text-slate-400 font-semibold tracking-tight mt-0.5 whitespace-nowrap">✓ Al corriente</p>
                            )}
                            {index === 0 && <p className="text-[9px] text-national-green uppercase tracking-widest font-black animate-pulse mt-0.5 whitespace-nowrap">Siguiente para viaje</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 xl:px-6 py-5 text-center font-bold font-mono text-slate-600 text-sm whitespace-nowrap">
                        {driver.tripsCompleted || 0}
                      </td>
                      <td className="px-4 xl:px-6 py-5 text-center font-bold font-mono text-red-500 text-sm whitespace-nowrap">
                        {driver.tripsDenied || 0}
                      </td>
                      <td className="px-4 xl:px-6 py-5 text-center whitespace-nowrap">
                        <p className="font-mono font-black text-national-green text-lg">{driver.totalPoints}</p>
                      </td>
                      <td className="px-4 xl:px-6 py-5 text-right whitespace-nowrap">
                        <span className={`text-[9px] px-2 py-1 rounded font-black tracking-widest ${
                          driver.active ? 'bg-green-100 text-national-green' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {driver.active ? 'OPERATIVO' : 'FUERA'}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-5 text-right whitespace-nowrap">
                        {driver.active ? (
                          <button
                            onClick={() => setDenyingDriver(driver)}
                            className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-red-200 duration-200 inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
                            title="Negado por colaborador"
                          >
                            <UserX size={12} />
                            <span>Negado</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {queueDrivers.length === 0 && !loading && (
                <p className="text-center py-12 text-slate-400 italic font-medium">No hay colaboradores en la fila.</p>
              )}
            </div>
          </div>
        </div>

        {/* Info & Recent Activity */}
        <div className="space-y-8">
          {/* Legend Card */}
          <section className="bg-national-dark text-white p-6 rounded-3xl shadow-xl border-l-8 border-national-yellow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 border-b border-white/10 pb-3">Reglas de Asignación</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <div className="text-national-yellow mt-1"><TrendingUp size={14} /></div>
                <p className="text-[10px] font-medium leading-relaxed">Asignación secuencial: Se sigue estrictamente el orden de la fila.</p>
              </div>
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <div className="text-national-yellow mt-1"><TrendingDown size={14} /></div>
                <p className="text-[10px] font-medium leading-relaxed">Si no puede ir: Pasa al final de la fila automáticamente (se registra como negación).</p>
              </div>
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <div className="text-national-yellow mt-1"><CheckCircle2 size={14} className="text-green-400" /></div>
                <p className="text-[10px] font-medium leading-relaxed">Al completar viaje: El colaborador también se mueve al final de la fila.</p>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-slate-100 p-2.5 rounded-xl">
                <Clock size={18} className="text-slate-600" />
              </div>
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Actividad Reciente</h3>
            </div>

            <div className="space-y-8">
              {recentTrips.map((trip) => (
                <div key={trip.id} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-1 before:bg-slate-100">
                  <div className={`absolute left-[-2px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${trip.status === 'denied' ? 'bg-red-500' : 'bg-national-green'}`} />
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{trip.driverName}</p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {trip.status === 'denied' ? (
                      <span className="text-red-500 font-bold uppercase tracking-wide">Traslado Negado</span>
                    ) : (
                      <>Recolección: <span className="font-bold text-slate-700">{trip.destinationName}</span></>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {format(new Date(trip.date), "dd/MM/yy", { locale: es })}
                    </p>
                    {trip.status === 'denied' ? (
                      <>
                        <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none">
                          {trip.offeredType === 'short' ? 'Corto' : 'Largo'}
                        </div>
                        <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none">
                          {trip.deniedReason || 'No quiso'}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-national-green bg-green-50 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none">
                        {trip.serviceType || 'subida'}
                      </div>
                    )}
                    {trip.status !== 'denied' && (
                      <span className="text-[9px] bg-green-50 text-national-green px-2 py-0.5 rounded font-black tracking-tighter ml-auto">
                        +{trip.pointsEarned} SERV
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {recentTrips.length === 0 && !loading && (
                <p className="text-center py-8 text-slate-300 font-black uppercase text-[10px] tracking-widest">Sin registros</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Denial Dialog Trigger */}
      <AnimatePresence>
        {denyingDriver && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] max-w-lg w-full p-8 shadow-2xl border border-slate-200 overflow-hidden relative"
            >
              <button 
                onClick={() => setDenyingDriver(null)}
                className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                <UserX size={32} />
              </div>

              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1 animate-fade-in">
                Registrar Negación de Traslado
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                Colaborador: <span className="font-extrabold text-slate-900">{denyingDriver.firstName} {denyingDriver.lastName}</span>
              </p>

              <div className="space-y-6">
                {/* 1. Offered Trip Type */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Tipo de traslado ofrecido
                  </label>
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setOfferedType('short')}
                      className={`flex-1 py-4 px-6 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        offeredType === 'short'
                          ? 'border-national-yellow bg-amber-50 text-amber-800'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <TrendingDown size={16} />
                      Corto / Cercano
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfferedType('long')}
                      className={`flex-1 py-4 px-6 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        offeredType === 'long'
                          ? 'border-national-green bg-green-50 text-national-green'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <TrendingUp size={16} />
                      Largo / Lejano
                    </button>
                  </div>
                </div>

                {/* 2. Reason for Denial */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Razón de la negación
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'no quiso', label: 'No quiso' },
                      { id: 'esta en turno', label: 'Está en turno' },
                      { id: 'tiene chofereada', label: 'Tiene chofereada' },
                      { id: 'sin opcion por faltas', label: 'Sin opción por faltas' }
                    ].map((reason) => (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => setDeniedReason(reason.id as any)}
                        className={`py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-tight text-left border-2 transition-all flex items-center justify-between cursor-pointer ${
                          deniedReason === reason.id
                            ? 'border-red-500 bg-red-50/50 text-red-700'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>{reason.label}</span>
                        {deniedReason === reason.id && (
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3 mt-4">
                  <AlertCircle className="text-amber-600 mt-0.5" size={16} />
                  <p className="text-[10px] font-medium leading-relaxed text-amber-800 uppercase">
                    Al confirmar la negación, el colaborador será enviado al final de la fila y el registro quedará guardado en el historial.
                  </p>
                </div>

                {/* Confirm / Cancel Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                  <button 
                    onClick={() => setDenyingDriver(null)}
                    disabled={submittingDenial}
                    className="flex-1 py-4 px-6 rounded-xl font-black text-[10px] tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDenySubmit}
                    disabled={submittingDenial}
                    className="flex-1 py-4 px-6 rounded-xl font-black text-[10px] tracking-widest text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingDenial ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Confirmar Negación'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
