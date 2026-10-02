import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app-dialog.component.html',
  styleUrl: './app-dialog.component.scss',
})
export class AppDialogComponent {
  draft = '';

  constructor(public dialog: DialogService) {}

  confirm(): void {
    const current = this.dialog.current();
    if (!current) return;
    this.dialog.close(current.input ? this.draft.trim() : true);
    this.draft = '';
  }

  cancel(): void {
    const current = this.dialog.current();
    this.dialog.close(current?.input ? null : false);
    this.draft = '';
  }
}
