import { createElement, Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Dna, Download, Focus, Leaf, Pause, Play, RotateCcw, StepForward, Upload, X, ZoomIn, ZoomOut } from 'lucide';

const icons = { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Dna, Download, Focus, Leaf, Pause, Play, RotateCcw, StepForward, Upload, X, ZoomIn, ZoomOut };
export type IconName = keyof typeof icons;

export function makeIcon(name: IconName): SVGElement {
  const icon = createElement(icons[name]);
  icon.setAttribute('width', '18');
  icon.setAttribute('height', '18');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}