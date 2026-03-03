import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ultimate-grid.css';

const UltimateGrid = () => {
  const gridRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'SELECT' 或 'FILL'
  const [tempRange, setTempRange] = useState(null); // 拖拉時的即時範圍
  const [finalRange, setFinalRange] = useState(null); // 最終確定的選取範圍

  const [rowData, setRowData] = useState([
    { id: 1, make: 'Toyota', model: 'Celica', price: '35000', good: '1'},
    { id: 2, make: 'Ford', model: 'Mondeo', price: '32000', good: '2' },
    { id: 3, make: 'Porsche', model: 'Boxster', price: '72000', good: '3' },
    { id: 4, make: 'BMW', model: 'M3', price: '60000', good: '4' },
    { id: 5, make: 'Audi', model: 'A4', price: '50000', good: '5' },
    { id: 6, make: 'Tesla', model: 'Model 3', price: '42000', good: '6' },
    { id: 7, make: 'Honda', model: 'Civic', price: '28000', good: '7' },
  ]);

  const getColIds = () => gridRef.current.api.getColumns().map((c) => c.getColId());

  // 核心樣式邏輯
  const getCellClass = (params) => {
    const range = isDragging ? tempRange : finalRange;
    if (!range) return [];

    const colIds = getColIds();
    const cIdx = colIds.indexOf(params.column.getColId());
    const rIdx = params.node.rowIndex;
    const { rStart, rEnd, cStart, cEnd } = range;

    const classes = [];
    if (rIdx >= rStart && rIdx <= rEnd && cIdx >= cStart && cIdx <= cEnd) {
      classes.push('range-selected');
      if (rIdx === rStart) classes.push('range-top');
      if (rIdx === rEnd) classes.push('range-bottom');
      if (cIdx === cStart) classes.push('range-left');
      if (cIdx === cEnd) classes.push('range-right');
      // 只有範圍的最右下角那一格有填充柄
      if (rIdx === rEnd && cIdx === cEnd) classes.push('range-handle');
    }
    return classes;
  };

  const cellClassRules = {
    'range-selected': (p) => getCellClass(p).includes('range-selected'),
    'range-top': (p) => getCellClass(p).includes('range-top'),
    'range-bottom': (p) => getCellClass(p).includes('range-bottom'),
    'range-left': (p) => getCellClass(p).includes('range-left'),
    'range-right': (p) => getCellClass(p).includes('range-right'),
    'range-handle': (p) => getCellClass(p).includes('range-handle'),
  };

  const onCellMouseDown = useCallback((params) => {
    const e = params.event;
    const cellElement = e.target.closest('.ag-cell');
    if (!cellElement) return;

    const rect = cellElement.getBoundingClientRect();
    const isCorner = rect.right - e.clientX < 15 && rect.bottom - e.clientY < 15;
    const colIdx = getColIds().indexOf(params.column.getColId());

    // 判斷是否點擊在已選範圍的填充柄上
    if (isCorner && finalRange && params.rowIndex === finalRange.rEnd && colIdx === finalRange.cEnd) {
      setDragMode('FILL');
      setTempRange({ ...finalRange });
    } else {
      // 重新開始新的選取
      setDragMode('SELECT');
      setFinalRange(null);
      setTempRange({
        rStart: params.rowIndex,
        rEnd: params.rowIndex,
        cStart: colIdx,
        cEnd: colIdx,
        anchorR: params.rowIndex, // 紀錄起始點
        anchorC: colIdx,
      });
    }
    setIsDragging(true);
    e.preventDefault();
  }, [finalRange]);

  const onCellMouseOver = useCallback((params) => {
    if (!isDragging || !tempRange) return;

    const colIdx = getColIds().indexOf(params.column.getColId());
    const rowIdx = params.node.rowIndex;
    let nextRange = { ...tempRange };

    if (dragMode === 'SELECT') {
      // 自由選取：計算與起始點的矩陣
      nextRange.rStart = Math.min(tempRange.anchorR, rowIdx);
      nextRange.rEnd = Math.max(tempRange.anchorR, rowIdx);
      nextRange.cStart = Math.min(tempRange.anchorC, colIdx);
      nextRange.cEnd = Math.max(tempRange.anchorC, colIdx);
    } else if (dragMode === 'FILL' && finalRange) {
      // 填充模式：十字鎖定邏輯
      const rowDiff = Math.abs(rowIdx - finalRange.rEnd);
      const colDiff = Math.abs(colIdx - finalRange.cEnd);

      if (rowDiff > colDiff) {
        // 垂直填充
        nextRange.rStart = Math.min(finalRange.rStart, rowIdx);
        nextRange.rEnd = Math.max(finalRange.rEnd, rowIdx);
        nextRange.cStart = finalRange.cStart;
        nextRange.cEnd = finalRange.cEnd;
      } else {
        // 水平填充
        nextRange.cStart = Math.min(finalRange.cStart, colIdx);
        nextRange.cEnd = Math.max(finalRange.cEnd, colIdx);
        nextRange.rStart = finalRange.rStart;
        nextRange.rEnd = finalRange.rEnd;
      }
    }

    setTempRange(nextRange);
    gridRef.current.api.refreshCells({ force: true });
  }, [isDragging, dragMode, tempRange, finalRange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && tempRange) {
      if (dragMode === 'FILL' && finalRange) {
        const colIds = getColIds();
        const sourceRows = finalRange.rEnd - finalRange.rStart + 1;
        const sourceCols = finalRange.cEnd - finalRange.cStart + 1;

        // 全方向循環填充邏輯
        for (let r = tempRange.rStart; r <= tempRange.rEnd; r++) {
          const rowNode = gridRef.current.api.getDisplayedRowAtIndex(r);
          if (!rowNode) continue;

          // 使用正餘數公式處理往上/左拖拉的情形
          const relRow = (((r - finalRange.rStart) % sourceRows) + sourceRows) % sourceRows;
          const sourceData = gridRef.current.api.getDisplayedRowAtIndex(finalRange.rStart + relRow).data;

          for (let c = tempRange.cStart; c <= tempRange.cEnd; c++) {
            const relCol = (((c - finalRange.cStart) % sourceCols) + sourceCols) % sourceCols;
            const sourceColId = colIds[finalRange.cStart + relCol];
            rowNode.setDataValue(colIds[c], sourceData[sourceColId]);
          }
        }
      }
      setFinalRange({ ...tempRange });
    }
    setIsDragging(false);
    setTempRange(null);
    setDragMode(null);
    if (gridRef.current) gridRef.current.api.refreshCells({ force: true });
  }, [isDragging, tempRange, dragMode, finalRange]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return (
    <div className="ag-theme-alpine" style={{ height: 500, width: '100%', padding: '20px' }}>
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={[{ field: 'make' }, { field: 'model' }, { field: 'price' }, { field: 'good' }].map((c) => ({
          ...c,
          cellClassRules,
          editable: true,
          flex: 1,
        }))}
        onCellMouseDown={onCellMouseDown}
        onCellMouseOver={onCellMouseOver}
        enableCellTextSelection={false}
        suppressCellFocus={false}
      />
    </div>
  );
};

export default UltimateGrid;