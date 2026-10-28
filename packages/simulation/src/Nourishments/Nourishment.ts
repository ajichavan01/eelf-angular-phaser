export type NourishmentType = 'Plant' | 'Meat';

export interface Nourishment {
  id: number;
  kind: NourishmentType;
  x: number;
  y: number;
  mass: number;
}

export const foodRadius = (food: Nourishment): number => 2 + Math.sqrt(food.mass) * 1.5;