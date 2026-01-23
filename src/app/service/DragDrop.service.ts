import { Injectable } from '@angular/core';
import * as luckysheet from 'luckysheet';

@Injectable({
  providedIn: 'root'
})
export class DragDropService {

  constructor() { }

  /**
   * Khởi tạo drag-drop listeners cho luckysheet
   * @param containerSelector Selector của container luckysheet
   */
  public initializeDragDrop(containerSelector: string): void {
    const container = document.querySelector(containerSelector);
    
    if (!container) {
      console.warn(`Container with selector "${containerSelector}" not found`);
      return;
    }

    // Thêm event listeners vào container chính
    this.attachDragDropListeners(container);

    // Thêm event listeners cho tất cả phần tử con của luckysheet
    // Đặc biệt là luckysheet-grid-container và luckysheet-scrollbars-enabled
    const gridContainers = container.querySelectorAll('[class*="luckysheet"]');
    gridContainers.forEach(element => {
      this.attachDragDropListeners(element);
    });

    // Theo dõi các phần tử mới được thêm vào (nếu có)
    const observer = new MutationObserver(() => {
      const newContainers = container.querySelectorAll('[class*="luckysheet"]');
      newContainers.forEach(element => {
        if (!element.hasAttribute('data-drag-drop-attached')) {
          this.attachDragDropListeners(element);
        }
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  /**
   * Gắn drag-drop listeners vào một phần tử
   */
  private attachDragDropListeners(element: Element): void {
    if (element.hasAttribute('data-drag-drop-attached')) {
      return;
    }

    (element as any).addEventListener('dragover', this.handleDragOver.bind(this));
    (element as any).addEventListener('dragleave', this.handleDragLeave.bind(this));
    (element as any).addEventListener('drop', this.handleDrop.bind(this));
    (element as any).addEventListener('dragenter', this.handleDragEnter.bind(this));
    
    element.setAttribute('data-drag-drop-attached', 'true');
  }

  /**
   * Xử lý sự kiện dragover
   */
  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = 'copy';
    
    // Tìm container chính
    const container = this.getMainContainer(event.currentTarget as HTMLElement);
    if (container) {
      container.classList.add('dragover');
    }
  }

  /**
   * Xử lý sự kiện dragenter
   */
  private handleDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Tìm container chính
    const container = this.getMainContainer(event.currentTarget as HTMLElement);
    if (container) {
      container.classList.add('dragover');
    }
  }

  /**
   * Xử lý sự kiện dragleave
   */
  private handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Tìm container chính
    const container = this.getMainContainer(event.currentTarget as HTMLElement);
    if (container && event.target === event.currentTarget) {
      container.classList.remove('dragover');
    }
  }

  /**
   * Tìm main container (#luckysheet-container hoặc #luckysheet)
   */
  private getMainContainer(element: HTMLElement): HTMLElement | null {
    let current = element;
    
    // Tìm parent là luckysheet-container hoặc luckysheet
    while (current && current !== document.body) {
      if (current.id === 'luckysheet' || current.classList.contains('luckysheet-container')) {
        return current;
      }
      current = current.parentElement as HTMLElement;
    }
    
    return null;
  }

  /**
   * Xử lý sự kiện drop - chính là nơi xử lý files/items được kéo vào
   */
  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Tìm container chính
    const container = this.getMainContainer(event.currentTarget as HTMLElement);
    if (container) {
      container.classList.remove('dragover');
    }

    const dataTransfer = event.dataTransfer;
    
    if (!dataTransfer) {
      return;
    }

    // Xử lý file nếu có
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      this.handleFilesDrop(dataTransfer.files, event);
    }

    // Xử lý text/HTML data nếu có
    const htmlData = dataTransfer.getData('text/html');
    const textData = dataTransfer.getData('text/plain');
    const imageData = dataTransfer.getData('text/uri-list');

    if (htmlData) {
      this.handleHtmlDrop(htmlData, event);
    } else if (textData) {
      this.handleTextDrop(textData, event);
    } else if (imageData) {
      this.handleImageDrop(imageData, event);
    }
  }

  /**
   * Xử lý file được kéo vào
   * @param files FileList từ drop event
   * @param event DragEvent
   */
  public handleFilesDrop(files: FileList, event: DragEvent): void {
    console.log('Files dropped:', files);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`File ${i}:`, file.name, file.type);

      // Xử lý ảnh
      if (file.type.startsWith('image/')) {
        this.insertImageToSheet(file, event);
      }
      // Xử lý CSV
      else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        this.insertCsvToSheet(file);
      }
      // Xử lý Excel
      else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        this.insertExcelToSheet(file);
      }
    }
  }

  /**
   * Xử lý ảnh được kéo vào
   */
  private insertImageToSheet(file: File, event: DragEvent): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;
      
      // Lấy vị trí cell từ mouse position
      const cellAddress = this.getCellAddressFromMouseEvent(event);
      
      if (cellAddress) {
        this.insertImageAtCell(imageData, cellAddress.row, cellAddress.col);
        console.log('Image inserted at cell:', cellAddress.row, cellAddress.col);
      } else {
        console.warn('Could not determine cell position for image');
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Chèn ảnh vào luckysheet tại cell nhất định
   */
  private insertImageAtCell(imageData: string, row: number, col: number): void {
    try {
      const currentSheet = luckysheet.getSheet();
      
      if (!currentSheet) {
        console.warn('No active sheet found');
        return;
      }

      // Tạo object image cho luckysheet
      const imageObj = {
        src: imageData,
        originWidth: 150,
        originHeight: 150,
        row: row,
        col: col
      };

      // Thêm image vào sheet
      if (!currentSheet.images) {
        currentSheet.images = [];
      }
      
      currentSheet.images.push(imageObj);
      luckysheet.refresh();
      console.log('Image added to sheet:', imageObj);
    } catch (error) {
      console.error('Error inserting image:', error);
    }
  }

  /**
   * Xử lý CSV file được kéo vào
   */
  private insertCsvToSheet(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const csvContent = e.target?.result as string;
      this.parseCsvAndInsert(csvContent);
    };
    reader.readAsText(file);
  }

  /**
   * Parse CSV và chèn vào sheet
   */
  private parseCsvAndInsert(csvContent: string): void {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      const currentSheet = luckysheet.getCurrentSheet();
      
      if (!currentSheet) {
        console.warn('No active sheet found');
        return;
      }

      // Parse CSV
      for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
        const cells = lines[rowIndex].split(',');
        for (let colIndex = 0; colIndex < cells.length; colIndex++) {
          luckysheet.setCellValue(rowIndex, colIndex, cells[colIndex].trim(), currentSheet);
        }
      }

      luckysheet.refresh();
      console.log('CSV data inserted successfully');
    } catch (error) {
      console.error('Error parsing CSV:', error);
    }
  }

  /**
   * Xử lý Excel file được kéo vào
   */
  private insertExcelToSheet(file: File): void {
    console.log('Excel file dropped. Should handle with ExcelFileUploadService');
    // Đây sẽ được xử lý bởi ExcelFileUploadService
  }

  /**
   * Xử lý HTML data được kéo vào
   */
  private handleHtmlDrop(htmlData: string, event: DragEvent): void {
    console.log('HTML data dropped:', htmlData);
    // Xử lý HTML nếu cần
  }

  /**
   * Xử lý text data được kéo vào
   */
  private handleTextDrop(textData: string, event: DragEvent): void {
    try {
      const currentSheet = luckysheet.getSheet();
      
      if (!currentSheet) {
        console.warn('No active sheet found');
        return;
      }

      // Tính toán vị trí cell từ vị trí mouse
      const cellAddress = this.getCellAddressFromMouseEvent(event);
      console.log('cellAddress', cellAddress);
      if (cellAddress) {
        const row = cellAddress.row;
        const col = cellAddress.col;
        
        // Check if it's a draggable item (contains _item_)
        if (textData.includes('_item_')) {
          // Get the item type
          const itemType = textData.split('_item_')[0];
          
          // Insert sample data based on item type
          const sampleData = this.getSampleDataForType(itemType);
          luckysheet.setCellValue(row, col, sampleData, currentSheet);
          
          console.log(`${itemType} item inserted at cell (${row}, ${col}):`, sampleData);
        } else {
          // Regular text
          luckysheet.setCellValue(row, col, textData, currentSheet);
          console.log('Text inserted at cell:', row, col);
        }
        
        luckysheet.refresh();
      } else {
        console.warn('Could not determine cell address from drop position');
      }
    } catch (error) {
      console.error('Error inserting text:', error);
    }
  }

  /**
   * Tính toán vị trí cell từ mouse event
   */
  private getCellAddressFromMouseEvent(event: DragEvent): { row: number, col: number } | null {
    try {
      const container = document.querySelector('#luckysheet') as HTMLElement;
      
      if (!container) {
        console.warn('Luckysheet container not found');
        return null;
      }

      const rect = container.getBoundingClientRect();
      const x = event.clientX! - rect.left;
      const y = event.clientY! - rect.top;

      // Tìm cell dựa vào vị trí pixel
      const luckysheetElement = document.querySelector('.luckysheet-cell-main');
      
      if (!luckysheetElement) {
        // Fallback: Tính toán dựa vào default cell size
        const cellWidth = 73; // Default width
        const cellHeight = 19; // Default height
        const col = Math.floor(x / cellWidth);
        const row = Math.floor(y / cellHeight);
        
        return { row: Math.max(0, row), col: Math.max(0, col) };
      }

      // Sử dụng luckysheet API nếu có
      const cellElement = document.elementFromPoint(event.clientX!, event.clientY!) as HTMLElement;
      
      if (cellElement && cellElement.getAttribute('data-row') && cellElement.getAttribute('data-col')) {
        const row = parseInt(cellElement.getAttribute('data-row')!);
        const col = parseInt(cellElement.getAttribute('data-col')!);
        
        if (!isNaN(row) && !isNaN(col)) {
          return { row, col };
        }
      }

      // Fallback: tính toán từ vị trí
      const cellWidth = 73;
      const cellHeight = 19;
      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);
      
      return { row: Math.max(0, row), col: Math.max(0, col) };
    } catch (error) {
      console.error('Error calculating cell address:', error);
      return null;
    }
  }

  /**
   * Lấy sample data dựa trên loại item
   */
  private getSampleDataForType(itemType: string): string {
    const samples: { [key: string]: string } = {
      'text': 'Sample Text',
      'number': '12345',
      'date': new Date().toLocaleDateString('vi-VN'),
      'email': 'example@email.com',
      'phone': '+84 (0) 123 456 789'
    };
    return samples[itemType] || itemType;
  }

  /**
   * Xử lý image URL được kéo vào
   */
  private handleImageDrop(imageUrl: string, event: DragEvent): void {
    console.log('Image URL dropped:', imageUrl);
    
    // Tính toán vị trí cell từ mouse position
    const cellAddress = this.getCellAddressFromMouseEvent(event);
    
    if (cellAddress) {
      this.insertImageAtCell(imageUrl, cellAddress.row, cellAddress.col);
      console.log('Image URL inserted at cell:', cellAddress.row, cellAddress.col);
    } else {
      console.warn('Could not determine cell position for image');
    }
  }
}
