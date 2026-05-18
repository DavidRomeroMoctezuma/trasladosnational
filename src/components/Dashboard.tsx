import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Driver, Trip } from '../types';
import { motion } from 'motion/react';
import { Trophy, TrendingUp, TrendingDown, Clock, Plus, CheckCircle2 } from 'lucide-react';
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
        <div className="lg:col-span-2 space-y-6">
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

            <div className="p-2">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white text-[10px] uppercase font-black text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Orden</th>
                    <th className="px-6 py-4">Nombre</th>
                    <th className="px-6 py-4 text-center">Servicios</th>
                    <th className="px-6 py-4 text-right">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {queueDrivers.map((driver, index) => (
                    <tr 
                      key={driver.id}
                      className="hover:bg-green-50/50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            index === 0 ? 'bg-national-green text-white animate-pulse' : 
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {index + 1}
                          </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-bold text-slate-900">{driver.firstName} {driver.lastName}</p>
                            {index === 0 && <p className="text-[10px] text-national-green uppercase tracking-widest font-black">Siguiente para viaje</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <p className="font-mono font-black text-national-green text-lg">{driver.totalPoints}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`text-[9px] px-2 py-1 rounded font-black tracking-widest ${
                          driver.active ? 'bg-green-100 text-national-green' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {driver.active ? 'OPERATIVO' : 'FUERA'}
                        </span>
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
                <p className="text-[10px] font-medium leading-relaxed">Si no puede ir: Pasa al final de la fila automáticamente.</p>
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
                  <div className="absolute left-[-2px] top-1.5 w-2.5 h-2.5 rounded-full bg-national-green border-2 border-white" />
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{trip.driverName}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Recolección: <span className="font-bold text-slate-700">{trip.destinationName}</span></p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {format(new Date(trip.date), "dd/MM/yy", { locale: es })}
                    </p>
                    <div className="flex items-center gap-1 text-national-green bg-green-50 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none">
                      {trip.serviceType || 'subida'}
                    </div>
                    <span className="text-[9px] bg-green-50 text-national-green px-2 py-0.5 rounded font-black tracking-tighter ml-auto">
                      +{trip.pointsEarned} SERV
                    </span>
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
    </div>
  );
}
