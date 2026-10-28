import { Component, ElementRef, Input, inject } from '@angular/core';
import type { OnChanges } from '@angular/core';
import { makeIcon } from '@eelf/browser/icons.ts';
import type { IconName } from '@eelf/browser/icons.ts';

@Component({ selector: 'eelf-icon', standalone: true, template: '', host: { 'aria-hidden': 'true' } })
export class IconComponent implements OnChanges {
  @Input({ required: true }) name!: IconName;
  private readonly element = inject(ElementRef<HTMLElement>);

  ngOnChanges(): void { this.element.nativeElement.replaceChildren(makeIcon(this.name)); }
}