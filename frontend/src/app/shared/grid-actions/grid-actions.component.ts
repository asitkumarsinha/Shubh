import { Component, Input } from '@angular/core';
import { GridSection, downloadGrid, printGrid, saveGridCsv } from '../../core/grid-export';

@Component({
  selector: 'app-grid-actions',
  standalone: true,
  template: `
    <div class="grid-actions">
      <button class="btn ghost" type="button" (click)="print()">Print</button>
      <button class="btn ghost" type="button" (click)="download()">Download</button>
    </div>
  `,
  styles: `
    .grid-actions { display: inline-flex; gap: 0.45rem; }
  `,
})
export class GridActionsComponent {
  @Input() file = 'grid';
  @Input() sections: GridSection[] = [];
  @Input() saveAs = false;

  print(): void {
    printGrid(this.sections);
  }

  download(): void {
    if (this.saveAs) saveGridCsv(this.file, this.sections);
    else downloadGrid(this.file, this.sections);
  }
}
