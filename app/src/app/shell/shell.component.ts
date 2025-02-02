import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BottomNavigationComponent } from "../components/bottom-navigation/bottom-navigation.component";

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterModule, BottomNavigationComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
