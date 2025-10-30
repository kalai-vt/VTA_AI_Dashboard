import { FilterOption } from '../types/message';

export const applyFilters = (data: any[], filters: FilterOption[]): any[] => {
  if (!filters || filters.length === 0) return data;

  return data.filter(row => {
    return filters.every(filter => {
      const rowValue = row[filter.column];
      
      switch (filter.operator) {
        case 'equals':
          return String(rowValue).toLowerCase() === String(filter.value).toLowerCase();
        
        case 'contains':
          return String(rowValue).toLowerCase().includes(String(filter.value).toLowerCase());
        
        case 'greater_than':
          return parseFloat(rowValue) > parseFloat(filter.value as string);
        
        case 'less_than':
          return parseFloat(rowValue) < parseFloat(filter.value as string);
        
        case 'between':
          const [min, max] = filter.value as [number, number];
          const numValue = parseFloat(rowValue);
          return numValue >= min && numValue <= max;
        
        case 'in':
          const values = filter.value as string[];
          return values.includes(String(rowValue));
        
        default:
          return true;
      }
    });
  });
};

