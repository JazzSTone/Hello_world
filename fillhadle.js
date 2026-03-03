import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css'; 
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './fillhandle.css';

const FillHandleGrid = () => {
    const gridRef = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const [startCell, setStartCell] = useState(null);
    const [currentCell, setCurrentCell] = useState(null);
    const [selectedRange, setSelectedRange] = useState(null);

    const [rowData, setRowData] = useState([
        { id: 1, make: 'Toyota', model: 'Celica', price: '35000', good: '1'},
        { id: 2, make: 'Ford', model: 'Mondeo', price: '32000', good: '2'},
        { id: 3, make: 'Porsche', model: 'Boxster', price: '72000', good: '3'},
        { id: 4, make: 'BMW', model: '10', price: '60000', good: '4'},
        { id: 5, make: 'Audi', model: 'A4', price: '50000', good: '5'},
    ]);

    const getColumnInfo = () => gridRef.current.api.getColumns().map(c => c.getColId());

    // 核心邏輯：鎖定方向
    const getLockedRange = () => {
        if (isDragging && startCell && currentCell) {
            const rowDiff = Math.abs(currentCell.rowIndex - startCell.rowIndex);
            const colDiff = Math.abs(currentCell.colIndex - startCell.colIndex);

            // 如果垂直位移較大，鎖定在同一欄 (Vertical)
            if (rowDiff >= colDiff) {
                return {
                    rStart: Math.min(startCell.rowIndex, currentCell.rowIndex),
                    rEnd: Math.max(startCell.rowIndex, currentCell.rowIndex),
                    cStart: startCell.colIndex,
                    cEnd: startCell.colIndex
                };
            } 
            // 如果水平位移較大，鎖定在同一列 (Horizontal)
            else {
                return {
                    rStart: startCell.rowIndex,
                    rEnd: startCell.rowIndex,
                    cStart: Math.min(startCell.colIndex, currentCell.colIndex),
                    cEnd: Math.max(startCell.colIndex, currentCell.colIndex)
                };
            }
        }
        return selectedRange;
    };

    const cellClassRules = {
        'fill-preview': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && p.node.rowIndex >= r.rStart && p.node.rowIndex <= r.rEnd && idx >= r.cStart && idx <= r.cEnd;
        },
        'fill-preview-top': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && p.node.rowIndex === r.rStart && idx >= r.cStart && idx <= r.cEnd;
        },
        'fill-preview-bottom': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && p.node.rowIndex === r.rEnd && idx >= r.cStart && idx <= r.cEnd;
        },
        'fill-preview-left': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && idx === r.cStart && p.node.rowIndex >= r.rStart && p.node.rowIndex <= r.rEnd;
        },
        'fill-preview-right': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && idx === r.cEnd && p.node.rowIndex >= r.rStart && p.node.rowIndex <= r.rEnd;
        },
        'fill-handle-target': (p) => {
            const r = getLockedRange();
            const idx = getColumnInfo().indexOf(p.column.getColId());
            return r && p.node.rowIndex === r.rEnd && idx === r.cEnd;
        }
    };

    const columnDefs = [
        { field: 'make', cellClassRules },
        { field: 'model', cellClassRules },
        { field: 'price', cellClassRules },
        { field: 'good', cellClassRules },
    ];

    const onCellMouseDown = useCallback((params) => {
        const e = params.event;
        const cellElement = e.target.closest('.ag-cell');
        if (!cellElement) return;

        const rect = cellElement.getBoundingClientRect();
        const isCorner = (rect.right - e.clientX < 15) && (rect.bottom - e.clientY < 15);

        if (isCorner) {
            setIsDragging(true);
            setSelectedRange(null);
            const colIds = getColumnInfo();
            setStartCell({
                rowIndex: params.rowIndex,
                colIndex: colIds.indexOf(params.column.getColId()),
                value: params.value
            });
            setCurrentCell({ rowIndex: params.rowIndex, colIndex: colIds.indexOf(params.column.getColId()) });
            e.preventDefault();
        } else {
            setSelectedRange(null);
            gridRef.current.api.refreshCells({ force: true });
        }
    }, []);

    const onCellMouseOver = useCallback((params) => {
        if (isDragging) {
            const colIds = getColumnInfo();
            setCurrentCell({ 
                rowIndex: params.rowIndex, 
                colIndex: colIds.indexOf(params.column.getColId()) 
            });
            gridRef.current.api.refreshCells({ force: true });
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        if (isDragging && startCell && currentCell) {
            const range = getLockedRange();
            const colIds = getColumnInfo();

            for (let r = range.rStart; r <= range.rEnd; r++) {
                const rowNode = gridRef.current.api.getDisplayedRowAtIndex(r);
                if (rowNode) {
                    for (let c = range.cStart; c <= range.cEnd; c++) {
                        rowNode.setDataValue(colIds[c], startCell.value);
                    }
                }
            }
            setSelectedRange(range);
        }
        setIsDragging(false);
        setStartCell(null);
        setCurrentCell(null);
        if (gridRef.current) gridRef.current.api.refreshCells({ force: true });
    }, [isDragging, startCell, currentCell]);

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseUp]);

    return (
        <div className="ag-theme-alpine" style={{ height: '400px', width: '800px' }}>
            <AgGridReact
                ref={gridRef}
                rowData={rowData}
                columnDefs={columnDefs}
                onCellMouseDown={onCellMouseDown}
                onCellMouseOver={onCellMouseOver}
                enableCellTextSelection={false}
            />
        </div>
    );
};

export default FillHandleGrid;