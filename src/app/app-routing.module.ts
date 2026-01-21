import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsLayoutComponent } from './components/forms-layout/forms-layout.component';

const routes: Routes = [
  { path: '', redirectTo: 'forms', pathMatch: 'full' },
  { path: 'forms', component: FormsLayoutComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
