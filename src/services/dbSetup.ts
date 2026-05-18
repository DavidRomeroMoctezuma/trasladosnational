
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OFFICIAL_TEAM, OFFICIAL_DESTINATIONS } from '../lib/constants';
import { Driver, Destination } from '../types';

export const syncOfficialTeam = async () => {
  const snap = await getDocs(collection(db, 'drivers'));
  const dbDrivers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
  
  const officialNamesMap = new Map(OFFICIAL_TEAM.map(m => [`${m.firstName} ${m.lastName}`.toLowerCase(), m]));
  
  // 1. Only delete duplicates
  const seenNames = new Set<string>();
  for (const d of dbDrivers) {
    const fullName = `${d.firstName} ${d.lastName}`.toLowerCase().trim();
    if (seenNames.has(fullName)) {
      console.log(`[Setup] Removing duplicate driver: ${d.firstName} ${d.lastName}`);
      await deleteDoc(doc(db, 'drivers', d.id));
    } else {
      seenNames.add(fullName);
    }
  }

  // 2. Add missing official members
  const freshSnap = await getDocs(collection(db, 'drivers'));
  const currentDrivers = freshSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
  const currentNames = new Set(currentDrivers.map(d => `${d.firstName} ${d.lastName}`.toLowerCase().trim()));
  
  let added = 0;
  for (const member of OFFICIAL_TEAM) {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase().trim();
    if (!currentNames.has(fullName)) {
      console.log(`[Setup] Adding missing driver: ${member.firstName} ${member.lastName}`);
      await addDoc(collection(db, 'drivers'), {
        ...member,
        totalPoints: 0,
        active: true,
        queuePosition: 9999 // Temporary
      });
      added++;
    }
  }

  // 3. Ensure sequential queue positions without randomizing existing ones
  const finalSnap = await getDocs(collection(db, 'drivers'));
  const allDrivers = finalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
  
  // Sort by existing queue position
  const sortedDrivers = [...allDrivers].sort((a, b) => (a.queuePosition ?? 999999) - (b.queuePosition ?? 999999));
  
  for (let i = 0; i < sortedDrivers.length; i++) {
    if (sortedDrivers[i].queuePosition !== i) {
      await updateDoc(doc(db, 'drivers', sortedDrivers[i].id), {
        queuePosition: i
      });
    }
  }
  
  return allDrivers.length;
};

export const syncOfficialDestinations = async () => {
  const snap = await getDocs(collection(db, 'destinations'));
  const dbDests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination));
  
  const officialNames = new Set(OFFICIAL_DESTINATIONS.map(d => d.name.toLowerCase().trim()));
  
  // 1. Only delete duplicates
  const seenNames = new Set<string>();
  for (const d of dbDests) {
    const nameLower = d.name.toLowerCase().trim();
    if (seenNames.has(nameLower)) {
      console.log(`[Setup] Removing duplicate destination: ${d.name}`);
      await deleteDoc(doc(db, 'destinations', d.id));
    } else {
      seenNames.add(nameLower);
    }
  }

  // 2. Add or update official ones
  const freshSnap = await getDocs(collection(db, 'destinations'));
  const currentDestsMap = new Map(freshSnap.docs.map(d => [d.data().name.toLowerCase().trim(), { id: d.id, ...d.data() } as Destination]));
  
  let count = 0;
  for (const official of OFFICIAL_DESTINATIONS) {
    const nameLower = official.name.toLowerCase().trim();
    const existing = currentDestsMap.get(nameLower);
    if (!existing) {
      await addDoc(collection(db, 'destinations'), official);
      count++;
    } else {
      // Correct existing values if they differ
      if (existing.paymentAmount !== official.paymentAmount || existing.pointsValue !== official.pointsValue) {
        await updateDoc(doc(db, 'destinations', existing.id), {
          paymentAmount: official.paymentAmount,
          pointsValue: official.pointsValue,
          type: official.type
        });
      }
    }
  }
  return count;
};
