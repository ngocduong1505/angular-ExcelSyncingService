import { Component } from '@angular/core';

import * as luckysheet from 'luckysheet';

import { PairForm } from 'src/app/interface/pairForm';
import { ExcelFileUploadService } from '../../../utilities/ExcelFileUpload.service';
import { ExcelFileDownloadService } from '../../../utilities/ExcelFileDownload.service';
import { PairFormSyncService } from '../../../service/PairFormService/PairFormSync.service';
import { DragDropService } from '../../../service/DragDrop.service';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.scss']
})
export class PanelComponent {

  pairForms: PairForm[] = [];
  constructor(private pfSyncService: PairFormSyncService,
              private fileDownloadService: ExcelFileDownloadService,
              private fileUploadService: ExcelFileUploadService,
              private dragDropService: DragDropService) { 
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    // the luckysheet is initialized in the ngAfterViewInit in {app.component.ts}
    // therefore, to ensure the luckysheet is ready, the subscription is placed later

    setTimeout(() => {
      // Khởi tạo drag-drop functionality
      this.dragDropService.initializeDragDrop('#luckysheet');

      // retrieve the pairForms from the server at the first time
      this.pfSyncService.pairFormApiService.getPairFormsFromServer().subscribe(pairForms => {
        this.pairForms = pairForms;
        this.pfSyncService.syncLuckySheet(this.pairForms, luckysheet, "Sheet1");
      })
  
      // subscribe to the changes of the pairForms subject
      this.pfSyncService.getPairFormsSubject().subscribe(pairForms => {
        this.pairForms = pairForms;
        this.pfSyncService.syncLuckySheet(this.pairForms, luckysheet, "Sheet1");
      })
    }, 1000);
  }

  parseXLSX(event: any): void {
    const files = event.target.files;

    if (files == null || files.lengh == 0) {
      alert("No files wait for import");
      return;
    }

    let name = files[0].name;
    let suffixArr = name.split("."), suffix = suffixArr[suffixArr.length - 1];
    if (suffix != "xlsx") {
      alert("Currently only supports the import of xlsx files");
      return;
    }
    this.fileUploadService.convertExcelToLuckySheet(files[0]);
  }

  syncData(): void {
    // TODO: need to take the sheet name from the user
    const sheet = luckysheet.getSheet("Sheet1");

    for (let p of this.pairForms) {
      if (this.pfSyncService.getFields().includes(p.label)) {

        let x: number = p.coordinate.x;
        let y: number = p.coordinate.y;
        
        let bindingValue = luckysheet.getCellValue(y, x, sheet);
        p.value = bindingValue;
      } else {
        console.log(`Cannot find the field ${p.label}`);
        return
      }
    }
    console.log(`Successfully update all the form values`);
    // send the pairForms to the valueSyncService
    this.pfSyncService.setUpdatePairForms(this.pairForms);
  }

  downloadExcel(): void {
    this.fileDownloadService.exportExcelData(luckysheet.getLuckysheetfile());
  }

  /**
   * Xử lý khi user bắt đầu kéo item từ draggable-items
   */
  onItemDragStart(event: DragEvent, itemType: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', `${itemType}_item_${Date.now()}`);
      event.dataTransfer.setData('application/x-item-type', itemType);
      
      // Set drag image (optional)
      const dragImage = document.createElement('div');
      dragImage.textContent = itemType;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.padding = '10px 15px';
      dragImage.style.backgroundColor = '#1976d2';
      dragImage.style.color = 'white';
      dragImage.style.borderRadius = '4px';
      dragImage.style.fontSize = '14px';
      document.body.appendChild(dragImage);
      
      event.dataTransfer.setDragImage(dragImage, 0, 0);
      
      setTimeout(() => document.body.removeChild(dragImage), 0);
      
      console.log(`Started dragging ${itemType} item`);
    }
  }
}
