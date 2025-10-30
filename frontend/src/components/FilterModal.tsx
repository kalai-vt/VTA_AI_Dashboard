import React, { useState, useEffect } from 'react';
import { FilterOption } from '../types/message';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterOption[]) => void;
  columns: string[];
  data: any[];
  currentFilters?: FilterOption[];
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  onApply,
  columns,
  data,
  currentFilters = []
}) => {
  const [filters, setFilters] = useState<FilterOption[]>(currentFilters);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [operator, setOperator] = useState<FilterOption['operator']>('equals');
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setFilters(currentFilters);
    }
  }, [isOpen, currentFilters]);

  const handleAddFilter = () => {
    if (!selectedColumn) return;

    const newFilter: FilterOption = {
      column: selectedColumn,
      operator,
      value: operator === 'between' ? [parseFloat(value.split(',')[0]) || 0, parseFloat(value.split(',')[1]) || 0] :
             operator === 'in' ? value.split(',').map(v => v.trim()) :
             isNaN(parseFloat(value)) ? value : parseFloat(value)
    };

    setFilters([...filters, newFilter]);
    setSelectedColumn('');
    setValue('');
    setOperator('equals');
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters([]);
    onApply([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="vta-modal-overlay" onClick={onClose}>
      <div className="vta-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="vta-modal-header">
          <h3>Apply Filters</h3>
          <button onClick={onClose} className="vta-modal-close">×</button>
        </div>
        
        <div className="vta-modal-body">
          {/* Add new filter */}
          <div className="vta-filter-form">
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="vta-select"
            >
              <option value="">Select Column</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as FilterOption['operator'])}
              className="vta-select"
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater Than</option>
              <option value="less_than">Less Than</option>
              <option value="between">Between</option>
              <option value="in">In (comma-separated)</option>
            </select>
            
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={operator === 'between' ? 'min, max' : operator === 'in' ? 'value1, value2, ...' : 'Value'}
              className="vta-input"
            />
            
            <button onClick={handleAddFilter} className="vta-btn-primary" disabled={!selectedColumn}>
              Add Filter
            </button>
          </div>

          {/* Active filters */}
          {filters.length > 0 && (
            <div className="vta-active-filters">
              <h4>Active Filters:</h4>
              {filters.map((filter, index) => (
                <div key={index} className="vta-filter-tag">
                  <span>{filter.column} {filter.operator} {Array.isArray(filter.value) ? filter.value.join(', ') : filter.value}</span>
                  <button onClick={() => handleRemoveFilter(index)} className="vta-filter-remove">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="vta-modal-footer">
          <button onClick={handleClear} className="vta-btn-secondary">Clear All</button>
          <button onClick={handleApply} className="vta-btn-primary">Apply Filters</button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;

