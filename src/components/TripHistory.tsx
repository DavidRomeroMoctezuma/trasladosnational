import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, updateDoc, increment, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Trip, Driver } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Trash2, Calendar, MapPin, User, ChevronLeft, ChevronRight, Repeat, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

export function TripHistory({ isAdmin = false }: { isAdmin?: boolean }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Filtering states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    // Create date range for the selected month in local time, converted to ISO strings
    const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString();
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

    const q = query(
      collection(db, 'trips'), 
      orderBy('date', 'desc'),
      where('date', '>=', startOfMonth),
      where('date', '<=', endOfMonth)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching trips:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedMonth, selectedYear]);

  const executeDelete = async () => {
    if (!confirmDelete || isDeleting) return;
    
    setIsDeleting(true);
    const trip = confirmDelete;
    const currentUserEmail = auth.currentUser?.email === 'davidivanromeromv@gmail.com' 
      ? 'operaciones-cdmx@national.com' 
      : (auth.currentUser?.email || 'operaciones-cdmx@national.com');
    
    console.log(`[DeleteTrip] Initiating deletion for trip ${trip.id} by user ${currentUserEmail}`);
    
    try {
      // 1. Find the current minimum queue position
      let minPos = 0;
      try {
        const driversSnap = await getDocs(query(collection(db, 'drivers'), orderBy('queuePosition', 'asc'), limit(1)));
        minPos = driversSnap.docs.length > 0 ? driversSnap.docs[0].data().queuePosition : 0;
        console.log(`[DeleteTrip] Min queue position found: ${minPos}`);
      } catch (e) {
        console.warn("Could not get min queue position", e);
      }

      // 2. Revert points and move to front of queue
      try {
        console.log(`[DeleteTrip] Updating driver ${trip.driverId}...`);
        await updateDoc(doc(db, 'drivers', trip.driverId), {
          totalPoints: increment(-trip.pointsEarned),
          queuePosition: minPos - 1,
          active: true
        });
      } catch (driverErr: any) {
        console.warn("Could not update driver stats (maybe driver was deleted?):", driverErr);
      }

      // 3. Delete the trip record
      console.log(`[DeleteTrip] Deleting trip doc ${trip.id}...`);
      await deleteDoc(doc(db, 'trips', trip.id));
      
      setConfirmDelete(null);
      setStatus({ type: 'success', message: 'Registro eliminado con éxito.' });
    } catch (err: any) {
      console.error("Error deleting trip:", err);
      if (err.code === 'permission-denied') {
        setStatus({ type: 'error', message: `Permisos insuficientes. Usuario: ${currentUserEmail}` });
      } else {
        setStatus({ type: 'error', message: `Error: ${err.message || 'Error desconocido'}` });
      }
      // Non-blocking handle error
      try {
        handleFirestoreError(err, OperationType.WRITE, `trips/${trip.id}`);
      } catch (e) {
        console.warn("HandleFirestoreError thrown as expected", e);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl border border-slate-200">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Eliminar Registro</h3>
            <p className="text-slate-500 mb-8">
              ¿Confirmas eliminar el traslado de <span className="font-bold text-slate-900">{confirmDelete.driverName}</span> a <span className="font-bold text-slate-900">{confirmDelete.destinationName}</span>?
              <br/><br/>
              <span className="text-national-green font-bold">El colaborador regresará al inicio de la fila.</span>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-4 px-6 rounded-xl font-black text-[10px] tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all uppercase"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 py-4 px-6 rounded-xl font-black text-[10px] tracking-widest text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all uppercase flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Historial de Traslados</h2>
          <p className="text-slate-500 font-medium">Registro cronológico de todas las recolecciones realizadas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-600 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((month, i) => (
                <option key={month} value={i}>{month}</option>
              ))}
            </select>
            <div className="w-px h-6 bg-slate-100 my-auto" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest text-slate-600 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className={`p-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest ${
              status.type === 'success' ? 'bg-green-50 text-national-green border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha y Hora</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Colaborador</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ciudad de Destino</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Servicios</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pago Monetario</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {trips.map(trip => (
                <tr key={trip.id} className="hover:bg-green-50/30 transition-colors group">
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Calendar size={14} className="text-slate-300" />
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {format(new Date(trip.date), "dd/MM/yy HH:mm", { locale: es })}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-national-green text-white flex items-center justify-center font-black text-[10px]">
                        {trip.driverName[0]}
                      </div>
                      <span className="font-bold text-slate-900 text-sm whitespace-nowrap">{trip.driverName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-national-green" />
                        <span className="font-bold text-slate-700 uppercase tracking-tight">{trip.destinationName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-national-green bg-green-50 w-fit px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                        {trip.serviceType === 'bajada' ? <ArrowDown size={10} /> : trip.serviceType === 'ambos' ? <ArrowUpDown size={10} /> : <ArrowUp size={10} />}
                        {trip.serviceType || 'subida'}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-mono font-black text-national-green text-lg">+{trip.pointsEarned}</span>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <span className="font-mono font-black text-slate-900 text-lg">{formatCurrency(trip.paymentAmount || 0)}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {isAdmin && (
                      <button 
                        onClick={() => setConfirmDelete(trip)}
                        className="p-2.5 text-slate-300 hover:text-red-500 bg-white border border-slate-100 rounded-xl shadow-sm transition-all md:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trips.length === 0 && !loading && (
            <div className="text-center py-24 bg-slate-50/30">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-slate-200 shadow-inner">
                <History size={32} className="text-slate-200" />
              </div>
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">No hay traslados registrados en el sistema</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
