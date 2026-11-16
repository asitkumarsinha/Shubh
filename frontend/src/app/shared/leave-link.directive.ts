import { Directive, HostListener, Input } from '@angular/core';
import { LeaveService } from '../core/leave.service';

/** Keeps the click on this page until a signed-in user confirms they want to log out. */
@Directive({
  selector: '[appLeaveLink]',
  standalone: true,
})
export class LeaveLinkDirective {
  @Input() appLeaveLink = '/shoppingmall';

  constructor(private leave: LeaveService) {}

  @HostListener('click')
  onClick(): void {
    void this.leave.go(this.appLeaveLink || '/shoppingmall');
  }
}
