export type TripType = 'short' | 'long';
export type ServiceType = 'subida' | 'bajada' | 'ambos';

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  active: boolean;
  queuePosition: number;
  tripsCompleted?: number;
  tripsDenied?: number;
  billingStatus?: 'ok' | 'delayed';
}

export interface Destination {
  id: string;
  name: string;
  type: TripType;
  pointsValue: number;
  paymentAmount: number;
}

export interface Trip {
  id: string;
  driverId: string;
  destinationId: string;
  driverName: string;
  destinationName: string;
  date: string;
  pointsEarned: number;
  paymentAmount: number;
  serviceType: ServiceType;
  status?: 'completed' | 'denied';
  offeredType?: 'short' | 'long';
  deniedReason?: string;
  foodAllowance?: number;
}
