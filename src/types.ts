export type TripType = 'short' | 'long';
export type ServiceType = 'subida' | 'bajada' | 'ambos';

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  active: boolean;
  queuePosition: number;
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
}
